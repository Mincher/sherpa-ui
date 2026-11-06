/**
 * sherpa-provider — the data layer, over a SUBTREE of the page: a component
 * inside it ASKS, and this ANSWERS.
 *
 * It holds the sources it is given and joins each component that asks to the
 * one its subtree provides — by `bindSource()`, delivering through the callback
 * the component asked with — and opens and closes pages. A request that arrives
 * before any source waits, and `provide()` answers it; one naming a source a
 * provider above gives travels up. What it draws beside — reach, notices, cards,
 * the highlight, legend picks, Show as — is each a module beside it.
 * docs/PROVIDER-DESIGN.md. TRAP T-a-component-asks-its-provider
 *
 * Map:
 * - ProvideOptions — What a provider is given: its sources by name, and its Views.
 * - OpenOptions — What `open()` is given beside a page's definition: the app's stores, and the page's Views.
 */
import { SUMMARY_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import {
  ContextRequestEvent, DATA_CONTEXT, SETTINGS_CONTEXT, SOURCE_CONTEXT, type ContextCallback, type DataAsk,
} from '../../core/ui/context.js';
import { Settings, type SettingKey, type SettingValue } from '../../core/data/settings.js';
import { report } from '../../core/data/report.js';
import { chartAxes, segmented, summariseMarked, type SummarySpec } from '../../core/data/aggregate.js';
import type { Row, Store } from '../../core/data/store.js';
import type { ViewLibrary } from '../../core/browser/persist-view.js';
import { PageKeeper, type PageState } from '../../core/browser/page-state.js';
import { Updates } from '../../core/data/updates.js';
import { checkPage, openSource, savedFiltersOf, type PageDefinition, type SourceDefinition } from '../../core/data/page-definition.js';
import { QueryContext } from '../../core/data/query-context.js';
import { VIEW } from '../../core/data/query.js';
import { PRESET_FILTER } from '../../core/data/entity-types.js';
import type { PagePreset } from '../../core/data/preset-filter.js';
import type { Failure } from '../../core/data/failure.js';
import type { DataSource } from '../../core/data/data-source.js';
import type { Where } from '../../core/data/where.js';
import { applyState, type Populatable } from '../../core/ui/apply-state.js';
import { bindId, bindSource } from '../../core/ui/bind-source.js';
import { ProviderMode, isColumn } from './provider-mode.js';
import { ProviderPage, redraft, type Bar } from './provider-page.js';
import { ProviderReach } from './provider-reach.js';
import { ProviderNews } from './provider-news.js';
import { ProviderCards } from './provider-cards.js';
import { declared, up } from './provider-declared.js';
import { RootLook } from './provider-look.js';
import { ProviderHighlight } from './provider-highlight.js';
import { ProviderLegends, type Picker } from './provider-legends.js';
import { ProviderShowAs } from './provider-show-as.js';
import { presentsOf } from '../../core/ui/show-as.js';

/** What a provider is given: its sources, by name — and, for a page with
 *  Views, the Views over them, the one on screen, and its name in the keeper. */
export interface ProvideOptions {
  sources: Record<string, DataSource>;
  /** The Views, as JSON — or a function, for a library a reader adds to. */
  views?: ViewLibrary | (() => ViewLibrary);
  /** The View on screen at the start (the URL's). The FIRST View is the page as it loads. */
  view?: string;
  /** The page's name in the keeper: its Query outlives a reload, on its View only.
   *  None: nothing is kept. TRAP T-one-page-one-document */
  key?: string;
  /** False: no View chip picks its Views — the page is opened for its Query alone. */
  bars?: boolean;
}

/** What `open()` is given beside a page's definition: the app's stores, by the
 *  name a definition gives — and the Views the page ships, and the one on screen. */
export interface OpenOptions {
  stores: Record<string, Store>;
  /** The page's name in the keeper: an outlet gives its Context's. Default: the
   *  definition's id. TODO 321 */
  key?: string;
  /** The page's own Views; a reader's saved ones join them by its key. */
  views?: ViewLibrary;
  view?: string;
  /** False: the page's data alone, for a view of its Query that is not the page — a Node Editor's.
   *  No filter bar or panel is drawn or answered, no View chip picks, no element is configured.
   *  TRAP T-a-graph-is-a-view-of-a-type */
  bars?: boolean;
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

/** One component that asked, and how to stop answering it. */
interface Asked {
  request: ContextRequestEvent<unknown>;
  unbind?: () => void;
}

/** What a component asks for that declares nothing: its rows, a page at a time. */
const ROWS: DataAsk = { shape: 'rows' };

/** A component that takes the `highlight`: it draws a hover's matches. */
type Highlights = Element & { drawHighlight(test: ((row: Row) => boolean) | null): void };

export class SherpaProvider extends SherpaElement {
  static override css = new URL('./sherpa-provider.css', import.meta.url);
  static override html = new URL('./sherpa-provider.html', import.meta.url);
  // How every card it draws a state on shows it. Will, TODO 59.
  static override props = {
    'data-keep-content': { type: 'boolean', kind: 'style' },
  } as const;

  /** What is new for this page — heard, and shown by every element under it that
   *  listens for its kind. Plan 687 U1 · TRAP T-a-notice-is-heard-never-ordered */
  readonly updates = new Updates();
  /** …and the elements that show it. */
  readonly #news = new ProviderNews(this, this.updates);

  /** The sources this subtree provides, by name. */
  #sources: Record<string, DataSource> = {};
  /** Every component that asked, by the element that asked. */
  #asked = new Map<Element, Asked>();

  /** Can the page's data be reached: the worst of its sources'. */
  readonly #reach = new ProviderReach({
    sources: () => Object.values(this.#sources),
    changed: (reach) => {
      this.emit('reach-change', reach);
    },
  });

  /** The card each component sits in: its data's state, its Retry, its toolbar's toggle. */
  readonly #cards = new ProviderCards({
    el: this,
    asked: () => this.#asked.keys(),
    resolve: (el) => this.#resolve(el),
    inherited: (el, name) => this.#inherited(el, name),
    bars: (slot) => this.#slotBars(slot),
    toolbar: (slot) => {
      const page = this.#pages.opened?.id;
      return page ? this.#keeper.read(page).toolbars?.[slot] : undefined;
    },
    keepToolbar: (slot, shown) => {
      const page = this.#pages.opened?.id;
      if (page) this.#keeper.write(page, { toolbars: { ...this.#keeper.read(page).toolbars, [slot]: shown } });
    },
  });

  /** What the pointer rests on, and what draws its matches. */
  readonly #highlight = new ProviderHighlight(() => this.#on('highlightAcross'));

  /** Each legend that picks its chart's values. */
  readonly #legends = new ProviderLegends({
    inherited: (el, name) => this.#inherited(el, name),
    bars: (slot) => this.#slotBars(slot),
    drawToolbars: (slot) => this.#cards.drawToolbars(slot),
    hover: (scope, field, on, value) => this.hover(scope, field, on, value),
    chips: () => this.#on('legendChips'),
    highlightHover: () => this.#on('highlightOnHover'),
  });

  /** Show as: each slot's chart, or grid, as its presentation says. */
  readonly #show = new ProviderShowAs({
    el: this,
    inherited: (el, name) => this.#inherited(el, name),
    resolve: (el) => this.#resolve(el),
    clone: (selector) => this.clone<Element>(selector),
    word: (key) => this.word(key),
    forget: (el) => {
      this.#asked.delete(el);
    },
    drawToolbars: (slot) => this.#cards.drawToolbars(slot),
    showAs: () => this.#on('showAs'),
    pageFields: () => this.#pageFields,
    spec: (el, asks, source, slot) => this.#spec(el, asks, source, slot),
    declares: (shape) => DECLARED_BY[shape],
  });

  constructor() {
    super();
    // From the START: a child can ask before this has rendered.
    this.addEventListener('context-request', this.#onRequest);
    // The panel's own close, and the shell's room for it.
    this.addEventListener('filter-panel-close', this.#modes.closed);
    this.#hearSettings();
    // A bar's or the panel's ⋮ switch, and its Hide invalid filters: this provider owns them. TODOs 178, 205, 376
    for (const [type, key] of [['limit-options-change', 'limitOptions'], ['hide-unmatched-change', 'hideUnmatched']] as const) {
      this.addEventListener(type, (event) => this.#setByReader(key, !!(event as CustomEvent<{ on?: boolean }>).detail?.on));
    }
    this.addEventListener('panel-room-change', this.#modes.room);
    // A card's Show as: its slot's presentation, kept in the Query. Will, TODO 548
    this.addEventListener('presentation-change', this.#show.picked);
    // A card's filter toolbar, shown or shut. Will, TODO 629
    this.addEventListener('filter-toolbar-change', this.#cards.toggled);
    this.addEventListener('callout-dismiss', this.#news.dismissed);
    /* A container's Retry, and a bar's Refresh: load again. Its Clear filters:
       every bar resets. TRAP T-a-container-shows-its-datas-state */
    this.addEventListener('data-refresh', (event) => {
      const from = event.target as Element;
      this.#cards.retry(from);
      this.#news.refreshed(from);
    });
  }

  /**
   * The app's SETTINGS, one schema kept where the app keeps them: told to every
   * component that asks, a data one put on each source, a look one on the page's
   * root. A reader's change made here is reported as `setting-change`.
   * TRAP T-a-setting-is-declared-once
   */
  get settings(): Settings {
    return this.#settings;
  }
  set settings(settings: Settings) {
    const was = this.#settings;
    if (settings === was) return;
    this.#settings = settings;
    this.#hearSettings();
    this.#follow(Object.keys(settings.schema).filter((key) => settings.get(key) !== was.get(key)));
  }
  /** The settings it holds: its own, until the app gives its. */
  #settings = new Settings();
  /** Stops hearing the settings given before. */
  #settingsHeard: AbortController | null = null;
  /** Every component told the settings, and how to tell it again. */
  #told = new Map<Element, ContextCallback<Settings>>();
  /** What the settings put on the page's root. */
  readonly #look = new RootLook();

  /** Hear each change of the settings this holds. */
  #hearSettings(): void {
    this.#settingsHeard?.abort();
    this.#settingsHeard = new AbortController();
    this.#settings.addEventListener('change', (event) => {
      this.#follow([(event as CustomEvent<{ key: string }>).detail.key]);
    }, { signal: this.#settingsHeard.signal });
  }

  /** A setting is on. */
  #on(key: SettingKey): boolean {
    return this.#settings.get(key) === true;
  }

  /** A reader changed a setting here: it is set, and said. */
  #setByReader(key: SettingKey, value: SettingValue): void {
    this.#settings.set(key, value);
    this.emit('setting-change', { key, value });
  }

  /** These settings moved: each source takes its data ones, every component is
   *  told, and what follows each here follows it. */
  #follow(keys: readonly string[]): void {
    const settings = this.#settings;
    for (const source of Object.values(this.#sources)) this.#toSource(source, keys);
    for (const [el, tell] of this.#told) tell(settings, () => this.#told.delete(el));
    for (const key of keys) {
      switch (key) {
        // TRAP T-the-provider-owns-the-panel-mode
        case 'filterMode': {
          const mode = settings.get(key) as 'toolbars' | 'panel';
          if (mode !== this.#modes.mode) this.#modes.want(mode);
          break;
        }
        case 'saveAnyScope': this.#pages.savesChanged(); break;
        case 'highlightOnHover': this.#legends.hoverable(this.#on(key)); break;
        case 'legendChips': this.#legends.lay(); break;
        case 'highlightAcross': this.#highlight.light(); break;
        case 'showAs': this.#show.menus(); break;
        case 'appContext': this.#shareAppContext(); break;
        case 'applyEvery': {
          // Off sends what waits; the View always waits.
          const query = this.#pages.opened?.query;
          for (const scope of this.#scopes) if (scope !== VIEW) query?.wait(scope, this.#on(key));
          break;
        }
      }
    }
    if (this.#isTop()) this.#look.draw(document.documentElement, settings, keys);
  }

  /** A source takes each DATA setting: its own property by that name. TRAP T-a-ruled-out-value-is-greyed */
  #toSource(source: DataSource, keys: readonly string[]): void {
    const props = source as unknown as Record<string, SettingValue>;
    for (const key of keys) if (this.#settings.schema[key]?.source && key in source) props[key] = this.#settings.get(key);
  }

  /** No provider is above this one: its settings are the page's. */
  #isTop(): boolean {
    for (let at = up(this); at; at = up(at)) if (at instanceof SherpaProvider) return false;
    return true;
  }

  /** The panel or the bars, and the buttons that switch them. A column in
   *  `[data-filter-mode="none"]` is the page's content, not the panel area:
   *  the mode never opens or shuts it. TODO 425 */
  readonly #modes = new ProviderMode({
    bars: () => this.#bars(),
    panels: () => this.#panels().filter((el) => !el.closest('[data-filter-mode="none"]')),
    found: () => (this.#headless ? [] : [...this.querySelectorAll(':defined')])
      .filter((el) => isColumn(el) && el.closest(this.localName) === this && !el.closest('[data-filter-mode="none"]')) as never,
    button: (kind) => this.clone(`template.mode-${kind}-tpl`) as HTMLElement | null,
    rendered: () => this.rendered,
    changed: (mode) => {
      this.#setByReader('filterMode', mode);
    },
    stepped: (bar) => {
      const slot = this.#inherited(bar, 'data-scope');
      if (slot) this.#cards.drawToolbars(slot);
    },
  });

  /** What the pointer rests on while it lights its matches — a chip, one value of
   *  it, or a legend row — or null. The page's, never the Query's: nothing loads,
   *  nothing is saved. Will, TODOs 449, 655 */
  get hovered(): { scope: string; field: string; value?: string } | null {
    return this.#highlight.hovered;
  }

  /** Light what a field of a scope matches — or one value of it — as a rest on its
   *  chip or legend row does; `on: false` stops. Will, TODO 655 */
  hover(scope: string, field: string, on = true, value?: string): void {
    this.#highlight.hover(scope, field, on, value);
  }

  /** The open page's own name for its View scope. */
  #viewLabel = '';

  /** The View Context is the APP Context, or each page's own again: the name
   *  first, on every bar; then the answer, which the bars hear as any change.
   *  TRAP T-the-app-context-is-one-answer */
  #shareAppContext(): void {
    const source = this.#pages.opened?.source;
    if (!source) return;
    this.#relabel(source);
    void this.#pages.drawBars(this.#pages.view).then(() => this.#pages.share(this.#on('appContext')));
  }

  /**
   * Where every page's state is kept: ONE keeper, its tiers the app's — the
   * View on screen, its Query, what the reader left on each View, and the
   * reader's own Views and saved filters. Set it before a page opens.
   * TRAP T-one-page-one-document
   */
  get keeper(): PageKeeper {
    return this.#keeper;
  }
  set keeper(keeper: PageKeeper) {
    this.#keeper = keeper;
  }
  /** The keeper it holds: its own, until the app gives its. */
  #keeper = new PageKeeper();

  /** The View scope's name: "App Context" while it is shared, else its own. */
  #relabel(source: DataSource): void {
    source.query.declareScope(VIEW, { label: this.#on('appContext') ? this.word('app-context') : this.#viewLabel });
  }

  /** The scopes the open page declares: each waits for its bar's Apply while
   *  `applyEvery` is on. TRAP T-apply-and-discard-wait-for-a-change */
  #scopes: string[] = [];

  /** Every panel that asked — a control drawn over several scopes. None, for a page opened for its Query alone. */
  #panels(): Array<HTMLElement & { show(): void; hide(reason?: string): void }> {
    return this.#headless ? [] : [...this.#asked.keys()].filter(isColumn) as never;
  }

  /** Every filter bar that asked — a control drawn one scope at a time. None, for a page opened for its Query alone. */
  #bars(): Element[] {
    return this.#headless ? [] : [...this.#asked.keys()].filter((el) => declared(el).asks?.shape === 'scope' && !isColumn(el));
  }

  /** The open page was opened for its Query alone (`bars: false`): its bars and panels are another's. */
  #headless = false;

  /** The filter bars in a slot, in this subtree's own tree — not a panel's sections. */
  #slotBars(slot: string): Element[] {
    return [...this.#asked.keys()]
      .filter((el) => this.contains(el) && declared(el).asks?.shape === 'scope' && this.#inherited(el, 'data-scope') === slot);
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
    // A rest on the page that went goes with it.
    this.#highlight.forget();
    for (const source of Object.values(this.#sources)) this.#toSource(source, Object.keys(this.#settings.schema));
    for (const made of this.#made) if (!this.#provides(made)) this.#closeMade(made);
    // BEFORE answering: an answer binds, and a bind starts the first load.
    this.#states?.abort();
    this.#states = new AbortController();
    this.#reach.watch(Object.values(this.#sources), this.#states.signal);
    this.#cards.watch(Object.values(this.#sources), this.#states.signal);
    // Leaving for the next page keeps the page's reach: the banner does not flicker between two.
    if (shut || Object.keys(this.#sources).length) this.#reach.sync();
    for (const asked of [...this.#asked.values()]) this.#answer(asked);
    // An ask a provider below holds for one of these goes up to this one.
    for (const below of this.querySelectorAll(this.localName)) if (below instanceof SherpaProvider) below.#rehome();
    this.#pages.stopViews();
    /* A page with NO data has no filters: the panel shuts — not the reader's
       choice, so it opens again on the next page that has some. TRAP T-navigating-sets-up-the-page */
    if (shut && !Object.keys(this.#sources).length) {
      for (const panel of this.#panels()) panel.hide('page');
    }
    // The Views are over ONE Query: a subtree whose sources share none names none. 366 step 25
    const [source, ...more] = Object.values(this.#sources);
    // A page's listening elements show what still waits.
    this.#news.draw();
    if (!options.views || !source || more.some((other) => other.query !== source.query)) return Promise.resolve();
    return this.#pages.views(source, options);
  }

  /**
   * Set up a page from its DEFINITION: its source over the app's store, every
   * filter bar drawn from its scope — the View chip, the fields it holds, what
   * it may add — and all of it provided. The source, or undefined for a page
   * with no data. TRAP T-a-page-is-its-definition
   */
  async open(definition: PageDefinition, options: OpenOptions): Promise<DataSource | undefined> {
    checkPage(definition);
    this.#page?.abort();
    this.#headless = options.bars === false;
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
    const opening = def && store ? this.#cards.opening(page.signal) : null;
    let opened: DataSource | undefined;
    let made: DataSource | undefined;
    try {
      // The Context's ONE Query: its source joins it. TRAP T-a-context-holds-the-only-query
      const source = (made = def && store ? await openSource(def, store, { query: new QueryContext() }) : undefined);
      if (source) this.#made.add(source);
      // A VIEW pick waits for its bar's ONE Apply: nothing fetches until asked. Will, TODO 406
      source?.query.wait(VIEW);
      // …and, where the app asks, every scope the page declares. Will, TODO 436
      this.#scopes = Object.keys(def?.scopes ?? {});
      this.#pageFields = Object.keys(def?.fields ?? {});
      if (this.#on('applyEvery')) for (const scope of this.#scopes) source?.query.wait(scope);
      // Shared, the View is the App Context, and keeps its answer there. TODO 453
      if (source) {
        this.#viewLabel = source.query.scopeLabel(VIEW);
        this.#relabel(source);
      }
      opening?.stop();
      if (page.signal.aborted) return undefined;
      if (!source || !def) {
        await this.provide({ sources: {} });
        return undefined;
      }
      const shipped = options.views;
      const key = options.key ?? definition.id;
      // The page's own Views, then the reader's. TRAP T-view-library-is-one-vocabulary
      const library = shipped ? (): ViewLibrary => ({ ...shipped, ...this.#keeper.read(key).views }) : null;
      // Its store's Preset Filters, each a preset of its bar: read now, and again when the shelf moves. TODO 776
      const presetFilters = (): Promise<readonly PagePreset[]> => this.#presetFilters(def.store, def.fields);
      const filters = await presetFilters();
      if (page.signal.aborted) return undefined;
      // The page as DEFINED, before a kept Query: what Reset to view defaults starts from.
      this.#pages.begin({
        id: key, store: def.store, source, query: source.query, library, initial: source.query.applied,
        savedFilters: savedFiltersOf(definition), presetFilters: filters, readPresetFilters: presetFilters,
      });
      this.#pages.sharing = this.#on('appContext');
      // A View this page does not have is the first.
      const view = options.view && library?.()[options.view] ? options.view : undefined;
      // BEFORE the Query: a kept one is drawn onto these chips.
      await Promise.all([this.#pages.drawBars(view), this.#headless ? null : this.#configure(definition.ui ?? {})]);
      if (page.signal.aborted) return undefined;
      this.#pages.listen(page.signal);
      await this.provide({
        sources: { [definition.id]: source },
        ...(library ? { views: library, ...(view ? { view } : {}), key } : {}),
        ...(this.#headless ? { bars: false } : {}),
      });
      if (!page.signal.aborted) opened = source;
      return opened;
    } finally {
      opening?.end(opened);
      // Left before it was provided: nothing else will close it.
      if (made && !this.#provides(made)) this.#closeMade(made);
    }
  }

  /** The Preset Filters over a store, from the keeper's shelf, as its page's presets: the app's, then the reader's.
   *  The reader is loaded only where the shelf has one; each that says no condition is reported and left out.
   *  Plan 776 D4, D11 · TRAP T-a-preset-filter-is-a-preset-of-its-store */
  async #presetFilters(store: string, fields: SourceDefinition['fields']): Promise<readonly PagePreset[]> {
    const shelf = this.#keeper.entities;
    if (!shelf.list(PRESET_FILTER).length) return [];
    const { presetsOver } = await import('../../core/data/preset-filter.js');
    const entities = shelf.list().flatMap(({ id }) => shelf.get(id) ?? []);
    const { presets, faults } = presetsOver(store, entities, fields ? { fieldsOf: { [store]: fields } } : {});
    for (const fault of faults) report({ code: 'preset-filter', message: `sherpa-provider: ${fault}, so it is no preset of this page.`, at: { store } });
    return presets;
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
    if (!definition?.source) this.#reach.set({ reach: 'ok' });
  }

  /**
   * Can the page's data be reached? The worst of its sources': `ok`;
   * `unreached` — the last rows are shown, unconfirmed; `down` — nothing to
   * show. With why, while it is not ok. `reach-change` says when it moves.
   * TRAP T-the-provider-says-the-pages-reach
   */
  get reach(): { reach: 'ok' | 'unreached' | 'down'; failure?: Failure } {
    return this.#reach.now;
  }

  /** Try every source that cannot reach its store again, and ask one that may
   *  miss a writer what moved — a page's Retry, its tab shown. TRAP T-a-remote-store-says-what-changed */
  recheck(): void {
    this.#reach.recheck();
  }

  /** Leave the page, or one still opening: its source goes, and nothing in the
   *  subtree reaches it. `next`: another page follows at once, and says
   *  whether the panel stays. TRAP T-the-filter-mode-is-set-before-the-page-paints */
  close(options: { next?: boolean } = {}): void {
    this.#page?.abort();
    this.#page = null;
    this.#headless = false;
    void this.#provide({ sources: {} }, !options.next);
  }

  /**
   * Save what is on screen as a View of the open page, and put it on the View
   * chip. With a name, a NEW View — a name any View has already gets ` -
   * Copy-001`. With none, over the reader's own View on screen; a preset is
   * never overwritten, so that answers undefined. The saved View's id, else
   * undefined. `stay`: keep it for later, and stay on the View on screen — the
   * save before a Reset to view defaults.
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
   * Without `saveAnyScope`, ONE local scope's — `scope`, or the bar that asked
   * to save — and nothing from the View's bar or the panel. TODO 485
   * TRAP T-saved-filters-are-every-scope
   */
  saveFilters(label: string, scope?: string): string | undefined {
    return this.#pages.saveFilters(label, scope);
  }

  /** ADD a saved set to a bar: a preset of the reader's, on. `from`, the local scope
   *  of the bar it goes on where the set names several. Will, TODO 605 · TRAP T-saved-filters-are-every-scope */
  applyFilters(id: string, from?: string): boolean {
    return this.#pages.applyFilters(id, from ?? null);
  }

  /** TAKE a saved set off its bar: its chip goes, and what it held. */
  dismissFilters(id: string): boolean {
    return this.#pages.dismissFilters(id);
  }

  /** DELETE a reader's saved set, never a page's own: its chip goes, and what it held. */
  deleteFilters(id: string): boolean {
    return this.#pages.deleteFilters(id);
  }

  /** RENAME a reader's saved set — never a page's own. Its id follows its name,
   *  and a name another set has gains a copy's. Its new id. Will, TODO 427 */
  renameFilters(id: string, label: string): string | undefined {
    return this.#pages.renameFilters(id, label);
  }

  /** The page's saved sets — its own, then the reader's (`own`) — and those on a bar
   *  (`added`): what a host asks before it saves over a name. */
  get savedFilterSets(): { id: string; label: string; added: boolean; own: boolean }[] {
    return this.#pages.savedFilterSets;
  }

  /** Is the View on screen the reader's own — saved, so it can be saved over or deleted? */
  get customView(): boolean {
    return this.#pages.customView;
  }

  /**
   * Put the filters back as the View on screen DEFINES them: the page's first
   * Query, then the View's, as a pick puts it on. A filter the reader added
   * since goes. What "Reset to view defaults" does. TRAP T-reset-to-default-is-the-views-own
   */
  resetView(): Promise<void> {
    return this.#pages.resetView();
  }

  /** The open page: its Views, saved sets, what each View was left with, its kept state and Reset. */
  readonly #pages = new ProviderPage({
    el: this,
    bars: () => this.#bars() as Bar[],
    panels: () => this.#panels(),
    scopeOf: (el) => this.#inherited(el, 'data-scope'),
    saveAnyScope: () => this.#on('saveAnyScope'),
    viewChanged: (id, elements) => {
      this.emit('view-change', { id, ...(elements ? { elements } : {}) });
    },
    // Asked only for a View bar, which means this provider is connected and drawing.
    word: async (key) => {
      await this.rendered;
      return this.word(key);
    },
    keeper: () => this.#keeper,
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
    // The page's root wears the look settings. TRAP T-a-setting-is-declared-once
    if (this.#isTop()) this.#look.draw(document.documentElement, this.#settings);
    // The network back, or the tab shown again: what could not be reached is tried again.
    this.on(window, 'online', this.#reach.back);
    this.on(document, 'visibilitychange', this.#reach.back);
    this.#news.hear();
    this.on(this.updates, 'change', this.#news.draw);
  }

  override onDisconnect(): void {
    this.#news.stop();
    this.#page?.abort();
    this.#pages.stopViews();
    for (const asked of this.#asked.values()) asked.unbind?.();
    this.#asked.clear();
    this.#told.clear();
  }

  /** Stops watching the sources' loading, emptiness and failure. */
  #states: AbortController | null = null;

  override onChange(name: string): void {
    if (name === 'data-keep-content') this.#cards.keepAll();
  }

  /**
   * This subtree's state as the page's ONE document — the View on screen, its
   * Query and what waits for Apply — for a link, another service or an agent.
   * TRAP T-a-page-goes-out-as-json
   */
  export(): PageState {
    const query = this.#oneQuery();
    const view = this.#pages.view;
    return {
      v: 3, ...(view ? { view } : {}),
      ...(query ? { query: query.export().query, ...(query.dirty() ? { draft: structuredClone(query.draft) } : {}) } : {}),
    };
  }

  /**
   * Take a state back in, exactly: its Query, what waited for Apply, and its
   * View — shown on the View chip, and known to the pick listener, so the next
   * pick of the old View is heard.
   */
  async import(state: PageState): Promise<void> {
    if (state?.v !== 3) {
      report({ code: 'unknown-state', message: 'sherpa-provider: not a v3 page state, so nothing was taken in.' });
      return;
    }
    const query = this.#oneQuery();
    if (state.query && !query) {
      report({ code: 'provider-no-query', message: 'sherpa-provider: its sources share no one Query to take the state in.' });
    } else if (state.query && query) {
      await query.setQuery(state.query);
      const [source] = Object.values(this.#sources);
      if (state.draft && source) redraft(source, state.draft);
    }
    if (state.view) this.#pages.takeView(state.view);
  }

  /** The ONE Query every source shares, or null. 366 step 25 */
  #oneQuery(): QueryContext | null {
    const [first, ...more] = Object.values(this.#sources);
    return first && more.every((other) => other.query === first.query) ? first.query : null;
  }

  /** A request from inside: the NEAREST provider answers, so it stops here — but one
   *  for a source this one does not give, and one above does, travels up. PROVIDER-DESIGN §3 */
  #onRequest = (event: Event): void => {
    const request = event as ContextRequestEvent<unknown>;
    const el = request.contextTarget;
    // The settings: the nearest provider's, told again on every change while subscribed.
    if (request.context === SETTINGS_CONTEXT) {
      event.stopPropagation();
      const tell = request.callback as ContextCallback<Settings>;
      if (request.subscribe) this.#told.set(el, tell);
      tell(this.#settings, request.subscribe ? () => this.#told.delete(el) : undefined);
      return;
    }
    if (request.context !== DATA_CONTEXT && request.context !== SOURCE_CONTEXT) return;
    if (this.#passes(el)) return;
    event.stopPropagation();
    if (request.context === SOURCE_CONTEXT) {
      const source = this.#resolve(el);
      if (source) request.callback(source);
      return;
    }
    this.#asked.get(el)?.unbind?.();
    const asked: Asked = { request };
    this.#asked.set(el, asked);
    // A bar or a panel takes the mode as it asks, before it paints — not when
    // its data comes. TRAP T-the-filter-mode-is-set-before-the-page-paints
    if (declared(el).asks?.shape === 'scope') this.#modes.join(el);
    this.#answer(asked);
  };

  /** Does a provider above this one give a source of this name now? */
  #givenAbove(name: string): boolean {
    for (let at = up(this); at; at = up(at)) {
      if (at instanceof SherpaProvider && Object.hasOwn(at.#sources, name)) return true;
    }
    return false;
  }

  /** Is it for a source this one does not give, and one above does? */
  #passes(el: Element): boolean {
    const named = this.#inherited(el, 'data-source');
    return !!named && !Object.hasOwn(this.#sources, named) && this.#givenAbove(named);
  }

  /** The asks held here for a source a provider above gives now go up to it. */
  #rehome(): void {
    for (const asked of [...this.#asked.values()]) if (this.#passes(asked.request.contextTarget)) this.#handUp(asked);
  }

  /** Hand an ask held here up, to the provider above that gives its source now. */
  #handUp(asked: Asked): void {
    const { context, contextTarget, callback, subscribe } = asked.request;
    this.#asked.delete(contextTarget);
    this.dispatchEvent(new ContextRequestEvent(context, contextTarget, callback, subscribe));
  }

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
    // A page opened for its Query alone answers no bar or panel: they wait for the next page.
    if (this.#headless && declared(el).asks?.shape === 'scope') return;
    // Its source is given above now: it goes there.
    if (this.#passes(el)) {
      this.#handUp(asked);
      return;
    }
    const source = this.#resolve(el);
    // No source yet: it waits, and `provide()` answers it.
    if (!source) return;
    // Bound by hand already — the page's own bind stands, and is not doubled.
    if (source.boundElements.includes(el as Populatable)) return;
    const { asks = ROWS, takes } = declared(el);
    // Nothing declared: it is the page's to populate.
    const needs = DECLARED_BY[asks.shape];
    if (needs && !this.#inherited(el, needs)) {
      /* …but a legend in a chart over a ZONED number — a gauge's — picks the status
         field its zones come from, as any legend picks its values; the chart draws
         its rows. Plan 683 · TRAP T-a-status-is-worked-out-by-the-data */
      const field = asks.picks && !el.hasAttribute('data-readonly') ? this.#inherited(el, 'data-field') : null;
      const picked = field ? source.zonesOf(field)?.from ?? null : null;
      if (picked) {
        const unpick = this.#legends.picks(el as Picker, source, picked, asks.picks!);
        if (unpick) asked.unbind = unpick;
      }
      return;
    }
    const spec = SUMMARIES.has(asks.shape) ? this.#spec(el, asks, source) : undefined;
    if (SUMMARIES.has(asks.shape) && !spec) return;
    const leave = (): void => {
      asked.unbind?.();
      this.#asked.delete(el);
    };
    // One scope, or several — the panel's `data-scope="view data"`; a column's
    // are a LIST, even of one (`data-column`). TRAP T-panel-mode-hides-what-the-panel-answers
    const scopes = (this.#inherited(el, 'data-scope') ?? '').split(/\s+/).filter(Boolean);
    const scope = scopes.length > 1 || isColumn(el) ? scopes : scopes[0];
    // Its slot shows another way: swapped for that one, which asks again. Will, TODO 548
    const slot = typeof scope === 'string' ? scope : undefined;
    const kind = slot ? presentsOf(el)?.kind : undefined;
    // A chart's card is titled by its axes. Will, TODO 567
    if (slot && kind && spec) this.#show.retitle(el, slot, source);
    if (slot && kind && this.#show.swapped(el, slot, source)) return;
    // A grid in a slot: a pivot, or a table of its chart's answer, its Primary leading. TODOs 548, 624
    const table = slot && kind && asks.shape === 'rows' ? this.#show.table(el, slot, source, () => asks.filters?.(el) ?? []) : undefined;
    // The fields it reads from a row: a summary's, or what it says. TRAP T-a-held-set-reads-the-pages-fields
    const fields = table?.fields ?? (spec ? [spec.field, spec.segment, spec.over].filter((f): f is string => !!f) : asks.fields?.(el));
    /* A chart over its field's ZONES is free of that field: its filter lights the
       zones and never moves the value. Will, TODO 479. TRAP T-a-chart-is-free-of-its-own-field */
    const zoned = asks.zones && spec?.field ? source.zonesOf(spec.field)?.from ?? spec.field : undefined;
    /* What it drew last, so a hover draws it again with no load: a summary marks its
       own part of each segment; a grid marks its own rows. Will, TODO 655 */
    let last: Row[] | null = null;
    const summarised = spec ? (rows: Row[], src: DataSource): unknown => {
      last = rows;
      const test = this.#highlight.test(el, scope, src);
      // A number's zones, from a status field. Plan 683 S3
      const summary = summariseMarked(rows, this.#segmented(spec, src, rows), (f) => src.valuesFor(f), (f) => src.zonesOf(f)?.zones, test);
      return zoned && summary && typeof summary === 'object' && 'zones' in summary
        ? { ...summary, picked: src.pickedFor(bindId(el), zoned) } : summary;
    } : undefined;
    // It draws a hover's matches on its own rows. TODO 655
    const highlights = takes.includes('highlight') ? el as Highlights : null;
    const unbind = bindSource(source, el as Populatable, {
      ...(zoned ? { free: [zoned] } : {}),
      ...(spec && slot ? { shows: this.#show.shows(el), ...(asks.stacks ? { stacks: true } : {}),
        // One number: its card offers no Primary, Group or Sort. Will, TODO 696
        ...(asks.shape === 'aggregate' ? { whole: true } : {}) } : {}),
      ...(fields ? { fields } : {}),
      rows: spec || table || asks.shape === 'all' ? 'all' : 'page',
      // A pager and a filter bar steer; the rows are not theirs to draw.
      steerOnly: asks.shape === 'state' || asks.shape === 'scope',
      ...(asks.own ? { ignore: asks.own } : {}),
      ...(scope ? { scope } : {}),
      /* A summary SHOWS the data and never steers it. TRAP T-aggregation-is-data */
      ...(summarised ? { readonly: true, as: summarised } : {}),
      ...table?.options,
      // A page of rows arrives WITH its groups: a group is the data layer's.
      // TRAP T-a-group-is-a-data-layer-concept
      ...(asks.shape === 'rows' && !table
        ? { as: (rows, src) => {
          const filtered = asks.filters?.(el);
          // Its columns' values are needed now. TRAP T-a-field-reads-its-values-when-needed
          if (filtered) src.readValues(filtered);
          // A heading's Group button offers what the app's `axes` leave. Will, TODO 662
          const groupOffer = typeof scope === 'string' ? src.query.axesOf(scope, 'grid').group : undefined;
          return {
            rows,
            groups: src.state.group && src.loaded ? src.groups() : null,
            ...(groupOffer ? { groupOffer } : {}),
            /* Each FILTER as the source defines it, as a chip's is — the whole
               column too, which one page cannot say. TRAP T-a-heading-opens-the-chips-menu */
            ...(filtered ? { filters: Object.fromEntries(filtered.map((f) => [f, src.filterDef(f)])) } : {}),
          };
        } }
        : {}),
      deliver: (payload) => {
        callback(payload, leave);
        if (highlights) highlights.drawHighlight(this.#highlight.test(el, scope, source));
        // A legend drawn in its card's bar: its numbers are its value chips' counts. TODO 670
        this.#legends.counted(el, payload);
      },
      hover: ({ scope: at, field, on, value }) => this.hover(at, field, on, value),
    });
    // A hover lights it again from what it has: nothing loads. TODO 655
    if (summarised || highlights) {
      this.#highlight.follow(el, scope, source, (test) => {
        if (summarised && last) callback(summarised(last, source), leave);
        else highlights?.drawHighlight(test);
      });
    }
    this.#fetchFields(el, source);
    const unpick = spec && asks.picks ? this.#legends.picks(el as Picker, source, spec.segment ?? '', asks.picks) : undefined;
    // Its card's toggle, now its slot says what its bars draw. Will, TODO 696
    if (slot && kind) this.#cards.drawToolbars(slot);
    const unown = this.#own(el, source);
    // A chart, a grid and a legend in a slot follow its presentation. TODO 548
    const unshow = slot && (spec || kind) ? this.#show.follow(source, slot, !spec && !table, () => this.#answer(asked)) : undefined;
    const untable = table?.bound?.();
    asked.unbind = () => {
      this.#highlight.leave(el);
      untable?.();
      unshow?.();
      unown?.();
      unpick?.();
      unbind();
    };
    // No rows ever come, so it is handed its way out now.
    if (asks.shape === 'state' || asks.shape === 'scope') callback(undefined, leave);
    // …and again when answered: the next page with data opens the panel again.
    if (asks.shape === 'scope') this.#modes.join(el);
    // A bar made after the page's were drawn — a filter stack's — is drawn as they were. TODO 425
    if (asks.shape === 'scope' && !isColumn(el)) this.#pages.joined(el as unknown as Bar);
  }

  /** The fields a component says the STORE answers — `data-fetch-fields`, or a
   *  grid column's `fetch` — told to its source. Each only turns it ON.
   *  TRAP T-a-server-field-is-asked-once-per-answer */
  #fetchFields(el: Element, source: DataSource): void {
    const named = (el.getAttribute('data-fetch-fields') ?? '').split(/\s+/).filter(Boolean);
    const columns = ((el as { columns?: Array<{ field: string; fetch?: string }> }).columns ?? [])
      .filter((c) => c.fetch === 'server').map((c) => c.field);
    for (const field of new Set([...named, ...columns])) {
      const facts = source.fieldFacts(field);
      if (facts.fetch !== 'server') source.declareField(field, { ...facts, fetch: 'server' });
    }
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
    source.query.declareDefault(scope, source.readingsOf(where), { only: bindId(el) });
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

  /** The summary a component declared, as JSON — or none, and it waits. `slot`, its
   *  own or the one it was drawn in, where it is aside. */
  #spec(el: Element, asks: DataAsk, source: DataSource, slot = this.#inherited(el, 'data-scope')): SummarySpec | undefined {
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
    // Its field's zones come with its value. TRAP T-a-status-is-worked-out-by-the-data
    if (asks.zones) spec['zones'] = true;
    /* Its SLOT's presentation, as the Query keeps it, over its own attributes: the
       primary its first split (a bar or slice a value), the secondary a bar
       chart's stack, the group the sections in each, and its order. An axis shown
       as counts splits nothing. A legend lists what splits the chart last: the
       secondary; with none, the primary. Will, TODOs 548, 633, 653 */
    const shown = slot && !/\s/.test(slot) ? source.query.presented(slot, 'chart') : {};
    const host = asks.picks ? up(el) : null;
    const stacks = asks.stacks || (!!host && !!declared(host).asks?.stacks);
    const stack = stacks ? shown.secondary ?? this.#inherited(el, 'data-stack-field') : null;
    const axes = chartAxes(shown.primary ?? spec['segment'] as string | undefined, stack ?? undefined,
      stacks ? this.#inherited(el, 'data-count-axis') : null, spec['aggregate'] as string | undefined);
    if (asks.picks) Object.assign(spec, { ...axes, segment: axes.stack ?? axes.segment, stack: undefined });
    else Object.assign(spec, axes);
    if (shown.group) spec['group'] = shown.group;
    if (shown.sort) spec['sort'] = shown.sort;
    return spec as unknown as SummarySpec;
  }

  /** A series over a date, cut to its date condition's range: `auto` to the unit that fits. TODOs 540, 705 */
  #segmented(given: SummarySpec, source: DataSource, rows: readonly Row[]): SummarySpec {
    // A number field sums; any other counts its rows. Said, it is as said.
    const spec = given.shape === 'aggregate' && !given.aggregate && given.field && source.fieldFacts(given.field).type === 'number'
      ? { ...given, aggregate: 'sum' as const } : given;
    const scope = spec.over ? source.query.scopeOf(spec.over) : undefined;
    const reading = scope ? source.query.reading(scope, spec.over!) : undefined;
    // By its field's type: untyped, a picked range reads as `in`, and no axis sees it.
    return segmented(spec, reading ? source.whereOf({ [spec.over!]: reading })[spec.over!] : undefined, rows);
  }

  /** The fields the open page declares: a row opened in a grid made from a chart shows them. */
  #pageFields: string[] = [];

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
      if (!source && names.length && !this.#givenAbove(named)) {
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
