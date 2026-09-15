/**
 * data-source.ts — one place that owns how records are being VIEWED.
 *
 * A Store holds records and remembers nothing (store.ts). A DataSource is the
 * stateful half: it holds the filter, sort, group, search and page, applies them
 * on every load, and tells everyone bound to it when the result changes.
 *
 * ## Why this exists
 *
 * The same sort used to be written three times — in sherpa-data-grid, in the
 * quick-filter toolbar, and again in the app wiring them together. The two
 * compares were not even identical, so "item 2" and "item 10" ordered differently
 * depending on which control you used. A DataSource makes the sort ONE value, so
 * two controls cannot disagree about it.
 *
 * ## Binding is two-way
 *
 *   source → component   populate(rows) + data-* attribute writes
 *   component → source   its existing noun-verb events (sort-change, page-change…)
 *
 * Both halves already existed. The events are ratified and composed; the
 * attribute names are the standard ones. No component needed a new API for this.
 *
 * ## Many components, one source
 *
 *   const sales = new DataSource({ store });
 *   sales.bind(grid);       // rows in, sort/filter out
 *   sales.bind(toolbar);    // chips in, filter out
 *   sales.bind(pager);      // page in, total out
 *   sales.bind(chart, { readonly: true });   // sees the data, never steers it
 *
 * One filter change re-populates every bound component. The grid's own header
 * arrow and the toolbar's Sort chip become two views of one value.
 */
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
   * The mirror of `readonly`, and the case the quick-filter toolbar needs: its
   * `populate()` means "here are your CHIPS", not "here are your rows", so a
   * plain bind overwrote the bar with records and it came back holding only
   * Group and Sort. Without this, such a component has to be hand-wired with a
   * listener per event — which is the six-handler tangle the whole layer exists
   * to remove.
   *
   * It still receives the STATE attributes (data-sort-field and the rest), so
   * the toolbar's Sort chip and the grid's header arrow stay two views of one
   * value.
   */
  steerOnly?: boolean;
  /**
   * Reshape the rows before they reach this component.
   *
   * Components ask for different shapes: a chart wants `[{ label, value }]`, the
   * data grid wants `{ columns, rows }`. Rather than force one shape on every
   * component — which would mean changing 21 of them — the ADAPTER lives at the
   * binding, where the mismatch actually is.
   *
   *   source.bind(grid,  { as: (rows) => ({ columns, rows }) });
   *   source.bind(chart, { as: (rows) => rows.map(toSlice) });
   *
   * It also receives the source, so an adapter can read the total or the state —
   * a "N of M" summary needs both.
   */
  as?: (rows: Row[], source: DataSource) => unknown;
}

/** A populatable element — every Sherpa data component answers this. */
interface Populatable extends HTMLElement {
  populate?: (data: unknown) => void;
  rendered?: Promise<void>;
}

/** What `change` carries, for a listener that wants the result without asking. */
export interface DataChangeDetail extends LoadResult {
  state: ViewState;
}

/**
 * The events a bound component may send UP to the source.
 *
 * Only these. A component fires plenty more (`row-click`, `bar-click`) that are
 * the app's business, not the source's — a source that listened to everything
 * would turn every click into a reload.
 */
const STEERING_EVENTS = [
  'sort-change',
  'group-change',
  'quick-filter-change',
  'filter-change',
  'page-change',
  'page-size-change',
  'search-change',
] as const;

