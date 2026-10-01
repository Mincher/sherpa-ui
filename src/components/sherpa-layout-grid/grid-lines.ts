/**
 * grid-lines.ts — move ONE line between grid spans; the span across it gives way. No DOM.
 * TRAP T-a-gutter-moves-a-line
 *
 * Map:
 * - MIN_COL_SPAN — the fewest columns a card may be dragged to
 * - MAX_ROW_SPAN — the most rows a band may be dragged to
 * - Segment — one span on a line: a card's columns, a band's rows, or free space
 * - moveLine — the spans after a line moves by whole steps
 * - reach — how far a line can move each way, in steps
 */

export const MIN_COL_SPAN = 3;
export const MAX_ROW_SPAN = 12;

/** One span on a line. Locked: floor = ceil = span. Free space may be Infinity. */
export interface Segment {
  span: number;
  floor: number;
  ceil: number;
}

/** What a segment may give. */
const spare = (s: Segment): number => (s.span === Infinity ? Infinity : Math.max(0, s.span - s.floor));

/** What a segment may take. */
const room = (s: Segment): number => (s.ceil === Infinity ? Infinity : Math.max(0, s.ceil - s.span));

/** A segment that can neither give nor take: a move passes through it. */
const locked = (s: Segment): boolean => s.span !== Infinity && s.floor === s.ceil;

/** The segment a move grows: the nearest on its side that is not locked. */
const grower = (segs: readonly Segment[], line: number, up: boolean): number => {
  const step = up ? -1 : 1;
  let i = up ? line : line + 1;
  while (segs[i] && locked(segs[i]!) && segs[i + step]) i += step;
  return i;
};

/** The givers for a move, nearest first. */
const givers = (segs: readonly Segment[], line: number, up: boolean): number[] =>
  (up ? segs.map((_, i) => i).slice(line + 1) : segs.map((_, i) => i).slice(0, line + 1).reverse());

/**
 * The spans after line `line` (between `segs[line]` and `segs[line + 1]`)
 * moves `steps`. The span it grows takes what the spans across it give,
 * nearest first, each down to its floor; a step nobody can give is dropped.
 */
export function moveLine(segs: readonly Segment[], line: number, steps: number): number[] {
  const out = segs.map((s) => s.span);
  if (!steps || line < 0 || line >= segs.length - 1) return out;
  const up = steps > 0;
  // A locked band on the growing side passes the move through too.
  const grows = grower(segs, line, up);
  const want = Math.min(Math.abs(steps), room(segs[grows]!));
  let got = 0;
  for (const i of givers(segs, line, up)) {
    if (got >= want) break;
    const give = Math.min(spare(segs[i]!), want - got);
    out[i] = out[i]! - give;
    got += give;
  }
  out[grows] = out[grows]! + got;
  return out;
}

/** How far a line can move: `max` steps forward, `min` steps back. */
export function reach(segs: readonly Segment[], line: number): { min: number; max: number } {
  if (line < 0 || line >= segs.length - 1) return { min: 0, max: 0 };
  const total = (up: boolean): number => givers(segs, line, up).reduce((t, i) => t + spare(segs[i]!), 0);
  return {
    max: Math.min(room(segs[grower(segs, line, true)]!), total(true)),
    min: Math.min(room(segs[grower(segs, line, false)]!), total(false)),
  };
}
