/**
 * ONE datum shape for every chart, and the legend beside it.
 *
 * TRAP T-one-datum-shape-for-chart-and-legend
 */

/** One category with its measurement — a bar, a slice, a legend row. */
export interface ChartDatum {
  /** Shown on the axis, in the legend, in the tip. */
  label: string;
  /** A NUMBER here; `LegendDatum` widens it. */
  value: number;
  /**
   * Categorical colour, 1-based into the ten data-viz sequences and wrapping
   * either way. Omitted means "the next one"; set it when two charts must
   * agree about a category's colour. TRAP T-series-count-is-ten-not-eleven
   */
  colorIndex?: number;
}

/** `ChartDatum` plus the two things only a legend has. */
export interface LegendDatum extends Omit<ChartDatum, 'value'> {
  /** Preformatted is allowed here — a legend prints, it does not plot. */
  value?: string | number;
  /** A STATUS swatch instead of a categorical one — a gauge's bands are
   *  thresholds, not a series. Set this OR colorIndex, not both. */
  status?: 'success' | 'warning' | 'critical' | 'info' | 'urgent';
}

/** One datum's value as a NUMBER, or 0. A legend widens `value` to a string. */
export function datumValue(datum: { value?: string | number }): number {
  const n = typeof datum.value === 'number' ? datum.value : Number(datum.value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * What a set of data ADDS UP TO — one answer, for the ring and for the label.
 *
 * `clamp` has no default: a ring must clamp, because a negative arc is not a
 * shape, and a printed total must not, because −5 is what the data says.
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
