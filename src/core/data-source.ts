/**
 * data-source.ts — one place that owns how records are being VIEWED.
 *
 * TRAP T-one-comparator-one-source
 * TRAP T-view-state-lives-in-one-object
 */
import { filterFields, filterNeedles } from './store.js';
import type { Populatable } from './apply-state.js';
import type { Filter, LoadOptions, LoadResult, Row, SortDirection, SortSpec, Store } from './store.js';

/** The view state a source owns. */
export interface ViewState {
  filter?: Filter;
  sort: SortSpec[];
  group: string | null;
  search: string;
  page: number;
  pageSize: number | null;
  /**
   * A sort turned OFF, not thrown away. `sort` is the QUERY, empty while
   * suspended; this is the column a control still shows.
   * TRAP T-a-suspended-sort-is-one-owners-job
   */
  sortSuspended?: SortSpec;
}

export interface DataSourceOptions {
  store: Store;
  /** Rows per page. Omit for no paging. */
  pageSize?: number;
  /** Starting sort. */
  sort?: SortSpec[];
  /** Starting filter. */
  filter?: Filter;
  /** Starting group field. */
  group?: string | null;
  /** Fields a free-text search looks at. Omit to search every field. */
  searchFields?: string[];
  /** Load as soon as the first component binds. Default true. */
  autoLoad?: boolean;
}

/** What a component may do with the source it is bound to. */
export interface BindOptions {
  /** One NAMED PART of the payload, not all of it. TRAP T-into-merges-on-the-element */
  into?: string;
  /** Unbind when this signal aborts. TRAP T-signal-not-a-teardown-list */
  signal?: AbortSignal;
  /** Read the data, never steer it. A chart re-draws; clicking a bar re-sorts nothing. */
  readonly?: boolean;
  /** STEER ONLY — events reach the source, no rows come back. TRAP T-steer-only-populate-means-chips */
  steerOnly?: boolean;
  /** Events the source must NOT act on. TRAP T-ignore-is-the-scalpel */
  ignore?: readonly string[];
  /** Reshape the rows before they reach this component. TRAP T-adapter-lives-at-the-binding */
  as?: (rows: Row[], source: DataSource) => unknown;
  /**
   * Which rows this component is given. `'page'` (the default) is the window a
   * grid draws; `'all'` is every row matching the filter, unpaged — what a
   * SUMMARY needs, because a chart counting 25 of 100 is quietly wrong.
   * TRAP T-a-summary-binds-to-all-the-rows
   */
  scope?: 'page' | 'all';
}

/** What `change` carries, for a listener that wants the result without asking. */
export interface DataChangeDetail extends LoadResult {
  state: ViewState;
}

/** The events a bound component may send UP. TRAP T-steering-events-are-a-closed-list */
const STEERING_EVENTS = [
  'sort-change',
  'group-change',
  'quick-filter-change',
  'filter-change',
  'page-change',
  'page-size-change',
  'search-change',
  // A REPORT, not a request: changes what the pager draws, never the query.
  // TRAP T-grouped-paging-belongs-to-the-view
  'grid-pages-change',
] as const;

export class DataSource extends EventTarget {
  readonly store: Store;
  #state: ViewState;
  #searchFields: string[] | undefined;
  #bound = new Map<
    Populatable,
    {
      readonly: boolean;
      steerOnly: boolean;
      off: () => void;
      as?: BindOptions['as'];
      /** The named part of the payload this bind owns — see BindOptions.into. */
      into?: string;
      /** See BindOptions.scope. */
      scope: 'page' | 'all';
      /** The rows array last handed to this component — see `#push`. */
      lastRows?: readonly Row[];
    }
  >();
  #result: LoadResult = { rows: [], total: 0 };
  /**
   * Every row matching the filter, unpaged — for a `scope: 'all'` bind. Loaded
   * only when one exists, so a view with no summary asks the store once as
   * before. TRAP T-a-summary-binds-to-all-the-rows
   */
  #allRows: readonly Row[] = [];
  /**
   * The page count a GROUPED view reported; `null` until the first draw.
   * TRAP T-grouped-paging-belongs-to-the-view
   */
  #viewPages: number | null = null;
  #autoLoad: boolean;
  // TRAP T-in-flight-ticket-discards-stale — three keys, and why not one.
  /** The load in flight, as a ticket the response is checked against. */
  #inFlight: symbol | null = null;
  /** The ViewState the last COMPLETED load asked for, serialised. */
  #lastLoadKey: string | null = null;
  /** Has any load completed? Until one has, nothing may be skipped. */
  #loaded = false;
  /** The key of the load currently in flight. */
  #inFlightKey: string | null = null;
  /** A coalesced load is queued for the end of this tick — see `#schedule`. */
  #scheduled = false;
  /** The filter's named parts, in contribution order. TRAP T-parts-order-must-be-stable */
  #parts = new Map<string, Filter>();

