/**
 * provider-page.ts — the page a provider has open: its Views, its store's
 * Filters, what the reader left on each View, its kept state and Reset — kept
 * through the page keeper. A provider holds one, and is its host.
 * TRAP T-a-provider-keeps-the-views
 *
 * Map:
 * - Bar — A filter bar, as the provider draws it.
 * - OpenedPage — The page `open()` set up: its id, store, source, Views and first Query.
 * - PageHost — What the open page asks of its provider.
 * - ProviderPage — The open page's Views, its Filters, what each View was left with, its kept state and Reset.
 * - .opened — The page `open()` set up, or null.
 * - .begin — Take a page `open()` set up.
 * - .end — The page has gone, with its source.
 * - .listen — The open page's own listeners: Resets, the shelf's Filters, and what the bars offer.
 * - .saveView — Save what is on screen as a View of the open page.
 * - .deleteView — Delete the reader's own View, and go to the first.
 * - .saveFilters — Save the filters under a name: a Filter of the reader's per scope that holds an answer, each a chip.
 * - .renameFilters — Rename a reader's own Filter and publish it; its id stays.
 * - .deleteFilters — Delete a reader's own Filter, unless another entity uses it.
 * - .customView — Is the View on screen the reader's own?
 * - .resetView — Put the filters back as the View on screen defines them.
 * - .drawBars — Draw every bar from its scope, as the source describes it.
 * - .joined — A bar that asks once the page's bars are drawn — a filter stack's — is drawn as they were.
 * - .view — The View on screen.
 * - .views — Open the Views over one source: restore, then hear and keep.
 * - .stopViews — Stop the Views' listeners, the page kept as it was left.
 * - .sharing — sharing — does the app share the View's answer: set by its provider as it opens a page.
 * - .share — share(on) — the app starts sharing the View's answer, or stops: the page on screen takes the App answer, or…
 * - .takeView — A state taken in names a View: show it, and hear its next pick.
 * - redraft — A pick that waited for Apply comes back waiting, in each scope that waits — but `skip`, the App Context's.
 */
import {
  onViewPicked, uniqueViewLabel, viewOptions, viewQueryOf, type SavedView, type ViewLibrary,
} from '../../core/browser/persist-view.js';
import { labelId } from '../../core/browser/web-storage.js';
import { viewSig, type PageChange, type PageKeeper, type PageState } from '../../core/browser/page-state.js';
import { filtersOf } from '../../core/browser/saved-filters.js';
import type { DataSource } from '../../core/data/data-source.js';
import { presetReadings } from '../../core/data/page-definition.js';
import { entityKind, entityRefOf, type Entity } from '../../core/data/entity.js';
import { FILTER } from '../../core/data/entity-types.js';
import { publish } from '../../core/data/entity-versions.js';
import type { PagePreset } from '../../core/data/filter.js';
import type { QueryChangeDetail, QueryContext } from '../../core/data/query-context.js';
import { VIEW, emptyScope, sameReading, type Query, type QueryDefaults, type ScopeQuery } from '../../core/data/query.js';
import { layShared, sharedOf } from '../../core/data/query-edits.js';
import { VIEW_CHIP } from '../../core/ui/shared-constants.js';
import { organiseOf } from '../../core/ui/filter-host.js';
import type { ProvideOptions } from './sherpa-provider.js';

/** A filter bar, as the provider draws it. */
export type Bar = HTMLElement & {
  populate(defs: unknown[]): Promise<void> | void;
  available?(defs: unknown[]): void;
  organise?(def: { group?: unknown[]; sort?: unknown[] }): void;
  groupSets?(sets: readonly unknown[]): void;
  nameScope?(scope: { label: string }): void;
  heldFields?: string[];
  report?(): void;
};

