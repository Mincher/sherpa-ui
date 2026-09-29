/**
 * persist-view.ts — keep a view across a reload, and save named views.
 * TRAP T-persist-defaults-per-tab
 *
 * Map:
 * - PersistOptions — where a view is kept, and who hears what could not be restored
 * - persistView — Keep a whole view — the query AND every component's state — across a reload.
 * - persistViewState — Keep just a `DataSource`'s view state.
 * - ViewSnapshot — A whole VIEW DEFINITION — the query AND every component's state.
 * - ApplyReport — what applyViewSnapshot could not do — a gone element, a gone method
 * - applyViewSnapshot — Apply a whole view definition: the query, then each element's state.
 * - captureView — Read the current state BACK into a definition — the other half of applying one.
 * - clearViewState — Forget a saved view state — what a "reset this view" action does.
 * - SavedView — One saved view in a set: what it is called, and what it does.
 * - ViewLibrary — A page's saved views, keyed by the id its chip option carries.
 * - ViewOption — A quick-filter option, as `populate()` takes it.
 * - viewOptions — The View chip's options, DERIVED from the views themselves.
 * - uniqueViewLabel — A name no View has yet: a clash gets ` - Copy-001`, then `-002`.
 * - ViewPick — What `onViewPicked` hands back, so a host can do its own work after.
 * - onViewPicked — Wire a View chip to a library: pick one, and the screen reconfigures.
 * - SavedViewStore — The user's own saved views for one page, keyed by id like a preset set.
 * - loadSavedViews — Read a page's user-saved views.
 * - saveViewAs — Save what is on screen as a NEW named view, and hand back the whole set.
 * - deleteSavedView — Forget one saved view.
 */
import type { DataSource, ViewState } from '../data/data-source.js';
import { VIEW, type Query, type QueryDefaults } from '../data/query.js';
import { applyState } from '../ui/apply-state.js';
import { parseViewMarkup } from './view-markup.js';
import {
  isPlainObject, labelId, readJson, removeKey, writeJson, type StorageKind,
} from './web-storage.js';

export interface PersistOptions {
  /** Share across TABS via localStorage. Off by default — TRAP T-persist-defaults-per-tab. */
  shared?: boolean;
  /** Keep the source's state too. `false` when a kept Query owns its filter
   *  and arrangement: a second keeper restores a combined filter no chip shows,
   *  or an old sort over a View's. TRAP T-a-reload-replays-the-readers-answers */
  source?: boolean;
  /** Stop persisting when this aborts. TRAP T-signal-not-a-teardown-list */
  signal?: AbortSignal;
}

/** Key prefix, so a host's own storage keys cannot collide with these. */
const PREFIX = 'sherpa:view:';

/** `shared` picks the store — TRAP T-persist-defaults-per-tab. */
const kindOf = (shared: boolean): StorageKind => (shared ? 'local' : 'session');

/** A snapshot is a plain object with a version. Anything else is not ours. */
const isSnapshot = (v: unknown): v is ViewSnapshot => isPlainObject(v) && 'v' in v;

/**
 * Keep a whole view — the query AND every component's state — across a reload.
 * TRAP T-one-snapshot-not-a-key-per-concern
 * TRAP T-persist-view-returns-a-teardown
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
  const kind = kindOf(options.shared ?? false);
  const key = PREFIX + name;

  /* Restore BEFORE wiring, so the source loads once.
     `readJson` forgets a key it cannot understand, so a stored shape this
     version no longer reads leaves the reader exactly where they would have
     been without it. TRAP T-restore-before-first-load */
  const keepSource = options.source ?? true;
  const stored = readJson<ViewSnapshot | null>(kind, key, null, isSnapshot);
  // One kept from before the Query owned it is dropped, not trusted.
  if (stored && !keepSource) delete stored.source;
  if (stored) applyViewSnapshot(stored, targets);

  const save = (): void => {
    const snapshot: ViewSnapshot = { v: 1 };
    if (targets.source && keepSource) snapshot.source = targets.source.state;

    const elements: Record<string, Record<string, unknown>> = {};
    for (const [id, contribute] of Object.entries(contributors)) {
      try {
        const state = contribute();
        if (state && Object.keys(state).length) elements[id] = state;
      } catch {
        // One element mid-teardown must not lose the whole snapshot.
      }
    }
    if (Object.keys(elements).length) snapshot.elements = elements;

    // Cannot throw on quota or a revoked store — TRAP T-storage-access-throws.
    writeJson(kind, key, snapshot);
  };

  // Saves on `change`, which fires after a load COMPLETES. A view with no
  // source calls `save` itself. TRAP T-restore-before-first-load
  targets.source?.addEventListener(
    'change', save,
    options.signal ? { signal: options.signal } : undefined,
  );
  return () => targets.source?.removeEventListener('change', save);
}

