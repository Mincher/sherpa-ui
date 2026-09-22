/**
 * ONE LOOP FOR ANY CONTROL OVER A FIELD.
 *
 * Will, 2026-09-22: "legend filtering is just filtering. visibility & state is
 * a component concern."
 *
 * There was a `legend-filter.ts` in the data layer — a module named after one
 * component, holding the read/draw/write loop every control needs plus one
 * legend rule. The loop is `bindSelection`; the rule moved into
 * `sherpa-chart-legend`, where visibility already lives. The module is gone.
 *
 * TRAP T-one-field-one-filter-menu
 *
 *   node --test test/unit/bind-selection.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { ArrayStore, DataSource, bindSelection } =
  await import(new URL('../../dist/data.js', import.meta.url));

const STATES = ['active', 'trial', 'suspended', 'churned'];

const ROWS = [
  { id: 1, status: 'active', plan: 'Free' },
  { id: 2, status: 'active', plan: 'Pro' },
  { id: 3, status: 'trial', plan: 'Pro' },
  { id: 4, status: 'churned', plan: 'Free' },
];

const sourceWith = () => new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });

/**
 * A control, reduced to what the loop needs: something it shows, and an event.
 * This one keeps an `off` set, like a legend — but the loop never knows that.
 */
const controlStub = () => {
  const el = new EventTarget();
  el.off = [];
  el.toggle = (label) => {
    el.off = el.off.includes(label) ? el.off.filter((l) => l !== label) : [...el.off, label];
    el.dispatchEvent(new CustomEvent('control-change'));
  };
  return el;
};

const bind = (el, source, field, values, signal) => bindSelection(el, source, {
  field,
  values,
  read: (c) => values.filter((v) => !c.off.includes(v)),
  draw: (c, picked) => {
    c.off = picked.length ? values.filter((v) => !picked.includes(v)) : [];
  },
  event: 'control-change',
  ...(signal ? { signal } : {}),
});

const picked = (source, field) =>
  source.selection(field).values.filter((v) => v.state === 'picked').map((v) => v.value);

/* ── The loop ───────────────────────────────────────────────────────── */

test('binding DECLARES the values, so the field is drawable at once', () => {
  const source = sourceWith();
  bind(controlStub(), source, 'status', STATES);
  assert.deepEqual(source.valuesFor('status'), STATES);
});

test('a control change WRITES the field', () => {
  const source = sourceWith();
  const el = controlStub();
  bind(el, source, 'status', STATES);

  el.toggle('churned');
  assert.deepEqual(picked(source, 'status'), ['active', 'trial', 'suspended'],
    'a filter names what it KEEPS');
});

test('EVERYTHING picked is no constraint, not every value ticked', () => {
  const source = sourceWith();
  const el = controlStub();
  bind(el, source, 'status', STATES);

  el.toggle('churned');
  el.toggle('churned');
  /* Every value ticked says the same thing as nothing ticked, in a way that
     LOOKS like a filter. TRAP T-everything-on-is-no-filter */
  assert.deepEqual(picked(source, 'status'), []);
  assert.equal(source.selection('status').fieldState, 'off');
});

test('TWO CONTROLS over one field, and neither hears about the other', () => {
  const source = sourceWith();
  const a = controlStub();
  const b = controlStub();
  bind(a, source, 'status', STATES);
  bind(b, source, 'status', STATES);

  a.toggle('churned');
  assert.deepEqual(b.off, ['churned'], 'the second control re-read the field');
  assert.deepEqual(a.off, ['churned']);
});

test('a control over ANOTHER field is left alone', () => {
  const source = sourceWith();
  const a = controlStub();
  const b = controlStub();
  bind(a, source, 'status', STATES);
  bind(b, source, 'plan', ['Free', 'Pro']);

  a.toggle('churned');
  assert.deepEqual(b.off, [], 'plan never moved');
  assert.deepEqual(source.selectedFields, ['status']);
});

test('the selection REACHES the query', async () => {
  const source = sourceWith();
  const el = controlStub();
  bind(el, source, 'status', STATES);

  el.toggle('churned');
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [1, 2, 3], 'the churned row went');
});

test('it ANDs with a named contribute part, and survives its changes', async () => {
  const source = sourceWith();
  const el = controlStub();
  bind(el, source, 'status', STATES);

  el.toggle('churned');
  source.contribute('search', ['plan', 'eq', 'Pro']);
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [2, 3], 'both applied');

  source.contribute('search', undefined);
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [1, 2, 3], 'the selection held');
});

/* ── Driving it, and stopping ───────────────────────────────────────── */

test('set() drives the same state — a saved view, a preset', () => {
  const source = sourceWith();
  const el = controlStub();
  const bound = bind(el, source, 'status', STATES);

  bound.set(['active', 'trial']);
  assert.deepEqual(picked(source, 'status'), ['active', 'trial']);
  assert.deepEqual(el.off, ['suspended', 'churned'], 'the control was re-drawn');
});

test('state is the SAME object any other control reads', () => {
  const source = sourceWith();
  const el = controlStub();
  const bound = bind(el, source, 'status', STATES);

  el.toggle('churned');
  assert.deepEqual(bound.state, source.selection('status'));
});

test('a value the field does not have is ignored, never broken', () => {
  const source = sourceWith();
  const el = controlStub();
  const bound = bind(el, source, 'status', STATES);

  bound.set(['active', 'nonsense']);
  assert.deepEqual(picked(source, 'status'), ['active']);
});

test('destroy() stops the control steering, and the source re-drawing it', () => {
  const source = sourceWith();
  const el = controlStub();
  const bound = bind(el, source, 'status', STATES);

  bound.destroy();
  el.toggle('churned');
  assert.deepEqual(picked(source, 'status'), [], 'the change reached nothing');

  source.select('status', ['active']);
  assert.deepEqual(el.off, ['churned'], 'and the control was not re-drawn');
});

test('an abort SIGNAL ends it the same way', () => {
  const source = sourceWith();
  const el = controlStub();
  const ac = new AbortController();
  bind(el, source, 'status', STATES, ac.signal);

  ac.abort();
  el.toggle('churned');
  assert.deepEqual(picked(source, 'status'), []);
});
