/**
 * records-data.js — the customer records, and the ONE store that holds them.
 *
 * APP LEVEL, not view level, and that is the whole point of this file.
 *
 * The store used to be built inside `records.js`'s `init()`, so it died with
 * the view. Measured before the move: adding a customer took the grid from 4
 * pages to 5, and navigating away and back put it at 4 again — the record was
 * gone, along with every other edit.
 *
 * THE RULE: **a STORE is app-level, a SOURCE is view-level.** A store holds
 * records, which outlive any one screen and are shared by every screen that
 * shows them. A DataSource holds one QUERY over them — this view's filter,
 * sort and page — which is exactly as long-lived as the view.
 *
 * A module-level `const` is the right lifetime for that: it is created once on
 * first import and lives as long as the tab, which is what "the app's records"
 * means.
 *
 * THE STORE HERE IS AN `IdbStore` — records in IndexedDB, so they survive a
 * RELOAD and not merely a navigation. That is the difference this file was
 * already half-way to making: moving the store out of `init()` stopped a
 * record dying when the view did; putting it in IndexedDB stops it dying when
 * the TAB does. Everything else is unchanged, which is the point of the Store
 * interface — the two consumers (`records.js` and `dashboard.js`) each pass it
 * to a `DataSource` and neither knows or cares what backs it.
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
/**
 * The plans a customer can be on.
 *
 * Exported because the Add dialog offers them: the list of plans that EXIST is
 * a fact about the records, not about the form, and a form with its own copy
 * would offer a plan no record could have.
 */
export const plans = ['Free','Starter','Pro','Enterprise'];
const states  = ['active','trial','suspended','churned'];
/**
 * The regions a customer can be in.
 *
 * Exported for the SAME reason `plans` is: the app header's Region chip filters
 * these records, so its options have to BE these values. It kept its own copy —
 * three lowercase names against four uppercase ones — so picking EMEA in the
 * header filtered to nothing and the grid did not move.
 */
export const regions = ['EMEA','AMER','APAC','LATAM'];
/** Who owns each account, internally — a member of staff, not the customer. */
const owners  = ['Unassigned','Ravi Menon','Dana Whitlock','Pierre Sadler'];

/**
 * The CUSTOMERS — organisations, not people.
 *
 * "Customer" is this product's word for an organisation. Each record is a
 * PERSON (a name and an email) who belongs to one, so the organisation is its
 * own field rather than the record's name. The app header's Customer chip
 * narrows by it.
 *
 * Exported for the same reason `plans` and `regions` are: a chip's options are
 * a fact about the records, not about the chip. The header used to carry its
 * own five names against records that had no such field at all.
 */
export const customerOrgs = [
  'Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Adventure Works',
  'Litware', 'Proseware', 'Wingtip Toys',
];
const tiers   = ['Bronze','Silver','Gold','Platinum'];

/* A tiny deterministic PRNG. The demo data has to look unpatterned — with
   plain `i % n` strides every column marched in lockstep, so row 1 and row 5
   were the same customer in all but name. It stays SEEDED so the grid, the
   chip counts and any screenshot are identical on every reload. */
let seed = 20260911;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

/**
 * The seed records.
 *
 * EXPORTED as well as stored, because the filter chips need the distinct values
 * of a column to build their option lists, and they build them synchronously
 * while the header config is assembled — before any load could resolve.
 *
 * Read-only by convention: the STORE is what holds the app's records, and an
 * edit goes through it. This is the list it started from, which is what a
 * chip's options are really about — "these are the regions that exist", not
 * "these are the regions in the current page".
 */
