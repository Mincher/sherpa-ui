/**
 * A CHART'S OWN SCOPE — TODO 52. One field, one component: the legend's field,
 * narrowing its chart alone. A panel draws it, answers it, and sends it up.
 *
 * TRAP T-a-chart-scope-is-its-legend-field
 *
 *   node --test test/unit/chart-scope.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { ArrayStore } = await import(new URL('stores.js', core));
const { DataSource } = await import(new URL('data-source.js', core));

const ROWS = [
  { id: 1, sev: 'critical', os: 'mac' }, { id: 2, sev: 'info', os: 'mac' },
  { id: 3, sev: 'critical', os: 'win' }, { id: 4, sev: 'warning', os: 'win' },
];
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A source with a chart, a second component, and a panel over two scopes. */
async function setup() {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareValues('sev', ['critical', 'warning', 'info']);
  source.declareScope('view', { label: 'View filters' });
  const seen = new Map();
  const stub = (name, more = {}) => Object.assign(new EventTarget(), {
    id: name, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    populate: (r) => seen.set(name, r.map((x) => x.id)), ...more,
  });
  const chart = stub('bar');
  const other = stub('donut');
  const drawn = { scopes: [], readings: [] };
  const panel = stub('panel', {
    drawScopes: (scopes) => { drawn.scopes.push(scopes); },
    drawReading: (field, reading, scope) => { drawn.readings.push([scope, field, reading.picked ?? []]); },
  });
  source.bind(chart, { rows: 'all', readonly: true });
  source.bind(other, { rows: 'all', readonly: true });
  source.bind(panel, { steerOnly: true, scope: ['view', 'data'] });
  await source.load();
  source.declarePart('picks:bar', { field: 'sev', only: chart, label: 'Alerts by severity' });
  await tick();
  return { source, seen, chart, other, panel, drawn };
}

test('a part is ONE Simple filter: a chip per value, each with its series, and nothing to add', async () => {
  const { source, drawn } = await setup();
  const part = source.describe('picks:bar');
  assert.equal(part.label, 'Alerts by severity');
  assert.equal(part.shows, 'chart');
  assert.equal(part.part, true);
  assert.deepEqual(part.available, []);
  assert.equal(part.filters.length, 1);
  assert.deepEqual(part.filters[0].options, [
    { value: 'critical', label: 'critical', swatch: 1 },
    { value: 'warning', label: 'warning', swatch: 2 },
    { value: 'info', label: 'info', swatch: 3 },
  ]);
  assert.equal(part.filters[0].advanced, undefined);
  assert.equal(part.filters[0].removable, undefined);
  // Drawn after the View, before every other scope — and before it is answered.
  assert.deepEqual(drawn.scopes.at(-1).map((s) => s.scope), ['view', 'picks:bar']);
});

test("a panel's answer to a part narrows its chart ALONE, and a legend's write is drawn in the panel", async () => {
  const { source, seen, chart, panel, drawn } = await setup();
  panel.dispatchEvent(new CustomEvent('quick-filter-change', {
    detail: { readings: { 'picks:bar': { sev: { picked: ['critical'] } } } },
  }));
  await tick();
  assert.deepEqual(seen.get('bar'), [1, 3]);
  assert.deepEqual(seen.get('donut'), [1, 2, 3, 4]);
  assert.deepEqual(source.query.applied.scopes['picks:bar'].narrows, ['bar']);
  assert.deepEqual(drawn.readings.at(-1), ['picks:bar', 'sev', ['critical']]);

  // The legend's own door. The panel is told, in the part's scope.
  source.write('picks:bar', 'sev', { picked: ['info'] }, { only: chart });
  await tick();
  assert.deepEqual(seen.get('bar'), [2]);
  assert.deepEqual(drawn.readings.at(-1), ['picks:bar', 'sev', ['info']]);

  // Emptied, it narrows nothing, and the panel is told that too.
  panel.dispatchEvent(new CustomEvent('quick-filter-change', {
    detail: { readings: { 'picks:bar': { sev: { picked: [] } } } },
  }));
  await tick();
  assert.deepEqual(seen.get('bar'), [1, 2, 3, 4]);
  assert.deepEqual(drawn.readings.at(-1), ['picks:bar', 'sev', []]);
});

