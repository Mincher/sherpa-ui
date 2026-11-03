/**
 * ONE FIELD, ONE STATUS — TODO 613 (Will). The Query tells every control what a
 * field is now; no control works it out, and none asks another. Each row of this
 * matrix is a state a chip or a heading must draw the same way.
 *
 *   node --test test/unit/one-field-one-status.test.mjs
 *
 * TRAP T-one-field-one-status
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, VIEW } from '../../dist/data.js';

const ROWS = [
  { id: 1, plan: 'Pro', tickets: 2 }, { id: 2, plan: 'Free', tickets: 0 }, { id: 3, plan: 'Pro', tickets: 3 },
];

function page() {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareValues('plan', ['Free', 'Pro']);
  source.query.declareScope(VIEW, { label: 'View Context' });
  source.query.declareScope('data', { label: 'Rows' });
  source.query.offer('data', ['plan', 'tickets']);
  source.query.ask({ scope: 'data', hold: ['plan'] });
  source.declarePresets('data', [{ id: 'busy', label: 'Busy', readings: { tickets: { tree: { op: 'gt', value: '0' }, mode: 'advanced' } } }]);
  return source;
}
const brief = ({ home, above, on, presets, pending, failed }) => ({ home, above: above?.label ?? null, on, presets, pending, failed });

test('free, with no answer: at its home, off', () => {
  assert.deepEqual(brief(page().fieldStatus('plan', 'data')),
    { home: 'data', above: null, on: false, presets: [], pending: false, failed: false });
});

test('answered: on, and the reading is the Query\'s', () => {
  const source = page();
  source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
  const status = source.fieldStatus('plan', 'data');
  assert.equal(status.on, true);
  assert.deepEqual(status.reading.picked, ['Pro']);
});

test('switched off: off, and it keeps its answer', () => {
  const source = page();
  source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
  source.query.ask({ scope: 'data', field: 'plan', suspended: true });
  const status = source.fieldStatus('plan', 'data');
  assert.equal(status.on, false);
  assert.deepEqual(status.reading.picked, ['Pro']);
});

test('an answer that narrows nothing is off', () => {
  const source = page();
  source.query.ask({ scope: 'data', field: 'plan', reading: { tree: undefined, mode: 'advanced' } });
  assert.equal(source.fieldStatus('plan', 'data').on, false);
});

test('held by the View: below it says so and where, the View does not', () => {
  const source = page();
  source.query.ask({ scope: VIEW, move: 'plan', from: 'data' });
  assert.deepEqual(source.fieldStatus('plan', 'data').above, { scope: VIEW, label: 'View Context' });
  assert.equal(source.fieldStatus('plan', VIEW).above, null);
  assert.equal(source.fieldStatus('plan', 'data').home, VIEW);
  source.query.ask({ scope: VIEW, field: 'plan', reading: { picked: ['Pro'] } });
  assert.equal(source.fieldStatus('plan', 'data').on, true);
  assert.deepEqual(source.fieldStatus('plan', 'data').reading.picked, ['Pro']);
});

test('a preset on a field no scope holds: at the preset\'s scope, on, and it names the preset', () => {
  const source = page();
  source.query.ask({ scope: 'data', preset: 'busy', on: true, commit: true });
  assert.deepEqual(brief(source.fieldStatus('tickets', 'data')),
    { home: 'data', above: null, on: true, presets: ['Busy'], pending: false, failed: false });
  source.query.ask({ scope: 'data', preset: 'busy', on: false, commit: true });
  assert.deepEqual(brief(source.fieldStatus('tickets', 'data')),
    { home: VIEW, above: null, on: false, presets: [], pending: false, failed: false });
});

test('held by the View and a preset: both are said', () => {
  const source = page();
  source.query.ask({ scope: VIEW, move: 'plan', from: 'data' });
  source.declarePresets('data', [{ id: 'pro', label: 'Pro only', readings: { plan: { tree: { op: 'eq', value: 'Pro' }, mode: 'advanced' } } }]);
  source.query.ask({ scope: 'data', preset: 'pro', on: true, commit: true });
  const status = source.fieldStatus('plan', 'data');
  assert.equal(status.above.label, 'View Context');
  assert.deepEqual(status.presets, ['Pro only']);
  assert.equal(status.on, true);
});

test('waiting for Apply: pending, off until applied; applied, on', () => {
  const source = page();
  source.query.wait('data');
  source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
  let status = source.fieldStatus('plan', 'data');
  assert.equal(status.pending, true);
  assert.equal(status.on, false);
  assert.deepEqual(status.reading.picked, ['Pro']);
  source.query.ask({ scope: 'data', commit: true });
  status = source.fieldStatus('plan', 'data');
  assert.equal(status.pending, false);
  assert.equal(status.on, true);
});
