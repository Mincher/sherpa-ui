/**
 * The dashboard's records, and the orders its charts share.
 *
 * Records are the data; every total is DERIVED — each chart declares what it
 * needs in dashboard.html — so one filter reaches every chart.
 *
 * Map:
 * - customerOrgs — The customers — organisations, not people.
 * - alerts — One alert per row — the grain the charts summarise.
 * - CATEGORY_ORDER — The orders the charts share.
 * - OS_ORDER — the OS categories in a fixed order, so each keeps its colour
 * - DAY_ORDER — The x-axis of the line chart — every day gets a point, quiet or not.
 * - SEVERITY_ORDER — the severities in a fixed order, so each line keeps its colour
 */

const CATEGORIES = ['Disk', 'CPU', 'Memory', 'Network', 'Security', 'Services', 'Backup', 'Antivirus'];
/* REAL operating systems, and no "Other" among them. A category literally
   NAMED Other reads as a roll-up and is not one — the legend folds its own
   tail past six rows and labels that. Eight here, so it does.
   TRAP T-a-rolled-up-other-is-not-a-category */
const OSES = [
  'Windows 11', 'Windows 10', 'macOS', 'Ubuntu',
  'Fedora', 'ChromeOS', 'Debian', 'FreeBSD',
];
const REGIONS = ['EMEA', 'AMER', 'APAC', 'LATAM'];

/**
 * The customers — organisations, not people.
 *
 * Exported because the app header's Customer chip narrows by this field, and a
 * chip's options are a fact about the records — TRAP
 * T-a-chip-filters-the-values-the-data-has.
 */
export const customerOrgs = [
  'Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Adventure Works',
  'Litware', 'Proseware', 'Wingtip Toys',
];
const SEVERITIES = ['critical', 'warning', 'info'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * One alert per row — the grain the charts summarise. Deterministic, not
 * random, so the numbers can be compared against a screenshot.
 */
export function alerts(count = 1284) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    // Squared index crowds the early categories, so the bar chart has a shape.
    category: CATEGORIES[Math.floor(((i * i) % 64) / 8)],
    /* A long TAIL: the first four hold most of the estate and the rest are a
       handful each, which is what a roll-up is for. */
    os: OSES[i % 23 < 16 ? Math.floor((i % 23) / 4) : 4 + ((i % 23) - 16) % 4],
    region: REGIONS[i % 4],
    // 8 orgs against 4 regions — coprime strides, so the columns do not
    // march in lockstep.
    customer: customerOrgs[i % 8],
    severity: SEVERITIES[i % 3],
    // 0–100, for the gauge's "storage used".
    storage: (i * 37) % 101,
    // 7 days against 3 severities — coprime, so every day sees every one.
    day: DAYS[i % 7],
  }));
}

/**
 * The orders the charts share. Without a declared order a category falls out in
 * count order, so it changes colour when only its ranking moved.
 * TRAP T-a-category-keeps-its-colour.
 */
export const CATEGORY_ORDER = CATEGORIES;
export const OS_ORDER = OSES;

/** The x-axis of the line chart — every day gets a point, quiet or not. */
export const DAY_ORDER = DAYS;

/** the severities in a fixed order, so each line keeps its colour */
export const SEVERITY_ORDER = SEVERITIES;
