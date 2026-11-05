/**
 * page-state.ts — a page's state as ONE document, and its ONE keeper: each part
 * kept in its tier. Only what the reader NAMES crosses tabs. TRAP T-one-page-one-document
 *
 * Map:
 * - PageState — One page's state, as one JSON document.
 * - LeftView — A View as the reader left it, unsaved: its JSON, and the definition it was made over.
 * - Named — The parts a reader names: their own Views, saved filters and entities.
 * - NODES_PAGE — The page name the app-wide entities are kept under.
 * - PageChange — Parts of a page's state to change: `undefined` forgets one.
 * - Tier — Where a part is kept: read now, written now.
 * - sessionTier — The tab's own: it dies with the tab.
 * - localTier — Every tab's: it outlives them.
 * - memoryTier — Kept in memory only, for this keeper's life.
 * - PageRemote — Where the named parts go to outlive this browser: an app's server.
 * - KeeperOptions — The keeper's tiers, and whether each View keeps what the reader left on it.
 * - viewSig — What a View defines, as a string: a View left over another definition is stale.
 * - PageKeeper — The ONE keeper of every page's state.
 * - .eachView — Does each View keep what the reader left on it?
 * - .read — One page's state now, read from its tiers.
 * - .write — Change parts of one page's state; each goes to its tier, `undefined` forgets it.
 * - .entityPresets — The entities the app ships, read only: set after loadEntityLibrary().
 * - .entities — The ONE entity shelf: the presets and the reader's own, of every type, kept app-wide.
 * - .shelf — The Custom Node shelf: a view of every entity, as the node it offers.
 * - .nodeLibrary — Every entity now, as the Custom Node it offers, in one library.
 * - .saveNode — Keep one of the reader's Custom Nodes, by its use's kind; a clash or a fault is refused and reported.
 * - .removeNode — Forget one of the reader's Custom Nodes, by its use's kind.
 * - .watchNodes — Hear the Custom Nodes change: here at once, in another tab by its `storage` event.
 * - .appContext — The App Context's one answer, for this tab.
 * - .restore — The named parts from the database and the server, merged under this browser's.
 * - .flush — Push every page's named parts now.
 * - .keepUi — Keep each element's own state in the page's `ui`: put back now, kept after each load.
 */
import type { Query, QueryDefaults, SavedFilter } from '../data/query.js';
import { isSavedFilter } from '../data/query.js';
import type { SharedView } from '../data/query-edits.js';
import type { NodeDefinition, NodeLibrary } from '../data/node-library.js';
import { definitionOf, isEntity, nodeEntityOf, type Entity } from '../data/entity.js';
import { makeShelf, nodesView, type EntityShelf } from '../data/entity-shelf.js';
import { isNodeEntry, type NodeShelf } from '../data/node-shelf.js';
import { applyView, type SavedView } from './persist-view.js';
import type { EntityRecord, ViewRecord } from './database.js';
import { isPlainObject, readJson, removeKey, writeJson, type StorageKind } from './web-storage.js';

/** One page's state, as one JSON document. */
export interface PageState {
  /** The version of the SHAPE: any other is not read. */
  v: 3;
  /** The View on screen. */
  view?: string;
  /** Its Query applied, exact: a reload puts it back. */
  query?: Query;
  /** What waits for Apply, where it differs from `query`. The one meaning of draft. */
  draft?: Query;
  /** Each element's own state, by id: what is not data, a grid's selection. */
  ui?: Record<string, Record<string, unknown>>;
  /** Each View the reader changed and left, by id. TRAP T-a-view-keeps-what-the-reader-left */
  left?: Record<string, LeftView>;
  /** The saved filters on a bar in this tab, each with the scope its chip is on. */
  added?: Record<string, string>;
  /** Each card's filter toolbar, shown or shut, by its slot. */
  toolbars?: Record<string, boolean>;
  /** NAMED: the reader's own Views, by id. */
  views?: Record<string, SavedView>;
  /** NAMED: the reader's saved filters, by id. */
  filters?: Record<string, SavedFilter>;
  /** NAMED: the reader's own entities, of every type, by id. App-wide: kept under `NODES_PAGE`. */
  entities?: Record<string, Entity>;
}

