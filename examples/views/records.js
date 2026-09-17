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
import {
  DataSource, SherpaToast, persistView, viewOptions, onViewPicked,
} from '../../dist/index.js';
import { customerStore, customers, columns, plans } from './records-data.js';
import { RECORDS_VIEWS } from './records-views.js';
import { globalFilters } from './global-filters.js';

export async function init(root) {
  /* ── The data layer ───────────────────────────────────────────────── */

  /* One store holds the records; ONE source holds how they are being viewed.
     This replaces ~80 lines of hand-wired pipeline — applyFilter, compare,
     applySort, currentRows and render — and, more importantly, replaces the two
     separate `sort-change` handlers this file used to carry. The grid's column
     header and the toolbar's Sort chip now read and write the SAME value, so
     they cannot disagree; the comment that used to sit here admitting they were
     being held together by hand is gone with them. */
  /* THE STORE IS THE APP'S, not this view's — see records-data.js. Built here,
     it died with the view: adding a customer took the grid to 5 pages and
     coming back put it at 4, with the record gone.

     The SOURCE is still this view's, and that is the rule: a store holds
     records, which outlive a screen; a source holds one QUERY over them, which
     does not. */
  const store = customerStore;
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
  /* The NUMBER columns. Their chips are `kind: 'number'`, so two picks mean the
     two ends of a range exactly as two dates do — and one pick is one value. */
  const numberFields = new Set(['seats', 'spend', 'openTickets', 'health']);

  /* The toolbar reports its chips as `{ values: { field: [picked] } }`, and the
     source turns that into a filter on its own. The one thing it cannot guess is
     that two picks on a DATE column mean a range rather than an either/or, so
     that is translated here and handed over as a real filter. */
  /* The four TOGGLE chips are status values, not fields: their ids are `active`,
     `trial`, `suspended`, `churned`, and turning one on means "show me customers
     in that status". Only this view knows that — a chip id is a field name for
     every MENU chip, so the source cannot guess which column a toggle names. They
     arrive in `active`, separately from the menu chips' `values`, and used to be
     dropped on the floor here, which is why clicking them did nothing. */
  const statusChips = new Set(['active', 'trial', 'suspended', 'churned']);

  /* COLUMN FILTERS — one clause per column heading the reader has filtered.

     The grid reports each as a ready FilterClause and lights that column, but
     it does not narrow its own rows: it holds one column's clause at a time and
     cannot know what the toolbar is doing. Combining them is this view's job,
     the same as combining the chips.

     Kept by field, so setting "contains ana" and then "contains bo" on the same
     column is one filter, not two fighting each other. */
  const columnClauses = new Map();

  const filterFromChips = (values, active = []) => {
    const clauses = [];
    const statuses = active.filter((id) => statusChips.has(id));
    // Several statuses on at once is an OR — "active OR trial" — and the whole
    // set ANDs with whatever the menu chips narrow to.
    if (statuses.length === 1) clauses.push(['status', 'eq', statuses[0]]);
    else if (statuses.length > 1) clauses.push(['status', 'in', statuses]);

    for (const [field, picked] of Object.entries(values ?? {})) {
      if (!picked?.length) continue;
      if (picked.length === 2 && dateFields.has(field)) {
        clauses.push([field, 'between', [...picked].sort()]);
      } else if (picked.length === 2 && numberFields.has(field)) {
        // NUMERIC, so the ends are compared as numbers — a lexical sort would
        // put "1000" below "9" and the range would match nothing.
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

  /* THREE WRITERS, THREE NAMED PARTS.

     The app's saved view, this page's chips, and the grid's column headings all
     narrow the same query, and each owns its own key. The source ANDs them.

     It used to be four variables composed by hand — lastChips, columnClauses,
     viewClause and one reapplyFilter() that rebuilt the whole filter from all
     three. Every writer had to know about the others, and the last one to run
     won: a saved view's clause was silently dropped the moment any chip
     changed. `contribute` removes the coordination entirely. */
  const pushColumns = () => {
    const clauses = [...columnClauses.values()];
    source.contribute('columns',
      clauses.length === 1 ? clauses[0] : clauses.length ? ['and', ...clauses] : undefined);
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
      // Every crumb links to a REAL page. The trail used to name sections
      // that do not exist ('Monitoring', 'Workspace') and point at dead `#`
      // anchors, so clicking one went nowhere.
      { label: 'Home', href: '?view=dashboard' },
      { label: 'Records' },
    ],
    // The header's toolbar is the VIEW-level one (data-type="view" in
    // index.html), so its chips are SAVED VIEWS, not the grid's column filters.
    // A view is a whole saved arrangement — which is why this bar, and not the
    // data bar below it, is the one that carries Save / favourite.
    // THE GLOBAL FILTERS — View, Customer, Region and Date range. They sit
    // above every page and trickle DOWN: whatever they narrow to is the
    // population this grid then works within, and the bar BELOW narrows further
    // inside that. See global-filters.js.
    // DERIVED from the view definitions, so a label cannot drift from the view
    // it names. Each option's value is a key into RECORDS_VIEWS.
    filters: globalFilters(viewOptions(RECORDS_VIEWS, 'all')),
  });

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
    // NO Region chip here. It is a GLOBAL filter now, in the app header — it
    // narrows every page, not just this grid, and two chips for one field would
    // make the reader guess which one was in force.
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
    // ONLY the days the data actually carries are pickable. A `created` column
    // is a scatter, not a span — most days have no record at all — so every
    // other day is drawn inactive and a reader cannot choose one that would
    // empty the grid. Derived from the records themselves, so it can never
    // drift from them.
    { id: 'created', label: 'Created', type: 'data', kind: 'date',
      removable: true, commit: true, icon: 'fa-solid fa-calendar',
      availableDates: [...new Set(customers.map((c) => c.created))].sort() },
  ]);

  /* What the ADD chip offers — filters a user can put on the bar OVER AND ABOVE
     the defaults above. That is what the Add control is for in the design: its
     caret opens this list, and picking one stamps the chip into the run and
     drops it from the menu (a filter already on the bar is not one you can add
     again).

     These are the columns the default set leaves out, so the bar starts with the
     common ones and the rest are a click away rather than crowding it. */
  /* The four NUMERIC columns are `kind: 'number'`, not value lists. A column of
     240 distinct seat counts is not a set anybody picks from — the question is
     "how many" or "between what and what", which is what the Range switch on a
     number menu asks. The bounds are the data's own, so the slider spans exactly
     what exists rather than an arbitrary 0..100. */
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
  /* `ignore` on filter-change for the same reason the toolbar carries it: this
     view owns the whole filter. The grid's secondary header row emits
     filter-change with ONE column's text, and the source would set the filter
     to that alone — wiping both the chips and the other columns' clauses. */
  /* THE BINDS, kept so the view can end them.

     The router calls whatever a view's init() returns when it swaps away.
     Without a teardown the source kept pushing rows into components that had
     been removed from the DOM — one live source per view visit, each holding
     detached elements.

     ONE AbortController for the whole view, because `bind`, `persistView` and
     `onViewPicked` all take the platform's `signal`. A list of unbind functions
     is a list someone forgets — which is exactly what happened on the dashboard
     when a second, shorter-lived list appeared beside the first. */
  const page = new AbortController();
  const signal = page.signal;

  source.bind(grid, {
    as: (rows) => ({ columns, rows }),
    ignore: ['filter-change'],
    signal,
  });
  source.bind(pager, { signal });

  /* STEER-ONLY. The toolbar's populate() means "here are your CHIPS", not "here
     are your rows" — a plain bind() overwrote the bar with records and it came
     back holding only Group and Sort. `steerOnly` sends its events to the source
     and pushes no rows back, while the STATE attributes still arrive: that is
     what keeps its Sort chip and the grid's header arrow two views of one value
     rather than two rival listeners racing to set it.

     Sort and group need no listener at all now — the source understands both
     events. Only the FILTER stays hand-written, because translating chips is
     view knowledge: only this page knows two picks on `created` mean a RANGE
     rather than an either/or. */
  /* `ignore` on the FILTER event, because this view owns the whole filter: it
     folds the chips together with the data grid's column filters, and only it
     can do that. Left to the source, `quick-filter-change` would set the filter
     from the chips alone and the column clauses would vanish on every chip
     click. Sort and group are untouched — the source still handles those. */
  source.bind(qft, { steerOnly: true, ignore: ['quick-filter-change'], signal });
  qft.addEventListener('quick-filter-change', (e) => {
    source.contribute('chips', filterFromChips(e.detail.values, e.detail.active));
    /* A CUSTOM chip's body is a TOGGLE, exactly like any other chip's: off
       means "stop applying this", not "delete it". The chip stays on the bar
       with its condition still written on it, ready to come back on.

       Only REMOVE deletes — from either menu, the toolbar chip's or the column
       heading's. So this suspends the clause and restores it, and never
       touches the chip itself.

       A custom chip shows in neither `active` (which skips menu chips) nor
       `values` (which reads ticked rows), so the toolbar reports it in its own
       `custom` map. */
    for (const [id, on] of Object.entries(e.detail.custom ?? {})) {
      if (!id.startsWith('col:')) continue;
      const field = id.slice(4);
      /* The grid keeps the clause either way; this only says whether it is
         being APPLIED. Suspended, the heading stops reading active and its
         match marks come off — the column is narrowing nothing, and a lit
         column that filters nothing is a lie. */
      grid.suspendColumnFilter(field, !on);
      const clause = on ? grid.columnClause(field) : null;
      if (clause) columnClauses.set(field, clause);
      else columnClauses.delete(field);
    }
    pushColumns();
  });

  /* The COLUMN chip's CARET opens that column's own filter menu — the real
     one, borrowed from the grid's heading, so the two places cannot drift about
     what the column is filtered by.

     The caret, not the body: a chip's body is its on/off toggle, and turning
     the chip off already means "stop filtering that column" (handled above).
     One gesture per meaning. */
  qft.addEventListener('click', (e) => {
    const path = e.composedPath();
    if (!path.some((n) => n.classList?.contains?.('caret'))) return;
    const chip = path.find((n) => n.dataset?.id?.startsWith?.('col:'));
    if (!chip) return;
    grid.openColumnFilter(chip.dataset.id.slice(4), chip);
  }, true); /* CAPTURE. The chip's own caret handler calls stopPropagation() —
               it is guarding its menu from the body's toggle — so a bubbling
               listener out here never runs. Capture reaches the event on the
               way DOWN, before the chip sees it. */

  /* COLUMN FILTERS — the funnel in each column heading.

     The grid says what was asked for; this view decides what it means for the
     query, because only this view knows what else is filtering. The clause
     arrives ready, so there is nothing to translate.

     It also goes onto the TOOLBAR as a chip, so a reader who scrolls the grid
     sideways still sees that the view is narrowed and by what. `header` is the
     field name and `label` the condition and value — "Name" / "Contains: ana". */
  grid.addEventListener('column-filter-change', (e) => {
    const { field, header, clause, label } = e.detail;
    if (clause) columnClauses.set(field, clause);
    else columnClauses.delete(field);
    /* THE CHIP FIRST, then the filter.

       Putting the chip on the bar makes the toolbar emit `quick-filter-change`,
       and the source is bound to the toolbar — so it hears that event and sets
       the filter from the CHIPS alone, throwing this column's clause away. Done
       in this order the source's own write lands first and the column
       contribution has the last word on its own key. */
    qft.addCustomFilter({ id: `col:${field}`, label: header, value: label });
    pushColumns();
  });

  /* Taking the chip OFF the bar has to reach back and clear the column, or the
     heading stays lit and its menu still holds a clause the bar no longer
     shows. `clearColumnFilter` is silent by design — it does not echo the
     event back, which would clear the clause twice. */
  qft.addEventListener('filter-remove', (e) => {
    const id = e.detail?.id ?? '';
    if (!id.startsWith('col:')) return;
    const field = id.slice(4);
    columnClauses.delete(field);
    grid.clearColumnFilter(field);
    pushColumns();
  });
  // The GRID does the grouping — data-group-field makes it drop that column and
  // draw a collapsible group row per value. The source writes that attribute on
  // every bound component, so the grid gets it without this view wiring it.

  /* REMEMBER THE WHOLE VIEW ACROSS A RELOAD — as ONE definition.

     An accidental refresh used to throw away every filter, sort and page, and
     the reader started again.

     This was two mechanisms: persistViewState for the source, plus a
     hand-written sessionStorage line for the grid's column clauses — with a
     third needed for selection and a fourth for the toolbar's chips. Four
     shapes, four restore paths, one idea. Now one snapshot, in the same shape a
     PRESET or a shared link would use, so all three are interchangeable.

     sessionStorage, so two tabs on this screen keep their own filters — which
     is a feature, not a bug. It restores BEFORE the first load, so the source
     queries once with the remembered state rather than loading empty and
     loading again. */
  persistView('records', { source, elements: { grid } }, {
    /* WHAT THE GRID CONTRIBUTES. The view names it rather than the helper
       guessing: only this view knows that a column filter belongs in a saved
       view and a scroll position does not.

       Each entry is an ElementNode.state block — the same shape renderElement
       takes, which is why a saved view and a preset are the same object. */
    grid: () => {
      const state = { select: [grid.selectedKeys] };
      // A LIST OF CALLS, because setColumnFilter runs once per filtered column
      // and a state block is a map — one method, one key.
      const calls = [...columnClauses].map(([field, clause]) => [field, clause]);
      if (calls.length) state.setColumnFilter = calls.length === 1 ? calls[0] : calls;
      return state;
    },
  });

  /* SAVED VIEWS — the header's View chip.

     Each option is a real definition, not a label: a ViewSnapshot holding the
     query AND every component's state. Picking one applies it, and the screen
     reconfigures — filter, sort, grouping, and the grid's own column filters.

     The same call a user's saved view would take, and the same one an agent
     would make over MCP. That is the point of one shape: a preset, a saved
     view and a shared link are not three features. */
  /* ONE CALL. `onViewPicked` reads the View chip's id, applies that snapshot,
     and reports what a stale definition could not restore — the same call the
     dashboard makes, because picking a saved view is not this page's idea.

     `after` is the half only this page knows: the QUERY here is composed from
     named parts, so the view's own clause has to be re-contributed and the
     grid's column clauses read back. */
  onViewPicked(header, RECORDS_VIEWS, { source, elements: { grid } }, {
    signal,
    after: ({ view }) => {
      /* AFTER the snapshot, not before. `setState` treats a restored filter as
         the WHOLE query and clears the named parts with it — right for a host
         that does not compose, wrong here. So the view's own clause goes back
         under its own key. The order is the whole subtlety. */
      source.contribute('view', view.snapshot.source?.filter);

      /* Read the grid's clauses back into the 'columns' part. The snapshot set
         them ON THE GRID; the source still has to be told. Cleared first — a
         view that names no column filters means none, not "keep the last
         view's". */
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

  /* The view's OWN map has to agree with the grid after a restore. The snapshot
     put the clauses back into the GRID; this reads them out again so the
     query — which this view composes, not the grid — includes them. */
  for (const col of columns) {
    const clause = grid.columnClause(col.field);
    if (clause) columnClauses.set(col.field, clause);
  }

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

  /* THE TEARDOWN the router calls when it swaps to another view.

     Unbinding is what ends the source's hold on these three components. The
     components themselves go with the view's markup; the SOURCE would have
     kept pushing rows into them, and a filter set on the next visit would fan
     out to every detached copy from every previous one. */
  return () => {
    // ONE ABORT: every binding, the persister and the view picker.
    page.abort();
  };
}
