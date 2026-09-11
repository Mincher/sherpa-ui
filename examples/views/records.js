/**
 * examples/views/records.js — the records / CRUD-table view's logic.
 *
 * Exported as init(root): builds 100 customers, populates the grid / quick-filter
 * toolbar / pagination / dialog that live inside `root`, and wires filter/sort/
 * page + the add-customer dialog → toast flow. The shared nav/header live once in
 * index.html.
 *
 * 100 rows over 10 pages is the point: it exercises pagination, the grid's own
 * internal scroll inside a fixed-height panel, and grouping across a row count
 * that no longer fits on one screen.
 */
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

  /* ── Live view state: filtered → sorted → paged ──────────────────── */
  let activeFilters = [];         // status ids from the quick-filter TOGGLE chips
  let filterValues = {};          // { plan: ['pro'], owner: ['me'] } from the MENU chips
  let sort = { field: null, direction: 'asc' };
  let group = null;               // the column the toolbar's Group chip picked
  let page = 1;
  let pageSize = 10;

  /* Which grid column each value-menu chip constrains. A chip's id names the
     COLUMN, and its menu holds the values — matching the ids against `row.status`
     (as this used to) meant a Plan pick matched nothing and emptied the grid.
     `owner` now has a real column, so it filters rather than sitting inert. */
  const valueChipColumn = { plan: 'plan', owner: 'owner', region: 'region', tier: 'tier' };

  const applyFilter = (rows) => {
    let out = activeFilters.length
      ? rows.filter((r) => activeFilters.includes(r.status))
      : rows;
    // Each menu chip narrows by its own column: a row must match ONE of the
    // picked values (OR within a chip), and every active chip (AND across chips).
    for (const [id, picked] of Object.entries(filterValues)) {
      const field = valueChipColumn[id];
      // `owner` has no column in this demo's data, so it is deliberately inert
      // rather than silently filtering everything away.
      if (!field || !picked.length) continue;
      const wanted = new Set(picked.map((v) => String(v).toLowerCase()));
      out = out.filter((r) => wanted.has(String(r[field]).toLowerCase()));
    }
    return out;
  };

  /* Numbers compare as numbers, everything else as text — the same rule the grid
     uses internally, so the toolbar's Sort chip and the grid's own header sort
     can never disagree about the order. */
  const compare = (a, b, field, dir) => {
    const av = a[field];
    const bv = b[field];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  };

  /* Grouping runs BEFORE the sort key, so rows of the same group stay together
     and the sort orders them WITHIN their group. */
  const applySort = (rows) => {
    if (!sort.field && !group) return rows;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) =>
      (group ? compare(a, b, group, 1) : 0) ||
      (sort.field ? compare(a, b, sort.field, dir) : 0));
  };

  const currentRows = () => applySort(applyFilter(customers));

  const render = () => {
    const rows = currentRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const slice = rows.slice(start, start + pageSize);
    /* Rows go in RAW. `spend` stays a number so both sorts — this view's Sort
       chip and the grid's own internal #sortRows — compare it numerically. A
       pre-formatted '$1,234' would send the grid's header sort back to a lexical
       compare, putting $90 after $1,000. The number columns are right-aligned
       mono via `type: 'number'`, which is the alignment the money needed. */
    grid.populate({ columns, rows: slice });
    pager.dataset.totalPages = String(totalPages);
    pager.dataset.page = String(page);
  };

  /* ── Cache view refs (scoped to root) ────────────────────────────── */
  const grid      = root.querySelector('#grid');
  const qft       = root.querySelector('#qft');
  const pager     = root.querySelector('#pager');
  const dialog    = root.querySelector('#dialog');
  const planGroup = root.querySelector('#f-plan');
  const toasts    = root.querySelector('#toasts');

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
  qft.populate([
    { id: 'active',    label: 'Active',    type: 'data' },
    { id: 'trial',     label: 'Trial',     type: 'data' },
    { id: 'suspended', label: 'Suspended', type: 'data' },
    { id: 'churned',   label: 'Churned',   type: 'data' },
    // MULTI-select: any number of plans / regions / tiers. Picking exactly one
    // reads back as "Plan: Pro" on the chip; two or more show the count badge.
    { id: 'plan', label: 'Plan', type: 'data', icon: 'fa-solid fa-tag',
      select: 'multiple', options: asOptions('plan') },
    { id: 'region', label: 'Region', type: 'data', icon: 'fa-solid fa-globe',
      select: 'multiple', options: asOptions('region') },
    { id: 'tier', label: 'Tier', type: 'data', icon: 'fa-solid fa-award',
      select: 'multiple', options: asOptions('tier') },
    // SINGLE-select: one owner at a time.
    { id: 'owner', label: 'Owner', type: 'data', icon: 'fa-solid fa-user',
      select: 'single', options: asOptions('owner') },
  ]);

  /* The leading Group and Sort chips — how the grid is ARRANGED, at the start of
     the toolbar (Figma Filter Toolbar Type=data opens with these two, then a
     divider, then the filter chips). Their own events, so a group/sort pick is
     never mistaken for a filter change. */
  const organiseCols = columns.map((c) => ({ field: c.field, label: c.header }));
  qft.organise({ group: organiseCols, sort: organiseCols });

  /* Plan radio group in the dialog. */
  planGroup.populate(plans.map((p) => ({ value: p.toLowerCase(), label: p })));

  render();

  /* ── Wiring ──────────────────────────────────────────────────────── */

  // Sort: re-sort + re-populate.
  grid.addEventListener('sort-change', (e) => {
    sort = { field: e.detail.field, direction: e.detail.direction };
    render();
  });

  // Quick filters: filter the rows, reset to page 1.
  qft.addEventListener('quick-filter-change', (e) => {
    activeFilters = e.detail.active || [];
    filterValues = e.detail.values || {};
    page = 1;
    render();
  });

  // The toolbar's Group chip: cluster rows by a column. The GRID does the
  // grouping — data-group-field makes it drop that column and draw a collapsible
  // group row per value, which is what the design calls for.
  qft.addEventListener('group-change', (e) => {
    group = e.detail.field;
    if (group) grid.dataset.groupField = group;
    else delete grid.dataset.groupField;
    page = 1;
    render();
  });

  // The toolbar's Sort chip. Same event the grid's own header sort fires, so both
  // routes land on one piece of state and cannot disagree.
  qft.addEventListener('sort-change', (e) => {
    sort = { field: e.detail.field, direction: e.detail.direction };
    page = 1;
    render();
  });

  // Pagination: swap the visible slice.
  pager.addEventListener('page-change', (e) => {
    page = e.detail.page;
    render();
  });
  pager.addEventListener('page-size-change', (e) => {
    pageSize = e.detail.pageSize;
    page = 1;
    render();
  });

  // Dialog open/close + save → toast.
  root.querySelector('#add-btn').addEventListener('button-click', () => {
    dialog.dataset.heading = 'Add customer';
    // sherpa-dialog's method is show(), not the native showModal() — the
    // component owns the modality and the `open` attribute. Calling showModal()
    // threw "dialog.showModal is not a function" and the dialog never opened.
    dialog.show();
  });
  root.querySelector('#cancel-btn').addEventListener('button-click', () => dialog.close());

  root.querySelector('#save-btn').addEventListener('button-click', () => {
    const name = root.querySelector('#f-name').value || 'New customer';
    dialog.close();
    const toast = document.createElement('sherpa-toast');
    toast.dataset.status = 'success';
    toast.dataset.heading = `${name} saved`;
    toast.dataset.value = 'The customer record was created.';
    toast.dataset.duration = '5000';
    toast.addEventListener('toast-dismiss', () => toast.remove());
    toasts.appendChild(toast);
  });
}
