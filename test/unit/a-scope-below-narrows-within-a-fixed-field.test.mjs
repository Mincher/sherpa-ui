/**
 * A SCOPE BELOW NARROWS WITHIN A FIXED FIELD — Will, TODO 554: a field the View holds fixed cannot move down, but a
 * local scope may still add it, as its own chip. That chip's answer is the scope's, ANDed under the View's; it offers
 * what the View leaves (347), and a pick the View rules out leaves it (512 A). A page that fixes nothing is as before.
 *
 *   node --test test/unit/a-scope-below-narrows-within-a-fixed-field.test.mjs
 *
 * TRAP T-a-scope-below-narrows-within-a-fixed-field
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindSource, fakeRemote, openSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, customer: 'Acme', region: 'EU', health: 'Good', plan: 'Pro' },
  { id: 2, customer: 'Acme', region: 'US', health: 'Poor', plan: 'Free' },
  { id: 3, customer: 'Globex', region: 'EU', health: 'Good', plan: 'Pro' },
  { id: 4, customer: 'Initech', region: 'US', health: 'Good', plan: 'Pro' },
];
const scopes = (fixed) => ({
  view: { label: 'View Context', holds: ['customer', 'region', 'health'], ...(fixed ? { fixed: ['customer', 'region'] } : {}) },
  data: { label: 'Rows', offers: 'all', holds: ['plan'] },
});
const DEF = (fixed = true) => ({
  store: 'rows',
  // Each opens on every row, as Records' Customer does.
  fields: Object.fromEntries(['customer', 'region', 'health', 'plan'].map((f) => [f, { label: f, start: 'all' }])),
  scopes: scopes(fixed),
});
const settle = () => new Promise((res) => setTimeout(res, 30));

/** A bar that keeps what it is told: what is held above it, and what each field offers. */
const bar = () => Object.assign(new EventTarget(), {
  above: null, present: null, populate() {}, setAttribute() {}, removeAttribute() {}, toggleAttribute() {}, drawScope() {},
  supersede(readings) { this.above = Object.keys(readings).sort(); },
  drawPresent(present) { this.present = present; },
});
/** A grid the binder fills. */
const grid = () => Object.assign(new EventTarget(), {
  given: null, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate(p) { this.given = p; }, drawScope() {},
});
const ids = (payload) => (Array.isArray(payload) ? payload : payload?.rows ?? []).map((r) => r.id).sort();

async function page(fixed = true, remote = false) {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const source = await openSource(DEF(fixed), remote ? fakeRemote(store, { delay: 0 }) : store);
  const cards = bar();
  const rows = grid();
  bindSource(source, bar(), { scope: 'view' });
  bindSource(source, cards, { scope: 'data' });
  bindSource(source, rows, { scope: 'data' });
  await source.load();
  await settle();
  const ask = async (request) => {
    source.query.ask(request);
    await source.load();
    await settle();
  };
  return { source, cards, rows, ask };
}

test('below the View, a field it FIXES may be added — moving nothing — and one it holds unfixed may not', async () => {
  const { source } = await page();
  const offered = source.addable('data');
  assert.deepEqual(offered.map((f) => f.id).filter((id) => ['customer', 'region', 'health'].includes(id)), ['customer', 'region']);
  assert.equal(offered.find((f) => f.id === 'customer').note, undefined, 'it stays the View\'s too: no "moves from"');
  // A page that fixes nothing: down is closed, as before.
  const open = await page(false);
  assert.deepEqual(open.source.addable('data').map((f) => f.id).filter((id) => ['customer', 'region', 'health'].includes(id)), []);
});

test('added, it is the scope\'s OWN: its answer narrows that scope under the View\'s, and the View\'s answer stays', async () => {
  const { source, cards, rows, ask } = await page();
  await ask({ scope: 'view', field: 'customer', reading: { picked: ['Acme', 'Globex'] } });
  assert.deepEqual(ids(rows.given), [1, 2, 3]);
  await ask({ scope: 'data', hold: ['plan', 'customer'] });
  // Free in its bar, and offering only what the View leaves.
  assert.deepEqual(cards.above, ['health', 'region']);
  assert.deepEqual([...cards.present.customer].sort(), ['Acme', 'Globex']);
  await ask({ scope: 'data', field: 'customer', reading: { picked: ['Acme'] } });
  assert.deepEqual(source.query.reading('view', 'customer').picked, ['Acme', 'Globex'], 'the View\'s answer is its own');
  assert.deepEqual(source.query.reading('data', 'customer').picked, ['Acme']);
  assert.deepEqual(ids(rows.given), [1, 2]);
  const chip = source.describe('data').filters.find((f) => f.id === 'customer');
  assert.equal(chip.appliedAt, undefined, 'its chip is not held above');
  assert.deepEqual(chip.state.picked, ['Acme']);
  assert.equal(source.fieldStatus('customer', 'data').home, 'data');
  // The View's chip changes the View's answer, and leaves the scope's.
  await ask({ scope: 'view', field: 'customer', reading: { picked: ['Acme', 'Initech'] } });
  assert.deepEqual(source.query.reading('data', 'customer').picked, ['Acme']);
  assert.deepEqual(ids(rows.given), [1, 2]);
  // Switched off, the scope's answer is kept and narrows nothing; on, it narrows again.
  await ask({ scope: 'data', field: 'customer', suspended: true });
  assert.deepEqual(ids(rows.given), [1, 2, 4]);
  assert.equal(source.query.reading('view', 'customer').suspended, undefined);
  await ask({ scope: 'data', field: 'customer', suspended: false });
  assert.deepEqual(ids(rows.given), [1, 2]);
});

test('a pick the View rules out leaves the scope\'s answer (512 A); its chip let go, the View\'s stays', async () => {
  const { source, cards, rows, ask } = await page();
  await ask({ scope: 'data', hold: ['plan', 'customer'] });
  await ask({ scope: 'data', field: 'customer', reading: { picked: ['Acme', 'Globex'] } });
  assert.deepEqual(ids(rows.given), [1, 2, 3]);
  // Never no rows and no chip that says why: Acme leaves, Globex stays.
  await ask({ scope: 'view', field: 'customer', reading: { picked: ['Globex', 'Initech'] } });
  assert.deepEqual(source.query.reading('data', 'customer').picked, ['Globex']);
  assert.deepEqual(ids(rows.given), [3]);
  await ask({ scope: 'data', release: 'customer' });
  assert.equal(source.query.reading('data', 'customer'), undefined);
  assert.deepEqual(source.query.reading('view', 'customer').picked, ['Globex', 'Initech']);
  assert.deepEqual(ids(rows.given), [3, 4]);
  assert.deepEqual(cards.above, ['customer', 'health', 'region'], 'let go, it is held above again');
});

test('over a remote store, the scope\'s own answer waits for Apply as any answer does, and Apply puts it in force', async () => {
  const { source, rows, ask } = await page(true, true);
  await ask({ scope: 'view', field: 'customer', reading: { picked: ['Acme', 'Globex'] }, commit: true });
  await ask({ scope: 'data', hold: ['plan', 'customer'] });
  await ask({ scope: 'data', field: 'customer', reading: { picked: ['Globex'] } });
  // Its change waits, though the View's answer did not move.
  assert.equal(source.query.pending('customer'), true);
  assert.deepEqual(ids(rows.given), [1, 2, 3]);
  await ask({ scope: 'data', field: 'customer', commit: true });
  assert.equal(source.query.pending('customer'), false);
  assert.deepEqual(ids(rows.given), [3]);
  assert.deepEqual(source.query.reading('view', 'customer').picked, ['Acme', 'Globex']);
});