/**
 * Keep just a `DataSource`'s view state.
 * @deprecated Use `persistView`, which keeps the components' state too — this
 * is a strict subset, a view whose only state is its query.
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
 * TRAP T-one-snapshot-not-a-key-per-concern
 */
export interface ViewSnapshot {
  /** The version of the SHAPE, not of the data. An unrecognised one is ignored WHOLE. */
  v: 1;
  /** The query — a `DataSource`'s ViewState. Restored via `setState()`. */
  source?: Partial<ViewState>;
  /** Per-element state, keyed by an id the CALLER chooses. Applied via the element's public API. */
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
 * TRAP T-apply-degrades-never-throws — reported, not thrown; source first.
 */
export function applyViewSnapshot(
  snapshot: ViewSnapshot,
  targets: {
    source?: { setState(next: Partial<ViewState>): void };
    elements?: Record<string, HTMLElement>;
  },
): ApplyReport {
  return applySnapshot(snapshot, targets).report;
}

/** The report, and — when an element had not drawn — when the last one took its state. */
function applySnapshot(
  snapshot: ViewSnapshot,
  targets: Parameters<typeof applyViewSnapshot>[1],
): { report: ApplyReport; waiting: Promise<void> | null } {
  const report: ApplyReport = { missingElements: [], skipped: {} };
  if (!snapshot || snapshot.v !== 1) return { report, waiting: null };

  if (snapshot.source && targets.source) targets.source.setState(snapshot.source);
  return { report, waiting: applyElements(snapshot.elements ?? {}, targets.elements ?? {}, report) };
}

/** Each element's state through its OWN public API, by id — a gone one reported.
 *  Null when every element took it now; else when the last one has. */
function applyElements(
  states: Record<string, Record<string, unknown>>,
  elements: Record<string, HTMLElement>,
  report: ApplyReport,
): Promise<void> | null {
  const waiting: Promise<void>[] = [];
  for (const [id, state] of Object.entries(states)) {
    const el = elements[id];
    if (!el) {
      report.missingElements.push(id);
      continue;
    }
    const apply = (): void => {
      const skipped = applyState(el, state);
      if (skipped.length) report.skipped[id] = skipped;
    };
    // TRAP T-apply-degrades-never-throws — deferred to `rendered`.
    const ready = whenDrawn(el);
    if (ready) waiting.push(ready.then(apply));
    else apply();
  }
  return waiting.length ? Promise.all(waiting).then(() => undefined) : null;
}

/** Null when `el` can take its state now; else when it can. A component that has
 *  not drawn loses what is written into it. TRAP T-apply-degrades-never-throws */
function whenDrawn(el: HTMLElement): Promise<void> | null {
  const self = el as { hasRendered?: boolean; rendered?: Promise<void> };
  if (self.hasRendered) return null;
  if (self.rendered) return self.rendered;
  const tag = el.localName;
  if (!tag.includes('-') || typeof customElements === 'undefined' || customElements.get(tag)) return null;
  return customElements.whenDefined(tag).then(() => (el as { rendered?: Promise<void> }).rendered);
}

/**
 * Read the current state BACK into a definition — the other half of applying one.
 * TRAP T-capture-reads-only-what-is-named — omitting the map reads nothing.
 * TRAP T-capture-is-the-save-button
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
    removeKey(kindOf(options.shared ?? false), PREFIX + name);
  } catch {
    /* storage unavailable */
  }
}

/* ── Saved views as a LIBRARY — TRAP T-view-library-is-one-vocabulary ── */

