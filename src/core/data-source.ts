/**
 * data-source.ts — one place that owns how records are being VIEWED.
 *
 * TRAP T-one-comparator-one-source — why view state lives here, not per control.
 * TRAP T-view-state-lives-in-one-object — the worked example.
 */
import { filterFields } from './store.js';
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
  /**
   * Load as soon as the first component binds. Default true — a bound component
   * with no rows is a blank panel nobody asked for.
   */
  autoLoad?: boolean;
}

/** What a component may do with the source it is bound to. */
export interface BindOptions {
  /**
   * Write into ONE NAMED PART of the component's payload, not all of it.
   *
   * TRAP T-into-merges-on-the-element — two sources, one component, one draft.
   */
  into?: string;
  /**
   * Unbind when this signal aborts — the PLATFORM'S OWN teardown token.
   *
   * TRAP T-signal-not-a-teardown-list — one abort, not a list someone forgets.
   */
  signal?: AbortSignal;
  /**
   * Read the data but never steer it — the component's events are ignored.
   *
   * The dashboard case: a chart beside a steering grid should re-draw when the
   * filter changes, but clicking a bar must not re-sort the grid.
   */
  readonly?: boolean;
  /**
   * STEER ONLY — the component's events reach the source, but no rows are ever
   * pushed back to it.
   *
   * TRAP T-steer-only-populate-means-chips — its populate() takes chips.
   */
  steerOnly?: boolean;
  /**
   * Events from this component the source must NOT act on.
   *
   * TRAP T-ignore-is-the-scalpel — a view that owns one event owns it outright.
   */
  ignore?: readonly string[];
  /**
   * Reshape the rows before they reach this component.
   *
   * TRAP T-adapter-lives-at-the-binding — 21 components, one shape each.
   */
  as?: (rows: Row[], source: DataSource) => unknown;
}

/** What `change` carries, for a listener that wants the result without asking. */
export interface DataChangeDetail extends LoadResult {
  state: ViewState;
}

/**
 * The events a bound component may send UP to the source.
 *
 * TRAP T-steering-events-are-a-closed-list — why `row-click` is not here.
 */
