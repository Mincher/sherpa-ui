/**
 * ONE datum shape for every chart, and the legend beside it.
 *
 * TRAP T-one-datum-shape-for-chart-and-legend — three names for three fields
 * cost a copy-to-itself and defeated `#push`'s identity guard.
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
   * A NUMBER here; `LegendDatum` widens it —
   * TRAP T-one-datum-shape-for-chart-and-legend.
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
 * rather than plot, and a STATUS swatch —
 * TRAP T-one-datum-shape-for-chart-and-legend.
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

/* ── The POPULATE VOCABULARY ────────────────────────────────────────────
   TRAP T-populate-vocabulary-is-label-value-description — label, value,
   description, id, icon; add a field freely, never rename one of these. */
