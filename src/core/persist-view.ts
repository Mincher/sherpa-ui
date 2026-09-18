/**
 * Keep a DataSource's view state across a page reload.
 *
 *   const off = persistViewState(source, 'records');
 *
 * TRAP T-persist-defaults-per-tab — a helper, and sessionStorage by default.
 */
import type { DataSource, ViewState } from './data-source.js';
import { applyState } from './apply-state.js';
import { parseViewMarkup } from './view-markup.js';

export interface PersistOptions {
  /**
   * Share the state across TABS via localStorage rather than keeping it per
   * tab. Off by default — see TRAP T-persist-defaults-per-tab.
   */
  shared?: boolean;
  /**
   * Stop persisting when this aborts — the same platform token `bind()` takes.
   *
   * TRAP T-signal-not-a-teardown-list — one controller, not a list of teardowns.
   */
  signal?: AbortSignal;
}

/** The key prefix, so a host's own storage keys cannot collide with these. */
const PREFIX = 'sherpa:view:';

/**
 * The storage a persister writes to, or `null` when it is unavailable.
 *
 * TRAP T-storage-access-throws — why every access in this file is wrapped.
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
 * TRAP T-one-snapshot-not-a-key-per-concern — one shape, and the caller names
 * what each element contributes.
 * TRAP T-persist-view-returns-a-teardown — the worked example, and the teardown.
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

  // TRAP T-restore-before-first-load — one load, not an empty one then a second.
  try {
    const raw = store.getItem(key);
    if (raw) applyViewSnapshot(JSON.parse(raw) as ViewSnapshot, targets);
  } catch {
    // TRAP T-storage-access-throws — unreadable, not JSON, or an old shape.
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
        // A component mid-teardown, or a getter needing data it lacks. Skipped
        // rather than losing the whole snapshot over one element.
      }
    }
    if (Object.keys(elements).length) snapshot.elements = elements;

    try {
      store.setItem(key, JSON.stringify(snapshot));
    } catch {
      // TRAP T-storage-access-throws — quota, or storage revoked mid-session.
    }
  };

  // SAVE ON THE SOURCE'S `change` — see
  // TRAP T-restore-before-first-load. A view with no source calls `save` itself.
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
 * TRAP T-one-snapshot-not-a-key-per-concern — a preset, a saved configuration,
 * a deep link and an agent's MCP request are all this one object.
 */
export interface ViewSnapshot {
  /** The version of the SHAPE, not of the data. An unrecognised one is ignored WHOLE. */
  v: 1;
  /** The query — a `DataSource`'s ViewState. Restored via `setState()`. */
  source?: Partial<ViewState>;
  /**
   * Per-element state, keyed by an id the CALLER chooses — the same ids a
   * a saved view addresses. Each value is a STATE BLOCK — a map of the
   * component's own methods and accessors,
   * applied through the element's own public API.
   */
  elements?: Record<string, Record<string, unknown>>;
}

/** What `applyViewSnapshot` could not do — see TRAP T-apply-degrades-never-throws. */
export interface ApplyReport {
  /** Element ids named by the snapshot that the caller did not supply. */
  missingElements: string[];
  /** Per element, the state keys its API does not expose. */
  skipped: Record<string, string[]>;
}

/**
 * Apply a whole view definition: the query, then each element's state.
 *
 * TRAP T-apply-degrades-never-throws — reported, not thrown; source first.
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
    // TRAP T-apply-degrades-never-throws — deferred to `rendered`.
    const skipped = applyState(el, state);
    if (skipped.length) report.skipped[id] = skipped;
  }

  return report;
}

/**
 * Read the current state BACK into a definition — the other half of applying one.
 *
 * TRAP T-capture-reads-only-what-is-named — omitting the map reads nothing.
 * TRAP T-capture-is-the-save-button — who calls it, and why parity demands it.
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
      // TRAP T-capture-reads-only-what-is-named — a FUNCTION is not state.
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
   TRAP T-view-library-is-one-vocabulary — four pieces both pages copied. */

/** One saved view in a set: what it is called, and what it does. */
export interface SavedView {
  label: string;
  /** The query, and the state of whatever is on screen. */
  snapshot: ViewSnapshot;
  /**
   * This view's OWN CONTENT AND LAYOUT, when it differs from its neighbours'.
   *
   * MARKUP — the same HTML an authored view is written in
   * (`examples/templates/*.html`), because a saved view is the same thing a
   * USER made instead of an author. Parsed through an allow-list on the way
   * in: TRAP T-saved-markup-is-untrusted-input.
   *
   * ONE FORM, not two. This took a `ViewDefinition` object as well until the
   * object's reason for existing turned out to be `$state` and `writes` — a
   * second wiring mechanism beside `DataSource.bind()`, with zero users.
   * TRAP T-attributes-are-the-state-channel.
   */
  content?: string;
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
 * TRAP T-view-library-is-one-vocabulary — why they are derived, and why
 * `currentId` defaults to the FIRST view.
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
 * TRAP T-library-re-read-on-every-pick — pass a FUNCTION if the set can grow.
 * TRAP T-values-carries-two-shapes — reads `detail.values.view[0]` off the BAR.
 * TRAP T-apply-degrades-never-throws — `onIncomplete` replaces the default warn.
 * TRAP T-on-view-picked-replaces-hand-wiring — the example, and the teardown.
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
     * Only consulted by a view that declares content. Omit it and the markup is
     * parsed and discarded — a host that wants to route or animate the swap
     * itself calls `parseViewMarkup` and places the fragment where it likes.
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

