/**
 * outlet-nav.ts — the nav an outlet keeps: its rows from app.json, the Recent
 * and Favorites Areas, the ★, a Context's Views as rows, the lit row and the pin.
 * TRAP T-the-outlet-keeps-the-nav
 * TRAP T-a-rail-may-stay-shut
 *
 * Map:
 * - NavHost — what the nav asks of its outlet: the Context, the Settings page, the Views
 * - OutletNav — The nav an outlet keeps, from app.json and the session's two lists.
 * - .told — The app's settings, told again: the nav reads its three there.
 * - .refresh — Re-stamp every Area's children; the one holding the page opens.
 * - .syncCurrent — The lit row: the Context's, or its View's with the hierarchy on.
 * - .syncStar — The ★ says whether the View on screen is a favourite.
 * - .changed — A Context begins to load: its row lights, and a pinned rail stays pinned.
 * - .loaded — A Context has loaded: its View enters Recents — Home's never does.
 * - .viewed — A View is on screen: it enters Recents, newest first.
 * - .settingsOpened — Settings opened over the Context: the rail shows the Settings rows.
 * - .settingsClosed — Settings closed: back to the Context's row, and the rail as it was.
 */
import type { AppDefinition } from '../../core/data/app-definition.js';
import type { Settings } from '../../core/data/settings.js';
import type { SessionList, SessionStore } from '../../core/browser/session.js';
import type { SherpaRouter } from '../sherpa-router/sherpa-router.js';
import type { NavConfig, NavEntry, NavState, QuickEntry } from '../sherpa-nav/sherpa-nav.js';

/** What the nav asks of its outlet: the Context, the Settings page, the Views. */
export interface NavHost {
  readonly context: string | null;
  readonly settingsPage: string | null;
  viewsOf(context: string): Record<string, { label: string }>;
  firstView(context: string): string | null;
}

type Nav = HTMLElement & { populate(config: NavConfig): Promise<void> | void; state: NavState };

/** A stored Favourite or Recent: one View of a Context, keyed `context` for its first. */
interface Kept { context: string; label: string; key?: string; view?: string }

const isKeptList = (value: unknown): value is Kept[] => Array.isArray(value)
  && value.every((e) => !!e && typeof e === 'object' && typeof (e as Kept).context === 'string');

/** The nav an outlet keeps, from app.json and the session's two lists. */
export class OutletNav {
  /** The rail it draws. */
  readonly #nav: Nav;
  /** The app, as app.json says it. */
  readonly #app: AppDefinition;
  /** Where the pin and the two lists live. */
  readonly #session: SessionStore;
  /** The app's settings: the hierarchy, Views or Contexts, and hover. */
  #settings: Settings;
  /** Stops hearing the settings told before. */
  #heard: AbortController | null = null;
  /** The URL's one owner. */
  readonly #router: SherpaRouter | null;
  /** The shell's header, whose View chip carries the ★. */
  readonly #header: HTMLElement | null;
  /** The outlet: the Context, the Settings page, the Views. */
  readonly #host: NavHost;
  /** The rows, as populate takes them; the Areas' children are stamped on each refresh. */
  readonly #config: NavConfig;
  /** The reader's starred Views. */
  readonly #favorites: SessionList<Kept>;
  /** The last five Views, newest first. */
  readonly #recents: SessionList<Kept>;
  /** The Settings page the settings button opens: the last one shown. */
  #lastSettings: string | null;

