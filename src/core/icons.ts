/**
 * Shared constants that MORE THAN ONE component must agree on.
 *
 * Mostly Font Awesome glyphs, which is what the filename says and what this
 * started as. `NON_VALUE_ROWS` joined them at the bottom: it is a selector, not
 * a glyph, but it is here for exactly the same reason — two components had each
 * written their own copy and the copies had drifted. The file is named for its
 * first inhabitant; the RULE is "a value two components must not disagree
 * about". Rename it if the non-glyph half ever outgrows the glyphs.
 *
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


/**
 * Rows in a filter menu that are NOT values, as a selector.
 *
 * Two checkbox shapes in a filter menu stand for something other than a value,
 * and counting either one as a pick is a visible bug:
 *
 *   .qf-all     Select all — a control OVER the set. Counted in, it reports its
 *               own "on" as a picked value and the badge reads one too high
 *               with everything ticked.
 *   .qf-toggle  a folded BOOLEAN filter — it stands for a whole CHIP, and the
 *               toolbar reports it as one, not as a value of this menu.
 *
 * ONE DEFINITION because the two readers had DRIFTED: sherpa-menu excluded both,
 * while the toolbar and quick-filter excluded only `.qf-all`. Harmless today —
 * `.qf-toggle` rows only ever live in the overflow chip's menu, which the
 * toolbar's chip loop does not reach — but the two were one refactor apart from
 * disagreeing about what a pick is.
 */
export const NON_VALUE_ROWS = '.qf-all, .qf-toggle';