/** One saved view in a set: what it is called, and what it does. */
export interface SavedView {
  label: string;
  /**
   * Its FILTERS and arrangement, as JSON in the reader's terms — what each
   * scope holds, each field's default answer, the saved filters that are on,
   * the sort and the group. Applied onto a clean slate, and shown on the chips.
   * JSON because it is what other services send and receive. Will, 2026-09-27.
   * TRAP T-a-view-is-json
   */
  query?: QueryDefaults;
  /** Element state that is NOT data — a grid's selected rows — through each
   *  element's public API, by id. */
  ui?: Record<string, Record<string, unknown>>;
  /** The OLD shape: the source's state and per-element calls. A view with a
   *  `query` needs none; the Dashboard's still use it. */
  snapshot?: ViewSnapshot;
  /**
   * This view's OWN CONTENT AND LAYOUT — MARKUP, the same HTML an authored view
   * uses, parsed through an allow-list. ONE FORM, not two: a `ViewDefinition`
   * object was a second wiring mechanism beside `bind()`.
   * TRAP T-saved-markup-is-untrusted-input
   * TRAP T-attributes-are-the-state-channel
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
  /** `Presets` or `Custom views` — the reader's own, at the bottom. */
  section?: string;
}

/**
 * The View chip's options, DERIVED from the views themselves.
 * TRAP T-view-library-is-one-vocabulary — `currentId` defaults to the FIRST view.
 */
export function viewOptions(views: ViewLibrary, currentId?: string, custom?: ReadonlySet<string>): ViewOption[] {
  const ids = Object.keys(views);
  const current = currentId ?? ids[0];
  const option = (value: string): ViewOption => ({
    value,
    label: views[value]!.label,
    selected: value === current,
    // The reader's own Views sit in their own section, at the BOTTOM. TODO 15.
    ...(custom ? { section: custom.has(value) ? 'Custom views' : 'Presets' } : {}),
  });
  if (!custom) return ids.map(option);
  return [...ids.filter((id) => !custom.has(id)), ...ids.filter((id) => custom.has(id))].map(option);
}

/** A name no View has yet: a clash, in any case, gets ` - Copy-001`, then
 *  `-002` and on. Will, TODO 15. TRAP T-a-saved-view-is-the-readers-own */
export function uniqueViewLabel(label: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((l) => l.trim().toLowerCase()));
  if (!used.has(label.trim().toLowerCase())) return label.trim();
  for (let n = 1; ; n++) {
    const next = `${label.trim()} - Copy-${String(n).padStart(3, '0')}`;
    if (!used.has(next.toLowerCase())) return next;
  }
}

/** What `onViewPicked` hands back, so a host can do its own work after. */
export interface ViewPick {
  /** The picked view's id — the key in the library. */
  id: string;
  /** The view itself. */
  view: SavedView;
  /** What could not be applied. Empty when everything landed. */
  report: ApplyReport;
  /** The view's own content, once drawn — its elements by id, to bind. */
  rendered?: { elements: Record<string, HTMLElement> };
}

/**
 * Wire a View chip to a library: pick one, and the screen reconfigures.
 * TRAP T-library-re-read-on-every-pick — pass a FUNCTION if the set can grow.
 * TRAP T-values-carries-two-shapes — reads `detail.values.view[0]` off the BAR.
 * TRAP T-apply-degrades-never-throws — `onIncomplete` replaces the default warn.
 * TRAP T-on-view-picked-replaces-hand-wiring
 */