export const customers = Array.from({ length: 100 }, (_, i) => {
  const f = pick(first);
  const l = pick(last);
  const status = pick(states);
  const plan = pick(plans);
  const created = new Date(2024, Math.floor(rnd() * 12), Math.floor(rnd() * 27) + 1);
  // Last seen always TRAILS creation, so the two date columns never contradict
  // each other (a customer cannot be seen before the account existed).
  const seen = new Date(created.getTime() + (Math.floor(rnd() * 300) + 1) * 86400000);
  return {
    name: `${f} ${l}`,
    // The ORGANISATION this person belongs to — "Customer" in this product's
    // vocabulary. TRAP T-a-chip-filters-the-values-the-data-has.
    customer: pick(customerOrgs),
    // The index keeps the address unique even when the same name is drawn twice.
    email: `${f.toLowerCase()}.${l.toLowerCase()}${i}@example.com`,
    status,
    plan,
    region: pick(regions),
    tier: pick(tiers),
    owner: pick(owners),
    // Real NUMBERS, not pre-formatted strings: the grid right-aligns
    // type: 'number' cells in mono and sorts them numerically. A '$1,234'
    // string would sort as text, putting $90 after $1,000.
    seats: 1 + Math.floor(rnd() * 240),
    spend: 120 + Math.floor(rnd() * 9880),
    openTickets: Math.floor(rnd() * 9),
    health: 40 + Math.floor(rnd() * 61),
    created: created.toISOString().slice(0, 10),
    lastSeen: seen.toISOString().slice(0, 10),
  };
});

/**
 * The grid's columns.
 *
 * Here rather than in the view because a COLUMN describes a record — its field,
 * its label, whether it sorts, and the `type` that decides how it filters. A
 * second view of these records wants the same descriptions, and two copies
 * would disagree the first time a field was added.
 */
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
 * What a customer record MUST look like.
 *
 * On the STORE rather than on the form, because a form is not the only way a
 * record arrives: the Add dialog, a paste, a REST response and a script all
 * reach the same records, and a rule enforced in one screen is not a rule.
 *
 * It runs on READS as well as writes (step V7), so a malformed row from a
 * backend is dropped and REPORTED — `LoadResult.dropped` and `.issues` — rather
 * than reaching a grid that has no idea what to draw. The add flow still
 * validates in the dialog, because that is where a person can be told what is
 * wrong while they can still fix it; this is the line nothing crosses.
 */
export const customerSchema = rules({
  name: required(),
  // The KEY. A blank one collides with the next blank one, which is why the add
  // flow fills one in rather than leaving it empty.
  email: [required(), email()],
  seats: number(),
  health: number(),
});

/**
 * The one store every view of these records shares.
 *
 * Keyed by EMAIL because that is what identifies a customer here — an inserted
 * row with a blank email would collide with the next blank one, which is why
 * the add flow fills one in.
 *
 * INDEXED on the columns the toolbar chips filter by. An index does not change
 * an answer, only how much is read to reach it
 * (`T-idb-index-narrows-it-never-answers-it`) — so adding one is safe and
 * removing one is safe. **`version` must be bumped whenever this list changes**:
 * IndexedDB builds indexes only during an upgrade, so a new name on an old
 * version is silently absent and its filter quietly reads the whole store
 * (`T-idb-open-is-a-handshake-not-a-call`).
 *
 * The FALLBACK is deliberate and is not a paper one: a private window, blocked
 * site data, or a browser with IndexedDB disabled gets the in-memory store it
 * always had. The app works; it simply forgets on reload. `IdbStore` REJECTS
 * rather than reading as empty precisely so this choice is made HERE, in the
 * open, instead of the app silently writing records into nothing
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
 * Put the demo records in, but ONLY on a first run.
 *
 * The whole demonstration is that an edit survives a reload, so re-seeding on
 * every load would erase exactly the thing being shown. `totalCount()` asking
 * for nothing is the cheapest way to tell an empty store from a used one.
 *
 * `putAll` rather than 100 `insert()` calls: one transaction and ONE `change`
 * event, where the loop would be 100 of each and would reload every bound
 * component 100 times (`T-idb-bulk-is-one-transaction`).
 *
 * AWAITED BY THE VIEWS, not fired and forgotten — a grid that populates before
 * the seed lands draws an empty table and never hears about it. Both views
 * `await customersReady` before their first load.
 */
export const customersReady = (async () => {
  try {
    if (await customerStore.totalCount() === 0) {
      await customerStore.putAll(customers);
    }
  } catch {
    // Storage blocked mid-session, or a version clash with another tab. The
    // ArrayStore fallback above never reaches here; an IdbStore that cannot
    // seed shows an empty grid, which is honest — it has no records.
  }
})();
