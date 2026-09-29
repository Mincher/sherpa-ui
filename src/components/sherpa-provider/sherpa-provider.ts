/**
 * sherpa-provider — the data layer, over a SUBTREE of the page: a component
 * inside it ASKS, and this ANSWERS.
 *
 * A thin DOM door onto the DOM-free data layer. It holds the sources it is
 * given and joins each component that asks to the one its subtree provides —
 * by `bind()`, delivering through the callback the component asked with. A
 * request that arrives before any source waits, and `provide()` answers it.
 * docs/PROVIDER-DESIGN.md. TRAP T-a-component-asks-its-provider
 *
 * Map:
 * - ProvideOptions — What a provider is given: its sources by name, and its Views.
 * - OpenOptions — What `open()` is given beside a page's definition: the app's stores, and the page's Views.
 * - ProviderState — A subtree's whole state as JSON: each source's question, and the View on screen.
 */
import { SUMMARY_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import {
  DATA_CONTEXT, SOURCE_CONTEXT, type ContextRequestEvent, type DataAsk,
} from '../../core/ui/context.js';
import { report } from '../../core/data/report.js';
import { summarise, type SummarySpec } from '../../core/data/aggregate.js';
import { bindSelection, type Selector } from '../../core/data/bind-selection.js';
import { valueKey, type Store } from '../../core/data/store.js';
import {
  deleteSavedView, loadSavedViews, onViewPicked, saveViewAs, uniqueViewLabel, viewOptions, type ViewLibrary,
} from '../../core/browser/persist-view.js';
import { labelId } from '../../core/browser/web-storage.js';
import { loadSavedFilters } from '../../core/browser/saved-filters.js';
import { openSource, type PageDefinition } from '../../core/data/page-definition.js';
import type { DataSource, SourceState } from '../../core/data/data-source.js';
import { VIEW, type Query } from '../../core/data/query.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import { applyState, type Populatable } from '../../core/ui/apply-state.js';

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
}

/** A filter bar, as the provider draws it. */
type Bar = HTMLElement & {
  populate(defs: unknown[]): Promise<void> | void;
  available?(defs: unknown[]): void;
  organise?(def: { group?: unknown[]; sort?: unknown[] }): void;
  heldFields?: string[];
  report?(): void;
};

/** A subtree's whole state, as JSON — each source's question and the View on
 *  screen — to send out and take back in. TRAP T-a-page-goes-out-as-json */
export interface ProviderState {
  v: 1;
  view?: string;
  sources: Record<string, SourceState>;
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

/** One component that asked, and how to stop answering it. */
interface Asked {
  request: ContextRequestEvent<unknown>;
  unbind?: () => void;
}

export class SherpaProvider extends SherpaElement {
  static override css = new URL('./sherpa-provider.css', import.meta.url);
  static override html = new URL('./sherpa-provider.html', import.meta.url);

  /** The sources this subtree provides, by name. */
  #sources: Record<string, DataSource> = {};
  /** Every component that asked, by the element that asked. */
  #asked = new Map<Element, Asked>();

