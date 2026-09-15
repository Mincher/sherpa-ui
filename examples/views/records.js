/**
 * examples/views/records.js — the records / CRUD-table view's logic.
 *
 * Exported as init(root): builds 100 customers, puts them in a store, and binds
 * the grid / quick-filter toolbar / pagination inside `root` to ONE DataSource.
 * The shared nav/header live once in index.html.
 *
 * This view is the data layer's proof. It used to hand-wire the whole pipeline —
 * applyFilter, a compare function, applySort, currentRows, render — plus six
 * event handlers, INCLUDING two rival `sort-change` listeners whose own comment
 * admitted they were being held together by hand. All of that is now three
 * bind() calls: the grid's column header and the toolbar's Sort chip read and
 * write one shared value, so they cannot disagree.
 *
 * 100 rows over 10 pages is the point: it exercises pagination, the grid's own
 * internal scroll inside a fixed-height panel, and grouping across a row count
 * that no longer fits on one screen.
 */
import { ArrayStore, DataSource, SherpaToast } from '../../dist/index.js';

export async function init(root) {
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
  const plans   = ['Free','Starter','Pro','Enterprise'];
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

  const customers = Array.from({ length: 100 }, (_, i) => {
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

  const columns = [
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

  /* ── The data layer ───────────────────────────────────────────────── */

  /* One store holds the records; ONE source holds how they are being viewed.
     This replaces ~80 lines of hand-wired pipeline — applyFilter, compare,
     applySort, currentRows and render — and, more importantly, replaces the two
     separate `sort-change` handlers this file used to carry. The grid's column
     header and the toolbar's Sort chip now read and write the SAME value, so
     they cannot disagree; the comment that used to sit here admitting they were
     being held together by hand is gone with them. */
  const store = new ArrayStore(customers, { key: 'email' });
  const source = new DataSource({
    store,
    // 25 to match sherpa-pagination's own default — a different number here
    // would silently disagree with the select beside it.
    pageSize: 25,
    searchFields: ['name', 'email', 'owner'],
  });

  /* Columns holding an ISO date — two picks on one of these is a RANGE, where
     two picks on any other column means "either of these values". */
  const dateFields = new Set(['created', 'lastSeen']);

  /* The toolbar reports its chips as `{ values: { field: [picked] } }`, and the
     source turns that into a filter on its own. The one thing it cannot guess is
     that two picks on a DATE column mean a range rather than an either/or, so
     that is translated here and handed over as a real filter. */
  const filterFromChips = (values) => {
    const clauses = [];
    for (const [field, picked] of Object.entries(values ?? {})) {
      if (!picked?.length) continue;
      if (picked.length === 2 && dateFields.has(field)) {
        clauses.push([field, 'between', [...picked].sort()]);
      } else if (picked.length === 1) {
        clauses.push([field, 'eq', picked[0]]);
      } else {
        clauses.push([field, 'in', picked]);
      }
    }
    return clauses.length === 1 ? clauses[0] : clauses.length ? ['and', ...clauses] : undefined;
  };

  /* ── Cache view refs (scoped to root) ────────────────────────────── */
  const grid      = root.querySelector('#grid');
  const qft       = root.querySelector('#qft');
  const pager     = root.querySelector('#pager');
  const dialog    = root.querySelector('#dialog');
  const planGroup = root.querySelector('#f-plan');

  /* Shared nav + header (live in index.html). */
  const header = document.querySelector('sherpa-app-shell sherpa-app-header');

  await Promise.all([
    customElements.whenDefined('sherpa-app-header'),
    customElements.whenDefined('sherpa-data-grid'),
    customElements.whenDefined('sherpa-quick-filter-toolbar'),
    customElements.whenDefined('sherpa-toolbar'),
    customElements.whenDefined('sherpa-pagination'),
    customElements.whenDefined('sherpa-dialog'),
    customElements.whenDefined('sherpa-select-group'),
    customElements.whenDefined('sherpa-toast'),
  ]);

  /* App header breadcrumb. */
  header?.populate({
    breadcrumb: [
      { label: 'Home', href: '#' },
      { label: 'Workspace', href: '#' },
      { label: 'Customers' },
    ],
    // The header's toolbar is the VIEW-level one (data-type="view" in
    // index.html), so its chips are SAVED VIEWS, not the grid's column filters.
    // A view is a whole saved arrangement — which is why this bar, and not the
    // data bar below it, is the one that carries Save / favourite.
    filters: [
      {
        id: 'view',
        label: 'All customers',
        // A SELECTOR, not a toggle: you are always in some view.
        persistent: true,
        icon: 'fa-solid fa-table-list',
        active: true,
        select: 'single',
        options: [
          { value: 'all', label: 'All customers', selected: true },
          { value: 'mine', label: 'My accounts' },
          { value: 'risk', label: 'At risk' },
          { value: 'renewals', label: 'Renewals this quarter' },
        ],
      },
    ],
  });
  header?.setAttribute('data-heading', 'Customers');
  header?.setAttribute('data-icon', 'fa-solid fa-users');

  /* Quick-filter chips — status segments with counts, plus two value pickers.
     A chip with `options` shows a caret and opens a menu of real checkbox/radio
     rows; a chip without them is a plain on/off toggle. */
  /* No `count` on the toggle chips. A badge there would have to mean "how many
     rows match", which a real app with a server-side query does not know when
     the bar is built — so the toolbar no longer takes one. The badge is reserved
     for "how many VALUES are picked", which each menu chip sets itself. */
  const valuesOf = (field) => [...new Set(customers.map((c) => c[field]))].sort();
  const asOptions = (field) =>
    valuesOf(field).map((v) => ({ value: String(v).toLowerCase(), label: String(v) }));
  /* `removable: true` on the menu chips — the DATA bar is the user's own to
     arrange, so each of these offers "Remove filter" at the foot of its menu and
     returns to the Add list. It is opt-in: the view SELECTOR in the header does
     not take it, because "no view" is not a state the page can be in.

     `commit: true` on TWO of them — Owner and Created. Chips AUTO-APPLY by
     default: a tick changes the filter there and then, with no footer and no
     second click, which is what a filter chip should feel like. Committing is
     the opt-out, for a field whose query is genuinely expensive — a person
     lookup or a date scan — where applying per tick would fire three or four
     requests for a selection the user had not finished building. These two are
     here so both behaviours are visible side by side in one bar. */
  qft.populate([
    { id: 'active',    label: 'Active',    type: 'data' },
    { id: 'trial',     label: 'Trial',     type: 'data' },
    { id: 'suspended', label: 'Suspended', type: 'data' },
    { id: 'churned',   label: 'Churned',   type: 'data' },
    // MULTI-select: any number of plans / regions / tiers. Picking exactly one
    // reads back as "Plan: Pro" on the chip; two or more show the count badge.
    { id: 'plan', label: 'Plan', type: 'data', icon: 'fa-solid fa-tag',
      select: 'multiple', removable: true, options: asOptions('plan') },
    { id: 'region', label: 'Region', type: 'data', icon: 'fa-solid fa-globe',
      select: 'multiple', removable: true, options: asOptions('region') },
    { id: 'tier', label: 'Tier', type: 'data', icon: 'fa-solid fa-award',
      select: 'multiple', removable: true, options: asOptions('tier') },
    // SINGLE-select: one owner at a time. COMMITTING — a person lookup stands in
    // for the expensive server-side query, so its rows are a draft behind an
    // Apply/Cancel footer and Cancel throws them away.
    { id: 'owner', label: 'Owner', type: 'data', icon: 'fa-solid fa-user',
      select: 'single', removable: true, commit: true, options: asOptions('owner') },
    // A DATE chip: its menu is a calendar rather than a list of values, and its
    // label carries the chosen day. `kind` is what picks the menu's content —
    // date-range and time will be values here, not new chip types.
    // Also COMMITTING: a date scan is the other expensive case, and its footer
    // shows the full four-button row (Today · Remove · Cancel · Apply).
    { id: 'created', label: 'Created', type: 'data', kind: 'date',
      removable: true, commit: true, icon: 'fa-solid fa-calendar' },
  ]);

  /* What the ADD chip offers — filters a user can put on the bar OVER AND ABOVE
     the defaults above. That is what the Add control is for in the design: its
     caret opens this list, and picking one stamps the chip into the run and
     drops it from the menu (a filter already on the bar is not one you can add
     again).

     These are the columns the default set leaves out, so the bar starts with the
     common ones and the rest are a click away rather than crowding it. */
  qft.available([
    { id: 'seats', label: 'Seats', type: 'data', icon: 'fa-solid fa-chair',
      select: 'multiple', options: asOptions('seats').slice(0, 8) },
    { id: 'health', label: 'Health', type: 'data', icon: 'fa-solid fa-heart-pulse',
      select: 'multiple', options: asOptions('health') },
    { id: 'openTickets', label: 'Open tickets', type: 'data', icon: 'fa-solid fa-ticket',
      select: 'multiple', options: asOptions('openTickets').slice(0, 8) },
  ]);

  /* The leading Group and Sort chips — how the grid is ARRANGED, at the start of
     the toolbar (Figma Filter Toolbar Type=data opens with these two, then a
     divider, then the filter chips). Their own events, so a group/sort pick is
     never mistaken for a filter change. */
  const organiseCols = columns.map((c) => ({ field: c.field, label: c.header }));
  qft.organise({ group: organiseCols, sort: organiseCols });

  /* Plan radio group in the dialog. */
  planGroup.populate(plans.map((p) => ({ value: p.toLowerCase(), label: p })));

  /* ── Binding ─────────────────────────────────────────────────────── */

  /* Three components, ONE source. Each one both READS (the source populates it
     and writes the view state onto it as data-*) and WRITES (its own noun-verb
     events steer the source). Neither half needed a new component API — the
     events were already ratified and composed, and data-sort-field /
     data-sort-direction / data-group-field are the standard attribute names.

     What used to be six hand-written handlers below is now three bind() calls,
     and the two rival `sort-change` listeners collapse into one shared value. */

  // The grid takes { columns, rows }, not a bare array — so the shape is adapted
  // AT THE BINDING, which is where the mismatch actually is.
  source.bind(grid, { as: (rows) => ({ columns, rows }) });
  source.bind(pager);

  /* The toolbar steers filters, sort and grouping. Its chips are translated by
     hand because only this view knows that two picks on `created` mean a RANGE;
     everything else the source reads straight off the event. */
  source.bind(qft, { readonly: true });
  qft.addEventListener('quick-filter-change', (e) => {
    source.setFilter(filterFromChips(e.detail.values));
  });
  qft.addEventListener('sort-change', (e) => source.setSort(e.detail.field, e.detail.direction));
  qft.addEventListener('group-change', (e) => source.setGroup(e.detail.field || null));
  // The GRID does the grouping — data-group-field makes it drop that column and
  // draw a collapsible group row per value. The source writes that attribute on
  // every bound component, so the grid gets it without this view wiring it.

  await source.load();

  // Dialog open/close + save → toast.
  root.querySelector('#add-btn').addEventListener('button-click', () => {
    dialog.dataset.heading = 'Add customer';
    // sherpa-dialog's method is show(), not the native showModal() — the
    // component owns the modality and the `open` attribute. Calling showModal()
    // threw "dialog.showModal is not a function" and the dialog never opened.
    dialog.show();
  });
  root.querySelector('#cancel-btn').addEventListener('button-click', () => dialog.close());

  root.querySelector('#save-btn').addEventListener('button-click', async () => {
    const name = root.querySelector('#f-name').value || 'New customer';
    const email = root.querySelector('#f-email').value;
    const plan = root.querySelector('#f-plan').value;

    /* This ACTUALLY ADDS THE RECORD now. It used to close the dialog and show a
       success toast having written nothing — the backlog's "Add Customer does
       not add data". The store is the fix, and it is the whole fix: inserting
       announces a change, the source reloads, and every bound component
       re-populates. Where the new row lands against the active sort, whether an
       active filter hides it, and what the page totals become are all the
       source's existing work, not five separate things to remember here. */
    const created = new Date().toISOString().slice(0, 10);
    await store.insert({
      name,
      // The key is the email, so a blank one would collide with the next blank.
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      status: 'trial',
      plan: plan ? plan[0].toUpperCase() + plan.slice(1) : 'Free',
      region: 'EMEA',
      tier: 'Bronze',
      owner: 'Unassigned',
      seats: 1,
      spend: 0,
      openTickets: 0,
      health: 100,
      created,
      lastSeen: created,
    });

    dialog.close();
    // The FACTORY, not a hand-built element: it owns the shared top-right stack
    // (so a second toast pushes the first down rather than covering it), the
    // auto-dismiss timer and the removal. The view used to build the node itself
    // and append it to a hand-made `.toast-region` div — a second stack, in a
    // different corner, that the component knew nothing about.
    SherpaToast.success(`${name} saved`, {
      value: 'The customer record was created.',
    });
  });
}
