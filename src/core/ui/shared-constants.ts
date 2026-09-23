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
  group: 'fa-solid fa-layer-group',
  sortNone: 'fa-solid fa-sort',
  sortAsc: 'fa-solid fa-arrow-up-wide-short',
  sortDesc: 'fa-solid fa-arrow-down-wide-short',
} as const;


/**
 * Rows in a filter menu that are NOT values, as a selector.
 *
 * TRAP T-non-value-rows-is-one-selector
 */
export const NON_VALUE_ROWS = '.qf-all, .qf-toggle';
