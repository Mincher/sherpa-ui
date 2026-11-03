/**
 * source-walk.ts — the walk a DataSource keeps: one per Query, shared by every
 * reader of it, what it rules out set aside, and what it counts drawn on each
 * control. Its pure halves are walk.ts and source-counts.ts. DOM-free.
 * TRAP T-one-walk-counts-and-limits-in-order
 *
 * Map:
 * - WalkHost — What the walk asks its source, live.
 * - WalkDrawn — One control a walk draws, and the scopes it draws.
 * - SourceWalk — One walk per Query: its counts, what it rules out, and each control drawn them.
 * - .aside — The picks set aside, by scope then field, as value keys.
 * - .last — The last walk, while it stands.
 * - .limitOptions — Does each list field offer only the values the filters before it leave?
 * - .countEvery — Is every value of a list field counted, picked or not?
 * - .key — What a walk reads besides the rows, as one string.
 * - .walked — The walk for the Query as it stands: one per key; a walk that fails keeps the last one.
 * - .takeAside — Take the walk's set-aside picks. Says whether they moved.
 * - .rewalk — Walk, set aside what it rules out, then draw what it gives.
 * - .soon — One walk this tick, however many asked.
 * - .storeMoved — The store changed: the walk runs again where a field it reads moved.
 * - .results — Each answered chip's results in a scope.
 * - .valueResults — Each picked value's own results in a scope.
 * - .present — Each list field's values its ruler leaves in a scope.
 * - .offered — What each field below the top of a serial set offers.
 */
import { emptyWalk, walkInOrder, walkReads, type Walk } from './walk.js';
import { planWalk, walkStepwise, type WalkFacts } from './source-counts.js';
import { coalesce, Latest } from './timing.js';
import type { Query } from './query.js';
import type { Row, Store } from './store.js';
import type { BoundControl } from './data-source-types.js';

/** What the walk asks its source, live. */
export interface WalkHost {
  /** What a walk reads besides the rows and its own settings: the Query, the parts,
   *  the bound scopes, what each scope offers. */
  keyOf(): unknown[];
  /** The Query a walk counts under, and what its plan needs that the Query does not say. */
  applied(): Query;
  facts(): Omit<WalkFacts, 'limit' | 'countAll'>;
  /** The rows a walk reads; null — the store is asked step by step. */
  rows(): Promise<readonly Row[] | null>;
  /** The store a walk asks step by step. */
  reader(): Store;
  closed(): boolean;
  /** The filters before a field rule these picks out: they leave its answer. */
  letGo(scope: string, field: string, keys: readonly string[]): void;
  /** What the walk set aside moved: compile again. True when that asked again. */
  asideMoved(): boolean;
  /** The controls a walk draws. */
  drawn(): WalkDrawn[];
  /** Each part's scope, and the scope whose bar draws it. TODO 670 */
  parts(): Array<[string, string | undefined]>;
  /** The parts a scope's bar draws. */
  partsIn(scope: string): string[];
  /** Does an answer in this scope filter? */
  filtering(scope: string): boolean;
  /** Say an event on the source. */
  emit(event: Event): void;
}

/** One control a walk draws, and the scopes it draws: one, a bar's; several, the panel's. */
export interface WalkDrawn {
  control: BoundControl;
  id: string;
  scopes: string[];
  bar: boolean;
}

/** One walk per Query: its counts, what it rules out, and each control drawn them. */
export class SourceWalk {
  /** The source it counts for. */
  readonly #host: WalkHost;

  constructor(host: WalkHost, options: { limitOptions?: boolean } = {}) {
    this.#host = host;
    this.#limitOptions = options.limitOptions ?? false;
  }

  /** The last walk, what it was for, and the fields it read. */
  #walk: { key: string; walk: Walk; reads: readonly string[] } | null = null;
  /** A walk that failed, standing in for the last one. */
  #unwalked = new WeakSet<Walk>();
  /** The walk in flight, what it is for, and the fields it reads. */
  #walking: { key: string; walk: Promise<Walk>; reads: readonly string[] } | null = null;
  /** Moves when a store change moved a field the walk reads, or the rows. */
  #walkAge = 0;
  /** The picks set aside, by scope then field, as value keys. */
  #setAside = new Map<string, Record<string, string[]>>();

  /** The picks set aside, by scope then field, as value keys. */
  get aside(): ReadonlyMap<string, Record<string, string[]>> {
    return this.#setAside;
  }

  /** The last walk, while it stands, or null. */
  get last(): Walk | null {
    return this.#walk?.walk ?? null;
  }

  /* ── What the filters BEFORE a field leave — Will, TODOs 174 and 349 ────
   * TRAP T-a-ruled-out-value-is-greyed */