/** A View as the reader left it, unsaved: its JSON, and the definition it was made over. */
export interface LeftView {
  query: QueryDefaults;
  sig: string;
}

/** The parts a reader names: their own Views, saved filters and entities. `nodes` is a READ of the
 *  entities of the type `node`, as definitions; a server that still sends `nodes` is read once as such. */
export type Named = Pick<PageState, 'views' | 'filters' | 'entities'> & { nodes?: Record<string, NodeDefinition> };

/** The page name the app-wide entities are kept under (D13): no page id can be it. */
export const NODES_PAGE = '#app';

type Part = Exclude<keyof PageState, 'v'>;

/** Parts of a page's state to change: `undefined` forgets one. */
export type PageChange = { [P in Part]?: PageState[P] | undefined };

/** The tier of each part. Only what the reader names crosses tabs, and a card's
 *  toolbar, which is chrome as the nav's pin is. TRAP T-only-a-named-part-crosses-tabs */
const TIER_OF = {
  view: 'tab', query: 'tab', draft: 'tab', ui: 'tab', left: 'tab', added: 'tab',
  toolbars: 'local', views: 'local', filters: 'local', entities: 'local',
} as const satisfies Record<Part, 'tab' | 'local'>;

const PARTS = Object.keys(TIER_OF) as Part[];

const isQuery = (v: unknown): boolean => isPlainObject(v) && v['v'] === 1 && isPlainObject(v['scopes']);
const each = (ok: (v: unknown) => boolean) => (v: unknown): boolean => isPlainObject(v) && Object.values(v).every(ok);
/** A stored part this version cannot read is dropped, never half-applied. */
const WHOLE: Partial<Record<Part, (v: unknown) => boolean>> = {
  view: (v) => typeof v === 'string',
  query: isQuery,
  draft: isQuery,
  ui: each(isPlainObject),
  added: each((v) => typeof v === 'string'),
  toolbars: each((v) => typeof v === 'boolean'),
};
/** …but a part made of the reader's own entries loses only the broken ones. */
const ENTRY: Partial<Record<Part, (v: unknown) => boolean>> = {
  left: (v) => isPlainObject(v) && isQuery(v['query']) && typeof v['sig'] === 'string',
  views: (v) => isPlainObject(v) && typeof v['label'] === 'string',
  filters: isSavedFilter,
  // A preset is a file's, never the reader's.
  entities: (v) => isEntity(v) && v.origin !== 'preset',
};

/** A part as stored, or undefined where it cannot be read. */
function cleaned(part: Part, value: unknown): unknown {
  if (value === undefined) return undefined;
  const whole = WHOLE[part];
  if (whole) return whole(value) ? value : undefined;
  if (!isPlainObject(value)) return undefined;
  const ok = ENTRY[part]!;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => ok(entry)));
}

/** Where a part is kept: read now, written now. `undefined` forgets the key. */
export interface Tier {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
}

const webTier = (kind: StorageKind): Tier => ({
  // A key that is not JSON is forgotten. TRAP T-storage-access-throws
  read: (key) => readJson<unknown>(kind, key, undefined),
  write: (key, value) => (value === undefined ? removeKey(kind, key) : writeJson(kind, key, value)),
});

/** The tab's own: it dies with the tab. */
export const sessionTier: Tier = webTier('session');
/** Every tab's: it outlives them. */
export const localTier: Tier = webTier('local');

/** Kept in memory only, for this keeper's life. */
export function memoryTier(): Tier {
  const held = new Map<string, unknown>();
  return {
    read: (key) => structuredClone(held.get(key)),
    write: (key, value) => void (value === undefined ? held.delete(key) : held.set(key, structuredClone(value))),
  };
}

/** Where the named parts go to outlive this browser: an app's server. */
export interface PageRemote {
  /** Every named part this reader has for one page. */
  pull(page: string): Promise<Named>;
  /** Write them back whole: a snapshot, not a diff. TRAP T-sync-pushes-a-snapshot-not-a-diff */
  push(page: string, named: Named): Promise<void>;
}

