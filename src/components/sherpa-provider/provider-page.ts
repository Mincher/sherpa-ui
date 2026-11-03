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
 * - .begin — Take a page `open()` set up.
 * - .end — The page has gone, with its source.
 * - .listen — The open page's own listeners: Resets, saved sets, and what the bars offer.
 * - .saveView — Save what is on screen as a View of the open page.
 * - .deleteView — Delete the reader's own View, and go to the first.
 * - .saveFilters — Save the filters under a name: a preset of the reader's, its chip on the bar that saved it.
 * - .applyFilters — Add a saved set to a bar as a preset, on.
 * - .dismissFilters — Take a saved set off its bar: its chip goes, and what it held.
 * - .deleteFilters — Delete a reader's saved set, and its chip and what it held.
 * - .renameFilters — Rename a reader's saved set; its id follows its name.
 * - .savedFilterSets — The page's saved sets, and which are on a bar.
 * - .savesChanged — The app changed where filters are saved: every control told again.
 * - .customView — Is the View on screen the reader's own?
 * - .resetView — Put the filters back as the View on screen defines them.
 * - .drawBars — Draw every bar from its scope, as the source describes it.
 * - .joined — A bar that asks once the page's bars are drawn — a filter stack's — is drawn as they were.
 * - .view — The View on screen.
 * - .views — Open the Views over one source: restore, then hear and keep.
 * - .stopViews — Stop the Views' listeners.
 * - .sharing — sharing — the store before the page restores: set by its provider as it opens one.
 * - .share — share(store) — the app starts sharing the View's answer, or (null) stops: the page on screen takes the App an…
 * - .takeView — A state taken in names a View: show it, and hear its next pick.
 * - SharedStore — Where the App Context's answer is kept.
 */
