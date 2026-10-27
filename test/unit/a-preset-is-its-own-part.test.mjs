/**
 * A PRESET IS ITS OWN PART — Will, TODO 493 (A). A scope's definition names its
 * presets: the app's own conditions, over several fields, each a boolean chip.
 * On, they narrow beside the fields' answers, which they never change; off, they
 * go. The Switch stops them and keeps them; Reset turns them off.
 *
 *   node --test test/unit/a-preset-is-its-own-part.test.mjs
 *
 * TRAP T-a-preset-is-its-own-part
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindSource, openSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, health: 40, tickets: 2, plan: 'pro' },
  { id: 2, health: 40, tickets: 0, plan: 'pro' },
  { id: 3, health: 90, tickets: 3, plan: 'free' },
  { id: 4, health: 50, tickets: 1, plan: 'free' },
];
const settle = () => new Promise((res) => setTimeout(res, 20));

async function page() {
  const source = await openSource({
    store: 'rows',
    fields: { health: { label: 'Health', type: 'number' }, tickets: { label: 'Tickets', type: 'number' }, plan: { label: 'Plan' } },
    scopes: {
      data: {
        label: 'Rows', holds: ['plan'],
        presets: [{ id: 'high-risk', label: 'High risk', where: { health: { lt: 60 }, tickets: { gt: 0 } } }],
      },
    },
  }, new ArrayStore(ROWS, { key: 'id' }));
  bindSource(source, { populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} }, { scope: 'data' });
  await source.load();
  await settle();
  return source;
}
const ids = (source) => source.rows.map((r) => r.id).sort();

test('a preset leads its scope as a boolean chip, off at the start', async () => {
  const source = await page();
  const [first, ...rest] = source.describe('data').filters;
  assert.deepEqual(first, { id: 'preset:high-risk', label: 'High risk', preset: true, active: false });
  assert.deepEqual(rest.map((f) => f.id), ['plan']);
  assert.deepEqual(ids(source), [1, 2, 3, 4]);
});

test('on, it narrows by its own conditions, beside the fields, which it never changes', async () => {
  const source = await page();
  source.query.setPreset('data', 'high-risk', true);
  source.query.commit({ scope: 'data' });
  await source.load();
  await settle();
  assert.deepEqual(ids(source), [1, 4]);
  assert.equal(source.describe('data').filters[0].active, true);
  assert.deepEqual(source.query.applied.scopes.data.readings, {});
  // A field's answer narrows within it.
  source.query.setReading('data', 'plan', { picked: ['free'] });
  source.query.commit({ scope: 'data' });
  await source.load();
  await settle();
  assert.deepEqual(ids(source), [4]);
  // Off, only the field's answer is left.
  source.query.setPreset('data', 'high-risk', false);
  source.query.commit({ scope: 'data' });
  await source.load();
  await settle();
  assert.deepEqual(ids(source), [3, 4]);
});

test('the Switch stops a preset and keeps it on; Reset turns it off', async () => {
  const source = await page();
  source.query.setPreset('data', 'high-risk', true);
  source.query.commit({ scope: 'data' });
  source.query.suspend('data', null, true);
  await source.load();
  await settle();
  assert.deepEqual(ids(source), [1, 2, 3, 4]);
  source.query.suspend('data', null, false);
  await source.load();
  await settle();
  assert.deepEqual(ids(source), [1, 4]);
  source.query.reset(['data']);
  source.query.commit({ scope: 'data' });
  await source.load();
  await settle();
  assert.deepEqual(ids(source), [1, 2, 3, 4]);
  assert.equal(source.query.applied.scopes.data?.presets, undefined);
});
