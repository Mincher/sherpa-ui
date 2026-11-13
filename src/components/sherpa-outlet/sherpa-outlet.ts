/**
 * sherpa-outlet — where the route's Context is drawn: on each route change it
 * loads the Context app.json names, runs it, and tears the last one down.
 * TRAP T-an-outlet-loads-the-context
 *
 * A Context whose `chrome.filters` is `"views"` has its row drawn here: the View chip and, on a
 * graph View, the graph chip, which picks the entity its canvas shows — on a `query` View, the page
 * whose Query it shows, opened here for its Query alone. TRAP T-a-graph-is-a-view-of-a-type
 *
 * Map:
 * - OutletOptions — what an app hands its outlet: app.json, where it lives, the session and the stores
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { bindSettings } from '../../core/ui/bind-settings.js';
import { checkApp, type AppDefinition, type ContextInit, type ContextModule, type OpenPage } from '../../core/data/app-definition.js';
import { report } from '../../core/data/report.js';
import { loadViewLibrary } from '../../core/browser/view-files.js';
import type { Entity } from '../../core/data/entity.js';
import type { EntityShelf } from '../../core/data/entity-shelf.js';
import type { ViewLibrary } from '../../core/browser/persist-view.js';
import { GRAPH_CHIP, VIEW_CHIP } from '../../core/ui/shared-constants.js';
import { NEW_GRAPH, PAGE_QUERY, graphRows, newGraph, openOf, pageRows, pagesOf, type OpenGraph } from '../../core/data/graph-views.js';
import type { SessionStore } from '../../core/browser/session.js';
import { SETTINGS, Settings } from '../../core/data/settings.js';
import type { PageDefinition } from '../../core/data/page-definition.js';
import type { DataSource } from '../../core/data/data-source.js';
import type { Store } from '../../core/data/store.js';
import type { Route } from '../../core/browser/route.js';
import type { RouteChange, SherpaRouter } from '../sherpa-router/sherpa-router.js';
import type { SherpaProvider } from '../sherpa-provider/sherpa-provider.js';
import { OutletNav } from './outlet-nav.js';
import '../sherpa-callout/sherpa-callout.js';

/** What an app hands its outlet: app.json, where it lives, the session and the stores. */
export interface OutletOptions {
  /** The app, as app.json says it. */
  app: AppDefinition;
  /** Where app.json is: every path in it is relative to this. */
  base: string | URL;
  session: SessionStore;
  /** The app's stores by name, asked at each load: a debug switch may swap one.
   *  Hand back the SAME object for a store each time — each new one is a store
   *  of its own to the data layer, with its own listeners and held rows. Beside
   *  them, each app.json type's own store, by its id; the app's wins by name (plan 960 U3). */
  stores(): Record<string, Store>;
  /** Settles before a Context opens its data: its stores are seeded. */
  ready?: Promise<unknown>;
  /** The app's panels by id, handed to every Context. */
  panels?: Readonly<Record<string, HTMLElement | undefined>>;
  /** Where a Settings page opens, OVER the Context: the overlay dialog, its
   *  header, and the box the page goes in. */
  settings?: { dialog: HTMLElement & { show(): void; hide(): void }; header?: HTMLElement; root: HTMLElement };
  /** The app's last word on a Context's definition as it opens — a copy, to
   *  change: a field's child values left out, say. Will, TODO 436 */
  definition?(context: string, definition: PageDefinition): PageDefinition;
}

/** The header's View chip. */
type ViewBar = HTMLElement & {
  values?: Record<string, string[] | undefined>;
  setChipValues(id: string, values: string[]): void;
  report(): void;
  populate(defs: unknown[]): Promise<void> | void;
};

/** The header's bar that holds the View chip. */
const VIEW_BAR = 'sherpa-quick-filter-toolbar[data-type="view"]';

export class SherpaOutlet extends SherpaElement {
  static override css = new URL('./sherpa-outlet.css', import.meta.url);
  static override html = new URL('./sherpa-outlet.html', import.meta.url);
  // None on its attributes: told, its nav reads its own. TRAP T-the-outlet-keeps-the-nav
  static override settings = {};

