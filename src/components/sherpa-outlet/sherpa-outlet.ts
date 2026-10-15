/**
 * sherpa-outlet — where the route's Context is drawn: on each route change it
 * loads the Context app.json names, runs it, and tears the last one down.
 * TRAP T-an-outlet-loads-the-context
 *
 * Map:
 * - OutletOptions — what an app hands its outlet: app.json, where it lives, the session and the stores
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { bindSettings } from '../../core/ui/bind-settings.js';
import { checkApp, type AppDefinition, type ContextInit, type ContextModule } from '../../core/data/app-definition.js';
import { report } from '../../core/data/report.js';
import { loadViewLibrary } from '../../core/browser/view-files.js';
import { viewLibrary, type ViewLibrary } from '../../core/browser/persist-view.js';
import { VIEW_CHIP } from '../../core/ui/shared-constants.js';
import type { SessionStore } from '../../core/browser/session.js';
import type { DraftMode } from '../../core/browser/view-drafts.js';
import type { PageDefinition } from '../../core/data/page-definition.js';
import type { DataSource } from '../../core/data/data-source.js';
import type { Store } from '../../core/data/store.js';
import type { Route } from '../../core/browser/route.js';
import type { RouteChange, SherpaRouter } from '../sherpa-router/sherpa-router.js';
import type { SherpaProvider } from '../sherpa-provider/sherpa-provider.js';
import { OutletNav } from './outlet-nav.js';

/** What an app hands its outlet: app.json, where it lives, the session and the stores. */
export interface OutletOptions {
  /** The app, as app.json says it. */
  app: AppDefinition;
  /** Where app.json is: every path in it is relative to this. */
  base: string | URL;
  session: SessionStore;
  /** The app's stores by name, asked at each load: a debug switch may swap one. */
  stores(): Record<string, Store>;
  /** Settles before a Context opens its data: its stores are seeded. */
  ready?: Promise<unknown>;
  /** A View's drafts, asked at each write. None: no drafts. */
  drafts?(): DraftMode;
  /** The app's panels by id, handed to every Context. */
  panels?: Readonly<Record<string, HTMLElement | undefined>>;
  /** Where a Settings page opens, OVER the Context: the overlay dialog, its
   *  header, and the box the page goes in. */
  settings?: { dialog: HTMLElement & { show(): void; hide(): void }; header?: HTMLElement; root: HTMLElement };
}

/** The header's View chip. */
type ViewBar = HTMLElement & {
  values?: Record<string, string[] | undefined>;
  setChipValues(id: string, values: string[]): void;
  report(): void;
};

export class SherpaOutlet extends SherpaElement {
  static override css = new URL('./sherpa-outlet.css', import.meta.url);
  static override html = new URL('./sherpa-outlet.html', import.meta.url);

  /** What `start()` was given. */
  #options: OutletOptions | null = null;
  /** Each Context's own Views, once loaded. */
  #views: Record<string, ViewLibrary> = {};
  /** Settles once every Context's own Views are in. */
  #viewsReady: Promise<void> = Promise.resolve();
  /** Only the newest load may commit. */
  #token = 0;
  /** The Context on screen. */
  #context: string | null = null;
  /** Aborts the Context's `ctx.signal`. */
  #leaving: AbortController | null = null;
  /** What the Context's init handed back. */
  #teardown: (() => void) | null = null;
  /** The nav it keeps, when its shell has one. */
  #nav: OutletNav | null = null;
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

  /** Settles once every Context's own Views are in. */
  get viewsReady(): Promise<void> {
    return this.#viewsReady;
  }

