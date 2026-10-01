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
  deleteSavedView, loadSavedViews, onViewPicked, saveViewAs, uniqueViewLabel, viewOptions, viewQueryOf,
  type ViewLibrary,
} from '../../core/browser/persist-view.js';
import { labelId } from '../../core/browser/web-storage.js';
import { clearDraft, draftSig, loadDraft, saveDraft, type DraftMode } from '../../core/browser/view-drafts.js';
import { loadSavedFilters } from '../../core/browser/saved-filters.js';
import { openSource, type PageDefinition } from '../../core/data/page-definition.js';
import type { DataSource, SourceState } from '../../core/data/data-source.js';
import { VIEW, type Query, type QueryDefaults } from '../../core/data/query.js';
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
  /** Keep a draft per View: off, for the tab, or across sessions. Asked at
   *  each write. None: no drafts. TRAP T-a-view-keeps-a-draft */
  drafts?: () => DraftMode;
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
    this.addEventListener('filter-panel-close', this.#onPanelClose);
    this.addEventListener('panel-room-change', this.#onRoom);
    /* A container's Retry, and a bar's Refresh: load again. Its Clear filters:
       every bar resets. TRAP T-a-container-shows-its-datas-state */
    this.addEventListener('data-refresh', (event) => {
      const source = this.#resolve(event.target as Element) ?? Object.values(this.#sources)[0];
      void source?.load({ force: true });
    });
    this.addEventListener('filters-clear', () => {
      for (const bar of this.#bars() as Array<Bar & { clearAll?: () => void }>) bar.clearAll?.();
    });
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

  /** Each list filter offers only what the others leave — on every source it
   *  gives. The app sets it, from its session. TRAP T-a-ruled-out-value-is-greyed */
  get limitOptions(): boolean {
    return this.#limit;
  }
  set limitOptions(on: boolean) {
    this.#limit = on;
    for (const source of Object.values(this.#sources)) source.limitOptions = on;
  }
  /** The app's choice, for every source. */
  #limit = false;
  /** What was ASKED for — a narrow window can refuse the panel for a while. */
  #wanted: 'toolbars' | 'panel' = 'toolbars';
  /** The shell has room for a panel area. TRAP T-the-panel-is-desktop-only */
  #room = true;

  /** Open or shut every panel, and step every bar back or forward to match. */
  #setMode(mode: 'toolbars' | 'panel'): void {
    const panels = this.#panels();
    for (const panel of panels) {
      if (mode !== 'panel') panel.hide?.();
      else if (this.#room) panel.show?.();
    }
    // With no room the panel stays shut, so follow what it actually did.
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

  /** The shell lost room for the panel: shut it, which is not a choice. Room
   *  again, and the reader wanted it: give it back. TRAP T-the-panel-is-desktop-only */
  #onRoom = (event: Event): void => {
    this.#room = (event as CustomEvent<{ room?: boolean }>).detail?.room !== false;
    if (!this.#room) for (const panel of this.#panels()) panel.hide?.('width');
    else if (this.#wanted === 'panel') this.#setMode('panel');
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
    for (const source of Object.values(this.#sources)) source.limitOptions = this.#limit;
    // BEFORE answering: an answer binds, and a bind starts the first load.
    this.#states?.abort();
    this.#states = new AbortController();
    this.#watchStates(this.#states.signal);
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
    // The page as DEFINED, before a kept Query: what Reset all to default starts from.
    const initial = structuredClone(source.query.applied);
    this.#opened = { id: definition.id, store: def.store, source, library, initial };
    // A View this page does not have is the first.
    const view = options.view && library?.()[options.view] ? options.view : undefined;
    // BEFORE the Query: a kept one is drawn onto these chips.
    await Promise.all([this.#drawBars(view), this.#configure(definition.ui ?? {})]);
    if (page.signal.aborted) return undefined;
    source.addEventListener('scope-change', () => this.#offer(), { signal: page.signal });
    /* A REQUEST. A host that asks the reader first — a confirm dialog —
       prevents it, and calls resetView() itself. TRAP T-reset-to-default-is-the-views-own */
    this.addEventListener('view-reset', (event) => {
      if (!event.defaultPrevented) void this.resetView();
    }, { signal: page.signal });
    await this.provide({
      sources: { [definition.id]: source },
      ...(library ? {
        views: library, ...(view ? { view } : {}),
        ...(options.session ? { session: options.session } : {}), key: `/filters/${definition.id}`,
        ...(options.drafts ? { drafts: { page: definition.id, mode: options.drafts } } : {}),
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
   * undefined. `stay`: keep it for later, and stay on the View on screen — the
   * save before a Reset all to default.
   * TRAP T-a-view-is-json · TRAP T-a-saved-view-is-the-readers-own
   */
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
      await this.#drawBars(options.stay ? this.#view : id);
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
   * since goes. What "Reset all to default" does. TRAP T-reset-to-default-is-the-views-own
   */
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
    // In the source's words, so a field the bar does not hold still has its name.
    const saved = Object.entries(loadSavedFilters(opened.store)).map(([id, { label, readings }]) => ({
      id: `custom:${id}`, label, readings, editable: true, says: opened.source.say(readings),
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
      const cards = (rowsOnly: boolean): HTMLElement[] => [...new Set([...this.#asked.keys()]
        .filter((el) => {
          if (this.#resolve(el) !== source) return false;
          const shape = ((el.constructor as { asks?: DataAsk }).asks ?? { shape: 'rows' }).shape;
          return rowsOnly ? shape === 'rows' : shape !== 'scope' && shape !== 'state';
        })
        .map(containerOf).filter((c): c is HTMLElement => !!c))].map((c) => this.#keep(c));
      let slow: ReturnType<typeof setTimeout> | undefined;
      source.addEventListener('loading', (event) => {
        clearTimeout(slow);
        const loading = !!(event as CustomEvent).detail?.loading;
        if (loading) slow = setTimeout(() => { for (const c of cards(false)) c.toggleAttribute('data-loading', true); }, SLOW_LOAD);
        else for (const c of cards(false)) c.removeAttribute('data-loading');
      }, { signal });
      source.addEventListener('change', (event) => {
        const { total } = (event as CustomEvent).detail as { total: number };
        const { filter, search } = source.state;
        const state = total > 0 ? null : filter || search ? 'no-matches' : 'empty';
        for (const c of cards(false)) if (c.dataset['state'] === 'error') delete c.dataset['state'];
        for (const c of cards(true)) {
          if (state) c.dataset['state'] = state;
          else delete c.dataset['state'];
        }
      }, { signal });
      source.addEventListener('error', (event) => {
        const { error } = (event as CustomEvent).detail as { error: unknown };
        for (const c of cards(false)) {
          c.dataset['state'] = 'error';
          c.dataset['errorMessage'] = error instanceof Error ? error.message : String(error);
        }
      }, { signal });
    }
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
    this.#drafts = options.drafts ? { ...options.drafts, source, library } : null;
    // A link to a View the reader left a draft on opens on the draft.
    const draft = this.#view ? this.#draftOf(this.#view) : undefined;
    if (kept?.query && kept.view === this.#view) await source.setQuery(kept.query);
    else if (draft) await source.setQuery(draft);
    else if (this.#view !== first && start?.query) await source.setQuery(start.query, { holds: 'keep' });
    if (signal.aborted) return;
    this.#hear = () => this.#hearPicks(source, library, signal);
    this.#hear();
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
    // A preset switched or edited is a report, and no selection changes.
    // TRAP T-a-saved-filter-keeps-its-edit
    for (const type of ['quick-filter-change', 'preset-edit']) this.addEventListener(type, keep, { signal });
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
    // One part per component, or the second would replace the first.
    const key = `picks:${el.id || field}`;
    const unbind = bindSelection(el, source as unknown as Selector, {
      field,
      values,
      read: (c) => c.picked,
      draw: (c, picked) => { c.picked = [...picked]; },
      event: picks.event,
      reach: 'component',
      ...(only ? { only } : {}),
      key,
    }).destroy;
    if (!only) return unbind;
    /* The chart's OWN scope, so a filter panel draws it — named as the chart
       is. TRAP T-a-chart-scope-is-its-legend-field */
    const label = nameOf(only);
    source.declarePart(key, { field, only: only as Populatable, ...(label ? { label } : {}) });
    return () => {
      source.declarePart(key, undefined);
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

customElements.define('sherpa-provider', SherpaProvider);
