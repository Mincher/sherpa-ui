/**
 * The records / CRUD-table view. init(root) binds the grid, quick-filter
 * toolbar and pagination inside `root` to ONE DataSource. Nav/header are shared
 * and live in index.html.
 */
import {
  DataSource, SherpaToast, persistView, viewOptions, onViewPicked,
} from '../../dist/index.js';
import { customerStore, customersReady, customers, columns, plans, regions, customerOrgs }
  from './records-data.js';
import { RECORDS_VIEWS } from './records-views.js';
import { globalFilters } from './global-filters.js';

export async function init(root) {
  /* The store is the APP's (records outlive a screen); the source is this
     view's (one query over them). */
  const store = customerStore;
  /* SEED BEFORE FIRST LOAD. The store is IndexedDB, so a source that loaded
     first would draw an empty grid and never hear the seed arrive. */
  await customersReady;
  const source = new DataSource({
    store,
    // Matches sherpa-pagination's own default; a different number here would
    // silently disagree with the select beside it.
    pageSize: 25,
    searchFields: ['name', 'email', 'owner'],
  });

  /* Two picks on a DATE column mean a RANGE; on any other column, either/or. */
  const dateFields = new Set(['created', 'lastSeen']);
  /* NUMBER columns: two picks are the ends of a range, one pick is one value. */
  const numberFields = new Set(['seats', 'spend', 'openTickets', 'health']);

  /* Toggle chips name a STATUS VALUE, not a field — only this view knows that,
     and they arrive in `active`, separately from the menu chips' `values`. */
  const statusChips = new Set(['active', 'trial', 'suspended', 'churned']);

  /* One clause per filtered column heading. The grid reports a ready
     FilterClause and lights the column but does not narrow its own rows —
     combining them is this view's job. Kept by field, so a second condition on
     one column replaces the first rather than fighting it. */
  const columnClauses = new Map();

  const filterFromChips = (values, active = []) => {
    const clauses = [];
    const statuses = active.filter((id) => statusChips.has(id));
    // Several statuses at once is an OR; the set ANDs with the menu chips.
    if (statuses.length === 1) clauses.push(['status', 'eq', statuses[0]]);
    else if (statuses.length > 1) clauses.push(['status', 'in', statuses]);

    for (const [field, picked] of Object.entries(values ?? {})) {
      if (!picked?.length) continue;
      if (picked.length === 2 && dateFields.has(field)) {
        clauses.push([field, 'between', [...picked].sort()]);
      } else if (picked.length === 2 && numberFields.has(field)) {
        // Numeric sort: a lexical one puts "1000" below "9" and the range
        // matches nothing.
        const ends = picked.map(Number).sort((a, b) => a - b);
        clauses.push([field, 'between', ends]);
      } else if (picked.length === 1 && numberFields.has(field)) {
        clauses.push([field, 'eq', Number(picked[0])]);
      } else if (picked.length === 1) {
        clauses.push([field, 'eq', picked[0]]);
      } else {
        clauses.push([field, 'in', picked]);
      }
    }
    return clauses.length === 1 ? clauses[0] : clauses.length ? ['and', ...clauses] : undefined;
  };

  /* THREE WRITERS, THREE NAMED PARTS: the saved view, this page's chips, and
     the grid's column headings each own a `contribute` key and the source ANDs
     them — so no writer has to know about the others. */
  const pushColumns = () => {
    const clauses = [...columnClauses.values()];
    source.contribute('columns',
      clauses.length === 1 ? clauses[0] : clauses.length ? ['and', ...clauses] : undefined);
  };

  const grid      = root.querySelector('#grid');
  const qft       = root.querySelector('#qft');
  const pager     = root.querySelector('#pager');
  const dialog    = root.querySelector('#dialog');
  const planGroup = root.querySelector('#f-plan');
  const confirm     = root.querySelector('#confirm');
  const confirmText = root.querySelector('#confirm-text');

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

  header?.populate({
    breadcrumb: [
      // Every crumb links to a REAL page.
      { label: 'Home', href: '?view=dashboard' },
      { label: 'Records' },
    ],
    /* THE GLOBAL FILTERS — View, Customer, Region, Date range. They sit above
       every page and trickle DOWN; the bar below narrows further inside that.
       See global-filters.js. Options are DERIVED from the view definitions and
       the records, so neither can name something the data does not have.
       TRAP T-a-chip-filters-the-values-the-data-has. */
    filters: globalFilters(viewOptions(RECORDS_VIEWS, 'all'), regions, customerOrgs),
  });

  /* Quick-filter chips. A chip with `options` opens a menu; one without is a
     plain on/off toggle. No `count` on the toggles — the badge means "how many
     VALUES are picked", which each menu chip sets itself. */
  const valuesOf = (field) => [...new Set(customers.map((c) => c[field]))].sort();
  const asOptions = (field) =>
    valuesOf(field).map((v) => ({ value: String(v).toLowerCase(), label: String(v) }));
  /* `removable: true` — the DATA bar is the user's own to arrange, so each menu
     chip offers "Remove filter". `commit: true` on Owner and Created only:
     chips AUTO-APPLY by default, and committing is the opt-out for a field
     whose query is expensive. Both behaviours are here side by side. */
  qft.populate([
    { id: 'active',    label: 'Active',    type: 'data' },
    { id: 'trial',     label: 'Trial',     type: 'data' },
    { id: 'suspended', label: 'Suspended', type: 'data' },
    { id: 'churned',   label: 'Churned',   type: 'data' },
    // MULTI-select: one pick reads back as "Plan: Pro", two or more show a count.
    { id: 'plan', label: 'Plan', type: 'data', icon: 'fa-solid fa-tag',
      select: 'multiple', removable: true, options: asOptions('plan') },
    // No Region chip: it is a GLOBAL filter in the app header, and two chips for
    // one field would make the reader guess which is in force.
    { id: 'tier', label: 'Tier', type: 'data', icon: 'fa-solid fa-award',
      select: 'multiple', removable: true, options: asOptions('tier') },
    // SINGLE-select, COMMITTING: rows are a draft behind Apply/Cancel.
    { id: 'owner', label: 'Owner', type: 'data', icon: 'fa-solid fa-user',
      select: 'single', removable: true, commit: true, options: asOptions('owner') },
    // `kind` picks the menu's content: a calendar rather than a list of values.
    // `availableDates` is derived from the records, so only days that hold one
    // are pickable — a `created` column is a scatter, not a span.
    { id: 'created', label: 'Created', type: 'data', kind: 'date',
      removable: true, commit: true, icon: 'fa-solid fa-calendar',
      availableDates: [...new Set(customers.map((c) => c.created))].sort() },
  ]);

  /* What the ADD chip offers — the columns the default set leaves out. These
     four are `kind: 'number'`, not value lists: a column of 240 distinct seat
     counts is not a set anybody picks from. Bounds are the data's own. */
  qft.available([
    { id: 'seats', label: 'Seats', type: 'data', icon: 'fa-solid fa-chair',
      kind: 'number', min: 1, max: 240, step: 1 },
    { id: 'spend', label: 'Spend', type: 'data', icon: 'fa-solid fa-sterling-sign',
      kind: 'number', min: 120, max: 10000, step: 20 },
    { id: 'health', label: 'Health', type: 'data', icon: 'fa-solid fa-heart-pulse',
      kind: 'number', min: 40, max: 100, step: 1 },
    { id: 'openTickets', label: 'Open tickets', type: 'data', icon: 'fa-solid fa-ticket',
      kind: 'number', min: 0, max: 8, step: 1 },
  ]);

  /* The leading Group and Sort chips — how the grid is ARRANGED. Their own
     events, so a group/sort pick is never mistaken for a filter change. */
  const organiseCols = columns.map((c) => ({ field: c.field, label: c.header }));
  qft.organise({ group: organiseCols, sort: organiseCols });

  /* Plan radio group in the dialog. */
  planGroup.populate(plans.map((p) => ({ value: p.toLowerCase(), label: p })));

  /* Three components, ONE source: each READS (rows plus view state as data-*)
     and WRITES (its noun-verb events steer the source). */

  /* ONE AbortController for the whole view — `bind`, `persistView` and
     `onViewPicked` all take a `signal`. Without a teardown the source keeps
     pushing rows into components the router has already removed. */
  const page = new AbortController();
  const signal = page.signal;

  /* ROW ACTIONS declared ONCE. The grid draws them in its pinned trailing
     column and the toolbar reads the same list back via `grid.actionsFor(n)`,
     so the two cannot disagree. `multi` is what survives a multi-row
     selection — deleting five is one action, editing five is not. */
  const ROW_ACTIONS = [
    { id: 'edit', label: 'Edit', icon: 'fa-solid fa-pen' },
    { id: 'delete', label: 'Delete', icon: 'fa-solid fa-trash', multi: true, danger: true },
  ];

  /* `as` adapts the shape at the binding. `ignore` on filter-change because
     this view owns the whole filter: the grid's secondary header row emits it
     with ONE column's text, which would wipe the chips and the other columns. */
  source.bind(grid, {
    as: (rows) => ({ columns, rows, key: 'email', actions: ROW_ACTIONS }),
    ignore: ['filter-change'],
    signal,
  });
  source.bind(pager, { signal });

  /* STEER-ONLY: the toolbar's populate() means "here are your CHIPS", so a
     plain bind() overwrites the bar with records. Its events still reach the
     source and the state attributes still arrive — which is what keeps its Sort
     chip and the grid's header arrow two views of one value. `ignore` on the
     FILTER event only, because translating chips is view knowledge; sort and
     group the source handles itself. */
  source.bind(qft, { steerOnly: true, ignore: ['quick-filter-change'], signal });
  qft.addEventListener('quick-filter-change', (e) => {
    source.contribute('chips', filterFromChips(e.detail.values, e.detail.active));
    /* A custom chip's body is a TOGGLE: off means "stop applying this", not
       "delete it" — only REMOVE deletes. So this suspends and restores the
       clause and never touches the chip. A custom chip shows in neither
       `active` nor `values`, so the toolbar reports it in `custom`. */
    for (const [id, on] of Object.entries(e.detail.custom ?? {})) {
      if (!id.startsWith('col:')) continue;
      const field = id.slice(4);
      /* The grid keeps the clause; this only says whether it is APPLIED.
         Suspended, the heading stops reading active — a lit column that filters
         nothing is a lie. */
      grid.suspendColumnFilter(field, !on);
      const clause = on ? grid.columnClause(field) : null;
      if (clause) columnClauses.set(field, clause);
      else columnClauses.delete(field);
    }
    pushColumns();
  });

  /* The column chip's CARET opens that column's own grid menu, so the two
     places cannot drift. The caret, not the body — the body is the on/off
     toggle, handled above. */
  qft.addEventListener('click', (e) => {
    const path = e.composedPath();
    if (!path.some((n) => n.classList?.contains?.('caret'))) return;
    const chip = path.find((n) => n.dataset?.id?.startsWith?.('col:'));
    if (!chip) return;
    grid.openColumnFilter(chip.dataset.id.slice(4), chip);
  }, true); /* CAPTURE: the chip's caret handler calls stopPropagation() to
               guard its menu, so a bubbling listener here never runs. */

  /* COLUMN FILTERS — the funnel in each column heading. The clause arrives
     ready; this view decides what it means for the query, because only it knows
     what else is filtering. It also goes onto the toolbar as a chip, so a
     sideways scroll still shows the view is narrowed and by what. */
  grid.addEventListener('column-filter-change', (e) => {
    const { field, header, clause, label } = e.detail;
    if (clause) columnClauses.set(field, clause);
    else columnClauses.delete(field);
    /* CHIP FIRST, then the filter. Adding the chip makes the toolbar emit
       `quick-filter-change`, which the bound source answers by setting the
       filter from the chips alone — so the column contribution must land after
       it to have the last word on its own key. */
    qft.addCustomFilter({ id: `col:${field}`, label: header, value: label });
    pushColumns();
  });

  /* Taking the chip off the bar must reach back and clear the column, or the
     heading stays lit. `clearColumnFilter` is silent by design — echoing the
     event back would clear the clause twice. */
  qft.addEventListener('filter-remove', (e) => {
    const id = e.detail?.id ?? '';
    if (!id.startsWith('col:')) return;
    const field = id.slice(4);
    columnClauses.delete(field);
    grid.clearColumnFilter(field);
    pushColumns();
  });
  // Grouping needs no wiring: the source writes data-group-field on every bound
  // component, and the grid draws the collapsible group rows.

  /* REMEMBER THE WHOLE VIEW ACROSS A RELOAD, as ONE snapshot — the same shape a
     preset or a shared link uses. sessionStorage, so two tabs keep their own
     filters. It restores BEFORE the first load, so the source queries once. */
  persistView('records', { source, elements: { grid } }, {
    /* What the grid contributes: the view names it, because only this view
       knows a column filter belongs in a saved view and a scroll position does
       not. Each entry is an ElementNode.state block. */
    grid: () => {
      const state = { select: [grid.selectedKeys] };
      // A LIST OF CALLS: setColumnFilter runs once per filtered column, and a
      // state block is a map — one method, one key.
      const calls = [...columnClauses].map(([field, clause]) => [field, clause]);
      if (calls.length) state.setColumnFilter = calls.length === 1 ? calls[0] : calls;
      return state;
    },
  });

  /* WHICH FIELD each header chip narrows, for THESE records. A header chip is
     named for the business question and the answering field differs per page —
     "Customer" is the `customer` organisation, not the record's own name, nor
     `owner`, who is the member of staff. A chip that is not here narrows
     nothing, rather than building a clause against a field no record has.
     `view` is absent on purpose: it is the saved-view SELECTOR, handled by
     `onViewPicked` below, and folding it in would filter by a view id.
     TRAP T-the-header-chips-must-reach-the-query. */
  const HEADER_FIELDS = { customer: 'customer', region: 'region', dateRange: 'created' };

  header?.addEventListener('quick-filter-change', (e) => {
    const picked = {};
    for (const [id, values] of Object.entries(e.detail.values ?? {})) {
      const field = HEADER_FIELDS[id];
      if (field && values?.length) picked[field] = values;
    }
    // Its OWN key, so it ANDs with the chips, the columns and a saved view.
    source.contribute('global', filterFromChips(picked, []));
  }, { signal });

  /* SAVED VIEWS — the header's View chip. Each option is a ViewSnapshot holding
     the query AND every component's state, so picking one reconfigures the
     screen. `onViewPicked` applies it; `after` is the half only this page knows,
     because the query here is composed from named parts. */
  onViewPicked(header, RECORDS_VIEWS, { source, elements: { grid } }, {
    signal,
    /* 'all' is on screen already. Without this the first Region or Customer
       pick of a session re-applies it and wipes the pick.
       TRAP T-a-persistent-chip-reports-on-every-change. */
    applied: 'all',
    after: ({ view }) => {
      /* AFTER the snapshot, not before: `setState` treats a restored filter as
         the WHOLE query and clears the named parts with it, so the view's own
         clause goes back under its own key. The order is the whole subtlety. */
      source.contribute('view', view.snapshot.source?.filter);

      /* The snapshot set the clauses ON THE GRID; the source still has to be
         told. Cleared first — a view naming no column filters means none. */
      columnClauses.clear();
      queueMicrotask(() => {
        for (const col of columns) {
          const clause = grid.columnClause(col.field);
          if (clause) columnClauses.set(col.field, clause);
        }
        pushColumns();
      });
    },
  });

  /* Same read-back after a restore, so this view's map agrees with the grid. */
  for (const col of columns) {
    const clause = grid.columnClause(col.field);
    if (clause) columnClauses.set(col.field, clause);
  }

  await source.load();

  /* ROW ACTIONS — the grid REPORTS an action; this view decides what it means.
     A grid that deleted the row itself would own state the store owns. */

  /** The record being edited, or null for a new one. */
  let editing = null;

  /** Open the dialog for one record, or for a new one when given nothing. */
  const openDialog = (record) => {
    editing = record ? record.email : null;
    dialog.dataset.heading = record ? 'Edit customer' : 'Add customer';
    root.querySelector('#f-name').value = record?.name ?? '';
    root.querySelector('#f-email').value = record?.email ?? '';
    // show(), not the native showModal() — the component owns modality and the
    // `open` attribute.
    dialog.show();
  };

  /**
   * Delete records, after the reader has confirmed.
   *
   * Failure is caught PER RECORD, so a bulk delete that fails halfway says what
   * happened. The screen is never updated by hand: the store announces its own
   * change and every bound view reloads, so a record that did NOT delete stays.
   *
   * TRAP T-a-failed-mutation-must-reach-the-reader.
   */
  const deleteRecords = async (records) => {
    const failed = [];
    for (const record of records) {
      try {
        await store.remove(record.email);
      } catch (err) {
        failed.push({ record, err });
      }
    }

    const gone = records.length - failed.length;
    // KEEP what refused, so the reader can try those again; a full success
    // clears the selection, because `select([])` is a clear.
    grid.select(failed.map((f) => f.record.email));

    if (gone) {
      SherpaToast.success(
        gone === 1 ? `${records[0].name} deleted` : `${gone} customers deleted`,
        { value: 'The store announced the change; every bound view reloaded.' },
      );
    }
    if (failed.length) {
      // With the reason: a failure the reader cannot see is a record they think
      // is gone.
      const first = failed[0];
      SherpaToast.critical(
        failed.length === 1
          ? `Could not delete ${first.record.name}`
          : `Could not delete ${failed.length} of ${records.length} customers`,
        { value: String(first.err?.message ?? first.err ?? 'The store refused the change.') },
      );
    }
  };

  /** Held in a closure, not on the dialog: the dialog is the question. */
  let pendingDelete = [];

  const askToDelete = (records) => {
    if (!records.length) return;
    pendingDelete = records;
    confirm.dataset['heading'] =
      records.length === 1 ? 'Delete customer?' : `Delete ${records.length} customers?`;
    // NAMED, not counted, when there is one — "Delete 1 customer?" is not a
    // question the reader can answer.
    confirmText.textContent = records.length === 1
      ? `${records[0].name} will be permanently deleted. This cannot be undone.`
      : `${records.length} customers will be permanently deleted. This cannot be undone.`;
    confirm.show();
  };

  root.querySelector('#confirm-cancel')?.addEventListener('click', () => {
    pendingDelete = [];
    confirm.close();
  }, { signal });

  root.querySelector('#confirm-delete')?.addEventListener('click', () => {
    const records = pendingDelete;
    pendingDelete = [];
    // SHUT FIRST: the mutation reloads every bound view, and a modal left open
    // over a grid rebuilding beneath it reads as stuck.
    confirm.close();
    void deleteRecords(records);
  }, { signal });

  /** One place both surfaces route through, so they cannot behave differently. */
  const runAction = (id, records) => {
    if (!records.length) return;
    if (id === 'edit') openDialog(records[0]);
    // ASK, never delete outright. The awaiting happens after the reader answers.
    if (id === 'delete') askToDelete(records);
  };

  grid.addEventListener('row-action', (e) => {
    runAction(e.detail.id, e.detail.records ?? []);
  }, { signal });

  /* THE BULK BAR. `grid.actionsFor(count)` is the row menu's own list, narrowed
     to what survives a multi-row selection — so Edit disappears the moment a
     second row is ticked, without this view knowing why. */
  const bulkCount = root.querySelector('#bulk-count');
  const bulkActions = root.querySelector('#bulk-actions');

  grid.addEventListener('selection-change', () => {
    const records = grid.selectedRecords;
    bulkCount.hidden = records.length === 0;
    bulkCount.textContent = `${records.length} selected`;

    bulkActions.replaceChildren();
    for (const action of grid.actionsFor(records.length)) {
      const button = document.createElement('sherpa-button');
      button.dataset.look = action.danger ? 'ghost' : 'ghost';
      if (action.danger) button.dataset.status = 'critical';
      if (action.icon) button.dataset.iconStart = action.icon;
      button.textContent = action.label;
      button.addEventListener('button-click', () => {
        runAction(action.id, grid.selectedRecords);
      });
      bulkActions.appendChild(button);
    }
  }, { signal });

  // Dialog open/close + save → toast.
  root.querySelector('#add-btn').addEventListener('button-click', () => openDialog(null));
  root.querySelector('#cancel-btn').addEventListener('button-click', () => dialog.close());

  root.querySelector('#save-btn').addEventListener('button-click', async () => {
    const name = root.querySelector('#f-name').value || 'New customer';
    const email = root.querySelector('#f-email').value;
    const plan = root.querySelector('#f-plan').value;

    /* The store is the whole fix: writing announces a change, the source
       reloads, every bound component re-populates. Where the new row lands
       against the active sort, whether a filter hides it and what the page
       totals become are the source's existing work. */
    /* EDIT or ADD through one button. `editing` holds the key from the row's
       Edit action; update MERGES, so the rest of the record survives. */
    if (editing) {
      const saved = await store.update(editing, { name, email: email || editing });
      editing = null;
      dialog.close();
      SherpaToast.success(`${saved.name} updated`, { value: 'The record was saved.' });
      return;
    }

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
    // The FACTORY, not a hand-built element: it owns the shared top-right stack,
    // the auto-dismiss timer and the removal.
    SherpaToast.success(`${name} saved`, {
      value: 'The customer record was created.',
    });
  });

  /* The teardown the router calls when it swaps away. ONE abort ends every
     binding, the persister and the view picker. */
  return () => {
    page.abort();
  };
}
