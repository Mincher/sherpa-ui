/**
 * A LEGEND DRAWS IN ITS CARD'S BAR — Will, TODO 670. With legend chips on, a
 * chart's own scope — its legend's field — is drawn in its card's filter toolbar:
 * the slot's bar lists the part's one filter, answered in the part's scope, so a
 * pick there still narrows that chart alone; the bar is told its answers.
 *
 *   node --test test/unit/a-legend-draws-in-its-cards-bar.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, sev: 'critical', os: 'mac' }, { id: 2, sev: 'info', os: 'mac' },
  { id: 3, sev: 'critical', os: 'win' }, { id: 4, sev: 'warning', os: 'win' },
];
const tick = () => new Promise((r) => setTimeout(r, 0));

async function setup() {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareValues('sev', ['critical', 'warning', 'info']);
  const seen = new Map();
  const stub = (name, more = {}) => Object.assign(new EventTarget(), {
    id: name, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    populate: (r) => seen.set(name, Array.isArray(r) ? r.map((x) => x.id) : r), ...more,
  });
  const chart = stub('bar');
  const other = stub('donut');
  const drawn = { scopes: [], readings: [] };
  const bar = stub('toolbar', {
    drawScope: (scope) => { drawn.scopes.push(scope); },
    drawReading: (field, reading, scope) => { drawn.readings.push([scope, field, reading.picked ?? []]); },
  });
  bindSource(source, chart, { scope: 'by-sev', rows: 'all', readonly: true });
  bindSource(source, other, { rows: 'all', readonly: true });
  bindSource(source, bar, { scope: 'by-sev', steerOnly: true });
  await source.load();
  source.query.declarePart('picks:bar', { field: 'sev', only: chart, label: 'Alerts', shownIn: 'by-sev' });
  await tick();
  return { source, seen, chart, bar, drawn };
}

test('the slot\'s bar lists the legend\'s filter, answered in the part\'s scope, and is drawn again', async () => {
  const { source, drawn } = await setup();
  const [filter] = source.describe('by-sev').filters.filter((f) => f.answeredIn);
  assert.equal(filter.id, 'sev');
  assert.equal(filter.answeredIn, 'picks:bar');
  assert.deepEqual(filter.options.map((o) => o.value), ['critical', 'warning', 'info']);
  assert.ok(drawn.scopes.at(-1).filters.some((f) => f.answeredIn === 'picks:bar'));
});

test('a pick from the slot\'s bar, in the part\'s scope, narrows the chart alone; one made elsewhere is drawn in the bar', async () => {
  const { source, seen, chart, bar, drawn } = await setup();
  bar.dispatchEvent(new CustomEvent('quick-filter-change', {
    detail: { scope: 'bar', request: { scope: 'picks:bar', field: 'sev', reading: { picked: ['critical'] } } },
  }));
  await tick();
  assert.deepEqual(seen.get('bar'), [1, 3]);
  assert.deepEqual(seen.get('donut'), [1, 2, 3, 4]);
  assert.equal(source.query.applied.scopes['by-sev']?.readings?.sev, undefined);
  // The legend's own door, or the panel's: the bar is told, in the part's scope.
  source.query.ask({ scope: 'picks:bar', field: 'sev', reading: { picked: ['info'] }, only: chart });
  await tick();
  assert.deepEqual(seen.get('bar'), [2]);
  assert.deepEqual(drawn.readings.at(-1), ['picks:bar', 'sev', ['info']]);
});

test('off again, the bar lets the legend go: no filter answered elsewhere', async () => {
  const { source, chart, drawn } = await setup();
  source.query.declarePart('picks:bar', { field: 'sev', only: chart, label: 'Alerts' });
  await tick();
  assert.equal(source.describe('by-sev').filters.some((f) => f.answeredIn), false);
  assert.equal(drawn.scopes.at(-1).filters.some((f) => f.answeredIn), false);
});
