/**
 * Shared constants that MORE THAN ONE component must agree on.
 *
 * TRAP T-shared-values-two-components-must-agree-on — what earns a place here,
 * and the drift test that proved the duplication was the problem.
 */

/**
 * The ORGANISE glyphs — grouping and the three sort states.
 *
 * Tri-state on purpose: a column that is not the current sort shows `sortNone`,
 * so it offers itself without claiming to be active. Will's four Figma icons;
 * changing one here changes it everywhere
 * (TRAP T-shared-values-two-components-must-agree-on).
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
 * TRAP T-non-value-rows-is-one-selector — the two readers had drifted, and
 * counting either row as a pick is a visible bug.
 */
export const NON_VALUE_ROWS = '.qf-all, .qf-toggle';
