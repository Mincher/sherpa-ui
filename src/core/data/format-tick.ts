/**
 * format-tick.ts — the arithmetic the charts share: tick labels, gridline
 * placement, radial tips, ring-segment paths, series colours.
 */

/**
 * One axis tick, compacted — "1.5K", not "1500".
 *
 * TRAP T-one-function-places-label-and-gridline
 */
export function formatTick(value: number): string {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);

  /* SMALLEST unit first: rounding can push a value out of the tier it just
     tested into, and largest-first skips the bigger tier before the smaller
     one discovers it. 999,999 is under a million, yet reads "1M".
     TRAP T-a-tooltip-is-not-an-axis */
  for (let i = 0; i < UNITS.length; i++) {
    const [size, suffix] = UNITS[i]!;
    if (abs < size) break;
    const scaled = trim(value / size);
    if (Math.abs(Number(scaled)) < 1_000 || i === UNITS.length - 1) {
      return `${scaled}${suffix}`;
    }
    const [bigger, bigSuffix] = UNITS[i + 1]!;
    return `${trim(value / bigger)}${bigSuffix}`;
  }

  // Below 10, a 0–1 ratio axis without the decimal is just "0" and "1".
  const whole = trim(value, abs < 10 ? 1 : 0);
  // The same crossing at the bottom: 999.5 is "1K", not "1000".
  return Math.abs(Number(whole)) >= 1_000 ? `${trim(value / 1_000)}K` : whole;
}

const UNITS = [[1_000, 'K'], [1_000_000, 'M']] as const;

/**
 * ONE value, in full — what a tooltip shows.
 *
 * Grouped, and decimals kept as they arrive — `reduceRows` returns a mean
 * unrounded on purpose, and rounding is the caller's decision.
 * TRAP T-a-tooltip-is-not-an-axis
 */
export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Round to `places` and drop trailing zeros, so 1.0 reads as "1". */
function trim(value: number, places = 1): string {
  return String(Number(value.toFixed(places)));
}

/**
 * Where the i-th of `steps` divisions sits, as a percentage UP from the bottom.
 *
 * TRAP T-one-function-places-label-and-gridline
 */
export function tickPercent(index: number, steps: number): number {
  if (steps <= 0) return 0;
  return (index / steps) * 100;
}

/**
 * The `position-area` on the OUTWARD side of a radial mark.
 *
 * TRAP T-radial-tip-pushes-outward
 *
 * @param angleDeg CLOCKWISE from 12 o'clock, as the donut and gauge place marks.
 */
export function radialArea(angleDeg: number): string {
  // The half-octant offset puts 0deg squarely in `block-start`, not on a
  // boundary. TRAP T-radial-tip-pushes-outward
  const deg = ((angleDeg % 360) + 360) % 360;
  const octant = Math.floor(((deg + 22.5) % 360) / 45);
  return RADIAL_AREAS[octant] ?? 'block-start';
}

/** Octant 0 is up, going clockwise. Indexed by radialArea(). */
const RADIAL_AREAS = [
  'block-start',                // 12 o'clock — straight up
  'block-start inline-end',     // 1–2
  'inline-end',                 // 3
  'block-end inline-end',       // 4–5
  'block-end',                  // 6 — straight down
  'block-end inline-start',     // 7–8
  'inline-start',               // 9
  'block-start inline-start',   // 10–11
] as const;

/* ── Ring segments ────────────────────────────────────────────────────── */

/** One point on a circle. Angles run CLOCKWISE from 12 o'clock. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export interface RingSegmentOptions {
  /** Centre of the ring, in viewBox units. */
  cx: number;
  cy: number;
  /** Inner radius. 0 draws a solid wedge — a pie slice. */
  inner: number;
  /** Outer radius. */
  outer: number;
  /** Start, CLOCKWISE degrees from 12 o'clock. */
  startDeg: number;
  /** End. Must be greater than startDeg. */
  endDeg: number;
  /** Corner rounding, viewBox units. Clamped to what the segment can hold. */
  radius?: number;
}

/**
 * The `d` for a CLOSED ring segment — a donut slice — with four rounded corners.
 *
 * TRAP T-ring-segment-needs-two-radius-clamps
 */