export function onViewPicked(
  host: EventTarget | null | undefined,
  views: ViewLibrary | (() => ViewLibrary),
  targets: {
    source?: {
      setState(next: Partial<ViewState>): void;
      setQuery?(query: QueryDefaults, options: { holds: 'keep' }): Promise<void>;
    };
    elements?: Record<string, HTMLElement>;
  },
  options: {
    /** Run after a view applies — the page-specific half. */
    after?: (pick: ViewPick) => void;
    /** Called instead of the default `console.warn` when something was skipped. */
    onIncomplete?: (pick: ViewPick) => void;
    /** Where a view's own `content` goes. Omit it and the markup is parsed and
        discarded — a host routing the swap itself calls `parseViewMarkup`. */
    into?: HTMLElement | null;
    /** The view the page ALREADY shows, so it is not re-applied.
        TRAP T-a-persistent-chip-reports-on-every-change */
    applied?: string | null;
    /** Stop listening when this aborts — `addEventListener` honours it natively. */
    signal?: AbortSignal;
  } = {},
): () => void {
  if (!host) return () => {};

  /* The content region's ORIGINAL children, null until a view first replaces
     them. TRAP T-content-first-original-once */
  let original: ChildNode[] | null = null;

  /* The view this bar is ALREADY showing. The View chip is `persistent`, so
     `values.view` rides on EVERY bar event — including a Region pick.
     TRAP T-a-persistent-chip-reports-on-every-change */
  let applied: string | null = options.applied ?? null;

  const listener = (event: Event): void => {
    const detail = (event as CustomEvent).detail as
      { scope?: string; values?: Record<string, readonly string[]> } | undefined;

    /* TRAP T-values-carries-two-shapes — the BAR'S event, not a chip's. */
    if (detail?.scope && detail.scope !== 'bar') return;

    const id = detail?.values?.['view']?.[0];
    if (!id) return;
    // SAME VIEW, different chip — nothing to re-apply.
    // TRAP T-a-persistent-chip-reports-on-every-change
    if (id === applied) return;
    // TRAP T-library-re-read-on-every-pick — a captured object never grows.
    const library = typeof views === 'function' ? views() : views;
    const view = library[id];
    if (!view) return;
    // AFTER the library check: recording an id the library lacks would make the
    // pick that follows its save a no-op.
    applied = id;

    /* TRAP T-content-first-original-once — content before snapshot. */
    const host = options.into;
    let rendered: ViewPick['rendered'];

    if (typeof view.content === 'string') {
      /* PARSED, never assigned: this string came out of storage or off a
         server. TRAP T-saved-markup-is-untrusted-input */
      const { fragment, report: dropped } = parseViewMarkup(view.content);
      if (dropped.tags.length || dropped.attributes.length) {
        // Said out loud — silently losing half a view reads as a render bug.
        console.warn('view markup: dropped', dropped);
      }
      if (host) {
        // TRAP T-content-first-original-once — FIRST swap only; replaceChildren.
        if (!original) original = [...host.childNodes];
        host.replaceChildren(fragment);
      }
      /* The snapshot addresses elements BY ID, so collect them — scoped to the
         host, because an id is only addressable once it is in the page. */
      if (host) {
        const byId: Record<string, HTMLElement> = {};
        for (const el of host.querySelectorAll<HTMLElement>('[id]')) byId[el.id] = el;
        targets = { ...targets, elements: { ...targets.elements, ...byId } };
        rendered = { elements: byId };
      }
    } else if (host && original) {
      /* No content of its own, so it wants the page's — RE-ATTACHED, not
         rebuilt, so every existing bind still points at them. */
      host.replaceChildren(...original);
    }

    const done = (report: ApplyReport): void => {
      const pick: ViewPick = { id, view, report, ...(rendered ? { rendered } : {}) };
      options.after?.(pick);
      if (report.missingElements.length || Object.keys(report.skipped).length) {
        if (options.onIncomplete) options.onIncomplete(pick);
        // TRAP T-apply-degrades-never-throws — said out loud, not swallowed.
        else console.warn('view applied with gaps', report);
      }
    };

    /* A JSON VIEW: its Query onto a clean slate — every chip drawn from it,
       its defaults shown — then its UI. TRAP T-a-view-is-json */
    if (view.query && targets.source?.setQuery) {
      const report: ApplyReport = { missingElements: [], skipped: {} };
      const elements = targets.elements ?? {};
      // The View chip SHOWS it — a pick from a link or a nav row included.
      // The element that REPORTED the pick — a host above it has no chips.
      const bar = (event.composedPath()[0] ?? event.currentTarget) as { values?: Record<string, readonly string[]> } | null;
      if (bar?.values && bar.values['view']?.[0] !== id) bar.values = { ...bar.values, view: [id] };
      void targets.source.setQuery(view.query, { holds: 'keep' }).then(() => {
        const waiting = applyElements(view.ui ?? {}, elements, report);
        if (waiting) void waiting.then(() => done(report));
        else done(report);
      });
      return;
    }

    /* THE OLD VIEW'S FILTERS DO NOT CARRY OVER. Will, 2026-09-24: a header
       chip resets on a view change unless the view itself sets it — so the
       bar that reported the pick is reset FIRST, and the view then sets what
       it states. Left lit, a chip read as filtering while `setState` had
       already dropped its part. The View chip is persistent and keeps its pick.
       TRAP T-a-view-change-resets-the-header-chips */
    // A carry-over chip keeps its answer. TRAP T-a-field-can-carry-over-views
    (event.target as { clearAll?: (o: { carry: boolean }) => void } | null)?.clearAll?.({ carry: true });
    const { report, waiting } = applySnapshot(view.snapshot ?? { v: 1 }, targets);
    const more = applyElements(view.ui ?? {}, targets.elements ?? {}, report);
    // Reported once every element has its state: a gap is only known then.
    if (waiting || more) void Promise.all([waiting, more]).then(() => done(report));
    else done(report);
  };

  // TRAP T-signal-not-a-teardown-list — straight to the platform.
  host.addEventListener(
    'quick-filter-change', listener,
    options.signal ? { signal: options.signal } : undefined,
  );
  return () => host.removeEventListener('quick-filter-change', listener);
}

