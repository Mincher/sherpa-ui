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
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}K`;
  // Below 10, a 0–1 ratio axis without the decimal is just "0" and "1".
  return trim(value, abs < 10 ? 1 : 0);
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

/**
 * How many data-viz series the token layer defines.
 *
 * TRAP T-series-count-is-ten-not-eleven
 */
export const SERIES_COUNT = 10;

/**
 * The custom property a mark paints with. `index` is 0-based; an explicit
 * `colorIndex` from the data is 1-based. Wraps.
 *
 * TRAP T-series-count-is-ten-not-eleven
 */
export function seriesVar(index: number, colorIndex?: number): string {
  const n = ((colorIndex ?? index + 1) - 1) % SERIES_COUNT + 1;
  return `var(--sherpa-data-viz-series-${n})`;
}

/**
 * The mark's OUTLINE for the same series — the fill moves along its ramp, the
 * border is the series' identity and stays put.
 *
 * TRAP T-series-count-is-ten-not-eleven
 */
export function seriesBorderVar(index: number, colorIndex?: number): string {
  const n = ((colorIndex ?? index + 1) - 1) % SERIES_COUNT + 1;
  return `var(--sherpa-data-viz-series-border-${n}, var(--sherpa-data-viz-series-${n}))`;
}
