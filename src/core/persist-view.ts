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

export interface PersistOptions {
  /**
   * Share the state across TABS via localStorage rather than keeping it per
   * tab. Off by default — see the note above.
   */
  shared?: boolean;
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
  targets.source?.addEventListener('change', save);
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
  snapshot: ViewSnapshot;
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
}

/**
 * Wire a View chip to a library: pick one, and the screen reconfigures.
 *
 * The listener both example pages wrote by hand, in one place:
 *
 *   const off = onViewPicked(header, VIEWS, { source, elements: { grid } });
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
  views: ViewLibrary,
  targets: {
    source?: { setState(next: Partial<ViewState>): void };
    elements?: Record<string, HTMLElement>;
  },
  options: {
    /** Run after a view applies — the page-specific half. */
    after?: (pick: ViewPick) => void;
    /** Called instead of the default `console.warn` when something was skipped. */
    onIncomplete?: (pick: ViewPick) => void;
  } = {},
): () => void {
  if (!host) return () => {};

  const listener = (event: Event): void => {
    const detail = (event as CustomEvent).detail as
      { values?: Record<string, readonly string[]> } | undefined;
    const id = detail?.values?.['view']?.[0];
    if (!id) return;
    const view = views[id];
    if (!view) return;

    const report = applyViewSnapshot(view.snapshot, targets);
    const pick: ViewPick = { id, view, report };

    options.after?.(pick);

    if (report.missingElements.length || Object.keys(report.skipped).length) {
      if (options.onIncomplete) options.onIncomplete(pick);
      // A definition that could not be fully applied is worth saying out loud
      // rather than leaving a reader to wonder why half the screen moved.
      else console.warn('view applied with gaps', report);
    }
  };

  host.addEventListener('quick-filter-change', listener);
  return () => host.removeEventListener('quick-filter-change', listener);
}
