/**
 * A LEGEND TOGGLE IS A FILTER.
 *
 * Turning a row off used to hide one bar in one chart. It now writes the
 * FIELD's selection on the source, so every bound component re-reads — and a
 * chip over the same field is not kept in step, it reads the same answer.
 *
 * TRAP T-a-legend-toggle-is-a-filter
 * TRAP T-one-field-one-filter-menu
 *
 *   node --test test/unit/legend-filter.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { hiddenFilter, bindLegendFilter, DataSource, ArrayStore } =
  await import(new URL('../../dist/data.js', import.meta.url));

const STATES = ['active', 'trial', 'suspended', 'churned'];

const ROWS = [
  { id: 1, status: 'active', plan: 'Free' },
  { id: 2, status: 'active', plan: 'Pro' },
  { id: 3, status: 'trial', plan: 'Pro' },
  { id: 4, status: 'churned', plan: 'Free' },
];

/** A legend, reduced to what the rule reads: an off-set and a click event. */
const legendStub = () => {
  const el = new EventTarget();
  el.off = [];
  el.click = (label, active) => {
    el.off = active ? el.off.filter((l) => l !== label) : [...el.off, label];
    el.dispatchEvent(new CustomEvent('legend-item-click', { detail: { label, active } }));
  };
  return el;
};

const sourceWith = (rows = ROWS) =>
  new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });

/** What is picked for a field, as any control would read it. */
const picked = (source, field) =>
  source.selection(field).values.filter((v) => v.state === 'picked').map((v) => v.value);

/* ── The filter shape ───────────────────────────────────────────────── */

test('hiddenFilter: nothing hidden is NO clause, not an empty one', () => {
  assert.equal(hiddenFilter('status', new Set()), undefined,
    'undefined REMOVES the part; a clause nothing fails would still be a clause');
  assert.deepEqual(hiddenFilter('status', new Set(['churned'])), ['status', 'ne', 'churned']);
  assert.deepEqual(hiddenFilter('status', new Set(['churned', 'trial'])),
    ['status', 'notin', ['churned', 'trial']]);
});

/* ── Legend → source ────────────────────────────────────────────────── */

test('a legend click selects what is still SHOWN', () => {
  const source = sourceWith();
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  legend.click('churned', false);
  /* A filter names what it KEEPS. "Hidden" is the same fact inverted, so the
     selection is the three rows still on. */
  assert.deepEqual(picked(source, 'status'), ['active', 'trial', 'suspended']);
  assert.deepEqual(legend.off, ['churned']);
});

test('two legends over different fields do not overwrite each other', () => {
  const source = sourceWith();
  const a = legendStub();
  const b = legendStub();
  bindLegendFilter(a, source, { field: 'status', values: STATES });
  bindLegendFilter(b, source, { field: 'plan', values: ['Free', 'Pro'] });

  a.click('churned', false);
  b.click('Free', false);
  assert.deepEqual(picked(source, 'status'), ['active', 'trial', 'suspended']);
  assert.deepEqual(picked(source, 'plan'), ['Pro']);
  assert.deepEqual(source.selectedFields.sort(), ['plan', 'status']);
});

test('ALL ROWS ON is no constraint, not every value ticked', () => {
  const source = sourceWith();
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  legend.click('churned', false);
  legend.click('churned', true);
  /* Every value ticked says the same thing as nothing ticked, in a way that
     LOOKS like a filter. TRAP T-everything-on-is-no-filter */
  assert.deepEqual(picked(source, 'status'), []);
  assert.equal(source.selection('status').fieldState, 'off');
  assert.deepEqual(legend.off, []);
});

test('the LAST active row cannot be switched off', () => {
  const source = sourceWith();
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  for (const s of STATES) legend.click(s, false);
  /* Hiding the last leaves an empty chart beside an empty grid and no obvious
     way back. The click is REFUSED. TRAP T-a-legend-keeps-one-row-on */
  assert.equal(legend.off.length, 3, 'the fourth click was put back');
  assert.equal(picked(source, 'status').length, 1);
});

/* ── Legend ⇄ chip, through the source ──────────────────────────────── */

test('ONE ANSWER — a chip selecting moves the legend, with no mirroring', () => {
  const source = sourceWith();
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  // A chip would do exactly this. It does not know the legend exists.
  source.select('status', ['active']);
  assert.deepEqual(legend.off, ['trial', 'suspended', 'churned'],
    'the legend re-read the field it draws');
});

test('and the legend moving is the same state a chip would read', () => {
  const source = sourceWith();
  const legend = legendStub();
  const binding = bindLegendFilter(legend, source, { field: 'status', values: STATES });

  legend.click('churned', false);
  // A chip asks the source the same question and gets the same object.
  assert.deepEqual(binding.state, source.selection('status'));
  assert.equal(binding.state.fieldState, 'active');
});

test('an EMPTY selection is no constraint, not "hide everything"', () => {
  const source = sourceWith();
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  legend.click('churned', false);
  source.select('status', []);
  assert.deepEqual(legend.off, [], 'nothing picked means every row is shown');
});

/* ── The rest of the view ───────────────────────────────────────────── */

test('the rest of the view sees it: the ROW COUNT changes', async () => {
  const source = sourceWith();
  await source.load();
  assert.equal(source.rows.length, 4);

  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });
  legend.click('churned', false);
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [1, 2, 3], 'the churned row went');
});

test('a legend filter ANDs with the rest, and survives their changes', async () => {
  const source = sourceWith();
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  legend.click('churned', false);
  source.contribute('search', ['plan', 'eq', 'Pro']);
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [2, 3], 'both applied');

  source.contribute('search', undefined);
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [1, 2, 3], 'the legend held');
});

/* ── Driving it from elsewhere ──────────────────────────────────────── */

test('set() drives the same state — a saved view, a preset', () => {
  const source = sourceWith();
  const legend = legendStub();
  const binding = bindLegendFilter(legend, source, { field: 'status', values: STATES });

  binding.set(['trial', 'churned']);
  assert.deepEqual(binding.hidden, ['trial', 'churned']);
  assert.deepEqual(picked(source, 'status'), ['active', 'suspended']);

  // The same floor applies — TRAP T-a-legend-keeps-one-row-on.
  binding.set(STATES);
  assert.deepEqual(binding.hidden, ['trial', 'churned'], 'refused, and put back');
});

test('destroy() stops the legend steering the source', () => {
  const source = sourceWith();
  const legend = legendStub();
  const binding = bindLegendFilter(legend, source, { field: 'status', values: STATES });

  binding.destroy();
  legend.click('churned', false);
  assert.deepEqual(picked(source, 'status'), [], 'the click reached nothing');
});
