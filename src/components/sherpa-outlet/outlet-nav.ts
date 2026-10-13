/**
 * outlet-nav.ts — the nav an outlet keeps: its rows from app.json, the Recent
 * and Favorites Areas, the ★, a Context's Views as rows, the lit row and the pin.
 * TRAP T-the-outlet-keeps-the-nav
 *
 * Map:
 * - NavHost — what the nav asks of its outlet: the Context, the Settings page, the Views
 * - OutletNav — The nav an outlet keeps, from app.json and the session's two lists.
 * - .refresh — Re-stamp every Area's children, keeping the reader's open Areas.
 * - .syncCurrent — The lit row: the Context's, or its View's with the hierarchy on.
 * - .syncStar — The ★ says whether the View on screen is a favourite.
 * - .changed — A Context begins to load: its row lights, and a pinned rail stays pinned.
 * - .loaded — A Context has loaded: it enters Recents — Home never does.
 * - .settingsOpened — Settings opened over the Context: the rail shows the Settings rows.
 * - .settingsClosed — Settings closed: back to the Context's row, and the rail as it was.
 */
import type { AppDefinition } from '../../core/data/app-definition.js';
import type { SessionList, SessionStore } from '../../core/browser/session.js';
import type { SherpaRouter } from '../sherpa-router/sherpa-router.js';
import type { NavConfig, NavEntry, NavState } from '../sherpa-nav/sherpa-nav.js';

/** What the nav asks of its outlet: the Context, the Settings page, the Views. */
export interface NavHost {
  readonly context: string | null;
  readonly settingsPage: string | null;
  viewsOf(context: string): Record<string, { label: string }>;
  firstView(context: string): string | null;
}

type Nav = HTMLElement & { populate(config: NavConfig): Promise<void> | void; expandedIds?: string[]; state: NavState };

/** A stored Favourite or Recent: one Context — a Favourite, one View of it. */
interface Kept { context: string; label: string; key?: string; view?: string }

const isKeptList = (value: unknown): value is Kept[] => Array.isArray(value)
  && value.every((e) => !!e && typeof e === 'object' && typeof (e as Kept).context === 'string');

/** The nav an outlet keeps, from app.json and the session's two lists. */
export class OutletNav {
  /** The rail it draws. */
  readonly #nav: Nav;
  /** The app, as app.json says it. */
  readonly #app: AppDefinition;
  /** Where the pin, the hierarchy switch and the two lists live. */
  readonly #session: SessionStore;
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
  /** The last five Contexts, newest first. */
  readonly #recents: SessionList<Kept>;
  /** The Settings page the settings button opens: the last one shown. */
  #lastSettings: string | null;