/** The keeper's tiers, and whether each View keeps what the reader left on it. */
export interface KeeperOptions {
  /** The tab's parts. Default: sessionStorage. */
  tab?: Tier;
  /** The parts every tab shares. Default: localStorage. */
  local?: Tier;
  /** Each View keeps what the reader left on it, asked at each write; off, only
   *  the View on screen is kept. Default off. TRAP T-a-view-keeps-what-the-reader-left */
  eachView?: () => boolean;
  /** The reader's own Views in the one browser database too. Default off. */
  database?: boolean;
  /** …and on an app's server. */
  remote?: PageRemote;
  /** Debounce a push, in ms. Default 30_000. */
  interval?: number;
  /** A failed pull or push is REPORTED, never thrown. TRAP T-local-first-then-onward */
  onError?: (error: unknown, stage: 'pull' | 'push') => void;
  /** Stop pushing: the page is going, so what waits goes with it. */
  signal?: AbortSignal;
}

const PREFIX = 'sherpa:page:';
const APP_CONTEXT = 'sherpa:app-context';
/** Where a reader's saved Views and saved filters were kept before v3: read once. */
const OLD_VIEWS = 'sherpa:views:';
const OLD_FILTERS = 'sherpa:filter-sets:';

/** Custom Nodes as an earlier build kept them, `nodes` by id, as entities of the type `node`; a preset or a broken one is left out. */
function carriedNodes(nodes: unknown): Record<string, Entity> {
  if (!isPlainObject(nodes)) return {};
  return Object.fromEntries(Object.entries(nodes).filter(([, d]) => isNodeEntry(d) && !(d as { preset?: unknown }).preset).map(([id, d]) => [id, nodeEntityOf(id, d as NodeDefinition)]));
}

/** What a View defines, as a string: a View left over another definition is stale. */
export function viewSig(view: { query?: unknown } | undefined): string {
  return JSON.stringify(view?.query ?? null);
}

/**
 * The ONE keeper of every page's state: one document per page, each part in its
 * tier, read through on every read so another tab's named parts are seen.
 * TRAP T-one-page-one-document · TRAP T-restore-before-first-load
 */
export class PageKeeper {
  /** Where the tab's parts are kept. */
  readonly #tab: Tier;
  /** Where every tab's parts are kept. */
  readonly #local: Tier;
  /** The default local tier: only it can hold what an older build kept. */
  readonly #web: boolean;
  /** Does each View keep what the reader left on it? */
  readonly #eachView: () => boolean;
  /** What it was given: the database, the server and how to report. */
  readonly #options: KeeperOptions;
  /** Who hears the entities change in this tab. */
  readonly #heard = new Set<() => void>();
  /** The entity shelf, made once. */
  #shelf: EntityShelf | undefined;
  /** The pages whose named parts wait to be pushed. */
  #pending = new Set<string>();
  /** The push that waits for its interval. */
  #timer: ReturnType<typeof setTimeout> | null = null;
  /** The last database write, which a push waits for: it must not publish a deleted View. */
  #written: Promise<void> = Promise.resolve();

