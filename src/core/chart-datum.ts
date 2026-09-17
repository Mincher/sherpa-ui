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

/* ── The POPULATE VOCABULARY ────────────────────────────────────────────
   Surveyed 2026-09-17 across all 22 components that implement `renderData`.
   Thirteen declare a named shape, and three words carry most of them:

     label        7 of 13   the thing's name, as a reader sees it
     value        4 of 13   its measurement or its form value
     description  3 of 13   the secondary line under the label

   Two components DEVIATED, and both translated their own vocabulary in the one
   line where the spellings met:

     sherpa-metric         `name`  → dataset['label']
     sherpa-notifications  `title` → dataset['label']

   Both now take `label` and keep the old word as a deprecated alias.

   THE RULE, for any new populate shape:

     label        NOT name, title, heading, text or caption
     value        NOT amount or count
     description  NOT helper, sublabel, detail or body
     id           the thing's identity, when a caller needs to address it
     icon         a Font Awesome class list — see SherpaElement.writeIcon

   It matches the ATTRIBUTE vocabulary (`data-label`, `data-description`,
   `data-icon-start`) on purpose: a component's two doors should not use two
   words for one idea. NAMING-STANDARD D9 says the same thing for attributes;
   this is that rule reaching the data path.

   A shape is free to add fields nothing else has — a metric's `trend`, a
   notification's `unread`. What it must not do is rename one of these. */
