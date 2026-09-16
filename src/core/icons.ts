/**
 * Shared Font Awesome glyphs — the ones more than one component must agree on.
 *
 * A glyph belongs here when TWO OR MORE components draw the same concept. The
 * sort arrows are the case this exists for: a column header and a toolbar chip
 * are two views of ONE sort, and if they disagree about what "descending" looks
 * like the reader is told the two controls are different things.
 *
 * They were duplicated — a `static icons` on sherpa-data-grid and a
 * `static #icons` on sherpa-quick-filter-toolbar, each holding its own copy of
 * the same four strings. A test existed to catch the drift, which is the
 * clearest possible sign the duplication was the problem.
 *
 * A glyph used by ONE component stays in that component. This is a shared
 * vocabulary, not a dumping ground for every icon in the system.
 */

/**
 * The ORGANISE glyphs — grouping and the three sort states.
 *
 * Tri-state on purpose: a sortable column that is not the current sort shows
 * `sortNone`, so it offers itself without claiming to be active. Two states
 * would make "unsorted" and "ascending" look the same.
 *
 * These are Will's four Figma icons; changing one here changes it everywhere.
 */
export const ORGANISE_ICONS = {
  group: 'fa-solid fa-layer-group',
  sortNone: 'fa-solid fa-sort',
  sortAsc: 'fa-solid fa-arrow-up-wide-short',
  sortDesc: 'fa-solid fa-arrow-down-wide-short',
} as const;

export type OrganiseIcon = keyof typeof ORGANISE_ICONS;
