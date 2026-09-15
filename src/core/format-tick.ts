/**
 * Format one axis tick value.
 *
 * Axis labels are read at a glance beside the plot, so a raw `1284.0000001` or a
 * 7-digit count is noise. This compacts thousands and millions and drops trailing
 * zeros, which is what the Figma axis mock-ups show ("1.5K", not "1500").
 *
 * Shared by every chart that draws an axis, so the barchart and the line chart
 * cannot format the same number two different ways.
 */
export function formatTick(value: number): string {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}K`;
  // Below 10 a single decimal carries real information (a 0–1 ratio axis would
  // otherwise collapse to "0" and "1" with nothing between).
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
 * Both the axis label and its gridline are placed with THIS function, on the same
 * box, so they cannot disagree. Two separate calculations is exactly how the
 * previous versions drifted: the gridlines drew N−1 interior lines while the axis
 * laid out N+1 flex boundaries.
 */
export function tickPercent(index: number, steps: number): number {
  if (steps <= 0) return 0;
  return (index / steps) * 100;
}

/**
 * The `position-area` on the OUTWARD side of a radial mark.
 *
 * A radial chart's markers fan out from a centre, so a tooltip pushed outward
 * along the marker's own radius can never overlap its neighbours' — they diverge
 * by construction. That is cheaper and steadier than measuring boxes and nudging
 * the ones that collide.
 *
 * `position-area` offers a 3x3 grid of areas around an anchor. This maps an angle
 * to whichever of the 8 outer cells faces away from the centre, so the tip sits on
 * the far side of its marker with the marker between it and the ring.
 *
 * @param angleDeg measured CLOCKWISE from 12 o'clock, matching how both the donut
 *   and the gauge already place their marks.
 */
export function radialArea(angleDeg: number): string {
  // Normalise, then split the circle into 8 octants centred on the compass
  // points: 0deg (up) must land squarely in `block-start`, not on a boundary,
  // so the octant is offset by half its own width before flooring.
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
 * This replaces the stroked-circle-with-a-dash trick the donut used to draw.
 * A stroke is a thick LINE: it has two caps and no corners, so it can carry
 * neither a border right round the slice nor a radius on all four corners.
 * Figma's slice is an arc with `cornerRadius: 2` and a 1px stroke on every edge,
 * which only a real closed path can express.
 *
 * The outline runs: outer arc left→right, rounded corner down the trailing edge,
 * inner arc back right→left, rounded corner up the leading edge, close. Each
 * corner is a quarter-ish arc of `radius`, so `fill` tints the body and `stroke`
 * traces the whole boundary — both in one element, one hit target, one hover.
 *
 * The radius is clamped twice: to a quarter of the band's thickness, and to a
 * quarter of the segment's own arc length. Without the second clamp a thin slice
 * asks for more rounding than its arc is long, and the corner arcs cross over
 * each other — the path then folds inside out and paints a bow tie.
 *
 * A segment covering the FULL circle has no corners to round and no radial edges
 * to draw, so it is emitted as two plain circles (outer, then inner reversed)
 * — the standard even-odd-free donut, which `fill-rule: evenodd` hollows out.
 */
export function ringSegmentPath(options: RingSegmentOptions): string {
  const { cx, cy, inner, outer, startDeg, endDeg } = options;
  const span = endDeg - startDeg;
  if (span <= 0 || outer <= 0) return '';

  // A whole circle: no radial edges exist, so the rounded-corner path below has
  // nothing to attach to and would collapse. Two opposing circles instead.
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

  // Clamp 1: a corner cannot be deeper than a quarter of the band.
  // Clamp 2: nor wider than a quarter of the segment's own arc, measured at the
  // INNER radius where the arc is shortest (0 for a pie, where the corners meet
  // at the centre point and there is nothing to round).
  const asked = options.radius ?? 0;
  const byBand = band / 4;
  const arcAt = (inner > 0 ? inner : outer) * ((span * Math.PI) / 180);
  const r = Math.max(0, Math.min(asked, byBand, arcAt / 4));

  const outerInset = degFor(r, outer);
  const innerInset = degFor(r, inner);
  // A pie's inner "arc" is the single centre point, so its corners collapse there.
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