/** The page `open()` set up: its id, store, source, Views and first Query. */
export interface OpenedPage {
  /** Its name in the keeper: what its state is kept under. TODO 321 */
  id: string;
  store: string;
  source: DataSource;
  /** The Context's Query: the one the page's controls and Views write. 366 step 24 */
  query: QueryContext;
  library: (() => ViewLibrary) | null;
  initial: Query;
  /** Its store's Filters, each a preset of its bar, and how to read them again. TODO 776 */
  filterPresets?: readonly PagePreset[];
  readFilterPresets?: () => Promise<readonly PagePreset[]>;
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
  /** May filters be saved from any scope? Off, one local scope's. TODO 485 */
  saveAnyScope(): boolean;
  /** The View on screen changed. */
  viewChanged(id: string | undefined, elements?: Record<string, HTMLElement>): void;
  /** A word from the provider's markup, once it has drawn. TRAP T-a-word-is-in-the-markup */
  word(key: string): Promise<string>;
  /** Where every page's state is kept. TRAP T-one-page-one-document */
  keeper(): PageKeeper;
}

/** The open page's Views, its Filters, what each View was left with, its kept state and Reset. */
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

  /** Take a page `open()` set up. */
  begin(page: OpenedPage): void {
    this.#opened = page;
    this.#barsDrawn = false;
    this.#drawn = new WeakSet();
    // Its store's Filters, each on the bar of the scope that holds its fields: BEFORE the Query, which may hold their rows. TODO 776
    this.#filterPresets = this.#homed(page.filterPresets ?? []);
    this.#layPresets(this.#filterPresets.map((f) => f.scope));
  }

  /** The page's Filters, each with the scope whose bar it leads. TODO 776 */
  #filterPresets: { preset: PagePreset; scope: string }[] = [];

  /** The Filters the View on screen offers: those it names, else every one over its store (Will, plan 960 U4.4d). */
  #offered(): { preset: PagePreset; scope: string }[] {
    const named = this.#view ? this.#opened?.library?.()[this.#view]?.filters : undefined;
    return named ? this.#filterPresets.filter((f) => named.includes(f.preset.id)) : this.#filterPresets;
  }

  /** Lay the Filters again: another View may offer others. */
  #relayFilters(): void {
    this.#layPresets(this.#filterPresets.map((f) => f.scope));
  }

  /** Each Filter's scope: the one that holds every field it names, else the View. Plan 776 D3 */
  #homed(presets: readonly PagePreset[]): { preset: PagePreset; scope: string }[] {
    const query = this.#opened?.query;
    return presets.map((preset) => {
      const held = new Set(Object.keys(preset.where).map((field) => query?.scopeOf(field) ?? null));
      const [one] = held;
      return { preset, scope: held.size === 1 && one ? one : VIEW };
    });
  }

  /** The shelf moved — here, or in another tab: the Filters read again, and the bars drawn when they changed. */
  async #refilter(): Promise<void> {
    const opened = this.#opened;
    const next = await opened?.readFilterPresets?.();
    if (!opened || !next || this.#opened !== opened) return;
    const now = this.#homed(next);
    if (JSON.stringify(now) === JSON.stringify(this.#filterPresets)) return;
    const was = this.#filterPresets.map((f) => f.scope);
    this.#filterPresets = now;
    this.#layPresets([...was, ...now.map((f) => f.scope)]);
    await this.drawBars(this.#view);
  }

  /** The page has gone, with its source. */
  end(): void {
    this.#opened = null;
  }

  /** The open page's own listeners: Resets, the shelf's Filters, and what the bars offer. */
  listen(signal: AbortSignal): void {
    const opened = this.#opened;
    if (!opened) return;
    const { source } = opened;
    const el = this.#host.el;
    // A scope moved: what each bar may add moved with it.
    const scoped = (e: Event): boolean => (e as CustomEvent<QueryChangeDetail>).detail.scopes.length > 0;
    source.query.addEventListener('query-change', (e) => { if (scoped(e)) this.#offer(); }, { signal });
    /* After every load — a filter, a sort, a View — and every scope change,
       which moves a filter and loads nothing; once a frame. TODO 231 */
    let frame = 0;
    const say = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        this.#sayResets();
        this.#sayApplied();
      });
    };
    source.addEventListener('change', say, { signal });
    source.query.addEventListener('query-change', (e) => { if (scoped(e)) say(); }, { signal });
    /* A REQUEST. A host that asks the reader first — a confirm dialog —
       prevents it, and calls resetView() itself. TRAP T-reset-to-default-is-the-views-own */
    el.addEventListener('view-reset', (event) => {
      if (!event.defaultPrevented) void this.resetView();
    }, { signal });
    // A Filter saved or removed, here or in another tab. TODO 776
    this.#host.keeper().entities.watch(() => void this.#refilter(), signal);
    // Which control asked to save, before the host names the filters: off, they are that scope's. TODO 485
    for (const type of ['filters-save', 'filters-save-as']) {
      el.addEventListener(type, (event) => {
        const path = event.composedPath();
        const from = [...this.#host.bars(), ...this.#host.panels()].find((c) => path.includes(c));
        this.#savingAt = from ? this.#localOf(from) : null;
      }, { signal, capture: true });
    }
  }

  /** Save what is on screen as a View of the open page, and put it on the View chip. */
  async saveView(label?: string, options: { stay?: boolean } = {}): Promise<string | undefined> {
    const opened = this.#opened;
    if (!opened?.library) return undefined;
    const own = this.#view ? this.#mine()[this.#view] : undefined;
    const name = label == null ? own?.label
      : label.trim() && uniqueViewLabel(label, Object.values(opened.library()).map((v) => v.label));
    if (!name) return undefined;
    this.#flush?.();
    const id = labelId(name);
    // JSON: the source's Query and arrangement. TRAP T-a-view-is-json
    this.#keep({ views: { ...this.#mine(), [id]: { label: name, query: viewQueryOf(opened.source) } } });
    /* SAVED: the filters have a home, so neither the View they were made on
       nor the one just saved keeps what the reader left. TRAP T-a-view-keeps-what-the-reader-left */
    this.#forget([this.#view, id]);
    // Read BEFORE the redraw: a rebuilt bar's first report is empty.
    const kept = opened.query.applied;
    // The View chip lists it either way; only a plain save moves to it.
    await this.drawBars(options.stay ? this.#view : id);
    await opened.query.setQuery(kept, { by: 'provider' });
    // Reported, so the URL and the nav follow the View just saved.
    if (!options.stay) this.#viewBar()?.report?.();
    return id;
  }

  /** Delete the reader's own View — the one on screen unless named — and go to
   *  the first. A preset is never deleted. TRAP T-a-saved-view-is-the-readers-own */
  async deleteView(id = this.#view): Promise<boolean> {
    const opened = this.#opened;
    if (!opened?.library || !id || !this.#mine()[id]) return false;
    const { [id]: _gone, ...rest } = this.#mine();
    this.#keep({ views: rest });
    this.#forget([id]);
    if (id !== this.#view) {
      await this.drawBars(this.#view);
      return true;
    }
    const first = Object.keys(opened.library())[0];
    this.#view = first;
    this.#relayFilters();
    await this.drawBars(first);
    await this.resetView();
    this.#viewBar()?.report?.();
    this.#host.viewChanged(first);
    return true;
  }

  /** Save the filters under a NAME, as Filters of the reader's on the shelf: one per scope that holds an answer, "<name>",
   *  or "<name> · <scope's label>" for each of several (`filtersOfSaved`). Each is a preset of its store, so its chip joins
   *  its bar, off: the bars' own filters still say the same. Off `saveAnyScope`, ONE local scope's: the one named, or the
   *  bar's that asked (TODO 485). The ids kept; none, nothing saved. Will, plan 960 U4.4c · TRAP T-saved-filters-are-every-scope */
  async saveFilters(label: string, scope?: string): Promise<string[]> {
    const opened = this.#opened;
    const any = this.#host.saveAnyScope();
    const local = any ? null : scope ?? this.#savingAt;
    const name = label.trim();
    if (!opened || !name || (!any && (!local || local === VIEW))) return [];
    this.#flush?.();
    const all = filtersOf(viewQueryOf(opened.source));
    const query: QueryDefaults = local ? { v: 1, scopes: { [local]: all.scopes[local] ?? emptyScope() } } : all;
    const shelf = this.#host.keeper().entities;
    const labels = Object.fromEntries(Object.keys(query.scopes).map((s) => [s, { label: opened.query.scopeLabel(s) }]));
    const { filtersOfSaved } = await import('../../core/data/filter.js');
    const kept: string[] = [];
    for (const filter of filtersOfSaved({ [labelId(name)]: { label: name, query } }, opened.store, labels, shelf.list().map((e) => e.id))) {
      if (await shelf.save(filter)) kept.push(filter.id);
    }
    return kept;
  }

  /** The reader's own Filter by id, or none: a preset or another type is not theirs to change. */
  #ownFilter(id: string): Entity | undefined {
    const filter = this.#host.keeper().entities.get(id);
    return filter?.type === FILTER && filter.origin === 'mine' ? filter : undefined;
  }

  /** RENAME a reader's own Filter: saved with the new name, then published, as a name is part of a version. Its id stays,
   *  so its chip and its uses keep it. The id; none, it is not the reader's own or the name is empty. Plan 960 U4.4c */
  async renameFilters(id: string, label: string): Promise<string | undefined> {
    const filter = this.#ownFilter(id);
    const name = label.trim();
    if (!filter || !name) return undefined;
    if (name === filter.label) return id;
    const shelf = this.#host.keeper().entities;
    if (!await shelf.save({ ...filter, label: name })) return undefined;
    await publish(shelf, id);
    return id;
  }

  /** DELETE a reader's own Filter: turned off on its bar, then removed from the shelf. Refused while another entity uses
   *  it (`whyKept` says why, in words). Did it go? Plan 960 U4.4c */
  deleteFilters(id: string): boolean {
    const filter = this.#ownFilter(id);
    if (!filter) return false;
    const shelf = this.#host.keeper().entities;
    // Off first, where it may go: what it held goes with it.
    const preset = entityKind(filter);
    const at = this.#filterPresets.find((f) => f.preset.id === preset)?.scope;
    if (!shelf.whyKept(id) && at && this.#opened?.query.presetOn(at, preset)) {
      this.#flush?.();
      this.#opened.query.ask({ scope: at, preset, on: false, commit: true });
    }
    return shelf.remove(id);
  }

  /** The open page's state, as its keeper holds it now. */
  #state(): PageState {
    return this.#opened ? this.#host.keeper().read(this.#opened.id) : { v: 3 };
  }

  /** Change parts of the open page's state. */
  #keep(parts: PageChange): void {
    if (this.#opened) this.#host.keeper().write(this.#opened.id, parts);
  }

  /** The reader's own Views of the open page. */
  #mine(): Record<string, SavedView> {
    return this.#state().views ?? {};
  }

  /** Each of these scopes' presets: the app's own, then its Filters: one door, `presetReadings` over the plain form. A
   *  reader's own Filter says its id (`mine`): its chip offers Rename and Delete. Will, TODO 776, plan 960 U4.4c
   *  · TRAP T-a-filter-is-a-preset-of-its-store */
  #layPresets(scopes: Iterable<string>): void {
    const opened = this.#opened;
    if (!opened) return;
    const offered = this.#offered();
    for (const scope of new Set(scopes)) {
      const app = opened.query.presets(scope).filter((preset) => entityRefOf(preset.id).type !== FILTER);
      const filters = offered.filter((f) => f.scope === scope).map(({ preset }) => {
        const mine = this.#ownFilter(entityRefOf(preset.id).id)?.id;
        return { id: preset.id, label: preset.label, readings: presetReadings(opened.source, preset.where), ...(mine ? { mine } : {}) };
      });
      opened.source.declarePresets(scope, [...app, ...filters]);
    }
  }

  /** The control that last asked to save: its local scope, or null for the View's
   *  bar and a panel; undefined before any asked. TODO 485 */
  #savingAt: string | null | undefined = undefined;

  /** A control's LOCAL scope: a bar's, not the View's; a panel has none. */
  #localOf(el: Element): string | null {
    if (!this.#host.bars().includes(el as Bar)) return null;
    const scope = this.#host.scopeOf(el);
    return scope && scope !== VIEW ? scope : null;
  }

  /** The bar over one scope. */
  #barFor(scope: string | null): Bar | undefined {
    return this.#host.bars().find((bar) => this.#host.scopeOf(bar) === scope);
  }

  /** Is the View on screen the reader's own — saved, so it can be saved over or deleted? */
  get customView(): boolean {
    const opened = this.#opened;
    return !!(opened && this.#view && this.#mine()[this.#view]);
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
    await opened.query.setQuery(structuredClone(opened.initial), { by: 'provider' });
    if (view?.query) await opened.query.setQuery(view.query, { holds: 'keep', by: 'provider' });
    // The View's own filters are on: nothing of the reader's is left to keep.
    this.#forget([this.#view]);
    // …and they are the App Context's now, and this page's own. TODO 453
    if (this.#sharing) {
      this.#ownView = structuredClone(opened.query.applied.scopes[VIEW] ?? emptyScope());
      this.#share(opened.source, true);
    }
    this.#settle?.();
  }

  /** Each bar and panel told how many filters are APPLIED in what it answers:
   *  a bar its scope; a column its scopes and their charts'; a panel every one.
   *  Will, TODO 436 */
  #sayApplied(): void {
    const source = this.#opened?.source;
    if (!source) return;
    for (const bar of this.#host.bars()) bar.setAttribute('data-applied', String(source.appliedCount([this.#host.scopeOf(bar) ?? ''])));
    for (const panel of this.#host.panels()) panel.setAttribute('data-applied', String(source.appliedCount(scopesOf(panel), true)));
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
    // A column resets its own scopes: only theirs offer it. TODO 518
    for (const panel of this.#host.panels()) panel.toggleAttribute('data-nothing-to-reset', !opened.source.answered(scopesOf(panel)));
  }

  /** Draw every bar — or these — from its scope, as the source describes it:
   *  the View chip first, its Group and Sort — then what it may add. */
  async drawBars(view?: string, only?: readonly Bar[]): Promise<void> {
    const opened = this.#opened;
    if (!opened) return;
    const { source, library } = opened;
    await Promise.all((only ?? this.#host.bars()).map(async (bar) => {
      const scope = this.#host.scopeOf(bar);
      if (!scope) return;
      this.#drawn.add(bar);
      const described = source.describe(scope);
      const custom = new Set(Object.keys(this.#mine()));
      // A portrait bar is the panel's column: the View chip stays the header's. TODO 425
      const picker = scope === VIEW && library && (bar as HTMLElement).dataset['orientation'] !== 'portrait' ? [{
        id: VIEW_CHIP, label: await this.#host.word('view'), persistent: true, active: true, select: 'single',
        options: viewOptions(library(), view, custom),
      }] : [];
      // Its scope's name and icon: a portrait bar's heading. TODO 425
      bar.nameScope?.(described);
      // Its sets first, so one render draws them. TRAP T-a-filter-set-groups-or-chains
      bar.groupSets?.(described.sets ?? []);
      await bar.populate([...picker, ...described.filters]);
      if (described.group) bar.organise?.(organiseOf(described));
    }));
    if (!only) this.#barsDrawn = true;
    this.#offer(only);
  }
  /** The page's bars have been drawn. */
  #barsDrawn = false;
  /** The bars drawn for this page: a bar binds AFTER, and is not drawn twice. */
  #drawn = new WeakSet<Bar>();

  /** A bar that asks once the page's bars are drawn — a filter stack's, made
   *  for each scope it is told — is drawn as they were. TODO 425 */
  joined(bar: Bar): void {
    if (this.#barsDrawn && !this.#drawn.has(bar)) void this.drawBars(this.#view, [bar]);
  }

  /** Each bar's Add list — or only these bars': a late one joining tells no
   *  other again (TRAP T-the-local-context-waits-for-the-view) — what its scope may still add, by the chips it
   *  HAS, so a restore can draw a held field's chip, each noting where it
   *  lives. */
  #offer(only?: readonly Bar[]): void {
    const opened = this.#opened;
    if (!opened) return;
    for (const bar of only ?? this.#host.bars()) {
      const scope = this.#host.scopeOf(bar);
      if (!scope) continue;
      bar.available?.(opened.source.addable(scope, bar.heldFields ?? []).map((d) => ({ ...d, removable: true })));
    }
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

  /** Stop the Views' listeners. A page left is kept as it was left — its View on screen, its Query and what
   *  waited for its frame — so the next to open it, a Node Editor too, opens it so. TRAP T-a-graph-is-a-view-of-a-type */
  stopViews(): void {
    this.#flush?.();
    this.#settle?.();
    this.#views?.abort();
    this.#views = null;
    this.#hear = null;
  }

  /**
   * RESTORE, then HEAR and KEEP: the kept Query, only on the View it was made
   * on — else what the reader left on the URL's View, else that View; a pick
   * from the View chip, a nav row or a link puts its Query on; and the page's
   * state is kept once per frame. TRAP T-a-reload-replays-the-readers-answers · TRAP T-a-view-is-json
   */
  async #openViews(source: DataSource, options: ProvideOptions, signal: AbortSignal): Promise<void> {
    const { views, key } = options;
    const library = (): ViewLibrary => (typeof views === 'function' ? views() : views ?? {});
    const first = Object.keys(library())[0];
    this.#view = options.view ?? first;
    // Its Filters, before its Query, which may turn one on.
    this.#relayFilters();
    const kept = key ? this.#host.keeper().read(key) : undefined;
    const start = this.#view ? library()[this.#view] : undefined;
    this.#keyed = key ? { key, source, library } : null;
    // A link to a View the reader left changed opens on what they left.
    const left = this.#view ? this.#leftOf(this.#view) : undefined;
    // The App Context's answer goes over each Query put on. TODO 453
    const lay = this.#lay(source);
    if (kept?.query && kept.view === this.#view) {
      await source.query.setQuery(kept.query, { lay });
      if (kept.draft) redraft(source, kept.draft, this.#sharing ? VIEW : undefined);
    } else if (left) await source.query.setQuery(left, { lay });
    else if (this.#view !== first && start?.query) await source.query.setQuery(start.query, { holds: 'keep', lay });
    else if (this.#sharing) await source.query.setQuery(source.query.applied, { lay });
    if (signal.aborted) return;
    this.#share(source);
    // A page opened for its Query alone: no View chip is its. TRAP T-a-graph-is-a-view-of-a-type
    this.#hear = options.bars === false ? null : () => this.#hearPicks(source, library, signal);
    this.#hear?.();
    // Opened on a View with cards of its own: they are drawn now, and the page told. TODO 198
    if (typeof start?.content === 'string') this.#host.viewChanged(this.#view);
    if (!key) return;
    let frame = 0;
    const write = (): void => {
      frame = 0;
      this.#share(source, true);
      this.#keepNow(true);
    };
    /* The READER's changes only: a pick or a reset writes the Query too, says
       who by, and kept then, the new View's filters were kept under the old
       View's name. TRAP T-a-view-keeps-what-the-reader-left */
    const keep = (event: Event): void => {
      const by = (event as CustomEvent<QueryChangeDetail>).detail?.by;
      if (by && by !== 'reader') return;
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
    this.#settle = () => this.#keepNow(false);
    source.query.addEventListener('query-change', keep, { signal });
    signal.addEventListener('abort', () => {
      cancelAnimationFrame(frame);
      this.#flush = this.#settle = null;
      this.#keyed = null;
    }, { once: true });
  }

  /** The page whose Views are heard: its name in the keeper, its source and its Views. */
  #keyed: { key: string; source: DataSource; library: () => ViewLibrary } | null = null;
  /** Write now what a reader's change left waiting for its frame. */
  #flush: (() => void) | null = null;
  /** Keep the Query on screen as the page's own, after the provider wrote it. */
  #settle: (() => void) | null = null;

  /** What the reader left on one View, while each View keeps it. One left over
   *  ANOTHER definition is dropped: a changed preset must not hide behind it. */
  #leftOf(id: string): QueryDefaults | undefined {
    const k = this.#keyed;
    const keeper = this.#host.keeper();
    if (!k || !keeper.eachView) return undefined;
    const { [id]: one, ...rest } = keeper.read(k.key).left ?? {};
    if (!one) return undefined;
    if (one.sig === viewSig(k.library()[id])) return one.query;
    keeper.write(k.key, { left: rest });
    return undefined;
  }

  /** Forget what the reader left on these Views: their own filters are on, or
   *  the filters have a home. */
  #forget(ids: readonly (string | undefined)[]): void {
    const k = this.#keyed;
    if (!k) return;
    const keeper = this.#host.keeper();
    const left = Object.entries(keeper.read(k.key).left ?? {}).filter(([id]) => !ids.includes(id));
    keeper.write(k.key, { left: Object.fromEntries(left) });
  }

  /** Keep the View on screen, its Query and what waits for Apply; after a
   *  reader's change, what they left on the View too. While the App Context
   *  shares the View, this page's own is what it keeps. Will, TODOs 410, 453 */
  #keepNow(reader: boolean): void {
    const k = this.#keyed;
    if (!k) return;
    const keeper = this.#host.keeper();
    const { source } = k;
    const own = this.#kept();
    const mine = (q: Query): Query => (own ? withView(q, own) : q);
    const parts: PageChange = {
      view: this.#view, query: mine(source.query.applied), draft: source.query.dirty() ? mine(source.query.draft) : undefined,
    };
    if (reader && !keeper.eachView) parts.left = undefined;
    else if (reader && this.#view) {
      const from = own ? {
        query: { export: () => ({ query: withView(source.query.export().query, own) }) },
        whereOf: (r: Parameters<DataSource['whereOf']>[0]) => source.whereOf(r),
      } : source;
      parts.left = { ...keeper.read(k.key).left, [this.#view]: { query: viewQueryOf(from), sig: viewSig(k.library()[this.#view]) } };
    }
    keeper.write(k.key, parts);
  }

  /** The app shares one View answer for every page: the App Context, kept by
   *  the keeper. TODO 453 · TRAP T-the-app-context-is-one-answer */
  #sharing = false;
  /** This page's own View under the App answer: what it keeps, and what comes
   *  back when sharing stops. */
  #ownView: ScopeQuery | null = null;

  /** sharing — does the app share the View's answer: set by its provider as it opens a page. */
  set sharing(on: boolean) {
    this.#sharing = on;
    this.#ownView = null;
  }

  /** share(on) — the app starts sharing the View's answer, or stops: the page
   *  on screen takes the App answer, or gets its own back. Will, TODO 453 (D2 A) */
  async share(on: boolean): Promise<void> {
    const was = this.#sharing;
    const own = this.#ownView;
    this.#sharing = on;
    const source = this.#opened?.source;
    if (!source || on === was) return;
    if (on) await source.query.setQuery(source.query.applied, { lay: this.#lay(source), by: 'provider' });
    else {
      this.#ownView = null;
      if (own) await source.query.setQuery(withView(source.query.applied, own), { by: 'provider' });
    }
    this.#share(source);
    this.#settle?.();
  }

  /** Lay the App answer over a Query about to go on — and keep, first, the View
   *  it had: this page's own. */
  #lay(source: DataSource): (query: Query) => void {
    return (query) => {
      if (!this.#sharing) return;
      this.#ownView = structuredClone(query.scopes[VIEW] ?? emptyScope());
      const shared = this.#host.keeper().appContext;
      if (shared) layShared(query, shared, (f) => source.has(f));
    };
  }

  /** Write the View's answer as the App's — on a reader's act, or where there is
   *  none yet — and draw what it holds that this page has not. */
  #share(source: DataSource, write = false): void {
    if (!this.#sharing) {
      if (source.declareUnused(VIEW, [])) void this.drawBars(this.#view);
      return;
    }
    const keeper = this.#host.keeper();
    const was = keeper.appContext;
    const face = (f: string): { label: string; icon?: string } => {
      const def = source.filterDef(f);
      return { label: def.label, ...(def.icon ? { icon: def.icon } : {}) };
    };
    if (write || !was) keeper.appContext = sharedOf(source.query.applied, was, (f) => source.has(f), face);
    const now = keeper.appContext;
    const unused = (now?.holds ?? []).filter((f) => !source.has(f)).map((f) => ({ id: f, ...now!.faces[f]! }));
    if (source.declareUnused(VIEW, unused)) void this.drawBars(this.#view);
  }

  /** The View this page keeps while sharing: its own. */
  #kept(): ScopeQuery | undefined {
    return this.#sharing && this.#ownView ? this.#ownView : undefined;
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
    // A View's Query goes on under the App answer too: it sets its own filters alone. D1 A
    const lay = this.#lay(source);
    onViewPicked(el, library, {
      query: { setQuery: (q, o) => source.query.setQuery(q, { ...o, lay }).then(() => this.#share(source)) },
      get elements() { return byId(); },
    }, {
      signal: picks.signal,
      // The View on screen already — a first pick of it would wipe what was kept.
      // TRAP T-a-persistent-chip-reports-on-every-change
      applied: this.#view ?? null,
      into: el.querySelector<HTMLElement>('[data-view-content]'),
      // What the reader left on the old View is written before its answers go. TRAP T-a-view-keeps-what-the-reader-left
      before: () => this.#flush?.(),
      left: (id) => this.#leftOf(id),
      after: ({ id, rendered }) => {
        this.#view = id;
        this.#relayFilters();
        this.#settle?.();
        this.#host.viewChanged(id, rendered?.elements);
      },
    });
  }

  /** A state taken in names a View: show it on the chip, and hear its next pick. */
  takeView(id: string): void {
    if (id === this.#view) return;
    const was = this.#view;
    this.#view = id;
    this.#relayFilters();
    this.#showView(was, id);
    this.#hear?.();
    this.#host.viewChanged(id);
  }

  /** Put a View on the chip that shows the current one — silently: its Query is on. */
  #showView(was: string | undefined, id: string): void {
    const shows = [...this.#host.bars(), ...this.#host.panels()].filter((bar) => this.#host.el.contains(bar));
    for (const bar of shows as Array<Element & { values?: Record<string, readonly string[]>; setChipValues(id: string, v: string[]): void }>) {
      const chip = Object.keys(bar.values ?? {}).find((k) => bar.values?.[k]?.[0] === was);
      if (chip) bar.setChipValues(chip, [id]);
    }
  }
}

/** A column's scopes, from its `data-scope` list. */
function scopesOf(panel: Element): string[] {
  return (panel.getAttribute('data-scope') ?? '').split(/\s+/).filter(Boolean);
}

/** A Query with another View scope. */
function withView(query: Query, view: ScopeQuery): Query {
  return { ...query, scopes: { ...query.scopes, [VIEW]: structuredClone(view) } };
}

/** A pick that waited for Apply comes back waiting, in each scope that waits —
 *  but `skip`, the App Context's. TODO 410 */
export function redraft(source: DataSource, draft: Query, skip?: string): void {
  const applied = source.query.applied;
  for (const [scope, s] of Object.entries(draft.scopes)) {
    if (!source.query.named(scope) || scope === skip) continue;
    const was = applied.scopes[scope]?.readings ?? {};
    for (const field of new Set([...Object.keys(s.readings), ...Object.keys(was)])) {
      const want = s.readings[field] ?? null;
      if (!sameReading(want, was[field])) source.query.ask({ scope, field, reading: want });
    }
  }
}
