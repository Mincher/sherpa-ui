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
export function countBy(rows, field, order) {
  const counts = new Map();
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);

  // A FIXED order when one is given, so a category keeps its colour as the
  // filter changes. Sorting by count would make "Disk" blue one moment and
  // green the next, which reads as the data changing when only its rank did.
  const keys = order ?? [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
  return keys
    .filter((k) => counts.has(k))
    .map((label, i) => ({ label, value: counts.get(label), colorIndex: (order ? order.indexOf(label) : i) + 1 }));
}

/** Rows per day, as a line series. */
export function seriesByDay(rows, name, colorIndex = 1) {
  const days = [1, 2, 3, 4, 5, 6, 7, 8];
  const counts = new Map(days.map((d) => [d, 0]));
  for (const row of rows) counts.set(row.day, (counts.get(row.day) ?? 0) + 1);
  return { name, colorIndex, values: days.map((d) => counts.get(d)) };
}

/** The mean of `field`, 0–100 — what the gauge reads. */
export function meanOf(rows, field) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0) / rows.length);
}

export const CATEGORY_ORDER = CATEGORIES;
export const OS_ORDER = OSES;
