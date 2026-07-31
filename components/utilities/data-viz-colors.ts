/**
 * data-viz-colors.ts — theme-safe categorical colour resolution for charts.
 *
 * Charts must NOT hardcode hex palettes into inline styles — those override the
 * theme tokens and won't re-colour when the theme switches (teal/blue/purple).
 * Instead, series colours come from the `--sherpa-data-viz-categorical-color-N`
 * tokens (defined per-theme in css/styles/sherpa-themes.css).
 *
 * Two mechanisms:
 *   • CSS-driven (preferred, e.g. bar/legend swatches): set `data-color-index="N"`
 *     on the element and let CSS resolve `var(--sherpa-data-viz-categorical-color-N)`.
 *   • JS-read (conic-gradients where CSS can't express dynamic stops, e.g. donut/
 *     gauge): read the *resolved* token value at render time with
 *     `resolveCategoricalColor(host, i)`. Because it reads the live computed value,
 *     switching theme + re-rendering picks up the new colour.
 *
 * An explicit `item.color` always wins (a consumer supplying their own hex opts
 * out of theming deliberately).
 */

/** Number of categorical colours in the Apex 2.0 data-viz palette. */
export const CATEGORICAL_COUNT = 11;

/** 1-based categorical index for the i-th series (0-based i), wrapping the palette. */
export function categoricalIndex(i: number): number {
  return (((i % CATEGORICAL_COUNT) + CATEGORICAL_COUNT) % CATEGORICAL_COUNT) + 1;
}

/**
 * Resolve the concrete colour for the i-th series from the theme's data-viz
 * tokens, read live from `host`'s computed style (so it follows theme switches).
 * Falls back to an explicit override when provided. Returns a CSS colour string.
 *
 * @param host    an element in the themed tree (the component host)
 * @param i       0-based series index
 * @param override explicit colour that wins over the token (consumer-supplied)
 */
export function resolveCategoricalColor(host: Element, i: number, override?: string | null): string {
  if (override) return override;
  const n = categoricalIndex(i);
  const val = getComputedStyle(host)
    .getPropertyValue(`--sherpa-data-viz-categorical-color-${n}`)
    .trim();
  // If the token is missing (older theme / test harness), fall back to the CSS
  // custom property reference itself so the browser still resolves it in-context.
  return val || `var(--sherpa-data-viz-categorical-color-${n})`;
}