const STEERING_EVENTS = [
  'sort-change',
  'group-change',
  'quick-filter-change',
  'filter-change',
  'page-change',
  'page-size-change',
  'search-change',
  // A grouped view counting its own pages — see TRAP
  // T-grouped-paging-belongs-to-the-view. A REPORT, not a request: it changes
  // what the pager draws, never what the store is asked for.
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
      /** The rows array last handed to this component — see `#push`. */
      lastRows?: readonly Row[];
    }
  >();
  #result: LoadResult = { rows: [], total: 0 };
  /**
   * The page count a GROUPED view reported, because folding decides it and only
   * the view can count screen lines — see `totalPages`. `null` means nothing has
   * reported yet, so the record division stands in until the first draw.
   * TRAP T-grouped-paging-belongs-to-the-view.
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
  /**
   * The named parts of the filter, in contribution order — see `contribute`.
   *
   * TRAP T-parts-order-must-be-stable — a Map, and why the order matters.
   */
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
    // The store's rows changed — an insert, an update, a socket message. FORCED,
    // because the ViewState is identical and the answer is not.
    this.store.addEventListener('change', () => void this.load({ force: true }));
  }

  /* ── State ─────────────────────────────────────────────────────────── */

  /** The current view state. A copy — mutating it must not steer the source. */
  get state(): ViewState {
    return structuredClone(this.#state);
  }

  /**
   * Restore a whole view state at once — a saved view, a deep link, or what a
   * reload threw away.
   *
   * TRAP T-set-state-merges-page-last — merge, page last, and no persistence.
   */
  setState(next: Partial<ViewState>): void {
    if ('filter' in next) {
      this.#parts.clear();
      if (next.filter) this.#state.filter = next.filter;
      else delete this.#state.filter;
    }
    if (next.sort) this.#state.sort = next.sort;
    // A new grouping invalidates the view's page count — see setGroup.
    if ('group' in next) {
      this.#state.group = next.group ?? null;
      this.#viewPages = null;
    }
    if (next.search != null) this.#state.search = next.search;
    if ('pageSize' in next) this.#state.pageSize = next.pageSize ?? null;
    // PAGE LAST, and not clamped here: the total it would be clamped against
    // belongs to the PREVIOUS filter. The load below re-clamps against the new
    // one, which is the only honest moment to do it.
    if (next.page != null) this.#state.page = Math.max(1, Math.trunc(next.page) || 1);
    this.#schedule();
  }

  /**
   * The whole of the last load's answer — rows, total, and anything else the
   * store reported.
   *
   * TRAP T-result-is-the-hosts-half — for a HOST, and a copy.
   */
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
   * Pages at the current size, at least 1.
   *
   * While GROUPED this is what the grid reported, not a division: a shut group
   * is one screen line, so the record count cannot produce the answer.
   * TRAP T-grouped-paging-belongs-to-the-view.
   */
  get totalPages(): number {
    const size = this.#state.pageSize;
    if (!size) return 1;
    if (this.#state.group && this.#viewPages != null) return Math.max(1, this.#viewPages);
    return Math.max(1, Math.ceil(this.#result.total / size));
  }

  /* ── Steering ──────────────────────────────────────────────────────── */

  /**
   * Set the sort. `null` clears it.
   *
   * A page is a window onto an ORDER, so every narrowing or re-ordering change
   * returns to page 1 — page 7 of a freshly filtered list is an empty panel.
   */
  setSort(field: string | null, direction: SortDirection = 'asc'): void {
    this.#state.sort = field ? [{ field, direction }] : [];
    this.#resetPage();
    this.#schedule();
  }

  setGroup(field: string | null): void {
    this.#state.group = field;
    // The old count was measured against the OLD grouping — a different field
    // makes different groups, and none makes none. Drop it and wait for the
    // next draw. TRAP T-grouped-paging-belongs-to-the-view.
    this.#viewPages = null;
    this.#resetPage();
    this.#schedule();
  }

  /**
   * Replace the WHOLE filter.
   *
   * TRAP T-contribute-beats-last-writer — and why this clears contributions.
   */
  setFilter(filter: Filter | undefined): void {
    this.#parts.clear();
    this.#setFilterValue(filter);
  }

  /**
   * Own ONE NAMED PART of the filter.
   *
   * TRAP T-contribute-beats-last-writer — every part is ANDed; `undefined`
   * removes one.
   */
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

  /**
   * COALESCE the writes in one tick into a single load.
   *
   * TRAP T-coalesce-microtask-not-debounce — a microtask, and why not a timer.
   */
  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      void this.load();
    });
  }

  /* ── Loading ───────────────────────────────────────────────────────── */

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
    // TRAP T-grouped-paging-belongs-to-the-view — a GROUPED view is paged by
    // SCREEN LINES, not by records: a shut group is one line however many rows
    // it holds, and no store window can know which groups the reader has folded.
    // So while grouped the source asks for EVERY matching row and the grid cuts
    // the page. Ungrouped, the store's window IS the page, as before.
    if (pageSize && !group) {
      options.skip = (page - 1) * pageSize;
      options.take = pageSize;
    }
    return options;
  }

  /**
   * Re-read from the store and push the result to every bound component.
   *
   * TRAP T-error-is-a-state-not-a-throw — a failed load keeps the last rows.
   */
  async load(options: { force?: boolean } = {}): Promise<LoadResult> {
    // SKIP A LOAD THAT WOULD ASK THE SAME QUESTION TWICE.
    // TRAP T-no-op-load-guard — 667ms, 120 populates, six components, zero
    // change on screen. `force` is how a load that MUST happen says so, and the
    // store's `change` listener passes it.
    // TRAP T-in-flight-ticket-discards-stale — why ANSWERED and ASKED are two
    // separate checks.
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

      // TRAP T-error-is-a-state-not-a-throw — re-clamp and reload ONCE, FORCED.
      // Not while GROUPED: the load fetched every matching row, so a re-load
      // would ask the identical question, and the page count there is the
      // GRID's to report — clamping against a count measured before this load's
      // rows arrived would move the reader for no reason.
      // TRAP T-grouped-paging-belongs-to-the-view.
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

  /**
   * The current ViewState as one comparable string.
   *
   * JSON, because `filter` is a nested tree. Key order is stable — every field
   * is written by this class in a fixed order — and a few hundred bytes beats
   * re-filtering the whole collection.
   */
  #stateKey(): string {
    return JSON.stringify(this.#loadOptions());
  }

  /* ── Binding ───────────────────────────────────────────────────────── */

  /**
   * Point a component at this source.
   *
   * Two-way by default: the source populates it and writes the view state onto
   * it as `data-*`, and the component's own steering events write back. Returns
   * an unbind function.
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

    const off = (): void => {
      for (const [type, handler] of listeners) el.removeEventListener(type, handler);
    };
    this.#bound.set(el, {
      readonly: readonlyBind,
      steerOnly: options.steerOnly ?? false,
      off,
      ...(options.as ? { as: options.as } : {}),
      ...(options.into ? { into: options.into } : {}),
    });

    // TRAP T-signal-not-a-teardown-list — drops the BINDING; `once` leaves nothing.
    options.signal?.addEventListener('abort', () => this.unbind(el), { once: true });

    // Whatever is already loaded, so a component bound late is not blank.
    this.#push(el);
    if (this.#autoLoad && !this.#result.rows.length) void this.load();

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

  /**
   * Turn one component's event into a state change.
   *
   * TRAP T-steering-events-are-a-closed-list — the detail shapes are ratified.
   */
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
        // The view counted its own screen lines. No load — the rows in hand are
        // already every matching row (the grouped branch of #loadOptions) — so
        // this only re-publishes the pager's numbers.
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

  /**
   * Give one component the rows and the view state.
   *
   * TRAP T-push-writes-state-as-attributes — and `data-filter-fields`.
   */
  #push(el: Populatable): void {
    const { sort, group, page, pageSize, filter } = this.#state;
    const first = sort[0];

    setAttr(el, 'data-sort-field', first?.field);
    setAttr(el, 'data-sort-direction', first ? (first.direction ?? 'asc') : undefined);
    setAttr(el, 'data-group-field', group ?? undefined);
    // WHICH fields the filter touches, not the filter itself — see
    // TRAP T-push-writes-state-as-attributes.
    const fields = filterFields(filter);
    setAttr(el, 'data-filter-fields', fields.length ? fields.join(' ') : undefined);
    setAttr(el, 'data-page', pageSize ? String(page) : undefined);
    setAttr(el, 'data-total-pages', pageSize ? String(this.totalPages) : undefined);
    setAttr(el, 'data-page-size', pageSize ? String(pageSize) : undefined);

    // …but the ROWS go only where they mean something.
    // TRAP T-steer-only-populate-means-chips — the attributes still reach it.
    const entry = this.#bound.get(el);
    if (entry?.steerOnly) return;

    // SKIP A PUSH THAT WOULD HAND OVER THE SAME ROWS AGAIN. Six bound
    // components, twenty no-op loads, 120 populates.
    // TRAP T-no-op-load-guard — and why ArrayStore copies rather than sorting in
    // place.
    // TRAP T-adapter-lives-at-the-binding — guard the ROWS ARRAY, not a payload.
    if (entry && entry.lastRows === this.#result.rows) return;
    if (entry) entry.lastRows = this.#result.rows;

    // populate() waits for the first render itself, so a component bound
    // before it upgraded still gets its rows.
    const adapt = entry?.as;
    const payload = adapt ? adapt(this.#result.rows, this) : this.#result.rows;

    // ONE NAMED PART, when the bind asked for one — see BindOptions.into.
    if (entry?.into) {
      el.populate?.(mergeInto(el, entry.into, payload));
      return;
    }
    el.populate?.(payload);
  }
}

/**
 * The shared draft each `into` bind writes its own part of.
 *
 * TRAP T-into-merges-on-the-element — on the ELEMENT, and why a Symbol.
 */
const DRAFT = Symbol('sherpa:into-draft');

/**
 * Write `value` at `path` in the element's shared draft, and return the draft.
 *
 * `series.0` → `{ series: [value] }`, `totals.open` → `{ totals: { open: … } }`.
 * MUTATED and handed back, not rebuilt — see
 * TRAP T-into-merges-on-the-element.
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

/**
 * Turn a quick-filter toolbar's change detail into a Filter.
 *
 * TRAP T-toggle-chips-have-no-field — OR within a chip, AND across them.
 */
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
