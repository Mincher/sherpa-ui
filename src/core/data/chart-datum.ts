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

/**
 * One datum's value as a NUMBER, or 0.
 *
 * A legend widens `value` to `string | number`, and a caller may hand over
 * anything, so every reader coerced it its own way.
 */
export function datumValue(datum: { value?: string | number }): number {
  const n = typeof datum.value === 'number' ? datum.value : Number(datum.value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * What a set of data ADDS UP TO — one answer, for the ring and for the label.
 *
 * Three sums existed across two components and DISAGREED: a donut's ring
 * clamped negatives to zero while its own centre label kept them, so three
 * slices of 10, −5 and 20 drew a total of 30 under a label reading 25.
 *
 * `clamp` is the difference, made explicit. A ring must clamp — a negative arc
 * is not a shape — while a printed total must not, because −5 is what the data
 * says. Neither is a default, so a caller has to decide.
 *
 * TRAP T-one-total-for-the-ring-and-the-label
 */
export function datumTotal(
  data: readonly { value?: string | number }[],
  options: { clamp: boolean },
): number {
  return data.reduce((sum, d) => {
    const n = datumValue(d);
    return sum + (options.clamp ? Math.max(0, n) : n);
  }, 0);
}

/* TRAP T-populate-vocabulary-is-label-value-description — label, value,
   description, id, icon; add a field freely, never rename one of these. */
