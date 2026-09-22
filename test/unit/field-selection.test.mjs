/**
 * ONE SELECTION PER FIELD, HELD BY THE SOURCE.
 *
 * A field is drawn in several places at once — a filter chip, a column
 * heading, a chart legend. Each used to keep its own copy, so two controls
 * over one field could show two answers and neither was wrong. The source
 * holds the one reading they all read.
 *
 * TRAP T-one-field-one-filter-menu
 *
 *   node --test test/unit/field-selection.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { ArrayStore, DataSource } =
  await import(new URL('../../dist/data.js', import.meta.url));

const ROWS = [
  { id: 1, plan: 'Free', region: 'EMEA' },
  { id: 2, plan: 'Pro', region: 'EMEA' },
  { id: 3, plan: 'Pro', region: 'AMER' },
  { id: 4, plan: 'Enterprise', region: 'APAC' },
];

const PLANS = ['Enterprise', 'Free', 'Pro'];

/** A source with `plan` declared, loaded once. */
const ready = async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareValues('plan', PLANS);
  await source.load();
  return source;
};

/* ── The reading is the field's, not a control's ────────────────────── */

test('a field with nothing selected is OFF, and every value is offered', async () => {
  const source = await ready();
  const s = source.selection('plan');
  assert.equal(s.fieldState, 'off');
  assert.deepEqual(s.values.map((v) => v.value), PLANS);
  assert.deepEqual(source.selectedFields, []);
});

test('TWO READERS, ONE ANSWER — the whole point', async () => {
  const source = await ready();
  // A chip selects. A column heading asks. Neither knows the other exists.
  source.select('plan', ['Pro']);

  const chip = source.selection('plan');
  const column = source.selection('plan');
  assert.deepEqual(chip, column, 'the same state, whoever asks');
  assert.equal(chip.fieldState, 'active');
  assert.deepEqual(
    chip.values.map((v) => v.state),
    ['unpicked', 'unpicked', 'picked'],
  );
});

test('the selection REACHES THE QUERY, with no contribute() call', async () => {
  const source = await ready();
  source.select('plan', ['Pro']);
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [2, 3]);
});

test('TWO FIELDS narrow together — they AND, they do not replace', async () => {
  const source = await ready();
  source.declareValues('region', ['AMER', 'APAC', 'EMEA']);
  source.select('plan', ['Pro']);
  source.select('region', ['EMEA']);
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [2]);
  assert.deepEqual(source.selectedFields.sort(), ['plan', 'region']);
});

test('a field selection ANDs with a named contribute() part', async () => {
  const source = await ready();
  source.contribute('view', ['region', 'eq', 'EMEA']);
  source.select('plan', ['Pro']);
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [2], 'both applied, neither lost');
});

test('an EMPTY selection clears the field', async () => {
  const source = await ready();
  source.select('plan', ['Pro']);
  source.select('plan', []);
  await source.load();
  assert.equal(source.selection('plan').fieldState, 'off');
  assert.deepEqual(source.selectedFields, []);
  assert.equal(source.rows.length, 4, 'every row is back');
});

/* ── Suspend, and the rules filter-state already owns ───────────────── */

test('SUSPENDED keeps the values and stops filtering', async () => {
  const source = await ready();
  source.select('plan', ['Pro']);
  source.suspendSelection('plan');
  await source.load();
  const s = source.selection('plan');
  assert.equal(s.fieldState, 'suspended', 'TRAP T-grid-suspend-is-not-clear');
  assert.equal(s.values.find((v) => v.value === 'Pro').state, 'picked', 'the pick survives');
  assert.equal(source.rows.length, 4, 'and nothing is applied');
});

test('EVERYTHING selected is the same rows as no filter', async () => {
  const source = await ready();
  source.select('plan', PLANS);
  await source.load();
  assert.equal(source.selection('plan').fieldState, 'off', 'TRAP T-everything-on-is-no-filter');
  assert.equal(source.rows.length, 4);
});

test('the comparison is the QUERY\'s, so casing cannot break a pick', async () => {
  const source = await ready();
  source.select('plan', ['pro']);
  await source.load();
  assert.equal(source.selection('plan').values.find((v) => v.value === 'Pro').state, 'picked');
  assert.deepEqual(source.rows.map((r) => r.id), [2, 3]);
});

/* ── The event every control listens to ─────────────────────────────── */

test('selecting ANNOUNCES the field, so other controls re-read', async () => {
  const source = await ready();
  const heard = [];
  source.addEventListener('selection-change', (e) => heard.push(e.detail.field));
  source.select('plan', ['Pro']);
  source.select('plan', []);
  assert.deepEqual(heard, ['plan', 'plan'], 'clearing is a change too');
});

/* ── A whole view state REPLACES the selections ─────────────────────── */

test('setState({filter}) clears the field readings', async () => {
  const source = await ready();
  source.select('plan', ['Pro']);
  source.setState({ filter: ['region', 'eq', 'APAC'] });
  await source.load();
  assert.equal(source.selection('plan').fieldState, 'off',
    'a restored view must not keep ticks its query does not carry');
  assert.deepEqual(source.rows.map((r) => r.id), [4]);
});

test('valuesFor gives a control the rows to draw', async () => {
  const source = await ready();
  assert.deepEqual(source.valuesFor('plan'), PLANS);
  assert.deepEqual(source.valuesFor('nothing'), [], 'an undeclared field is empty, never broken');
});
