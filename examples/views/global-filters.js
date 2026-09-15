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
 */
export function globalFilters(views) {
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
      options: [
        { value: 'northwind', label: 'Northwind' },
        { value: 'contoso', label: 'Contoso' },
        { value: 'fabrikam', label: 'Fabrikam' },
        { value: 'tailspin', label: 'Tailspin' },
        { value: 'adventure', label: 'Adventure Works' },
      ],
    },
    {
      id: 'region',
      label: 'Region',
      icon: 'fa-solid fa-globe',
      removable: true,
      select: 'multiple',
      options: [
        { value: 'emea', label: 'EMEA' },
        { value: 'amer', label: 'Americas' },
        { value: 'apac', label: 'APAC' },
      ],
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
  ];
}
