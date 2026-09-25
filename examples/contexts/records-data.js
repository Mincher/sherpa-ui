/**
 * records-data.js — the customer records, and the ONE store that holds them.
 * A STORE is app-level (a module `const`, alive as long as the tab); a
 * DataSource is Context-level.
 */
import { IdbStore, ArrayStore, rules, required, number, email } from '../../dist/index.js';

/* ── Data: 100 customers ──────────────────────────────────────────── */
const first = ['Jane','Marcus','Aisha','Diego','Nina','Omar','Priya','Liam','Sofia','Ethan',
               'Yuki','Carlos','Freya','Noah','Zara','Isaac','Maya','Leon','Amara','Felix',
               'Ingrid','Rashid','Elena','Tomas','Hana','Bruno','Lila','Kofi','Greta','Sven',
               'Anika','Mateo','Chloe','Dmitri','Esme','Farid','Gwen','Hugo','Iris','Jonas',
               'Kira','Lucas','Mira','Nadia','Oscar','Paula','Quinn','Rosa','Samir','Tara'];
const last  = ['Okafor','Reyes','Khan','Moreau','Berg','Haddad','Nair','Walsh','Costa','Blum',
               'Tanaka','Vega','Lund','Schmidt','Ali','Cohen','Iyer','Petit','Diallo','Braun',
               'Solberg','Aziz','Popov','Novak','Sato','Ferrari','Roy','Mensah','Meyer','Dahl',
               'Bauer','Silva','Duval','Ivanov','Ortiz','Rahman','Price','Keller','Nilsen','Weber',
               'Sharma','Jensen','Rossi','Farah','Lindqvist','Marek','Osei','Dubois','Yilmaz','Kaur'];
/** Exported: the Add dialog offers these, and a second copy would offer a plan no record can have. */
export const plans = ['Free','Starter','Pro','Enterprise'];
/** Exported: a chart's category ORDER must be these values, so a colour stays
    put when a filter removes the category above it. */
export const states = ['active','trial','suspended','churned'];
/** Exported: the header's Region chip filters these records, so its options must BE these values. */
export const regions = ['EMEA','AMER','APAC','LATAM'];
/** Who owns each account, internally — a member of staff, not the customer.
    The last four each hold part of "Unassigned", so a search for it has near-misses. */
const owners  = ['Unassigned','Ravi Menon','Dana Whitlock','Pierre Sadler',
                 'Una Cassidy','Nassim Idris','Signe Holm','Ned Carver'];

/** Organisations, not people — a record is a PERSON in one. The Customer chip narrows by it. */
export const customerOrgs = [
  'Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Adventure Works',
  'Litware', 'Proseware', 'Wingtip Toys',
];
const tiers   = ['Bronze','Silver','Gold','Platinum'];

/* A tiny deterministic PRNG. SEEDED, so the grid, the chip counts and any
   screenshot are identical on every reload. */
let seed = 20260911;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

/**
 * The seed records. EXPORTED as well as stored, because the chips build their
 * option lists synchronously — before any load could resolve. Read-only by
 * convention: an edit goes through the STORE.
 */
export const customers = Array.from({ length: 100 }, (_, i) => {
  const f = pick(first);
  const l = pick(last);
  const status = pick(states);
  const plan = pick(plans);
  const created = new Date(2024, Math.floor(rnd() * 12), Math.floor(rnd() * 27) + 1);
  // Last seen always TRAILS creation, so the two date columns never contradict.
  const seen = new Date(created.getTime() + (Math.floor(rnd() * 300) + 1) * 86400000);
  return {
    name: `${f} ${l}`,
    // TRAP T-a-chip-filters-the-values-the-data-has.
    customer: pick(customerOrgs),
    // The index keeps the address unique even when the same name is drawn twice.
    email: `${f.toLowerCase()}.${l.toLowerCase()}${i}@example.com`,
    status,
    plan,
    region: pick(regions),
    tier: pick(tiers),
    owner: pick(owners),
    // Real NUMBERS, not pre-formatted strings: a '$1,234' string sorts as text,
    // putting $90 after $1,000.
    seats: 1 + Math.floor(rnd() * 240),
    spend: 120 + Math.floor(rnd() * 9880),
    openTickets: Math.floor(rnd() * 9),
    health: 40 + Math.floor(rnd() * 61),
    created: created.toISOString().slice(0, 10),
    lastSeen: seen.toISOString().slice(0, 10),
  };
});

