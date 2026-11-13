/**
 * swatches.ts — the colours a swatch picker offers, each an existing token: the data-viz series, the 500 of each of
 * Figma's ranges, its border colour the value and its fill the chip's. Will, TODO 904
 *
 * Map:
 * - Swatch — One colour a picker offers: its value, its words, and its fill.
 * - DATA_VIZ_SWATCHES — The ten data-viz series colours.
 */

/** One colour a picker offers: the value it keeps (a CSS colour, a token), its words, and the fill its chip shows. */
export interface Swatch {
  value: string;
  label: string;
  fill: string;
}

const NAMES = ['Violet', 'Purple', 'Teal', 'Blue', 'Indigo', 'Tan', 'Orchid', 'Raspberry', 'Green', 'Grey'];

/** The ten data-viz series colours: Figma's color 5 of each range, the border solid and the fill half. */
export const DATA_VIZ_SWATCHES: readonly Swatch[] = NAMES.map((label, i) => ({
  value: `var(--sherpa-data-viz-series-border-${i + 1})`,
  label,
  fill: `var(--sherpa-data-viz-series-${i + 1})`,
}));
