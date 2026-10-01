/**
 * A GUTTER MOVES A LINE — Will, TODO 177: "If there's no space on the row to
 * grow an element's column span (siblings already at their minimum span) then
 * dragging won't increase the width. Dragging to resize height/row span can't
 * force neighbouring rows of content to span lower than the highest min row
 * span on elements in that row."
 *
 *   npm run build && node --test test/unit/a-gutter-moves-a-line.test.mjs
 *
 * TRAP T-a-gutter-moves-a-line
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MIN_COL_SPAN, moveLine, reach } from '../../dist/components/sherpa-layout-grid/grid-lines.js';

/** Cards in a row of 12, each at least MIN_COL_SPAN wide. */
const cards = (...spans) => spans.map((span) => ({ span, floor: Math.min(MIN_COL_SPAN, span), ceil: 12 }));

test('siblings at their minimum, and no free space: nothing grows', () => {
  const row = cards(3, 3, 3, 3);
  for (const line of [0, 1, 2]) {
    assert.deepEqual(moveLine(row, line, 2), [3, 3, 3, 3]);
    assert.deepEqual(moveLine(row, line, -2), [3, 3, 3, 3]);
    assert.deepEqual(reach(row, line), { min: 0, max: 0 });
  }
});

test('the card across the line gives way first, then the next; a step nobody can give is dropped', () => {
  const row = cards(4, 4, 4);
  assert.deepEqual(moveLine(row, 0, 1), [5, 3, 4]);
  assert.deepEqual(moveLine(row, 0, 2), [6, 3, 3]);
  assert.deepEqual(moveLine(row, 0, 3), [6, 3, 3]);
  assert.deepEqual(moveLine(row, 0, -1), [3, 5, 4]);
  assert.deepEqual(moveLine(row, 0, -2), [3, 5, 4]);
  assert.deepEqual(reach(row, 0), { min: 1, max: 2 });
});

test('free space at the row end gives after the cards, and stops at its own ceil', () => {
  // The slack may never grow past what lets the next row's first card jump up.
  const row = [...cards(4, 4), { span: 4, floor: 0, ceil: 5 }];
  assert.deepEqual(moveLine(row, 0, 2), [6, 3, 3]);
  assert.deepEqual(moveLine(row, 1, 2), [4, 6, 2]);
  assert.deepEqual(moveLine(row, 1, -2), [4, 3, 5]);
});

test('rows: a neighbour gives down to its highest min, then the page grows', () => {
  const bands = [
    { span: 1, floor: 1, ceil: 12 }, { span: 4, floor: 2, ceil: 12 }, { span: 4, floor: 2, ceil: 12 },
    { span: Infinity, floor: 0, ceil: Infinity },
  ];
  assert.deepEqual(moveLine(bands, 1, 3), [1, 7, 2, Infinity]);
  assert.deepEqual(moveLine(bands, 1, 4), [1, 8, 2, Infinity]);
  // Up: the band above gives only down to ITS highest min (3 here), and the metrics give nothing.
  const tall = bands.with(1, { span: 4, floor: 3, ceil: 12 });
  assert.deepEqual(moveLine(tall, 1, -3), [1, 3, 5, Infinity]);
  assert.deepEqual(reach(tall, 1), { min: 1, max: 8 });
});

test('a locked band passes a move through, unchanged', () => {
  const bands = [
    { span: 2, floor: 1, ceil: 12 }, { span: 3, floor: 3, ceil: 3 }, { span: 4, floor: 2, ceil: 12 },
  ];
  assert.deepEqual(moveLine(bands, 0, 2), [4, 3, 2]);
});

test('a fit grid: its filler gives only down to its floor', () => {
  const bands = [{ span: 1, floor: 1, ceil: 12 }, { span: 3, floor: 3, ceil: 12 }, { span: 3, floor: 2, ceil: Infinity }];
  assert.deepEqual(moveLine(bands, 1, 3), [1, 4, 2]);
});

test('the ceil holds', () => {
  const bands = [{ span: 11, floor: 1, ceil: 12 }, { span: Infinity, floor: 0, ceil: Infinity }];
  assert.deepEqual(moveLine(bands, 0, 5), [12, Infinity]);
  assert.deepEqual(reach(bands, 0).max, 1);
});
