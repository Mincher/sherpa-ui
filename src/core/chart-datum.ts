/**
 * ONE datum shape for every chart, and the legend beside it.
 *
 * TRAP T-one-datum-shape-for-chart-and-legend
 */

/** One category with its measurement — a bar, a slice, a legend row. */
export interface ChartDatum {
  /** Shown on the axis, in the legend, in the tip. */
  label: string;
  /** A NUMBER here; `LegendDatum` widens it — TRAP T-one-datum-shape-for-chart-and-legend. */
  value: number;
  /**
   * Categorical colour, 1-based into the data-viz sequence. Omitted means "the
   * next one"; set it when two charts must agree about a category's colour.
   */
  colorIndex?: number;
}

/** `ChartDatum` plus the two things only a legend has — TRAP T-one-datum-shape-for-chart-and-legend. */
export interface LegendDatum extends Omit<ChartDatum, 'value'> {
  /** Preformatted is allowed here — a legend prints, it does not plot. */
  value?: string | number;
  /**
   * A STATUS swatch instead of a categorical one — a gauge's bands are
   * thresholds, not a series. Set this OR colorIndex, not both.
   */
  status?: 'success' | 'warning' | 'critical' | 'info' | 'urgent';
}

/* TRAP T-populate-vocabulary-is-label-value-description — label, value,
   description, id, icon; add a field freely, never rename one of these. */
