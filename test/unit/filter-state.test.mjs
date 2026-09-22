/**
 * ONE STATE PER FIELD, FOR EVERY CONTROL THAT DRAWS IT.
 *
 * A field is drawn in several places at once, and each control used to work
 * out what it showed, so the same field could read several ways. This is the
 * one answer they all read.
 *
 * NOT ONLY FILTERS — the last four tests are a tab strip, a chart legend, a
 * transfer list and an empty control. The same four facts describe any
 * selection over a set of values.
 *
 * TRAP T-one-state-per-filtered-field
 *
 *   node --test test/unit/filter-state.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { fieldState, stateClause, filterFace } =
  await import(new URL('../../dist/data.js', import.meta.url));

const OWNERS = ['Ravi Menon', 'Dana Whitlock', 'Unassigned'];
const facts = { field: 'owner', label: 'Owner', values: OWNERS };

/* ── fieldState ─────────────────────────────────────────────────────── */

test('nothing picked is OFF, and every value is unpicked', () => {
  const s = fieldState(facts);
  assert.equal(s.fieldState, 'off');
  assert.equal(s.op, 'eq', 'the default condition');
  assert.deepEqual(s.values.map((v) => v.state), ['unpicked', 'unpicked', 'unpicked']);
  // The LABEL falls back to the value, so a caller need not repeat itself.
  assert.deepEqual(s.values.map((v) => v.label), OWNERS);
});

test('one pick is ACTIVE; the rest stay unpicked and listed', () => {
  const s = fieldState(facts, { picked: ['Ravi Menon'] });
  assert.equal(s.fieldState, 'active');
  assert.deepEqual(s.values.map((v) => v.state), ['picked', 'unpicked', 'unpicked']);
  // EVERY value is still here — a list that drops what it cannot reach is a
  // one-way door. TRAP T-unavailable-value-sorts-below-a-divider
  assert.equal(s.values.length, 3);
});

test('EVERYTHING picked is OFF — the same rows as no filter', () => {
  const s = fieldState(facts, { picked: OWNERS });
  assert.equal(s.fieldState, 'off', 'TRAP T-everything-on-is-no-filter');
  assert.equal(stateClause(s), undefined);
});

test('a value no remaining row carries is UNAVAILABLE, not dropped', () => {
  const s = fieldState(facts, { present: ['Ravi Menon'] });
  assert.deepEqual(s.values.map((v) => v.state),
    ['unpicked', 'unavailable', 'unavailable']);
  assert.equal(s.values.length, 3, 'still offered, so a reader can broaden back out');
});

test('the comparison is the QUERY\'s, so casing cannot break a pick', () => {
  // A chip's option values are lower-cased in the Records example while the
  // data is not. TRAP T-one-comparison-rule-for-query-and-ui
  const s = fieldState(facts, { picked: ['ravi menon'] });
  assert.equal(s.values[0].state, 'picked');
  assert.equal(s.fieldState, 'active');
});

test('a TYPED condition is a filter, with nothing ticked', () => {
  const s = fieldState(facts, { op: 'contains', text: 'Ravi' });
  assert.equal(s.fieldState, 'active', 'no ticks, and still filtering');
  assert.deepEqual(s.values.map((v) => v.state), ['unpicked', 'unpicked', 'unpicked']);
  // …and whitespace alone is not an answer.
  assert.equal(fieldState(facts, { op: 'contains', text: '   ' }).fieldState, 'off');
});

test('SUSPENDED keeps the values and stops filtering', () => {
  const s = fieldState(facts, { picked: ['Ravi Menon'], suspended: true });
  assert.equal(s.fieldState, 'suspended', 'TRAP T-grid-suspend-is-not-clear');
  assert.equal(s.values[0].state, 'picked', 'the pick survives');
  assert.equal(stateClause(s), undefined, 'but nothing is applied');
});

/* ── stateClause ────────────────────────────────────────────────────── */

test('one pick is `eq`; SEVERAL become `in`', () => {
  assert.deepEqual(
    stateClause(fieldState(facts, { picked: ['Ravi Menon'] })),
    ['owner', 'eq', 'Ravi Menon'],
  );
  // `eq` against a list can never match, so the op changes with the count.
  assert.deepEqual(
    stateClause(fieldState(facts, { picked: ['Ravi Menon', 'Unassigned'] })),
    ['owner', 'in', ['Ravi Menon', 'Unassigned']],
  );
  // …and `ne` inverts the same way.
  assert.deepEqual(
    stateClause(fieldState(facts, { op: 'ne', picked: ['Ravi Menon', 'Unassigned'] })),
    ['owner', 'notin', ['Ravi Menon', 'Unassigned']],
  );
});

