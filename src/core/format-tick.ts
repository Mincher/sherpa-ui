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