test('SENT UP, the answer goes to the View with its field, and the chart lets go of it', async () => {
  const { source, seen, panel } = await setup();
  source.write('picks:bar', 'sev', { picked: ['critical'] });
  panel.dispatchEvent(new CustomEvent('filter-add-request', {
    detail: { scope: 'view', ids: ['sev'], from: 'picks:bar' },
  }));
  await tick();
  assert.deepEqual(source.scope('view'), ['sev']);
  assert.deepEqual(source.query.applied.scopes.view.readings.sev.picked, ['critical']);
  assert.equal(source.query.applied.scopes['picks:bar'], undefined);
  // EVERY component is narrowed now.
  assert.deepEqual(seen.get('bar'), [1, 3]);
  assert.deepEqual(seen.get('donut'), [1, 3]);
  // The View draws the field, and the chart's section says where it went.
  assert.deepEqual(source.describe('view').filters.map((f) => f.id), ['sev']);
  assert.equal(source.describe('picks:bar').filters[0].appliedAt, 'View filters');
});

test('a part forgotten is drawn no more', async () => {
  const { source, drawn } = await setup();
  source.declarePart('picks:bar', undefined);
  await tick();
  assert.deepEqual(drawn.scopes.at(-1).map((s) => s.scope), ['view']);
});

/* Will, TODO 159: "When a data viz filter is added to the view scope then
   clicking on a legend item should adjust values at the view scope as well as
   toggling the legend item active state."
   TRAP T-a-legend-follows-the-view-when-it-holds-the-field */
test('while the VIEW holds its field, a legend shows the View\'s answer and changes it', async () => {
  const { bindSelection } = await import(new URL('bind-selection.js', core));
  const { source, seen, chart } = await setup();
  source.declareField('sev', { label: 'Severity' });
  // A legend: what is ON, and the event it fires when a reader toggles one.
  const legend = Object.assign(new EventTarget(), { picked: [] });
  const press = (on) => { legend.picked = on; legend.dispatchEvent(new Event('legend-item-click')); };
  bindSelection(legend, source, {
    field: 'sev', values: ['critical', 'warning', 'info'],
    read: (c) => c.picked, draw: (c, picked) => { c.picked = [...picked]; },
    event: 'legend-item-click', reach: 'component', only: chart, key: 'picks:bar',
  });

  // Its own scope first: the chart alone.
  press(['critical']);
  await tick();
  assert.deepEqual(seen.get('bar'), [1, 3]);
  assert.deepEqual(seen.get('donut'), [1, 2, 3, 4]);

  // The View TAKES the field: the legend's own answer is dropped, and it shows the View's.
  source.hold('view', ['sev']);
  source.select('sev', ['info']);
  await tick();
  assert.equal(source.query.applied.scopes['picks:bar'], undefined);
  assert.deepEqual(legend.picked, ['info']);

  // A press changes the VIEW's answer: every component narrows.
  press(['warning', 'info']);
  await tick();
  assert.deepEqual(source.query.applied.scopes.view.readings.sev.picked, ['warning', 'info']);
  assert.equal(source.query.applied.scopes['picks:bar'], undefined);
  assert.deepEqual(seen.get('bar'), [2, 4]);
  assert.deepEqual(seen.get('donut'), [2, 4]);
  assert.deepEqual(legend.picked, ['warning', 'info']);

  // The View lets go: the legend answers for its chart alone again.
  source.hold('view', []);
  await tick();
  press(['critical']);
  await tick();
  assert.deepEqual(source.query.applied.scopes['picks:bar'].readings.sev.picked, ['critical']);
  assert.deepEqual(seen.get('donut'), [1, 2, 3, 4]);
});
