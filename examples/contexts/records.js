/**
 * records.js — the Records Context: a customer grid, its filters, and CRUD.
 *
 * `init(root)` binds the grid, its filter bar and pagination inside `root` to
 * ONE DataSource. The nav and the header are shared and live in index.html.
 *
 * Map:
 * - init — bind this Context to its source and wire every control; returns nothing
 */
import {
  DataSource, VIEW_SCOPE, SherpaToast, persistView, viewOptions, spoofRemote,
  reduceRows, saveFilterAs, loadSavedFilters, deleteSavedFilter, labelId,
} from '../../dist/index.js';
import { namePrompt } from './ask-name.js';
import { customerStore, customersReady, customers, columns, plans, regions, customerOrgs, states }
  from './records-data.js';
import { RECORDS_VIEWS } from '/examples/definitions/records-views.js';
import { globalFilters } from './global-filters.js';


export async function init(root, { session, view, remote = false } = {}) {
  /* The store is the APP's (records outlive a screen); the source is this
     Context's (one query over them). `?remote` makes it ACT remote, so every
     filter waits for Apply. TRAP T-apply-and-discard-wait-for-a-change */
  const store = remote ? spoofRemote(customerStore, { delay: 800 }) : customerStore;
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

  /* THE VIEW THE URL ASKS FOR, applied here at the start — so the host's pick
     after init is a no-op, and never resets what the session kept.
     TRAP T-a-reload-replays-the-readers-answers */
  const startView = view && RECORDS_VIEWS[view] ? view : 'all';
  /** The days the records carry, read off their TIME. */
  const days = [...new Set(customers.map((c) => c[source.timeField]))].filter(Boolean).sort();

  /* THE SOURCE, REACHABLE. `debugState()` answers every question a filter bug
     raises in one paste — rows, total, sort, group, filter, selections,
     scopes — and there was no way to call it from a running page, so two
     investigations went hunting through shadow roots instead.
     Example app only: a library never writes to `window`.
     TRAP T-a-bug-report-should-be-a-paste */
  window.sherpa = { ...(window.sherpa ?? {}), source, store };

  /* WHAT KIND each field is, said ONCE. The data layer decides what two picks
     on a number mean — this page does not, and no longer can.
     TRAP T-the-field-type-decides-the-clause */
  /* `created` is the store's TIME, so the source already declared it a date.
     TRAP T-a-record-has-a-time-of-its-own */
  source.declareField('lastSeen', { type: 'date' });
  for (const field of ['seats', 'spend', 'openTickets', 'health']) {
    source.declareField(field, { type: 'number' });
  }



  const grid      = root.querySelector('#grid');
  const qft       = root.querySelector('#qft');
  const pager     = root.querySelector('#pager');
  const dialog    = root.querySelector('#dialog');
  const planGroup = root.querySelector('#f-plan');
  const custField = root.querySelector('#f-customer');
  /* The FILTER PANEL lives in the app shell, not in this Context's markup:
     it is app chrome, and the shell owns where a panel sits beside the
     content. TRAP T-the-shell-owns-the-panel-areas */
  const panel       = document.querySelector('sherpa-app-shell #filter-panel');
  const confirm     = root.querySelector('#confirm');
  const confirmText = root.querySelector('#confirm-text');

  /* Shared nav + header (live in index.html). */
  const header = document.querySelector('sherpa-app-shell > sherpa-app-header');

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

  // Awaited, so a host picking a View after init() finds the chips.
  await header?.populate({
    /* No trail: moving between Contexts is the NAV's to show. A crumb is for a
       workflow or a drilldown. Will, 2026-09-26. */
    breadcrumb: [],
    /* THE GLOBAL FILTERS — View, Customer, Region, Date range. They sit above
       every page and trickle DOWN; the bar below narrows further inside that.
       See global-filters.js. Options are DERIVED from the view definitions and
       the records, so neither can name something the data does not have.
       TRAP T-a-chip-filters-the-values-the-data-has. */
    /* The days the RECORDS carry, read off their TIME — not the default
       last-90-days, which no record in this set falls inside.
       TRAP T-a-record-has-a-time-of-its-own */
    filters: globalFilters(viewOptions(RECORDS_VIEWS, startView), regions, customerOrgs,
      days,
      source.timeField),
    /* The header's ADD list is set once the columns are known — below, from
       the same builder the grid's bar uses. TRAP T-up-is-open-down-is-closed */
  });

  /* Quick-filter chips. A chip with `options` opens a menu; one without is a
     plain on/off toggle. No `count` on the toggles — the badge means "how many
     VALUES are picked", which each menu chip sets itself. */
  /* In the data's own ORDER where it has one — a plan's tier, a status's
     lifecycle — so a chart and its legend keep each category's colour.
     TRAP T-a-category-keeps-its-colour */
  const ORDER = { status: states, plan: plans };
  const valuesOf = (field) => {
    const have = [...new Set(customers.map((c) => c[field]))];
    return ORDER[field] ? ORDER[field].filter((v) => have.includes(v)) : have.sort();
  };
  /* ONE RULE for "is this a set anybody picks from", read by the bar's Add
     menu AND by the grid's column headings. Ticking is only an answer when the
     list is short enough to read; 100 distinct emails is a wall, and a search
     box over a wall only FINDS in it — it does not filter.
     TRAP T-a-wall-of-values-is-not-a-filter */
  const PICKABLE_AT_MOST = 12;
  const typedColumn = (col) =>
    (col.type ?? 'text') === 'text' && valuesOf(col.field).length > PICKABLE_AT_MOST;

  /** A number column's real ends, and a step that gives the slider ~200 stops. */
  const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const numberFacts = (field) => {
    const nums = customers.map((c) => Number(c[field])).filter(Number.isFinite);
    const min = Math.floor(Math.min(...nums));
    const max = Math.ceil(Math.max(...nums));
    const span = max - min;
    const step = span <= 1000 ? 1 : (NICE_STEPS.find((n) => n >= span / 200) ?? 1000);
    return { min, max, step };
  };

  /* EVERY COLUMN, DECLARED ONCE — its name, its kind and how a filter answers
     it — so a bar, the panel and a heading draw it one way. Its values too: a
     chip, a heading and a legend offer the same STRINGS, so they share one
     selection. BEFORE the provider: a legend picks from them when answered.
     TRAP T-a-field-is-declared-once · TRAP T-one-field-one-filter-menu */
  // A scope's ONE name — a panel section, an Add note, a raised chip.
  // TRAP T-a-scope-is-named-for-its-content
  source.declareScope(VIEW_SCOPE, { label: 'View filters' });
  source.declareScope('data', { label: 'Customer records' });
  /* Owner OPTS IN to conditions — a person's name, so "starts with" is a real
     question. TRAP T-conditions-are-opt-in-per-field */
  const OPTS_IN = { owner: { custom: true } };
  for (const c of columns) {
    const type = c.type ?? 'text';
    // A wall is asked a condition, opening on Contains. TRAP T-a-condition-only-field-still-has-a-menu
    const wall = typedColumn(c);
    source.declareField(c.field, {
      label: c.header,
      ...(type === 'number' ? numberFacts(c.field)
        : wall ? { custom: 'only', op: 'contains' }
        : type === 'text' ? { select: 'multiple', ...OPTS_IN[c.field] } : {}),
    });
    if (type === 'text' && !wall) source.declareValues(c.field, valuesOf(c.field));
  }
  /* The record's TIME is the View's Date, over the days the records carry —
     the header's Date chip, drawn one way everywhere.
     TRAP T-a-record-has-a-time-of-its-own */
  source.declareField(source.timeField, { label: 'Date' });
  source.declareValues(source.timeField, days);
  /* `removable: true` — the DATA bar is the user's own to arrange, so each menu
     chip offers "Remove filter". No `commit`: a pick applies at once, and
     only a REMOTE source makes a menu wait for Apply (`?remote`).
     TRAP T-commit-follows-select-mode */
  /* ONE LIST, read twice: the toolbar draws it as a row of chips and the
     PANEL draws it as a column. A second copy would drift the first time
     either changed. TRAP T-the-panel-is-the-toolbar-in-a-column */
  const DATA_FIELDS = ['status', 'plan', 'tier', 'owner'];
  const DATA_FILTERS = [
    /* Three PRESETS — saved custom filters the app ships. Each carries its
       answer, field by field, and the bound source applies it: none is a
       field a menu chip below also filters.
       TRAP T-a-toggle-is-a-clause-not-a-value
       TRAP T-a-saved-filter-is-its-readings */
    /* "Has open tickets", not "Open tickets": the number FIELD carries that
       name, and the two now sit in one add/remove list. */
    { id: 'has-tickets', label: 'Has open tickets', type: 'data', removable: true,
      readings: { openTickets: { op: 'gt', text: '0' } } },
    { id: 'at-risk', label: 'At risk', type: 'data', removable: true,
      readings: { health: { op: 'lt', text: '60' } } },
    { id: 'unassigned', label: 'Unassigned', type: 'data', removable: true,
      readings: { owner: { op: 'eq', picked: ['Unassigned'] } } },
    /* The data scope's own fields, each as it is DECLARED. Region is a GLOBAL
       filter in the header instead: two chips for one field make the reader
       guess which is in force. */
    ...DATA_FIELDS.map((f) => ({ ...source.filterDef(f), type: 'data', removable: true })),
    /* No `created` chip here: the header's "Created date" already filters that
       field at VIEW scope, and one field lives in exactly ONE scope.
       TRAP T-component-extends-view-never-alters-it */
  ];
  /* Kept: the registry is told what this bar holds once it has TAKEN the
     list, and `populate()` lands after the bar's first render. */
  const qftFilled = qft.populate(DATA_FILTERS);

  /* THE FIELDS EACH SCOPE HAS, AND HOLDS. The grid's are its columns; the
     VIEW's are every component's, because any field may be raised to narrow
     everything. Each bar's chips at the start are what its scope holds; after
     that, each bar reports its own. TRAP T-up-is-open-down-is-closed
     TRAP T-a-bar-reports-its-holds */
  source.offer('data', columns.map((c) => c.field));
  source.hold(VIEW_SCOPE, ['customer', 'region', source.timeField].filter(Boolean));
  source.hold('data', DATA_FIELDS);
  // …and its presets, each off. TRAP T-a-saved-filter-is-its-readings
  source.answer('data', {}, Object.fromEntries(DATA_FILTERS.filter((f) => f.readings).map((f) => [f.id, false])));

  /** What a bar may still add: what it has no chip for — so a restore can
   *  draw a held field's chip from it — the reader's own, so removable. The
   *  data bar is never offered what the header holds.
   *  TRAP T-component-extends-view-never-alters-it */
  const addList = (scope, bar) => source.addable(scope, bar?.heldFields ?? [])
    .map((d) => ({ ...d, removable: true }));
  /* THE READER'S OWN saved filters, offered at the bottom of Add, under Custom.
     TRAP T-saved-filters-are-the-custom-section */
  const savedDefs = () => Object.entries(loadSavedFilters('customers')).map(([id, saved]) => ({
    id: `custom:${id}`, label: saved.label, readings: saved.readings, editable: true,
  }));
  /** Both Add lists — each noting where a field lives, which a raise changes. */
  const headerBar = header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
  const offerAdds = () => {
    qft.available([...addList('data', qft).map((d) => ({ ...d, type: 'data' })), ...savedDefs()]);
    header?.available(addList(VIEW_SCOPE, headerBar));
  };
  offerAdds();
  /* EVERY saved filter's readings, told to the source — a restored Query says
     only which are ON. TRAP T-a-saved-filter-is-its-readings */
  for (const f of [...DATA_FILTERS, ...savedDefs()]) {
    if (f.readings) source.declarePreset(f.id, f.readings, { label: f.label, editable: !!f.editable });
  }

  /* The WHITELIST still decides. `null` is "everything this bar offers", which
     is what this example wants; a list here would narrow it for a role, a
     context or a fetch without the bar knowing why.
     TRAP T-an-allow-list-is-a-filter-not-an-order */
  qft.allowFields(null);

  /* The leading Group and Sort chips — how the grid is ARRANGED. Their own
     events, so a group/sort pick is never mistaken for a filter change. */
  const organiseCols = columns.map((c) => ({ field: c.field, label: c.header }));
  qft.organise({ group: organiseCols, sort: organiseCols });

  /* Plan radio group in the dialog. */
  planGroup.populate(plans.map((p) => ({ value: p.toLowerCase(), label: p })));

  /* The SAME organisations the Customer chip offers, so a record can never be
     saved against one the filter does not know.
     TRAP T-a-chip-filters-the-values-the-data-has */
  custField.populate(customerOrgs.map((v) => ({ value: v, label: v })));

  /* ONE AbortController for the whole Context — every bind and listener takes
     its `signal`. Without a teardown the source keeps pushing rows into
     components the router has already removed. */
  const page = new AbortController();
  const signal = page.signal;

  /* TOOLBARS or PANEL is the provider's, for every page: it hears either bar's
     Configure, steps the bars back, and opens the panel.
     TRAP T-the-provider-owns-the-panel-mode */

  /* THE PANEL ASKS for its scopes (`data-scope="view data"`): the source draws
     each whole and hears its answers, its Add and Remove, its Apply and
     Discard, and its Group and Sort. TRAP T-a-panel-asks-for-its-scopes
     TRAP T-the-panel-reports-its-own-reading · TRAP T-one-query-one-owner */

  /** The bar that holds a scope's saved filters. */
  const barFor = (scope) => (scope === VIEW_SCOPE ? headerBar : qft);

  /* SAVED FILTERS FROM THE PANEL, which answers for the bar in panel mode.
     Each is a REQUEST, as Add and Remove are: the BAR owns the list.
     TRAP T-the-panel-saves-a-whole-scope */
  panel?.setAttribute('data-saveable', '');
  signal.addEventListener('abort', () => panel?.removeAttribute('data-saveable'), { once: true });
  panel?.addEventListener('filter-save', (e) => void saveAndPack(e.detail), { signal });
  panel?.addEventListener('filter-edit', (e) => void barFor(e.detail.scope)?.unpackFilter?.(e.detail.id), { signal });
  panel?.addEventListener('filter-delete', (e) => barFor(e.detail.scope)?.deleteFilter?.(e.detail.id), { signal });

  /* ROW ACTIONS declared ONCE. The grid draws them in its pinned trailing
     column and the toolbar reads the same list back via `grid.actionsFor(n)`,
     so the two cannot disagree. `multi` is what survives a multi-row
     selection — deleting five is one action, editing five is not. */
  const ROW_ACTIONS = [
    { id: 'edit', label: 'Edit', icon: 'pencil' },
    { id: 'delete', label: 'Delete', icon: 'trash', multi: true, danger: true },
  ];

  /* `as` adapts the shape at the binding. `ignore` on filter-change because
     the GRID owns that one: its secondary header row filters the rows it holds,
     so a keystroke costs no re-query. Letting the source filter too would draw
     the same narrowing twice, in two places. TRAP T-ignore-is-the-scalpel */
  /* THE WHOLE COLUMN, not the drawn page. A heading's filter menu built from
     the rows on screen is a one-way door: narrow on another field and three of
     four owners vanish from the Owner menu with no way to tick them back.
     TRAP T-unavailable-value-sorts-below-a-divider */
  /* A WALL of values is asked a CONDITION, never ticked — and it opens on
     "Contains", which is the question a reader really asks of an address.
     TRAP T-a-filter-answers-by-values-conditions-or-both */
  const gridColumns = columns.map((c) =>
    (typedColumn(c) ? { ...c, custom: 'only', op: 'contains' } : c));

  grid.setAttribute('data-column-values', columns
    .filter((c) => (c.type ?? 'text') === 'text' && !typedColumn(c))
    .map((c) => `${c.field}:${valuesOf(c.field).join('|')}`)
    .join('\n'));

  /* THE GRID AND THE PAGER ASK — the app's `sherpa-provider` answers, with
     this Context's source. The grid's columns, key and actions are its
     CONFIGURATION; its rows and groups arrive as data, its headings are the
     `data` scope (its `data-scope`). docs/PROVIDER-DESIGN.md.
     TRAP T-a-component-asks-its-provider */
  grid.columns = gridColumns;
  grid.key = 'email';
  grid.actions = ROW_ACTIONS;
  const provider = document.querySelector('sherpa-provider');
  // Gone with the Context, so the next one's components never reach this source.
  signal.addEventListener('abort', () => provider?.provide({ sources: {} }), { once: true });

  /* ── Summaries ────────────────────────────────────────────────────────
     Every tile and chart DECLARES what it needs of the rows in records.html
     and asks the provider, so one filter re-draws all of them and nothing
     here recounts. A legend reads its chart's field, and its pick narrows that
     chart alone. TRAP T-a-component-declares-its-summary

     The GAUGE alone is bound by hand: it shows RISK, not health, so low reads
     green on the left as every other gauge does — the column inverted once
     here rather than in the data. Every row, never a page, and the number
     unrounded. TRAP T-a-summary-binds-to-all-the-rows
     TRAP T-an-aggregate-returns-the-number */
  const gauge = root.querySelector('#r-gauge');
  if (gauge) source.bind(gauge, { readonly: true, rows: 'all', signal, as: (rows) => 100 - reduceRows(rows, 'mean', 'health') });
  /* The gauge legend names threshold ZONES, not a series, so no colour
     indices: a zone's colour is a status. Static, so it is populated once. */
  root.querySelector('#r-gauge-legend')?.populate([
    { label: 'Low (0–20)', status: 'success' },
    { label: 'Watch (20–40)', status: 'warning' },
    { label: 'At risk (40–100)', status: 'critical' },
  ]);

  /* THE BARS ASK for their scope — `data-scope` in the markup — and the
     provider binds each steer-only: its report is its scope's whole answer and
     its holds, turned into the query by the source's one builder.
     TRAP T-one-query-builder-in-the-data-layer · TRAP T-a-filter-report-is-the-whole-answer
     The GRID's headings answer through the source too: a heading's answer is
     its field's, a new one gets its normal chip, and a field the View holds
     shows read-only. TRAP T-a-heading-asks-through-the-source */
  /* SAVE PACKS: the bar asks, this page names the filter and keeps it over the
     CUSTOMER records — not over this page — and the bar shows it in place of
     the fields it came from. TRAP T-save-packs-the-fields-into-one-chip
     TRAP T-a-saved-filter-lives-with-its-data */
  const askFilterName = namePrompt(root.querySelector('#save-filter'), signal);
  /** ASK for the name in the page's own dialog. True once it is saved. */
  const saveAndPack = async ({ readings, label: was }) => {
    // After an Edit the old name is offered, so the same name updates it.
    const label = await askFilterName(was ?? '');
    if (!label) return false;
    saveFilterAs('customers', label, readings);
    source.declarePreset(`custom:${labelId(label)}`, readings, { label, editable: true });
    qft.packFilter({ id: `custom:${labelId(label)}`, label, readings });
    return true;
  };
  qft.addEventListener('filter-save', (e) => void saveAndPack(e.detail), { signal });
  // DELETE: the bar has let it go; this page forgets it. TRAP T-edit-unpacks-a-saved-filter
  qft.addEventListener('filter-delete', (e) => {
    deleteSavedFilter('customers', e.detail.id.replace(/^custom:/, ''));
    source.declarePreset(e.detail.id, undefined);
  }, { signal });
  // Grouping needs no wiring: the source writes data-group-field on every bound
  // component, and the grid draws the collapsible group rows.

  /* REMEMBER THE WHOLE VIEW ACROSS A RELOAD, as ONE snapshot — the same shape a
     preset or a shared link uses. sessionStorage, so two tabs keep their own
     filters. It restores BEFORE the first load, so the source queries once. */
  persistView('records', { source, elements: { grid } }, {
    /* What the grid contributes: the view names it, because only this view
       knows a column filter belongs in a saved view and a scroll position does
       not. Each entry is an ElementNode.state block. */
    // NOT its column filters: they are readings, and the Query restores them.
    grid: () => ({ select: [grid.selectedKeys] }),
  /* NOT the filter: the session keeps the Query (below), and a restored
     COMBINED filter is one no chip shows. TRAP T-a-reload-replays-the-readers-answers */
  }, { filter: false });

  // Where each field lives just changed, and the Add notes say where.
  source.addEventListener('scope-change', offerAdds, { signal });

  /* THE PROVIDER, given the source AND the Views: it binds every component
     that asks, puts back the session's Query — only on the View it was made
     on — or the URL's View, hears a View pick, and keeps the Query. AFTER the
     bar has its chips, which the Query is drawn onto; and after `persistView`,
     so a View's sort wins over a kept one. TRAP T-a-provider-keeps-the-views
     TRAP T-a-reload-replays-the-readers-answers · TRAP T-a-view-is-json */
  await qftFilled;
  const restored = provider?.provide({
    sources: { records: source }, views: RECORDS_VIEWS, view: startView,
    session, key: '/filters/records',
  }) ?? Promise.resolve();
  await restored;

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
    // Always written, so a second open never inherits the last record's org.
    custField.value = record?.customer ?? customerOrgs[0];
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
      /* TRANSPARENT: a bulk bar sits ON a surface, so a bordered button draws
         a box inside a box. `ghost` is not a look this system has — both
         branches of a dead ternary said it, so every bulk action fell back to
         the default and wore a grey border. */
      button.dataset.look = 'transparent';
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
    // Never blank: a record with no `customer` is invisible to the Customer
    // filter, which offers only the values the data carries.
    const customer = custField.value || customerOrgs[0];

    /* The store is the whole fix: writing announces a change, the source
       reloads, every bound component re-populates. Where the new row lands
       against the active sort, whether a filter hides it and what the page
       totals become are the source's existing work. */
    /* EDIT or ADD through one button. `editing` holds the key from the row's
       Edit action; update MERGES, so the rest of the record survives. */
    if (editing) {
      const saved = await store.update(editing, { name, email: email || editing, customer });
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
      customer,
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
