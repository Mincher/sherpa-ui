/**
 * persist-view.ts — a VIEW: its state applied and read back, and the View chip's
 * library. Where a View is kept is the page keeper's (page-state.ts).
 *
 * Map:
 * - ApplyReport — what applyView could not do — a gone element, a gone method
 * - applyView — Apply a View: its Query, then each element's state.
 * - captureView — Read the current state BACK into a View — the other half of applying one.
 * - SavedView — One saved view in a set: what it is called, and what it does.
 * - ViewLibrary — A page's saved views, keyed by the id its chip option carries.
 * - ViewOption — A quick-filter option, as `populate()` takes it.
 * - viewOptions — The View chip's options, DERIVED from the views themselves.
 * - uniqueViewLabel — A name no View has yet: a clash gets ` - Copy-001`, then `-002`.
 * - ViewPick — What `onViewPicked` hands back, so a host can do its own work after.
 * - onViewPicked — Wire a View chip to a library: pick one, and the screen reconfigures.
 * - viewQueryOf — What is on screen as a View's JSON: the applied Query, with the rows' arrangement.
 */
import { statedQuery, type Query, type QueryDefaults } from '../data/query.js';
import type { FieldReading } from '../data/filter-state.js';
import { whereOf, type Where } from '../data/where.js';
import { applyState } from '../ui/apply-state.js';
import { VIEW_CHIP } from '../ui/shared-constants.js';
import { report } from '../data/report.js';
import { parseViewMarkup } from './view-markup.js';
import type { GraphOf } from '../data/graph-views.js';

/** What `applyView` could not do — see TRAP T-apply-degrades-never-throws. */
export interface ApplyReport {
  /** Element ids named by the View that the caller did not supply. */
  missingElements: string[];
  /** Per element, the state keys its API does not expose. */
  skipped: Record<string, string[]>;
}

/**
 * Apply a View: its Query, then each element's state — a saved View, a preset,
 * a page's kept `ui`. TRAP T-apply-degrades-never-throws — reported, not thrown; source first.
 * TRAP T-one-snapshot-not-a-key-per-concern
 */
