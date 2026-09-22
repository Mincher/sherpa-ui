/**
 * A VALUE CAN BE A STRING, A NUMBER, OR AN OBJECT.
 *
 * Will's rule, 2026-09-22: "A value can be a string, number, or object (which
 * is also a set of fields and values)."
 *
 * `text()` — the one function the comparison layer routes through — was
 * `String(v).toLowerCase()`, which is `"[object object]"` for EVERY object. So
 * any two objects compared equal, a filter matched every row that had the
 * field at all, and picking one value marked them all. Nothing said so.
 *
 * TRAP T-a-value-can-be-an-object
 *
 *   node --test test/unit/value-types.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { ArrayStore, DataSource, fieldState, stateClause, valueKey, valueSet, sortRows } =
  await import(new URL('../../dist/data.js', import.meta.url));

const RAVI = { id: 'r', name: 'Ravi' };
const DANA = { id: 'd', name: 'Dana' };

const ROWS = [
  { id: 1, owner: { id: 'r', name: 'Ravi' }, seats: 9,   due: new Date('2026-03-01') },
  { id: 2, owner: { id: 'd', name: 'Dana' }, seats: 100, due: new Date('2026-01-01') },
  { id: 3, owner: { id: 'r', name: 'Ravi' }, seats: 10,  due: new Date('2026-02-01') },
];

const sourceWith = () => new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });

/* ── valueKey: one string form for any value ────────────────────────── */

test('a STRING and a NUMBER are themselves', () => {
  assert.equal(valueKey('Free'), 'Free', 'case is KEPT — this is a display key');
  assert.equal(valueKey(10), '10');
  assert.equal(valueKey(0), '0', 'zero is a value, not nothing');
  assert.equal(valueKey(false), 'false');
  assert.equal(valueKey(null), '');
  assert.equal(valueKey(undefined), '');
});

test('an OBJECT is its own fields and values', () => {
  assert.equal(valueKey(RAVI), '{id:r,name:Ravi}');
  assert.notEqual(valueKey(RAVI), valueKey(DANA), 'two owners are two values');
});

test('KEY ORDER does not change the value', () => {
  assert.equal(valueKey({ id: 'r', name: 'Ravi' }), valueKey({ name: 'Ravi', id: 'r' }));
});

test('it RECURSES — a value inside an object is a value too', () => {
  assert.equal(valueKey({ a: { b: 1 } }), '{a:{b:1}}');
  assert.equal(valueKey([1, 'two', { c: 3 }]), '[1,two,{c:3}]');
});

test('a DATE is a value, not a bag of fields', () => {
  const d = new Date('2026-01-01T00:00:00Z');
  assert.equal(valueKey(d), String(d.getTime()));
});

test('valueSet still compares the way the QUERY does', () => {
  assert.equal(valueSet(['Free']).has('free'), true, 'loosely, for strings');
  assert.equal(valueSet([RAVI]).has({ name: 'Ravi', id: 'r' }), true, 'and by fields, for objects');
  assert.equal(valueSet([RAVI]).has(DANA), false, 'TWO owners are not one');
});

/* ── The query ──────────────────────────────────────────────────────── */

test('filtering `eq` an OBJECT matches only that object', async () => {
  const s = sourceWith();
  s.setFilter(['owner', 'eq', { id: 'r', name: 'Ravi' }]);
  await s.load();
  assert.deepEqual(s.rows.map((r) => r.id), [1, 3],
    'it used to match all three — every object equalled every other');
});

test('a NESTED path still works, and is the other way to ask', async () => {
  const s = sourceWith();
  s.setFilter(['owner.name', 'eq', 'Ravi']);
  await s.load();
  assert.deepEqual(s.rows.map((r) => r.id), [1, 3]);
});

test('a NUMBER sorts as a number, not as text', () => {
  const sorted = sortRows(ROWS, [{ field: 'seats', direction: 'asc' }]);
  assert.deepEqual(sorted.map((r) => r.seats), [9, 10, 100],
    'lexically, "100" would come before "9"');
});

test('a nested path SORTS too', () => {
  const sorted = sortRows(ROWS, [{ field: 'owner.name', direction: 'asc' }]);
  assert.deepEqual(sorted.map((r) => r.owner.name), ['Dana', 'Ravi', 'Ravi']);
});

/* ── fieldState: key out, raw kept ──────────────────────────────────── */

test('an OBJECT value keeps its identity AND gets a usable key', () => {
  const s = fieldState({ field: 'owner', values: [RAVI, DANA] }, { picked: [RAVI] });
  assert.deepEqual(s.values.map((v) => v.value), ['{id:r,name:Ravi}', '{id:d,name:Dana}']);
  assert.deepEqual(s.values.map((v) => v.raw), [RAVI, DANA], 'the row\'s own value survives');
  assert.deepEqual(
    s.values.filter((v) => v.state === 'picked').map((v) => v.raw.name),
    ['Ravi'],
    'ONE picked — it used to be both',
  );
});

test('a NUMBER stays a number in `raw`, and its clause carries the number', () => {
  const s = fieldState({ field: 'seats', values: [9, 10, 100] }, { picked: [10] });
  assert.deepEqual(s.values.map((v) => v.value), ['9', '10', '100'], 'the attribute form');
  assert.deepEqual(s.values.map((v) => v.raw), [9, 10, 100]);
  assert.equal(typeof s.values[1].raw, 'number');
  assert.deepEqual(stateClause(s), ['seats', 'eq', 10], 'a NUMBER reaches the query');
});

test('an object clause carries the OBJECT, never its key', () => {
  const s = fieldState({ field: 'owner', values: [RAVI, DANA] }, { picked: [RAVI] });
  assert.deepEqual(stateClause(s), ['owner', 'eq', RAVI]);
});

/* ── Through the source ─────────────────────────────────────────────── */

test('declareValues KEEPS the values as the data holds them', () => {
  const s = sourceWith();
  s.declareValues('owner', [RAVI, DANA]);
  assert.deepEqual(s.valuesFor('owner'), [RAVI, DANA],
    'they used to come back as "[object Object]" strings');
});

test('declareValues de-duplicates by VALUE, not by reference', () => {
  const s = sourceWith();
  s.declareValues('owner', [RAVI, { id: 'r', name: 'Ravi' }, DANA]);
  assert.equal(s.valuesFor('owner').length, 2, 'the same owner twice is one value');
});

test('select() takes the KEY a control hands back', async () => {
  const s = sourceWith();
  s.declareValues('owner', [RAVI, DANA]);
  // This is what a menu row gives you: `input.value`, a string.
  s.select('owner', [valueKey(RAVI)]);
  await s.load();
  assert.deepEqual(s.rows.map((r) => r.id), [1, 3]);
});

test('select() takes the RAW value too', async () => {
  const s = sourceWith();
  s.declareValues('owner', [RAVI, DANA]);
  s.select('owner', [RAVI]);
  await s.load();
  assert.deepEqual(s.rows.map((r) => r.id), [1, 3]);
});

test('a NUMBER field selects by key and filters as a number', async () => {
  const s = sourceWith();
  s.declareValues('seats', [9, 10, 100]);
  s.select('seats', ['10']);
  await s.load();
  assert.deepEqual(s.rows.map((r) => r.id), [3]);
  assert.deepEqual(s.selection('seats').values.map((v) => v.raw), [9, 10, 100]);
});