  constructor(nav: Nav, at: {
    app: AppDefinition; session: SessionStore; settings: Settings; router: SherpaRouter | null; header: HTMLElement | null;
    host: NavHost; signal: AbortSignal;
  }) {
    this.#nav = nav;
    this.#app = at.app;
    this.#session = at.session;
    this.#settings = at.settings;
    this.#router = at.router;
    this.#header = at.header;
    this.#host = at.host;
    this.#lastSettings = Object.keys(at.app.settings?.pages ?? {})[0] ?? null;
    /* STORED ROWS, not Contexts: a shape this release cannot read is dropped.
       A favourite is a VIEW, keyed `context:view`. */
    at.session.persist('/nav/favorites', { guard: isKeptList });
    at.session.persist('/nav/recent', { guard: isKeptList });
    /* A row whose Context the app no longer has goes (a Settings page, from
       before Settings was an overlay); a Recent kept by Context is its first
       View's. Home never belongs in Recents. TODO 399 */
    for (const pointer of ['/nav/favorites', '/nav/recent']) {
      const kept = at.session.get(pointer);
      if (!isKeptList(kept)) continue;
      const live = kept.filter((k) => at.app.contexts[k.context] && (pointer === '/nav/favorites' || k.context !== at.app.default))
        .map((k) => ({ ...k, key: k.key ?? k.context }));
      if (JSON.stringify(live) !== JSON.stringify(kept)) at.session.set(pointer, live);
    }
    this.#favorites = at.session.list<Kept>('/nav/favorites', { by: 'key' });
    this.#recents = at.session.list<Kept>('/nav/recent', { by: 'key', max: 5, front: true });
    this.#config = this.#build();

    const stops = [
      this.#favorites.subscribe(() => void this.refresh()),
      this.#recents.subscribe(() => void this.refresh()),
    ];
    this.#hear(at.settings);
    this.#syncHover();
    at.signal.addEventListener('abort', () => {
      for (const stop of stops) stop();
      this.#heard?.abort();
    }, { once: true });
    const { signal } = at;
    nav.addEventListener('nav-state-change', this.#onState, { signal });
    nav.addEventListener('nav-select', this.#onSelect, { signal });
    // The ★ stars the VIEW on screen. TRAP T-the-star-reports-it-does-not-decide
    document.addEventListener('view-favorite', this.#onStar, { signal });
  }

  /** The app's settings, told again: the nav reads its three there. TRAP T-a-setting-is-declared-once */
  told(settings: Settings): void {
    if (settings === this.#settings) return;
    this.#settings = settings;
    this.#hear(settings);
    this.syncCurrent();
    this.syncStar();
    this.#syncHover();
    void this.refresh();
  }

  /** Each move of the nav's three settings, heard. */
  #hear(settings: Settings): void {
    this.#heard?.abort();
    this.#heard = new AbortController();
    settings.addEventListener('change', (event) => {
      const { key } = (event as CustomEvent<{ key: string }>).detail;
      if (key === 'navHierarchy') {
        this.syncCurrent();
        void this.refresh();
      } else if (key === 'navViews') {
        this.syncStar();
        void this.refresh();
      } else if (key === 'navHover') this.#syncHover();
    }, { signal: this.#heard.signal });
  }

  /** Is the hierarchy on: a Context's Views its child rows? */
  #hierarchy(): boolean {
    return this.#settings.get('navHierarchy') === true;
  }

  /** Re-stamp every Area's children. The one holding the page opens; the nav
   *  keeps the reader's own open Areas (TODO 116). */
  refresh(): Promise<void> | void {
    const here = this.#rowFor(this.#context())?.id;
    const hierarchy = this.#hierarchy();
    for (const row of this.#rows()) {
      const list = row.id === 'recent' ? this.#recents : row.id === 'favorites' ? this.#favorites : null;
      const context = this.#contextOf(row.href);
      const children = list ? this.#children(row.id, list.all)
        : hierarchy && context ? this.#viewRows(row, context) : [];
      // A parent with no children is a plain row, not an empty expander.
      if (children.length) {
        row.children = children;
        row.expanded = row.id === here;
      } else {
        delete row.children;
        delete row.expanded;
      }
    }
    return this.#nav.populate(this.#config);
  }

  /** The lit row. With the hierarchy on it is the View's own row. */
  syncCurrent(): void {
    const route = this.#router?.route ?? {};
    const settings = this.#settingsPage(route['settings'] ?? null);
    const name = settings ?? this.#context();
    const row = settings ? this.#rows().find((r) => this.#settingsOf(r.href) === settings) : this.#rowFor(name);
    const id = row?.id ?? `context-${name}`;
    const view = settings ? null : route['view'] ?? this.#host.firstView(name);
    this.#nav.dataset['currentId'] = row && view && this.#hierarchy() ? `${id}:${view}` : id;
  }

  /** The header's ★ says whether the View on screen is a favourite — or,
   *  listing Contexts, whether any View of its Context is. */
  syncStar(): void {
    const context = this.#context();
    const on = this.#byView()
      ? this.#favorites.has({ context, label: '', key: this.#favKey(context, this.#view()) })
      : this.#favorites.all.some((k) => k.context === context);
    this.#header?.toggleAttribute('data-favourite', on);
  }

  /** A Context begins to load: its row lights, and a pinned rail stays pinned. */
  changed(): void {
    this.syncCurrent();
    if (!this.#host.settingsPage) this.#nav.state = this.#session.get('/nav/pinned') === true ? 'pinned' : 'collapsed';
  }

  /** A Context has loaded: its View enters Recents — Home's never does — and the ★ follows. */
  loaded(): void {
    // Its Views are known only now: with the hierarchy on, the lit row is its View's.
    this.syncCurrent();
    this.viewed();
    this.syncStar();
  }

  /** A View is on screen: it enters Recents, newest first, named after itself. TODO 399 */
  viewed(): void {
    const context = this.#context();
    if (context === this.#app.default || this.#host.settingsPage) return;
    const view = this.#view();
    const key = this.#favKey(context, view);
    const kept = { context, key, ...(key === context ? {} : { view: view! }) };
    this.#recents.add({ ...kept, label: this.#viewLabel({ ...kept, label: this.#kept(context).label }) });
  }

  /** Settings opened over the Context: the rail shows the Settings rows. */
  settingsOpened(page: string): void {
    this.#lastSettings = page;
    this.#nav.state = 'settings';
    this.syncCurrent();
  }

  /** Settings closed: back to the Context's row, and the rail as it was. */
  settingsClosed(): void {
    this.syncCurrent();
    // Left by the settings button, the rail has moved already; by anything else, move it.
    if (this.#nav.state === 'settings') this.#nav.state = this.#session.get('/nav/pinned') === true ? 'pinned' : 'collapsed';
  }

  /** "Expand navigation on hover": on unless the session says off. */
  #syncHover(): void {
    this.#nav.toggleAttribute('data-no-hover', this.#settings.get('navHover') === false);
  }

  /** The rows app.json gives: Home is the default Context, Recent and Favorites
   *  are Areas, and the settings button's rows are the Settings pages. */
  #build(): NavConfig {
    const app = this.#app;
    const row = (id: string, name: string): NavEntry => {
      const { label, icon } = app.contexts[name]!;
      return { id, label, ...(icon ? { icon } : {}), href: `?context=${name}` };
    };
    return {
      ...(app.product ? { product: app.product } : {}),
      quickItems: [
        row('home', app.default),
        // The nav's own Recent and Favorites rows: their words are its markup's.
        { id: 'recent' }, { id: 'favorites' },
      ],
      sections: (app.sections ?? []).map(({ label, contexts }) => ({
        ...(label ? { label } : {}), items: contexts.map((name) => row(`context-${name}`, name)),
      })),
      settingsSections: [{
        items: Object.entries(app.settings?.pages ?? {}).map(([name, { label, icon }]) => (
          { id: `settings-${name}`, label, ...(icon ? { icon } : {}), href: `?settings=${name}` })),
      }],
    };
  }

  /** Every configured row — not their children: a Favorites copy of Records must not out-rank the real row. */
  #rows(): QuickEntry[] {
    const config = this.#config;
    return [
      ...(config.quickItems ?? []),
      ...[...(config.sections ?? []), ...(config.settingsSections ?? [])].flatMap((s) => s.items),
    ];
  }

  /** A Context's own row, read from the HREF, so Home routes too. */
  #rowFor(context: string): QuickEntry | undefined {
    return this.#rows().find((r) => this.#contextOf(r.href) === context);
  }

  /** The Context a row's href opens, or null. */
  #contextOf(href: string | undefined): string | null {
    const name = href ? new URL(href, location.href).searchParams.get('context') : null;
    return name && this.#app.contexts[name] ? name : null;
  }

  /** The Settings page a row's href opens, or null. */
  #settingsOf(href: string | undefined): string | null {
    return this.#settingsPage(href ? new URL(href, location.href).searchParams.get('settings') : null);
  }

  /** A Settings page app.json holds, or null. */
  #settingsPage(name: string | null): string | null {
    return name && this.#app.settings?.pages[name] ? name : null;
  }