  /** What `start()` was given. */
  #options: OutletOptions | null = null;
  /** Each Context's own Views, once loaded. */
  #views: Record<string, ViewLibrary> = {};
  /** Settles once every Context's own Views are in. */
  #viewsReady: Promise<void> = Promise.resolve();
  /** Settles once the app's types are registered, their stores seeded, and its preset entities are in the keeper. */
  #nodesReady: Promise<void> = Promise.resolve();
  /** Each app.json type's store, by the type's id: made from its rows (plan 960 U3). */
  #typeStores: Record<string, Store> = {};
  /** The app's preset entities, once loaded. */
  #entityPresets: readonly Entity[] = [];
  /** Only the newest load may commit. */
  #token = 0;
  /** The Context on screen. */
  #context: string | null = null;
  /** Aborts the Context's `ctx.signal`. */
  #leaving: AbortController | null = null;
  /** What the Context's init handed back. */
  #teardown: (() => void) | null = null;
  /** What the Context put in the shell's fixed region. TODO 484 */
  #lifted: Element[] = [];
  /** The nav it keeps, when its shell has one. */
  #nav: OutletNav | null = null;
  /** The pin as the rail reported it before start(), or null: the reader's. TRAP T-a-pin-before-start-is-the-readers */
  #pinnedEarly: boolean | null = null;
  /** The Settings page open over it, its token, its signal and its teardown. */
  #settings: { page: string | null; token: number; leaving: AbortController | null; teardown: (() => void) | null } = {
    page: null, token: 0, leaving: null, teardown: null,
  };

  /** The Context on screen. */
  get context(): string | null {
    return this.#context;
  }

  /** The Settings page open over it, or null. */
  get settingsPage(): string | null {
    return this.#settings.page;
  }

  /** The graph View on screen — its View, its type, the entity on its canvas — or null. */
  get graph(): OpenGraph | null {
    return this.#graph;
  }

  /** Open an entity in the graph View on screen; none, its type's first. The graph chip shows it,
   *  and the URL follows. */
  async openGraph(id: string | null): Promise<void> {
    const open = this.#graph;
    const shelf = this.#provider?.keeper.entities;
    if (!open || !shelf) return;
    const first = (open.type === PAGE_QUERY ? this.#pages()[0] : shelf.list(open.type)[0])?.id ?? null;
    await this.#router?.go({ [GRAPH_CHIP]: id === first ? null : id }, { replace: true });
    // The URL stays where the first is opened again: drawn either way.
    await this.#syncGraph();
  }

  /** Settles once every Context's own Views are in. */
  get viewsReady(): Promise<void> {
    return this.#viewsReady;
  }

  /** A Context's Views: its own, then the reader's saved ones. */
  viewsOf(context: string): ViewLibrary {
    return { ...this.#views[context], ...this.#provider?.keeper.read(context).views };
  }

  /** Its first View, which the URL leaves out. */
  firstView(context: string): string | null {
    return Object.keys(this.viewsOf(context))[0] ?? null;
  }

  /** Open the Context on screen again: a setting its definition reads moved.
   *  Its Query is the tab's, so its filters come back with it. Under Settings,
   *  once Settings closes. TODO 436 */
  async reload(): Promise<void> {
    if (this.#settings.page) this.#reload = true;
    else if (this.#context) await this.#load(this.#context);
  }
  /** A reload asked while Settings was open. */
  #reload = false;

  /** Draw the nav again — after a View is saved or deleted, say. */
  async refreshNav(): Promise<void> {
    await this.#nav?.refresh();
  }

  /** Read app.json, load each Context's Views, then open the route's Context.
   *  The router's `context` defaults to the app's own. */
  async start(options: OutletOptions): Promise<void> {
    if (!checkApp(options.app)) return;
    this.#options = options;
    const router = this.#router;
    if (router) {
      const rest = (router.dataset['params'] ?? '').split(/\s+/).filter((p) => p && p.split('=')[0] !== 'context');
      // A graph View's entity is the URL's too.
      const graphs = Object.keys(options.app.contexts).some((name) => this.#drawsViews(name)) && !rest.includes(GRAPH_CHIP);
      router.dataset['params'] = [`context=${options.app.default}`, ...rest, ...(graphs ? [GRAPH_CHIP] : [])].join(' ');
      this.on(router, 'route-change', this.#onRoute);
    }
    // The page's data out of reach: a banner over the content. TRAP T-a-reach-banner-takes-no-room
    const provider = this.#provider;
    if (provider) {
      this.on(provider, 'reach-change', this.#onReach);
      this.#drawReach(provider.reach);
      this.on(provider, 'view-change', this.#onViewChange);
    }
    const header = this.#header;
    if (header) this.on(header, 'quick-filter-change', this.#onViewPick);
    // A toolbar's Open in Node Editor: the page's Query, in the app's `query` graph View.
    this.on(this.#shell ?? this, 'node-editor-open', this.#onOpenEditor);
    /* Settings' back arrow and ESC are INTENTS: each asks the router, and the
       screen follows its route-change. */
    const settings = options.settings;
    if (settings) {
      if (settings.header) this.on(settings.header, 'back-click', () => void this.#router?.go({ settings: null }));
      this.on(settings.dialog, 'dialog-close', (event) => {
        if (event.target === settings.dialog && this.#settings.page) void this.#router?.go({ settings: null });
      });
    }
    // Without holding the load back: the nav draws again once they land.
    this.#viewsReady = Promise.all(Object.entries(options.app.contexts).map(async ([name, context]) => {
      if (context.views) this.#views[name] = await loadViewLibrary(this.#url(context.views));
    })).then(() => undefined);
    // The presets are the keeper's, so every editor lists them with the reader's own. Its Custom Nodes are its entities of the type `node`.
    if (options.app.entities || options.app.types) {
      const { entities, types } = options.app;
      // Fetched only where an app ships them: an app with none never loads them.
      this.#nodesReady = (async () => {
        const files = await import('../../core/browser/entity-files.js');
        // Its types first: a page's fields and its entities are of them, and each type that names its rows has a store. Plan 960 U2, U3
        if (types) {
          const loaded = await files.loadTypes(Object.fromEntries(Object.entries(types).map(([id, path]) => [id, this.#url(path)])));
          const { typeStores } = await import('../../core/browser/type-stores.js');
          const made = await typeStores(loaded, (path) => this.#url(path));
          this.#typeStores = made.stores;
          await made.ready;
        }
        if (entities) this.#entityPresets = Object.values((await files.loadEntityLibrary(this.#url(entities))).entities);
      })();
    }
    // The nav first, so a first click finds its rows. TRAP T-the-outlet-keeps-the-nav
    const nav = this.#shell?.querySelector(':scope > sherpa-nav');
    if (nav) {
      await customElements.whenDefined('sherpa-nav');
      // The app's settings as the provider tells them; else over the session alone.
      const settings = this.#told ?? new Settings(SETTINGS, options.session);
      this.#nav = new OutletNav(nav as ConstructorParameters<typeof OutletNav>[0], {
        app: options.app, session: options.session, settings, router, header, host: this, signal: this.signal, pinned: this.#pinnedEarly,
      });
      await this.#nav.refresh();
      void this.#viewsReady.then(() => this.#nav?.refresh());
    }
    await this.#load(this.#contextOf(router?.route ?? {}));
    this.#syncSettings(router?.route ?? {});
  }

  /** Its rail is heard from CONNECT, not from start(): an app starts its outlet
   *  late, and a pin pressed meanwhile is the reader's. TRAP T-a-pin-before-start-is-the-readers */
  override connectedCallback(): void {
    super.connectedCallback();
    const nav = this.#shell?.querySelector(':scope > sherpa-nav');
    if (nav) this.on(nav, 'nav-state-change', this.#onEarlyPin);
  }

  /** A pin pressed before start(), and its unpin. A pointer passing a rail never pinned is neither. */
  #onEarlyPin = (event: Event): void => {
    if (this.#nav) return;
    const state = (event as CustomEvent<{ state?: string }>).detail?.state;
    if (state === 'pinned') this.#pinnedEarly = true;
    else if (state === 'collapsed' && this.#pinnedEarly) this.#pinnedEarly = false;
  };

  override onDisconnect(): void {
    this.#leave();
    this.#drop();
    this.#closeSettings();
  }

  /** The app's settings, as its provider last told them. */
  #told: Settings | null = null;

  /** Told the app's settings: the nav reads its own there. */
  protected override onSettings(settings: Settings): void {
    this.#told = settings;
    this.#nav?.told(settings);
  }

  /** The app's entities, handed to every Context: the provider's keeper holds them. Its `library()` is every one as a Custom Node. */
  get #nodes(): { entities: EntityShelf } | Record<string, never> {
    const keeper = this.#provider?.keeper;
    if (!keeper) return {};
    // Told at each hand-over: the app may give its provider another keeper after this one loads.
    keeper.entityPresets = this.#entityPresets;
    return { entities: keeper.entities };
  }

  /** The document's router: the URL has one owner. */
  get #router(): SherpaRouter | null {
    return document.querySelector<SherpaRouter>('sherpa-router');
  }

  /** The provider round it, which answers the Context's components. */
  get #provider(): SherpaProvider | null {
    return this.closest<SherpaProvider>('sherpa-provider');
  }

  override onRender(): void {
    this.$('.reach')?.addEventListener('button-click', this.#onReachAct);
  }

  /** The reach last drawn: a new one shows again what Dismiss hid. */
  #reachNow = 'ok';

  /** Another View is on screen: the header offers Delete view only on the
   *  reader's own — on a graph View, the reader's own entity. TRAP T-a-saved-view-is-the-readers-own */
  #onViewChange = (): void => {
    this.#header?.toggleAttribute('data-custom-view', this.#graph ? this.#graph.origin === 'mine' : !!this.#provider?.customView);
  };

  /** The provider says the page's reach moved. */
  #onReach = (event: Event): void => {
    this.#drawReach((event as CustomEvent<SherpaProvider['reach']>).detail);
  };

  /** Show the banner for the page's reach — warning while the last rows are
   *  shown, critical with nothing to show — and say why. TRAP T-a-reach-banner-takes-no-room */
  #drawReach(reach: SherpaProvider['reach']): void {
    const moved = reach.reach !== this.#reachNow;
    const focused = this.#focusInReach();
    if (moved) this.toggleState('reach-dismissed', false);
    this.#reachNow = reach.reach;
    this.toggleState('reach-unreached', reach.reach === 'unreached');
    this.toggleState('reach-down', reach.reach === 'down');
    const kind = reach.failure?.kind;
    const why = kind === 'offline' || kind === 'timeout' || kind === 'server' ? this.word(kind) : '';
    for (const el of this.$$('.reach-why')) el.textContent = why;
    // The warning is said by a live region always in the tree; the critical one is an alert.
    const say = this.$('.reach-say');
    if (say && moved) say.textContent = reach.reach === 'unreached' ? `${this.word('unreached')} ${why}`.trim() : '';
    if (focused && reach.reach === 'ok') this.#focusAfterReach();
  }

  /** Is focus on the banner's own buttons? */
  #focusInReach(): boolean {
    const active = this.shadowRoot?.activeElement;
    return !!active && !!this.$('.reach')?.contains(active);
  }

  /** The banner went from under focus: it lands just after, at the top of the content. */
  #focusAfterReach(): void {
    this.$<HTMLElement>('.reach-after')?.focus({ preventScroll: true });
  }

  /** Retry asks the provider to try again; Dismiss hides the banner until the reach moves. */
  #onReachAct = (event: Event): void => {
    if (this.pathFind(event, '.retry')) this.#provider?.recheck();
    else if (this.pathFind(event, '.dismiss')) {
      this.toggleState('reach-dismissed', true);
      this.#focusAfterReach();
    }
  };

  /** The app shell it sits in. */
  get #shell(): HTMLElement | null {
    return this.closest<HTMLElement>('sherpa-app-shell');
  }

  /** The shell's own header, not one inside an overlay. */
  get #header(): HTMLElement | null {
    return this.#shell?.querySelector<HTMLElement>(':scope > sherpa-app-header') ?? null;
  }

  /** The route's Context: a name app.json does not hold is its default. */
  #contextOf(route: Route): string {
    const app = this.#options?.app;
    const name = route['context'];
    return name && app?.contexts[name] ? name : (app?.default ?? '');
  }

  /** Another Context loads; a View of this one is picked through its chip. */
  #onRoute = (event: Event): void => {
    const { route, waitUntil } = (event as CustomEvent<RouteChange>).detail;
    this.#syncSettings(route);
    const context = this.#contextOf(route);
    if (context !== this.#context) {
      waitUntil(this.#load(context));
      return;
    }
    this.#syncHeader(context);
    // A row the outlet draws is drawn from the route; another, picked through its chip.
    if (this.#drawsViews(context)) void this.#syncGraph();
    else this.#pickView(route['view'] ?? this.firstView(context));
    this.#nav?.syncCurrent();
    this.#nav?.syncStar();
    // A View picked here is a Recent too. TODO 399
    this.#nav?.viewed();
  };

  /** Make Settings match the URL: the page it names opens over the Context,
   *  which is never reloaded; none closes it. */
  #syncSettings(route: Route): void {
    const name = route['settings'];
    const page = name && this.#options?.app.settings?.pages[name] ? name : null;
    if (page && page !== this.#settings.page) void this.#openSettings(page);
    else if (!page && this.#settings.page) this.#closeSettings();
  }

  /** Open one Settings page over the Context: its markup, the one Settings
   *  module, its settings bound. Shown LAST, so focus can move inside. */
  async #openSettings(name: string): Promise<void> {
    const options = this.#options;
    const where = options?.settings;
    const app = options?.app.settings;
    const page = app?.pages[name];
    if (!options || !where || !app || !page) return;
    const token = ++this.#settings.token;
    this.#dropSettings();
    this.#settings.page = name;
    this.emit('settings-open', { page: name });
    this.#nav?.settingsOpened(name);
    where.header?.setAttribute('data-heading', page.label);
    if (page.icon) where.header?.setAttribute('data-icon', page.icon);
    else where.header?.removeAttribute('data-icon');
    const markup = await this.#file(page.template, 'text');
    if (token !== this.#settings.token) return;
    where.root.innerHTML = String(markup ?? '');
    const module = (await import(this.#url(app.module))) as Partial<ContextModule>;
    if (token !== this.#settings.token) return;
    const leaving = (this.#settings.leaving = new AbortController());
    const teardown = await module.init?.(where.root, {
      session: options.session, ...this.#nodes, view: null, signal: leaving.signal, panels: options.panels ?? {}, label: page.label, id: name,
      ...(where.header ? { header: where.header } : {}),
    });
    if (token !== this.#settings.token) {
      teardown?.();
      return;
    }
    if (typeof teardown === 'function') this.#settings.teardown = teardown;
    bindSettings(where.root, options.session, { signal: leaving.signal });
    where.dialog.show();
  }

  /** Close Settings: back to the Context underneath, which was never unloaded. */
  #closeSettings(): void {
    if (!this.#settings.page) return;
    ++this.#settings.token;
    this.#dropSettings();
    this.#settings.page = null;
    this.#options?.settings?.dialog.hide();
    this.emit('settings-close');
    this.#nav?.settingsClosed();
    if (this.#reload) {
      this.#reload = false;
      void this.reload();
    }
  }

  /** The open Settings page's teardown and signal. */
  #dropSettings(): void {
    const teardown = this.#settings.teardown;
    this.#settings.teardown = null;
    try {
      teardown?.();
    } catch (error) {
      report({
        code: 'context-teardown-failed',
        message: 'sherpa-outlet: a Settings page\'s teardown threw; the next one opens anyway.',
        at: { page: this.#settings.page ?? '', error: error instanceof Error ? error.message : String(error) },
      });
    }
    this.#settings.leaving?.abort();
    this.#settings.leaving = null;
  }

  /** The View chip owns the View, and the graph chip the entity a graph View shows; the URL follows them. */
  #onViewPick = (event: Event): void => {
    const detail = (event as CustomEvent<{ scope?: string; values?: Record<string, string[]> }>).detail;
    if (this.#drawing || (detail?.scope && detail.scope !== 'bar')) return;
    const context = this.#context;
    const id = detail?.values?.[VIEW_CHIP]?.[0];
    if (!context || !id || !this.viewsOf(context)[id]) return;
    const view = id === this.firstView(context) ? null : id;
    // REPLACE: a View pick is not a step Back should undo one by one.
    if (!this.#drawsViews(context)) return void this.#router?.go({ view }, { replace: true });
    const open = this.#graph;
    // Another View opens on its type's first.
    if (open?.view !== id) return void this.#router?.go({ view, [GRAPH_CHIP]: null }, { replace: true });
    const graph = detail?.values?.[GRAPH_CHIP]?.[0];
    if (graph === NEW_GRAPH) void this.#askNew(open);
    else if (graph && graph !== open.id) void this.openGraph(graph);
  };

  /** Does the outlet draw this Context's row: the View chip alone, and the graph chip on a graph View? */
  #drawsViews(name: string): boolean {
    const context = this.#options?.app.contexts[name];
    return context?.chrome?.filters === 'views' && !context.definition;
  }

  /** The graph View on screen, or null. TRAP T-a-graph-is-a-view-of-a-type */
  #graph: OpenGraph | null = null;
  /** Each draw of the graph chips; only the newest commits. */
  #graphToken = 0;
  /** The chips are being drawn: what they report is not a pick. */
  #drawing = false;
  /** The outlet took the bar's actions away, so it gives them back. */
  #hidActions = false;

  /** The open graph, from the route and the entity shelf: the row's chips drawn, the header told,
   *  and the Context told by `graph-change` when it moved. On another Context, none. */
  async #syncGraph(tell = true): Promise<void> {
    const token = ++this.#graphToken;
    const context = this.#context;
    if (!context || !this.#drawsViews(context)) return this.#setGraph(null, tell);
    const route = this.#router?.route ?? {};
    const library = this.viewsOf(context);
    const view = route['view'] && library[route['view']] ? route['view'] : this.firstView(context);
    const type = view ? library[view]?.graph?.type : undefined;
    // A `query` View's graphs are the app's pages; any other's, the entities of its type.
    const pages = type === PAGE_QUERY ? this.#pages() : null;
    const list = type && !pages ? this.#provider?.keeper.entities.list(type) ?? [] : [];
    const entity = pages ? undefined : openOf(list, route[GRAPH_CHIP]);
    const picked = pages ? pages.find((p) => p.id === route[GRAPH_CHIP]) ?? pages[0] : entity;
    const open: OpenGraph | null = view && type ? { view, type, id: picked?.id ?? null, ...(entity ? { origin: entity.origin } : {}) } : null;
    const { entityTypes } = await import('../../core/data/entity-types.js');
    if (token !== this.#graphToken) return;
    const kind = type && !pages ? entityTypes()[type] : undefined;
    if (type && !pages && !kind) report({ code: 'graph-view', message: `sherpa-outlet: the View "${view}" shows graphs of the type "${type}", which this app does not have.`, at: { context, view: view ?? '' } });
    const chips: unknown[] = [{
      id: VIEW_CHIP, label: this.word('view'), persistent: true, active: true, select: 'single',
      options: Object.entries(library).map(([value, v]) => ({ value, label: v.label, ...(value === view ? { selected: true } : {}) })),
    }];
    if (open && pages) {
      chips.push({ id: GRAPH_CHIP, label: this.word('page'), icon: 'filter', persistent: true, active: true, select: 'single', options: pageRows(pages, open.id) });
    } else if (open) {
      const words = { presets: this.word('presets'), mine: this.word('mine'), readOnly: this.word('read-only'), new: this.word('new-graph') };
      chips.push({
        id: GRAPH_CHIP, label: kind?.label ?? open.type, ...(kind?.icon ? { icon: kind.icon } : {}), persistent: true, active: true, select: 'single',
        options: graphRows(list, open.id, words),
      });
    }
    const was = this.#graph;
    // Set BEFORE the draw: what the new chips report is what is open.
    this.#graph = open;
    this.#drawing = true;
    try {
      await this.#header?.querySelector<ViewBar>(VIEW_BAR)?.populate(chips);
    } finally {
      this.#drawing = false;
    }
    if (token !== this.#graphToken) return;
    // A page's graph: its data opened BEFORE the Context is told, which binds to it.
    await this.#openPage(open?.type === PAGE_QUERY ? open.id : null);
    if (token === this.#graphToken) this.#setGraph(open, tell, was);
  }

  /** The app's pages a `query` graph View offers. */
  #pages(): ReturnType<typeof pagesOf> {
    return pagesOf(this.#options?.app.contexts ?? {});
  }

  /** The page a `query` graph View has open, for its Query alone. */
  #page: OpenPage | null = null;
  /** The page asked for last, open or opening. */
  #pageWanted: string | null = null;
  /** Each page opening; only the newest commits. */
  #pageToken = 0;

  /** Open a page for its Query alone, as its own Context opens it — its definition, under its own key, on
   *  the View it was left on — or close the one open. TRAP T-a-graph-is-a-view-of-a-type */
  async #openPage(id: string | null): Promise<void> {
    if (id === this.#pageWanted) return;
    const was = this.#pageWanted;
    this.#pageWanted = id;
    const token = ++this.#pageToken;
    const options = this.#options;
    const context = id ? options?.app.contexts[id] : undefined;
    const provider = this.#provider;
    this.#page = null;
    if (was) provider?.close();
    if (!id || !options || !context?.definition || !provider) return;
    const [read, template, files] = await Promise.all([
      this.#file(context.definition, 'json') as Promise<PageDefinition | null>, this.#file(context.template, 'text'),
      import('../../core/ui/page-components.js'),
    ]);
    if (token !== this.#pageToken || !read) return;
    const definition = options.definition ? options.definition(id, structuredClone(read)) : read;
    const views = this.#views[id] ?? {};
    const kept = provider.keeper.read(id).view;
    const view = kept && this.viewsOf(id)[kept] ? kept : undefined;
    await options.ready;
    const stores = this.#stores(options);
    const source = await provider.open(definition, { key: id, stores, views, ...(view ? { view } : {}), bars: false });
    // Another asked meanwhile: a page opens over this one, and none closes it.
    if (token !== this.#pageToken && !this.#pageWanted && source) provider.close();
    if (token !== this.#pageToken || !source) return;
    const content = view ? this.viewsOf(id)[view]?.content : undefined;
    const markup = files.pageMarkup(String(template ?? ''), typeof content === 'string' ? content : undefined);
    const shown = view && view !== this.firstView(id) ? view : null;
    this.#page = {
      id, label: context.label, definition, source, markup, stores: Object.keys(stores),
      components: files.pageComponents(markup, definition),
      href: this.#router?.href({ ...this.#router.route, context: id, view: shown, [GRAPH_CHIP]: null, settings: null }) ?? `?context=${id}`,
    };
  }

  /** Open in Node Editor, from a page's toolbar: the app's `query` graph View, on this page. A push, so Back
   *  comes back. An app with no such View is not answered. TRAP T-a-graph-is-a-view-of-a-type */
  #onOpenEditor = async (): Promise<void> => {
    const page = this.#context;
    if (!page || !this.#options?.app.contexts[page]?.definition) return;
    await this.#viewsReady;
    for (const [context, views] of Object.entries(this.#views)) {
      const view = Object.keys(views).find((id) => views[id]?.graph?.type === PAGE_QUERY);
      if (!view) continue;
      const first = this.#pages()[0]?.id;
      await this.#router?.go({ context, view: view === this.firstView(context) ? null : view, [GRAPH_CHIP]: page === first ? null : page });
      return;
    }
  };

  /** The header follows the open graph — its words, Save off on a preset — and the Context is told when it moved. */
  #setGraph(open: OpenGraph | null, tell: boolean, was: OpenGraph | null = this.#graph): void {
    this.#graph = open;
    const header = this.#header;
    const query = open?.type === PAGE_QUERY;
    header?.toggleAttribute('data-graph', !!open);
    header?.toggleAttribute('data-readonly', open?.origin === 'preset');
    // A page's Query: its edits are the page's own, so the View's actions go.
    header?.toggleAttribute('data-query', query);
    if (open || was) this.#onViewChange();
    const key = (g: OpenGraph | null): string => (g ? `${g.view}/${g.type}/${g.id ?? ''}` : '');
    if (tell && key(was) !== key(open)) this.emit('graph-change', { graph: open, ...(query && this.#page ? { page: this.#page } : {}) });
  }

  /** New graph… was picked: the chip shows the open one again, and the app may take the ask over —
   *  to ask a name. Not taken, an empty one of the type is made and opened. */
  async #askNew(open: OpenGraph): Promise<void> {
    this.#header?.querySelector<ViewBar>(VIEW_BAR)?.setChipValues(GRAPH_CHIP, open.id ? [open.id] : []);
    if (!this.emit('graph-new', { type: open.type }, { cancelable: true })) return;
    const shelf = this.#provider?.keeper.entities;
    const { entityTypes } = await import('../../core/data/entity-types.js');
    const type = entityTypes()[open.type];
    const id = shelf && type ? await newGraph(shelf, type) : undefined;
    if (id) await this.openGraph(id);
  }

  /** The stores a page may name: each app.json type's, then the app's own, which wins by name. */
  #stores(options: OutletOptions): Record<string, Store> {
    return { ...this.#typeStores, ...options.stores() };
  }

  /** Load one Context: its markup, its data, its module — each step given up
   *  when a newer load starts. */
  async #load(name: string): Promise<void> {
    const options = this.#options;
    const context = options?.app.contexts[name];
    if (!options || !context) return;
    const token = ++this.#token;
    // Read BEFORE init: populating the header reports its first View, and the URL follows.
    const view = this.#router?.route['view'] ?? null;
    this.#leave({ next: true });
    this.#context = name;
    this.emit('context-change', { context: name, view });
    this.#nav?.changed();
    await Promise.all([this.#viewsReady, this.#nodesReady]);
    const [markup, read] = await Promise.all([
      this.#file(context.template, 'text'),
      context.definition ? this.#file(context.definition, 'json') as Promise<PageDefinition | null> : null,
    ]);
    const definition = read && options.definition ? options.definition(name, structuredClone(read)) : read;
    if (token !== this.#token) return;
    this.#syncHeader(name);
    this.#shell?.toggleAttribute('data-no-header', context.chrome?.header === false);
    // Its filter mode BEFORE it paints. TRAP T-the-filter-mode-is-set-before-the-page-paints
    this.#provider?.prepare(definition);
    this.#drop();
    this.innerHTML = String(markup ?? '');
    this.#lift();
    this.toggleState('drawn', true);
    const waits: Promise<unknown>[] = [];
    this.emit('context-markup', { context: name, root: this, waitUntil: (work: Promise<unknown>) => void waits.push(work) });
    await Promise.all(waits);
    const module = context.module ? (await import(this.#url(context.module))) as Partial<ContextModule> : null;
    await options.ready;
    if (token !== this.#token) return;
    // The keeper has the app's entities BEFORE the page opens: its Preset Filters are its presets. TODO 776
    const shelves = this.#nodes;
    const source: DataSource | undefined = definition && this.#provider ? await this.#provider.open(definition, {
      // ONE key: its state is kept and read under the Context's name. TODO 321
      key: name, stores: this.#stores(options), views: this.#views[name] ?? {}, ...(view ? { view } : {}),
    }) : undefined;
    if (token !== this.#token) return;
    // Its row, drawn from the route, before its module runs: init is handed the graph it opens on.
    await this.#syncGraph(false);
    if (token !== this.#token) return;
    const leaving = (this.#leaving = new AbortController());
    if (this.#graph) this.#provider?.keeper.entities.watch(() => void this.#syncGraph(), leaving.signal);
    const header = this.#header;
    const page = this.#graph?.type === PAGE_QUERY ? this.#page : null;
    const ctx: ContextInit = {
      session: options.session, ...shelves, view, signal: leaving.signal, panels: options.panels ?? {}, label: context.label, id: name,
      ...(source ? { source, query: source.query } : {}), ...(header ? { header } : {}), ...(this.#graph ? { graph: { ...this.#graph } } : {}),
      ...(page ? { page, source: page.source, query: page.source.query } : {}),
    };
    const teardown = await module?.init?.(this, ctx);
    // A newer load has begun: this one's own teardown runs now.
    if (token !== this.#token) {
      teardown?.();
      return;
    }
    if (typeof teardown === 'function') this.#teardown = teardown;
    bindSettings(this, options.session, { signal: leaving.signal });
    if (view && !this.#drawsViews(name)) this.#pickView(view);
    this.emit('context-load', { context: name, view });
    this.#nav?.loaded();
  }

  /** Tear the Context on screen down: its own teardown, its signal, its page. */
  /** `next`: another Context follows at once. */
  #leave(options: { next?: boolean } = {}): void {
    const teardown = this.#teardown;
    this.#teardown = null;
    try {
      teardown?.();
    } catch (error) {
      report({
        code: 'context-teardown-failed',
        message: 'sherpa-outlet: a Context\'s teardown threw; the next one loads anyway.',
        at: { context: this.#context ?? '', error: error instanceof Error ? error.message : String(error) },
      });
    }
    this.#leaving?.abort();
    this.#leaving = null;
    // A page opened for its Query alone goes with it.
    this.#page = null;
    this.#pageWanted = null;
    ++this.#pageToken;
    this.#provider?.close(options);
  }

  /** A Context's `slot="context-header"` element goes up into the shell's fixed
   *  region. TRAP T-a-context-has-a-fixed-region */
  #lift(): void {
    this.#lifted = [...this.querySelectorAll(':scope > [slot="context-header"]')];
    this.#shell?.append(...this.#lifted);
  }

  /** The lifted region leaves the shell. */
  #drop(): void {
    for (const lifted of this.#lifted) lifted.remove();
    this.#lifted = [];
  }

  /** The header says the Context's own row: its name and its icon. */
  #syncHeader(name: string): void {
    const header = this.#header;
    const context = this.#options?.app.contexts[name];
    if (!header || !context) return;
    header.setAttribute('data-heading', context.label);
    // A page that holds its own filters takes the header's row away. TODO 425
    header.toggleAttribute('data-no-filters', context.chrome?.filters === false);
    // Only the View chip there: the bar's own actions are a page's filters'. TRAP T-a-graph-is-a-view-of-a-type
    const views = this.#drawsViews(name);
    const bar = header.querySelector(VIEW_BAR);
    if (bar && (views || this.#hidActions)) bar.toggleAttribute('data-no-actions', views);
    this.#hidActions = views;
    // No icon on the row → none on the header: a stale glyph is worse than none.
    if (context.icon) header.setAttribute('data-icon', context.icon);
    else header.removeAttribute('data-icon');
  }

  /** Pick a View through the header's chip, so the chip stays its one owner. */
  #pickView(id: string | null): void {
    const bar = this.#header?.querySelector<ViewBar>(VIEW_BAR);
    const context = this.#context;
    if (!bar || !context || !id || !this.viewsOf(context)[id] || bar.values?.[VIEW_CHIP]?.[0] === id) return;
    bar.setChipValues(VIEW_CHIP, [id]);
    bar.report();
  }

  /** A path in app.json, as a URL. */
  #url(path: string): string {
    return new URL(path, this.#options?.base ?? location.href).href;
  }

  /** One of the Context's files, or null — reported — when it cannot be read. */
  async #file(path: string, as: 'text' | 'json'): Promise<unknown> {
    try {
      const response = await fetch(this.#url(path));
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return as === 'json' ? await response.json() : await response.text();
    } catch (error) {
      report({
        code: 'context-file-unread',
        message: `sherpa-outlet: "${path}" could not be read, so the Context goes without it.`,
        at: { context: this.#context ?? '', path, error: error instanceof Error ? error.message : String(error) },
      });
      return null;
    }
  }
}

define('sherpa-outlet', SherpaOutlet);
