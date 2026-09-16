/**
 * ONE datum shape for every chart, and the legend beside it.
 *
 * `BarDatum`, `DonutSlice` and `LegendItem` were three names for the same three
 * fields. A legend sits BESIDE a chart showing the SAME data, so crossing
 * between them should be free — and it was not:
 *
 *   barData.map((d) => ({ label: d.label, value: d.value, colorIndex: d.colorIndex }))
 *
 * …in `dashboard.js`, a copy of a shape to itself, field for field, purely to
 * cross a type boundary that should not have existed.
 *
 * Three names also defeat `#push`'s skip-if-unchanged guard: it compares the
 * rows array by IDENTITY, and an adapter that rebuilds the array to change its
 * type never matches. One shape means a chart and its legend can share one
 * array, and the guard holds.
 */

/**
 * One category, with its measurement.
 *
 * A bar, a donut slice, a legend row — the same three fields in each, because
 * they are the same thing seen three ways.
 */
export interface ChartDatum {
  /** What the category is called. Shown on the axis, in the legend, in the tip. */
  label: string;
  /**
   * The measurement.
   *
   * A chart needs a NUMBER to draw it; a legend may show a preformatted string
   * ("£1.2k", "42%"), because it only prints it. So a legend widens this — see
   * `LegendDatum` — rather than every chart loosening its own.
   */
  value: number;
  /**
   * Which categorical colour to use, 1-based into the data-viz sequence.
   *
   * Omitted means "the next one", which is what a caller wants when the order
   * on screen IS the order in the data. Set it when two charts must agree about
   * a category's colour — the same region blue in both.
   */
  colorIndex?: number;
}

/**
 * A legend row.
 *
 * `ChartDatum` plus the two things only a legend has: a value it may print
 * rather than plot, and a STATUS swatch.
 */
export interface LegendDatum extends Omit<ChartDatum, 'value'> {
  /** Preformatted is allowed here — a legend prints, it does not plot. */
  value?: string | number;
  /**
   * A STATUS swatch instead of a categorical one.
   *
   * A gauge's bands are thresholds, not a data series — their colour means
   * "healthy / warning / critical", so the swatch must come from the status
   * ramp rather than the next hue in the categorical wheel. Set this OR
   * colorIndex, not both.
   */
  status?: 'success' | 'warning' | 'critical' | 'info' | 'urgent';
}
