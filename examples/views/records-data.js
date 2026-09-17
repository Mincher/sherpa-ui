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
 * means. A real product would put a REST or LocalStore here instead; the shape
 * and the lifetime are the same.
 */
import { ArrayStore, rules, required, number, email } from '../../dist/index.js';

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
const regions = ['EMEA','AMER','APAC','LATAM'];
const owners  = ['Unassigned','Ravi Menon','Dana Whitlock','Pierre Sadler'];
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
 */
export const customerStore = new ArrayStore(customers, {
  key: 'email',
  schema: customerSchema,
});
