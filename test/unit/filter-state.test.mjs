/**
 * ONE STATE PER FILTERED FIELD.
 *
 * A field is drawn in several places at once — a chip, its menu, a column
 * heading, that heading's menu, the chip's label and badge. Each used to work
 * out what it showed, so the same field could read four ways. This is the one
 * answer they all read.
 *
 * TRAP T-one-state-per-filtered-field
 *
 *   node --test test/unit/filter-state.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { fieldState, stateClause, statesFilter, filterFace } =
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

test('several fields AND, and an off field contributes nothing', () => {
  const owner = fieldState(facts, { picked: ['Ravi Menon'] });
  const tier = fieldState({ field: 'tier', values: ['Gold', 'Silver'] }, { picked: ['Gold'] });
  const empty = fieldState({ field: 'plan', values: ['Free'] });

  assert.deepEqual(statesFilter([owner, tier, empty]), [
    'and', ['owner', 'eq', 'Ravi Menon'], ['tier', 'eq', 'Gold'],
  ]);
  // One clause needs no `and` wrapper.
  assert.deepEqual(statesFilter([owner, empty]), ['owner', 'eq', 'Ravi Menon']);
  assert.equal(statesFilter([empty]), undefined);
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
