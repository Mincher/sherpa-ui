/**
 * source-reads.ts — what a DataSource reads, and how: its store or its own held
 * set, the page it shows, each ask and its ticket, and whether the store can be
 * reached. A DataSource holds one, and is its host. DOM-free.
 *
 * Map:
 * - ReadHost — What the reads ask their source, live, at each ask.
 * - ReadOptions — The store, and how its reads are asked.
 * - SourceReads — A source's reads: its reader, the page, each ask and its answer, and its reach.
 * - .store — the records it reads; a write goes here, a view never does
 * - .reader — What every read asks: its own HeldStore, else the store.
 * - .held — The HeldStore it reads a remote store through, or null.
 * - .can — What its reader can do, read once.
 * - .remote — Do its loads reach outside the data layer?
 * - .closed — Closed: it hears nothing, and holds nothing.
 * - .age — Moves each time what a count or an unpaged read reads may have changed beside the Query.
 * - .aged — Something a count reads moved beside the Query: a field's facts or values, a part, a set.
 * - .rowsAge — Moves each time the rows may have changed.
 * - .state — The view state: the arrangement, the page, and the filter.
 * - .page — The page shown, and its size.
 * - .totalPages — Pages at the current size, at least 1.
 * - .setPage — Show this page: clamped, and loaded — grouped, published.
 * - .setPageSize — Rows per page: page one, and a load.
 * - .reportPages — The grid's own page count, when every row is in hand: publish, load nothing.
 * - .regroup — The grouping moved: the page count a grouped view reported is dropped.
 * - .requery — The query changed: page one, then a load — live, once the moves stop.
 * - .loaded — Has any load completed?
 * - .result — The whole of the last load's answer.
 * - .rows — The last load's rows, LIVE.
 * - .unpaged — Every row the View's filter leaves, unpaged, for a bind over every row.
 * - .freeRows — Every row under the View less its clauses on these fields.
 * - .hasFree — Has a bind free of these fields its rows?
 * - .groups — The groups in force: each value, and how many rows carry it.
 * - .load — Re-read, and publish the answer if it is still the latest asked.
 * - .reask — Ask the store — or the held set — this question, even one asked before.
 * - .hold — Hold the store's whole set, where it can be.
 * - .loadAll — Every row, in one load: kept until the rows change, where the store is local.
 * - .walkRows — The rows a walk reads: the held set or a local store's scan, the rows kept, or null.
 * - .cheap — Can the walk run without asking the store?
 * - .scans — Does it scan its rows in place?
 * - .every — Every row the Query leaves, unpaged: what "Select all rows" ticks.
 * - .reach — Can its store be reached?
 * - .failure — Why the store could not be reached, while it cannot, else null.
 * - .recheck — Try the store again.
 * - .close — Let the store go: a change no longer reloads it, and its held set is dropped.
 * - .debug — How it answers, for a bug report.
 */
import { filterWithout, groupSummaries, type Filter, type GroupSummary, type LoadOptions, type LoadResult, type Row, type Store, type StoreCapabilities, type StoreChangeDetail } from './store.js';
import { sameFilter, VIEW, type Arrangement } from './query.js';
import { coalesce, Latest } from './timing.js';
import { report } from './report.js';
import { heldOf, type HeldStore } from './held-store.js';
import { failureOf, unreached, type Failure } from './failure.js';
import { startSpan, type TraceContext } from './trace.js';
import type { DataChangeDetail, ViewState } from './data-source-types.js';

