/**
 * provider-page.ts — the page a provider has open: its Views, saved filter
 * sets, drafts, kept Query and Reset. A provider holds one, and is its host.
 * TRAP T-a-provider-keeps-the-views
 *
 * Map:
 * - Bar — A filter bar, as the provider draws it.
 * - OpenedPage — The page `open()` set up: its id, store, source, Views and first Query.
 * - PageHost — What the open page asks of its provider.
 * - ProviderPage — The open page's Views, saved sets, drafts, kept Query and Reset.
 * - .opened — The page `open()` set up, or null.
 * - .begin — Take a page `open()` set up, and the saved set it had on.
 * - .end — The page has gone, with its source.
 * - .listen — The open page's own listeners: Resets, saved sets, and what the bars offer.
 * - .saveView — Save what is on screen as a View of the open page.
 * - .deleteView — Delete the reader's own View, and go to the first.
 * - .saveFilters — Save every scope's filters under one name.
 * - .applyFilters — Apply a saved set.
 * - .dismissFilters — Dismiss the set on screen: the filters go back as they were.
 * - .deleteFilters — Delete a saved set; its filters stay.
 * - .savedFilters — The saved set on screen, and whether its filters have changed since.
 * - .savedFilterSets — The page's saved sets.
 * - .customView — Is the View on screen the reader's own?
 * - .resetView — Put the filters back as the View on screen defines them.
 * - .drawBars — Draw every bar from its scope, as the source describes it.
 * - .view — The View on screen.
 * - .views — Open the Views over one source: restore, then hear and keep.
 * - .stopViews — Stop the Views' listeners.
 * - .takeView — A state taken in names a View: show it, and hear its next pick.
 */
import {
  deleteSavedView, loadSavedViews, onViewPicked, saveViewAs, uniqueViewLabel, viewOptions, viewQueryOf,
  type ViewLibrary,
} from '../../core/browser/persist-view.js';
import { labelId } from '../../core/browser/web-storage.js';
import { clearDraft, draftSig, loadDraft, saveDraft, type DraftMode } from '../../core/browser/view-drafts.js';
import {
  deleteSavedFilter, filtersOf, keepApplied, loadApplied, loadSavedFilters, sameFilters, saveFilterAs,
} from '../../core/browser/saved-filters.js';
import type { SavedSet } from '../../core/ui/filters-button.js';
import type { DataSource } from '../../core/data/data-source.js';
import { VIEW, type Query, type QueryDefaults } from '../../core/data/query.js';
import { mergeSet } from '../../core/data/query-edits.js';
import { VIEW_CHIP } from '../../core/ui/shared-constants.js';
import type { ProvideOptions } from './sherpa-provider.js';

/** A filter bar, as the provider draws it. */
export type Bar = HTMLElement & {
  populate(defs: unknown[]): Promise<void> | void;
  available?(defs: unknown[]): void;
  organise?(def: { group?: unknown[]; sort?: unknown[] }): void;
  groupSets?(sets: readonly unknown[]): void;
  heldFields?: string[];
  report?(): void;
};

/** The page `open()` set up: its id, store, source, Views and first Query. */
export interface OpenedPage {
  id: string;
  store: string;
  source: DataSource;
  library: (() => ViewLibrary) | null;
  initial: Query;
}

/** What the open page asks of its provider. */
export interface PageHost {
  /** The provider element: what its Views' controls sit in, and what hears their events. */
  readonly el: HTMLElement;
  /** Every filter bar that asked. */
  bars(): Bar[];
  /** Every panel that asked. */
  panels(): Element[];
  /** The scope a control sits in. */
  scopeOf(el: Element): string | null;
  /** The View on screen changed. */
  viewChanged(id: string | undefined, elements?: Record<string, HTMLElement>): void;
  /** A word from the provider's markup, once it has drawn. TRAP T-a-word-is-in-the-markup */
  word(key: string): Promise<string>;
}

/** The open page's Views, saved sets, drafts, kept Query and Reset. */
export class ProviderPage {
  /** The provider it serves. */
  readonly #host: PageHost;

