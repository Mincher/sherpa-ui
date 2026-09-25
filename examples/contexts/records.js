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
  DataSource, VIEW_SCOPE, SherpaToast, persistView, viewOptions, onViewPicked,
  countBy, reduceRows, bindSelection, andFilter, picksClause, stateClause,
  seriesBy, deltaPercent,
} from '../../dist/index.js';
import { customerStore, customersReady, customers, columns, plans, regions, customerOrgs, states }
  from './records-data.js';
import { RECORDS_VIEWS } from './records-views.js';
import { globalFilters } from './global-filters.js';


export async function init(root, { session } = {}) {
  /* The store is the APP's (records outlive a screen); the source is this
     Context's (one query over them). */
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

  /* One clause per filtered column heading. The grid reports a ready
     FilterClause and lights the column but does not narrow its own rows —
     combining them is this Context's job. Kept by field, so a second condition on
     one column replaces the first rather than fighting it. */
  const columnClauses = new Map();

  /* THREE WRITERS, THREE NAMED PARTS: the saved view, this page's chips, and
     the grid's column headings each own a `contribute` key and the source ANDs
     them — so no writer has to know about the others. */
  const pushColumns = () => {
    const clauses = [...columnClauses.values()];
    source.contribute('columns', andFilter(clauses));
  };

  /** Already on the header bar, so never offered again. */
  const HEADER_HELD = ['view', 'customer', 'region', 'dateRange'];

  /**
   * A toolbar filter def, as the PANEL takes it.
   *
   * FACTS ONLY. The panel builds its own menus from these, so nothing here
   * reaches into a bar's shadow root to find a control.
   * TRAP T-a-panel-builds-its-own-menus
   */
  const asPanelField = (f) => ({
    id: f.id,
    label: f.label,
    options: f.options,
    select: f.select,
    removable: f.removable,
    custom: f.custom,
    kind: f.kind,
    min: f.min,
    max: f.max,
    step: f.step,
    range: f.range,
    availableDates: f.availableDates,
    op: f.op,
    /* WHAT IS IN FORCE, from the bar's own read-back — so the panel opens on
       the answer the rows are under. */
    state: f.state,
    /* A PRESET has no values AND no body of its own — one question, answered
       yes or no. TRAP T-a-chip-with-no-field-is-a-preset */
    preset: !f.options?.length && !f.kind && !f.custom,
    /* A DATE is ONE chip with its menu. Its menu IS a calendar, and a calendar
       drawn inline is the whole panel. TRAP T-only-group-and-sort-stay-one-chip */
    asChip: f.kind === 'date',
  });

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
    breadcrumb: [
      // Every crumb links to a REAL page.
      { label: 'Home', href: '?context=dashboard' },
      { label: 'Records' },
    ],
    /* THE GLOBAL FILTERS — View, Customer, Region, Date range. They sit above
       every page and trickle DOWN; the bar below narrows further inside that.
       See global-filters.js. Options are DERIVED from the view definitions and
       the records, so neither can name something the data does not have.
       TRAP T-a-chip-filters-the-values-the-data-has. */
    /* The days the RECORDS carry, read off their TIME — not the default
       last-90-days, which no record in this set falls inside.
       TRAP T-a-record-has-a-time-of-its-own */
    filters: globalFilters(viewOptions(RECORDS_VIEWS, 'all'), regions, customerOrgs,
      [...new Set(customers.map((c) => c[source.timeField]))].filter(Boolean).sort()),
    /* The header's ADD list is set once the columns are known — below, from
       the same builder the grid's bar uses. TRAP T-up-is-open-down-is-closed */
  });

  /* Quick-filter chips. A chip with `options` opens a menu; one without is a
     plain on/off toggle. No `count` on the toggles — the badge means "how many
     VALUES are picked", which each menu chip sets itself. */
  const valuesOf = (field) => [...new Set(customers.map((c) => c[field]))].sort();
  /* THE VALUE THE ROW HOLDS, not a lower-cased copy. The query compares
     loosely either way, but a column heading's menu offers the raw value — so
     a lower-cased chip option meant two menus over one field held two
     different strings and could never share a selection.
     TRAP T-one-comparison-rule-for-query-and-ui */
  const asOptions = (field) =>
    valuesOf(field).map((v) => ({ value: String(v), label: String(v) }));

  /* ONE RULE for "is this a set anybody picks from", read by the bar's Add
     menu AND by the grid's column headings. Ticking is only an answer when the
     list is short enough to read; 100 distinct emails is a wall, and a search
     box over a wall only FINDS in it — it does not filter.
     TRAP T-a-wall-of-values-is-not-a-filter */
  const PICKABLE_AT_MOST = 12;
  const typedColumn = (col) =>
    (col.type ?? 'text') === 'text' && valuesOf(col.field).length > PICKABLE_AT_MOST;
  /* `removable: true` — the DATA bar is the user's own to arrange, so each menu
     chip offers "Remove filter". `commit: true` on Owner and Created only:
     chips AUTO-APPLY by default, and committing is the opt-out for a field
     whose query is expensive. Both behaviours are here side by side. */
  /* ONE LIST, read twice: the toolbar draws it as a row of chips and the
     PANEL draws it as a column. A second copy would drift the first time
     either changed. TRAP T-the-panel-is-the-toolbar-in-a-column */
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
    /* The STATUS legend's menu. A multi-select over the same field the bar
       chart splits on, so unticking a value and dimming its legend row are the
       same gesture. Not the four toggles above: those are one-tap presets, and
       this is the legend's own face.
       TRAP T-a-legend-toggle-is-a-filter */
    { id: 'status', label: 'Status', type: 'data',
      select: 'multiple', removable: true, options: asOptions('status') },
    // MULTI-select: one pick reads back as "Plan: Pro", two or more show a count.
    { id: 'plan', label: 'Plan', type: 'data',
      select: 'multiple', removable: true, options: asOptions('plan') },
    // No Region chip: it is a GLOBAL filter in the app header, and two chips for
    // one field would make the reader guess which is in force.
    { id: 'tier', label: 'Tier', type: 'data',
      select: 'multiple', removable: true, options: asOptions('tier') },
    /* COMMITTING: rows are a draft behind Apply/Cancel. And the one chip here
       that OPTS IN to custom conditions — an owner is a person's name, so "starts
       with" is a question a reader really asks. Status, Plan and Tier are
       closed sets of three or four, and get a plain list.
       TRAP T-conditions-are-opt-in-per-field */
    { id: 'owner', label: 'Owner', type: 'data', custom: true,
      select: 'multiple', removable: true, commit: true, options: asOptions('owner') },
    /* No `created` chip here: the header's "Created date" already filters that
       field at VIEW scope, and one field lives in exactly ONE scope.
       TRAP T-component-extends-view-never-alters-it */
  ];
  /* Kept: the registry is told what this bar holds once it has TAKEN the
     list, and `populate()` lands after the bar's first render. */
  const qftFilled = qft.populate(DATA_FILTERS);

  /* What the ADD chip offers: EVERY COLUMN the grid draws, minus the ones a
     scope already holds. Hand-listing four of fourteen meant most of the data
     could not be filtered at all, and the four bounds drifted from the rows.

     One field lives in exactly ONE scope, so a column the header already
     filters is not offered again here.
     TRAP T-component-extends-view-never-alters-it */
  const heldSomewhere = new Set([
    ...DATA_FILTERS.map((f) => f.id),
    ...HEADER_HELD,
    // The header's Date chip is the record's TIME under another name.
    // TRAP T-a-record-has-a-time-of-its-own
    source.timeField,
  ].filter(Boolean));

  /** A number column's real ends, and a step that gives the slider ~200 stops. */
  const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const numberFacts = (field) => {
    const nums = customers.map((c) => Number(c[field])).filter(Number.isFinite);
    const min = Math.floor(Math.min(...nums));
    const max = Math.ceil(Math.max(...nums));
    const span = max - min;
    const step = span <= 1000 ? 1 : (NICE_STEPS.find((n) => n >= span / 200) ?? 1000);
    return { kind: 'number', min, max, step };
  };

  /* A LIST or a CONDITION, from the SAME rule the grid headings read.
     TRAP T-a-condition-only-field-still-has-a-menu */
  const textFacts = (field) =>
    (typedColumn({ field })
      // CUSTOM ONLY, opening on Contains — there is no list worth ticking.
      ? { custom: 'only', op: 'contains' }
      : { select: 'multiple', options: asOptions(field) });

  /* THE FIELDS EACH SCOPE HAS. The grid's are its columns; the VIEW's are
     every component's, because any field may be raised to narrow everything.
     A component may hold only its own. TRAP T-up-is-open-down-is-closed */
  source.offer('data', columns.map((c) => c.field));

  /** One column as a filter — the SAME def whichever bar offers it. */
  const byField = new Map(columns.map((c) => [c.field, c]));
  const fieldDef = (c) => ({
    id: c.field,
    label: c.header,
    removable: true,
    ...(c.type === 'number' ? numberFacts(c.field)
      : c.type === 'date' ? { kind: 'date' }
      : textFacts(c.field)),
  });
  /** Each scope's name AS A READER SEES IT — the panel's sections and the
   *  Add notes read this, so the two cannot spell it differently. */
  const SCOPE_LABELS = { [VIEW_SCOPE]: 'App header', data: 'Customer records' };

  /** What a scope may still add: the fields it HAS, less what it holds.
   *  COLUMNS only, so Group and Sort are never offered at the view — they
   *  arrange one component. TRAP T-a-bar-offers-only-what-its-scope-holds
   *  TRAP T-group-and-sort-are-component-scope */
  const addable = (scope, taken) => source.fields(scope)
    .filter((f) => !taken.has(f) && byField.has(f))
    .map((f) => {
      /* WHERE IT LIVES NOW, when that is somewhere else — adding it here MOVES
         it, and the reader should know before ticking. */
      const at = source.scopeOf(f);
      const note = at && at !== scope ? `in ${SCOPE_LABELS[at] ?? at}` : undefined;
      return { ...fieldDef(byField.get(f)), ...(note ? { note } : {}) };
    });

  const DATA_AVAILABLE = addable('data', heldSomewhere).map((d) => ({ ...d, type: 'data' }));
  qft.available(DATA_AVAILABLE);

  /* UP IS OPEN: the header offers every field any component has — including
     one the grid's bar holds, because raising a filter is the point. What the
     header ALREADY holds is left out. */
  const viewHeld = () => new Set([
    'customer', 'region', source.timeField,
    /* A chip the reader added is named for its field; the Date chip is the
       record's time. `view` is no field, and `addable` drops it. */
    ...((header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]')?.heldIds ?? [])
      .map((id) => (id === 'dateRange' ? source.timeField : id))),
  ].filter(Boolean));
  header?.available(addable(VIEW_SCOPE, viewHeld()));

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

  /* Three components, ONE source: each READS (rows plus view state as data-*)
     and WRITES (its noun-verb events steer the source). */

  /* ONE AbortController for the whole Context — `bind`, `persistView` and
     `onViewPicked` all take a `signal`. Without a teardown the source keeps
     pushing rows into components the router has already removed. */
  const page = new AbortController();
  const signal = page.signal;

  /* THE FILTER PANEL — the same filters, in a column. It reads the SAME
     definitions the bars read; it never reaches into a toolbar.
     TRAP T-the-panel-is-the-toolbar-in-a-column */
  const fillPanel = () => {
    const viewBar = header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
    /* CREATED DATE moves INTO the panel while it is open — it has a menu, so
       the panel draws that body. View, Customer and Region stay on the header:
       they are global, and the View chip is not a filter at all.
       TRAP T-the-view-chip-stays-on-the-header */
    const stays = ['view', 'customer', 'region'];
    panel?.populate([
      {
        scope: 'view',
        label: 'View filters',
        /* The VIEW chip is not a filter, and Customer and Region are GLOBAL —
           all three stay on the app header.
           TRAP T-the-view-chip-stays-on-the-header */
        filters: (viewBar?.held ?? [])
          .filter((f) => !stays.includes(f.id))
          .map(asPanelField),
        // The SAME list the header's Add offers. TRAP T-up-is-open-down-is-closed
        available: addable(VIEW_SCOPE, viewHeld()).map(asPanelField),
      },
      {
        scope: 'data',
        /* The CONTENT's own name, not "this context" — a reader with two grids
           on one page has to know which one a section answers for.
           TRAP T-a-scope-is-named-for-its-content */
        label: SCOPE_LABELS.data,
        /* WHAT THE BAR HOLDS NOW, not the list it was born with. `DATA_FILTERS`
           never learns about a removal or an add, so the panel kept drawing a
           field the reader had taken off and never drew one they added.
           TRAP T-a-panel-adds-through-the-bar-that-owns-the-list */
        filters: (qft.held ?? []).map(asPanelField),
        available: (qft.offering ?? []).map(asPanelField),
        // HOW the grid arranges its rows, above the filters.
        group: organiseCols,
        sort: organiseCols,
        sortField: grid.dataset['sortField'] ?? undefined,
        groupField: grid.dataset['groupField'] ?? undefined,
      },
    ]);
  };

  /* EITHER bar's Configure button toggles the panel, and the panel is filled
     the moment it opens — the bars may have changed since last time. */
  /** TOOLBARS or PANEL, remembered for the session.
   *  TRAP T-panel-mode-hides-what-the-panel-answers */
  const setMode = (mode) => session?.set?.('/filters/mode', mode);

  const togglePanel = () => {
    if (!panel) return;
    if (panel.hasAttribute('data-open')) { panel.close(); return; }
    fillPanel();
    panel.open();
    setMode('panel');
    /* A field the panel draws is HIDDEN on its bar: two controls over one
       field make a reader guess which is in force.
       TRAP T-the-view-chip-stays-on-the-header */
    syncPanelled(true);
    setPanelMode(true);
  };

  /** Both bars step back while the panel answers for them.
   *  TRAP T-panel-mode-hides-what-the-panel-answers */
  const setPanelMode = (on) => {
    qft.toggleAttribute('data-panel-mode', on);
    header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]')
      ?.toggleAttribute('data-panel-mode', on);
  };

  /** Hide the HEADER chips the panel is drawing. The data bar goes entirely,
   *  so it needs none of this. TRAP T-panel-mode-hides-what-the-panel-answers */
  const syncPanelled = (on) => {
    const viewBar = header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
    for (const chip of viewBar?.shadowRoot?.querySelectorAll('.chips > .chip') ?? []) {
      const id = chip.dataset['id'];
      chip.toggleAttribute('data-panelled', on && !['view', 'customer', 'region'].includes(id));
    }
  };

  qft.addEventListener('filter-configure', togglePanel, { signal });
  header?.addEventListener('filter-configure', togglePanel, { signal });
  panel?.addEventListener('filter-panel-close', (e) => {
    syncPanelled(false);
    setPanelMode(false);
    /* Only a READER's close is a choice worth remembering. A window too narrow
       to hold the panel is not — storing that would let the window size forget
       what they asked for.
       TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
    if (e.detail?.reason !== 'width') setMode('toolbars');
  }, { signal });

  /* WIDE AGAIN, and the window was what took the panel away. Give it back. */
  panel?.addEventListener('filter-panel-reopen', () => {
    void (async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      fillPanel();
      panel.open();
      if (panel.hasAttribute('data-open')) {
        syncPanelled(true);
        setPanelMode(true);
      }
    })();
  }, { signal });

  /* RESTORE. The panel opens itself if the reader left it open — after the
     bars are populated, because it reads their chips. */
  if (session?.get?.('/filters/mode') === 'panel') {
    /* TWO FRAMES, not a microtask: `bar.held` carries each field's READING,
       and a cloned `<sherpa-menu>` stamps nothing until it upgrades — so a
       read now reports every field unanswered and the panel opens with
       nothing ticked.
       TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    void (async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      fillPanel();
      panel?.open();
      // `open()` refuses below its breakpoint, so follow what it actually did.
      if (panel?.hasAttribute('data-open')) {
        syncPanelled(true);
        setPanelMode(true);
      }
    })();
  }

  /* APPLY. The panel reports every field in ONE event; each one goes to the
     source exactly as its chip would send it. */
  panel?.addEventListener('quick-filter-change', (e) => {
    /* THE PANEL'S OWN WHOLE ANSWER — picked values AND conditions. It used to
       report ticks only and then reach into the bar to fix that up; the bar is
       told here instead, and neither component knows the other exists.
       TRAP T-the-panel-reports-its-own-reading */
    const byScope = e.detail.readings ?? {};
    for (const [, fields] of Object.entries(byScope)) {
      for (const [id, reading] of Object.entries(fields)) {
        const picked = reading.picked ?? [];
        // PRESETS are toggles, not a field: relay each through its own chip.
        if (id === 'presets') {
          for (const chip of qft.shadowRoot?.querySelectorAll('.chips > .chip') ?? []) {
            const want = picked.includes(chip.dataset['id']);
            if (chip.hasAttribute('data-current') !== want) chip.click();
          }
          continue;
        }
        /* THE FIELD'S OWN SLOT for a field the source owns; the BAR's chip
           otherwise. `setChipReading` carries the conditions too, which
           `setChipValues` could not — that is why the panel used to tick the
           chip itself. */
        if (FIELD_CHIPS.has(id)) source.select(id, picked, reading);
        else qft.setChipReading(id, reading);
      }
    }
  }, { signal });

  /* ADD and REMOVE are REQUESTS: the BAR owns the list. */
  /* A BAR REBUILDS ASYNCHRONOUSLY: `items()` on a freshly cloned menu stamps
     nothing until the element upgrades, so `held` read straight after
     `addFilters` or `removeFilter` reports every field unanswered.
     TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
  const refill = async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    fillPanel();
    syncPanelled(true);
  };

  /* THE SCOPE SAYS WHICH BAR. Remove used to skip this and always ask the data
     bar, so unticking a VIEW filter reported correctly and changed nothing —
     the bar it asked had never held it. */
  const barFor = (scope) => (scope === 'view'
    ? header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]')
    : qft);

  panel?.addEventListener('filter-add-request', (e) => {
    barFor(e.detail.scope)?.addFilters?.(e.detail.ids);
    void refill();
  }, { signal });

  panel?.addEventListener('filter-remove', (e) => {
    barFor(e.detail.scope)?.removeFilter?.(e.detail.id);
    void refill();
  }, { signal });

  /* GROUP and SORT arrange the rows; they are not filters. THROUGH THE SOURCE,
     not onto the grid: `bind()` writes `data-group-field` and `data-sort-field`
     on every bound component from the source's own state, so an attribute
     written straight onto the grid is overwritten by the next requery — and a
     panel Group pick did nothing at all. */
  panel?.addEventListener('group-change', (e) => {
    source.setGroup(e.detail.field || null);
  }, { signal });
  panel?.addEventListener('sort-change', (e) => {
    /* SUSPEND, never clear. `setSort(null)` moves the column to the source's
       own memory so one more click resumes it; `clearSort()` would forget it,
       and the tri-state cycle would have nothing to come back to.
       TRAP T-grid-suspend-is-not-clear */
    source.setSort(e.detail.field ?? null, e.detail.direction ?? 'asc');
  }, { signal });

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

  source.bind(grid, {
    /* The COLUMN says how it is answered. The grid never counts the values
       itself — how many is too many is a question about the data.
       TRAP T-a-wall-of-values-is-not-a-filter */
    /* THE GROUPS COME FROM THE SOURCE, not from the rows the grid holds. It
       pages screen lines when grouped, so its own count would be a page count.
       TRAP T-a-group-is-a-data-layer-concept */
    as: (rows, src) => ({
      columns: gridColumns, rows, key: 'email', actions: ROW_ACTIONS,
      groups: src.groups(),
    }),
    ignore: ['filter-change'],
    signal,
  });
  source.bind(pager, { signal });

  /* ── Summaries ────────────────────────────────────────────────────────
     Every tile and chart is the SAME rows, counted a different way, so one
     filter re-draws all of them and nothing recounts by hand.

     `rows: 'all'` is what makes them right: the default bind hands over the
     PAGE, and a chart counting 25 of 100 looks perfectly reasonable.
     TRAP T-a-summary-binds-to-all-the-rows */
  const summary = (sel, as) => {
    const el = root.querySelector(sel);
    if (el) source.bind(el, { readonly: true, rows: 'all', as, signal });
  };

  const money = (n) => `$${Math.round(n).toLocaleString('en-GB')}`;

  /* The twelve months of 2024, the range `created` is generated over. A series
     needs its points declared, or a month nobody joined in would be missing
     rather than zero and the line would lie about the gap. */
  const MONTHS = Array.from({ length: 12 },
    (_, i) => `2024-${String(i + 1).padStart(2, '0')}`);
  const month = (rows) => rows.map((r) => ({ ...r, month: String(r.created).slice(0, 7) }));

  /* A tile handed only a label and a value is GREY: it derives its trend from
     the delta and its status from the trend, so without a series there is
     nothing to colour and no sparkline to draw.
     TRAP T-a-delta-is-derived-not-declared */
  const tile = (label, value, values) => ({
    label, value, values, deltaPercent: deltaPercent(values) ?? undefined,
  });

  /* Each tile is the same rows over the same months, reduced its own way. */
  const overMonths = (rows, kind, field) =>
    seriesBy(month(rows), 'month', MONTHS, 'series', { kind, valueField: field }).values;

  summary('#m-customers', (rows) =>
    tile('Customers', rows.length, overMonths(rows, 'count')));
  summary('#m-spend', (rows) =>
    tile('Total spend', money(reduceRows(rows, 'sum', 'spend')),
      overMonths(rows, 'sum', 'spend')));
  summary('#m-seats', (rows) =>
    tile('Seats', reduceRows(rows, 'sum', 'seats').toLocaleString('en-GB'),
      overMonths(rows, 'sum', 'seats')));
  summary('#m-tickets', (rows) =>
    tile('Open tickets', reduceRows(rows, 'sum', 'openTickets'),
      overMonths(rows, 'sum', 'openTickets')));

  /* A chart and its legend share ONE array — a legend row IS a chart datum.
     Sharing also keeps the source's skip-if-unchanged guard, which compares by
     identity. The declared `order` keeps a category's colour when a filter
     removes the one above it. TRAP T-a-category-keeps-its-colour */
  const byStatus = (rows) => countBy(rows, 'status', { order: states });
  const byPlan = (rows) => countBy(rows, 'plan', { order: plans });

  /* A LEGEND keeps every category, at zero when a filter empties it: a row
     that VANISHES reads as a bug, and the reader loses the way back — the
     legend is how they toggle that category on again.
     TRAP T-a-legend-row-goes-inactive-it-never-vanishes */
  const legendStatus = (rows) => countBy(rows, 'status', { order: states, includeEmpty: true });
  const legendPlan = (rows) => countBy(rows, 'plan', { order: plans, includeEmpty: true });

  summary('#r-bar', byStatus);
  summary('#r-bar-legend', legendStatus);
  summary('#r-donut', byPlan);
  summary('#r-donut-legend', legendPlan);

  /* TURNING A LEGEND ROW OFF IS A FILTER, not a drawing trick. The old wiring
     called setBarHidden() and the bar vanished from that ONE chart; here the
     click writes the FIELD's selection, so the other charts, the tiles, the
     grid and its pager all narrow with it.

     `bindSelection` is the SAME loop a chip or a column heading uses — there
     is no legend-specific module, because legend filtering is just filtering.
     A legend's `off` is the inverse of picked, and keeping at least one row on
     is the component's own business.
     TRAP T-a-legend-toggle-is-a-filter
     TRAP T-one-field-one-filter-menu */
  const bindLegend = (el, field, values) => el && bindSelection(el, source, {
    field,
    values,
    // Read the LEGEND, not the event: a roll-up row stands for several values.
    read: (l) => values.filter((v) => !l.off.includes(v)),
    draw: (l, picked) => {
      l.off = picked.length ? values.filter((v) => !picked.includes(v)) : [];
    },
    event: 'legend-item-click',
    /* COMPONENT scope: a series switched off filters THIS chart and nothing
       else — not the grid, not a sibling chart. It is still subject to the
       View filter, which does cascade down, so a series the View has already
       removed cannot be switched back on here.
       TRAP T-a-filter-applies-down-its-scope */
    reach: 'component',
    // One part per legend, or the second would replace the first.
    key: `legend:${el.id || field}`,
    signal,
  });
  bindLegend(root.querySelector('#r-bar-legend'), 'status', states);
  bindLegend(root.querySelector('#r-donut-legend'), 'plan', plans);

  /* The gauge reads ONE number, unrounded — rounding is presentation.
     TRAP T-an-aggregate-returns-the-number */
  /* RISK, not health — so low reads green on the left, as every other gauge
     does. Same column, inverted once here rather than in the data. */
  summary('#r-gauge', (rows) => 100 - reduceRows(rows, 'mean', 'health'));
  /* The gauge legend names THRESHOLD ZONES, not a series, so no colour
     indices: a zone's colour is a status. Static, so it is populated once. */
  root.querySelector('#r-gauge-legend')?.populate([
    { label: 'Low (0–20)', status: 'success' },
    { label: 'Watch (20–40)', status: 'warning' },
    { label: 'At risk (40–100)', status: 'critical' },
  ]);

  /* STEER-ONLY: the toolbar's populate() means "here are your CHIPS", so a
     plain bind() overwrites the bar with records. Its events still reach the
     source and the state attributes still arrive — which is what keeps its Sort
     chip and the grid's header arrow two views of one value. `ignore` on the
     FILTER event only, because translating chips is view knowledge; sort and
     group the source handles itself. */
  /* ONE FIELD, ONE SELECTION. The SOURCE holds what is picked for a field, so
     a chip, a column heading and a legend read the same answer instead of each
     keeping a copy. Declaring the values is what lets them offer the same rows
     — and the same STRINGS, which is what made two menus shareable at all.
     TRAP T-one-field-one-filter-menu */
  const FIELD_CHIPS = new Set(['status', 'plan', 'tier', 'owner']);
  for (const field of FIELD_CHIPS) source.declareValues(field, valuesOf(field));

  /* Every control over a field re-reads when ANY of them changes it. The grid's
     column menu is the one that had no way to hear before. */
  source.addEventListener('selection-change', (e) => {
    const { field } = e.detail;
    const state = source.selection(field);
    const picked = state.values.filter((v) => v.state === 'picked').map((v) => v.value);
    /* A SUSPENDED field keeps its values and applies none of them, so steering
       the chip would switch it straight back on — the chip is already showing
       exactly this, which is what suspending means. Its picks are safe; only
       the APPLYING stops. TRAP T-grid-suspend-is-not-clear */
    if (state.fieldState === 'suspended') return;
    /* CONDITIONS STEER TOO. This used to `return` for a field answered by rows,
       so a condition typed in one place reached the data and NO other control
       over the same field — the chip stayed blank while it was filtering.
       `setChipReading` is the only write path that can carry rows.
       TRAP T-a-conditioned-chip-answers-with-its-clause */
    // SILENT writes, so none of them echoes back as another change.
    /* …but NEVER into a SUPERSEDED chip. The view owns that field now, and the
       chip keeps the reader's picks for when the view lets go — writing the
       grid's now-empty answer into it threw them away on every raise.
       TRAP T-a-superseded-chip-suspends-it-is-never-removed */
    if (!(qft.superseded ?? []).includes(field)) {
      qft.setChipReading(field, {
        picked,
        ...(state.conditions.length ? { conditions: state.conditions } : {}),
      });
    }
    /* The grid's heading takes a ready CLAUSE, which is the one shape that
       carries either answer. */
    grid.setColumnFilter(field, stateClause(state) ?? null);
  }, { signal });

  /* NO `ignore` for `quick-filter-change`: the bound source asks the bar for
     its `readings` — and its presets' `savedReadings` — and applies them
     itself, which is the whole point of one query builder.
     TRAP T-one-query-builder-in-the-data-layer */
  source.bind(qft, { steerOnly: true, signal });
  qft.addEventListener('quick-filter-change', (e) => {
    /* An external chip's body is a TOGGLE: off means "stop applying this", not
       "delete it" — only REMOVE deletes. So this suspends and restores the
       clause and never touches the chip. An external chip shows in neither
       `active` nor `values`, so the toolbar reports it in `external`. */
    for (const [id, on] of Object.entries(e.detail.external ?? {})) {
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
     ready; this Context decides what it means for the query, because only it knows
     what else is filtering. It also goes onto the toolbar as a chip, so a
     sideways scroll still shows the view is narrowed and by what. */
  grid.addEventListener('column-filter-change', (e) => {
    const { field, header, clause, label } = e.detail;

    /* A FIELD THE SOURCE OWNS. The heading writes the same selection a chip
       writes, so the two can never say different things — and no second
       `col:` chip appears beside the one already on the bar. Only a LIST
       condition maps onto a selection; "Contains ana" has no ticks, so it
       still becomes its own chip below. TRAP T-one-field-one-filter-menu */
    if (FIELD_CHIPS.has(field)) {
      const picks = Array.isArray(clause?.[2]) ? clause[2].map(String)
        : clause?.[1] === 'eq' ? [String(clause[2])]
        : null;
      if (picks || !clause) {
        source.select(field, picks ?? []);
        return;
      }
    }

    if (clause) columnClauses.set(field, clause);
    else columnClauses.delete(field);
    /* The chip first, then the contribution. `quick-filter-change` now lands
       in each FIELD's own slot and leaves named parts alone, so this order is
       no longer load-bearing — it just reads in the order it happens.
       TRAP T-one-query-builder-in-the-data-layer */
    /* THE CONDITION, not only the phrase. Without it the chip's caret read
       "Contains: ana" and opened nothing at all.
       TRAP T-an-external-chip-caret-must-open-its-condition */
    qft.addExternalFilter({
      id: `col:${field}`, label: header, value: label,
      ...(clause ? { op: clause[1] } : {}),
      ...(typeof clause?.[2] === 'string' ? { text: clause[2] } : {}),
    });
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
  /* The Date chip filters the RECORD'S TIME, whatever this dataset calls it.
     TRAP T-a-record-has-a-time-of-its-own */
  const HEADER_FIELDS = { customer: 'customer', region: 'region', dateRange: source.timeField };

  /* A chip the reader ADDED is named for its own field, so the id IS the field.
     `view` still narrows nothing — it is the saved-view selector. */
  const ROW_FIELDS = new Set(Object.keys(customers[0] ?? {}));
  const headerField = (id) => HEADER_FIELDS[id] ?? (ROW_FIELDS.has(id) ? id : '');

  /* Which FIELDS the header bar holds — every chip ON IT, on or off. A chip
     sitting off still owns its field, so this follows the chips PRESENT, not
     `quick-filter-change`, which reports only the ON ones. */
  const viewFields = () => {
    // The bar's own read-back — never its shadow root. TRAP T-a-panel-builds-its-own-menus
    const bar = header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
    return (bar?.heldIds ?? []).map(headerField).filter(Boolean);
  };

  /* The component bar SUSPENDS any field the view took. It keeps the chip and
     the reader's picks; both come back when the view lets the field go.
     TRAP T-a-superseded-chip-suspends-it-is-never-removed */
  const syncScopes = () => {
    /* TELL THE REGISTRY what each scope holds, so `debugState()`, `scopeOf()`
       and `move()` answer from the truth. A field the view took has LEFT the
       grid's scope — the chip below only DRAWS that, greyed.
       TRAP T-up-is-open-down-is-closed */
    const raised = viewFields();
    source.hold(VIEW_SCOPE, raised);
    source.hold('data', (qft.heldIds ?? []).filter((id) => !raised.includes(id)));
    /* The App Header owns these fields now, and the chips below say so rather
       than going quietly grey. TRAP T-an-inactive-chip-says-where-its-filter-went */
    qft.supersede(raised, SCOPE_LABELS[VIEW_SCOPE]);
    // The header's Add notes say where each field lives — which just changed.
    header?.available(addable(VIEW_SCOPE, viewHeld()));
  };

  header?.addEventListener('quick-filter-change', (e) => {
    /* `values` carries TWO shapes and `scope` says which — a bare string[] from
       a chip, a Record<id, string[]> from the bar. The toolbar catches a chip's
       in capture and re-emits the bar shape, so this only ever sees the record;
       the guard makes that a rule rather than a coincidence.
       TRAP T-values-carries-two-shapes */
    if (e.detail?.scope !== 'bar') return;
    const readings = {};
    for (const [id, values] of Object.entries(e.detail.values ?? {})) {
      const field = headerField(id);
      if (field && values?.length) readings[field] = { picked: values };
    }
    // Its OWN key, so it ANDs with the chips, the columns and a saved view.
    source.apply(readings, { reach: 'component', key: 'global' });
  }, { signal });

  /* RAISING CARRIES THE ANSWER. A field the view takes from a component keeps
     what the reader picked there. Without this the new header chip arrived
     EMPTY and the grid's went grey, while the rows stayed filtered by a pick
     no visible chip showed. TRAP T-up-is-open-down-is-closed */
  const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  header?.addEventListener('filter-add', async (e) => {
    const headerBar = header.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
    // READ FIRST — once superseded, the grid's readings skip the field.
    const below = qft.readings ?? {};
    const carried = [];
    for (const id of e.detail?.ids ?? []) {
      const field = headerField(id);
      const from = field ? source.scopeOf(field) : null;
      if (!from || from === VIEW_SCOPE) continue;
      source.move(field, from, VIEW_SCOPE);
      if (below[field]) carried.push([id, below[field]]);
    }
    syncScopes();
    // The grid re-announces WITHOUT the raised field, so its selection clears.
    qft.report();
    if (!carried.length) return;
    /* The new chip's menu stamps its rows a frame or two after it lands.
       TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    await twoFrames();
    for (const [id, reading] of carried) headerBar?.setChipReading(id, reading);
    headerBar?.report();
  }, { signal });
  /* LOWERING lets the field go: the component's chip comes back with its OWN
     kept picks. TRAP T-a-superseded-chip-suspends-it-is-never-removed */
  header?.addEventListener('filter-remove', () => { syncScopes(); qft.report(); }, { signal });
  for (const event of ['filter-add', 'filter-remove']) {
    qft.addEventListener(event, syncScopes, { signal });
  }
  /* AFTER the grid bar has its list — at init it has none yet, and an empty
     hold() FORGETS the scope. TRAP T-up-is-open-down-is-closed */
  void qftFilled.then(syncScopes);

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
          /* AND ONTO THE BAR. `setColumnFilter` is silent by design, so a view
             that restores a column filter fires no `column-filter-change` and
             the chip an interaction would have added never appears — the grid
             narrows and nothing says why.

             A FIELD_CHIPS field is drawn by its own chip ONLY where the clause
             is a pick list, which is all `source.select` can hold. `At risk`
             restores `status ne churned`, which is not — so it needs a `col:`
             chip like any other condition, or nothing on the bar reports it.
             That is the same split the live `column-filter-change` handler
             makes. TRAP T-a-restored-filter-still-needs-its-chip */
          const picks = Array.isArray(clause?.[2]) ? clause[2].map(String)
            : clause?.[1] === 'eq' ? [String(clause[2])]
            : null;
          if (FIELD_CHIPS.has(col.field) && (picks || !clause)) {
            source.select(col.field, picks ?? []);
            continue;
          }
          qft.addExternalFilter({
            id: `col:${col.field}`,
            label: col.header,
            value: clause ? grid.columnLabel(col.field) : null,
          });
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