  /** Does each list field offer only the values the filters before it leave? Settable at any time. */
  get limitOptions(): boolean {
    return this.#limitOptions;
  }
  set limitOptions(on: boolean) {
    if (on === this.#limitOptions) return;
    this.#limitOptions = on;
    this.soon();
  }
  /** The setting: does each list field offer only what the others leave? */
  #limitOptions = false;

  /** Every value of a list field is counted, picked or not, on or off — where
   *  the rows are held: a store is never asked once per value. Will, TODO 466 */
  get countEvery(): boolean {
    return this.#countEvery;
  }
  set countEvery(on: boolean) {
    if (on === this.#countEvery) return;
    this.#countEvery = on;
    this.soon();
  }
  /** The setting: count every value? */
  #countEvery = false;

  /** What a walk reads besides the rows: the Query, the setting, the parts, the
   *  bound scopes, what each scope offers, and the picks set aside. */
  key(): string {
    return JSON.stringify([this.#walkAge, this.#limitOptions, this.#countEvery, ...this.#host.keyOf()]);
  }

  /** The walk's plan, from the applied Query. */
  #plan(): ReturnType<typeof planWalk> {
    return planWalk(this.#host.applied(), {
      ...this.#host.facts(), limit: this.#limitOptions, ...(this.#countEvery ? { countAll: true } : {}),
    });
  }

  /** The walk for the Query as it stands: one per key, shared by every reader of
   *  it. A walk that fails keeps the last one — it never stops a load. */
  async walked(): Promise<Walk> {
    // A closed source walks nothing: the page is gone.
    if (this.#host.closed()) return this.#walk?.walk ?? emptyWalk();
    const key = this.key();
    if (this.#walk?.key === key) return this.#walk.walk;
    if (this.#walking?.key === key) return this.#walking.walk;
    const plan = this.#plan();
    // Nothing to count or tally: no row is read.
    if (!plan.scopes.some((sc) => sc.taps.length || sc.steps.some((st) => st.counts || st.each?.length || st.countAll || st.ruler || st.offers))) {
      this.#walk = { key, walk: emptyWalk(), reads: [] };
      return this.#walk.walk;
    }
    const reads = [...new Set(Object.values(walkReads(plan)).flatMap((r) => [...r.tested, ...r.tallied]))];
    const entry: { key: string; walk: Promise<Walk>; reads: string[] } = { key, walk: Promise.resolve(emptyWalk()), reads };
    entry.walk = (async (): Promise<Walk> => {
      try {
        const rows = await this.#host.rows();
        const out = rows ? walkInOrder(rows, plan) : await walkStepwise(this.#host.reader(), plan);
        if (this.key() === key) this.#walk = { key, walk: out, reads };
        return out;
      } catch {
        /* The last walk stays drawn, and nothing is set aside from it; kept for
           this key, so a draw does not ask again until something moves. It never stops a load. */
        const kept = { ...(this.#walk?.walk ?? emptyWalk()) };
        this.#unwalked.add(kept);
        if (this.key() === key) this.#walk = { key, walk: kept, reads };
        return kept;
      } finally {
        if (this.#walking === entry) this.#walking = null;
      }
    })();
    this.#walking = entry;
    return entry.walk;
  }

  /** The store changed: a walk that reads a field that moved — or one that failed — runs again.
   *  TRAP T-a-change-redoes-only-what-reads-it */
  storeMoved(moved: (fields: readonly string[]) => boolean): void {
    const w = this.#walk;
    if ((w && (this.#unwalked.has(w.walk) || moved(w.reads))) || (this.#walking && moved(this.#walking.reads))) this.#walkAge++;
  }

  /** Take the walk's set-aside picks. Says whether they moved. */
  takeAside(walk: Walk): boolean {
    // A walk that failed sets nothing aside: what an older Query set aside goes too.
    const next = this.#unwalked.has(walk) ? new Map<string, Record<string, string[]>>()
      : new Map(Object.entries(walk.aside).filter(([, fields]) => Object.keys(fields).length));
    const key = (m: Map<string, Record<string, string[]>>): string => JSON.stringify([...m].sort());
    if (key(next) === key(this.#setAside)) return false;
    this.#setAside = next;
    /* …and LET GO, not kept: a ruled-out pick leaves the answer, so the chip, its
       menu and the rows agree, and clearing the filter before it brings nothing
       back. After this act, as the rows have them out already. Will, TODO 512 (A) */
    if (next.size) {
      queueMicrotask(() => {
        for (const [scope, fields] of next) for (const [field, keys] of Object.entries(fields)) this.#host.letGo(scope, field, keys);
      });
    }
    return true;
  }

  /** Walk, and set aside what it rules out — compiling again, and asking again
   *  only when that moved what a load reads — then draw what it gives. */
  async rewalk(): Promise<void> {
    const key = this.key();
    const walk = await this.walked();
    // The Query moved while it walked: the walk for what stands now decides.
    if (this.key() !== key) {
      this.soon();
      return;
    }
    if (this.takeAside(walk) && this.#host.asideMoved()) return;
    void this.#draw();
  }

  /** One walk this tick, however many asked. */
  readonly soon = coalesce((): void => {
    void this.rewalk();
  });

  /** Each bound control is drawn what the walk gives its scopes — each chip's
   *  results, each value's, what each list field's ruler leaves, what each
   *  serial field offers — once per walk and set of controls; a later walk
   *  wins. A chart part's goes out as `present`, for its legend (179). */
  async #draw(): Promise<void> {
    const drawn = this.#host.drawn();
    const parts = this.#host.parts();
    if (!drawn.length && !parts.length) return;
    // Drawn already, for this walk and these controls: a sort, a page or a search moves nothing.
    const key = JSON.stringify([this.key(), drawn.map(({ id, scopes }) => [id, scopes]), parts]);
    if (key === this.#drawnFor) return;
    this.#drawnFor = key;
    const ticket = this.#drawing.next();
    const walk = await this.walked();
    if (!this.#drawing.is(ticket)) return;
    // Drawn from a walk that failed: the next draw draws again.
    if (this.#unwalked.has(walk)) this.#drawnFor = '';
    const lists = (of: Record<string, string[]> | undefined): Record<string, string[]> =>
      Object.fromEntries(Object.entries(of ?? {}).map(([f, keys]) => [f, [...keys]]));
    for (const { control: el, scopes, bar } of drawn) {
      for (const scope of scopes) {
        // A bar draws the parts it shows with its own: their counts and limits too. Will, TODO 670
        const also = bar ? this.#host.partsIn(scope) : [];
        const own = <T>(of: Readonly<Record<string, T | undefined>>): T => Object.assign({}, of[scope], ...also.map((p) => of[p])) as T;
        el.drawResults?.({ ...own(walk.results) }, scope, this.#host.filtering(scope) ? walk.ends[scope] : undefined);
        // A control that draws a chip per VALUE is told each picked value's own too.
        el.drawValueResults?.(Object.fromEntries(Object.entries(own(walk.values) ?? {}).map(([f, v]) => [f, { ...v }])), scope);
        el.drawPresent?.(lists(own(walk.present)), scope);
        el.drawOffered?.(lists(own(walk.offered)), scope);
      }
    }
    const byScope = Object.fromEntries([...new Set([...drawn.flatMap((d) => d.scopes), ...parts.map(([p]) => p)])]
      .map((scope) => [scope, lists(walk.present[scope])]));
    this.#host.emit(new CustomEvent('present', { detail: { byScope } }));
  }
  /** The latest draw; an older one lands on nothing. */
  #drawing = new Latest();
  /** What the controls were last drawn for: the walk and the controls. */
  #drawnFor = '';

  /**
   * Each answered chip's RESULTS in a scope: the rows that reach it — its
   * scopes, and the filters BEFORE it in the one order — and match its answer.
   * By field, or saved-filter id; from the APPLIED Query, so a draft has none.
   * OFF, it still says what it would match (123); a SAVED filter only while ON
   * (166). Will, TODOs 60 and 348.
   * TRAP T-a-chip-counts-within-the-filters-before-it
   */
  async results(scope: string): Promise<Record<string, number>> {
    return { ...(await this.walked()).results[scope] };
  }

  /**
   * Each PICKED value's own results in a scope: the rows that reach its field
   * and match that ONE value — by field, then by value. Only a plain pick in
   * force has values to count: rows, a range, a field that is off or held above
   * have none. Will, TODO 172.
   */
  async valueResults(scope: string): Promise<Record<string, Record<string, number>>> {
    return Object.fromEntries(Object.entries((await this.walked()).values[scope] ?? {}).map(([f, byValue]) => [f, { ...byValue }]));
  }

  /**
   * Each list field's values its RULER leaves in a scope, as value keys: with
   * Limit, the rows at its place — its scopes and the filters BEFORE it; without,
   * a component scope's the View's subset (347), and the View's nothing. A field
   * no chip holds is tallied where it would stand (349).
   * TRAP T-a-ruled-out-value-is-greyed
   */
  async present(scope: string): Promise<Record<string, string[]>> {
    return Object.fromEntries(Object.entries((await this.walked()).present[scope] ?? {}).map(([f, keys]) => [f, [...keys]]));
  }

  /**
   * What each field below the top of a SERIAL set OFFERS: the values the rows
   * hold at its place, once anything before it narrows, as value keys. A control
   * REMOVES the rest, and a pick it held is let go (TODO 512). Whatever
   * `limitOptions` says. TRAP T-a-filter-set-groups-or-chains
   */
  async offered(scope: string): Promise<Record<string, string[]>> {
    return Object.fromEntries(Object.entries((await this.walked()).offered[scope] ?? {}).map(([f, keys]) => [f, [...keys]]));
  }
}
