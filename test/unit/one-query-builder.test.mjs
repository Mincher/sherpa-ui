/**
 * STEERING GOES THROUGH THE ONE QUERY BUILDER.
 *
 * `DataSource.#steer` used to build its own clause from a `quick-filter-change`
 * detail, and replace the WHOLE query with it. So the old
 * path knew no field type, no range and no condition, and one column heading
 * could wipe every chip.
 *
 *   node --test test/unit/one-query-builder.test.mjs
 *
 * TRAP T-one-query-builder-in-the-data-layer
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, owner: 'Dana', seats: 5 },
  { id: 2, owner: 'Ravi', seats: 50 },
  { id: 3, owner: 'Pia', seats: 500 },
];

const settle = () => new Promise((r) => setTimeout(r, 40));
const ids = (src) => src.rows.map((r) => r.id);

/** A bare bound element — no DOM needed, only the events `bind()` listens for. */
function bar(extra = {}) {
  return Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    ...extra,
  });
}

async function source() {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), autoLoad: false });
  await src.ready;
  src.declareField('seats', { type: 'number' });
  src.declareValues('owner', ['Dana', 'Ravi', 'Pia']);
  await src.load();
  return src;
}

test('a request\'s reading is believed, so its field TYPE is honoured', async () => {
  const src = await source();
  const el = bar();
  bindSource(src, el, { steerOnly: true, scope: 'view' });

  // A number's range is an Advanced Between row (TODO 375).
  el.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request: { field: 'seats', reading: {
    conditions: [{ op: 'between', picked: ['5', '50'] }], mode: 'advanced' } } } }));
  await settle();

  // A RANGE, cast to numbers: 5..50 keeps two rows and drops the 500.
  assert.equal(src.selection('seats').condition, 'advanced');
  assert.deepEqual(ids(src), [1, 2]);
  /* The old builder said `in ["5","50"]` — a LIST, of STRINGS, against rows
     holding numbers, so it matched nothing at all. */
});

test('a request\'s picks are parameters, not a clause; the ticks riding along ask nothing', async () => {
  const src = await source();
  const el = bar();
  bindSource(src, el, { steerOnly: true, scope: 'view' });

  el.dispatchEvent(new CustomEvent('quick-filter-change', {
    detail: { request: { field: 'owner', reading: { picked: ['Dana', 'Pia'] } }, values: { owner: ['Ravi'] }, active: ['whatever'] },
  }));
  await settle();

  assert.deepEqual(ids(src), [1, 3]);
  // It landed in the FIELD's own slot, so every other control reads it back.
  assert.deepEqual(
    src.selection('owner').values.filter((v) => v.state === 'picked').map((v) => v.value),
    ['Dana', 'Pia'],
  );
});

test('a column filter narrows, and does NOT wipe what else is applied', async () => {
  const src = await source();
  const el = bar();
  bindSource(src, el, { steerOnly: true });

  // Two fields' selections are both live.
  src.query.setReading('view', 'seats', { mode: 'advanced', conditions: [{ op: 'lt', text: '500' }], picked: [] });
  src.query.setReading('view', 'owner', { picked: ['Dana', 'Ravi'] });
  await settle();
  assert.deepEqual(ids(src), [1, 2]);

  // Typing in one column heading used to replace BOTH.
  el.dispatchEvent(new CustomEvent('filter-change', {
    detail: { field: 'owner', value: 'Rav' },
  }));
  await settle();

  assert.deepEqual(ids(src), [2]);
  assert.equal(src.selection('seats').condition, 'advanced');

  // Emptying the box clears that field only.
  el.dispatchEvent(new CustomEvent('filter-change', { detail: { field: 'owner', value: '' } }));
  await settle();
  assert.deepEqual(ids(src), [1, 2]);
  assert.equal(src.selection('seats').condition, 'advanced');
});
