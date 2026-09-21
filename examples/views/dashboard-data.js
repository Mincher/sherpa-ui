/**
 * The dashboard's RECORDS, and the aggregations each chart wants.
 *
 * A dashboard shows totals, not rows — eight bars, five slices, a gauge. The
 * temptation is to hold those totals as data, which is what this view did: a
 * `barData` array of eight pre-summed numbers that no filter could touch.
 *
 * So the records are the data and the totals are DERIVED. One filter then
 * reaches every chart, because every chart is a different summary of the same
 * rows — which is the capability the whole data layer exists for.
 *
 * Each aggregate is a plain function from rows to a chart's payload, used as a
 * bind's `as` adapter. Nothing here knows about a source or a component.
 */

const CATEGORIES = ['Disk', 'CPU', 'Memory', 'Network', 'Security', 'Services', 'Backup', 'Antivirus'];
const OSES = ['Windows 11', 'Windows 10', 'macOS', 'Linux', 'Other'];
const REGIONS = ['EMEA', 'AMER', 'APAC', 'LATAM'];

/**
 * The CUSTOMERS — organisations, not people. Each alert is about a device, and
 * a device belongs to one.
 *
 * Exported because the app header's Customer chip narrows by this field, and a
 * chip's options are a fact about the records rather than about the chip —
 * TRAP T-a-chip-filters-the-values-the-data-has.
 */
export const customerOrgs = [
  'Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Adventure Works',
  'Litware', 'Proseware', 'Wingtip Toys',
];
const SEVERITIES = ['critical', 'warning', 'info'];

/**
 * One ALERT per row — the grain the charts summarise.
 *
 * Deterministic rather than random: a dashboard whose numbers move on every
 * reload is impossible to compare against a screenshot, and a demo that cannot
 * be compared is one nobody notices breaking.
 */
export function alerts(count = 1284) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    // Weighted so the bar chart has a shape rather than eight equal bars —
    // squaring the index crowds the early categories.
    category: CATEGORIES[Math.floor(((i * i) % 64) / 8)],
    os: OSES[i % 5 === 0 ? 4 : Math.floor((i % 17) / 4)],
    region: REGIONS[i % 4],
    // 8 organisations against 4 regions — coprime strides, so the two columns
    // do not march in lockstep.
    customer: customerOrgs[i % 8],
    severity: SEVERITIES[i % 3],
    // 0–100, for the gauge's "storage used".
    storage: (i * 37) % 101,
    day: 1 + (i % 8),
  }));
}

/** Count rows per value of `field`, biggest first — a bar chart or a donut. */
/* ── The ORDERS the charts share ────────────────────────────────────────
 *
 * Not decoration. A category that has no declared order falls out in count
 * order, so it changes colour and position when only its RANKING moved — and
 * two charts of the same field disagree about which colour a category is.
 * Declared here, beside the data, because the order is a fact about the
 * records rather than about any one chart.
 * TRAP T-a-category-keeps-its-colour.
 */
export const CATEGORY_ORDER = CATEGORIES;
export const OS_ORDER = OSES;

/** The x-axis of the line chart — every day gets a point, quiet or not. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * The storage histogram's band edges: five bands, 0..100.
 *
 * `bandBy` reads these as boundaries, and the LAST band owns its top edge — so
 * a disk at exactly 100% lands in `81-100` by rule. The hand-rolled version
 * got there by accident, via a `Math.min(4, …)` clamp.
 */
export const STORAGE_EDGES = [0, 20, 40, 60, 80, 100];
