/**
 * AGGREGATION RUNS WITH NO DOM, AND RETURNS THE NUMBER.
 *
 * Rows → the shape a chart draws, in plain Node. This is the half that lets a
 * SERVER pre-compute a chart and an MCP tool answer "count by category" — both
 * impossible while the arithmetic lived in a browser example.
 *
 *   node --test test/unit/aggregate.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// The DATA tier — src/core is split by where a module can run.
const core = new URL('../../dist/core/data/', import.meta.url);
const { aggregateBy, countBy, bandBy, seriesBy, reduceRows, summarise } =
  await import(new URL('aggregate.js', core));

const ROWS = [
  { region: 'EMEA', sev: 'critical', spend: 100, storage: 10, day: 1 },
  { region: 'EMEA', sev: 'warning', spend: 200, storage: 55, day: 1 },
  { region: 'APAC', sev: 'critical', spend: 50, storage: 100, day: 2 },
  { region: 'APAC', sev: 'info', spend: 25, storage: 0, day: 3 },
  { region: 'AMER', sev: 'warning', spend: 625, storage: 81, day: 3 },
];

/* ── reduceRows ────────────────────────────────────────────────────────── */

test('reduceRows: every kind, and the number is NOT rounded', () => {
  assert.equal(reduceRows(ROWS, 'count'), 5);
  assert.equal(reduceRows(ROWS, 'sum', 'spend'), 1000);
  assert.equal(reduceRows(ROWS, 'min', 'spend'), 25);
  assert.equal(reduceRows(ROWS, 'max', 'spend'), 625);

  // 1000 / 5 = 200 exactly; the interesting case is one that does not divide.
  assert.equal(reduceRows(ROWS, 'mean', 'spend'), 200);
  assert.equal(
    reduceRows([{ n: 1 }, { n: 2 }], 'mean', 'n'),
    1.5,
    'a mean keeps its decimals — rounding is a PRESENTATION decision, and doing it ' +
      'here is what made a gauge tooltip disagree with its own label',
  );
});

test('reduceRows: a missing value is SKIPPED, not counted as zero', () => {
  const rows = [{ n: 10 }, { n: null }, { }, { n: 'not a number' }, { n: 20 }];
  // 30 / 2, not 30 / 5. A missing health score is not a score of nought, and
  // averaging it in drags the mean toward zero in proportion to how much data
  // is absent.
  assert.equal(reduceRows(rows, 'mean', 'n'), 15);
  assert.equal(reduceRows(rows, 'sum', 'n'), 30);
  // COUNT still counts every row — it is counting rows, not values.
  assert.equal(reduceRows(rows, 'count'), 5);
});

test('reduceRows: an empty set is 0, not NaN', () => {
  for (const kind of ['sum', 'mean', 'min', 'max']) {
    assert.equal(reduceRows([], kind, 'n'), 0, `${kind} of nothing`);
  }
  assert.equal(reduceRows([], 'count'), 0);
});

/* ── aggregateBy / countBy ─────────────────────────────────────────────── */

test('countBy: one datum per category, in first-seen order', () => {
  assert.deepEqual(countBy(ROWS, 'region'), [
    { label: 'EMEA', value: 2, colorIndex: 1 },
    { label: 'APAC', value: 2, colorIndex: 2 },
    { label: 'AMER', value: 1, colorIndex: 3 },
  ]);
});

test('aggregateBy: sums a field per category', () => {
  assert.deepEqual(aggregateBy(ROWS, 'region', 'sum', 'spend'), [
    { label: 'EMEA', value: 300, colorIndex: 1 },
    { label: 'APAC', value: 75, colorIndex: 2 },
    { label: 'AMER', value: 625, colorIndex: 3 },
  ]);
});

test('A CATEGORY KEEPS ITS COLOUR when a filter removes the one above it', () => {
  const ORDER = ['critical', 'warning', 'info'];

  const all = countBy(ROWS, 'sev', { order: ORDER });
  assert.deepEqual(all.map((d) => [d.label, d.colorIndex]),
    [['critical', 1], ['warning', 2], ['info', 3]]);

  // Drop every critical row. Without a declared order `warning` would slide up
  // into slot 1 and CHANGE COLOUR — the chart would appear to recolour itself
  // when only its ranking moved.
  const noCritical = ROWS.filter((r) => r.sev !== 'critical');
  const some = countBy(noCritical, 'sev', { order: ORDER });
  assert.deepEqual(some.map((d) => [d.label, d.colorIndex]),
    [['warning', 2], ['info', 3]],
    'warning keeps colour 2 even though it is now first',
  );
});

test('includeEmpty keeps a category nothing matched, at zero', () => {
  const ORDER = ['critical', 'warning', 'info', 'debug'];
  // OFF by default: an empty bar for a category nothing matched is noise.
  assert.equal(countBy(ROWS, 'sev', { order: ORDER }).length, 3);
  // ON for a fixed scale, where a missing level is itself the finding.
  const full = countBy(ROWS, 'sev', { order: ORDER, includeEmpty: true });
  assert.deepEqual(full.map((d) => [d.label, d.value]),
    [['critical', 2], ['warning', 2], ['info', 1], ['debug', 0]]);
});

/* ── bandBy ────────────────────────────────────────────────────────────── */