/** Here, not in the Context: a COLUMN describes a record, and a second Context wants the same. */
export const columns = [
  { field: 'name',        header: 'Name',      sortable: true },
  { field: 'email',       header: 'Email',     sortable: true },
  { field: 'customer',    header: 'Customer',  sortable: true },
  { field: 'status',      header: 'Status',    sortable: true },
  { field: 'plan',        header: 'Plan',      sortable: true },
  { field: 'tier',        header: 'Tier',      sortable: true },
  { field: 'region',      header: 'Region',    sortable: true },
  { field: 'owner',       header: 'Owner',     sortable: true },
  { field: 'seats',       header: 'Seats',     sortable: true, type: 'number' },
  { field: 'spend',       header: 'Spend',     sortable: true, type: 'number' },
  { field: 'openTickets', header: 'Tickets',   sortable: true, type: 'number' },
  { field: 'health',      header: 'Health',    sortable: true, type: 'number' },
  { field: 'created',     header: 'Created',   sortable: true, type: 'date' },
  { field: 'lastSeen',    header: 'Last seen', sortable: true, type: 'date' },
];
/**
 * On the STORE, not the form — a form is not the only way a record arrives. It
 * runs on READS too, so a malformed row is dropped and REPORTED
 * (`LoadResult.dropped` / `.issues`).
 */
export const customerSchema = rules({
  name: required(),
  // The KEY. A blank one collides with the next blank one.
  email: [required(), email()],
  /* EVERY record belongs to an organisation. Not required here until
     2026-09-22, so the Add dialog — which had no Customer field — saved
     records with none, and the Customer chip could never find them: a chip
     offers only the values the data carries.
     TRAP T-a-chip-filters-the-values-the-data-has */
  customer: required(),
  seats: number(),
  health: number(),
});

/**
 * The one store every Context showing these records shares. Keyed by EMAIL.
 *
 * INDEXED on the columns the toolbar chips filter by. An index only changes how
 * much is read (`T-idb-index-narrows-it-never-answers-it`), so adding or
 * removing one is safe — but **bump `version` whenever this list changes**:
 * IndexedDB builds indexes only during an upgrade, so a new name on an old
 * version is silently absent (`T-idb-open-is-a-handshake-not-a-call`).
 *
 * The FALLBACK is real: a private window or blocked site data gets the
 * in-memory store, so the app works and simply forgets on reload. `IdbStore`
 * REJECTS rather than reading as empty, so this choice is made HERE
 * (`T-idb-is-the-only-real-local-store`).
 */
export const customerStore = IdbStore.available
  ? new IdbStore({
    name: 'customers',
    database: 'sherpa-examples',
    key: 'email',
    schema: customerSchema,
    indexes: ['status', 'plan', 'tier', 'region', 'owner'],
    version: 1,
  })
  : new ArrayStore(customers, { key: 'email', schema: customerSchema });

/**
 * BUMP when `customers` changes, or a browser that already holds the rows keeps
 * the old ones. A re-seed overwrites the seed rows; rows a person added stay.
 */
const SEED = 2;
const SEED_KEY = 'sherpa-examples:customers-seed';

/** Only a STORED copy can be stale — the ArrayStore is built from `customers` on every load. */
function seedIsStale() {
  if (!(customerStore instanceof IdbStore)) return false;
  try {
    return localStorage.getItem(SEED_KEY) !== String(SEED);
  } catch {
    return false; // TRAP T-storage-access-throws — no key to keep, so never re-seed on every load
  }
}

/**
 * Seed the demo records on a first run, or when `SEED` moves — re-seeding on
 * every load would erase the very edit that is meant to survive a reload.
 *
 * `putAll` rather than 100 `insert()` calls: one transaction and ONE `change`
 * event (`T-idb-bulk-is-one-transaction`).
 *
 * AWAITED BY THE CONTEXTS, not fired and forgotten — a grid that populates before
 * the seed lands draws an empty table and never hears about it.
 */
export const customersReady = (async () => {
  try {
    if (await customerStore.totalCount() === 0 || seedIsStale()) {
      await customerStore.putAll(customers);
      localStorage.setItem(SEED_KEY, String(SEED));
    }
  } catch {
    // Storage blocked mid-session, or a version clash with another tab. An
    // IdbStore that cannot seed shows an empty grid, which is honest.
  }
})();