export function applyView(
  view: Pick<SavedView, 'query' | 'ui'>,
  targets: {
    query?: { setQuery(query: QueryDefaults): Promise<void> };
    elements?: Record<string, HTMLElement>;
  },
): ApplyReport {
  const report: ApplyReport = { missingElements: [], skipped: {} };
  if (view?.query && targets.query) void targets.query.setQuery(view.query);
  applyElements(view?.ui ?? {}, targets.elements ?? {}, report);
  return report;
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
 * Read the current state BACK into a View — the other half of applying one.
 * TRAP T-capture-reads-only-what-is-named — omitting the map reads nothing.
 * TRAP T-capture-is-the-save-button
 */
export function captureView(
  targets: {
    source?: ViewSource;
    elements?: Record<string, HTMLElement>;
  },
  reads: Record<string, readonly string[]> = {},
): Pick<SavedView, 'query' | 'ui'> {
  const view: Pick<SavedView, 'query' | 'ui'> = {};

  if (targets.source) view.query = viewQueryOf(targets.source);

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

  if (Object.keys(elements).length) view.ui = elements;
  return view;
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
  /**
   * This view's OWN CONTENT AND LAYOUT — MARKUP, the same HTML an authored view
   * uses, parsed through an allow-list. ONE FORM, not two: a `ViewDefinition`
   * object was a second wiring mechanism beside `bindSource()`.
   * TRAP T-saved-markup-is-untrusted-input
   * TRAP T-attributes-are-the-state-channel
   */
  content?: string;
  /** Where its content lives instead: `file.html#id`, beside the views' JSON.
   *  `loadViewLibrary` reads it into `content`. TRAP T-a-views-markup-lives-in-a-template */
  template?: string;
  /** The app's own settings it lays, by pointer: the app reads them, Sherpa does not. */
  settings?: Readonly<Record<string, unknown>>;
  /** A GRAPH View: its body is a canvas, bound to one entity of this type, picked in the graph chip.
   *  It has no template. TRAP T-a-graph-is-a-view-of-a-type */
  graph?: GraphOf;
  /** The Filters its toolbar offers, each `filter:<id>`; none named, every Filter over its store (Will, plan 960 U4.4d). */
  filters?: readonly string[];
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
/** Each content region's ORIGINAL children, kept the first time a view replaces
 *  them — for every listener on it, so a re-heard page still finds them. */
const originals = new WeakMap<HTMLElement, ChildNode[]>();

export function onViewPicked(
  host: EventTarget | null | undefined,
  views: ViewLibrary | (() => ViewLibrary),
  targets: {
    query?: { setQuery(query: QueryDefaults, options?: { holds?: 'keep'; by?: string }): Promise<void> };
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
    /** A pick was TAKEN: the last moment the old View's answers are on the
        source. TRAP T-a-view-keeps-what-the-reader-left */
    before?: (id: string) => void;
    /** A Query to put on INSTEAD of the View's own — what the reader left on
        it. Exact: nothing carries over. TRAP T-a-view-keeps-what-the-reader-left */
    left?: (id: string, view: SavedView) => QueryDefaults | undefined;
  } = {},
): () => void {
  if (!host) return () => {};

  /* The view this bar is ALREADY showing. The View chip is `persistent`, so
     `values.view` rides on EVERY bar event — including a Region pick.
     TRAP T-a-persistent-chip-reports-on-every-change */
  let applied: string | null = options.applied ?? null;

  /** Draw a view's own content into the region — the page's own put aside,
   *  once — or put the page's own back. TRAP T-content-first-original-once */
  const draw = (view: SavedView): ViewPick['rendered'] => {
    const into = options.into;
    if (typeof view.content !== 'string') {
      const original = into && originals.get(into);
      /* No content of its own, so it wants the page's — RE-ATTACHED, not
         rebuilt, so every existing bind still points at them. */
      if (into && original) into.replaceChildren(...original);
      return undefined;
    }
    /* PARSED, never assigned: this string came out of storage or off a
       server. TRAP T-saved-markup-is-untrusted-input */
    const { fragment, report: dropped } = parseViewMarkup(view.content);
    if (dropped.tags.length || dropped.attributes.length) {
      // Said out loud — silently losing half a view reads as a render bug.
      console.warn('view markup: dropped', dropped);
    }
    if (!into) return undefined;
    if (!originals.has(into)) originals.set(into, [...into.childNodes]);
    into.replaceChildren(fragment);
    /* A View's `ui` addresses elements BY ID, so collect them — scoped to the
       host, because an id is only addressable once it is in the page. */
    const byId: Record<string, HTMLElement> = {};
    for (const el of into.querySelectorAll<HTMLElement>('[id]')) byId[el.id] = el;
    return { elements: byId };
  };

  /** A View applied with gaps says so: to the host's hook, else the one channel.
   *  TRAP T-apply-degrades-never-throws */
  const sayGaps = (pick: ViewPick): void => {
    const { missingElements, skipped } = pick.report;
    if (!missingElements.length && !Object.keys(skipped).length) return;
    if (options.onIncomplete) return options.onIncomplete(pick);
    const keys = Object.entries(skipped).map(([id, list]) => `#${id} has no ${list.join(', ')}`);
    const gaps = [...missingElements.map((id) => `no #${id}`), ...keys].join('; ');
    report({ code: 'view-gaps', message: `View "${pick.id}" applied with gaps: ${gaps}.`, at: { view: pick.id } });
  };

  /* A page OPENED on a View with content of its own — a link, a reload — draws
     it now: its Query is on already, so no pick will. TODO 198 */
  const opening = applied ? (typeof views === 'function' ? views() : views)[applied] : undefined;
  if (applied && opening && typeof opening.content === 'string' && options.into) {
    const rendered = draw(opening);
    if (rendered) {
      const gaps: ApplyReport = { missingElements: [], skipped: {} };
      const id = applied;
      void Promise.resolve(applyElements(opening.ui ?? {}, { ...targets.elements, ...rendered.elements }, gaps))
        .then(() => sayGaps({ id, view: opening, report: gaps, rendered }));
    }
  }

  const listener = (event: Event): void => {
    const detail = (event as CustomEvent).detail as
      { scope?: string; values?: Record<string, readonly string[]> } | undefined;

    /* TRAP T-values-carries-two-shapes — the BAR'S event, not a chip's. */
    if (detail?.scope && detail.scope !== 'bar') return;

    const id = detail?.values?.[VIEW_CHIP]?.[0];
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
    options.before?.(id);

    /* TRAP T-content-first-original-once — content before its `ui`. */
    const rendered = draw(view);
    if (rendered) targets = { ...targets, elements: { ...targets.elements, ...rendered.elements } };

    const done = (report: ApplyReport): void => {
      const pick: ViewPick = { id, view, report, ...(rendered ? { rendered } : {}) };
      options.after?.(pick);
      sayGaps(pick);
    };

    /* A JSON VIEW: its Query onto a clean slate — every chip drawn from it,
       its defaults shown — then its UI. TRAP T-a-view-is-json */
    if (view.query && targets.query) {
      const report: ApplyReport = { missingElements: [], skipped: {} };
      const elements = targets.elements ?? {};
      // The View chip SHOWS it — a pick from a link or a nav row included.
      // The element that REPORTED the pick — a host above it has no chips.
      const bar = (event.composedPath()[0] ?? event.currentTarget) as {
        values?: Record<string, readonly string[]>; setChipValues?: (id: string, picks: string[]) => void;
      } | null;
      if (bar?.values && bar.values[VIEW_CHIP]?.[0] !== id) bar.setChipValues?.(VIEW_CHIP, [id]);
      const left = options.left?.(id, view);
      // A pick, not the reader's filters: a keeper of them is told so. 366 step 24
      const put = left ? targets.query.setQuery(left, { by: 'view' })
        : targets.query.setQuery(view.query, { holds: 'keep', by: 'view' });
      void put.then(() => {
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
    const report: ApplyReport = { missingElements: [], skipped: {} };
    const waiting = applyElements(view.ui ?? {}, targets.elements ?? {}, report);
    // Reported once every element has its state: a gap is only known then.
    if (waiting) void waiting.then(() => done(report));
    else done(report);
  };

  // TRAP T-signal-not-a-teardown-list — straight to the platform.
  host.addEventListener(
    'quick-filter-change', listener,
    options.signal ? { signal: options.signal } : undefined,
  );
  return () => host.removeEventListener('quick-filter-change', listener);
}

/** What is on screen as a View's JSON: the source's own `export()`, each
 *  reading in the plain form — so the arrangement stays in the scope that
 *  arranged it. TRAP T-a-view-is-json · TRAP T-group-and-sort-are-component-scope */
export function viewQueryOf(source: ViewSource): QueryDefaults {
  // In the plain form, by the source's field types. TRAP T-one-way-to-write-a-condition
  return statedQuery(source.query.export().query, (readings) => source.whereOf?.(readings) ?? whereOf(readings));
}

/** A source as a View is saved from: its Query's export, and its field types. */
type ViewSource = {
  query: { export(): { query: Query } };
  whereOf?(readings: Record<string, FieldReading>): Where;
};