/** What the reads ask their source, live, at each ask. */
export interface ReadHost {
  /** The filter the Query compiles to, and the View's alone. TRAP T-only-the-view-trickles-down */
  filter(): Filter | undefined;
  viewFilter(): Filter | undefined;
  /** Each component scope's own answer. */
  scoped(): Readonly<Record<string, Filter>>;
  /** How the rows are arranged. */
  arrangement(): Arrangement;
  /** Is any bind asking for the unpaged set? TRAP T-a-summary-binds-to-all-the-rows */
  wantsAllRows(): boolean;
  /** Each set of fields a bind is free of. TRAP T-a-chart-is-free-of-its-own-field */
  freeSets(): string[][];
  /** The fields its page reads from a row, or null — every field. */
  need(): readonly string[] | null;
  /** Before a load: what the walk sets aside, where it asks no store. `still`: the ask is the latest; `walked`: the filter may have moved. */
  beforeLoad(still: () => boolean): Promise<'walked' | 'none' | 'overtaken'>;
  /** A load's rows landed. */
  landed(rows: readonly Row[]): void;
  /** Push rows and state to every bound component. */
  publish(): void;
  /** A load was published: count again. */
  published(): void;
  /** Say an event on the source. */
  emit(event: Event): void;
  /** The store changed: `moved` says whether these fields did; `written`, the change as its store said it — none said, any row. */
  storeMoved(moved: (fields: readonly string[]) => boolean): void;
  written(change: StoreChangeDetail | undefined): void;
  /** A Refresh let the set go: what was asked of it is asked again. */
  refreshed(): void;
}

/** The store, and how its reads are asked. */
export interface ReadOptions {
  store: Store;
  /** The most rows it holds; 0 holds none. */
  holdRows: number;
  /** The clock its relative dates read, and whether one was named. */
  now: () => Date;
  pinned: boolean;
  pageSize: number | null;
  searchFields: readonly string[] | undefined;
  /** A live filter's wait after the last move, in ms. */
  debounce: number;
}

/** A source's reads: its reader, the page, each ask and its answer, and its reach. */
export class SourceReads {
  readonly store: Store;
  /** The source it reads for. */
  readonly #host: ReadHost;
  /* ── A remote store's whole set, held. Will, TODO 340 ─────────────────
   * TRAP T-a-remote-source-holds-its-whole-set · TRAP T-a-store-has-one-cache */
  /** The most rows it holds; 0 holds none. */
  readonly #holdRows: number;
  /** The clock its relative dates read. */
  readonly #now: () => Date;
  /** Was a clock named? Then each read says which. */
  readonly #pinned: boolean;
  /** The fields a search matches, or every field. */
  readonly #searchFields: readonly string[] | undefined;
  /** A live filter's wait after the last move, in ms. */
  readonly #debounce: number;
  /** The HeldStore it reads a remote store through, made here — none for a store
   *  that is local, holds its own, or a page that holds no rows. TRAP T-a-remote-store-is-read-through-a-held-store */
  readonly held: HeldStore | null;
  /** What every read asks: its own HeldStore, else the store. */
  readonly reader: Store;
  /** What its reader can do, read once. TRAP T-a-store-says-what-it-can-do-once */
  readonly can: StoreCapabilities;
  /** The page it shows. Sort, group and search are the Query's. */
  readonly #page: { page: number; pageSize: number | null };
  /** The last load's answer: the rows, and the total before paging. */
  #result: LoadResult = { rows: [], total: 0 };
  /**
   * Every row matching the filter, unpaged — for a `rows: 'all'` bind. Loaded
   * only when one exists, so a view with no summary asks the store once as
   * before. TRAP T-a-summary-binds-to-all-the-rows
   */
  #allRows: readonly Row[] = [];
  /**
   * The page count a GROUPED view reported; `null` until the first draw.
   * TRAP T-grouped-paging-belongs-to-the-view
   */
  #viewPages: number | null = null;
  // TRAP T-in-flight-ticket-discards-stale — three keys, and why not one.
  /** The load in flight, as a ticket the response is checked against. */
  #inFlight = new Latest();
  /** The ViewState the last COMPLETED load asked for, serialised. */
  #lastLoadKey: string | null = null;
  /** Has any load completed? Until one has, nothing may be skipped. */
  #loaded = false;
  /** The key of the load currently in flight. */
  #inFlightKey: string | null = null;
  /** The key the load in flight was ASKED with, before the walk set picks aside. */
  #inFlightAsked: string | null = null;
  /** Its last ask failed and the store could not be reached: nothing to show. */
  #down: Failure | null = null;

