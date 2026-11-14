/**
 * series-colours.ts — the ten data-viz series' outlines, each a token as a picker keeps it: what a stage wears in turn.
 *
 * Map:
 * - SERIES_BORDERS — The ten data-viz series' outlines, as tokens: a swatch's value, a stage's colour.
 */

/** The ten data-viz series' outlines, as tokens: a swatch's value, a stage's colour. */
export const SERIES_BORDERS: readonly string[] = Array.from({ length: 10 }, (_, i) => `var(--sherpa-data-viz-series-border-${i + 1})`);