export function ringSegmentPath(options: RingSegmentOptions): string {
  const { cx, cy, inner, outer, startDeg, endDeg } = options;
  const span = endDeg - startDeg;
  if (span <= 0 || outer <= 0) return '';

  // A whole circle — TRAP T-ring-segment-needs-two-radius-clamps.
  if (span >= 359.999) {
    const ring = (r: number, sweep: number): string => {
      const [x, y] = polar(cx, cy, r, 0);
      const [bx, by] = polar(cx, cy, r, 180);
      return `M ${x} ${y} A ${r} ${r} 0 0 ${sweep} ${bx} ${by} A ${r} ${r} 0 0 ${sweep} ${x} ${y} Z`;
    };
    return inner > 0 ? `${ring(outer, 1)} ${ring(inner, 0)}` : ring(outer, 1);
  }

  const band = outer - inner;
  // Degrees of arc that `r` units span at radius `rad`.
  const degFor = (r: number, rad: number): number =>
    rad <= 0 ? 0 : (r / rad) * (180 / Math.PI);

  // Both clamps — TRAP T-ring-segment-needs-two-radius-clamps.
  const asked = options.radius ?? 0;
  const byBand = band / 4;
  const arcAt = (inner > 0 ? inner : outer) * ((span * Math.PI) / 180);
  const r = Math.max(0, Math.min(asked, byBand, arcAt / 4));

  const outerInset = degFor(r, outer);
  const innerInset = degFor(r, inner);
  // A pie's inner "arc" is one point, so its corners collapse.
  const pie = inner <= 0;

  const oStart = startDeg + outerInset;
  const oEnd = endDeg - outerInset;
  const iStart = startDeg + innerInset;
  const iEnd = endDeg - innerInset;

  // SVG needs the long-arc flag once the sweep passes a half circle.
  const longOuter = oEnd - oStart > 180 ? 1 : 0;
  const longInner = iEnd - iStart > 180 ? 1 : 0;

  const p = (rad: number, deg: number): string =>
    polar(cx, cy, rad, deg).map((n) => n.toFixed(4)).join(' ');
  const parts: string[] = [];

  // Leading edge, corner, outer arc, corner, trailing edge.
  parts.push(`M ${p(inner + r, startDeg)}`);
  parts.push(`L ${p(outer - r, startDeg)}`);
  parts.push(`A ${r} ${r} 0 0 1 ${p(outer, oStart)}`);
  parts.push(`A ${outer} ${outer} 0 ${longOuter} 1 ${p(outer, oEnd)}`);
  parts.push(`A ${r} ${r} 0 0 1 ${p(outer - r, endDeg)}`);
  parts.push(`L ${p(inner + r, endDeg)}`);
  if (!pie) {
    // Corner, inner arc BACKWARDS, corner.
    parts.push(`A ${r} ${r} 0 0 1 ${p(inner, iEnd)}`);
    parts.push(`A ${inner} ${inner} 0 ${longInner} 0 ${p(inner, iStart)}`);
    parts.push(`A ${r} ${r} 0 0 1 ${p(inner + r, startDeg)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/* ── Series colours ───────────────────────────────────────────────────── */

/** How many data-viz series the token layer defines. */
const SERIES_COUNT = 10;

/** The custom property a mark paints with. `index` is 0-based; an explicit
 *  `colorIndex` from the data is 1-based. Wraps — see `seriesSlot`. */
export function seriesVar(index: number, colorIndex?: number): string {
  return `var(--sherpa-data-viz-series-${seriesSlot(index, colorIndex)})`;
}

/** The mark's OUTLINE for the same series — the fill moves along its ramp, the
 *  border is the series' identity and stays put. */
export function seriesBorderVar(index: number, colorIndex?: number): string {
  const n = seriesSlot(index, colorIndex);
  return `var(--sherpa-data-viz-series-border-${n}, var(--sherpa-data-viz-series-${n}))`;
}

/**
 * Which of the ten slots a mark paints with — always 1..10, whatever arrives.
 *
 * The sequence is a RING: 0 is slot 10 as 11 is slot 1. An unwrapped 0 asked
 * for `--sherpa-data-viz-series-0`, which does not exist, so the mark painted
 * nothing. TRAP T-series-count-is-ten-not-eleven
 */
function seriesSlot(index: number, colorIndex?: number): number {
  const asked = colorIndex ?? index + 1;
  if (!Number.isFinite(asked)) return 1;
  const n = Math.trunc(asked);
  return ((n - 1) % SERIES_COUNT + SERIES_COUNT) % SERIES_COUNT + 1;
}
