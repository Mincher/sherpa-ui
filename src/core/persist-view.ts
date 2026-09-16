/**
 * Keep a DataSource's view state across a page reload.
 *
 * An accidental refresh throws away every filter, sort and page a person set,
 * and they start again. This is the smallest thing that stops that.
 *
 *   const off = persistViewState(source, 'records');
 *
 * It is a HELPER, not a feature of `DataSource`. Where a view state is kept —
 * and whether it should survive a reload at all — is the host's decision: a
 * dashboard may want it, a wizard may not, and a saved-views table on a server
 * is a third answer. A source that wrote to storage itself would make that
 * choice for every app that ever binds one.
 *
 * `sessionStorage` BY DEFAULT, and that is the important part: two tabs on the
 * same screen filtered differently is a feature, not a bug, and `localStorage`
 * would make them fight. Pass `{ shared: true }` for the rarer case where a
 * filter genuinely belongs to the person rather than to the tab.
 */
import type { DataSource, ViewState } from './data-source.js';
import { applyState } from './render-element.js';
import { renderView, type ViewDefinition, type RenderedView } from './render-view.js';

export interface PersistOptions {
  /**
   * Share the state across TABS via localStorage rather than keeping it per
   * tab. Off by default — see the note above.
   */
  shared?: boolean;
  /**
   * Stop persisting when this aborts — the same platform token `bind()` takes.
   *
   * One controller can then tear down every binding, listener and persister a
   * view made, instead of a list of teardown functions to keep in step.
   */
  signal?: AbortSignal;
}

/** The key prefix, so a host's own storage keys cannot collide with these. */
const PREFIX = 'sherpa:view:';

/**
 * Web Storage throws in a private window, with site data blocked, and during
 * preview or thumbnail capture — so every access is wrapped. A failure means
 * the state is not kept, never that the page breaks.
 */