  constructor() {
    super();
    // From the START: a child can ask before this has rendered.
    this.addEventListener('context-request', this.#onRequest);
    // Any bar's Configure, and the panel's own close and reopen.
    this.addEventListener('filter-panel-close', this.#onPanelClose);
    this.addEventListener('filter-panel-reopen', this.#onPanelReopen);
  }

  /**
   * TOOLBARS or PANEL, for every page in this subtree — the filter panel open
   * and each filter bar stepped back, or the bars. The app sets it (from its
   * session); a reader's change is reported as `filter-mode-change`.
   * TRAP T-the-provider-owns-the-panel-mode
   */
  get filterMode(): 'toolbars' | 'panel' {
    return this.#mode;
  }
  set filterMode(mode: 'toolbars' | 'panel') {
    this.#wanted = mode;
    this.#setMode(mode);
  }

  /** What the panel and bars show now. */
  #mode: 'toolbars' | 'panel' = 'toolbars';
  /** What was ASKED for — a narrow window can refuse the panel for a while. */
  #wanted: 'toolbars' | 'panel' = 'toolbars';

  /** Open or shut every panel, and step every bar back or forward to match. */
  #setMode(mode: 'toolbars' | 'panel'): void {
    const panels = this.#panels();
    for (const panel of panels) {
      if (mode === 'panel') panel.show?.();
      else panel.hide?.();
    }
    // `open()` refuses below its breakpoint, so follow what it actually did.
    this.#mode = mode === 'panel' && panels.some((p) => p.hasAttribute('open')) ? 'panel' : 'toolbars';
    for (const bar of this.#bars()) this.#stepBack(bar);
    this.#giveToggles();
  }

  /**
   * THE MODE'S OWN BUTTONS — the page's, so no bar or panel carries a switch
   * for a mode it knows nothing of (Will, TODO 37). A bar has "View as filter
   * panel" in its `actions` slot while a panel is on the page — taken out
   * while the panel answers; a panel has "Filter in the toolbars instead".
   * TRAP T-the-mode-switch-is-the-pages-own
   */
  #giveToggles(): void {
    const panels = this.#panels();
    for (const bar of this.#bars()) {
      let toggle = this.#toggles.get(bar);
      if (!panels.length) {
        toggle?.remove();
        this.#toggles.delete(bar);
        continue;
      }
      toggle ??= this.#toggle(bar, 'sidebar', 'View as filter panel');
      if (!toggle) continue;
      if (this.#mode === 'panel') toggle.remove();
      else if (!toggle.isConnected) bar.append(toggle);
    }
    for (const panel of panels) {
      if (!this.#toggles.has(panel)) this.#toggle(panel, 'fullscreen-exit', 'Filter in the toolbars instead');
    }
  }

  /** The mode buttons, by the bar or panel each sits in. */
  #toggles = new Map<Element, HTMLElement>();

  /** One mode button, from the template, into its host's `actions` slot — or,
   *  before this provider has drawn its template, once it has. */
  #toggle(host: Element, icon: string, label: string): HTMLElement | undefined {
    const button = this.clone('template.mode-toggle-tpl') as HTMLElement | null;
    if (!button) {
      void this.rendered.then(() => this.#giveToggles());
      return undefined;
    }
    button.dataset['iconStart'] = icon;
    button.setAttribute('aria-label', label);
    button.addEventListener('button-click', this.#onConfigure);
    host.append(button);
    this.#toggles.set(host, button);
    return button;
  }

  /** A bar steps back while a panel answers for it. TRAP T-panel-mode-hides-what-the-panel-answers */
  #stepBack(bar: Element): void {
    bar.toggleAttribute('data-panel-mode', this.#mode === 'panel');
  }

  /** Every panel that asked — a control drawn over several scopes. */
  #panels(): Array<HTMLElement & { show?: () => void; hide?: (reason?: string) => void }> {
    return [...this.#asked.keys()].filter((el) => 'drawScopes' in el) as never;
  }

  /** Every filter bar that asked — a control drawn one scope at a time. */
  #bars(): Element[] {
    return [...this.#asked.keys()].filter((el) => 'drawScope' in el && !('drawScopes' in el));
  }

  /** A mode button: the reader switches the mode. */
  #onConfigure = (): void => {
    this.#wanted = this.#mode === 'panel' ? 'toolbars' : 'panel';
    this.#setMode(this.#wanted);
    this.emit('filter-mode-change', { mode: this.#wanted });
  };

  /** EVERY close reports, and a READER's is a choice worth keeping; a window
   *  too narrow is not. TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
  #onPanelClose = (event: Event): void => {
    this.#mode = 'toolbars';
    for (const bar of this.#bars()) this.#stepBack(bar);
    this.#giveToggles();
    // A narrow window, or a page with no filters, is not a choice.
    const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
    if (reason === 'width' || reason === 'page' || this.#wanted === 'toolbars') return;
    this.#wanted = 'toolbars';
    this.emit('filter-mode-change', { mode: 'toolbars' });
  };

  /** WIDE AGAIN, and the window was what took the panel away: give it back. */
  #onPanelReopen = (): void => {
    if (this.#wanted !== 'panel') return;
    requestAnimationFrame(() => requestAnimationFrame(() => this.#setMode('panel')));
  };

  /**
   * Give this subtree its sources — and its Views. Every component already
   * asking is answered again: a Context that swaps its source swaps it for
   * everything in it. Settles once the kept Query, or the start View, is on.
   * TRAP T-a-provider-keeps-the-views
   */
  provide(options: ProvideOptions): Promise<void> {
    // The page `open()` set up has gone, with its source.
    if (this.#opened && !Object.values(options.sources).includes(this.#opened.source)) {
      this.#page?.abort();
      this.#page = null;
      this.#opened = null;
    }
    this.#sources = { ...options.sources };
    for (const asked of this.#asked.values()) this.#answer(asked);
    this.#views?.abort();
    this.#views = null;
    this.#hear = null;
    /* A page with NO data has no filters: the panel shuts — not the reader's
       choice, so it opens again on the next page that has some. TRAP T-navigating-sets-up-the-page */
    if (!Object.keys(this.#sources).length) {
      for (const panel of this.#panels()) panel.hide?.('page');
    }
    // The Views are over the ONE source; a subtree of several names none.
    const [source, ...more] = Object.values(this.#sources);
    if (!options.views || !source || more.length) return Promise.resolve();
    this.#views = new AbortController();
    return this.#openViews(source, options, this.#views.signal);
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
    const source = def && store ? await openSource(def, store) : undefined;
    if (page.signal.aborted) return undefined;
    if (!source || !def) {
      await this.provide({ sources: {} });
      return undefined;
    }
    /* A reader's own saved filters are kept with the DATA, not the page, and
       offered in each bar's Add list. TRAP T-a-saved-filter-lives-with-its-data */
    for (const [id, saved] of Object.entries(loadSavedFilters(def.store))) {
      source.declarePreset(`custom:${id}`, saved.readings, { label: saved.label, editable: true });
    }
    const shipped = options.views;
    const library = shipped ? (): ViewLibrary => ({ ...shipped, ...loadSavedViews(definition.id) }) : null;
    // The page as DEFINED, before a kept Query: what Reset to default starts from.
    const initial = structuredClone(source.query.applied);
    this.#opened = { id: definition.id, store: def.store, source, library, initial };
    // A View this page does not have is the first.
    const view = options.view && library?.()[options.view] ? options.view : undefined;
    // BEFORE the Query: a kept one is drawn onto these chips.
    await Promise.all([this.#drawBars(view), this.#configure(definition.ui ?? {})]);
    if (page.signal.aborted) return undefined;
    source.addEventListener('scope-change', () => this.#offer(), { signal: page.signal });
    this.addEventListener('view-reset', () => void this.resetView(), { signal: page.signal });
    await this.provide({
      sources: { [definition.id]: source },
      ...(library ? {
        views: library, ...(view ? { view } : {}),
        ...(options.session ? { session: options.session } : {}), key: `/filters/${definition.id}`,
      } : {}),
    });
    return page.signal.aborted ? undefined : source;
  }

  /** Leave the page, or one still opening: its source goes, and nothing in the subtree reaches it. */
  close(): void {
    this.#page?.abort();
    this.#page = null;
    void this.provide({ sources: {} });
  }

  /**
   * Save what is on screen as a View of the open page, and put it on the View
   * chip. With a name, a NEW View — a name any View has already gets ` -
   * Copy-001`. With none, over the reader's own View on screen; a preset is
   * never overwritten, so that answers undefined. The saved View's id, else
   * undefined. TRAP T-a-view-is-json · TRAP T-a-saved-view-is-the-readers-own
   */
  async saveView(label?: string): Promise<string | undefined> {
    const opened = this.#opened;
    if (!opened?.library) return undefined;
    const own = this.#view ? loadSavedViews(opened.id)[this.#view] : undefined;
    const name = label == null ? own?.label
      : label.trim() && uniqueViewLabel(label, Object.values(opened.library()).map((v) => v.label));
    if (!name) return undefined;
    saveViewAs(opened.id, name, { source: opened.source });
    // Read BEFORE the redraw: a rebuilt bar's first report is empty.
    const kept = opened.source.query.applied;
    const id = labelId(name);
    await this.#drawBars(id);
    await opened.source.setQuery(kept);
    // Reported, so the URL and the nav follow the View just saved.
    this.#viewBar()?.report?.();
    return id;
  }

  /** Delete the reader's own View — the one on screen unless named — and go to
   *  the first. A preset is never deleted. TRAP T-a-saved-view-is-the-readers-own */
  async deleteView(id = this.#view): Promise<boolean> {
    const opened = this.#opened;
    if (!opened?.library || !id || !loadSavedViews(opened.id)[id]) return false;
    deleteSavedView(opened.id, id);
    if (id !== this.#view) {
      await this.#drawBars(this.#view);
      return true;
    }
    const first = Object.keys(opened.library())[0];
    this.#view = first;
    await this.#drawBars(first);
    await this.resetView();
    this.#viewBar()?.report?.();
    this.emit('view-change', { id: first });
    return true;
  }

  /** Is the View on screen the reader's own — saved, so it can be saved over or deleted? */
  get customView(): boolean {
    const opened = this.#opened;
    return !!(opened && this.#view && loadSavedViews(opened.id)[this.#view]);
  }

  /** The bar over the View's own scope. */
  #viewBar(): Bar | undefined {
    return (this.#bars() as Bar[]).find((bar) => this.#inherited(bar, 'data-scope') === VIEW);
  }

  /**
   * Put the filters back as the View on screen DEFINES them: the page's first
   * Query, then the View's, as a pick puts it on. A filter the reader added
   * since goes. What "Reset to default" does. TRAP T-reset-to-default-is-the-views-own
   */
  async resetView(): Promise<void> {
    const opened = this.#opened;
    if (!opened) return;
    const view = this.#view ? opened.library?.()[this.#view] : undefined;
    await opened.source.setQuery(structuredClone(opened.initial));
    if (view?.query) await opened.source.setQuery(view.query, { holds: 'keep' });
  }

  /** Stops the open page's listeners. */
  #page: AbortController | null = null;
  /** The page `open()` set up. */
  #opened: {
    id: string; store: string; source: DataSource; library: (() => ViewLibrary) | null; initial: Query;
  } | null = null;

  /** Configure each component by id, through its own API, once it is defined.
   *  TRAP T-configuration-is-not-data */
  async #configure(ui: NonNullable<PageDefinition['ui']>): Promise<void> {
    await Promise.all(Object.entries(ui).map(async ([id, state]) => {
      const el = this.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (!el) {
        report({ code: 'provider-unknown-element', message: `sherpa-provider: no #${id} to configure.`, at: { id } });
        return;
      }
      await customElements.whenDefined(el.localName);
      applyState(el, { ...state });
    }));
  }

  /** Draw every bar from its scope, as the source describes it — the View
   *  chip first, its Group and Sort — then what it may add. */
  async #drawBars(view?: string): Promise<void> {
    const opened = this.#opened;
    if (!opened) return;
    const { source, library } = opened;
    await Promise.all((this.#bars() as Bar[]).map(async (bar) => {
      const scope = this.#inherited(bar, 'data-scope');
      if (!scope) return;
      const described = source.describe(scope);
      const custom = new Set(Object.keys(loadSavedViews(opened.id)));
      const picker = scope === VIEW && library ? [{
        id: 'view', label: 'View', persistent: true, active: true, select: 'single',
        options: viewOptions(library(), view, custom),
      }] : [];
      // The bar offers Delete only on the reader's own View. TRAP T-a-saved-view-is-the-readers-own
      if (scope === VIEW) bar.toggleAttribute('data-custom-view', !!view && custom.has(view));
      await bar.populate([...picker, ...described.filters]);
      if (described.group) bar.organise?.({ group: described.group, sort: described.sort ?? [] });
    }));
    this.#offer();
  }

  /** Each bar's Add list: what its scope may still add — by the chips it HAS,
   *  so a restore can draw a held field's chip — each noting where it lives.
   *  Below the View, EVERY saved filter of the reader's, held or not, so a
   *  restore can draw one. TRAP T-saved-filters-are-the-custom-section */
  #offer(): void {
    const opened = this.#opened;
    if (!opened) return;
    const saved = Object.entries(loadSavedFilters(opened.store)).map(([id, { label, readings }]) => ({
      id: `custom:${id}`, label, readings, editable: true,
    }));
    for (const bar of this.#bars() as Bar[]) {
      const scope = this.#inherited(bar, 'data-scope');
      if (!scope) continue;
      bar.available?.([
        ...opened.source.addable(scope, bar.heldFields ?? []).map((d) => ({ ...d, removable: true })),
        ...(scope === VIEW ? [] : saved),
      ]);
    }
  }

  /** The View on screen. */
  get view(): string | undefined {
    return this.#view;
  }

  override onDisconnect(): void {
    this.#page?.abort();
    this.#views?.abort();
    this.#views = null;
    this.#hear = null;
    for (const asked of this.#asked.values()) asked.unbind?.();
    this.#asked.clear();
  }

  /** Stops the Views' listeners when the sources change. */
  #views: AbortController | null = null;
  /** The View on screen. */
  #view: string | undefined;

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
    if (kept?.query && kept.view === this.#view) await source.setQuery(kept.query);
    else if (this.#view !== first && start?.query) await source.setQuery(start.query, { holds: 'keep' });
    if (signal.aborted) return;
    this.#hear = () => this.#hearPicks(source, library, signal);
    this.#hear();
    if (!key || !session) return;
    let frame = 0;
    const keep = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => session.set(key, { view: this.#view, query: source.query.applied }));
    };
    for (const type of ['selection-change', 'scope-change']) source.addEventListener(type, keep, { signal });
    // A preset switched is a report, and no selection changes.
    this.addEventListener('quick-filter-change', keep, { signal });
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
    // Whatever has an id in this subtree NOW — a View's content brings its own.
    const byId = (): Record<string, HTMLElement> =>
      Object.fromEntries([...this.querySelectorAll<HTMLElement>('[id]')].map((el) => [el.id, el]));
    onViewPicked(this, library, {
      source,
      get elements() { return byId(); },
    }, {
      signal: picks.signal,
      // The View on screen already — a first pick of it would wipe what was kept.
      // TRAP T-a-persistent-chip-reports-on-every-change
      applied: this.#view ?? null,
      into: this.querySelector<HTMLElement>('[data-view-content]'),
      after: ({ id, rendered }) => {
        this.#view = id;
        this.#viewBar()?.toggleAttribute('data-custom-view', this.customView);
        this.emit('view-change', { id, ...(rendered ? { elements: rendered.elements } : {}) });
      },
    });
  }

  /**
   * This subtree's whole state as JSON — each source's question, and the View
   * on screen — for a link, another service or an agent.
   * TRAP T-a-page-goes-out-as-json
   */
  export(): ProviderState {
    const sources: Record<string, SourceState> = {};
    for (const [name, source] of Object.entries(this.#sources)) sources[name] = source.export();
    return { v: 1, ...(this.#view ? { view: this.#view } : {}), sources };
  }

  /**
   * Take a state back in, exactly: each named source's question, and its View
   * — shown on the View chip, and known to the pick listener, so the next pick
   * of the old View is heard. A source it does not name is left as it is.
   */
  async import(state: ProviderState): Promise<void> {
    if (state?.v !== 1) {
      report({ code: 'unknown-state', message: 'sherpa-provider: not a v1 state, so nothing was taken in.' });
      return;
    }
    for (const [name, given] of Object.entries(state.sources ?? {})) await this.#sources[name]?.import(given);
    if (!state.view || state.view === this.#view) return;
    const was = this.#view;
    this.#view = state.view;
    this.#showView(was, state.view);
    this.#hear?.();
    this.emit('view-change', { id: state.view });
  }

  /** Put a View on the chip that shows the current one — silently: its Query is on. */
  #showView(was: string | undefined, id: string): void {
    for (const bar of this.querySelectorAll<HTMLElement & {
      values?: Record<string, readonly string[]>; setChipValues?: (id: string, v: string[]) => void;
    }>('sherpa-quick-filter-toolbar')) {
      const chip = Object.keys(bar.values ?? {}).find((k) => bar.values?.[k]?.[0] === was);
      if (chip) bar.setChipValues?.(chip, [id]);
    }
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
    const unbind = source.bind(el as Populatable, {
      rows: spec || asks.shape === 'all' ? 'all' : 'page',
      // A pager and a filter bar steer; the rows are not theirs to draw.
      steerOnly: asks.shape === 'state' || asks.shape === 'scope',
      ...(asks.own ? { ignore: asks.own } : {}),
      ...(scope ? { scope } : {}),
      ...(asks.shows ? { shows: asks.shows } : {}),
      /* A summary SHOWS the data and never steers it. TRAP T-aggregation-is-data */
      ...(spec ? { readonly: true, as: (rows, src) => summarise(rows, spec, (f) => src.valuesFor(f)) } : {}),
      // A page of rows arrives WITH its groups: a group is the data layer's.
      // TRAP T-a-group-is-a-data-layer-concept
      ...(asks.shape === 'rows'
        ? { as: (rows, src) => ({
          rows,
          groups: src.state.group && src.loaded ? src.groups() : null,
          // The WHOLE column, which one page cannot say. TRAP T-unavailable-value-sorts-below-a-divider
          ...(asks.values ? { values: Object.fromEntries(asks.values(el)
            .map((f) => [f, src.valuesFor(f).map(valueKey)])) } : {}),
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
    // A bar or a panel that joins takes the mode — a page loaded later too.
    if (asks.shape === 'scope') {
      if ('drawScopes' in el && this.#wanted === 'panel' && this.#mode !== 'panel') this.#setMode('panel');
      else if (!('drawScopes' in el)) this.#stepBack(el);
      this.#giveToggles();
    }
  }

  /**
   * A component's OWN default filter — `data-readings`, the Query's readings
   * by field, as JSON — narrowing it alone, and outliving a View pick.
   * TRAP T-a-component-default-outlives-a-view
   */
  #own(el: Element, source: DataSource): (() => void) | undefined {
    const raw = el.getAttribute('data-readings');
    if (!raw) return undefined;
    let readings: Record<string, FieldReading>;
    try {
      readings = JSON.parse(raw) as Record<string, FieldReading>;
    } catch {
      report({
        code: 'provider-bad-readings',
        message: 'sherpa-provider: data-readings is not readings by field as JSON, so this component filters nothing of its own.',
        at: { tag: el.localName, readings: raw },
      });
      return undefined;
    }
    const scope = `own:${el.id || this.#ownId(el)}`;
    source.declareDefault(scope, readings, { only: el as Populatable });
    return () => source.declareDefault(scope, undefined);
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
    return bindSelection(el, source as unknown as Selector, {
      field,
      values,
      read: (c) => c.picked,
      draw: (c, picked) => { c.picked = [...picked]; },
      event: picks.event,
      reach: 'component',
      ...(only ? { only } : {}),
      // One part per component, or the second would replace the first.
      key: `picks:${el.id || field}`,
    }).destroy;
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

customElements.define('sherpa-provider', SherpaProvider);
