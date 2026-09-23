/**
 * shared-constants.ts — values MORE THAN ONE component must agree on.
 *
 * Not icons, despite one of them being icon names: `NON_VALUE_ROWS` is a CSS
 * selector, and three of the four importers want only that.
 * TRAP T-shared-values-two-components-must-agree-on
 */

/**
 * The ORGANISE glyphs — grouping and the three sort states.
 *
 * Tri-state: a column that is not the current sort shows `sortNone`, offering
 * itself without claiming to be active.
 */
export const ORGANISE_ICONS = {
  group: 'group',
  sortNone: 'sort-none',
  sortAsc: 'sort-ascending',
  sortDesc: 'sort-descending',
} as const;


/**
 * Rows in a filter menu that are NOT values, as a selector.
 *
 * TRAP T-non-value-rows-is-one-selector
 */
export const NON_VALUE_ROWS = '.qf-all, .qf-toggle';


/**
 * Native attributes a select control mirrors onto its inner `<input>`.
 *
 * Checkbox and radio declared this identically — same four names, same comment.
 * `sherpa-input-text` keeps its OWN longer list: a text field also mirrors
 * `placeholder`, `pattern`, `inputmode` and the length limits, which a checkbox
 * has no use for. A superset is not the same value.
 */
export const MIRRORED_CONTROL_ATTRS = ['name', 'value', 'required', 'disabled'] as const;

/**
 * A radial chart's geometry, in viewBox units of a 100×100 box.
 *
 * Donut and gauge draw the same arc with the same pen: `ringSegmentPath()` takes
 * all three, so a value that moved in one and not the other would draw two
 * different rings from one function.
 */
export const RADIAL_BOX = 100;
/** Centre of that box. A gauge shows only its TOP half. */
export const RADIAL_CENTRE = RADIAL_BOX / 2;
/** Segment corner radius. */
export const RADIAL_CORNER = 1;
/** Outline thickness, aligned INSIDE as in Figma. */
export const RADIAL_OUTLINE = 0.5;

/**
 * Gridlines a cartesian chart draws when `data-ticks` is absent.
 * Matches the Figma Chart Axis.
 */
export const DEFAULT_TICKS = 4;
