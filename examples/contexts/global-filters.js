/**
 * global-filters.js — the app header's TOP-LEVEL filters.
 *
 * Header chips trickle DOWN: they set the population every Context works within.
 * A Context's own filter bar narrows further inside that. VIEW leads, because
 * picking a saved view re-applies the other three.
 *
 * Map:
 * - globalFilters — Build the header's filter set.
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
      /* NO `custom`. A reader picks an organisation from a list; nobody
         asks "customer starts with". TRAP T-conditions-are-opt-in-per-field */
      // One of the FIVE filters that carry a glyph. `buildings`, because there
      // is no `office` in the set. TRAP T-only-five-filter-chips-carry-an-icon
      icon: 'buildings',
      // OFF until a value is picked: ON with nothing chosen paints the amber
      // "filtering nothing" warning before the reader has touched anything.
      removable: true,
      select: 'multiple',
      options: customers.map((value) => ({ value, label: value })),
    },
    {
      id: 'region',
      label: 'Region',
      icon: 'globe',
      // Four values, all on screen. No conditions either.
      removable: true,
      select: 'multiple',
      // The VALUE is what the record holds; the label is only what a reader sees.
      options: regions.map((value) => ({ value, label: REGION_LABELS[value] ?? value })),
    },
    {
      id: 'dateRange',
      /* "Date" — the RECORD'S time, whatever this dataset calls it. It used to
         be "Created date", because it could only filter a column named
         `created`; a view-scope filter must work over any dataset.
         TRAP T-a-record-has-a-time-of-its-own */
      label: 'Date',
      icon: 'calendar',
      kind: 'date',
      /* SINGLE by default, like every other calendar. The reader flips the
         Range switch when they want a span; opening in range mode makes the
         common case — one day — take two clicks and a mode change. */
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