  constructor(options: KeeperOptions = {}) {
    this.#tab = options.tab ?? sessionTier;
    this.#local = options.local ?? localTier;
    this.#web = !options.local;
    this.#eachView = options.eachView ?? (() => false);
    this.#options = options;
    options.signal?.addEventListener('abort', () => {
      if (this.#timer) clearTimeout(this.#timer);
      this.#timer = null;
    }, { once: true });
  }

  /** Does each View keep what the reader left on it? Asked at each write. */
  get eachView(): boolean {
    return this.#eachView();
  }

  /** One page's state now, read from its tiers. A part it cannot read is left out. */
  read(page: string): PageState {
    const doc: PageState = { v: 3 };
    for (const tier of ['tab', 'local'] as const) {
      const stored = this.#stored(tier, page);
      for (const part of PARTS) {
        if (TIER_OF[part] !== tier) continue;
        const value = cleaned(part, stored[part]);
        if (value !== undefined) (doc as unknown as Record<string, unknown>)[part] = value;
      }
    }
    return doc;
  }

  /** Change parts of one page's state: each goes to its tier, and `undefined`
   *  forgets it. The reader's own Views go on to the database and the server. */
  write(page: string, parts: PageChange): void {
    this.#put(page, parts, true);
  }

  /** `onward`: the reader's own Views go on to the database and the server. */
  #put(page: string, parts: PageChange, onward: boolean): void {
    const named = onward && ('views' in parts || 'filters' in parts || 'entities' in parts);
    const held = (): string[] => Object.keys((page === NODES_PAGE ? this.read(page).entities : this.read(page).views) ?? {});
    const was = named ? held() : [];
    for (const tier of ['tab', 'local'] as const) {
      const mine = (Object.keys(parts) as Part[]).filter((part) => TIER_OF[part] === tier);
      if (!mine.length) continue;
      const next = this.#stored(tier, page);
      for (const part of mine) {
        const value = parts[part];
        if (value === undefined || (isPlainObject(value) && !Object.keys(value).length)) Reflect.deleteProperty(next, part);
        else next[part] = value;
      }
      const empty = !Object.keys(next).some((key) => key !== 'v');
      this.#tierOf(tier).write(PREFIX + page, empty ? undefined : { ...next, v: 3 });
    }
    if (named) this.#onward(page, was.filter((id) => !held().includes(id)));
  }

  /** The entities the app ships, read only: set once `loadEntityLibrary()` has answered. */
  entityPresets: readonly Entity[] = [];

