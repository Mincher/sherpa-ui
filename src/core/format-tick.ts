/**
 * Format one axis tick value.
 *
 * Axis labels are read at a glance beside the plot, so a raw `1284.0000001` or a
 * 7-digit count is noise. Compacts thousands and millions and drops trailing
 * zeros, as the Figma axis mock-ups show ("1.5K", not "1500"). Shared —
 * TRAP T-one-function-places-label-and-gridline.
 */
export function formatTick(value: number): string {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}K`;
  // Below 10 a single decimal carries real information: a 0–1 ratio axis would
  // otherwise collapse to "0" and "1" with nothing between.
  return trim(value, abs < 10 ? 1 : 0);
}

/** Round to `places` and drop any trailing zeros, so 1.0 reads as "1". */
function trim(value: number, places = 1): string {
  return String(Number(value.toFixed(places)));
}

/**
 * Where the i-th of `steps` divisions sits, as a percentage UP from the plot's
 * bottom edge.
 *
 * TRAP T-one-function-places-label-and-gridline — N−1 gridlines against N+1 flex
 * boundaries is how the previous versions drifted.
 */
export function tickPercent(index: number, steps: number): number {
  if (steps <= 0) return 0;
  return (index / steps) * 100;
}

/**
 * The `position-area` on the OUTWARD side of a radial mark.
 *
 * TRAP T-radial-tip-pushes-outward — markers diverge by construction, so an
 * outward tip never overlaps its neighbours'.
 *
 * @param angleDeg measured CLOCKWISE from 12 o'clock, matching how both the donut
 *   and the gauge already place their marks.
 */
export function radialArea(angleDeg: number): string {
  // TRAP T-radial-tip-pushes-outward — the half-octant offset keeps 0deg (up)
  // squarely in `block-start` rather than on a boundary.
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

/** One point on a circle. Angles run CLOCKWISE from 12 o'clock, like the charts. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export interface RingSegmentOptions {
  /** Centre of the ring, in viewBox units. */
  cx: number;
  cy: number;
  /** Inner radius. 0 draws a solid wedge (a pie slice). */
  inner: number;
  /** Outer radius. */
  outer: number;
  /** Where the segment starts, CLOCKWISE degrees from 12 o'clock. */
  startDeg: number;
  /** Where it ends. Must be greater than startDeg. */
  endDeg: number;
  /** Corner rounding, in viewBox units. Clamped to what the segment can hold. */
  radius?: number;
}

/**
 * The `d` for a CLOSED ring segment — a donut slice — with all four corners
 * rounded.
 *
 * TRAP T-ring-segment-needs-two-radius-clamps — a stroke has caps, not corners;
 * one clamp short and a thin slice paints a bow tie.
 *
 * The outline runs: outer arc left→right, rounded corner down the trailing edge,
 * inner arc back right→left, rounded corner up the leading edge, close.
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
  // Degrees of arc that `r` units span at radius `rad` — how much of the corner
  // radius eats into the sweep at each end.
  const degFor = (r: number, rad: number): number =>
    rad <= 0 ? 0 : (r / rad) * (180 / Math.PI);

  // Both clamps — TRAP T-ring-segment-needs-two-radius-clamps.
  const asked = options.radius ?? 0;
  const byBand = band / 4;
  const arcAt = (inner > 0 ? inner : outer) * ((span * Math.PI) / 180);
  const r = Math.max(0, Math.min(asked, byBand, arcAt / 4));

  const outerInset = degFor(r, outer);
  const innerInset = degFor(r, inner);
  // A pie's inner "arc" is the single centre point, so its corners collapse.
  const pie = inner <= 0;

  const oStart = startDeg + outerInset;
  const oEnd = endDeg - outerInset;
  const iStart = startDeg + innerInset;
  const iEnd = endDeg - innerInset;

  // Long-arc flag: SVG needs it once the sweep passes a half circle.
  const longOuter = oEnd - oStart > 180 ? 1 : 0;
  const longInner = iEnd - iStart > 180 ? 1 : 0;

  const p = (rad: number, deg: number): string =>
    polar(cx, cy, rad, deg).map((n) => n.toFixed(4)).join(' ');
  const parts: string[] = [];

  // Up the leading edge, from just outside the inner corner to the outer corner.
  parts.push(`M ${p(inner + r, startDeg)}`);
  parts.push(`L ${p(outer - r, startDeg)}`);
  // Top-left corner, then the outer arc, then the top-right corner.
  parts.push(`A ${r} ${r} 0 0 1 ${p(outer, oStart)}`);
  parts.push(`A ${outer} ${outer} 0 ${longOuter} 1 ${p(outer, oEnd)}`);
  parts.push(`A ${r} ${r} 0 0 1 ${p(outer - r, endDeg)}`);
  // Down the trailing edge to the inner ring.
  parts.push(`L ${p(inner + r, endDeg)}`);
  if (!pie) {
    // Bottom-right corner, the inner arc BACKWARDS, bottom-left corner.
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
 * TRAP T-series-count-is-ten-not-eleven — a bare `% 11` in four components
 * outlived the palette, and a missing variable paints nothing.
 */
export const SERIES_COUNT = 10;

/**
 * The CSS custom property a chart mark should paint with, for a 0-based mark
 * index and an optional explicit 1-based `colorIndex` from the data.
 *
 * Wraps — TRAP T-series-count-is-ten-not-eleven.
 */
export function seriesVar(index: number, colorIndex?: number): string {
  const n = ((colorIndex ?? index + 1) - 1) % SERIES_COUNT + 1;
  return `var(--sherpa-data-viz-series-${n})`;
}

/**
 * The mark's OUTLINE for the same series — the collection's `border`, which
 * aliases to colour 5 of whichever sequence is active.
 *
 * TRAP T-series-count-is-ten-not-eleven — the fill moves along its ramp, the
 * border is the series' identity and stays put.
 */
export function seriesBorderVar(index: number, colorIndex?: number): string {
  const n = ((colorIndex ?? index + 1) - 1) % SERIES_COUNT + 1;
  return `var(--sherpa-data-viz-series-border-${n}, var(--sherpa-data-viz-series-${n}))`;
}