  /** The Context on screen, as the URL says it. */
  #context(): string {
    const name = this.#router?.route['context'] ?? null;
    return name && this.#app.contexts[name] ? name : this.#app.default;
  }

  /** The View the URL names. */
  #view(): string | null {
    return this.#router?.route['view'] ?? null;
  }

  /** A whole route as a row's href, so a middle-click opens the same place. */
  #href(context: string, view: string | null): string {
    return this.#router ? new URL(this.#router.href({ context, view, settings: null })).search : `?context=${context}`;
  }

  /** Do Recents and Favorites name Views (the default), or Contexts? TODO 399 */
  #byView(): boolean {
    return this.#settings.get('navViews') !== false;
  }

  /** Stored rows as an Area's children: each View, or — listing Contexts — each
   *  Context once, under its own name. Its id is the Area's and its own, never the
   *  Context row's. No icon: TRAP T-nav-child-rows-carry-no-icon */
  #children(area: string, stored: readonly Kept[]): NavEntry[] {
    if (!this.#byView()) {
      const seen = new Set<string>();
      return stored.filter((k) => !seen.has(k.context) && seen.add(k.context)).map((k) => (
        { id: `${area}:${k.context}`, label: this.#kept(k.context).label, href: this.#href(k.context, null) }));
    }
    const all = stored;
    const labels = all.map((kept) => this.#viewLabel(kept));
    return all.map((kept, i) => {
      const label = labels[i] ?? kept.label;
      // Two of one name: each says its Context, so they read apart.
      const shared = labels.indexOf(label) !== labels.lastIndexOf(label);
      return {
        id: `${area}:${kept.key ?? kept.context}`,
        label: shared ? `${this.#app.contexts[kept.context]?.label ?? kept.context} › ${label}` : label,
        href: this.#href(kept.context, kept.view ?? null),
      };
    });
  }

  /** A favourite or a Recent is a VIEW, so it is named after the View — its first
   *  View's too ("All customers", not "Records") — read when drawn, so one kept
   *  before reads right. A View gone since keeps the name it was kept with. Will, TODOs 357 and 399 */
  #viewLabel(kept: Kept): string {
    const view = kept.view ?? this.#host.firstView(kept.context);
    return (view && this.#host.viewsOf(kept.context)[view]?.label) || kept.label;
  }

  /** A Context's Views as its child rows, each naming its View. */
  #viewRows(row: { id: string }, context: string): NavEntry[] {
    return Object.entries(this.#host.viewsOf(context)).map(([id, view]) => (
      { id: `${row.id}:${id}`, label: view.label, href: this.#href(context, id) }));
  }

  /** What a Recent remembers of a Context. The label is copied, so it still reads if app.json drops it. */
  #kept(context: string): Kept {
    return { context, label: this.#app.contexts[context]?.label ?? context };
  }

  /** A View's favourite key: the Context alone for its first View. */
  #favKey(context: string, view: string | null): string {
    return view && view !== this.#host.firstView(context) ? `${context}:${view}` : context;
  }

  /** The ★: star or unstar the View on screen — or, listing Contexts, its Context. */
  #onStar = (): void => {
    const context = this.#context();
    const view = this.#view();
    const kept = this.#kept(context);
    if (!this.#byView()) {
      const mine = this.#favorites.all.filter((k) => k.context === context);
      if (mine.length) for (const k of mine) this.#favorites.remove(k);
      else this.#favorites.add({ ...kept, key: context });
      this.syncStar();
      return;
    }
    const key = this.#favKey(context, view);
    this.#favorites.toggle(key === context ? { ...kept, key }
      : { ...kept, key, ...(view ? { view } : {}), label: `${kept.label} › ${this.#host.viewsOf(context)[view ?? '']?.label ?? view}` });
    this.syncStar();
  };

  /** The rail reports its mode: the pin is remembered, and the settings button is an INTENT. */
  #onState = (event: Event): void => {
    const state = (event as CustomEvent<{ state?: NavState }>).detail?.state;
    if (state === 'pinned') this.#session.set('/nav/pinned', true);
    else if (state === 'collapsed') this.#session.set('/nav/pinned', false);
    if (state === 'settings' && !this.#host.settingsPage) void this.#router?.go({ settings: this.#lastSettings });
    else if (state !== 'settings' && this.#host.settingsPage) void this.#router?.go({ settings: null });
  };

  /** An Area opens no Context, so its own row names the header. */
  #onSelect = (event: Event): void => {
    const header = this.#header;
    if (!header || this.#nav.state === 'settings') return;
    const detail = (event as CustomEvent<{ href?: string; label?: string; icon?: string }>).detail ?? {};
    // A Context row's header is the outlet's to write.
    if (this.#contextOf(detail.href)) return;
    header.setAttribute('data-heading', detail.label ?? '');
    if (detail.icon) header.setAttribute('data-icon', detail.icon);
    else header.removeAttribute('data-icon');
  };
}