  constructor(options: DataSourceOptions) {
    super();
    this.store = options.store;
    this.#autoLoad = options.autoLoad ?? true;
    this.#searchFields = options.searchFields;
    this.#state = {
      sort: options.sort ?? [],
      group: options.group ?? null,
      search: '',
      page: 1,
      pageSize: options.pageSize ?? null,
      ...(options.filter ? { filter: options.filter } : {}),
    };
    // FORCED: the rows changed under an identical ViewState.
    this.store.addEventListener('change', () => void this.load({ force: true }));
  }

  /* ── State ─────────────────────────────────────────────────────────── */

  /** The current view state. A copy — mutating it must not steer the source. */
  get state(): ViewState {
    return structuredClone(this.#state);
  }

  /** Restore a whole view state — a saved view, a deep link, a reload.
   *  TRAP T-set-state-merges-page-last */
  setState(next: Partial<ViewState>): void {
    if ('filter' in next) {
      this.#parts.clear();
      if (next.filter) this.#state.filter = next.filter;
      else delete this.#state.filter;
    }
    if (next.sort) this.#state.sort = next.sort;
    // A view captured mid-suspend restores as it was left.
    if ('sortSuspended' in next) {
      if (next.sortSuspended) this.#state.sortSuspended = next.sortSuspended;
      else delete this.#state.sortSuspended;
    }
    // A new grouping invalidates the view's page count — see setGroup.
    if ('group' in next) {
      this.#state.group = next.group ?? null;
      this.#viewPages = null;
    }
    if (next.search != null) this.#state.search = next.search;
    if ('pageSize' in next) this.#state.pageSize = next.pageSize ?? null;
    // PAGE LAST, and not clamped here: the total belongs to the PREVIOUS filter.
    // The load below re-clamps against the new one.
    if (next.page != null) this.#state.page = Math.max(1, Math.trunc(next.page) || 1);
    this.#schedule();
  }

  /** The whole of the last load's answer. TRAP T-result-is-the-hosts-half */
  get result(): LoadResult {
    return { ...this.#result };
  }

  get rows(): Row[] {
    return this.#result.rows;
  }

  /** Matching rows before paging. */
  get total(): number {
    return this.#result.total;
  }

  /**
   * Pages at the current size, at least 1. GROUPED, it is what the grid
   * reported — a shut group is one screen line.
   * TRAP T-grouped-paging-belongs-to-the-view
   */
  get totalPages(): number {
    const size = this.#state.pageSize;
    if (!size) return 1;
    if (this.#state.group && this.#viewPages != null) return Math.max(1, this.#viewPages);
    return Math.max(1, Math.ceil(this.#result.total / size));
  }

  /* ── Steering ──────────────────────────────────────────────────────── */

  /**
   * Order by one field, or stop. Every re-ordering returns to page 1.
   *
   * `field: null` SUSPENDS — the column moves to `sortSuspended`, so one more
   * click resumes it. `clearSort()` is how a caller forgets.
   * TRAP T-a-suspended-sort-is-one-owners-job
   */
  setSort(field: string | null, direction: SortDirection = 'asc'): void {
    if (field) {
      this.#state.sort = [{ field, direction }];
      delete this.#state.sortSuspended;
    } else {
      // A second suspend in a row must not overwrite the memory with nothing.
      const live = this.#state.sort[0];
      if (live) this.#state.sortSuspended = live;
      this.#state.sort = [];
    }
    this.#resetPage();
    this.#schedule();
  }

  /** Resume the suspended sort. No-op when there is none. */
  resumeSort(): void {
    const held = this.#state.sortSuspended;
    if (!held) return;
    this.setSort(held.field, held.direction ?? 'asc');
  }

  /** Forget the sort entirely — the gesture that is NOT a suspend. */
  clearSort(): void {
    this.#state.sort = [];
    delete this.#state.sortSuspended;
    this.#resetPage();
    this.#schedule();
  }

  setGroup(field: string | null): void {
    this.#state.group = field;
    // The old count was measured against the OLD grouping. Drop it and wait for
    // the next draw. TRAP T-grouped-paging-belongs-to-the-view
    this.#viewPages = null;
    this.#resetPage();
    this.#schedule();
  }

  /** Replace the WHOLE filter, clearing every contribution. TRAP T-contribute-beats-last-writer */
  setFilter(filter: Filter | undefined): void {
    this.#parts.clear();
    this.#setFilterValue(filter);
  }

  /** Own ONE NAMED PART. Parts are ANDed; `undefined` removes one. TRAP T-contribute-beats-last-writer */
  contribute(key: string, filter: Filter | undefined): void {
    if (filter) this.#parts.set(key, filter);
    else this.#parts.delete(key);
    this.#setFilterValue(this.#composed());
  }

  /** Every named part, ANDed — or undefined when there are none. */
  #composed(): Filter | undefined {
    const parts = [...this.#parts.values()];
    if (!parts.length) return undefined;
    return parts.length === 1 ? parts[0] : (['and', ...parts] as Filter);
  }

  /** The shared tail of `setFilter` and `contribute`. */
  #setFilterValue(filter: Filter | undefined): void {
    if (filter) this.#state.filter = filter;
    else delete this.#state.filter;
    this.#resetPage();
    this.#schedule();
  }

  setSearch(term: string): void {
    this.#state.search = term;
    this.#resetPage();
    this.#schedule();
  }

  setPage(page: number): void {
    // Clamped against the CURRENT total, so a pager cannot walk past the end.
    this.#state.page = Math.min(Math.max(1, Math.trunc(page) || 1), this.totalPages);
    /* GROUPED: publish, never load. Grouped loads send no skip/take, so every
       page shares one state key and the no-op guard would eat the publish.
       TRAP T-grouped-page-change-publishes-without-loading */
    if (this.#state.group) {
      this.#publish();
      return;
    }
    this.#schedule();
  }

  setPageSize(size: number): void {
    this.#state.pageSize = Math.max(1, Math.trunc(size) || 1);
    this.#resetPage();
    this.#schedule();
  }

  #resetPage(): void {
    this.#state.page = 1;
  }

  /** COALESCE one tick's writes into a single load. TRAP T-coalesce-microtask-not-debounce */
  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      void this.load();
    });
  }

  /* ── Loading ───────────────────────────────────────────────────────── */

  /** Is any bind asking for the unpaged set? TRAP T-a-summary-binds-to-all-the-rows */
  #wantsAllRows(): boolean {
    for (const entry of this.#bound.values()) if (entry.scope === 'all') return true;
    return false;
  }

  /** Build the load options the store is asked with. */
  #loadOptions(): LoadOptions {
    const { filter, sort, group, search, page, pageSize } = this.#state;
    const options: LoadOptions = {};
    if (filter) options.filter = filter;
    if (sort.length) options.sort = sort;
    if (group) options.group = group;
    if (search) {
      options.search = search;
      if (this.#searchFields) options.searchFields = this.#searchFields;
    }
    // GROUPED: ask for EVERY matching row and let the grid cut the page — no
    // store window knows which groups the reader has folded.
    // TRAP T-grouped-paging-belongs-to-the-view
    if (pageSize && !group) {
      options.skip = (page - 1) * pageSize;
      options.take = pageSize;
    }
    return options;
  }

  /** Re-read and push to every bound component. TRAP T-error-is-a-state-not-a-throw */
  async load(options: { force?: boolean } = {}): Promise<LoadResult> {
    // Skip a load that would ask the same question twice. `force` is how a load
    // that MUST happen says so.
    // TRAP T-no-op-load-guard
    // TRAP T-in-flight-ticket-discards-stale — ANSWERED and ASKED are separate.
    const key = this.#stateKey();
    if (!options.force) {
      if (key === this.#lastLoadKey && this.#loaded) return this.#result;  // answered
      if (key === this.#inFlightKey) return this.#result;                  // asked
    }

    const ticket = Symbol('load');
    this.#inFlight = ticket;
    this.#inFlightKey = key;
    this.dispatchEvent(new CustomEvent('loading', { detail: { loading: true } }));

    try {
      const result = await this.store.load(this.#loadOptions());
      // Not the latest → DISCARDED, and the key recorded only by the winner.
      if (this.#inFlight !== ticket) return this.#result;
      this.#result = result;
      this.#lastLoadKey = key;
      this.#loaded = true;

      /* A SUMMARY sees every matching row. When nothing was windowed the page
         IS everything, so the second ask is skipped.
         TRAP T-a-summary-binds-to-all-the-rows */
      const windowed = this.#state.pageSize != null && !this.#state.group;
      if (!this.#wantsAllRows()) this.#allRows = [];
      else if (!windowed) this.#allRows = result.rows;
      else {
        const { skip: _skip, take: _take, ...rest } = this.#loadOptions();
        const all = await this.store.load(rest);
        if (this.#inFlight !== ticket) return this.#result;
        this.#allRows = all.rows;
      }

      // Re-clamp and reload ONCE, FORCED. Never while GROUPED: the page count
      // there is the GRID's to report, and the re-load would ask the same thing.
      // TRAP T-error-is-a-state-not-a-throw
      // TRAP T-grouped-paging-belongs-to-the-view
      const pages = this.totalPages;
      if (!this.#state.group && this.#state.pageSize && this.#state.page > pages) {
        this.#state.page = pages;
        return this.load({ force: true });
      }

      this.#publish();
      this.dispatchEvent(
        new CustomEvent<DataChangeDetail>('change', {
          detail: { ...result, state: this.state },
        }),
      );
      return result;
    } catch (error) {
      // TRAP T-error-is-a-state-not-a-throw — a stale failure raises nothing.
      if (this.#inFlight !== ticket) return this.#result;
      this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
      return this.#result;
    } finally {
      if (this.#inFlight === ticket) {
        this.#inFlight = null;
        this.#inFlightKey = null;
        this.dispatchEvent(new CustomEvent('loading', { detail: { loading: false } }));
      }
    }
  }

  /** The ViewState as one comparable string. Key order is stable by construction. */
  #stateKey(): string {
    return JSON.stringify(this.#loadOptions());
  }

  /* ── Binding ───────────────────────────────────────────────────────── */

  /**
   * Point a component at this source. Two-way by default: rows and `data-*`
   * down, steering events back. Returns an unbind function.
   */
  bind(el: Populatable, options: BindOptions = {}): () => void {
    if (this.#bound.has(el)) return () => this.unbind(el);
    // TRAP T-signal-not-a-teardown-list — an aborted signal binds nothing.
    if (options.signal?.aborted) return () => {};

    const readonlyBind = options.readonly ?? false;
    const listeners: Array<[string, EventListener]> = [];

    const ignored = new Set(options.ignore ?? []);
    if (!readonlyBind) {
      for (const type of STEERING_EVENTS) {
        // TRAP T-ignore-is-the-scalpel — no listener at all, not an early return.
        if (ignored.has(type)) continue;
        const handler = ((event: Event) => this.#steer(type, event as CustomEvent)) as EventListener;
        el.addEventListener(type, handler);
        listeners.push([type, handler]);
      }
    }

    /* LOCKED: the source now owns this element's view state, so it reports its
       interactions and stops writing them. Not for a readonly bind, which
       steers nothing. A component with no source stays UNLOCKED and writes its
       own state — that is what makes a standalone grid work.
       TRAP T-bind-locks-what-it-owns */
    if (!readonlyBind) el.setAttribute('data-locked', '');

    const off = (): void => {
      for (const [type, handler] of listeners) el.removeEventListener(type, handler);
      // UNLOCKED on the way out, or a component that outlives its source is mute.
      el.removeAttribute('data-locked');
    };
    this.#bound.set(el, {
      readonly: readonlyBind,
      steerOnly: options.steerOnly ?? false,
      off,
      scope: options.scope ?? 'page',
      ...(options.as ? { as: options.as } : {}),
      ...(options.into ? { into: options.into } : {}),
    });

    // TRAP T-signal-not-a-teardown-list — drops the BINDING; `once` leaves nothing.
    options.signal?.addEventListener('abort', () => this.unbind(el), { once: true });

    // Whatever is already loaded, so a component bound late is not blank.
    this.#push(el);
    /* A summary bound AFTER the first load would otherwise draw blank: the
       unpaged set is fetched by `load`, and nothing would ask for it again.
       TRAP T-a-summary-binds-to-all-the-rows */
    const needsAll = options.scope === 'all' && !this.#allRows.length;
    if (this.#autoLoad && (!this.#result.rows.length || needsAll)) {
      void this.load({ force: needsAll });
    }

    return () => this.unbind(el);
  }

  /** Stop steering and stop populating this component. */
  unbind(el: Populatable): void {
    this.#bound.get(el)?.off();
    this.#bound.delete(el);
  }

  /** Every component currently bound. */
  get boundElements(): Populatable[] {
    return [...this.#bound.keys()];
  }

  /** Turn one component's event into a state change. TRAP T-steering-events-are-a-closed-list */
  #steer(type: (typeof STEERING_EVENTS)[number], event: CustomEvent): void {
    const detail = (event.detail ?? {}) as Record<string, unknown>;

    switch (type) {
      case 'sort-change': {
        const field = detail['field'];
        const direction = detail['direction'] === 'desc' ? 'desc' : 'asc';
        this.setSort(typeof field === 'string' ? field : null, direction);
        return;
      }
      case 'group-change': {
        const field = detail['field'];
        this.setGroup(typeof field === 'string' && field ? field : null);
        return;
      }
      case 'quick-filter-change': {
        this.setFilter(filterFromChips(detail));
        return;
      }
      case 'filter-change': {
        // The grid's per-column filter box. One field at a time, substring.
        const field = detail['field'];
        const value = detail['value'];
        if (typeof field !== 'string') return;
        this.setFilter(
          value === '' || value == null ? undefined : [field, 'contains', value],
        );
        return;
      }
      case 'page-change': {
        const page = detail['page'];
        if (typeof page === 'number') this.setPage(page);
        return;
      }
      case 'grid-pages-change': {
        // The rows in hand are already every matching row, so re-publish the
        // pager's numbers and load nothing.
        const pages = detail['pages'];
        if (typeof pages !== 'number' || !Number.isFinite(pages)) return;
        const next = Math.max(1, Math.trunc(pages));
        const clamped = Math.min(this.#state.page, next);
        if (next === this.#viewPages && clamped === this.#state.page) return;
        this.#viewPages = next;
        this.#state.page = clamped;
        this.#publish();
        return;
      }
      case 'page-size-change': {
        const size = detail['pageSize'];
        if (typeof size === 'number') this.setPageSize(size);
        return;
      }
      case 'search-change': {
        const term = detail['value'] ?? detail['search'];
        this.setSearch(typeof term === 'string' ? term : '');
        return;
      }
    }
  }

  /* ── Publishing ────────────────────────────────────────────────────── */

  /** Push rows and state to every bound component. */
  #publish(): void {
    for (const el of this.#bound.keys()) this.#push(el);
  }

  /** Give one component the rows and the view state. TRAP T-push-writes-state-as-attributes */
  #push(el: Populatable): void {
    const { sort, group, page, pageSize, filter, sortSuspended } = this.#state;
    const first = sort[0];

    /* The FIELD survives a suspend; the DIRECTION says whether it is applied.
       Suspended = the remembered field with an EMPTY direction.
       TRAP T-a-suspended-sort-is-one-owners-job */
    const shown = first ?? sortSuspended;
    setAttr(el, 'data-sort-field', shown?.field);
    setAttr(el, 'data-sort-direction',
      first ? (first.direction ?? 'asc') : (sortSuspended ? '' : undefined));
    setAttr(el, 'data-group-field', group ?? undefined);
    // WHICH fields the filter touches, not the filter itself.
    // TRAP T-push-writes-state-as-attributes
    const fields = filterFields(filter);
    setAttr(el, 'data-filter-fields', fields.length ? fields.join(' ') : undefined);
    /* …and WHAT it matched on, so a component can point at the hit. A view
       highlights what it filtered by, whichever control set the filter.
       TRAP T-a-needle-comes-from-either-direction */
    const needles = filterNeedles(filter);
    setAttr(el, 'data-needles', needles || undefined);
    setAttr(el, 'data-page', pageSize ? String(page) : undefined);
    setAttr(el, 'data-total-pages', pageSize ? String(this.totalPages) : undefined);
    setAttr(el, 'data-page-size', pageSize ? String(pageSize) : undefined);

    // …but the ROWS go only where they mean something — the attributes above
    // still reach a steer-only bind.
    // TRAP T-steer-only-populate-means-chips
    const entry = this.#bound.get(el);
    if (entry?.steerOnly) return;

    // Skip a push that would hand over the same rows again.
    // TRAP T-no-op-load-guard
    // TRAP T-adapter-lives-at-the-binding — guard the ROWS ARRAY, not a payload.
    const pushRows = entry?.scope === 'all' ? this.#allRows : this.#result.rows;
    if (entry && entry.lastRows === pushRows) return;
    if (entry) entry.lastRows = pushRows;

    // populate() waits for the first render itself, so a component bound
    // before it upgraded still gets its rows.
    const adapt = entry?.as;
    const payload = adapt ? adapt(pushRows as Row[], this) : pushRows;

    // ONE NAMED PART, when the bind asked for one — see BindOptions.into.
    if (entry?.into) {
      el.populate?.(mergeInto(el, entry.into, payload));
      return;
    }
    el.populate?.(payload);
  }
}

/** The shared draft each `into` bind writes its own part of. TRAP T-into-merges-on-the-element */
const DRAFT = Symbol('sherpa:into-draft');

/**
 * Write `value` at `path` in the element's shared draft, and return it.
 * `series.0` → `{ series: [value] }`. MUTATED, not rebuilt.
 * TRAP T-into-merges-on-the-element
 */
function mergeInto(el: Populatable, path: string, value: unknown): unknown {
  const host = el as unknown as Record<symbol, unknown>;
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) return value;

  const first = segments[0]!;
  // The ROOT follows the same rule: a numeric first segment means an array.
  host[DRAFT] ??= /^\d+$/.test(first) ? [] : {};
  let node = host[DRAFT] as Record<string | number, unknown>;

  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    const nextIsIndex = /^\d+$/.test(segments[i + 1]!);
    node[key] ??= nextIsIndex ? [] : {};
    node = node[key] as Record<string | number, unknown>;
  }
  node[segments[segments.length - 1]!] = value;
  return host[DRAFT];
}

/** Write or remove an attribute. `undefined` removes, so CSS stops matching. */
function setAttr(el: HTMLElement, name: string, value: string | undefined): void {
  if (value == null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** A quick-filter toolbar's detail → a Filter. OR within a chip, AND across them. */
function filterFromChips(detail: Record<string, unknown>): Filter | undefined {
  const clauses: Filter[] = [];

  const values = detail['values'];
  if (values && typeof values === 'object') {
    for (const [field, picked] of Object.entries(values as Record<string, unknown>)) {
      if (!Array.isArray(picked) || !picked.length) continue;
      clauses.push(picked.length === 1 ? [field, 'eq', picked[0]] : [field, 'in', picked]);
    }
  }

  // TRAP T-toggle-chips-have-no-field — `active` becomes no clause here.

  if (!clauses.length) return undefined;
  return clauses.length === 1 ? clauses[0]! : ['and', ...clauses];
}
