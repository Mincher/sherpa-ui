/**
 * TICK LABELS AND SERIES SLOTS.
 *
 * Two silent edges, both at a boundary:
 *
 *   formatTick  rounding crosses the threshold the test just passed, so
 *               999,999 read "1000K" and 999.5 read "1000"
 *   seriesVar   `colorIndex: 0` asked for --sherpa-data-viz-series-0, which
 *               does not exist, so the mark painted NOTHING
 *
 * TRAP T-a-tooltip-is-not-an-axis
 * TRAP T-series-count-is-ten-not-eleven
 *
 *   node --test test/unit/format-tick.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { formatTick, formatValue, seriesVar, seriesBorderVar, tickPercent } =
  await import(new URL('../../dist/core/data/format-tick.js', import.meta.url));

/* ── formatTick ─────────────────────────────────────────────────────── */

test('an axis COMPACTS — it has four labels and no room', () => {
  assert.equal(formatTick(1000), '1K');
  assert.equal(formatTick(1500), '1.5K');
  assert.equal(formatTick(1_000_000), '1M');
  assert.equal(formatTick(1_234_567), '1.2M');
});

test('ROUNDING UP moves a value to the next unit', () => {
  /* 999,999 is under a million, so the M tier is skipped — and a tenth of a K
     rounds it to 1000. It used to read "1000K". */
  assert.equal(formatTick(999_999), '1M');
  // …and the same crossing one tier down.
  assert.equal(formatTick(999.5), '1K', 'it used to read "1000"');
  assert.equal(formatTick(999.9), '1K');
});

test('a value that does NOT round up keeps its own unit', () => {
  assert.equal(formatTick(999), '999');
  assert.equal(formatTick(999.4), '999');
  assert.equal(formatTick(999_499), '999.5K');
});

test('below ten, one decimal — a 0–1 ratio axis needs it', () => {
  assert.equal(formatTick(0), '0');
  assert.equal(formatTick(0.5), '0.5');
  assert.equal(formatTick(9.95), '9.9');
  assert.equal(formatTick(10), '10', 'and at ten it stops');
});

test('NEGATIVES cross the same way', () => {
  assert.equal(formatTick(-1500), '-1.5K');
  assert.equal(formatTick(-999.9), '-1K');
});

test('a non-number is EMPTY, never "NaN" on an axis', () => {
  assert.equal(formatTick(NaN), '');
  assert.equal(formatTick(Infinity), '');
});

/* ── formatValue ────────────────────────────────────────────────────── */

test('a TOOLTIP is not an axis — it shows the number', () => {
  /* A tooltip has one label and exists BECAUSE the reader wants the number.
     TRAP T-a-tooltip-is-not-an-axis */
  assert.equal(formatValue(1234), '1,234');
  assert.equal(formatValue(1_250_500), '1,250,500');
  assert.equal(formatValue(NaN), '');
});

/* ── seriesVar ──────────────────────────────────────────────────────── */

const slot = (v) => Number(String(v).match(/series-(\d+)\)/)[1]);

test('EVERY input lands in 1..10 — never series-0, which does not exist', () => {
  assert.equal(slot(seriesVar(0, 0)), 10, 'the ring wraps backwards too');
  assert.equal(slot(seriesVar(0, 1)), 1);
  assert.equal(slot(seriesVar(0, 10)), 10);
  assert.equal(slot(seriesVar(0, 11)), 1, 'TRAP T-series-count-is-ten-not-eleven');
  assert.equal(slot(seriesVar(0, -1)), 9);
  assert.equal(slot(seriesVar(0, NaN)), 1, 'nonsense is the first slot, not none');
});

test('the INDEX is 0-based where an explicit colorIndex is 1-based', () => {
  assert.equal(slot(seriesVar(0)), 1);
  assert.equal(slot(seriesVar(9)), 10);
  assert.equal(slot(seriesVar(10)), 1);
});

test('the BORDER follows the same slot, and falls back to the fill', () => {
  const v = seriesBorderVar(0, 0);
  assert.match(v, /series-border-10, var\(--sherpa-data-viz-series-10\)\)$/);
});

/* ── tickPercent ────────────────────────────────────────────────────── */

test('gridlines run 0 to 100, and zero steps is not a crash', () => {
  assert.equal(tickPercent(0, 4), 0);
  assert.equal(tickPercent(4, 4), 100);
  assert.equal(tickPercent(0, 0), 0);
});