  constructor(host: PageHost) {
    this.#host = host;
  }

  /** The page `open()` set up. */
  #opened: OpenedPage | null = null;

  /** The page `open()` set up, or null. */
  get opened(): OpenedPage | null {
    return this.#opened;
  }

  /** Take a page `open()` set up, and the saved set it had on. */
  begin(page: OpenedPage): void {
    this.#opened = page;
    // The set on screen before a reload, while it is still saved.
    const applied = loadApplied(page.id);
    const set = applied ? loadSavedFilters(page.id)[applied.id] : undefined;
    this.#savedSet = applied && set ? { id: applied.id, label: set.label, query: set.query, before: applied.before } : null;
  }

  /** The page has gone, with its source. */
  end(): void {
    this.#opened = null;
  }

  /** The open page's own listeners: Resets, saved sets, and what the bars offer. */
  listen(signal: AbortSignal): void {
    const opened = this.#opened;
    if (!opened) return;
    const { source } = opened;
    const el = this.#host.el;
    source.addEventListener('scope-change', () => this.#offer(), { signal });
    /* After every load — a filter, a sort, a View — and every scope change,
       which moves a filter and loads nothing; once a frame. TODO 231 */
    let frame = 0;
    for (const type of ['change', 'scope-change']) {
      source.addEventListener(type, () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          this.#sayResets();
          this.#saySaved();
        });
      }, { signal });
    }
    /* A REQUEST. A host that asks the reader first — a confirm dialog —
       prevents it, and calls resetView() itself. TRAP T-reset-to-default-is-the-views-own */
    el.addEventListener('view-reset', (event) => {
      if (!event.defaultPrevented) void this.resetView();
    }, { signal });
    /* REQUESTS, as Reset to default is: a saved set's row applies it, and the
       Saved chip's cross dismisses it. TRAP T-saved-filters-are-every-scope */
    el.addEventListener('filters-apply', (event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!event.defaultPrevented && id) void this.applyFilters(id);
    }, { signal });
    el.addEventListener('filters-dismiss', (event) => {
      if (!event.defaultPrevented) void this.dismissFilters();
    }, { signal });
  }

  /** Save what is on screen as a View of the open page, and put it on the View chip. */
  async saveView(label?: string, options: { stay?: boolean } = {}): Promise<string | undefined> {
    const opened = this.#opened;
    if (!opened?.library) return undefined;
    const own = this.#view ? loadSavedViews(opened.id)[this.#view] : undefined;
    const name = label == null ? own?.label
      : label.trim() && uniqueViewLabel(label, Object.values(opened.library()).map((v) => v.label));
    if (!name) return undefined;
    this.#flush?.();
    saveViewAs(opened.id, name, { source: opened.source });
    /* SAVED: the filters have a home, so neither the View they were made on
       nor the one just saved keeps a draft of them. TRAP T-a-view-keeps-a-draft */
    if (this.#drafts) {
      if (this.#view) clearDraft(this.#drafts.page, this.#view);
      clearDraft(this.#drafts.page, labelId(name));
    }
    // Read BEFORE the redraw: a rebuilt bar's first report is empty.
    const kept = opened.source.query.applied;
    const id = labelId(name);
    // The View chip lists it either way; only a plain save moves to it.
    await this.#quietly(async () => {
      await this.drawBars(options.stay ? this.#view : id);
      await opened.source.setQuery(kept);
    });
    // Reported, so the URL and the nav follow the View just saved.
    if (!options.stay) this.#viewBar()?.report?.();
    return id;
  }

  /** Delete the reader's own View — the one on screen unless named — and go to
   *  the first. A preset is never deleted. TRAP T-a-saved-view-is-the-readers-own */
  async deleteView(id = this.#view): Promise<boolean> {
    const opened = this.#opened;
    if (!opened?.library || !id || !loadSavedViews(opened.id)[id]) return false;
    deleteSavedView(opened.id, id);
    if (this.#drafts) clearDraft(this.#drafts.page, id);
    if (id !== this.#view) {
      await this.drawBars(this.#view);
      return true;
    }
    const first = Object.keys(opened.library())[0];
    this.#view = first;
    await this.drawBars(first);
    await this.resetView();
    this.#viewBar()?.report?.();
    this.#host.viewChanged(first);
    return true;
  }

  /** Save every scope's filters under one name, beside the page's Views. TRAP T-saved-filters-are-every-scope */
  saveFilters(label?: string): string | undefined {
    const opened = this.#opened;
    const name = label == null ? this.#savedSet?.label : label.trim();
    if (!opened || !name) return undefined;
    this.#flush?.();
    const query = filtersOf(viewQueryOf(opened.source));
    saveFilterAs(opened.id, name, query);
    const id = labelId(name);
    /* Saved, it is the set on screen. Dismiss puts back what was before the
       set applied — or, saved from the screen, the View's own filters. */
    this.#putOn({ id, label: name, query, before: this.#savedSet ? this.#savedSet.before : null });
    return id;
  }

  /** APPLY a saved set: each scope it names takes its filters; Dismiss puts
   *  back what was on screen before the first one. TRAP T-saved-filters-are-every-scope */
  async applyFilters(id: string): Promise<boolean> {
    const opened = this.#opened;
    const set = opened ? loadSavedFilters(opened.id)[id] : undefined;
    if (!opened || !set) return false;
    this.#flush?.();
    const before = this.#savedSet ? this.#savedSet.before : opened.source.query.applied;
    await opened.source.setQuery(mergeSet(opened.source.query.applied, set.query));
    this.#putOn({ id, label: set.label, query: set.query, before });
    return true;
  }

  /** DISMISS the set on screen: the filters go back as they were before it —
   *  or, for one saved from the screen, to the View's own. Never the sort. */
  async dismissFilters(): Promise<void> {
    const opened = this.#opened;
    const on = this.#savedSet;
    if (!opened || !on) return;
    this.#putOn(null);
    if (on.before) return opened.source.setQuery(on.before);
    const view = this.#view ? opened.library?.()[this.#view] : undefined;
    await opened.source.setQuery(structuredClone(opened.initial));
    if (view?.query) await opened.source.setQuery(filtersOf(view.query), { holds: 'keep' });
  }

  /** DELETE a saved set — the one on screen unless named. Its filters stay. */
  deleteFilters(id = this.#savedSet?.id): boolean {
    const opened = this.#opened;
    if (!opened || !id || !loadSavedFilters(opened.id)[id]) return false;
    deleteSavedFilter(opened.id, id);
    if (this.#savedSet?.id === id) this.#putOn(null);
    else this.#saySaved();
    return true;
  }

  /** The saved set on screen — its id, name, and whether its filters have changed since. */
  get savedFilters(): { id: string; label: string; edited: boolean } | null {
    const on = this.#savedSet;
    return on ? { id: on.id, label: on.label, edited: this.#edited() } : null;
  }

  /** The page's saved sets — what a host asks before it saves over a name. */
  get savedFilterSets(): { id: string; label: string }[] {
    const opened = this.#opened;
    return opened ? Object.entries(loadSavedFilters(opened.id)).map(([id, { label }]) => ({ id, label })) : [];
  }

  /** The set on screen, and what Dismiss puts back. */
  #savedSet: { id: string; label: string; query: QueryDefaults; before: Query | null } | null = null;

  /** Put a set on screen — or none — remember it in this tab, and draw it. */
  #putOn(set: { id: string; label: string; query: QueryDefaults; before: Query | null } | null): void {
    this.#savedSet = set;
    if (this.#opened) keepApplied(this.#opened.id, set ? { id: set.id, before: set.before } : null);
    this.#saySaved();
  }

  /** Have the filters changed since the set on screen was applied or saved? */
  #edited(): boolean {
    const opened = this.#opened;
    const on = this.#savedSet;
    return !!opened && !!on && !sameFilters(on.query, filtersOf(viewQueryOf(opened.source)));
  }

  /** Each saving control is told the page's sets, and which is on. TODO 105 */
  #saySaved(): void {
    const opened = this.#opened;
    if (!opened) return;
    const on = this.#savedSet;
    const edited = this.#edited();
    const sets: SavedSet[] = Object.entries(loadSavedFilters(opened.id)).map(([id, set]) => ({
      id, label: set.label, ...(on?.id === id ? { on: true, edited } : {}),
    }));
    for (const el of [...this.#host.bars(), ...this.#host.panels()] as Array<Element & { savedSets?: SavedSet[] }>) {
      if ('savedSets' in el) el.savedSets = sets;
    }
  }

  /** The bar over one scope. */
  #barFor(scope: string | null): Bar | undefined {
    return this.#host.bars().find((bar) => this.#host.scopeOf(bar) === scope);
  }

  /** Is the View on screen the reader's own — saved, so it can be saved over or deleted? */
  get customView(): boolean {
    const opened = this.#opened;
    return !!(opened && this.#view && loadSavedViews(opened.id)[this.#view]);
  }

  /** The bar over the View's own scope. */
  #viewBar(): Bar | undefined {
    return this.#barFor(VIEW);
  }

  /** Put the filters back as the View on screen DEFINES them: the page's first
   *  Query, then the View's. TRAP T-reset-to-default-is-the-views-own */
  async resetView(): Promise<void> {
    const opened = this.#opened;
    if (!opened) return;
    const view = this.#view ? opened.library?.()[this.#view] : undefined;
    await this.#quietly(async () => {
      await opened.source.setQuery(structuredClone(opened.initial));
      if (view?.query) await opened.source.setQuery(view.query, { holds: 'keep' });
    });
    // The View's own filters are on: nothing of the reader's is left to keep.
    if (this.#drafts && this.#view) clearDraft(this.#drafts.page, this.#view);
    this.#settle?.();
  }

  /** Tell each bar and panel whether its Resets would change nothing: then they
   *  are not offered. TODO 231 · TRAP T-reset-to-default-is-the-views-own */
  #sayResets(): void {
    const opened = this.#opened;
    if (!opened) return;
    const view = this.#view ? opened.library?.()[this.#view] : undefined;
    const at = opened.source.atDefault(opened.initial, view?.query);
    for (const el of [...this.#host.bars(), ...this.#host.panels()]) el.toggleAttribute('data-at-default', at);
    // And Reset, where nothing is left to clear: a bar's own scope, the panel's every one.
    const asked = new Map<string | undefined, boolean>();
    const answered = (scope?: string): boolean => {
      if (!asked.has(scope)) asked.set(scope, opened.source.answered(scope));
      return asked.get(scope)!;
    };
    for (const bar of this.#host.bars()) {
      bar.toggleAttribute('data-nothing-to-reset', !answered(this.#host.scopeOf(bar) ?? undefined));
    }
    for (const panel of this.#host.panels()) panel.toggleAttribute('data-nothing-to-reset', !answered());
  }

  /** Draw every bar from its scope, as the source describes it — the View
   *  chip first, its Group and Sort — then what it may add. */
  async drawBars(view?: string): Promise<void> {
    const opened = this.#opened;
    if (!opened) return;
    const { source, library } = opened;
    await Promise.all(this.#host.bars().map(async (bar) => {
      const scope = this.#host.scopeOf(bar);
      if (!scope) return;
      const described = source.describe(scope);
      const custom = new Set(Object.keys(loadSavedViews(opened.id)));
      const picker = scope === VIEW && library ? [{
        id: VIEW_CHIP, label: await this.#host.word('view'), persistent: true, active: true, select: 'single',
        options: viewOptions(library(), view, custom),
      }] : [];
      // The bar offers Delete only on the reader's own View. TRAP T-a-saved-view-is-the-readers-own
      if (scope === VIEW) bar.toggleAttribute('data-custom-view', !!view && custom.has(view));
      // Its sets first, so one render draws them. TRAP T-a-filter-set-groups-or-chains
      bar.groupSets?.(described.sets ?? []);
      await bar.populate([...picker, ...described.filters]);
      if (described.group) bar.organise?.({ group: described.group, sort: described.sort ?? [] });
    }));
    this.#offer();
  }

  /** Each bar's Add list: what its scope may still add — by the chips it HAS,
   *  so a restore can draw a held field's chip — each noting where it lives.
   *  And the page's saved sets. TRAP T-saved-filters-are-every-scope */
  #offer(): void {
    const opened = this.#opened;
    if (!opened) return;
    for (const bar of this.#host.bars()) {
      const scope = this.#host.scopeOf(bar);
      if (!scope) continue;
      bar.available?.(opened.source.addable(scope, bar.heldFields ?? []).map((d) => ({ ...d, removable: true })));
    }
    this.#saySaved();
  }

  /** The View on screen. */
  get view(): string | undefined {
    return this.#view;
  }

  /** The View on screen. */
  #view: string | undefined;
  /** Stops the Views' listeners when the sources change. */
  #views: AbortController | null = null;

  /** Open the Views over one source: restore, then hear and keep. Settles once the kept Query, or the start View, is on. */
  views(source: DataSource, options: ProvideOptions): Promise<void> {
    this.#views = new AbortController();
    return this.#openViews(source, options, this.#views.signal);
  }

  /** Stop the Views' listeners. */
  stopViews(): void {
    this.#views?.abort();
    this.#views = null;
    this.#hear = null;
  }

  /**
   * RESTORE, then HEAR and KEEP: the session's Query, only on the View it was
   * made on — else the URL's View; a pick from the View chip, a nav row or a
   * link puts its Query on; and the Query is kept once per frame.
   * TRAP T-a-reload-replays-the-readers-answers · TRAP T-a-view-is-json
   */
  async #openViews(source: DataSource, options: ProvideOptions, signal: AbortSignal): Promise<void> {
    const { views, session, key } = options;
    const library = (): ViewLibrary => (typeof views === 'function' ? views() : views ?? {});
    const first = Object.keys(library())[0];
    this.#view = options.view ?? first;
    const kept = key ? session?.get(key) as { view?: string; query?: Query } | undefined : undefined;
    const start = this.#view ? library()[this.#view] : undefined;
    this.#drafts = options.drafts ? { ...options.drafts, source, library } : null;
    // A link to a View the reader left a draft on opens on the draft.
    const draft = this.#view ? this.#draftOf(this.#view) : undefined;
    if (kept?.query && kept.view === this.#view) await source.setQuery(kept.query);
    else if (draft) await source.setQuery(draft);
    else if (this.#view !== first && start?.query) await source.setQuery(start.query, { holds: 'keep' });
    if (signal.aborted) return;
    this.#hear = () => this.#hearPicks(source, library, signal);
    this.#hear();
    // Opened on a View with cards of its own: they are drawn now, and the page told. TODO 198
    if (typeof start?.content === 'string') this.#host.viewChanged(this.#view);
    if (!this.#drafts && !(key && session)) return;
    let frame = 0;
    const write = (): void => {
      frame = 0;
      if (key && session) session.set(key, { view: this.#view, query: source.query.applied });
      this.#keepDraft();
    };
    /* The READER's changes only: a pick or a reset writes the source too, and
       kept then, the new View's filters were saved under the old View's name.
       TRAP T-a-view-keeps-a-draft */
    const keep = (): void => {
      if (this.#writing) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(write);
    };
    // A pick is taken: what waits for its frame is written NOW, under the View it was made on.
    this.#flush = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      write();
    };
    // After a pick or a reset, the page's kept Query is the one on screen.
    this.#settle = () => { if (key && session) session.set(key, { view: this.#view, query: source.query.applied }); };
    for (const type of ['selection-change', 'scope-change']) source.addEventListener(type, keep, { signal });
    // A preset switched is a report, and no selection changes.
    this.#host.el.addEventListener('quick-filter-change', keep, { signal });
    signal.addEventListener('abort', () => {
      cancelAnimationFrame(frame);
      this.#flush = this.#settle = null;
      this.#drafts = null;
    }, { once: true });
  }

  /** Drafts for the open page: where they are kept, and what to read them from. */
  #drafts: { page: string; mode: () => DraftMode; source: DataSource; library: () => ViewLibrary } | null = null;
  /** Write now what a reader's change left waiting for its frame. */
  #flush: (() => void) | null = null;
  /** Keep the Query on screen as the page's own, after the provider wrote it. */
  #settle: (() => void) | null = null;
  /** The PROVIDER is writing the source — a View pick, a reset — so nothing heard is the reader's. */
  #writing = false;

  /** The draft a reader left on one View, if drafts are kept. */
  #draftOf(id: string): QueryDefaults | undefined {
    const d = this.#drafts;
    return d ? loadDraft(d.page, id, draftSig(d.library()[id]), d.mode()) : undefined;
  }

  /** Keep what is on screen as the draft of the View on screen. */
  #keepDraft(): void {
    const d = this.#drafts;
    if (!d || !this.#view) return;
    saveDraft(d.page, this.#view, viewQueryOf(d.source), draftSig(d.library()[this.#view]), d.mode());
  }

  /** Run a write of the provider's own, and hear nothing of it as the reader's:
   *  a bar redrawn by it reports a frame or two later. */
  async #quietly(work: () => Promise<void>): Promise<void> {
    this.#writing = true;
    try {
      await work();
    } finally {
      this.#unquietSoon();
    }
  }

  /** The reader is heard again, two frames on. */
  #unquietSoon(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => { this.#writing = false; }));
  }

  /** Listen for View picks again, knowing the View on screen now. */
  #hear: (() => void) | null = null;
  /** Stops the current View-pick listener. */
  #pickListener: AbortController | null = null;

  /** A pick from the View chip, a nav row or a link puts that View's Query on. */
  #hearPicks(source: DataSource, library: () => ViewLibrary, signal: AbortSignal): void {
    this.#pickListener?.abort();
    this.#pickListener = new AbortController();
    const picks = this.#pickListener;
    signal.addEventListener('abort', () => picks.abort(), { once: true });
    const el = this.#host.el;
    // Whatever has an id in this subtree NOW — a View's content brings its own.
    const byId = (): Record<string, HTMLElement> =>
      Object.fromEntries([...el.querySelectorAll<HTMLElement>('[id]')].map((e) => [e.id, e]));
    onViewPicked(el, library, {
      source,
      get elements() { return byId(); },
    }, {
      signal: picks.signal,
      // The View on screen already — a first pick of it would wipe what was kept.
      // TRAP T-a-persistent-chip-reports-on-every-change
      applied: this.#view ?? null,
      into: el.querySelector<HTMLElement>('[data-view-content]'),
      // The old View's draft is written before its answers go. TRAP T-a-view-keeps-a-draft
      before: () => {
        this.#flush?.();
        this.#writing = true;
      },
      draft: (id) => this.#draftOf(id),
      after: ({ id, rendered }) => {
        this.#view = id;
        this.#settle?.();
        this.#unquietSoon();
        this.#viewBar()?.toggleAttribute('data-custom-view', this.customView);
        this.#host.viewChanged(id, rendered?.elements);
      },
    });
  }

  /** A state taken in names a View: show it on the chip, and hear its next pick. */
  takeView(id: string): void {
    if (id === this.#view) return;
    const was = this.#view;
    this.#view = id;
    this.#showView(was, id);
    this.#hear?.();
    this.#host.viewChanged(id);
  }

  /** Put a View on the chip that shows the current one — silently: its Query is on. */
  #showView(was: string | undefined, id: string): void {
    for (const bar of this.#host.el.querySelectorAll<HTMLElement & {
      values?: Record<string, readonly string[]>; setChipValues?: (id: string, v: string[]) => void;
    }>('sherpa-quick-filter-toolbar')) {
      const chip = Object.keys(bar.values ?? {}).find((k) => bar.values?.[k]?.[0] === was);
      if (chip) bar.setChipValues?.(chip, [id]);
    }
  }
}
