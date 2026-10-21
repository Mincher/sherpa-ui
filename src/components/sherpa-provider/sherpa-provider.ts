/**
 * sherpa-provider — the data layer, over a SUBTREE of the page: a component
 * inside it ASKS, and this ANSWERS.
 *
 * A thin DOM door onto the DOM-free data layer. It holds the sources it is
 * given and joins each component that asks to the one its subtree provides —
 * by `bindSource()`, delivering through the callback the component asked with. A
 * request that arrives before any source waits, and `provide()` answers it.
 * docs/PROVIDER-DESIGN.md. TRAP T-a-component-asks-its-provider
 *
 * Map:
 * - ProvideOptions — What a provider is given: its sources by name, and its Views.
 * - OpenOptions — What `open()` is given beside a page's definition: the app's stores, and the page's Views.
 * - ProviderState — A subtree's whole state as JSON: each source's question, and the View on screen.
 */
import { SUMMARY_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import {
  DATA_CONTEXT, SOURCE_CONTEXT, type ContextRequestEvent, type DataAsk,
} from '../../core/ui/context.js';
import { report } from '../../core/data/report.js';
import { summariseBanded, type SummarySpec } from '../../core/data/aggregate.js';
import { bindSelection } from '../../core/data/bind-selection.js';
import { valueKey, type Store } from '../../core/data/store.js';
import { viewLibrary, type ViewLibrary } from '../../core/browser/persist-view.js';
import type { DraftMode } from '../../core/browser/view-drafts.js';
import { openSource, savedFiltersOf, type PageDefinition } from '../../core/data/page-definition.js';
import { QueryContext } from '../../core/data/query-context.js';
import type { Failure } from '../../core/data/failure.js';
import type { DataChangeDetail, DataSource, QueryState } from '../../core/data/data-source.js';
import type { Where } from '../../core/data/where.js';
import { applyState, type Populatable } from '../../core/ui/apply-state.js';
import { bindSource } from '../../core/ui/bind-source.js';
import { ProviderMode } from './provider-mode.js';
import { ProviderPage, type Bar } from './provider-page.js';

/** What a provider is given: its sources, by name — and, for a page with
 *  Views, the Views over them, the one on screen, and where its Query is kept. */
export interface ProvideOptions {
  sources: Record<string, DataSource>;
  /** The Views, as JSON — or a function, for a library a reader adds to. */
  views?: ViewLibrary | (() => ViewLibrary);
  /** The View on screen at the start (the URL's). The FIRST View is the page as it loads. */
  view?: string;
  /** Where the Query outlives a reload — for this View only — under `key`. */
  session?: { get(key: string): unknown; set(key: string, value: unknown): void };
  key?: string;
  /** A DRAFT per View, kept by this page's id: what a reader left on a View
   *  comes back when they return to it. `mode` is asked at each write, so a
   *  setting applies at once. None: no drafts. TRAP T-a-view-keeps-a-draft */
  drafts?: { page: string; mode: () => DraftMode };
}

/** What `open()` is given beside a page's definition: the app's stores, by the
 *  name a definition gives — and the Views the page ships, the one on screen,
 *  and where its Query is kept. */
export interface OpenOptions {
  stores: Record<string, Store>;
  /** The page's own Views; a reader's saved ones join them by the page's id. */
  views?: ViewLibrary;
  view?: string;
  session?: ProvideOptions['session'];
  /** Keep a draft per View, for the tab: on or off, asked at each write. None:
   *  no drafts. TRAP T-a-view-keeps-a-draft */
  drafts?: () => DraftMode;
}

/** A subtree's whole state, as JSON — each source's question and the View on
 *  screen — to send out and take back in. v2: `queries`, by source name.
 *  366 step 24 · TRAP T-a-page-goes-out-as-json */
export interface ProviderState {
  v: 2;
  view?: string;
  queries: Record<string, QueryState>;
}

/** The attribute a summary needs before it asks; without it a page populates it.
 *  TRAP T-a-component-declares-its-summary */
const DECLARED_BY: Partial<Record<DataAsk['shape'], string>> = {
  aggregate: 'data-aggregate', segments: 'data-segment-field', series: 'data-over-field',
  scope: 'data-scope',
};

/** The shapes a summary is answered in. */
const SUMMARIES = new Set<DataAsk['shape']>(['aggregate', 'segments', 'series']);

/** Each summary attribute, and the key it fills in a `SummarySpec`. */
const SPEC_KEYS = [
  ['aggregate', 'data-aggregate'], ['field', 'data-field'], ['segment', 'data-segment-field'],
  ['over', 'data-over-field'], ['bucket', 'data-bucket'], ['bands', 'data-bands'],
] as const;

/** A component that picks values, through its `picked` door. */
type Picker = Element & { picked: string[] };

/** The element above this one, across a shadow root. */
const up = (el: Element): Element | null =>
  el.parentElement ?? ((el.getRootNode() as ShadowRoot).host ?? null);

/** A load quicker than this shows no spinner, so nothing flashes. */
const SLOW_LOAD = 300;

/** The card a component sits in, across shadow roots, or null. */
const containerOf = (el: Element): HTMLElement | null => {
  for (let at = up(el); at; at = up(at)) if (at.localName === 'sherpa-container') return at as HTMLElement;
  return null;
};

/** What a reader calls a component: its own `aria-label`, or the heading of
 *  the card it sits in. TRAP T-a-scope-is-named-for-its-content */
const nameOf = (el: Element): string =>
  el.getAttribute('aria-label')
  ?? containerOf(el)?.querySelector(':scope > [slot="header"]')?.getAttribute('data-heading')
  ?? '';

/** One component that asked, and how to stop answering it. */
interface Asked {
  request: ContextRequestEvent<unknown>;
  unbind?: () => void;
}

export class SherpaProvider extends SherpaElement {
  static override css = new URL('./sherpa-provider.css', import.meta.url);
  static override html = new URL('./sherpa-provider.html', import.meta.url);
  // How every card it draws a state on shows it. Will, TODO 59.
  static override props = {
    'data-keep-content': { type: 'boolean', kind: 'style' },
  } as const;

  /** The sources this subtree provides, by name. */
  #sources: Record<string, DataSource> = {};
  /** Every component that asked, by the element that asked. */
  #asked = new Map<Element, Asked>();

  constructor() {
    super();
    // From the START: a child can ask before this has rendered.
    this.addEventListener('context-request', this.#onRequest);
    // The panel's own close, and the shell's room for it.
    this.addEventListener('filter-panel-close', this.#modes.closed);
    // A bar's or the panel's ⋮ switch: this provider owns the setting. TODO 178.
    this.addEventListener('limit-options-change', (event) => {
      this.limitOptions = !!(event as CustomEvent<{ on?: boolean }>).detail?.on;
    });
    // …and its Hide unmatching filters. Will, TODO 205.
    this.addEventListener('hide-unmatched-change', (event) => {
      this.hideUnmatched = !!(event as CustomEvent<{ on?: boolean }>).detail?.on;
    });
    this.addEventListener('panel-room-change', this.#modes.room);
    /* A container's Retry, and a bar's Refresh: load again. Its Clear filters:
       every bar resets. TRAP T-a-container-shows-its-datas-state */
    this.addEventListener('data-refresh', (event) => {
      // A card reloads the sources of what it holds, as its state is theirs;
      // an unclear ask loads nothing — #resolve says so.
      const from = event.target as Element;
      const held = [...this.#asked.keys()].filter((el) => containerOf(el) === from).map((el) => this.#resolve(el));
      for (const source of new Set(held.length ? held : [this.#resolve(from)])) void source?.load({ force: true });
    });
  }

  /**
   * TOOLBARS or PANEL, for every page in this subtree — the filter panel open
   * and each filter bar stepped back, or the bars. The app sets it (from its
   * session); a reader's change is reported as `filter-mode-change`.
   * TRAP T-the-provider-owns-the-panel-mode
   */
  get filterMode(): 'toolbars' | 'panel' {
    return this.#modes.mode;
  }
  set filterMode(mode: 'toolbars' | 'panel') {
    this.#modes.want(mode);
  }

  /** The panel or the bars, and the buttons that switch them. */
  readonly #modes = new ProviderMode({
    bars: () => this.#bars(),
    panels: () => this.#panels(),
    found: () => [...this.querySelectorAll(':defined')]
      .filter((el) => 'drawScopes' in el && el.closest(this.localName) === this) as never,
    button: (kind) => this.clone(`template.mode-${kind}-tpl`) as HTMLElement | null,
    rendered: () => this.rendered,
    changed: (mode) => {
      this.emit('filter-mode-change', { mode });
    },
  });

  /** Each list filter offers only what the others leave — on every source it
   *  gives. The app sets it, from its session. TRAP T-a-ruled-out-value-is-greyed */
  get limitOptions(): boolean {
    return this.#limit;
  }
  set limitOptions(on: boolean) {
    this.#limit = on;
    for (const source of Object.values(this.#sources)) source.limitOptions = on;
    // Every bar and panel offers the switch in its ⋮, showing where it stands. TODO 178.
    for (const el of this.#limited()) this.#offerLimit(el);
  }

  /** While Limit is on, a value it rules out is HIDDEN, not greyed — on every
   *  bar and panel. The app sets it, from its session. TODO 205 */
  get hideUnmatched(): boolean {
    return this.#hide;
  }
  set hideUnmatched(on: boolean) {
    this.#hide = on;
    for (const el of this.#limited()) this.#offerLimit(el);
  }
  /** The app's choice: hide what Limit rules out. */
  #hide = false;

  /** Every control with a filter menu: a bar, a panel, a grid's headings. TODO 305 */
  #limited(): Element[] {
    return [...this.#asked.keys()].filter((el) => 'drawScope' in el || 'drawPresent' in el);
  }

  /** One control, told the Limit settings its filter menus follow. */
  #offerLimit(el: Element): void {
    el.setAttribute('data-limit-options', this.#limit ? 'on' : 'off');
    el.setAttribute('data-hide-unmatched', this.#hide ? 'on' : 'off');
  }
  /** The app's choice, for every source. */
  #limit = false;

  /** Every panel that asked — a control drawn over several scopes. */
  #panels(): Array<HTMLElement & { show?: () => void; hide?: (reason?: string) => void }> {
    return [...this.#asked.keys()].filter((el) => 'drawScopes' in el) as never;
  }

  /** Every filter bar that asked — a control drawn one scope at a time. */
  #bars(): Element[] {
    return [...this.#asked.keys()].filter((el) => 'drawScope' in el && !('drawScopes' in el));
  }

  /**
   * Give this subtree its sources — and its Views. Every component already
   * asking is answered again: a Context that swaps its source swaps it for
   * everything in it. Settles once the kept Query, or the start View, is on.
   * TRAP T-a-provider-keeps-the-views
   */
  provide(options: ProvideOptions): Promise<void> {
    return this.#provide(options, true);
  }

  /** `provide()`; `shut`: a page with no data shuts the panel. */
  #provide(options: ProvideOptions, shut: boolean): Promise<void> {
    // The page `open()` set up has gone, with its source.
    if (this.#pages.opened && !Object.values(options.sources).includes(this.#pages.opened.source)) {
      this.#page?.abort();
      this.#page = null;
      this.#pages.end();
    }
    this.#sources = { ...options.sources };
    for (const source of Object.values(this.#sources)) source.limitOptions = this.#limit;
    for (const made of this.#made) if (!this.#provides(made)) this.#closeMade(made);
    // BEFORE answering: an answer binds, and a bind starts the first load.
    this.#states?.abort();
    this.#states = new AbortController();
    this.#watchStates(this.#states.signal);
    // Leaving for the next page keeps the page's reach: the banner does not flicker between two.
    if (shut || Object.keys(this.#sources).length) this.#syncReach();
    for (const asked of this.#asked.values()) this.#answer(asked);
    this.#pages.stopViews();
    /* A page with NO data has no filters: the panel shuts — not the reader's
       choice, so it opens again on the next page that has some. TRAP T-navigating-sets-up-the-page */
    if (shut && !Object.keys(this.#sources).length) {
      for (const panel of this.#panels()) panel.hide?.('page');
    }
    // The Views are over the ONE source; a subtree of several names none.
    const [source, ...more] = Object.values(this.#sources);
    if (!options.views || !source || more.length) return Promise.resolve();
    return this.#pages.views(source, options);
  }

  /**
   * Set up a page from its DEFINITION: its source over the app's store, every
   * filter bar drawn from its scope — the View chip, the fields it holds, what
   * it may add — and all of it provided. The source, or undefined for a page
   * with no data. TRAP T-a-page-is-its-definition
   */
  async open(definition: PageDefinition, options: OpenOptions): Promise<DataSource | undefined> {
    this.#page?.abort();
    const page = (this.#page = new AbortController());
    const def = definition.source;
    const store = def ? options.stores[def.store] : undefined;
    if (def && !store) {
      report({
        code: 'provider-unknown-store',
        message: `sherpa-provider: page "${definition.id}" names a store the app has not given, "${def.store}".`,
        at: { store: def.store },
      });
    }
    const opening = def && store ? this.#opening(page.signal) : null;
    let opened: DataSource | undefined;
    let made: DataSource | undefined;
    try {
      // The Context's ONE Query: its source joins it. 366 step 24
      const source = (made = def && store ? await openSource(def, store, { query: new QueryContext() }) : undefined);
      if (source) this.#made.add(source);
      opening?.stop();
      if (page.signal.aborted) return undefined;
      if (!source || !def) {
        await this.provide({ sources: {} });
        return undefined;
      }
      const shipped = options.views;
      const library = shipped ? (): ViewLibrary => viewLibrary(definition.id, shipped) : null;
      // The page as DEFINED, before a kept Query: what Reset all to default starts from.
      this.#pages.begin({
        id: definition.id, store: def.store, source, query: source.query, library, initial: source.query.applied,
        savedFilters: savedFiltersOf(definition),
      });
      // A View this page does not have is the first.
      const view = options.view && library?.()[options.view] ? options.view : undefined;
      // BEFORE the Query: a kept one is drawn onto these chips.
      await Promise.all([this.#pages.drawBars(view), this.#configure(definition.ui ?? {})]);
      if (page.signal.aborted) return undefined;
      this.#pages.listen(page.signal);
      await this.provide({
        sources: { [definition.id]: source },
        ...(library ? {
          views: library, ...(view ? { view } : {}),
          ...(options.session ? { session: options.session } : {}), key: `/filters/${definition.id}`,
          ...(options.drafts ? { drafts: { page: definition.id, mode: options.drafts } } : {}),
        } : {}),
      });
      if (!page.signal.aborted) opened = source;
      return opened;
    } finally {
      opening?.end(opened);
      // Left before it was provided: nothing else will close it.
      if (made && !this.#provides(made)) this.#closeMade(made);
    }
  }

  /** The sources `open()` made. Each is closed when it is no longer provided. TRAP T-a-closed-source-hears-nothing */
  #made = new Set<DataSource>();

  /** Is this source one this subtree is given now? */
  #provides(source: DataSource): boolean {
    return Object.values(this.#sources).includes(source);
  }

  /** Close a source `open()` made, and forget it. */
  #closeMade(source: DataSource): void {
    source.close();
    this.#made.delete(source);
  }

  /**
   * A page is about to be drawn from this definition, or from none: take its
   * filter mode NOW — the panel open or shut — so its content is never drawn
   * twice. `open()` follows. TRAP T-the-filter-mode-is-set-before-the-page-paints
   */
  prepare(definition: PageDefinition | null): void {
    this.#modes.page(!!definition?.source);
    // A page with no data has nothing to reach.
    if (!definition?.source) this.#setReach({ reach: 'ok' });
  }

  /**
   * Can the page's data be reached? The worst of its sources': `ok`;
   * `unreached` — the last rows are shown, unconfirmed; `down` — nothing to
   * show. With why, while it is not ok. `reach-change` says when it moves.
   * TRAP T-the-provider-says-the-pages-reach
   */
  get reach(): { reach: 'ok' | 'unreached' | 'down'; failure?: Failure } {
    return { ...this.#reach };
  }

  /** Try every source that cannot reach its store again — a page's Retry. */
  recheck(): void {
    for (const source of Object.values(this.#sources)) if (source.reach !== 'ok') source.recheck();
  }

  /** The page's reach, as last said. */
  #reach: { reach: 'ok' | 'unreached' | 'down'; failure?: Failure } = { reach: 'ok' };

  /** Read each source's reach — from state, never from the last event — and say a change. */
  #syncReach(): void {
    const rank = { ok: 0, unreached: 1, down: 2 } as const;
    let worst: { reach: 'ok' | 'unreached' | 'down'; failure?: Failure } = { reach: 'ok' };
    const sources = Object.values(this.#sources);
    // A source that has not answered yet says nothing: the page's reach stands until one does.
    const known = sources.filter((source) => source.loaded || source.reach !== 'ok');
    if (sources.length && !known.length) return;
    for (const source of known) {
      const reach = source.reach;
      if (rank[reach] <= rank[worst.reach]) continue;
      const failure = source.failure;
      worst = { reach, ...(failure ? { failure } : {}) };
    }
    this.#setReach(worst);
  }

  /** Keep the page's reach, and say it when it moved. */
  #setReach(next: { reach: 'ok' | 'unreached' | 'down'; failure?: Failure }): void {
    if (next.reach === this.#reach.reach && next.failure?.kind === this.#reach.failure?.kind) return;
    this.#reach = next;
    this.emit('reach-change', { ...next });
  }

  /** The network back, or the tab shown again: a store that could not be reached is tried again. */
  #onBack = (): void => {
    if (document.visibilityState === 'visible' && this.#reach.reach !== 'ok') this.recheck();
  };

  /** Leave the page, or one still opening: its source goes, and nothing in the
   *  subtree reaches it. `next`: another page follows at once, and says
   *  whether the panel stays. TRAP T-the-filter-mode-is-set-before-the-page-paints */
  close(options: { next?: boolean } = {}): void {
    this.#page?.abort();
    this.#page = null;
    void this.#provide({ sources: {} }, !options.next);
  }

  /**
   * Save what is on screen as a View of the open page, and put it on the View
   * chip. With a name, a NEW View — a name any View has already gets ` -
   * Copy-001`. With none, over the reader's own View on screen; a preset is
   * never overwritten, so that answers undefined. The saved View's id, else
   * undefined. `stay`: keep it for later, and stay on the View on screen — the
   * save before a Reset all to default.
   * TRAP T-a-view-is-json · TRAP T-a-saved-view-is-the-readers-own
   */
  saveView(label?: string, options: { stay?: boolean } = {}): Promise<string | undefined> {
    return this.#pages.saveView(label, options);
  }

  /** Delete the reader's own View — the one on screen unless named — and go to
   *  the first. A preset is never deleted. TRAP T-a-saved-view-is-the-readers-own */
  deleteView(id?: string): Promise<boolean> {
    return this.#pages.deleteView(id);
  }

  /**
   * SAVE FILTERS — every scope's filters under a name, kept with the page beside
   * its Views. A set of the same name is saved over, so a host asks first; a
   * page's own name gets a copy's. With none, over the reader's set last taken
   * ("Save <name>"); none answers undefined. The set's id. Will, TODO 105, 366.
   * TRAP T-saved-filters-are-every-scope
   */
  saveFilters(label?: string): string | undefined {
    return this.#pages.saveFilters(label);
  }

  /** TAKE a saved set: every scope matches it; one it does not name has no
   *  filters. TRAP T-saved-filters-are-every-scope */
  applyFilters(id: string): Promise<boolean> {
    return this.#pages.applyFilters(id);
  }

  /** TAKE a saved set OFF: the scopes it names lose their filters. */
  dismissFilters(id: string): Promise<boolean> {
    return this.#pages.dismissFilters(id);
  }

  /** DELETE a reader's saved set — the one last taken unless named; never a
   *  page's own. Its filters stay on screen. */
  deleteFilters(id?: string): boolean {
    return this.#pages.deleteFilters(id);
  }

  /** The page's saved sets — its own, then the reader's (`own`) — and the ONE
   *  taken: what a host asks before it saves over a name, or deletes one. */
  get savedFilterSets(): { id: string; label: string; applied: boolean; own: boolean }[] {
    return this.#pages.savedFilterSets;
  }

  /** Is the View on screen the reader's own — saved, so it can be saved over or deleted? */
  get customView(): boolean {
    return this.#pages.customView;
  }

  /**
   * Put the filters back as the View on screen DEFINES them: the page's first
   * Query, then the View's, as a pick puts it on. A filter the reader added
   * since goes. What "Reset all to default" does. TRAP T-reset-to-default-is-the-views-own
   */
  resetView(): Promise<void> {
    return this.#pages.resetView();
  }

  /** The open page: its Views, saved sets, drafts, kept Query and Reset. */
  readonly #pages = new ProviderPage({
    el: this,
    bars: () => this.#bars() as Bar[],
    panels: () => this.#panels(),
    scopeOf: (el) => this.#inherited(el, 'data-scope'),
    viewChanged: (id, elements) => {
      this.emit('view-change', { id, ...(elements ? { elements } : {}) });
    },
    // Asked only for a View bar, which means this provider is connected and drawing.
    word: async (key) => {
      await this.rendered;
      return this.word(key);
    },
  });

  /** Stops the open page's listeners. */
  #page: AbortController | null = null;

  /** Configure each component by id, through its own API, once it is defined.
   *  TRAP T-configuration-is-not-data */
  async #configure(ui: NonNullable<PageDefinition['ui']>): Promise<void> {
    await Promise.all(Object.entries(ui).map(async ([id, state]) => {
      const el = this.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (!el) {
        report({ code: 'provider-unknown-element', message: `sherpa-provider: no #${id} to configure.`, at: { id } });
        return;
      }
      const apply = (): void => {
        // A key its API does not have is said, and a value it refused: a typo did nothing, silently.
        const refused: string[] = [];
        const missing = applyState(el, { ...state }, refused).filter((key) => !refused.includes(key));
        if (missing.length) {
          report({ code: 'provider-unknown-setting', message: `sherpa-provider: #${id} has no ${missing.join(', ')}.`, at: { id, keys: missing.join(',') } });
        }
        if (refused.length) {
          report({ code: 'provider-refused-setting', message: `sherpa-provider: #${id} refused ${refused.join(', ')}.`, at: { id, keys: refused.join(',') } });
        }
      };
      const tag = el.localName;
      // A plain element is configured now; whenDefined() rejects for it.
      if (!tag.includes('-') || customElements.get(tag)) return apply();
      /* A tag no one defined would hold open() for ever: it is said, and
         configured if it is defined later. */
      report({ code: 'provider-undefined-element', message: `sherpa-provider: #${id} is a <${tag}>, which is not defined yet — is it imported? It is configured once it is.`, at: { id, tag } });
      void customElements.whenDefined(tag).then(apply);
    }));
  }

  /** The View on screen. */
  get view(): string | undefined {
    return this.#pages.view;
  }

  override onConnect(): void {
    window.addEventListener('online', this.#onBack);
    document.addEventListener('visibilitychange', this.#onBack);
  }

  override onDisconnect(): void {
    window.removeEventListener('online', this.#onBack);
    document.removeEventListener('visibilitychange', this.#onBack);
    this.#page?.abort();
    this.#pages.stopViews();
    for (const asked of this.#asked.values()) asked.unbind?.();
    this.#asked.clear();
  }

  /** Stops watching the sources' loading, emptiness and failure. */
  #states: AbortController | null = null;

  /**
   * Each source's loading, emptiness and failure, drawn on the card of every
   * component it answers — so no page writes `data-loading` by hand. Loading
   * and a failure reach every data component's card; empty and NO MATCHES a
   * ROWS one's only, as a chart under the View alone still has its rows.
   * Will, TODO 58. TRAP T-a-container-shows-its-datas-state
   */
  #watchStates(signal: AbortSignal): void {
    for (const source of Object.values(this.#sources)) {
      const cards = (rowsOnly: boolean): HTMLElement[] => this.#cardsOf((el) => this.#resolve(el) === source, rowsOnly);
      let slow: ReturnType<typeof setTimeout> | undefined;
      source.addEventListener('loading', (event) => {
        clearTimeout(slow);
        const loading = !!(event as CustomEvent).detail?.loading;
        if (loading) slow = setTimeout(() => { for (const c of cards(false)) c.toggleAttribute('data-loading', true); }, SLOW_LOAD);
        else for (const c of cards(false)) c.removeAttribute('data-loading');
      }, { signal });
      source.addEventListener('change', (event) => {
        this.#syncReach();
        const state = (event as CustomEvent<DataChangeDetail>).detail.emptiness ?? null;
        for (const c of cards(false)) if (c.dataset['state'] === 'error') delete c.dataset['state'];
        for (const c of cards(true)) {
          if (state) c.dataset['state'] = state;
          else delete c.dataset['state'];
        }
      }, { signal });
      source.addEventListener('error', (event) => {
        this.#syncReach();
        const { error } = (event as CustomEvent).detail as { error: unknown };
        for (const c of cards(false)) {
          c.dataset['state'] = 'error';
          c.dataset['error'] = error instanceof Error ? error.message : String(error);
        }
      }, { signal });
    }
  }
  /** The cards of the components that asked for data and pass `which` — ROWS ones only, or any. */
  #cardsOf(which: (el: Element) => boolean, rowsOnly = false): HTMLElement[] {
    return [...new Set([...this.#asked.keys()]
      .filter((el) => {
        if (!which(el)) return false;
        const shape = ((el.constructor as { asks?: DataAsk }).asks ?? { shape: 'rows' }).shape;
        return rowsOnly ? shape === 'rows' : shape !== 'scope' && shape !== 'state';
      })
      .map(containerOf).filter((c): c is HTMLElement => !!c))].map((c) => this.#keep(c));
  }

  /**
   * A page OPENING is a load: its source reads the store before anyone can hear
   * it, so every data card says so after SLOW_LOAD. `stop` when the source is
   * open; `end` hands the cards it draws to its own loading and clears the rest.
   * A page left while it opens ends at once, so it never marks the next page.
   * TRAP T-a-container-shows-its-datas-state
   */
  #opening(signal: AbortSignal): { stop(): void; end(source?: DataSource): void } {
    const marked: HTMLElement[] = [];
    const slow = setTimeout(() => {
      for (const c of this.#cardsOf(() => true)) {
        c.toggleAttribute('data-loading', true);
        marked.push(c);
      }
    }, SLOW_LOAD);
    const end = (source?: DataSource): void => {
      clearTimeout(slow);
      signal.removeEventListener('abort', left);
      const handed = new Set(source ? this.#cardsOf((el) => this.#resolve(el) === source) : []);
      for (const c of marked.splice(0)) if (!handed.has(c)) c.removeAttribute('data-loading');
    };
    const left = (): void => end();
    signal.addEventListener('abort', left);
    return { stop: () => clearTimeout(slow), end };
  }

  /** A card shows its state as this provider says: kept content, or an overlay. */
  #keep(card: HTMLElement): HTMLElement {
    card.toggleAttribute('data-keep-content', this.hasAttribute('data-keep-content'));
    return card;
  }

  override onChange(name: string): void {
    if (name !== 'data-keep-content') return;
    for (const el of this.#asked.keys()) {
      const card = containerOf(el);
      if (card) this.#keep(card);
    }
  }

  /**
   * This subtree's whole state as JSON — each source's question, and the View
   * on screen — for a link, another service or an agent.
   * TRAP T-a-page-goes-out-as-json
   */
  export(): ProviderState {
    const queries: Record<string, QueryState> = {};
    for (const [name, source] of Object.entries(this.#sources)) queries[name] = source.query.export();
    const view = this.#pages.view;
    return { v: 2, ...(view ? { view } : {}), queries };
  }

  /**
   * Take a state back in, exactly: each named source's question, and its View
   * — shown on the View chip, and known to the pick listener, so the next pick
   * of the old View is heard. A source it does not name is left as it is.
   */
  async import(state: ProviderState): Promise<void> {
    if (state?.v !== 2) {
      report({ code: 'unknown-state', message: 'sherpa-provider: not a v2 state, so nothing was taken in.' });
      return;
    }
    for (const [name, given] of Object.entries(state.queries ?? {})) {
      const source = this.#sources[name];
      if (source) await source.query.import(given);
      else report({ code: 'provider-unknown-source', message: `sherpa-provider: no source "${name}" to take in.`, at: { source: name } });
    }
    if (state.view) this.#pages.takeView(state.view);
  }

  /** A request from inside: the NEAREST provider answers, so it stops here. */
  #onRequest = (event: Event): void => {
    const request = event as ContextRequestEvent<unknown>;
    if (request.context !== DATA_CONTEXT && request.context !== SOURCE_CONTEXT) return;
    event.stopPropagation();
    if (request.context === SOURCE_CONTEXT) {
      const source = this.#resolve(request.contextTarget);
      if (source) request.callback(source);
      return;
    }
    this.#asked.get(request.contextTarget)?.unbind?.();
    const asked: Asked = { request };
    this.#asked.set(request.contextTarget, asked);
    // A bar or a panel takes the mode as it asks, before it paints — not when
    // its data comes. TRAP T-the-filter-mode-is-set-before-the-page-paints
    const el = request.contextTarget;
    if ((el.constructor as { asks?: DataAsk }).asks?.shape === 'scope') this.#modes.join(el);
    this.#answer(asked);
  };

  /** Join one asking component to its source, in the shape it declared. */
  #answer(asked: Asked): void {
    asked.unbind?.();
    delete asked.unbind;
    const { contextTarget: el, callback } = asked.request;
    // Gone from the page while it waited: forget it, never bind it.
    if (!el.isConnected) {
      this.#asked.delete(el);
      return;
    }
    const source = this.#resolve(el);
    // No source yet: it waits, and `provide()` answers it.
    if (!source) return;
    // Bound by hand already — the page's own bind stands, and is not doubled.
    if (source.boundElements.includes(el as Populatable)) return;
    const asks = (el.constructor as { asks?: DataAsk }).asks ?? { shape: 'rows' };
    // Nothing declared: it is the page's to populate.
    const needs = DECLARED_BY[asks.shape];
    if (needs && !this.#inherited(el, needs)) return;
    const spec = SUMMARIES.has(asks.shape) ? this.#spec(el, asks) : undefined;
    if (SUMMARIES.has(asks.shape) && !spec) return;
    const leave = (): void => {
      asked.unbind?.();
      this.#asked.delete(el);
    };
    // One scope, or several — the panel's `data-scope="view data"`.
    const scopes = (this.#inherited(el, 'data-scope') ?? '').split(/\s+/).filter(Boolean);
    const scope = scopes.length > 1 ? scopes : scopes[0];
    const unbind = bindSource(source, el as Populatable, {
      rows: spec || asks.shape === 'all' ? 'all' : 'page',
      // A pager and a filter bar steer; the rows are not theirs to draw.
      steerOnly: asks.shape === 'state' || asks.shape === 'scope',
      ...(asks.own ? { ignore: asks.own } : {}),
      ...(scope ? { scope } : {}),
      ...(asks.shows ? { shows: asks.shows } : {}),
      /* A summary SHOWS the data and never steers it. TRAP T-aggregation-is-data */
      ...(spec ? { readonly: true, as: (rows, src) => summariseBanded(rows, spec, (f) => src.valuesFor(f), (f) => src.fieldFacts(f)) } : {}),
      // A page of rows arrives WITH its groups: a group is the data layer's.
      // TRAP T-a-group-is-a-data-layer-concept
      ...(asks.shape === 'rows'
        ? { as: (rows, src) => ({
          rows,
          groups: src.state.group && src.loaded ? src.groups() : null,
          /* Each FILTER as the source defines it, as a chip's is — the whole
             column too, which one page cannot say. TRAP T-a-heading-opens-the-chips-menu */
          ...(asks.filters ? { filters: Object.fromEntries(asks.filters(el)
            .map((f) => [f, src.filterDef(f)])) } : {}),
        }) }
        : {}),
      deliver: (payload) => callback(payload, leave),
    });
    const unpick = spec && asks.picks ? this.#picks(el as Picker, source, spec, asks.picks) : undefined;
    const unown = this.#own(el, source);
    asked.unbind = () => {
      unown?.();
      unpick?.();
      unbind();
    };
    // No rows ever come, so it is handed its way out now.
    if (asks.shape === 'state' || asks.shape === 'scope') callback(undefined, leave);
    // …and again when answered: the next page with data opens the panel again.
    if (asks.shape === 'scope') this.#modes.join(el);
    if ('drawScope' in el || 'drawPresent' in el) this.#offerLimit(el);
  }

  /**
   * A component's OWN default filter — `data-where`, a condition by field as
   * JSON — narrowing it alone, and outliving a View pick.
   * TRAP T-a-component-default-outlives-a-view · TRAP T-one-way-to-write-a-condition
   */
  #own(el: Element, source: DataSource): (() => void) | undefined {
    const raw = el.getAttribute('data-where');
    if (!raw) return undefined;
    let where: Where;
    try {
      where = JSON.parse(raw) as Where;
    } catch {
      report({
        code: 'provider-bad-where',
        message: 'sherpa-provider: data-where is not a condition by field as JSON, so this component filters nothing of its own.',
        at: { tag: el.localName, where: raw },
      });
      return undefined;
    }
    const scope = `own:${el.id || this.#ownId(el)}`;
    source.query.declareDefault(scope, source.readingsOf(where), { only: el as Populatable });
    return () => source.query.declareDefault(scope, undefined);
  }

  /** A name for a component with no id, kept while it lives. */
  #ownId(el: Element): string {
    let id = this.#ownIds.get(el);
    if (!id) this.#ownIds.set(el, (id = `${el.localName}-${++this.#owned}`));
    return id;
  }

  /** Each unnamed component's name. */
  #ownIds = new WeakMap<Element, string>();
  /** How many unnamed components have declared a filter of their own. */
  #owned = 0;

  /** An attribute from the asking element, or the nearest one above it — a
   *  legend reads its chart's, a nested pager its grid's. Stops here. */
  #inherited(el: Element, name: string): string | null {
    for (let n: Element | null = el; n && n !== this; n = up(n)) {
      const value = n.getAttribute(name);
      if (value !== null) return value;
    }
    return null;
  }

  /** The summary a component declared, as JSON — or none, and it waits. */
  #spec(el: Element, asks: DataAsk): SummarySpec | undefined {
    const spec: Record<string, unknown> = { shape: asks.shape };
    for (const [key, attr] of SPEC_KEYS) {
      const value = this.#inherited(el, attr);
      if (value) spec[key] = value;
    }
    const kinds: readonly string[] = SUMMARY_PROPS['data-aggregate'].values;
    if (spec['aggregate'] && !kinds.includes(spec['aggregate'] as string)) {
      report({
        code: 'provider-unknown-aggregate',
        message: 'sherpa-provider: data-aggregate names no aggregate, so nothing is summarised.',
        at: { tag: el.localName, aggregate: String(spec['aggregate']), offers: kinds.join(',') },
      });
      return undefined;
    }
    // "0,20,40" — a histogram's edges, as numbers.
    if (typeof spec['bands'] === 'string') spec['bands'] = spec['bands'].split(',').map(Number);
    if (asks.keepEmpty) spec['keepEmpty'] = true;
    // Its field's bands come with its value. TRAP T-a-threshold-is-a-fact-of-the-field
    if (asks.thresholds) spec['zones'] = true;
    return spec as unknown as SummarySpec;
  }

  /**
   * A component that PICKS values of its segment field — a legend. Its pick
   * narrows its host (its chart) and nothing else: component reach.
   * TRAP T-a-legend-toggle-is-a-filter
   * TRAP T-a-component-part-narrows-one-component
   */
  #picks(el: Picker, source: DataSource, spec: SummarySpec, picks: NonNullable<DataAsk['picks']>): (() => void) | undefined {
    const field = spec.segment ?? '';
    const values = source.valuesFor(field).map(valueKey);
    if (!values.length) {
      report({
        code: 'provider-picks-undeclared',
        message: "sherpa-provider: a component that picks needs its field's values declared, so this one only shows.",
        at: { tag: el.localName, field },
      });
      return undefined;
    }
    const only = picks.narrows === 'host' ? up(el) : el;
    // One part per component, or the second would replace the first.
    const key = `picks:${el.id || field}`;
    const unbind = bindSelection(el, source, {
      field,
      values,
      read: (c) => c.picked,
      draw: (c, picked) => { c.picked = [...picked]; },
      event: picks.event,
      reach: 'component',
      ...(only ? { only } : {}),
      key,
    }).destroy;
    // No host to narrow: bindSelection said so, and bound nothing.
    if (!only) return unbind;
    /* The chart's OWN scope, so a filter panel draws it — named as the chart
       is. TRAP T-a-chart-scope-is-its-legend-field */
    const label = nameOf(only);
    source.query.declarePart(key, { field, only: only as Populatable, ...(label ? { label } : {}) });
    // What the filters before it leave, so the legend greys the rest. TRAP T-a-ruled-out-value-is-greyed
    const hear = (event: Event): void => {
      const left = (event as CustomEvent<{ byScope: Record<string, Record<string, string[]>> }>).detail.byScope[key];
      (el as Picker & { present?: readonly string[] | null }).present = left?.[field] ?? null;
    };
    source.addEventListener('present', hear);
    return () => {
      source.removeEventListener('present', hear);
      source.query.declarePart(key, undefined);
      unbind();
    };
  }

  /**
   * The source a component's subtree provides. Named only when the subtree
   * offers two; an unnamed ask of two, or a name not offered, is LOUD — never
   * a guess. FILTER-REVIEW §12, decided 2026-09-25.
   */
  #resolve(el: Element): DataSource | null {
    const names = Object.keys(this.#sources);
    const named = this.#inherited(el, 'data-source');
    if (named) {
      const source = this.#sources[named];
      if (!source && names.length) {
        report({
          code: 'provider-unknown-source',
          message: 'sherpa-provider: this subtree provides no source by that name.',
          at: { tag: el.localName, name: named, offers: names.join(',') },
        });
      }
      return source ?? null;
    }
    if (names.length > 1) {
      report({
        code: 'provider-ambiguous',
        message: 'sherpa-provider: this subtree provides several sources, so a component must name one.',
        at: { tag: el.localName, offers: names.join(',') },
      });
      return null;
    }
    return names.length ? this.#sources[names[0]!]! : null;
  }
}

define('sherpa-provider', SherpaProvider);
