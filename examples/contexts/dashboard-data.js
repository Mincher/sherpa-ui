/**
 * The dashboard's records, and the orders its charts share.
 *
 * Records are the data; every total is DERIVED — each chart declares what it
 * needs in dashboard.html — so one filter reaches every chart.
 *
 * Map:
 * - customerOrgs — The customers — organisations, not people.
 * - alertRow — The alert at one index — the server's live feed makes more the same way.
 * - alerts — One alert per row — the grain the charts summarise.
 * - alertStore — the alerts, app-level — its schema says what each field may hold
 */
// The DOM-FREE entry, so the examples server can make live alerts from it too.
import { ArrayStore, max, min, number, oneOf, rules } from '../../dist/data.js';

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

/** One alert per row — the grain the charts summarise. Deterministic, not
 *  random, so the numbers can be compared against a screenshot. */
export function alerts(count = 1284) {
  return Array.from({ length: count }, (_, i) => alertRow(i));
}

/** The alert at one index — the server's live feed makes more the same way.
 *  TRAP T-a-live-feed-goes-into-the-store */
export function alertRow(i) {
  return {
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
  };
}

/**
 * WHAT AN ALERT MAY HOLD, each set in the order its charts keep — so a category
 * keeps its colour, and a quiet day keeps its point. The same lists check a
 * write and fill a filter. TRAP T-a-category-keeps-its-colour
 * TRAP T-the-data-says-what-a-field-may-hold
 */
const alertSchema = rules({
  category: oneOf(CATEGORIES),
  os: oneOf(OSES),
  region: oneOf(REGIONS),
  customer: oneOf(customerOrgs),
  severity: oneOf(SEVERITIES),
  day: oneOf(DAYS),
  storage: [number(), min(0), max(100)],
});

/** The alerts — app-level, as long as the tab. */
export const alertStore = new ArrayStore(alerts(), { key: 'id', schema: alertSchema });