  constructor(options: ReadOptions, host: ReadHost) {
    this.store = options.store;
    this.#host = host;
    this.#holdRows = options.holdRows;
    this.#now = options.now;
    this.#pinned = options.pinned;
    this.#searchFields = options.searchFields;
    this.#debounce = options.debounce;
    this.#page = { page: 1, pageSize: options.pageSize };
    this.held = heldOf(this.store, { cap: this.#holdRows, need: () => host.need(), waits: false });
    this.reader = this.held ?? this.store;
    this.can = this.reader.capabilities;
    this.#heard = this.reader.history?.seq ?? 0;
    // A held source hears its store through its HeldStore, which says each change its set took, and each set.
    this.reader.addEventListener('change', this.#onStoreChange);
  }

  /** Do its loads reach outside the data layer? */
  get remote(): boolean {
    return !!this.can.remote;
  }

  /** The view state: the Query's arrangement, the page, and the compiled filter. A copy. */
  get state(): ViewState {
    const { sort, group, search, sortSuspended } = this.#host.arrangement();
    const state: ViewState = { sort, group, search, ...this.#page, ...(sortSuspended ? { sortSuspended } : {}) };
    const filter = this.#host.filter();
    return structuredClone(filter ? { ...state, filter } : state);
  }

  /** The page shown, and its size. */
  get page(): { page: number; pageSize: number | null } {
    return { ...this.#page };
  }

  /**
   * Pages at the current size, at least 1. GROUPED, it is what the grid
   * reported — a shut group is one screen line.
   * TRAP T-grouped-paging-belongs-to-the-view
   */
  get totalPages(): number {
    const size = this.#page.pageSize;
    if (!size) return 1;
    if (this.#host.arrangement().group && this.#viewPages != null) return Math.max(1, this.#viewPages);
    return Math.max(1, Math.ceil(this.#result.total / size));
  }

  /** Which page to show — asked of the Query: `ask({ page })`. */
  setPage(page: number): void {
    // Clamped against the CURRENT total, so a pager cannot walk past the end.
    this.#page.page = Math.min(Math.max(1, Math.trunc(page) || 1), this.totalPages);
    /* GROUPED: publish, never load. Grouped loads send no skip/take, so every
       page shares one state key and the no-op guard would eat the publish.
       TRAP T-grouped-page-change-publishes-without-loading */
    if (this.#host.arrangement().group) {
      this.#host.publish();
      return;
    }
    this.#schedule();
  }

  /** Rows per page — asked of the Query: `ask({ pageSize })`. */
  setPageSize(size: number): void {
    this.#page.pageSize = Math.max(1, Math.trunc(size) || 1);
    this.requery();
  }

  /** The grid's own page count, when every matching row is already in hand:
   *  the pager's numbers publish again, and nothing loads. */
  reportPages(pages: number): void {
    const next = Math.max(1, Math.trunc(pages));
    const clamped = Math.min(this.#page.page, next);
    if (next === this.#viewPages && clamped === this.#page.page) return;
    this.#viewPages = next;
    this.#page.page = clamped;
    this.#host.publish();
  }

  /** The old count was measured against the OLD grouping: dropped, until the next
   *  draw. TRAP T-grouped-paging-belongs-to-the-view */
  regroup(): void {
    this.#viewPages = null;
  }

  /**
   * The query CHANGED, so start over: back to page one, then load.
   *
   * Six setters wrote these two calls in this order, which is six chances for
   * a seventh to write one and forget the other — a filter that narrows while
   * the pager still points at page four.
   */
  requery(live = false): void {
    this.#page.page = 1;
    if (live) this.#settle();
    else this.#schedule();
  }

  /** LIVE: load once the moves stop — `debounce` ms after the last. The app
   *  chose the wait, per source. Will, TODO 107. TRAP T-coalesce-microtask-not-debounce */
  #settle(): void {
    clearTimeout(this.#liveWait);
    this.#liveWait = setTimeout(() => this.#schedule(), this.#debounce);
  }
  /** The live load waiting for the moves to stop. */
  #liveWait: ReturnType<typeof setTimeout> | undefined;

  /** COALESCE one tick's writes into a single load. TRAP T-coalesce-microtask-not-debounce */
  #schedule = coalesce((): void => void this.load());

  /** Has any load completed? Before one, there is nothing to count or group. */
  get loaded(): boolean {
    return this.#loaded;
  }

  /** The whole of the last load's answer. A shallow copy: its `rows` is the live array. TRAP T-result-is-the-hosts-half */
  get result(): LoadResult {
    return { ...this.#result };
  }

  /** The last load's rows — one page when paged. LIVE, not a copy: read it, never change it. */
  get rows(): readonly Row[] {
    return this.#result.rows;
  }

  /** Every row the View's filter leaves, unpaged — for a bind over every row. */
  get unpaged(): readonly Row[] {
    return this.#allRows;
  }

  /** Every row under the View less its clauses on these fields; none read, the unpaged rows. TODO 479 */
  freeRows(fields: readonly string[]): readonly Row[] {
    return this.#freeRows.get(fields.join('\n'))?.rows ?? this.#allRows;
  }

  /** Has a bind free of these fields its rows? */
  hasFree(fields: readonly string[]): boolean {
    return this.#freeRows.has([...fields].sort().join('\n'));
  }

  /**
   * THE GROUPS IN FORCE — each value, and how many rows carry it.
   *
   * A GROUP IS A DATA CONCEPT, the same way a data PAGE is. A grid draws a
   * group as a heading row and collapses it, exactly as it pages screen lines
   * — that is the VIEW's half, and neither makes the grid the owner. Counted
   * over every matching row, so a group split across a page boundary still
   * says how many rows it holds.
   * TRAP T-a-group-is-a-data-layer-concept · TRAP T-grouped-paging-belongs-to-the-view
   */
  groups(field: string = this.#host.arrangement().group ?? ''): GroupSummary[] {
    if (!field) return [];
    if (!this.#loaded) {
      /* NOT LOADED YET. An empty answer here reads as "no groups", which is
         indistinguishable from a field nothing carries.
         TRAP T-a-broken-assumption-reports */
      report({
        code: 'not-loaded',
        message: 'groups() was asked before the first load, so it has nothing to count.',
        at: { field },
      });
      return [];
    }
    /* The rows a component SHOWS: an unwindowed load is those, under every
       scope. The unpaged rows are the VIEW's alone, so they stand in only for a page.
       TRAP T-a-group-is-a-data-layer-concept */
    const whole = this.#host.arrangement().group != null || this.#page.pageSize == null;
    const rows = !whole && this.#allRows.length ? this.#allRows : this.#result.rows;
    return groupSummaries(rows, field);
  }

  /** The ViewState as one comparable string. Key order is stable by construction.
   *  A bind over the unpaged rows reads the View's filter and each scope's own,
   *  so a move between them — the shared filter the same — loads again. 366 step 7 */
  #stateKey(): string {
    const unpaged = this.#host.wantsAllRows() ? [this.#host.viewFilter() ?? null, this.#host.scoped()] : null;
    // The day too: "last 7 days" means other rows tomorrow. TRAP T-a-rule-names-its-clock-and-its-language
    return JSON.stringify([this.#day(), ...(unpaged ? [this.#loadOptions(), unpaged] : [this.#loadOptions()])]);
  }

  /** Today, as a relative date reads it. */
  #day(): string {
    return this.#now().toISOString().slice(0, 10);
  }

  /** Build the load options the store is asked with. */
  #loadOptions(): LoadOptions {
    const { page, pageSize } = this.#page;
    const { sort, group, search } = this.#host.arrangement();
    const filter = this.#host.filter();
    const options: LoadOptions = this.#pinned ? { now: this.#now() } : {};
    if (filter) options.filter = filter;
    if (sort.length) options.sort = sort;
    if (group) options.group = group;
    if (search) {
      options.search = search;
      if (this.#searchFields) options.searchFields = [...this.#searchFields];
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
  load(options: { force?: boolean } = {}): Promise<LoadResult> {
    // Skip a load that would ask the same question twice. `force` is how a load
    // that MUST happen says so.
    // TRAP T-no-op-load-guard
    // TRAP T-in-flight-ticket-discards-stale — ANSWERED and ASKED are separate.
    // FORCED: the rows may have changed, so a held set is read again.
    if (options.force) {
      this.#age++;
      this.#rowsAge++;
      this.#letGo();
    }
    const key = this.#stateKey();
    if (!options.force) {
      /* ANSWERED only while nothing else is in flight. A DIFFERENT load in
         flight will land and overwrite the answer, so a request back to the
         last finished one must still run — skipping it lost the reader's
         filter for good. TRAP T-in-flight-ticket-discards-stale */
      if (key === this.#lastLoadKey && this.#loaded && !this.#inFlight.busy) return Promise.resolve(this.#result);
      /* ASKED: the caller waits for THAT answer. Handed the result of the load
         BEFORE it, `await source.load()` came back with no rows while the
         first load was still out. TRAP T-an-asked-load-is-awaited */
      if ((key === this.#inFlightKey || key === this.#inFlightAsked) && this.#asking) return this.#asking;
    }
    return this.reask(key);
  }

  /** The rows changed under an identical ViewState — or a whole set landed: asked
   *  again. A held set has taken the change already — or is due, and read once for
   *  every page. TRAP T-a-held-set-takes-a-change-in-place · TRAP T-a-store-has-one-cache */
  #onStoreChange = (event: Event): void => {
    this.#rowsAge++;
    this.#allAge++;
    this.#host.written((event as CustomEvent<StoreChangeDetail | undefined>).detail);
    const history = this.reader.history;
    const since = this.#heard;
    this.#heard = history?.seq ?? 0;
    // Not in a History it can trust: any field may have moved.
    if (!history || !this.#trusts(event, since)) {
      this.#age++;
      // A store that holds its set has taken the change: asked again once it has answered, never read again. S6
      if (!this.can.holds) void this.load({ force: true });
      else if (this.#loaded || this.#inFlight.busy) void this.reask();
      return;
    }
    // The walk runs again only when a field it reads, or the rows, moved. TRAP T-a-change-redoes-only-what-reads-it
    this.#host.storeMoved((reads) => history.changedSince(since, reads));
    void this.reask();
  };

  /** Is this change in the store's History, from a store that hears every writer?
   *  A held store says what changed only where its set took it, and it can vouch
   *  for the set. TRAP T-a-change-redoes-only-what-reads-it */
  #trusts(event: Event, since: number): boolean {
    const history = this.reader.history;
    if (!history || history.seq <= since || !this.can.announcesAll) return false;
    return !!(event as CustomEvent<unknown>).detail;
  }
  /** The store's History as this source last heard it. */
  #heard = 0;
  /** Moves on every store change: the unpaged rows are read again. */
  #allAge = 0;
  /** Moves each time what a count or an unpaged read reads may have changed beside
   *  the Query: the rows, a field's facts or values, a saved filter, a part, a set. */
  #age = 0;

  /** What a count reads besides the Query, as it stands. */
  get age(): number {
    return this.#age;
  }

  /** Something a count reads moved beside the Query: a field's facts or values, a part, a set. */
  aged(): void {
    this.#age++;
  }

  /** Moves each time the rows may have changed. */
  #rowsAge = 0;

  /** The rows' age, as it stands. */
  get rowsAge(): number {
    return this.#rowsAge;
  }

  /**
   * Can its store be reached? `ok`; `unreached` — the store could not be reached,
   * and the last rows it gave are shown, unconfirmed; `down` — it could not be
   * reached, and there is nothing to show. A refusal (401) is not this: the
   * store was reached. TRAP T-a-failed-read-keeps-the-last-set
   */
  get reach(): 'ok' | 'unreached' | 'down' {
    if (this.#down) return 'down';
    const failure = this.#staleBy();
    return failure && unreached(failure) ? 'unreached' : 'ok';
  }

  /** Why the store could not be reached, while it cannot — its kind and message — else null. */
  get failure(): Failure | null {
    return this.#down ?? (this.reach === 'unreached' ? this.#staleBy() : null);
  }

  /** Why the rows shown are unconfirmed, as its store that holds says. D8 */
  #staleBy(): Failure | null {
    return this.#closed ? null : this.reader.stale ?? null;
  }

  /** Try the store again: `down`, a fresh read; `unreached`, a read behind the rows
   *  shown, with no loading; `ok`, its own held set is asked what moved where its
   *  store may miss a writer, and one held elsewhere checks behind — newer rows
   *  wait, and are said (S6c). A page's retry, its tab shown, `online`.
   *  TRAP T-a-remote-store-says-what-changed */
  recheck(): void {
    const reach = this.reach;
    if (reach === 'down') {
      void this.load({ force: true });
      return;
    }
    const reader = this.reader;
    if (this.#closed || !reader.recheck) return;
    if (reach === 'ok' && this.held && (this.held.plan !== 'held' || !reader.changes || this.can.announcesAll)) return;
    const asks = this.#asks;
    // The rows stay, and say they are unconfirmed, until the read lands: then they are asked anew.
    void reader.recheck().then(() => {
      if (reach !== 'unreached' || asks !== this.#asks) return;
      this.#age++;
      this.#rowsAge++;
      void this.reask();
    });
  }

  /** Closed: it no longer hears its store, and holds nothing. */
  #closed = false;

  /** Closed: it hears nothing, and holds nothing. */
  get closed(): boolean {
    return this.#closed;
  }

  /**
   * Let the store go: a change no longer reloads it. It can still be asked —
   * the store itself, never the shared set. The store's held set STAYS, for the
   * next page over it. TRAP T-a-closed-source-hears-nothing
   */
  close(): void {
    this.#closed = true;
    this.held?.close();
    this.reader.removeEventListener('change', this.#onStoreChange);
    this.#abort?.abort();
    clearTimeout(this.#liveWait);
  }

  /** Ask the store — or the held set — this question, even one asked before. */
  reask(key = this.#stateKey()): Promise<LoadResult> {
    this.#asks++;
    const asking = this.#ask(key);
    this.#asking = asking;
    return asking;
  }
  /** How many asks it has made. */
  #asks = 0;

  /** Hold the store's whole set, where it can be: one read for every page over
   *  it — under `trace`, the span of the load that asks. TRAP T-a-remote-source-holds-its-whole-set
   *  TRAP T-a-store-has-one-cache */
  hold(trace?: TraceContext): Promise<void> {
    return this.held?.hold(trace) ?? Promise.resolve();
  }

  /** A Refresh: its own held set is read again before it is used — never by a closed
   *  source. A store that holds its set elsewhere reads its source again, and the next ask waits. D8 */
  #letGo(): void {
    if (this.#closed) return;
    /* …newer rows that wait are taken in first; with none waiting, it reads again.
       Refresh data. S6c */
    const store = this.reader;
    if (this.held) this.held.letGo();
    else if (this.can.holds) {
      this.#freshen = store.take
        ? store.take().then((took) => (took ? undefined : store.recheck?.()))
        : store.recheck?.() ?? null;
    }
    this.#host.refreshed();
  }

  /** A store that holds its own set, reading its source again for a Refresh. */
  #freshen: Promise<void> | null = null;
  /** This page has had the set of a store that holds its own checked once. */
  #confirmed = false;

  /** The load in flight, for a caller that asks the same question again. */
  #asking: Promise<LoadResult> | null = null;
  /** What an ask that stops resolves with: the ask that overtook it, else the answer in hand. */
  #newest = (ticket: symbol): LoadResult | Promise<LoadResult> => (!this.#inFlight.is(ticket) && this.#asking) || this.#result;
  /** What stops the ask in flight, once a newer one supersedes it. */
  #abort: AbortController | null = null;

  /** Ask the store, and publish the answer if it is still the latest asked. */
  async #ask(asked: string): Promise<LoadResult> {
    let key = asked;
    const ticket = this.#inFlight.next();
    this.#inFlightKey = this.#inFlightAsked = key;
    // The ask it supersedes stops: its reads abort their fetch. TRAP T-a-superseded-read-stops
    this.#abort?.abort();
    const { signal } = (this.#abort = new AbortController());
    this.#host.emit(new CustomEvent('loading', { detail: { loading: true } }));
    /* A load says its start and end on the one trace stream, and its reads run
       under it, passed: a span cannot cross an `await`. TRAP T-one-trace-stream */
    const span = startSpan('load');
    const traced = span ? { trace: span } : {};

    try {
      await this.hold(span ?? undefined);
      // A Refresh of a store that holds its own set waits for it to read again.
      if (this.#freshen) await this.#freshen.catch(() => undefined).finally(() => { this.#freshen = null; });
      /* A new page over a store that holds its set elsewhere — one that may miss a
         writer — has that set checked behind once, as its own HeldStore checks its
         set (D8): its rows answer at once, and are asked again when the check lands. */
      else if (!this.held && this.can.holds && !this.can.announcesAll && !this.#confirmed) {
        this.#confirmed = true;
        void this.reader.recheck?.().then(() => {
          this.#age++;
          this.#rowsAge++;
          void this.reask();
        });
      }
      // Overtaken while it waited: the newer ask answers, and this one asks no one.
      if (!this.#inFlight.is(ticket)) return await this.#newest(ticket);
      /* What the filters before each pick rule out is set aside BEFORE the load,
         where the walk asks no store: ONE load, right first time.
         TRAP T-one-walk-counts-and-limits-in-order */
      const before = await this.#host.beforeLoad(() => this.#inFlight.is(ticket));
      if (before === 'overtaken') return await this.#newest(ticket);
      if (before === 'walked') {
        // Whoever set them aside — this ask, or a walk beside it — the load asks what stands now.
        key = this.#stateKey();
        this.#inFlightKey = key;
      }
      const result = await this.reader.load({ ...this.#loadOptions(), signal, ...traced });
      // Not the latest → DISCARDED, and the key recorded only by the winner. TRAP T-an-asked-load-is-awaited
      if (!this.#inFlight.is(ticket)) return await this.#newest(ticket);
      this.#result = result;
      this.#lastLoadKey = key;
      this.#loaded = true;
      this.#host.landed(result.rows);

      /* A SUMMARY sees every matching row. When nothing was windowed the page
         IS everything, so the second ask is skipped.
         TRAP T-a-summary-binds-to-all-the-rows */
      /* …under the VIEW alone: a component scope narrows its own components,
         never a summary beside them. TRAP T-only-the-view-trickles-down */
      const windowed = this.#page.pageSize != null && !this.#host.arrangement().group;
      const viewed = this.#host.viewFilter();
      // A search in a component scope is its components' too, never a summary's. Will, TODO 519
      const { search, scope: searchedAt } = this.#host.arrangement();
      const searchedHere = !!search && searchedAt !== VIEW;
      const split = !sameFilter(viewed, this.#host.filter()) || searchedHere;
      const underView = (): LoadOptions => {
        const { skip: _skip, take: _take, filter: _filter, ...rest } = this.#loadOptions();
        if (searchedHere) { delete rest.search; delete rest.searchFields; }
        return rest;
      };
      if (!this.#host.wantsAllRows() || (!windowed && !split)) {
        this.#allRows = this.#host.wantsAllRows() ? result.rows : [];
        this.#allFor = '';
      } else {
        const rest = underView();
        const asked = viewed ? { ...rest, filter: viewed } : rest;
        // The same question over the same rows — a page turned — is not asked again.
        const allKey = JSON.stringify([this.#age, this.#allAge, asked]);
        if (allKey !== this.#allFor) {
          const all = await this.reader.load({ ...asked, signal, ...traced });
          if (!this.#inFlight.is(ticket)) return await this.#newest(ticket);
          this.#allRows = all.rows;
          this.#allFor = allKey;
        }
      }
      /* …and each set a chart is FREE of: the View's rows less its clauses on
         them. TRAP T-a-chart-is-free-of-its-own-field */
      const sets = this.#host.freeSets();
      for (const key of [...this.#freeRows.keys()]) if (!sets.some((f) => f.join('\n') === key)) this.#freeRows.delete(key);
      for (const fields of sets) {
        const rest = underView();
        const without = filterWithout(viewed, new Set(fields));
        const asked = without ? { ...rest, filter: without } : rest;
        const freeKey = JSON.stringify([this.#age, this.#allAge, asked]);
        if (this.#freeRows.get(fields.join('\n'))?.key === freeKey) continue;
        const free = await this.reader.load({ ...asked, signal, ...traced });
        if (!this.#inFlight.is(ticket)) return await this.#newest(ticket);
        this.#freeRows.set(fields.join('\n'), { key: freeKey, rows: free.rows });
      }

      // Re-clamp and reload ONCE, FORCED. Never while GROUPED: the page count
      // there is the GRID's to report, and the re-load would ask the same thing.
      // TRAP T-error-is-a-state-not-a-throw
      // TRAP T-grouped-paging-belongs-to-the-view
      const pages = this.totalPages;
      if (!this.#host.arrangement().group && this.#page.pageSize && this.#page.page > pages) {
        this.#page.page = pages;
        return this.reask();
      }

      this.#host.publish();
      // Empty, or no matches: the data layer says which. TRAP T-a-container-shows-its-datas-state
      const emptiness = result.total > 0 ? undefined : this.#host.filter() || this.#host.arrangement().search ? 'no-matches' : 'empty';
      // Unconfirmed, as the set stands NOW: a check that landed meanwhile confirmed it.
      const stale = !!this.held?.unconfirmed;
      this.#down = null;
      this.#host.emit(
        new CustomEvent<DataChangeDetail>('change', {
          detail: { ...result, state: this.state, ...(emptiness ? { emptiness } : {}), ...(stale ? { stale: true as const } : {}) },
        }),
      );
      this.#host.published();
      return result;
    } catch (error) {
      // TRAP T-error-is-a-state-not-a-throw — a stale failure raises nothing; nor does a closed source.
      if (!this.#inFlight.is(ticket) || this.#closed) return await this.#newest(ticket);
      // …and says what KIND it was. TRAP T-a-failure-has-a-kind
      const failure = failureOf(error);
      this.#down = unreached(failure) ? failure : null;
      this.#host.emit(new CustomEvent('error', { detail: { error, failure } }));
      return this.#result;
    } finally {
      span?.end({ rows: this.#result.rows.length, total: this.#result.total });
      if (this.#inFlight.end(ticket)) {
        this.#inFlightKey = this.#inFlightAsked = null;
        this.#asking = null;
        this.#host.emit(new CustomEvent('loading', { detail: { loading: false } }));
      }
    }
  }

  /** What the unpaged rows were last read for. */
  #allFor = '';
  /** Each set a chart is free of: its rows, and what they were read for. TODO 479 */
  #freeRows = new Map<string, { key: string; rows: readonly Row[] }>();

  /** Every row, in one load; kept until the rows change, where the store is local
   *  and the set not too big to keep. */
  async loadAll(): Promise<readonly Row[]> {
    const age = this.#rowsAge;
    const { rows } = await this.reader.load({});
    // The walk reads these rows too, until they change. TRAP T-one-walk-counts-and-limits-in-order
    if (!this.remote && age === this.#rowsAge && rows.length <= this.#holdRows) this.#rowsCache = { age, rows };
    return rows;
  }

  /** The rows a walk reads, as the plan says: the held set, in place; a local
   *  store's scan, or one load per change; null — ask the store step by step. */
  async walkRows(): Promise<readonly Row[] | null> {
    await this.hold();
    // A held set is walked in place; a remote store not held is asked.
    const scan = this.#scan;
    if (scan) return scan();
    if (this.remote) return null;
    if (this.#rowsCache?.age === this.#rowsAge) return this.#rowsCache.rows;
    return this.loadAll();
  }

  /** A store with no scan, loaded once per change. */
  #rowsCache: { age: number; rows: readonly Row[] } | null = null;

  /** Can the walk run without asking the store — a held set, a store that
   *  scans, or rows kept since the last change? Then it runs before the load. */
  get cheap(): boolean {
    return !!this.#scan || (!this.remote && this.#rowsCache?.age === this.#rowsAge);
  }

  /** Does it scan its rows in place? */
  get scans(): boolean {
    return !!this.#scan;
  }

  /** Its rows in place, where they are: a local store's, or a held set's while it
   *  answers — never a remote store's read directly. */
  get #scan(): (() => Promise<readonly Row[]>) | undefined {
    return this.remote && !this.can.holds ? undefined : this.reader.scan?.bind(this.reader);
  }

  /** Every row the Query leaves, UNPAGED: what "Select all rows" ticks. TODO 238 */
  async every(): Promise<readonly Row[]> {
    const { skip: _skip, take: _take, ...options } = this.#loadOptions();
    await this.hold();
    return (await this.reader.load(options)).rows;
  }

  /** How it answers, and its held set, for a bug report. */
  debug(): ReturnType<HeldStore['debugState']> {
    return this.held?.debugState() ?? { plan: 'store' };
  }
}