  constructor(nav: Nav, at: {
    app: AppDefinition; session: SessionStore; router: SherpaRouter | null; header: HTMLElement | null;
    host: NavHost; signal: AbortSignal;
  }) {
    this.#nav = nav;
    this.#app = at.app;
    this.#session = at.session;
    this.#router = at.router;
    this.#header = at.header;
    this.#host = at.host;
    this.#lastSettings = Object.keys(at.app.settings?.pages ?? {})[0] ?? null;
    /* STORED ROWS, not Contexts: a shape this release cannot read is dropped.
       A favourite is a VIEW, keyed `context:view`; one stored with no key meant
       the Context, so it is its first View. */
    at.session.persist('/nav/favorites', { guard: isKeptList });
    at.session.persist('/nav/recent', { guard: isKeptList });
    const stored = at.session.get('/nav/favorites');
    if (isKeptList(stored) && stored.some((r) => !r.key)) {
      at.session.set('/nav/favorites', stored.map((r) => ({ ...r, key: r.key ?? r.context })));
    }
    this.#favorites = at.session.list<Kept>('/nav/favorites', { by: 'key' });
    this.#recents = at.session.list<Kept>('/nav/recent', { by: 'context', max: 5, front: true });
    // Home never belongs in Recents.
    this.#recents.remove({ context: at.app.default, label: '' });
    this.#config = this.#build();

    const stops = [
      this.#favorites.subscribe(() => void this.refresh()),
      this.#recents.subscribe(() => void this.refresh()),
      at.session.subscribe('/nav/hierarchy', () => { this.syncCurrent(); void this.refresh(); }),
    ];
    at.signal.addEventListener('abort', () => { for (const stop of stops) stop(); }, { once: true });
    const { signal } = at;
    nav.addEventListener('nav-state-change', this.#onState, { signal });
    nav.addEventListener('nav-select', this.#onSelect, { signal });
    // The ★ stars the VIEW on screen. TRAP T-the-star-reports-it-does-not-decide
    document.addEventListener('view-favorite', this.#onStar, { signal });
  }

  /** Re-stamp every Area's children. A populate rebuilds every row, so the
   *  reader's open Areas are read back first; the one holding the page is open. */
  refresh(): Promise<void> | void {
    const open = new Set(this.#nav.expandedIds ?? []);
    const here = this.#rowFor(this.#context())?.id;
    const hierarchy = this.#session.get('/nav/hierarchy') === true;
    for (const row of this.#rows()) {
      const list = row.id === 'recent' ? this.#recents : row.id === 'favorites' ? this.#favorites : null;
      const context = this.#contextOf(row.href);
      const children = list ? list.all.map((kept) => this.#child(row.id, kept))
        : hierarchy && context ? this.#viewRows(row, context) : [];
      // A parent with no children is a plain row, not an empty expander.
      if (children.length) {
        row.children = children;
        row.expanded = open.has(row.id) || row.id === here;
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
    this.#nav.dataset['currentId'] = row && view && this.#session.get('/nav/hierarchy') === true ? `${id}:${view}` : id;
  }

  /** The ★ says whether the View on screen is a favourite. */
  syncStar(): void {
    const bar = this.#header?.querySelector('sherpa-quick-filter-toolbar[data-type="view"]');
    const context = this.#context();
    bar?.toggleAttribute('data-favourite', this.#favorites.has({ context, label: '', key: this.#favKey(context, this.#view()) }));
  }

  /** A Context begins to load: its row lights, and a pinned rail stays pinned. */
  changed(): void {
    this.syncCurrent();
    if (!this.#host.settingsPage) this.#nav.state = this.#session.get('/nav/pinned') === true ? 'pinned' : 'collapsed';
  }

  /** A Context has loaded: it enters Recents — Home never does — and the ★ follows. */
  loaded(context: string): void {
    if (context !== this.#app.default) this.#recents.add(this.#kept(context));
    this.syncStar();
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
        { id: 'recent', label: 'Recent', icon: 'ccw-circle-arrow-w-clock' },
        { id: 'favorites', label: 'Favorites', icon: 'star' },
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
  #rows(): NavEntry[] {
    const config = this.#config;
    return [
      ...(config.quickItems ?? []),
      ...[...(config.sections ?? []), ...(config.settingsSections ?? [])].flatMap((s) => s.items),
    ];
  }

  /** A Context's own row, read from the HREF, so Home routes too. */
  #rowFor(context: string): NavEntry | undefined {
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

  /** A stored row as an Area's child. Its id is the Area's and its own, never the
   *  Context row's. No icon: TRAP T-nav-child-rows-carry-no-icon */
  #child(area: string, kept: Kept): NavEntry {
    return { id: `${area}:${kept.key ?? kept.context}`, label: kept.label, href: this.#href(kept.context, kept.view ?? null) };
  }

  /** A Context's Views as its child rows, each naming its View. */
  #viewRows(row: NavEntry, context: string): NavEntry[] {
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

  /** The ★: star or unstar the View on screen. */
  #onStar = (): void => {
    const context = this.#context();
    const view = this.#view();
    const kept = this.#kept(context);
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