test('a typed condition carries what was typed', () => {
  assert.deepEqual(
    stateClause(fieldState(facts, { op: 'startswith', text: 'Rav' })),
    ['owner', 'startswith', 'Rav'],
  );
});

/* ── filterFace ─────────────────────────────────────────────────────── */

test('the DEFAULT condition wears no badge', () => {
  const face = filterFace(fieldState(facts, { picked: ['Ravi Menon'] }));
  assert.equal(face.current, true);
  assert.equal(face.badge, '', '`eq` on every ordinary chip would be noise');
  assert.equal(face.value, 'Ravi Menon');
  assert.equal(face.tip, 'Ravi Menon');
});

test('another condition wears its SIGN, and spells itself in the tip', () => {
  const face = filterFace(fieldState(facts, { op: 'notcontains', text: 'Ravi' }));
  assert.equal(face.current, true);
  assert.equal(face.badge, '!∷');
  // A tooltip is where a reader finds out what the sign MEANS.
  assert.equal(face.condition, 'Does not contain');
  assert.equal(face.tip, 'Does not contain: Ravi');
  assert.equal(face.value, 'Ravi', 'the caret keeps the whole width for the value');
});

test('several picks read as first + ellipsis, and count', () => {
  const face = filterFace(fieldState(facts, { picked: ['Ravi Menon', 'Unassigned'] }));
  assert.equal(face.value, 'Ravi Menon…');
  assert.equal(face.count, 2);
  assert.equal(face.tip, 'Ravi Menon, Unassigned');
});

test('an OFF field draws nothing', () => {
  const face = filterFace(fieldState(facts));
  assert.deepEqual(
    { current: face.current, badge: face.badge, value: face.value, tip: face.tip },
    { current: false, badge: '', value: '', tip: '' },
  );
});

/* ── NOT only filters ───────────────────────────────────────────────── */

test('a TAB STRIP is the same four facts', () => {
  // One chosen of several, and no filter anywhere in sight.
  const tabs = fieldState(
    { field: 'tab', label: 'Section', values: ['Overview', 'Activity', 'Settings'] },
    { picked: ['Activity'] },
  );
  assert.equal(tabs.fieldState, 'active');
  assert.deepEqual(tabs.values.map((v) => v.state), ['unpicked', 'picked', 'unpicked']);
  assert.equal(filterFace(tabs).value, 'Activity');
});

test('a CHART LEGEND reads rows the same way', () => {
  /* A legend row a filter emptied is `unavailable`: still listed, still
     clickable, drawn inactive — the legend IS the way back.
     TRAP T-a-legend-row-goes-inactive-it-never-vanishes */
  const legend = fieldState(
    { field: 'plan', values: ['Free', 'Starter', 'Pro'] },
    { present: ['Free', 'Pro'] },
  );
  assert.deepEqual(legend.values.map((v) => `${v.value}:${v.state}`),
    ['Free:unpicked', 'Starter:unavailable', 'Pro:unpicked']);
  // Nothing is CHOSEN, so the legend narrows nothing — the filter elsewhere did.
  assert.equal(legend.fieldState, 'off');
});

test('a TRANSFER LIST is two readings of one field', () => {
  const values = ['Read', 'Write', 'Admin'];
  const facts2 = { field: 'perm', values };
  const chosen = fieldState(facts2, { picked: ['Read', 'Admin'] });

  // The RIGHT pane is what is picked; the LEFT is what is not.
  assert.deepEqual(chosen.values.filter((v) => v.state === 'picked').map((v) => v.value),
    ['Read', 'Admin']);
  assert.deepEqual(chosen.values.filter((v) => v.state === 'unpicked').map((v) => v.value),
    ['Write']);
  // Only `stateClause` speaks filters; the rest is plain selection.
  assert.deepEqual(stateClause(chosen), ['perm', 'in', ['Read', 'Admin']]);
});

test('a control with NO values is off, never broken', () => {
  const empty = fieldState({ field: 'nothing' });
  assert.equal(empty.fieldState, 'off');
  assert.deepEqual(empty.values, []);
  assert.equal(stateClause(empty), undefined);
  assert.equal(filterFace(empty).tip, '');
});
