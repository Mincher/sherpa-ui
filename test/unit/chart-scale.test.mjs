/**
 * ONE SCALE, AND EVERY GRIDLINE A ROUND NUMBER.
 *
 * Three charts worked out their own axis three different ways, so a bar and a
 * sparkline over the same numbers drew different heights.
 *
 * Will's rule, 2026-09-23: "The top gridline should round to the nearest unit
 * at that magnitude… all other gridlines should divide that range equally" —
 * and "it should always round up". Rounding the TOP alone is not enough: 403
 * rounds to 500, and four equal bands of that are 125, 250, 375. The STEP is
 * what gets rounded, and the band count moves with it.
 *
 * TRAP T-one-scale-for-every-chart
 * TRAP T-the-top-gridline-rounds-to-its-magnitude
 *
 *   node --test test/unit/chart-scale.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { chartScale } = await import(new URL('../../dist/core/data/format-tick.js', import.meta.url));

/** Every gridline the axis would draw. */
const lines = (s) => Array.from({ length: s.bands + 1 }, (_, i) =>
  Number((s.min + s.step * i).toPrecision(12)));

/* ── The rule Will asked for ────────────────────────────────────────── */

test('403 tops out at 500, in round hundreds', () => {
  const s = chartScale([403]);
  assert.equal(s.max, 500);
  assert.deepEqual(lines(s), [0, 100, 200, 300, 400, 500]);
});

test('59 tops out at 60', () => {
  assert.equal(chartScale([59]).max, 60);
});

test('it always rounds UP, so no bar reaches the ceiling', () => {
  for (const v of [3, 12, 47, 95, 403, 999, 1234]) {
    assert.ok(chartScale([v]).max >= v, `${v} must fit under its own axis`);
  }
});

test('EVERY gridline is round, not just the top', () => {
  /* The failure this rule exists for: a round top divided equally is not
     itself round. 403 -> 500 in FOUR bands is 125, 250, 375. */
  for (const v of [403, 47, 1234, 95]) {
    const s = chartScale([v]);
    for (const line of lines(s)) {
      const unit = 10 ** Math.floor(Math.log10(s.step));
      const overUnit = line / unit;
      assert.ok(
        Math.abs(overUnit - Math.round(overUnit * 2) / 2) < 1e-9,
        `${v}: gridline ${line} is not a round step of ${s.step}`,
      );
    }
  }
});

test('the BAND COUNT moves to keep the steps round', () => {
  // 403 wants five bands of 100, not four of 125.
  assert.equal(chartScale([403]).bands, 5);
  assert.equal(chartScale([403]).step, 100);
});

test('max === min + step * bands, always', () => {
  for (const v of [3, 7, 12, 47, 95, 403, 999, 1234, 0.42]) {
    const s = chartScale([v]);
    assert.equal(Number((s.min + s.step * s.bands).toPrecision(12)), s.max, `for ${v}`);
  }
});

/* ── An EXPLICIT end is the caller's own ────────────────────────────── */

test('an explicit max is never rounded', () => {
  const s = chartScale([403], { max: 403 });
  assert.equal(s.max, 403, 'a caller who names a max meant it');
});

test('nice: false leaves the raw extent', () => {
  assert.equal(chartScale([403], { nice: false }).max, 403);
});

/* ── The floor ──────────────────────────────────────────────────────── */

test('a bar is measured FROM ZERO — that is what makes it honest', () => {
  assert.equal(chartScale([10, 20, 30]).min, 0);
});

test('`zero: false` FITS the data — a sparkline shows a shape', () => {
  const s = chartScale([10, 20, 30], { zero: false });
  assert.equal(s.min, 10);
});

test('a NEGATIVE value drops the floor below zero', () => {
  const s = chartScale([-5, 10, 20]);
  assert.equal(s.min, -5);
  assert.ok(s.max >= 20);
});

/* ── percent ────────────────────────────────────────────────────────── */

test('percent runs 0..100 and CLAMPS both ways', () => {
  const s = chartScale([0, 100], { nice: false });
  assert.equal(s.percent(0), 0);
  assert.equal(s.percent(50), 50);
  assert.equal(s.percent(100), 100);
  assert.equal(s.percent(150), 100, 'a value past the top is not past the plot');
  assert.equal(s.percent(-10), 0);
});

/* ── What a chart actually gets handed ──────────────────────────────── */

test('an EMPTY set is a scale, never a crash', () => {
  const s = chartScale([]);
  assert.equal(s.min, 0);
  assert.ok(s.span > 0, 'something to divide by');
  assert.equal(s.percent(0), 0);
});

test('every value the SAME still has a span', () => {
  const s = chartScale([7, 7, 7]);
  assert.ok(s.span > 0);
  assert.ok(s.max >= 7);
});

test('a NaN among them is ignored, not caught', () => {
  const s = chartScale([10, NaN, 30]);
  assert.equal(s.min, 0);
  assert.ok(s.max >= 30);
});
