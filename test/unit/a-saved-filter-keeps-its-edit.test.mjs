/**
 * A SAVED FILTER KEEPS ITS EDIT — TODO 50. A reader changes a saved filter's
 * rows: the Query keeps the change, an ON filter applies it, and the library
 * keeps what was saved until the reader saves again.
 *
 *   node --test test/unit/a-saved-filter-keeps-its-edit.test.mjs
 *
 * TRAP T-a-saved-filter-keeps-its-edit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, onReport } from '../../dist/data.js';

const ROWS = [
  { id: 1, health: 40, owner: 'Unassigned' },
  { id: 2, health: 80, owner: 'Dana' },
  { id: 3, health: 55, owner: 'Dana' },
];
const SAVED = { health: { conditions: [{ op: 'lt', text: '60' }] } };
const EDIT = { health: { conditions: [{ op: 'lt', text: '50' }] } };
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A scoped bar: what it holds, its saved filters, and what it was drawn. */
class Bar extends EventTarget {
  saved = { 'custom:risk': { on: true, readings: SAVED } };
  drawn = [];
  get readings() { return {}; }
  get presets() { return this.saved; }
  get heldFields() { return []; }
  drawScope(slice) { this.drawn.push(slice); }
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
  report() { this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: {} })); }
  edit(readings) { this.dispatchEvent(new CustomEvent('preset-edit', { detail: { id: 'custom:risk', readings } })); }
}

async function setup() {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareField('health', { type: 'number', label: 'Health' });
  source.declareScope('grid', { label: 'Records' });
  source.declarePreset('custom:risk', SAVED, { label: 'Risky', editable: true });
  const bar = new Bar();
  source.bind(bar, { steerOnly: true, scope: 'grid' });
  bar.report();
  await source.load();
  return { source, bar };
}

test('an ON saved filter applies its EDIT, and the library keeps what was saved', async () => {
  const { source, bar } = await setup();
  assert.equal(source.debugState().total, 2);
  bar.edit(EDIT);
  await source.load();
  assert.equal(source.debugState().total, 1);
  assert.deepEqual(source.query.applied.scopes.grid.edits, { 'custom:risk': EDIT });
  const [held] = source.describe('grid').filters;
  assert.deepEqual(held.readings, SAVED);
  assert.deepEqual(held.edited, EDIT);
  // Its menu says the EDIT.
  assert.deepEqual(held.says.map((s) => s.lines), [['Less than 50']]);
  // Its chip counts the edit's rows.
  assert.deepEqual(await source.results('grid'), { 'custom:risk': 1 });
  // The bar is drawn the scope with the edit in it.
  await tick();
  assert.deepEqual(bar.drawn.at(-1).edits, { 'custom:risk': EDIT });
});

test('an edit back to what was saved is no edit, and none puts the saved one back', async () => {
  const { source, bar } = await setup();
  bar.edit(EDIT);
  bar.edit(SAVED);
  assert.equal(source.query.applied.scopes.grid.edits, undefined);
  bar.edit(EDIT);
  bar.edit(null);
  await source.load();
  assert.equal(source.query.applied.scopes.grid.edits, undefined);
  assert.equal(source.debugState().total, 2);
});

test('an edit goes with its saved filter: taken off the bar, or deleted', async () => {
  const { source, bar } = await setup();
  bar.edit(EDIT);
  bar.saved = {};
  bar.report();
  assert.equal(source.query.applied.scopes.grid?.edits, undefined);

  bar.saved = { 'custom:risk': { on: true, readings: SAVED } };
  bar.report();
  bar.edit(EDIT);
  source.declarePreset('custom:risk', undefined);
  assert.equal(source.query.applied.scopes.grid?.edits, undefined);
});

test('an edit of a saved filter no one has is REPORTED, and changes nothing', async () => {
  const { source } = await setup();
  const seen = [];
  const stop = onReport((issue) => seen.push(issue.code));
  source.editPreset('grid', 'custom:nope', EDIT);
  stop();
  assert.deepEqual(seen, ['unknown-preset']);
  assert.equal(source.query.applied.scopes.grid.edits, undefined);
});