  /** The ONE entity shelf: the presets (the app's file) and the reader's own, of every type. The reader's are a NAMED
   *  part, app-wide: every tab, the database, the server. Read through, so another tab's entity is seen at once. */
  get entities(): EntityShelf {
    return this.#shelf ??= makeShelf({
      presets: () => this.entityPresets,
      mine: () => this.read(NODES_PAGE).entities ?? {},
      keep: (next) => {
        this.write(NODES_PAGE, { entities: next });
        for (const call of this.#heard) call();
      },
      heard: (handler, signal) => this.#hear(handler, signal),
    });
  }

  /** The Custom Node shelf, as what an editor is handed: a VIEW of every entity, as the node it offers (D1). */
  get shelf(): NodeShelf {
    return nodesView(this.entities);
  }

  /** Every entity now, as the Custom Node it offers, keyed by its use's kind; read through. A clash with a preset is left out. */
  nodeLibrary(): NodeLibrary {
    return this.shelf.library();
  }

  /** Keep one of the reader's Custom Nodes, by its use's kind, as the entity it is. Refused and reported where it holds a
   *  preset's id, a shipped kind's, or a fault. Answers whether it was kept; the checks load when first asked. */
  saveNode(kind: string, definition: NodeDefinition): Promise<boolean> {
    return this.shelf.save(kind, definition);
  }

  /** Forget one of the reader's Custom Nodes, by its use's kind. A preset is not the reader's to remove. */
  removeNode(kind: string): boolean {
    return this.shelf.remove(kind);
  }

  /** Hear the Custom Nodes change: a save or a removal here at once, one in another tab by its
   *  `storage` event (the tab's own writes raise none). Stops on the signal. */
  watchNodes(handler: (library: NodeLibrary) => void, signal?: AbortSignal): void {
    this.shelf.watch(handler, signal);
  }

  /** Hear the entities change: here at once, in another tab by its `storage` event. */
  #hear(handler: () => void, signal?: AbortSignal): void {
    this.#heard.add(handler);
    signal?.addEventListener('abort', () => this.#heard.delete(handler), { once: true });
    const key = PREFIX + NODES_PAGE;
    const scope = globalThis as unknown as Partial<EventTarget>;
    scope.addEventListener?.('storage', (event) => {
      const { key: changed } = event as unknown as { key: string | null };
      if (changed === key || changed === null) handler();
    }, signal ? { signal } : {});
  }

  /** The App Context's one answer — every page's View, while the app shares
   *  it — for this tab. TRAP T-the-app-context-is-one-answer */
  get appContext(): SharedView | null {
    const kept = this.#tab.read(APP_CONTEXT);
    return isPlainObject(kept) && Array.isArray(kept['holds']) ? kept as unknown as SharedView : null;
  }
  set appContext(answer: SharedView | null) {
    this.#tab.write(APP_CONTEXT, answer ?? undefined);
  }

  /** The named parts from the database and the server, merged UNDER this
   *  browser's — an unpushed local edit wins — and kept here, so the page shows
   *  them. TRAP T-local-first-then-onward */
  async restore(page: string): Promise<Named> {
    let remote: Named = {};
    if (this.#options.remote) {
      try {
        remote = await this.#options.remote.pull(page);
      } catch (error) {
        this.#say(error, 'pull');
      }
    }
    const here = this.read(page);
    const views = { ...cleaned('views', remote.views ?? {}) as object, ...await this.#fromDatabase(page), ...here.views };
    const filters = { ...cleaned('filters', remote.filters ?? {}) as object, ...here.filters };
    // A server that still keeps `nodes` is read ONCE, as entities of the type `node`.
    const entities = { ...cleaned('entities', { ...carriedNodes(remote.nodes), ...remote.entities }) as object, ...await this.#entitiesFromDatabase(page), ...here.entities } as Record<string, Entity>;
    // Kept here and in the database; nothing new to push.
    this.#put(page, { views, filters, entities }, false);
    this.#onward(page, [], false);
    const nodes = Object.fromEntries(Object.values(entities).filter((e) => e.type === 'node').map((e) => [e.id, definitionOf(e)]));
    return { views, filters, ...(Object.keys(entities).length ? { entities } : {}), ...(Object.keys(nodes).length ? { nodes } : {}) };
  }

  /** Push every page's named parts now, rather than at the next tick. */
  async flush(): Promise<void> {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    await this.#push();
  }

  /**
   * Keep each element's own state in the page's `ui` across a reload: put back
   * NOW, before the first rows, and kept after each load of `source`. What each
   * contributes is the caller's. The function it returns stops keeping.
   * TRAP T-one-snapshot-not-a-key-per-concern · TRAP T-restore-before-first-load
   */
  keepUi(
    page: string,
    targets: { source?: EventTarget; elements: Record<string, HTMLElement> },
    contributors: Record<string, () => Record<string, unknown>>,
    options: { signal?: AbortSignal } = {},
  ): () => void {
    const kept = this.read(page).ui;
    if (kept) applyView({ ui: kept }, { elements: targets.elements });
    const save = (): void => {
      const ui: Record<string, Record<string, unknown>> = { ...this.read(page).ui };
      for (const [id, contribute] of Object.entries(contributors)) {
        try {
          const state = contribute();
          if (state && Object.keys(state).length) ui[id] = state;
          else Reflect.deleteProperty(ui, id);
        } catch {
          // One element mid-teardown must not lose the rest.
        }
      }
      this.write(page, { ui });
    };
    targets.source?.addEventListener('change', save, options.signal ? { signal: options.signal } : undefined);
    return () => targets.source?.removeEventListener('change', save);
  }

  /** One of its two tiers. */
  #tierOf(tier: 'tab' | 'local'): Tier {
    return tier === 'tab' ? this.#tab : this.#local;
  }

  /** One tier's half of a page, as stored: v3, else none. */
  #stored(tier: 'tab' | 'local', page: string): Record<string, unknown> {
    const stored = this.#tierOf(tier).read(PREFIX + page) ?? (tier === 'local' ? this.#carried(page) : undefined);
    const doc = isPlainObject(stored) && stored['v'] === 3 ? { ...stored } : { v: 3 };
    return tier === 'local' && page === NODES_PAGE && 'nodes' in doc ? this.#carriedNodes(doc) : doc;
  }

  /** A reader's saved Views and saved filters as an older build kept them: read
   *  ONCE into this page's document, and the old keys gone. Decision B. */
  #carried(page: string): Record<string, unknown> | undefined {
    if (!this.#web) return undefined;
    const views = cleaned('views', readJson<unknown>('local', OLD_VIEWS + page, undefined));
    const filters = cleaned('filters', readJson<unknown>('local', OLD_FILTERS + page, undefined));
    const has = (part: unknown): part is object => isPlainObject(part) && Object.keys(part).length > 0;
    if (!has(views) && !has(filters)) return undefined;
    const doc = { v: 3, ...(has(views) ? { views } : {}), ...(has(filters) ? { filters } : {}) };
    this.#local.write(PREFIX + page, doc);
    // The old keys go only once the new one holds them: a full store keeps both.
    if (this.#local.read(PREFIX + page) === undefined) return doc;
    removeKey('local', OLD_VIEWS + page);
    removeKey('local', OLD_FILTERS + page);
    return doc;
  }

  /** The Custom Nodes an earlier build kept as `nodes`: read ONCE into the entities, and the old part gone. */
  #carriedNodes(doc: Record<string, unknown>): Record<string, unknown> {
    const { nodes, ...rest } = doc;
    const entities = { ...carriedNodes(nodes), ...(isPlainObject(rest['entities']) ? rest['entities'] : {}) };
    const next = { ...rest, ...(Object.keys(entities).length ? { entities } : {}) };
    this.#local.write(PREFIX + NODES_PAGE, next);
    return next;
  }

  /** The reader's own Views to the database NOW, and a push to the server soon. */
  #onward(page: string, deleted: readonly string[], push = true): void {
    if (this.#options.database) {
      const { views = {}, entities = {} } = this.read(page);
      const app = page === NODES_PAGE;
      const name = app ? 'entities' : 'views';
      // Fetched only where an app asks for it: a page that keeps none never loads it.
      this.#written = this.#written.then(() => import('./database.js')).then(({ hasDatabase, transact }) => {
        if (!hasDatabase()) return;
        return transact(name, 'readwrite', (tx) => {
          // One transaction: a push never sees the deletes without the writes.
          const store = tx.objectStore(name);
          for (const id of deleted) store.delete(app ? id : [page, id]);
          if (app) for (const [id, entity] of Object.entries(entities)) store.put({ id, entity } satisfies EntityRecord);
          else for (const [id, view] of Object.entries(views)) store.put({ page, id, view } satisfies ViewRecord);
        });
      }).catch((error: unknown) => this.#say(error, 'push'));
    }
    if (!push || !this.#options.remote || this.#options.signal?.aborted) return;
    this.#pending.add(page);
    this.#timer ??= setTimeout(() => {
      this.#timer = null;
      void this.#push();
    }, this.#options.interval ?? 30_000);
  }

  /** Each page waiting, pushed whole. No retry timer: the next write carries the same. */
  async #push(): Promise<void> {
    const remote = this.#options.remote;
    const pages = [...this.#pending];
    this.#pending.clear();
    // The database first, with a server or none: a flush answers once what was saved is kept.
    await this.#written;
    if (!remote) return;
    for (const page of pages) {
      const { views, filters, entities } = this.read(page);
      try {
        await remote.push(page, { ...(views ? { views } : {}), ...(filters ? { filters } : {}), ...(entities ? { entities } : {}) });
      } catch (error) {
        this.#say(error, 'push');
      }
    }
  }

  /** The database's Views for one page. */
  async #fromDatabase(page: string): Promise<Record<string, SavedView>> {
    if (!this.#options.database) return {};
    try {
      await this.#written;
      const { hasDatabase, readAll, within } = await import('./database.js');
      if (!hasDatabase()) return {};
      const views: Record<string, SavedView> = {};
      for (const { id, view } of await readAll('views', within(page))) views[id] = view;
      return views;
    } catch (error) {
      // Storage blocked, or a version clash with another tab: Web Storage still answers.
      this.#say(error, 'pull');
      return {};
    }
  }

  /** The database's entities, for the app's page only. */
  async #entitiesFromDatabase(page: string): Promise<Record<string, Entity>> {
    if (!this.#options.database || page !== NODES_PAGE) return {};
    try {
      await this.#written;
      const { hasDatabase, readAll } = await import('./database.js');
      if (!hasDatabase()) return {};
      return Object.fromEntries((await readAll('entities')).map(({ id, entity }) => [id, entity]));
    } catch (error) {
      this.#say(error, 'pull');
      return {};
    }
  }

  /** A failed pull or push, to the app's `onError`. */
  #say(error: unknown, stage: 'pull' | 'push'): void {
    this.#options.onError?.(error, stage);
  }
}