  /** A Context's Views: its own, then the reader's saved ones. */
  viewsOf(context: string): ViewLibrary {
    return viewLibrary(context, this.#views[context]);
  }

  /** Its first View, which the URL leaves out. */
  firstView(context: string): string | null {
    return Object.keys(this.viewsOf(context))[0] ?? null;
  }

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
      router.dataset['params'] = [`context=${options.app.default}`, ...rest].join(' ');
      this.on(router, 'route-change', this.#onRoute);
    }
    const header = this.#header;
    if (header) this.on(header, 'quick-filter-change', this.#onViewPick);
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
    // The nav first, so a first click finds its rows. TRAP T-the-outlet-keeps-the-nav
    const nav = this.#shell?.querySelector(':scope > sherpa-nav');
    if (nav) {
      await customElements.whenDefined('sherpa-nav');
      this.#nav = new OutletNav(nav as ConstructorParameters<typeof OutletNav>[0], {
        app: options.app, session: options.session, router, header, host: this, signal: this.signal,
      });
      await this.#nav.refresh();
      void this.#viewsReady.then(() => this.#nav?.refresh());
    }
    await this.#load(this.#contextOf(router?.route ?? {}));
    this.#syncSettings(router?.route ?? {});
  }

  override onDisconnect(): void {
    this.#leave();
    this.#closeSettings();
  }

  /** The document's router: the URL has one owner. */
  get #router(): SherpaRouter | null {
    return document.querySelector<SherpaRouter>('sherpa-router');
  }

  /** The provider round it, which answers the Context's components. */
  get #provider(): SherpaProvider | null {
    return this.closest<SherpaProvider>('sherpa-provider');
  }

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
    this.#pickView(route['view'] ?? this.firstView(context));
    this.#nav?.syncCurrent();
    this.#nav?.syncStar();
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
      session: options.session, view: null, signal: leaving.signal, panels: options.panels ?? {}, label: page.label, id: name,
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

  /** The View chip owns the View; the URL follows it. */
  #onViewPick = (event: Event): void => {
    const detail = (event as CustomEvent<{ scope?: string; values?: Record<string, string[]> }>).detail;
    if (detail?.scope && detail.scope !== 'bar') return;
    const context = this.#context;
    const id = detail?.values?.[VIEW_CHIP]?.[0];
    if (!context || !id || !this.viewsOf(context)[id]) return;
    // REPLACE: a View pick is not a step Back should undo one by one.
    void this.#router?.go({ view: id === this.firstView(context) ? null : id }, { replace: true });
  };

  /** Load one Context: its markup, its data, its module — each step given up
   *  when a newer load starts. */
  async #load(name: string): Promise<void> {
    const options = this.#options;
    const context = options?.app.contexts[name];
    if (!options || !context) return;
    const token = ++this.#token;
    // Read BEFORE init: populating the header reports its first View, and the URL follows.
    const view = this.#router?.route['view'] ?? null;
    this.#leave();
    this.#context = name;
    this.emit('context-change', { context: name, view });
    this.#nav?.changed();
    await this.#viewsReady;
    const markup = await this.#file(context.template, 'text');
    if (token !== this.#token) return;
    this.#syncHeader(name);
    this.#shell?.toggleAttribute('data-no-header', context.chrome?.header === false);
    this.innerHTML = String(markup ?? '');
    const waits: Promise<unknown>[] = [];
    this.emit('context-markup', { context: name, root: this, waitUntil: (work: Promise<unknown>) => void waits.push(work) });
    await Promise.all(waits);
    const module = context.module ? (await import(this.#url(context.module))) as Partial<ContextModule> : null;
    const definition = context.definition ? await this.#file(context.definition, 'json') as PageDefinition | null : null;
    await options.ready;
    if (token !== this.#token) return;
    const source: DataSource | undefined = definition && this.#provider ? await this.#provider.open(definition, {
      stores: options.stores(), views: this.#views[name] ?? {}, ...(view ? { view } : {}),
      session: options.session, ...(options.drafts ? { drafts: options.drafts } : {}),
    }) : undefined;
    if (token !== this.#token) return;
    const leaving = (this.#leaving = new AbortController());
    const header = this.#header;
    const ctx: ContextInit = {
      session: options.session, view, signal: leaving.signal, panels: options.panels ?? {}, label: context.label, id: name,
      ...(source ? { source } : {}), ...(header ? { header } : {}),
    };
    const teardown = await module?.init?.(this, ctx);
    // A newer load has begun: this one's own teardown runs now.
    if (token !== this.#token) {
      teardown?.();
      return;
    }
    if (typeof teardown === 'function') this.#teardown = teardown;
    bindSettings(this, options.session, { signal: leaving.signal });
    if (view) this.#pickView(view);
    this.emit('context-load', { context: name, view });
    this.#nav?.loaded(name);
  }

  /** Tear the Context on screen down: its own teardown, its signal, its page. */
  #leave(): void {
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
    this.#provider?.close();
  }

  /** The header says the Context's own row: its name and its icon. */
  #syncHeader(name: string): void {
    const header = this.#header;
    const context = this.#options?.app.contexts[name];
    if (!header || !context) return;
    header.setAttribute('data-heading', context.label);
    // No icon on the row → none on the header: a stale glyph is worse than none.
    if (context.icon) header.setAttribute('data-icon', context.icon);
    else header.removeAttribute('data-icon');
  }

  /** Pick a View through the header's chip, so the chip stays its one owner. */
  #pickView(id: string | null): void {
    const bar = this.#header?.querySelector<ViewBar>('sherpa-quick-filter-toolbar[data-type="view"]');
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
