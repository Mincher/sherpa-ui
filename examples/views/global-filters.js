/**
 * global-filters.js — the app header's TOP-LEVEL filters.
 *
 * These four chips sit in the app header, above every view, and they trickle
 * DOWN: whatever they narrow to is the population each view's own charts, grids
 * and metrics then work within. A view's own filter bar narrows further inside
 * that.
 *
 * That is the split the two toolbars exist for. A HEADER chip answers "which
 * slice of the business am I looking at" and applies everywhere; a VIEW chip
 * answers "which of these rows do I want" and applies to one screen. Region in
 * the header means every chart on every page is EMEA; region on the records bar
 * would mean only that grid.
 *
 * VIEW leads, because it is the one that can change the other three — picking a
 * saved view re-applies a whole arrangement.
 */

/**
 * The regions both demo datasets carry. The DEFAULT only — a caller passes its
 * own list, and both currently hold exactly these four.
 */
const REGIONS = ['EMEA', 'AMER', 'APAC', 'LATAM'];

/**
 * The DEFAULT customer options: NONE, so the chip is left off entirely.
 *
 * A caller passes the values its own records carry. What answers "which
 * customers" differs per page — on the records page it is who owns the
 * account; the dashboard's rows are alerts about devices and carry nothing of
 * the kind, so that page simply has no Customer chip rather than an empty one.
 * A chip with no options is a control that cannot do anything, and the amber
 * "on but filtering nothing" state exists to flag exactly that.
 */
const CUSTOMERS = [];

/** Reader-facing names for the region codes. A code with no entry shows as-is. */
const REGION_LABELS = { AMER: 'Americas', LATAM: 'Latin America' };

/** The days the demo data covers, for the date chip's calendar. */
function demoDays(back = 90) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < back; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

/**
 * Build the header's filter set.
 *
 * `views` is this page's own saved-view options — the one chip that differs per
 * page, because a dashboard's saved views are not a records page's.
 *
 * `regions` are the values the DATA actually carries. This chip used to own its
 * own list — three lowercase names (`emea`, `amer`, `apac`) against four
 * uppercase ones in both datasets — so picking EMEA filtered to nothing and no
 * grid or chart moved. A chip's options have to BE the values it filters, the
 * same rule `records-data.js` already states for `plans`.
 * TRAP T-a-chip-filters-the-values-the-data-has.
 */
export function globalFilters(views, regions = REGIONS, customers = CUSTOMERS) {
  return [
    {
      id: 'view',
      // The FIELD name, not the picked view. Figma's Type=view toolbar reads
      // Label "View" with the value in the caret (150:3688), so a loaded page
      // says "View | Fleet overview" rather than repeating the name on both
      // sides of the divider.
      label: 'View',
      // A SELECTOR, not a toggle: you are always in some view.
      persistent: true,
      // No icon here — the toolbar fixes the view selector's glyph itself.
      active: true,
      select: 'single',
      options: views,
    },
    {
      id: 'customer',
      label: 'Customer',
      icon: 'fa-solid fa-building',
      // OFF until a value is picked. A chip that is ON with nothing chosen
      // filters by nothing while claiming to, which is exactly the state the
      // amber warning tint exists to flag — starting there would paint the whole
      // header as a problem before the reader had touched anything.
      removable: true,
      select: 'multiple',
      // FROM THE DATA, like the regions below. "Customer" is this product's
      // word for an ORGANISATION, and these were five invented names against
      // records that carried no such field at all, so the chip could never
      // narrow anything. TRAP T-a-chip-filters-the-values-the-data-has.
      options: customers.map((value) => ({ value, label: value })),
    },
    {
      id: 'region',
      label: 'Region',
      icon: 'fa-solid fa-globe',
      removable: true,
      select: 'multiple',
      // The VALUE is what the record holds; the label is only what a reader
      // sees. They were different words here, which is the whole bug.
      options: regions.map((value) => ({ value, label: REGION_LABELS[value] ?? value })),
    },
    {
      id: 'dateRange',
      label: 'Date range',
      icon: 'fa-solid fa-calendar',
      kind: 'date',
      // OPENS IN RANGE MODE. A global date filter is almost always a span — "the
      // last quarter", "since the incident" — where a single day is the odd
      // case. The switch still flips it either way.
      range: true,
      removable: true,
      // Only the days the data actually covers are pickable, so a reader cannot
      // choose a date no record carries and get an empty app back.
      availableDates: demoDays(),
    },
    // A chip with NO options is dropped, not shown empty — see CUSTOMERS above.
  ].filter((chip) => chip.id !== 'customer' || customers.length > 0);
}
