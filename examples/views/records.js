/**
 * examples/views/records.js — the records / CRUD-table view's logic.
 *
 * Exported as init(root): builds ~30 customers, populates the grid / quick-filter
 * toolbar / pagination / dialog that live inside `root`, and wires filter/sort/
 * page + the add-customer dialog → toast flow. The shared nav/header live once in
 * index.html. Behaviour is identical to the old standalone records.html.
 */
export async function init(root) {
  /* ── Data: ~30 customers ──────────────────────────────────────────── */
  const first = ['Jane','Marcus','Aisha','Diego','Nina','Omar','Priya','Liam','Sofia','Ethan',
                 'Yuki','Carlos','Freya','Noah','Zara','Isaac','Maya','Leon','Amara','Felix',
                 'Ingrid','Rashid','Elena','Tomas','Hana','Bruno','Lila','Kofi','Greta','Sven'];
  const last  = ['Okafor','Reyes','Khan','Moreau','Berg','Haddad','Nair','Walsh','Costa','Blum',
                 'Tanaka','Vega','Lund','Schmidt','Ali','Cohen','Iyer','Petit','Diallo','Braun',
                 'Solberg','Aziz','Popov','Novak','Sato','Ferrari','Roy','Mensah','Meyer','Dahl'];
  const plans  = ['Free','Starter','Pro','Enterprise'];
  const states = ['active','trial','suspended','churned'];

  const customers = Array.from({ length: 30 }, (_, i) => {
    const name = `${first[i]} ${last[i]}`;
    const status = states[i % states.length];
    const plan = plans[(i * 3 + 1) % plans.length];
    const d = new Date(2025, i % 12, ((i * 7) % 27) + 1);
    return {
      name,
      email: `${first[i].toLowerCase()}.${last[i].toLowerCase()}@example.com`,
      status,
      plan,
      created: d.toISOString().slice(0, 10),
      spend: `$${(120 + ((i * 137) % 900)).toLocaleString()}`,
    };
  });

  const columns = [
    { field: 'name',    header: 'Name',    sortable: true },
    { field: 'email',   header: 'Email',   sortable: true },
    { field: 'status',  header: 'Status',  sortable: true },
    { field: 'plan',    header: 'Plan',    sortable: true },
    { field: 'created', header: 'Created', sortable: true, type: 'date' },
    { field: 'spend',   header: 'Spend',   sortable: true },
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
     (as this used to) meant a Plan pick matched nothing and emptied the grid. */
  const valueChipColumn = { plan: 'plan', owner: null };

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

  const compare = (a, b, field, dir) =>
    String(a[field]).localeCompare(String(b[field]), undefined, { numeric: true }) * dir;

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
  });
  header?.setAttribute('data-heading', 'Customers');
  header?.setAttribute('data-icon', 'fa-solid fa-users');

  /* Quick-filter chips — status segments with counts, plus two value pickers.
     A chip with `options` shows a caret and opens a menu of real checkbox/radio
     rows; a chip without them is a plain on/off toggle. */
  const countOf = (s) => customers.filter((c) => c.status === s).length;
  const uniquePlans = [...new Set(customers.map((c) => c.plan))];
  qft.populate([
    { id: 'active',    label: 'Active',    type: 'data', count: countOf('active') },
    { id: 'trial',     label: 'Trial',     type: 'data', count: countOf('trial') },
    { id: 'suspended', label: 'Suspended', type: 'data', count: countOf('suspended') },
    { id: 'churned',   label: 'Churned',   type: 'data', count: countOf('churned') },
    // MULTI-select: any number of plans.
    { id: 'plan', label: 'Plan', type: 'data', icon: 'fa-solid fa-tag',
      select: 'multiple',
      options: uniquePlans.map((p) => ({ value: p.toLowerCase(), label: p })) },
    // SINGLE-select: one owner at a time.
    { id: 'owner', label: 'Owner', type: 'data', icon: 'fa-solid fa-user',
      select: 'single',
      options: [
        { value: 'any', label: 'Anyone', selected: true },
        { value: 'me',  label: 'Assigned to me' },
        { value: 'unassigned', label: 'Unassigned' },
      ] },
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
