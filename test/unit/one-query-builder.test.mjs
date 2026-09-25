/**
 * STEERING GOES THROUGH THE ONE QUERY BUILDER.
 *
 * `DataSource.#steer` used to build its own clause from a `quick-filter-change`
 * detail, and call `setFilter()` — which replaces the WHOLE query. So the old
 * path knew no field type, no range and no condition, and one column heading
 * could wipe every chip.
 *
 *   node --test test/unit/one-query-builder.test.mjs
 *
 * TRAP T-one-query-builder-in-the-data-layer
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

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

test('a control with `readings` is ASKED, so its field TYPE is honoured', async () => {
  const src = await source();
  const el = bar({ readings: { seats: { picked: ['5', '50'], range: true } } });
  src.bind(el, { steerOnly: true });

  el.dispatchEvent(new CustomEvent('quick-filter-change', { detail: {} }));
  await settle();

  // A RANGE, cast to numbers: 5..50 keeps two rows and drops the 500.
  assert.equal(src.selection('seats').range, true);
  assert.deepEqual(ids(src), [1, 2]);
  /* The old builder said `in ["5","50"]` — a LIST, of STRINGS, against rows
     holding numbers, so it matched nothing at all. */
});

test('a control WITHOUT `readings` has its values read as parameters, not a clause', async () => {
  const src = await source();
  const el = bar();
  src.bind(el, { steerOnly: true });

  el.dispatchEvent(new CustomEvent('quick-filter-change', {
    detail: { values: { owner: ['Dana', 'Pia'] }, active: ['whatever'] },
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
  src.bind(el, { steerOnly: true });

  // A component part and a field selection are both live.
  src.contribute('legend', ['seats', 'lte', 500]);
  src.select('owner', ['Dana', 'Ravi']);
  await settle();
  assert.deepEqual(ids(src), [1, 2]);

  // Typing in one column heading used to call setFilter() and replace BOTH.
  el.dispatchEvent(new CustomEvent('filter-change', {
    detail: { field: 'owner', value: 'Rav' },
  }));
  await settle();

  assert.deepEqual(ids(src), [2]);
  assert.deepEqual(src.contributions, ['legend']);

  // Emptying the box clears that field only.
  el.dispatchEvent(new CustomEvent('filter-change', { detail: { field: 'owner', value: '' } }));
  await settle();
  assert.deepEqual(ids(src), [1, 2, 3]);
  assert.deepEqual(src.contributions, ['legend']);
});
