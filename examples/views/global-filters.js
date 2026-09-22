/**
 * global-filters.js — the app header's TOP-LEVEL filters.
 *
 * Header chips trickle DOWN: they set the population every view works within.
 * A view's own filter bar narrows further inside that. VIEW leads, because
 * picking a saved view re-applies the other three.
 */

/** Default regions — a caller passes the list its own data carries. */
const REGIONS = ['EMEA', 'AMER', 'APAC', 'LATAM'];

/** Default customers: NONE, so the chip is dropped rather than shown empty. */
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
 * Build the header's filter set. `views` is this page's own saved views.
 *
 * `regions` and `customers` must BE the values the data carries — a chip whose
 * options differ from the records filters to nothing, silently.
 * TRAP T-a-chip-filters-the-values-the-data-has.
 */
export function globalFilters(views, regions = REGIONS, customers = CUSTOMERS, dates = demoDays()) {
  return [
    {
      id: 'view',
      // The FIELD name, not the picked view — the toolbar shows the value in
      // the caret (Figma 150:3688).
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
      // OFF until a value is picked: ON with nothing chosen paints the amber
      // "filtering nothing" warning before the reader has touched anything.
      removable: true,
      select: 'multiple',
      options: customers.map((value) => ({ value, label: value })),
    },
    {
      id: 'region',
      label: 'Region',
      icon: 'fa-solid fa-globe',
      removable: true,
      select: 'multiple',
      // The VALUE is what the record holds; the label is only what a reader sees.
      options: regions.map((value) => ({ value, label: REGION_LABELS[value] ?? value })),
    },
    {
      id: 'dateRange',
      /* "Created date", not "Date range": a chip names the FIELD it filters,
         and a reader cannot act on a chip that does not say which date.
         TRAP T-a-date-chip-names-its-field */
      label: 'Created date',
      icon: 'fa-solid fa-calendar',
      kind: 'date',
      // Opens in RANGE mode — a global date filter is nearly always a span.
      range: true,
      removable: true,
      /* Only days the DATA covers are pickable, so the caller passes its own.
         The default is the last 90 days, which matched nothing in Records:
         every `created` date there is in 2024, so the calendar offered a span
         no record could ever fall in. TRAP T-a-date-chip-names-its-field */
      availableDates: dates,
    },
    // A chip with NO options is dropped, not shown empty.
  ].filter((chip) => chip.id !== 'customer' || customers.length > 0);
}

/**
 * What the header's ADD chip offers — VIEW-scope fields not already on the bar.
 *
 * These belong to the whole view, so every component narrows by them: a status
 * or a plan means the same thing to the chart, the tiles and the grid. Group
 * and Sort are absent on purpose — they arrange ONE component and have no
 * view-level meaning. TRAP T-group-and-sort-are-component-scope
 *
 * `held` are the ids the bar already carries, so a field is never offered twice.
 */
export function globalAvailable(fields = {}, held = []) {
  const taken = new Set(held);
  const asOptions = (values) =>
    values.map((v) => ({ value: String(v).toLowerCase(), label: String(v) }));

  return [
    { id: 'status', label: 'Status', select: 'multiple', removable: true,
      options: asOptions(fields.status ?? []) },
    { id: 'plan', label: 'Plan', icon: 'fa-solid fa-tag',
      select: 'multiple', removable: true, options: asOptions(fields.plan ?? []) },
    { id: 'tier', label: 'Tier', select: 'multiple', removable: true,
      options: asOptions(fields.tier ?? []) },
    { id: 'owner', label: 'Owner', select: 'single', removable: true, commit: true,
      options: asOptions(fields.owner ?? []) },
  ].filter((f) => !taken.has(f.id) && f.options.length > 0);
}