function storage(shared: boolean): Storage | null {
  try {
    return shared ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Keep a whole view — the query AND every component's state — across a reload.
 *
 *   const off = persistView('records',
 *     { source, elements: { grid } },
 *     { grid: () => ({ setColumnFilter: …, select: [grid.selectedKeys] }) });
 *
 * Restores on the way in, then saves on every change.
 *
 * ONE SNAPSHOT, not a key per concern. This started as two: `persistViewState`
 * for the source and a hand-written `sessionStorage` line for the grid's column
 * filters — with a third needed for selection and a fourth for the toolbar's
 * chips. Four shapes, four restore paths, one idea. A saved view, a preset, a
 * deep link and an agent's request are the same object, so they get the same
 * mechanism.
 *
 * WHAT EACH ELEMENT CONTRIBUTES is a function the caller supplies, because only
 * the caller knows which of a component's properties are view state and which
 * are incidental. Guessing would restore someone's scroll position a week
 * later. Each returns an `ElementNode.state` block — the same shape
 * `renderElement` takes, so a saved view and a preset are interchangeable.
 *
 * Returns a function that stops saving, the same way `bind()`'s does.
 */
export function persistView(
  name: string,
  targets: {
    source?: DataSource;
    elements?: Record<string, HTMLElement>;
  },
  contributors: Record<string, () => Record<string, unknown>> = {},
  options: PersistOptions = {},
): () => void {
  const store = storage(options.shared ?? false);
  const key = PREFIX + name;
  if (!store) return () => {};

  // RESTORE FIRST, so the source loads once with the remembered state rather
  // than loading empty and then loading again.
  try {
    const raw = store.getItem(key);
    if (raw) applyViewSnapshot(JSON.parse(raw) as ViewSnapshot, targets);
  } catch {
    // Unreadable, not JSON, or a shape this code no longer understands. A view
    // that cannot be restored is one the user starts without — exactly where
    // they were before this existed.
    try { store.removeItem(key); } catch { /* storage unavailable */ }
  }

  const save = (): void => {
    const snapshot: ViewSnapshot = { v: 1 };
    if (targets.source) snapshot.source = targets.source.state;

    const elements: Record<string, Record<string, unknown>> = {};
    for (const [id, contribute] of Object.entries(contributors)) {
      try {
        const state = contribute();
        if (state && Object.keys(state).length) elements[id] = state;
      } catch {
        // A contributor that threw — a component mid-teardown, a getter that
        // needs data it does not have yet. Skipped rather than losing the whole
        // snapshot over one element.
      }
    }
    if (Object.keys(elements).length) snapshot.elements = elements;

    try {
      store.setItem(key, JSON.stringify(snapshot));
    } catch {
      // Quota, or storage revoked mid-session. Not keeping the view is a
      // smaller problem than throwing inside an event handler.
    }
  };

  // SAVE ON THE SOURCE'S `change`, which fires after a load completes — the one
  // moment the state is both settled and known to be loadable. A host whose
  // view has no source calls the returned `save` itself.
  // DataSource extends EventTarget, so the signal is honoured natively — no
  // second way to say "stop".
  targets.source?.addEventListener(
    'change', save,
    options.signal ? { signal: options.signal } : undefined,
  );
  return () => targets.source?.removeEventListener('change', save);
}

/**
 * Keep just a `DataSource`'s view state.
 *
 * @deprecated Use `persistView`, which keeps the components' state too. This
 * remains because it is a strict subset — a view whose only state is its query.
 */
export function persistViewState(
  source: DataSource,
  name: string,
  options: PersistOptions = {},
): () => void {
  return persistView(name, { source }, {}, options);
}

/**
 * A whole VIEW DEFINITION — the query AND every component's state.
 *
 * A preset shipped with the app, a saved configuration a user made, a deep
 * link, or what an agent asks for over MCP. All four are this same object;
 * that is the point of having one shape rather than a storage key per concern.
 */
export interface ViewSnapshot {
  /**
   * The version of the SHAPE, not of the data.
   *
   * A saved view outlives the code that made it. An unrecognised version is
   * ignored whole rather than half-applied, because a definition applied in
   * part leaves a screen in a state nobody designed.
   */
  v: 1;
  /** The query — a `DataSource`'s ViewState. Restored via `setState()`. */
  source?: Partial<ViewState>;
  /**
   * Per-element state, keyed by an id the CALLER chooses — the same ids a
   * `renderView` definition uses, so the two agree.
   *
   * Each value is an `ElementNode.state` block: property or method names on
   * that element, applied through its own public API.
   */
  elements?: Record<string, Record<string, unknown>>;
}

/** What `applyViewSnapshot` could not do — see its return. */
export interface ApplyReport {
  /** Element ids named by the snapshot that the caller did not supply. */
  missingElements: string[];
  /** Per element, the state keys its API does not expose. */
  skipped: Record<string, string[]>;
}

/**
 * Apply a whole view definition: the query, then each element's state.
 *
 * DEGRADES rather than throws. A saved view outlives its code — a component
 * renamed, a column dropped, a method gone — and one stale key must not stop
 * the rest being restored. What could not be applied comes back in the report,
 * so a host can tell the user rather than leave them guessing.
 *
 *   const report = applyViewSnapshot(snapshot, { source, elements: { grid } });
 *   if (report.missingElements.length) … // tell someone
 *
 * ORDER MATTERS and is fixed here: the SOURCE first, so the rows a component's
 * state refers to are on their way, then each element. Within an element,
 * `applyState` waits for `rendered` — a grid cannot filter a column it does not
 * have yet.
 */
export function applyViewSnapshot(
  snapshot: ViewSnapshot,
  targets: {
    source?: { setState(next: Partial<ViewState>): void };
    elements?: Record<string, HTMLElement>;
  },
): ApplyReport {
  const report: ApplyReport = { missingElements: [], skipped: {} };
  if (!snapshot || snapshot.v !== 1) return report;

  if (snapshot.source && targets.source) targets.source.setState(snapshot.source);

  for (const [id, state] of Object.entries(snapshot.elements ?? {})) {
    const el = targets.elements?.[id];
    if (!el) {
      report.missingElements.push(id);
      continue;
    }
    // Deferred, because a component applies its own state after `rendered` —
    // the report cannot say what a not-yet-rendered element will skip, so it
    // reports only what it can know now.
    const skipped = applyState(el, state);
    if (skipped.length) report.skipped[id] = skipped;
  }

  return report;
}

/**
 * Read the current state BACK into a definition — the other half of applying one.
 *
 * A saved view is useless if only a developer can write one. This is what a
 * "Save this view" button calls, and what an agent calls to describe what it is
 * looking at.
 *
 *   const snapshot = captureView({ source, elements: { grid, chart } });
 *
 * WHAT IT READS is named per element, because only the caller knows which of a
 * component's properties are view state and which are incidental. A grid's
 * column filters belong in a saved view; its scroll position does not.
 *
 *   captureView({ elements: { grid } }, { grid: ['columnClause', 'selectedKeys'] })
 *
 * Omit the map and each element contributes nothing — deliberately, because
 * guessing would put transient state in a saved view and a reader would find
 * their scroll position restored a week later.
 */
export function captureView(
  targets: {
    source?: { state: ViewState };
    elements?: Record<string, HTMLElement>;
  },
  reads: Record<string, readonly string[]> = {},
): ViewSnapshot {
  const snapshot: ViewSnapshot = { v: 1 };

  if (targets.source) snapshot.source = targets.source.state;

  const elements: Record<string, Record<string, unknown>> = {};
  for (const [id, el] of Object.entries(targets.elements ?? {})) {
    const keys = reads[id];
    if (!keys?.length) continue;

    const out: Record<string, unknown> = {};
    const target = el as unknown as Record<string, unknown>;
    for (const key of keys) {
      if (!(key in target)) continue;
      const value = target[key];
      // A getter that is a FUNCTION is not readable state — `columnClause` needs
      // a field argument, so a caller wanting it must name the setter form
      // instead. Skipping beats storing "[object Function]".
      if (typeof value === 'function') continue;
      out[key] = value;
    }
    if (Object.keys(out).length) elements[id] = out;
  }

  if (Object.keys(elements).length) snapshot.elements = elements;
  return snapshot;
}

/** Forget a saved view state — what a "reset this view" action does. */
export function clearViewState(name: string, options: PersistOptions = {}): void {
  try {
    storage(options.shared ?? false)?.removeItem(PREFIX + name);
  } catch {
    /* storage unavailable */
  }
}

/* ── Saved views as a LIBRARY ───────────────────────────────────────────
   A page rarely has one saved view; it has a set, offered in a chip, and
   picking one applies it. Both example pages wrote that by hand and wrote it
   the same way — the chip options derived from the set, a listener reading
   `detail.values.view[0]`, an apply, and a warn when a stale definition could
   not be fully restored.

   Four small pieces of one idea, copied. The third copy is where a vocabulary
   starts to drift, so it lives here instead. */

/** One saved view in a set: what it is called, and what it does. */
export interface SavedView {
  label: string;
  /** The query, and the state of whatever is on screen. */
  snapshot: ViewSnapshot;
  /**
   * This view's OWN CONTENT AND LAYOUT, when it differs from its neighbours'.
   *
   * A preset is not always the same screen with different rows. "Capacity
   * planning" may want a storage histogram and a forecast table where "Fleet
   * overview" wants four metric tiles and a donut — different components, in a
   * different arrangement, not the same components re-populated.
   *
   * OPTIONAL, and most views should omit it. A set of views over one screen is
   * the common case and the cheap one: nothing is torn down, every component
   * keeps its identity, and `snapshot.elements` configures what is already
   * there. Only a view that needs DIFFERENT components declares content.
   *
   * It is a `ViewDefinition` — the shape `renderView` already builds — because
   * "a screen described as data" is a problem this repo solved once. A second
   * shape for it would be a second thing to learn, serialise and get wrong.
   *
   * The snapshot still applies afterwards, so a view can build its own grid AND
   * arrive with a column already filtered.
   */
  content?: ViewDefinition;
}

/** A page's saved views, keyed by the id its chip option carries. */
export type ViewLibrary = Record<string, SavedView>;

/** A quick-filter option, as `populate()` takes it. */
export interface ViewOption {
  value: string;
  label: string;
  selected?: boolean;
}

/**
 * The View chip's options, DERIVED from the views themselves.
 *
 * A hand-written option list is a second place the label lives, and the two
 * drift: a view renamed in one file still reads by its old name in the chip.
 * Deriving them means there is only ever one name.
 *
 *   filters: globalFilters(viewOptions(MY_VIEWS, 'all'))
 *
 * `currentId` marks which is showing. It defaults to the FIRST view, because a
 * set with nothing selected leaves the chip blank and a reader looking at data
 * no view claims.
 */
export function viewOptions(views: ViewLibrary, currentId?: string): ViewOption[] {
  const ids = Object.keys(views);
  const current = currentId ?? ids[0];
  return ids.map((value) => ({
    value,
    label: views[value]!.label,
    selected: value === current,
  }));
}

/** What `onViewPicked` hands back, so a host can do its own work after. */
export interface ViewPick {
  /** The picked view's id — the key in the library. */
  id: string;
  /** The view itself. */
  view: SavedView;
  /** What could not be applied. Empty when everything landed. */
  report: ApplyReport;
  /**
   * The content this view built, when it declared its own — its root element
   * and its live state store.
   *
   * Undefined for a view that shares the screen, which is most of them. A host
   * uses it to reach the elements it just created: they did not exist when the
   * listener was wired, so `targets.elements` could not name them.
   */
  rendered?: RenderedView;
}

/**
 * Wire a View chip to a library: pick one, and the screen reconfigures.
 *
 * The listener both example pages wrote by hand, in one place:
 *
 *   const off = onViewPicked(header, VIEWS, { source, elements: { grid } });
 *
 * `views` may be a FUNCTION, and should be whenever the set can grow. A library
 * is re-read on every pick, so a view the reader saves after this call still
 * resolves; pass the object only for a fixed set of presets.
 *
 * READS `detail.values.view[0]`, the View chip's id — the one convention a
 * view toolbar has. A change naming no view is ignored rather than treated as
 * "no view", because you are always in some view and the other chips on that
 * bar fire the same event.
 *
 * A stale definition is REPORTED, never thrown: a saved view outlives its code,
 * and one gone method must not stop the rest being restored. The default is to
 * warn, which is what both pages did; pass `onIncomplete` to tell the reader
 * instead, and `after` to do the work only that page knows about — re-composing
 * a query from named parts, say.
 *
 * Returns an unsubscribe, like `bind()`, so a view that leaves the DOM stops
 * listening. Matching that shape matters more than saving the line: a caller
 * should not have to remember which of our functions hand back a teardown.
 */
export function onViewPicked(
  host: EventTarget | null | undefined,
  views: ViewLibrary | (() => ViewLibrary),
  targets: {
    source?: { setState(next: Partial<ViewState>): void };
    elements?: Record<string, HTMLElement>;
  },
  options: {
    /** Run after a view applies — the page-specific half. */
    after?: (pick: ViewPick) => void;
    /** Called instead of the default `console.warn` when something was skipped. */
    onIncomplete?: (pick: ViewPick) => void;
    /**
     * Where a view's own `content` is placed — the content region.
     *
     * Only consulted by a view that declares content. Omit it and such a view
     * is built and handed back in `pick.rendered` unplaced, for a host that
     * wants to route or animate the swap itself.
     */
    into?: HTMLElement | null;
    /**
     * Stop listening when this aborts — the same platform token `bind()` takes.
     *
     * `addEventListener` honours it natively, so one controller can tear down
     * every binding and every listener a view made.
     */
    signal?: AbortSignal;
  } = {},
): () => void {
  if (!host) return () => {};

  /* The content region's ORIGINAL children, kept so a view without content can
     hand the page back what it had. Null until a view first replaces them. */
  let original: ChildNode[] | null = null;

  const listener = (event: Event): void => {
    const detail = (event as CustomEvent).detail as
      { scope?: string; values?: Record<string, readonly string[]> } | undefined;

    /* THE BAR'S event, not a single chip's. `values` carries two shapes on this
       event name — a bare string[] from a chip, a Record<id, string[]> from the
       toolbar — and reading one as the other is a bug that has already shipped
       once (a view turned a sort pick into a filter and emptied the grid).

       This USED to be safe by accident: `['name']['view']` is undefined, so a
       chip's array fell through the next line. Accidental safety is the kind
       that stops working when a shape changes slightly. */
    if (detail?.scope && detail.scope !== 'bar') return;

    const id = detail?.values?.['view']?.[0];
    if (!id) return;
    // RE-READ every time when given a function. A library GROWS — a reader
    // saves a view and it joins the set — and a listener holding the object it
    // was wired with would never see one. The dashboard's Save button wired the
    // presets and then could not restore anything the reader had saved.
    const library = typeof views === 'function' ? views() : views;
    const view = library[id];
    if (!view) return;

    /* CONTENT FIRST, when the view brings its own. A preset is not always the
       same screen with different rows — one may want a histogram and a forecast
       table where another wants metric tiles and a donut.

       Built BEFORE the snapshot because the snapshot configures what is on
       screen, and for this view that is what we are about to create. Applying
       first would set state on the outgoing screen and then throw it away.

       The host says WHERE via `into`. Without it the content is built and handed
       back unplaced, which is honest: this function knows what a view wants, not
       where a page keeps it. */
    let rendered: RenderedView | undefined;
    const host = options.into;

    if (view.content) {
      rendered = renderView(view.content);
      if (host) {
        /* REMEMBER WHAT WAS THERE, once, before the first replacement.
           A set of views is usually MIXED: most share the page's own content
           and one or two bring their own. Without this, the first view that
           brought content kept the screen for good — picking any other view
           moved the data while capacity's grid stayed on display, which is the
           exact lie this whole feature exists to prevent.

           Captured on the FIRST swap only, so it holds the page's own content
           rather than the previous view's. */
        if (!original) original = [...host.childNodes];
        // replaceChildren, not append: switching view REPLACES the content. A
        // view that leaves its predecessor's charts on screen is two views at
        // once.
        host.replaceChildren(rendered.el);
      }
      // Elements this view just built are addressable by the ids it used, so a
      // snapshot can configure them. They did not exist when the listener was
      // wired, so `targets.elements` could not have named them.
      targets = { ...targets, elements: { ...targets.elements, ...rendered.elements } };
    } else if (host && original) {
      /* NO CONTENT of its own, so it wants the page's — put it back.
         The nodes are re-attached, not rebuilt: they are the same elements the
         page bound at init, so every bind still points at them and nothing has
         to be re-wired. */
      host.replaceChildren(...original);
    }

    const report = applyViewSnapshot(view.snapshot, targets);
    const pick: ViewPick = { id, view, report, ...(rendered ? { rendered } : {}) };

    options.after?.(pick);

    if (report.missingElements.length || Object.keys(report.skipped).length) {
      if (options.onIncomplete) options.onIncomplete(pick);
      // A definition that could not be fully applied is worth saying out loud
      // rather than leaving a reader to wonder why half the screen moved.
      else console.warn('view applied with gaps', report);
    }
  };

  // The signal goes straight to the platform, which is the whole point of
  // reusing it rather than inventing a second way to say "stop".
  host.addEventListener(
    'quick-filter-change', listener,
    options.signal ? { signal: options.signal } : undefined,
  );
  return () => host.removeEventListener('quick-filter-change', listener);
}

/* ── Saving a view the READER made ─────────────────────────────────────
   `persistView` keeps ONE view under a fixed name — "put me back where I was"
   across a reload. A Save button is a different thing: it makes a NEW NAMED
   view from what is on screen and adds it to the set the chip offers.

   Both example pages had a Save button wired to `console.log`. */

const SAVED_PREFIX = 'sherpa:views:';

/** The user's own saved views for one page, keyed by id like a preset set. */
export type SavedViewStore = Record<string, SavedView>;

/**
 * Read a page's user-saved views.
 *
 * Returns `{}` when there are none, or when storage is unreadable — a reader
 * whose saved views cannot be loaded gets the presets, which is exactly where
 * they were before the feature existed.
 */
export function loadSavedViews(page: string, options: PersistOptions = {}): SavedViewStore {
  try {
    const raw = storage(options.shared ?? true)?.getItem(SAVED_PREFIX + page);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SavedViewStore;
    // A stored object is only trustworthy in SHAPE, never in content: it
    // outlives the code that wrote it, and a hand-edited one is a plain string.
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Save what is on screen as a NEW named view, and hand back the whole set.
 *
 * `reads` names which of each element's properties are view state, exactly as
 * `captureView` takes it — only the caller knows which of a component's
 * properties belong in a saved view and which are incidental. A grid's column
 * filters do; its scroll position does not.
 *
 *   const views = saveViewAs('dashboard', 'Q3 capacity',
 *     { source, elements: { header } }, { header: ['values'] });
 *
 * The id is DERIVED from the label, so a reader saving "Q3 capacity" twice
 * updates it rather than collecting two entries that look identical in the
 * chip. Returns the full store so a caller can re-populate the chip in the
 * same breath — a saved view nobody can pick is not saved.
 *
 * Storage defaults to SHARED (localStorage): a view a reader took the trouble
 * to name should outlive the tab. `persistView`'s "where was I" state defaults
 * the other way, and deliberately.
 */
export function saveViewAs(
  page: string,
  label: string,
  targets: {
    source?: { state: ViewState };
    elements?: Record<string, HTMLElement>;
  },
  reads: Record<string, readonly string[]> = {},
  options: PersistOptions & { content?: ViewDefinition } = {},
): SavedViewStore {
  const trimmed = label.trim();
  if (!trimmed) return loadSavedViews(page, options);

  const views = loadSavedViews(page, options);
  views[viewId(trimmed)] = {
    label: trimmed,
    snapshot: captureView(targets, reads),
    // A view of a screen the reader BUILT has to remember that screen, or
    // re-opening it would restore the state onto whatever was there instead.
    ...(options.content ? { content: options.content } : {}),
  };

  writeSavedViews(page, views, options);
  return views;
}

/** Forget one saved view. Returns what is left, for the same reason. */
export function deleteSavedView(
  page: string,
  id: string,
  options: PersistOptions = {},
): SavedViewStore {
  const views = loadSavedViews(page, options);
  // REBUILT WITHOUT IT, rather than `delete views[id]`. A dynamic delete on a
  // parsed-JSON object is the one shape that can carry a prototype key through
  // — and this object came from storage, which a person can edit.
  const kept = Object.fromEntries(Object.entries(views).filter(([key]) => key !== id));
  writeSavedViews(page, kept, options);
  return kept;
}

/**
 * A stable id from a label — lowercase, words joined by a hyphen.
 *
 * Deriving it rather than generating one is what makes saving the same name
 * twice an UPDATE. A random id would leave a reader with two "Q3 capacity"
 * rows and no way to tell them apart.
 */
function viewId(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // A label of pure punctuation still needs an id. Falling back to the raw
  // label keeps it addressable rather than colliding on an empty key.
  return slug || label;
}

function writeSavedViews(
  page: string,
  views: SavedViewStore,
  options: PersistOptions,
): void {
  try {
    storage(options.shared ?? true)?.setItem(SAVED_PREFIX + page, JSON.stringify(views));
  } catch {
    // Full, blocked, or a private window. The view is not kept; nothing breaks.
  }
}