/* ── Saving a view the READER made ─────────────────────────────────────
   `persistView` keeps ONE view under a fixed name. A Save button makes a NEW
   NAMED view from what is on screen and adds it to the set the chip offers. */

const SAVED_PREFIX = 'sherpa:views:';

/** The user's own saved views for one page, keyed by id like a preset set. */
export type SavedViewStore = Record<string, SavedView>;

/**
 * Read a page's user-saved views. `{}` when there are none or storage is
 * unreadable (TRAP T-storage-access-throws) — a reader then gets the presets.
 */
export function loadSavedViews(page: string, options: PersistOptions = {}): SavedViewStore {
  // Trustworthy in SHAPE, never in content — TRAP T-storage-access-throws.
  return readJson<SavedViewStore>(
    kindOf(options.shared ?? true), SAVED_PREFIX + page, {},
    (v): v is SavedViewStore => isPlainObject(v),
  );
}

/**
 * Save what is on screen as a NEW named view, and hand back the whole set.
 * TRAP T-capture-reads-only-what-is-named — how `reads` is shaped.
 * TRAP T-persist-defaults-per-tab — SHARED here, unlike `persistView`.
 * TRAP T-save-view-as-returns-the-whole-set
 */
export function saveViewAs(
  page: string,
  label: string,
  targets: {
    source?: { state: ViewState; query?: { applied: Query } };
    elements?: Record<string, HTMLElement>;
  },
  reads: Record<string, readonly string[]> = {},
  options: PersistOptions & { content?: string } = {},
): SavedViewStore {
  const trimmed = label.trim();
  if (!trimmed) return loadSavedViews(page, options);

  const views = loadSavedViews(page, options);
  /* A source with a Query saves JSON — its Query and arrangement, plus the UI
     the host names. One with none saves the old snapshot. TRAP T-a-view-is-json */
  const { source } = targets;
  const ui = captureView({ elements: targets.elements ?? {} }, reads).elements;
  views[labelId(trimmed)] = {
    label: trimmed,
    ...(source?.query ? { query: viewQueryOf(source as { state: ViewState; query: { applied: Query } }) }
      : { snapshot: captureView(targets, reads) }),
    ...(source?.query && ui ? { ui } : {}),
    // TRAP T-view-content-is-a-view-definition — a built screen is remembered.
    ...(options.content ? { content: options.content } : {}),
  };

  writeSavedViews(page, views, options);
  return views;
}

/** What is on screen as a View's JSON: the applied Query, with the rows'
 *  arrangement on the View scope. TRAP T-a-view-is-json */
function viewQueryOf(source: { state: ViewState; query: { applied: Query } }): QueryDefaults {
  const scopes: QueryDefaults['scopes'] = structuredClone(source.query.applied.scopes);
  const { sort, group, search } = source.state;
  scopes[VIEW] = { ...(scopes[VIEW] ?? { holds: [], readings: {} }), sort, group, search };
  return { v: 1, scopes };
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

function writeSavedViews(
  page: string,
  views: SavedViewStore,
  options: PersistOptions,
): void {
  // Cannot throw — the view is not kept; nothing breaks.
  // TRAP T-storage-access-throws
  writeJson(kindOf(options.shared ?? true), SAVED_PREFIX + page, views);
}
