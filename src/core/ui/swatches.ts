/**
 * swatches.ts — the colours a swatch picker offers, each an existing token: the data-viz series, the 500 of each of
 * Figma's ranges, its border colour the value and its fill the chip's. Will, TODO 904
 *
 * Map:
 * - Swatch — One colour a picker offers: its value, its words, and its fill.
 * - DATA_VIZ_SWATCHES — The ten data-viz series colours.
 * - randomSwatch — A swatch at random, one the neighbours given do not wear where it can.
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

/** A swatch's value at random from `from`, one none of `beside` wears where one is left. */
export function randomSwatch(beside: readonly (string | undefined)[] = [], from: readonly Swatch[] = DATA_VIZ_SWATCHES): string {
  const free = from.filter((s) => !beside.includes(s.value));
  const pool = free.length ? free : from;
  return pool[Math.floor(Math.random() * pool.length)]!.value;
}
