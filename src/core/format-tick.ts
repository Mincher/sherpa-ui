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