import {
  deleteSavedView, loadSavedViews, onViewPicked, saveViewAs, uniqueViewLabel, viewOptions, viewQueryOf,
  type ViewLibrary,
} from '../../core/browser/persist-view.js';
import { labelId } from '../../core/browser/web-storage.js';
import { clearDraft, draftSig, loadDraft, saveDraft, type DraftMode } from '../../core/browser/view-drafts.js';
import {
  conditionsOf, deleteSavedFilter, filtersOf, keepAdded, loadAdded, loadSavedFilters, renameSavedFilter, saveFilterAs,
} from '../../core/browser/saved-filters.js';
import type { SavedSet } from '../../core/ui/filters-button.js';
import type { DataSource } from '../../core/data/data-source.js';
import { SAVED_PRESET, presetReadings } from '../../core/data/page-definition.js';
import type { QueryChangeDetail, QueryContext } from '../../core/data/query-context.js';
import { VIEW, emptyScope, sameReading, type Query, type QueryDefaults, type SavedFilter, type ScopeQuery, type ViewScope } from '../../core/data/query.js';
import { layShared, sharedOf, type SharedView } from '../../core/data/query-edits.js';
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
  /** What its saved Views, filters and drafts are kept under. TODO 321 */
  id: string;
  store: string;
  source: DataSource;
  /** The Context's Query: the one the page's controls and Views write. 366 step 24 */
  query: QueryContext;
  library: (() => ViewLibrary) | null;
  initial: Query;
  /** The page's own saved filters, as its definition ships them. Will, 366 */
  savedFilters: Readonly<Record<string, SavedFilter>>;
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
  /** May a set be saved and taken at any scope? Off, one local scope's. TODO 485 */
  saveAnyScope(): boolean;
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

  /** Take a page `open()` set up. */
  begin(page: OpenedPage): void {
    this.#opened = page;
    this.#barsDrawn = false;
    this.#drawn = new WeakSet();
    this.#sentSets = '';
    // The sets on a bar before a reload, while they are still saved: BEFORE the Query, which holds their rows.
    this.#added = new Map(Object.entries(loadAdded(page.id)).filter(([id]) => this.#library()[id]));
    this.#layPresets(this.#added.values());
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
        this.#saySaved();
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
    /* REQUESTS, as Reset to default is: a saved set's row ticked adds its chip to
       the bar that asked, and unticked takes it off. TRAP T-saved-filters-are-every-scope */
    for (const type of ['filters-apply', 'filters-dismiss']) {
      el.addEventListener(type, (event) => {
        const id = (event as CustomEvent<{ id?: string }>).detail?.id;
        if (event.defaultPrevented || !id) return;
        if (type === 'filters-dismiss') return void this.dismissFilters(id);
        const path = event.composedPath();
        const from = [...this.#host.bars(), ...this.#host.panels()].find((c) => path.includes(c));
        this.applyFilters(id, from ? this.#localOf(from) : null);
      }, { signal });
    }
    // Which control asked to save, before the host names the set: off, it is that scope's. TODO 485
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
    const kept = opened.query.applied;
    const id = labelId(name);
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

  /** Save the filters under a NAME, beside the page's Views — a set of that name is
   *  saved over, so a host asks first. It is a preset of the reader's: its chip goes on
   *  the bar that saved it, off, as that bar's own filters still say the same. Will, TODO 605.
   *  TRAP T-saved-filters-are-every-scope */
  saveFilters(label: string, scope?: string): string | undefined {
    const opened = this.#opened;
    // Off, ONE local scope's: the one named, or the bar's that asked. TODO 485
    const local = this.#host.saveAnyScope() ? null : scope ?? this.#savingAt;
    if (local === undefined || (!this.#host.saveAnyScope() && (!local || local === VIEW))) return undefined;
    // A new name never takes one of the page's names.
    const name = label.trim() && opened && uniqueViewLabel(label, Object.values(opened.savedFilters).map((set) => set.label));
    if (!opened || !name) return undefined;
    this.#flush?.();
    const id = labelId(name);
    // Saved over: what it held was the old set's.
    this.dismissFilters(id);
    const all = filtersOf(viewQueryOf(opened.source));
    saveFilterAs(opened.id, name, local ? { v: 1, scopes: { [local]: all.scopes[local] ?? emptyScope() } } : all);
    this.#add(id, this.#homeOf(id, local ?? this.#savingAt ?? null));
    return id;
  }

  /** ADD a saved set to a bar: a preset of the reader's, on, as the app's own are.
   *  `from`, the local scope of the bar that asked. Will, TODO 605.
   *  TRAP T-saved-filters-are-every-scope */
  applyFilters(id: string, from: string | null = null): boolean {
    const opened = this.#opened;
    if (!opened || !this.#library()[id]) return false;
    this.#flush?.();
    const scope = this.#added.get(id) ?? this.#homeOf(id, from);
    this.#add(id, scope);
    opened.query.ask({ scope, preset: SAVED_PRESET + id, on: true, commit: true });
    return true;
  }

  /** TAKE a saved set off its bar: its chip goes, and what it held. Will, TODO 605 */
  dismissFilters(id: string): boolean {
    const opened = this.#opened;
    const scope = this.#added.get(id);
    if (!opened || scope === undefined) return false;
    this.#flush?.();
    opened.query.ask({ scope, preset: SAVED_PRESET + id, on: false, commit: true });
    this.#added.delete(id);
    this.#layPresets([scope]);
    this.#keepAdded();
    return true;
  }

  /** DELETE a reader's saved set, never a page's own: its chip goes, and what it held. */
  deleteFilters(id: string): boolean {
    const opened = this.#opened;
    if (!opened || !loadSavedFilters(opened.id)[id]) return false;
    this.dismissFilters(id);
    deleteSavedFilter(opened.id, id);
    this.#saySaved();
    return true;
  }

  /** RENAME a reader's saved set — never a page's own. Its id follows its name,
   *  and a name another set has gains a copy's. Its chip stays, on or off. Its new id. Will, TODO 427 */
  renameFilters(id: string, label: string): string | undefined {
    const opened = this.#opened;
    const set = opened ? loadSavedFilters(opened.id)[id] : undefined;
    if (!opened || !set || !label.trim()) return undefined;
    if (label.trim() === set.label) return id;
    const name = uniqueViewLabel(label, Object.entries(this.#library()).filter(([key]) => key !== id).map(([, s]) => s.label));
    const scope = this.#added.get(id);
    const on = scope !== undefined && opened.query.presetOn(scope, SAVED_PRESET + id);
    this.dismissFilters(id);
    renameSavedFilter(opened.id, id, name);
    const next = labelId(name);
    if (scope !== undefined) this.#add(next, scope);
    if (on) opened.query.ask({ scope, preset: SAVED_PRESET + next, on: true, commit: true });
    this.#saySaved();
    return next;
  }

  /** The page's saved sets — its own, then the reader's (`own`) — and those on a bar (`added`). */
  get savedFilterSets(): { id: string; label: string; added: boolean; own: boolean }[] {
    return Object.entries(this.#library())
      .map(([id, { label, own }]) => ({ id, label, added: this.#added.has(id), own }));
  }

  /** The page's own sets, then the reader's: one of theirs under a page id is theirs. */
  #library(): Record<string, SavedFilter & { own: boolean }> {
    const opened = this.#opened;
    if (!opened) return {};
    const own = loadSavedFilters(opened.id);
    return {
      ...Object.fromEntries(Object.entries(opened.savedFilters).map(([id, set]) => [id, { ...set, own: false }])),
      ...Object.fromEntries(Object.entries(own).map(([id, set]) => [id, { ...set, own: true }])),
    };
  }

  /** The saved sets on a bar in this tab, each with the scope its chip is on. Will, TODO 605 */
  #added = new Map<string, string>();

  /** Where a set's chip goes: the one scope it asks anything of, else the bar that asked, else the View. */
  #homeOf(id: string, from: string | null): string {
    const opened = this.#opened;
    const named = Object.entries(this.#library()[id]?.query.scopes ?? {})
      .filter(([, scope]) => Object.keys((scope as ViewScope).where ?? {}).length).map(([scope]) => scope);
    return named.length === 1 && opened && named[0]! in opened.query.applied.scopes ? named[0]! : from ?? VIEW;
  }

  /** A set goes on a bar: a preset of its scope, off. */
  #add(id: string, scope: string): void {
    this.#added.set(id, scope);
    this.#layPresets([scope]);
    this.#keepAdded();
  }

  /** Every set comes off its bar, with what it held: the filters are another View's now. */
  #clearAdded(): void {
    const opened = this.#opened;
    if (!opened || !this.#added.size) return;
    const added = [...this.#added];
    for (const [id, scope] of added) opened.query.ask({ scope, preset: SAVED_PRESET + id, on: false, commit: true });
    this.#added.clear();
    this.#layPresets(added.map(([, scope]) => scope));
    this.#keepAdded();
  }

  /** Remembered in this tab, and every saving control told. */
  #keepAdded(): void {
    if (this.#opened) keepAdded(this.#opened.id, Object.fromEntries(this.#added));
    this.#saySaved();
  }

  /** Each of these scopes' presets: the app's own, then the sets on its bar. Will, TODO 605 */
  #layPresets(scopes: Iterable<string>): void {
    const opened = this.#opened;
    if (!opened) return;
    const library = this.#library();
    for (const scope of new Set(scopes)) {
      const app = opened.query.presets(scope).filter((preset) => !preset.id.startsWith(SAVED_PRESET));
      const mine = [...this.#added].filter(([, at]) => at === scope).flatMap(([id]) => {
        const set = library[id];
        return set ? [{ id: SAVED_PRESET + id, label: set.label, readings: presetReadings(opened.source, conditionsOf(set)) }] : [];
      });
      opened.source.declarePresets(scope, [...app, ...mine]);
    }
  }

  /** What the saving controls were last told, so a frame with no change tells nothing. */
  #sentSets = '';

  /** Each saving control is told the page's sets, and the one taken. TODO 105 */
  #saySaved(): void {
    if (!this.#opened) return;
    const sets = this.#sets();
    const sent = JSON.stringify(sets);
    if (sent === this.#sentSets) return;
    this.#sentSets = sent;
    this.#tellSets([...this.#host.bars(), ...this.#host.panels()], sets);
  }

  /** The page's sets, as a saving control is told them. */
  #sets(): SavedSet[] {
    return this.savedFilterSets
      .map(({ id, label, added, own }) => ({ id, label, ...(added ? { added } : {}), ...(own ? { own } : {}) }));
  }

  /** These controls are told the sets — off, each local bar its own scope's
   *  alone, and the View's bar and the panel none. TODO 485 */
  #tellSets(els: readonly Element[], sets: SavedSet[]): void {
    const any = this.#host.saveAnyScope();
    for (const el of els as Array<Element & { savedSets: SavedSet[] }>) {
      const local = any ? null : this.#localOf(el);
      el.savedSets = any ? sets : local ? sets.filter((set) => this.#namesOnly(set.id, local)) : [];
    }
  }

  /** The app changed where filters are saved: every control told again. */
  savesChanged(): void {
    this.#sentSets = '';
    this.#saySaved();
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

  /** Does a set name this scope and no other? */
  #namesOnly(id: string, scope: string): boolean {
    const named = Object.keys(this.#library()[id]?.query.scopes ?? {});
    return named.length === 1 && named[0] === scope;
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
    await opened.query.setQuery(structuredClone(opened.initial), { by: 'provider' });
    if (view?.query) await opened.query.setQuery(view.query, { holds: 'keep', by: 'provider' });
    // The View's own filters are on: nothing of the reader's is left to keep.
    if (this.#drafts && this.#view) clearDraft(this.#drafts.page, this.#view);
    this.#clearAdded();
    // …and they are the App Context's now, and this page's own. TODO 453
    if (this.#shared) {
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
      const custom = new Set(Object.keys(loadSavedViews(opened.id)));
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
   *  lives. And the page's saved sets. TRAP T-saved-filters-are-every-scope */
  #offer(only?: readonly Bar[]): void {
    const opened = this.#opened;
    if (!opened) return;
    for (const bar of only ?? this.#host.bars()) {
      const scope = this.#host.scopeOf(bar);
      if (!scope) continue;
      bar.available?.(opened.source.addable(scope, bar.heldFields ?? []).map((d) => ({ ...d, removable: true })));
    }
    // A late bar is told the sets the others already have.
    if (only) this.#tellSets(only, this.#sets());
    else this.#saySaved();
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
    const kept = key ? session?.get(key) as { view?: string; query?: Query; draft?: Query } | undefined : undefined;
    const start = this.#view ? library()[this.#view] : undefined;
    this.#drafts = options.drafts ? { ...options.drafts, source, library } : null;
    // A link to a View the reader left a draft on opens on the draft.
    const draft = this.#view ? this.#draftOf(this.#view) : undefined;
    // The App Context's answer goes over each Query put on. TODO 453
    const lay = this.#lay(source);
    if (kept?.query && kept.view === this.#view) {
      await source.query.setQuery(kept.query, { lay });
      if (kept.draft) redraft(source, kept.draft, this.#shared ? VIEW : undefined);
    } else if (draft) await source.query.setQuery(draft, { lay });
    else if (this.#view !== first && start?.query) await source.query.setQuery(start.query, { holds: 'keep', lay });
    else if (this.#shared) await source.query.setQuery(source.query.applied, { lay });
    if (signal.aborted) return;
    this.#share(source);
    this.#hear = () => this.#hearPicks(source, library, signal);
    this.#hear();
    // Opened on a View with cards of its own: they are drawn now, and the page told. TODO 198
    if (typeof start?.content === 'string') this.#host.viewChanged(this.#view);
    if (!this.#drafts && !(key && session)) return;
    let frame = 0;
    const write = (): void => {
      frame = 0;
      this.#share(source, true);
      if (key && session) session.set(key, keptEntry(source, this.#view, this.#kept()));
      this.#keepDraft();
    };
    /* The READER's changes only: a pick or a reset writes the Query too, says
       who by, and kept then, the new View's filters were saved under the old
       View's name. TRAP T-a-view-keeps-a-draft */
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
    this.#settle = () => { if (key && session) session.set(key, keptEntry(source, this.#view, this.#kept())); };
    source.query.addEventListener('query-change', keep, { signal });
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

  /** The draft a reader left on one View, if drafts are kept. */
  #draftOf(id: string): QueryDefaults | undefined {
    const d = this.#drafts;
    return d ? loadDraft(d.page, id, draftSig(d.library()[id]), d.mode()) : undefined;
  }

  /** Keep what is on screen as the draft of the View on screen. */
  #keepDraft(): void {
    const d = this.#drafts;
    if (!d || !this.#view) return;
    // While the App Context shares the View, this page's own is what it keeps. TODO 453
    const own = this.#kept();
    const from = own ? {
      query: { export: () => ({ query: withView(d.source.query.export().query, own) }) },
      whereOf: (r: Parameters<DataSource['whereOf']>[0]) => d.source.whereOf(r),
    } : d.source;
    saveDraft(d.page, this.#view, viewQueryOf(from), draftSig(d.library()[this.#view]), d.mode());
  }

  /** The App Context's store: one View answer for every page, while the app
   *  shares it. TODO 453 · TRAP T-the-app-context-is-one-answer */
  #shared: SharedStore | null = null;
  /** This page's own View under the App answer: what it keeps, and what comes
   *  back when sharing stops. */
  #ownView: ScopeQuery | null = null;

  /** sharing — the store before the page restores: set by its provider as it opens one. */
  set sharing(store: SharedStore | null) {
    this.#shared = store;
    this.#ownView = null;
  }

  /** share(store) — the app starts sharing the View's answer, or (null) stops: the
   *  page on screen takes the App answer, or gets its own back. Will, TODO 453 (D2 A) */
  async share(store: SharedStore | null): Promise<void> {
    const was = this.#shared;
    const own = this.#ownView;
    this.#shared = store;
    const source = this.#opened?.source;
    if (!source || !!store === !!was) return;
    if (store) await source.query.setQuery(source.query.applied, { lay: this.#lay(source), by: 'provider' });
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
      const store = this.#shared;
      if (!store) return;
      this.#ownView = structuredClone(query.scopes[VIEW] ?? emptyScope());
      const shared = store.get();
      if (shared) layShared(query, shared, (f) => source.has(f));
    };
  }

  /** Write the View's answer as the App's — on a reader's act, or where there is
   *  none yet — and draw what it holds that this page has not. */
  #share(source: DataSource, write = false): void {
    const store = this.#shared;
    if (!store) {
      if (source.declareUnused(VIEW, [])) void this.drawBars(this.#view);
      return;
    }
    const was = store.get();
    const face = (f: string): { label: string; icon?: string } => {
      const def = source.filterDef(f);
      return { label: def.label, ...(def.icon ? { icon: def.icon } : {}) };
    };
    if (write || !was) store.set(sharedOf(source.query.applied, was, (f) => source.has(f), face));
    const now = store.get();
    const unused = (now?.holds ?? []).filter((f) => !source.has(f)).map((f) => ({ id: f, ...now!.faces[f]! }));
    if (source.declareUnused(VIEW, unused)) void this.drawBars(this.#view);
  }

  /** The View this page keeps while sharing: its own. */
  #kept(): ScopeQuery | undefined {
    return this.#shared && this.#ownView ? this.#ownView : undefined;
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
      // The old View's draft is written before its answers go. TRAP T-a-view-keeps-a-draft
      before: () => this.#flush?.(),
      draft: (id) => this.#draftOf(id),
      after: ({ id, rendered }) => {
        // Another View: its filters are its own, and its bars hold none of these.
        if (id !== this.#view) this.#clearAdded();
        this.#view = id;
        this.#settle?.();
        this.#host.viewChanged(id, rendered?.elements);
      },
    });
  }

  /** A state taken in names a View: show it on the chip, and hear its next pick. */
  takeView(id: string): void {
    if (id === this.#view) return;
    const was = this.#view;
    this.#clearAdded();
    this.#view = id;
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

/** Where the App Context's answer is kept. TODO 453 */
export interface SharedStore {
  get(): SharedView | null;
  set(value: SharedView): void;
}

/** What a page keeps across a reload: the View, the Query applied, and —
 *  while a pick waits for Apply — the draft; while the App Context shares the
 *  View, its own View in both. Will, TODOs 410, 453 */
/** A column's scopes, from its `data-scope` list. */
function scopesOf(panel: Element): string[] {
  return (panel.getAttribute('data-scope') ?? '').split(/\s+/).filter(Boolean);
}

function keptEntry(source: DataSource, view: string | undefined, own?: ScopeQuery): { view?: string; query: Query; draft?: Query } {
  const mine = (q: Query): Query => (own ? withView(q, own) : q);
  return { ...(view ? { view } : {}), query: mine(source.query.applied), ...(source.query.dirty() ? { draft: mine(source.query.draft) } : {}) };
}

/** A Query with another View scope. */
function withView(query: Query, view: ScopeQuery): Query {
  return { ...query, scopes: { ...query.scopes, [VIEW]: structuredClone(view) } };
}

/** A pick that waited for Apply comes back waiting, in each scope that waits —
 *  but `skip`, the App Context's. TODO 410 */
function redraft(source: DataSource, draft: Query, skip?: string): void {
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
