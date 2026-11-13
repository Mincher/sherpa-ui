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
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Pro'] } });

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
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Pro'] } });
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [2, 3]);
});

test('TWO FIELDS narrow together — they AND, they do not replace', async () => {
  const source = await ready();
  source.declareValues('region', ['AMER', 'APAC', 'EMEA']);
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Pro'] } });
  source.query.ask({ scope: 'view', field: 'region', reading: { picked: ['EMEA'] } });
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [2]);
  assert.deepEqual(source.selectedFields.sort(), ['plan', 'region']);
});

test('an EMPTY selection clears the field', async () => {
  const source = await ready();
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Pro'] } });
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: [] } });
  await source.load();
  assert.equal(source.selection('plan').fieldState, 'off');
  assert.deepEqual(source.selectedFields, []);
  assert.equal(source.rows.length, 4, 'every row is back');
});

/* ── Suspend, and the rules filter-state already owns ───────────────── */

test('SUSPENDED keeps the values and stops filtering', async () => {
  const source = await ready();
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Pro'] } });
  source.query.ask({ scope: 'view', field: 'plan', suspended: true });
  await source.load();
  const s = source.selection('plan');
  assert.equal(s.fieldState, 'suspended', 'TRAP T-grid-suspend-is-not-clear');
  assert.equal(s.values.find((v) => v.value === 'Pro').state, 'picked', 'the pick survives');
  assert.equal(source.rows.length, 4, 'and nothing is applied');
});

test('EVERYTHING selected is an answer: it filters, and every row with a plan passes (Will, 2026-11-13)', async () => {
  const source = await ready();
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: PLANS } });
  await source.load();
  assert.equal(source.selection('plan').fieldState, 'active');
  assert.equal(source.rows.length, 4);
});

test('the comparison is the QUERY\'s, so casing cannot break a pick', async () => {
  const source = await ready();
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['pro'] } });
  await source.load();
  assert.equal(source.selection('plan').values.find((v) => v.value === 'Pro').state, 'picked');
  assert.deepEqual(source.rows.map((r) => r.id), [2, 3]);
});

/* ── The event every control listens to ─────────────────────────────── */

test('selecting ANNOUNCES the field, so other controls re-read', async () => {
  const source = await ready();
  const heard = [];
  source.query.addEventListener('query-change', (e) => heard.push(...e.detail.fields));
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Pro'] } });
  source.query.ask({ scope: 'view', field: 'plan', reading: { picked: [] } });
  assert.deepEqual(heard, ['plan', 'plan'], 'clearing is a change too');
});

test('valuesFor gives a control the rows to draw', async () => {
  const source = await ready();
  assert.deepEqual(source.valuesFor('plan'), PLANS);
  assert.deepEqual(source.valuesFor('nothing'), [], 'an undeclared field is empty, never broken');
});

test('a field\'s own value labels name its values in its selection (TODO 518)', async () => {
  const { ArrayStore: Store, DataSource: Source, VIEW: V } = await import('../../dist/data.js');
  const source = new Source({ store: new Store([{ id: 1, plan: 'pro' }, { id: 2, plan: 'free' }], { key: 'id' }) });
  source.declareField('plan', { label: 'Plan', values: ['pro', 'free'], labels: { pro: 'Professional' } });
  source.query.ask({ scope: V, hold: ['plan'] });
  source.query.ask({ scope: V, field: 'plan', reading: { picked: ['pro'] } });
  await source.load();
  const labels = Object.fromEntries(source.selection('plan').values.map((v) => [v.value, v.label]));
  assert.equal(labels.pro, 'Professional');
});