  /* The content region's ORIGINAL children — TRAP T-content-first-original-once.
     Null until a view first replaces them. */
  let original: ChildNode[] | null = null;

  const listener = (event: Event): void => {
    const detail = (event as CustomEvent).detail as
      { scope?: string; values?: Record<string, readonly string[]> } | undefined;

    /* TRAP T-values-carries-two-shapes — the BAR'S event, not a chip's. */
    if (detail?.scope && detail.scope !== 'bar') return;

    const id = detail?.values?.['view']?.[0];
    if (!id) return;
    // TRAP T-library-re-read-on-every-pick — a captured object never grows.
    const library = typeof views === 'function' ? views() : views;
    const view = library[id];
    if (!view) return;

    /* TRAP T-content-first-original-once — content before snapshot. */
    const host = options.into;

    if (typeof view.content === 'string') {
      /* MARKUP — the common case, and the same HTML an authored view is
         written in. PARSED through the allow-list, never assigned: this string
         came out of storage or off a server and nothing here wrote it.
         TRAP T-saved-markup-is-untrusted-input. */
      const { fragment, report: dropped } = parseViewMarkup(view.content);
      if (dropped.tags.length || dropped.attributes.length) {
        // SAID OUT LOUD. A view that silently lost half its content looks like
        // a rendering bug, and the reader has no way to know it was refused.
        console.warn('view markup: dropped', dropped);
      }
      if (host) {
        // TRAP T-content-first-original-once — FIRST swap only; replaceChildren.
        if (!original) original = [...host.childNodes];
        host.replaceChildren(fragment);
      }
      /* The snapshot addresses elements BY ID, and markup carries real ids, so
         collect them the same way a definition's registry would. Scoped to the
         host, because an id is only addressable once it is in the page. */
      if (host) {
        const byId: Record<string, HTMLElement> = {};
        for (const el of host.querySelectorAll<HTMLElement>('[id]')) byId[el.id] = el;
        targets = { ...targets, elements: { ...targets.elements, ...byId } };
      }
    } else if (host && original) {
      /* NO CONTENT of its own, so it wants the page's — RE-ATTACHED, not
         rebuilt, so every existing bind still points at them. */
      host.replaceChildren(...original);
    }

    const report = applyViewSnapshot(view.snapshot, targets);
    const pick: ViewPick = { id, view, report };

    options.after?.(pick);

    if (report.missingElements.length || Object.keys(report.skipped).length) {
      if (options.onIncomplete) options.onIncomplete(pick);
      // TRAP T-apply-degrades-never-throws — said out loud, not swallowed.
      else console.warn('view applied with gaps', report);
    }
  };

  // TRAP T-signal-not-a-teardown-list — straight to the platform.
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
 * Returns `{}` when there are none, or when storage is unreadable — see
 * TRAP T-storage-access-throws. A reader then gets the presets.
 */
export function loadSavedViews(page: string, options: PersistOptions = {}): SavedViewStore {
  try {
    const raw = storage(options.shared ?? true)?.getItem(SAVED_PREFIX + page);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SavedViewStore;
    // TRAP T-storage-access-throws — trustworthy in SHAPE, never in content.
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Save what is on screen as a NEW named view, and hand back the whole set.
 *
 * TRAP T-capture-reads-only-what-is-named — how `reads` is shaped.
 * TRAP T-persist-defaults-per-tab — SHARED here, unlike `persistView`.
 * TRAP T-save-view-as-returns-the-whole-set — why the whole store comes back.
 */
export function saveViewAs(
  page: string,
  label: string,
  targets: {
    source?: { state: ViewState };
    elements?: Record<string, HTMLElement>;
  },
  reads: Record<string, readonly string[]> = {},
  options: PersistOptions & { content?: string } = {},
): SavedViewStore {
  const trimmed = label.trim();
  if (!trimmed) return loadSavedViews(page, options);

  const views = loadSavedViews(page, options);
  views[viewId(trimmed)] = {
    label: trimmed,
    snapshot: captureView(targets, reads),
    // TRAP T-view-content-is-a-view-definition — a built screen is remembered.
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
  // TRAP T-derived-id-makes-resave-an-update — REBUILT, never `delete`.
  const kept = Object.fromEntries(Object.entries(views).filter(([key]) => key !== id));
  writeSavedViews(page, kept, options);
  return kept;
}

/**
 * A stable id from a label — lowercase, words joined by a hyphen.
 *
 * TRAP T-derived-id-makes-resave-an-update — and the pure-punctuation fallback.
 */
function viewId(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
    // TRAP T-storage-access-throws — the view is not kept; nothing breaks.
  }
}