test('bandBy: half-open bands, and the LAST one includes its top', () => {
  const bands = bandBy(ROWS, 'storage', [0, 20, 40, 60, 80, 100]);
  /* The LABELS used to read "0-20", "21-40" … which contradicts half-open:
     a value of exactly 20 is counted in the SECOND band, and the first bar
     claimed it. The counts here are unchanged — only the labels moved, so
     each one now names what its bar actually holds.
     TRAP T-a-band-label-names-what-it-counts */
  assert.deepEqual(bands.map((d) => [d.label, d.value]), [
    ['0-19', 2],   // 10 and 0
    ['20-39', 0],
    ['40-59', 1],  // 55
    ['60-79', 0],
    ['80-100', 2], // 81 and 100 — the TOP edge lands in the last band, not off
  ]);
});

test('bandBy: a value outside the scale is dropped, not folded into an end', () => {
  const rows = [{ n: -5 }, { n: 50 }, { n: 150 }];
  const bands = bandBy(rows, 'n', [0, 100]);
  assert.deepEqual(bands.map((d) => d.value), [1],
    'only 50 is inside 0..100 — silently folding -5 and 150 into the ends ' +
      'would misreport both the scale and the count');
});

test('bandBy: custom labels, and a degenerate edge list', () => {
  const bands = bandBy(ROWS, 'storage', [0, 50, 100], { labels: ['Low', 'High'] });
  assert.deepEqual(bands.map((d) => d.label), ['Low', 'High']);
  assert.deepEqual(bandBy(ROWS, 'storage', [0]), [], 'one edge is no bands');
});

/* ── seriesBy ──────────────────────────────────────────────────────────── */

test('seriesBy: EVERY point gets a value, including the quiet ones', () => {
  const s = seriesBy(ROWS, 'day', [1, 2, 3, 4], 'Alerts', { colorIndex: 2 });
  assert.deepEqual(s, { name: 'Alerts', values: [2, 1, 2, 0], colorIndex: 2 });
  // Day 4 is 0 and not absent: a line with a hole in it lies about its shape.
});

test('seriesBy: can sum a field rather than count rows', () => {
  const s = seriesBy(ROWS, 'day', [1, 2, 3], 'Spend', { kind: 'sum', valueField: 'spend' });
  assert.deepEqual(s.values, [300, 50, 650]);
  assert.equal('colorIndex' in s, false, 'omitted when the caller gave none');
});

/* ── The boundary ──────────────────────────────────────────────────────── */

test('the module touches NO DOM', () => {
  // It imported and ran above with no document, no window and no jsdom. If a
  // `document.querySelector` ever lands in aggregate.ts this file throws on
  // import, which no browser test would ever notice.
  assert.equal(typeof globalThis.document, 'undefined');
});

/* ── summarise: a component's declaration → its shape ─────────────────── */

const SALES = [
  { plan: 'Pro', spend: 10, created: '2024-01-05', region: 'EMEA' },
  { plan: 'Free', spend: 0, created: '2024-01-20', region: 'EMEA' },
  { plan: 'Pro', spend: 30, created: '2024-03-02', region: 'AMER' },
];

test('summarise: an aggregate is ONE number; over a field it is a tile — value, values, delta', () => {
  assert.equal(summarise(SALES, { shape: 'aggregate', aggregate: 'sum', field: 'spend' }), 40);
  assert.equal(summarise(SALES, { shape: 'aggregate', aggregate: 'distinct', field: 'region' }), 2);
  // February has no rows and is still a point: a quiet month is zero, never missing.
  assert.deepEqual(
    summarise(SALES, { shape: 'aggregate', aggregate: 'sum', field: 'spend', over: 'created', bucket: 'month' }),
    { value: 40, values: [10, 0, 30], deltaPercent: 200 },
  );
});

test('summarise: segments keep the DECLARED order and colour, and a legend keeps an empty one', () => {
  const domain = (f) => (f === 'plan' ? ['Free', 'Starter', 'Pro'] : []);
  const chart = summarise(SALES, { shape: 'segments', segment: 'plan' }, domain);
  assert.deepEqual(chart.map((d) => [d.label, d.value, d.colorIndex]), [['Free', 1, 1], ['Pro', 2, 3]]);
  const legend = summarise(SALES, { shape: 'segments', segment: 'plan', keepEmpty: true }, domain);
  assert.deepEqual(legend.map((d) => d.label), ['Free', 'Starter', 'Pro']);
});

test('summarise: a series draws one line per segment, over the declared points', () => {
  // `info` has no rows: its line is gone, and `warning` keeps its colour.
  const domain = (f) => ({ day: [1, 2, 3], sev: ['critical', 'info', 'warning'] })[f] ?? [];
  const rows = [{ day: 1, sev: 'critical' }, { day: 3, sev: 'critical' }, { day: 3, sev: 'warning' }];
  const out = summarise(rows, { shape: 'series', over: 'day', segment: 'sev' }, domain);
  assert.deepEqual(out.labels, ['1', '2', '3']);
  assert.deepEqual(out.series.map((s) => [s.name, s.values, s.colorIndex]),
    [['critical', [1, 0, 1], 1], ['warning', [0, 0, 1], 3]]);
});

test('summarise: a declared date domain is cut to its bucket; a year steps across its end', () => {
  const domain = (f) => (f === 'created' ? ['2023-12-31', '2024-02-01'] : []);
  const out = summarise(SALES, { shape: 'aggregate', over: 'created', bucket: 'month' }, domain);
  // Only the declared months — the domain is the axis, not the rows.
  assert.deepEqual(out.values, [0, 0]);
  const span = summarise([{ d: '2023-12-30' }, { d: '2024-01-02' }], { shape: 'series', over: 'd', bucket: 'day' });
  assert.deepEqual(span.labels, ['2023-12-30', '2023-12-31', '2024-01-01', '2024-01-02']);
});