export class DataSource extends EventTarget {
  readonly store: Store;
  #state: ViewState;
  #searchFields: string[] | undefined;
  #bound = new Map<
    Populatable,
    { readonly: boolean; steerOnly: boolean; off: () => void; as?: BindOptions['as'] }
  >();
  #result: LoadResult = { rows: [], total: 0 };
  #autoLoad: boolean;
  /**
   * The load in flight. A source is steered by controls a person can use quickly
   * — three filter chips in a second — and each change starts a load. Holding the
   * latest lets a slower earlier response be DISCARDED rather than overwriting a
   * newer one, which is the classic out-of-order bug.
   */
  #inFlight: symbol | null = null;

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
    // Records changing under us is a reload — deciding whether a changed row
    // still matches the filter, and where it now sorts, is exactly this class's
    // job, and re-deriving beats getting that wrong.
    this.store.addEventListener('change', () => void this.load());
  }

  /* ── State ─────────────────────────────────────────────────────────── */

  /** The current view state. A copy — mutating it must not steer the source. */
  get state(): ViewState {
    return structuredClone(this.#state);
  }

  /** The last loaded result. */
  get rows(): Row[] {
    return this.#result.rows;
  }

  /** Matching rows before paging. */
  get total(): number {
    return this.#result.total;
  }

  /** Pages at the current size, at least 1. */
  get totalPages(): number {
    const size = this.#state.pageSize;
    return size ? Math.max(1, Math.ceil(this.#result.total / size)) : 1;
  }

  /* ── Steering ──────────────────────────────────────────────────────── */

  /**
   * Set the sort. `null` clears it.
   *
   * A page is a window onto an ORDER, so changing the order invalidates the
   * window — every narrowing or re-ordering change returns to page 1. Staying on
   * page 7 of a freshly filtered list shows the user an empty panel.
   */
  setSort(field: string | null, direction: SortDirection = 'asc'): void {
    this.#state.sort = field ? [{ field, direction }] : [];
    this.#resetPage();
    void this.load();
  }

  setGroup(field: string | null): void {
    this.#state.group = field;
    this.#resetPage();
    void this.load();
  }

  setFilter(filter: Filter | undefined): void {
    if (filter) this.#state.filter = filter;
    else delete this.#state.filter;
    this.#resetPage();
    void this.load();
  }

  setSearch(term: string): void {
    this.#state.search = term;
    this.#resetPage();
    void this.load();
  }

  setPage(page: number): void {
    // Clamped against the CURRENT total, so a pager cannot walk past the end.
    this.#state.page = Math.min(Math.max(1, Math.trunc(page) || 1), this.totalPages);
    void this.load();
  }

  setPageSize(size: number): void {
    this.#state.pageSize = Math.max(1, Math.trunc(size) || 1);
    this.#resetPage();
    void this.load();
  }

  #resetPage(): void {
    this.#state.page = 1;
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
    if (pageSize) {
      options.skip = (page - 1) * pageSize;
      options.take = pageSize;
    }
    return options;
  }

  /**
   * Re-read from the store and push the result to every bound component.
   *
   * Emits `loading` first so a bound sherpa-container can show its overlay, then
   * `change` — or `error`, which is a STATE, not a throw: a failed load must not
   * take down the caller that merely changed a filter.
   */
  async load(): Promise<LoadResult> {
    const ticket = Symbol('load');
    this.#inFlight = ticket;
    this.dispatchEvent(new CustomEvent('loading', { detail: { loading: true } }));

    try {
      const result = await this.store.load(this.#loadOptions());
      // A response that is not the latest is DISCARDED. Without this, a slow
      // first filter landing after a fast second one would show the wrong rows.
      if (this.#inFlight !== ticket) return this.#result;
      this.#result = result;

      // A page can fall past the end when a filter narrows the set — re-clamp and
      // reload once rather than showing an empty page.
      const pages = this.totalPages;
      if (this.#state.pageSize && this.#state.page > pages) {
        this.#state.page = pages;
        return this.load();
      }

      this.#publish();
      this.dispatchEvent(
        new CustomEvent<DataChangeDetail>('change', {
          detail: { ...result, state: this.state },
        }),
      );
      return result;
    } catch (error) {
      if (this.#inFlight !== ticket) return this.#result;
      this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
      return this.#result;
    } finally {
      if (this.#inFlight === ticket) {
        this.#inFlight = null;
        this.dispatchEvent(new CustomEvent('loading', { detail: { loading: false } }));
      }
    }
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

    const readonlyBind = options.readonly ?? false;
    const listeners: Array<[string, EventListener]> = [];

    if (!readonlyBind) {
      for (const type of STEERING_EVENTS) {
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
    });

    // Populate straight away with whatever is already loaded, so a component
    // bound late is not blank until the next change.
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
   * The detail shapes are the components' own, already ratified — this reads
   * them, it does not ask components to send anything new.
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
   * The state is written as ATTRIBUTES, which is what makes a shared sort visible
   * without a JS branch anywhere: the grid's header arrow is drawn from
   * `data-sort-field` / `data-sort-direction` in CSS, so writing them here makes
   * the toolbar's Sort chip and the grid's own header two views of one value.
   */
  #push(el: Populatable): void {
    const { sort, group, page, pageSize } = this.#state;
    const first = sort[0];

    setAttr(el, 'data-sort-field', first?.field);
    setAttr(el, 'data-sort-direction', first ? (first.direction ?? 'asc') : undefined);
    setAttr(el, 'data-group-field', group ?? undefined);
    setAttr(el, 'data-page', pageSize ? String(page) : undefined);
    setAttr(el, 'data-total-pages', pageSize ? String(this.totalPages) : undefined);
    setAttr(el, 'data-page-size', pageSize ? String(pageSize) : undefined);

    // …but the ROWS are pushed only where they mean something. A steer-only
    // component's populate() takes something else entirely — the quick-filter
    // toolbar's means "here are your CHIPS" — so feeding it records replaced the
    // bar with data. The state attributes above still reach it, which is what
    // keeps its Sort chip and the grid's header arrow one value.
    const entry = this.#bound.get(el);
    if (entry?.steerOnly) return;

    // populate() waits for the first render itself, so a component bound before
    // it has upgraded still gets its rows.
    const adapt = entry?.as;
    el.populate?.(adapt ? adapt(this.#result.rows, this) : this.#result.rows);
  }
}

/** Write or remove an attribute. `undefined` removes, so CSS stops matching. */
function setAttr(el: HTMLElement, name: string, value: string | undefined): void {
  if (value == null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/**
 * Turn a quick-filter toolbar's change detail into a Filter.
 *
 * Its detail is `{ active: string[], values: Record<string, string[]> }` —
 * `active` names the toggle chips that are on, `values` the menu chips' picks.
 * Each chip's id IS its field, by construction in the toolbar.
 *
 * A chip narrows with OR across its own values, and chips narrow with AND across
 * each other: "Plan is Pro or Enterprise, AND Region is EMEA".
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

  // Toggle chips have no field of their own — the toolbar's own example maps them
  // onto one column (a status). They are reported so an app can act on them, but
  // a source cannot guess the column, so they are deliberately NOT turned into a
  // clause here. `active` reaches the app through the event as it always did.

  if (!clauses.length) return undefined;
  return clauses.length === 1 ? clauses[0]! : ['and', ...clauses];
}
