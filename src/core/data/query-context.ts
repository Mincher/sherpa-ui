/**
 * query-context.ts — the Query of one app Context, and what its page declares
 * about it. Every source over the page joins it, so there is one Query.
 * DOM-free. TRAP T-one-query-one-owner · TRAP T-a-context-holds-the-only-query
 *
 * Map:
 * - QueryChange — What the context did, as each member hears it.
 * - QueryMember — What a source tells the context it joins.
 * - QueryChangeDetail — What `query-change` says: the fields whose answers moved, and the scopes whose holds or arrangement did.
 * - MemberBind — How a member bound a control.
 * - QueryLive — The Query and the declarations, live: written in place, never copied.
 * - QueryHandle — What a member holds of its context.
 * - QueryContext — The Query of one app Context, shared by every source in it. Fires `query-change`.
 * - .applied — The Query the rows are under. A copy.
 * - .draft — What the reader is editing. A copy.
 * - .remote — Does any member's store wait for Apply?
 * - .members — How many sources share this Query.
 * - .reading — One scope's reading of one field, or undefined. The Query's own, frozen.
 * - .scope — The fields a scope holds, in order — hold()'s read-back.
 * - .scopes — Every scope that holds a field, by id.
 * - .holds — Is this field held HERE?
 * - .scopeOf — Which scope holds this field, or null.
 * - .fields — The fields a scope may hold.
 * - .canHold — May this scope hold this field?
 * - .declareStart — declareStart(scope, readings) — a scope's answers at the start, as its page defines them: in force now, what…
 * - .defaultFor — A component's own default, as `declareDefault` left it — not its answer now.
 * - .partFacts — What `declarePart` was told for this scope, or undefined.
 * - .scopeFacts — What `declareScope` was told — not the fallbacks `scopeLabel()` and `arranges()` answer with.
 * - .scopeLabel — A scope's name as a reader sees it, or its id.
 * - .arranges — Does Group and Sort arrange this scope's rows?
 * - .sets — A scope's filter sets, as declared.
 * - .waiting — Does this scope — or, naming none, any — wait for Apply?
 * - .wait — This scope's answers wait for Apply, local or remote.
 * - .named — Did `wait()` name this scope? Its bar holds ONE Apply for it.
 * - .pending — Has this field been changed and not yet applied?
 * - .dirty — Has anything in this scope — or any scope — been changed and not applied?
 * - .declarePart — Declare a PART: one field that narrows one component — a chart's legend field.
 * - .declareScope — Name a scope as a reader sees it, and say if it arranges.
 * - .declareSets — A scope's filter sets, in order.
 * - .offer — Say which fields a component scope HAS.
 * - .declareDefault — A component's OWN default filter — readings that narrow `only` it — as its scope in the Query.
 * - .suspend — Switch answers off and on, keeping each: one field's, or every answer in a scope.
 * - .hold — Say what a scope holds now.
 * - .order — Put some of a scope's fields in this order; the rest keep their places.
 * - .move — Move a filter between scopes — ONE call, because the removal is not optional.
 * - .release — A scope lets ONE field go.
 * - .take — A scope TAKES fields: down from the View, or up from a chart with its answer.
 * - .setReading — ONE field's answer — at its home, or a component's own; the answer in force is a no-op.
 * - .letGo — The filters before a field rule these picks out: they leave its answer, applied and drafted alike.
 * - .declarePresets — A scope's presets: the app's own named conditions, each a boolean chip.
 * - .presets — A scope's presets, in order: each its id, its name and the readings it writes.
 * - .presetOn — Is this preset on: every row it writes still in its field's answer, in force?
 * - .presetsOver — The scopes whose presets write this field: its answer moving moves their on.
 * - .setPreset — A scope's preset on or off: the app's own named conditions, beside the fields'.
 * - .reset — Clear all, Reset all: every answer homed in these scopes goes.
 * - .batch — The doors one act calls are ONE change to the page.
 * - .commit — SEND the draft — Apply, where a scope waits.
 * - .discard — Put the applied answers back over the draft — Discard, where a scope waits.
 * - .highlighted — The chip that drives the highlight, if one does.
 * - .highlight — Make a field's chip the highlight's driver, or let it go.
 * - .previewed — The chip hovered, while it previews the highlight.
 * - .preview — Preview a field's chip as the driver, or stop: never in the Query.
 * - .setSort — Order by one field, or stop; `null` suspends.
 * - .resumeSort — Resume the suspended sort.
 * - .clearSort — Forget the sort entirely — the gesture that is NOT a suspend.
 * - .setGroup — Group by a field, or stop.
 * - .presentation — A slot's presentation, as kept: a copy; none, an empty one.
 * - .declarePresentation — What its page DEFINES a slot shows — a chart's two fields — under what is kept.
 * - .presented — A slot's presentation as shown: what is kept, over its definition; or its definition alone.
 * - .present — Change a slot's presentation, at once in BOTH copies — it filters nothing, so no Apply waits.
 * - .setSearch — The rows' free-text search, with the arrangement.
 * - .setQuery — Restore a whole Query — a reload, a View, a saved filter.
 * - .startWith — The answer a field opens on where nothing answers it — a fetching list's first value.
 * - .export — The whole question as JSON — the Query as applied.
 * - .import — Take a question back in, exactly.
 * - .join — A source joins: it gets its handle.
 */
import type { BoundControl, FilterSet, QueryState } from './data-source-types.js';
import {
  answerOf, arrangementOf, copyQuery, copyReading, eachScope, emptyScope, freezeReading, readingAnswered, sameReading, stripArrangement, VIEW,
  type Arrangement, type Presentation, type PresentationDefinition, type Query, type QueryDefaults, type ScopeQuery,
} from './query.js';
import {
  answerIn, copyField, copyScope, definitionOf, holderOf, holdsField, homes, moveHold, prune, readingOf, rehome,
  copyHolds, sameField, sameScope, scopeEntry, setCameFrom, setReading,
} from './query-edits.js';
import { readingsOf, type Where } from './where.js';
import { valueKey, type SortDirection, type SortSpec } from './store.js';
import { asRows, holdsRows, modeOf, withRows, withoutRows, type FieldReading, type RuledOut } from './filter-state.js';
import { report } from './report.js';

/** What the context did, as each member hears it: the follow-ups are the member's. */
export type QueryChange =
  | { kind: 'part'; scope: string; field?: string }
  | { kind: 'sets'; scope: string }
  | { kind: 'offer'; scope: string }
  | { kind: 'write'; scope: string; field: string; narrows: string[] }
  | { kind: 'select'; field: string }
  | { kind: 'hold'; scope: string; moved: string[] }
  | { kind: 'move'; scopes: string[]; moved: boolean }
  /** The Query moved: compile it. */
  | { kind: 'recompose' }
  /** Only the highlight's driver moved: mark again, and load nothing. TODO 449 */
  | { kind: 'mark' }
  /** Only a scope's ORDER moved: count again in it. TODO 452 */
  | { kind: 'order'; scope: string }
  /** A scope's preset went on or off. TODO 493 */
  | { kind: 'preset'; scope: string }
  | { kind: 'commit' }
  /** Each field is drawn its answer; then a scope's bars, or each control's pending. */
  | { kind: 'drawn'; fields: string[]; bars?: string; pending?: true }
  | { kind: 'bars'; scope: string }
  /** The rows were re-arranged: page one, and a load. */
  | { kind: 'arranged'; group: boolean }
  /** A slot's presentation moved: its chart is asked again; no row moves. TODO 548 */
  | { kind: 'presented'; scope: string }
  /** A whole Query came in, over `was`; `before` are the fields answered before. Settles once drawn. */
  | { kind: 'query'; was: Arrangement; before: string[] };

/** What a source tells the context it joins. */
export interface QueryMember {
  /** Its store waits for Apply. */
  readonly remote: boolean;
  /** Does it draw a page of rows in this scope? */
  pagedIn(scope: string): boolean;
  /** How it bound this control, if it did. */
  bindOf(el: BoundControl): MemberBind | undefined;
  /** What the context did: its follow-ups. Called at once, in join order. */
  heard(change: QueryChange): void | Promise<void>;
  /** Does it know this field? */
  has(field: string): boolean;
  /** Does this field keep its answer across Views? TRAP T-a-field-can-carry-over-views */
  carriesOver(field: string): boolean;
  /** A View's plain conditions as readings, by its field types. */
  readingsOf(where: Where): Record<string, FieldReading>;
  /** The values its rows hold for these picks: a KEY maps to its value. TRAP T-a-value-can-be-an-object */
  raws(field: string, picked: readonly unknown[]): unknown[];
  /** Its last walk's test of a field's value keys in a scope: why one is ruled out, null if it stands. */
  ruledOut?(scope: string, field: string): ((key: string) => RuledOut) | undefined;
}

/** A change to the arrangement: what it names, and nothing else. */
type ArrangeEdit = { sort?: SortSpec[]; group?: string | null; sortSuspended?: SortSpec | undefined; search?: string };

/** What `query-change` says: the fields whose answers moved, and the scopes
 *  whose holds or arrangement did — and, for a whole Query put on, who put it:
 *  `by` is the caller's own tag, which a keeper reads. 366 step 24 */
export interface QueryChangeDetail {
  fields: string[];
  scopes: string[];
  by?: string;
}

/** A scope keeps no answer for this field now. */
function forget(scope: ScopeQuery, field: string): void {
  if (!scope.superseded?.[field]) return;
  Reflect.deleteProperty(scope.superseded, field);
  if (!Object.keys(scope.superseded).length) delete scope.superseded;
}

/** How a member bound a control. */
export interface MemberBind {
  id: string;
  rows: 'page' | 'all';
  scope?: string | readonly string[];
}

/** The Query and the declarations, live: written in place, never copied. */
export interface QueryLive {
  /**
   * THE QUERY — which scope holds each field, and each field's reading, in the
   * reader's terms. One reading per field, in the scope that holds it.
   * TRAP T-one-query-one-owner · TRAP T-one-field-one-filter-menu
   */
  applied: Query;
  /** What the reader is EDITING. With no remote member it IS `applied`; else a
   *  copy that Apply sends. TRAP T-apply-and-discard-wait-for-a-change */
  draft: Query;
  /** Each component's OWN default filter, by its scope.
   *  TRAP T-a-component-default-outlives-a-view */
  readonly defaults: Map<string, ScopeQuery>;
  /** Each scope's answers at the start, as its page defines them. TODO 464 */
  readonly starts: Map<string, ScopeQuery>;
  /** Each scope's name as a reader sees it. */
  readonly labels: Map<string, string>;
  /** Each scope's own word on whether it arranges. */
  readonly arranges: Map<string, boolean>;
  /** Each scope's filter sets. */
  readonly sets: Map<string, FilterSet[]>;
  /** What each COMPONENT scope has — its own fields. */
  readonly offers: Map<string, string[]>;
  /** Each PART: the one field it answers, and the one component it narrows.
   *  TRAP T-a-chart-scope-is-its-legend-field */
  readonly parts: Map<string, { field: string; only: BoundControl; label?: string }>;
}

/** What a member holds of its context. */
export interface QueryHandle {
  /** The live Query and declarations. Read only: every edit is the context's. */
  live(): Readonly<QueryLive>;
  /** A bind id no other member has made. */
  mintId(): string;
  /** Moves with each declaration a walk reads — a part, a set. */
  walkVersion(): number;
  /** Does any member draw a page of rows in this scope? */
  pagedIn(scope: string): boolean;
  /** How any member bound this control. */
  bindOf(el: BoundControl): MemberBind | undefined;
  /** Leave the context. */
  leave(): void;
}

/**
 * The Query of one app Context, shared by every source in it. After each
 * change, once every member has heard it, it fires ONE `query-change`.
 * 366 step 17 · TRAP T-one-query-one-owner
 */
export class QueryContext extends EventTarget {
  /** The one Query, and the declarations. */
  readonly #live: QueryLive;
  /** Every source that joined. */
  readonly #members = new Set<QueryMember>();
  /** Binds made, for an id when the element has none. */
  #binds = 0;
  /** Declarations a walk reads: a part, a set. */
  #walks = 0;
  /** What a batch has to tell, until it ends. */
  #batched: QueryChangeDetail | null = null;
  /** The Applies a batch asked for: sent at its end, after every edit in it. */
  #applies: Array<{ scope?: string; field?: string }> = [];

  constructor() {
    super();
    const applied: Query = { v: 1, scopes: {} };
    this.#live = {
      applied, draft: applied,
      defaults: new Map(), starts: new Map(), labels: new Map(), arranges: new Map(), sets: new Map(), offers: new Map(), parts: new Map(),
    };
  }

  /** The Query the rows are under. A copy. */
  get applied(): Query {
    return structuredClone(this.#live.applied);
  }

  /** What the reader is editing. A copy. */
  get draft(): Query {
    return structuredClone(this.#live.draft);
  }

  /** Does any member's store wait for Apply? */
  get remote(): boolean {
    return [...this.#members].some((m) => m.remote);
  }

  /** How many sources share this Query. */
  get members(): number {
    return this.#members.size;
  }

  /** One scope's reading of one field, or undefined. The Query's own, frozen.
   *  TRAP T-a-reading-is-frozen-in-the-query */
  reading(scope: string, field: string): FieldReading | undefined {
    const held = this.#live.draft.scopes[scope]?.readings[field];
    return held ? freezeReading(held) : undefined;
  }

  /** The fields a scope HOLDS, in order — `hold()`'s read-back. A copy. */
  scope(name: string): string[] {
    return [...(this.#live.draft.scopes[name]?.holds ?? [])];
  }

  /** Every scope that holds a field, by id — `scope()` reads one of them. */
  get scopes(): string[] {
    return Object.keys(this.#live.draft.scopes).filter((id) => this.#live.draft.scopes[id]!.holds.length);
  }

  /** Is this field held HERE? */
  holds(name: string, field: string): boolean {
    return holdsField(this.#live.draft, name, field);
  }

  /**
   * Which scope holds this field, or null — the View first, when it does.
   *
   * This is what SUPERSEDING is: a field the view scope holds is not the data
   * bar's to narrow, and neither bar has to know the other is there.
   */
  scopeOf(field: string): string | null {
    return holderOf(this.#live.draft, field);
  }

  /**
   * The fields a scope may hold. A COMPONENT's are its own; the VIEW's are
   * every component's, because any field may be raised to narrow everything.
   */
  fields(name: string): string[] {
    if (name === VIEW) return [...new Set([...this.#live.offers.values()].flat())];
    return [...(this.#live.offers.get(name) ?? [])];
  }

  /** May this scope hold this field? Up is open; down is closed. */
  canHold(name: string, field: string): boolean {
    return name === VIEW || (this.#live.offers.get(name) ?? []).includes(field);
  }

  /**
   * declareStart(scope, readings) — a scope's answers at the start, as its page
   * defines them: in force now, what Reset to default puts back, and where a View
   * or a restore that does not name the scope starts it. Unlike a component's
   * own default, the scope stays the reader's. Will, TODO 464.
   * TRAP T-a-page-scope-starts-with-its-answers
   */
  declareStart(scope: string, readings: Readonly<Record<string, FieldReading>>): void {
    for (const [field, reading] of Object.entries(readings)) this.#write(scope, field, reading);
    const written = this.#live.draft.scopes[scope];
    if (!written) return;
    const start = structuredClone(written);
    for (const r of Object.values(start.readings)) freezeReading(r);
    this.#live.starts.set(scope, Object.freeze(start));
  }

  /** A component's own default, as `declareDefault` left it, or undefined — not
   *  its answer now, which `reading()` reads. Frozen. TRAP T-a-reading-is-frozen-in-the-query */
  defaultFor(scope: string): Readonly<Record<string, FieldReading>> | undefined {
    return this.#live.defaults.get(scope)?.readings;
  }

  /** What `declarePart` was told for this scope, or undefined. `only` is the element itself. */
  partFacts(scope: string): { field: string; only: BoundControl; label?: string } | undefined {
    const part = this.#live.parts.get(scope);
    return part ? { ...part } : undefined;
  }

  /** What `declareScope` was told — not the fallbacks `scopeLabel()` and `arranges()` answer with. */
  scopeFacts(scope: string): { label?: string; arranges?: boolean } {
    const label = this.#live.labels.get(scope);
    const arranges = this.#live.arranges.get(scope);
    return { ...(label != null ? { label } : {}), ...(arranges != null ? { arranges } : {}) };
  }

  /** A scope's name as a reader sees it, or its id. */
  scopeLabel(scope: string): string {
    return this.#live.labels.get(scope) ?? scope;
  }

  /** Does Group and Sort arrange this scope's rows? As declared — else a
   *  component scope a page of rows is drawn in does, and the View does not.
   *  Will, TODO 99. TRAP T-group-and-sort-are-component-scope */
  arranges(scope: string): boolean {
    return this.#live.arranges.get(scope)
      ?? (scope !== VIEW && [...this.#members].some((m) => m.pagedIn(scope)));
  }

  /** A scope's filter sets, as declared. */
  sets(scope: string): FilterSet[] {
    return structuredClone(this.#live.sets.get(scope) ?? []);
  }

  /** Does this scope — or, naming none, any — wait for Apply? A remote member's
   *  do; a local one's, once `wait()` named it. TODO 406 */
  waiting(scope?: string): boolean {
    return this.remote || (scope ? this.#waiting.has(scope) : this.#waiting.size > 0);
  }

  /**
   * wait(scope) — this scope's answers wait for Apply, local or remote: a write
   * lands in the draft, and `commit()` sends it. The app waits its View, so no
   * pick fetches until the reader asks. `false` sends what waits. TODO 406
   * TRAP T-apply-and-discard-wait-for-a-change
   */
  wait(scope: string, on = true): void {
    if (on === this.#waiting.has(scope)) return;
    if (!on) {
      this.commit({ scope });
      this.#waiting.delete(scope);
      if (!this.#waiting.size && !this.remote) this.#live.draft = this.#live.applied;
      // Told AFTER: the commit's drawing still said it waits. TODO 436
      this.#tell({ kind: 'drawn', fields: [], pending: true });
      return;
    }
    this.#waiting.add(scope);
    if (this.#live.draft === this.#live.applied) this.#live.draft = copyQuery(this.#live.applied);
    this.#tell({ kind: 'drawn', fields: [], pending: true });
  }

  /** Did `wait()` name this scope? Its bar holds ONE Apply for it; a remote
   *  scope it did not name keeps each menu's own. TODO 406 */
  named(scope: string): boolean {
    return this.#waiting.has(scope);
  }

  /** The scopes `wait()` named. */
  readonly #waiting = new Set<string>();

  /** A LOCAL draft: a scope that does not wait is in force at once, and so is
   *  what each scope holds. A remote one keeps its own rule. TODO 406 */
  #settle(): void {
    const { draft, applied } = this.#live;
    if (this.remote || draft === applied) return;
    for (const id of new Set([...Object.keys(draft.scopes), ...Object.keys(applied.scopes)])) {
      if (!this.#waiting.has(id)) copyScope(draft, applied, id);
    }
    copyHolds(draft, applied);
  }

  /** Fields that MOVED scope carry their answer at once, waiting or not.
   *  TRAP T-up-is-open-down-is-closed */
  #carry(fields: readonly string[]): void {
    if (this.remote || this.#live.draft === this.#live.applied) return;
    for (const field of fields) copyField(this.#live.draft, this.#live.applied, field);
  }

  /** Has this field been changed and not yet applied? Never, where nothing waits. */
  pending(field: string): boolean {
    if (!this.waiting()) return false;
    return !sameReading(answerIn(this.#live.applied, field), answerIn(this.#live.draft, field));
  }

  /** Has anything in this scope — or in any scope — been changed and not applied?
   *  Field by field, as `pending` reads: the order they were written in is no change. */
  dirty(scope?: string): boolean {
    if (!this.waiting()) return false;
    const { applied, draft } = this.#live;
    const ids = scope ? [scope] : [...new Set([...Object.keys(applied.scopes), ...Object.keys(draft.scopes)])];
    return ids.some((id) => {
      const was = applied.scopes[id]?.readings ?? {};
      const now = draft.scopes[id]?.readings ?? {};
      return [...new Set([...Object.keys(was), ...Object.keys(now)])].some((f) => !sameReading(was[f], now[f]));
    });
  }

  /**
   * Declare a PART — the scope of ONE field that narrows ONE component, a
   * chart's legend field — so a panel draws it before it is answered, and a
   * write to it from anywhere narrows that component. `undefined` forgets it.
   * TRAP T-a-chart-scope-is-its-legend-field
   */
  declarePart(scope: string, part: { field: string; only: BoundControl; label?: string } | undefined): void {
    this.#walks++;
    const parts = this.#live.parts;
    if (part) parts.set(scope, part);
    else parts.delete(scope);
    /* A part keeps the place it was first given: a chart swapped by Show as binds
       its legend again, and its panel section must not move. Will, TODO 548 */
    if (!this.#partOrder.includes(scope)) this.#partOrder.push(scope);
    const placed = [...parts].sort(([a], [b]) => this.#partOrder.indexOf(a) - this.#partOrder.indexOf(b));
    parts.clear();
    for (const [key, value] of placed) parts.set(key, value);
    this.#tell({ kind: 'part', scope, ...(part ? { field: part.field } : {}) });
  }
  /** Each part's scope, in the order first declared. */
  readonly #partOrder: string[] = [];

  /** Name a scope as a reader sees it — a panel's section, an Add list's note — and say if it arranges. */
  declareScope(scope: string, facts: { label?: string; arranges?: boolean }): void {
    if (facts.label != null) this.#live.labels.set(scope, facts.label);
    if (facts.arranges != null) this.#live.arranges.set(scope, facts.arranges);
  }

  /** A scope's filter sets, in order. A field is in one set at most; a second
   *  is left out, and said. TRAP T-a-filter-set-groups-or-chains */
  declareSets(scope: string, sets: readonly FilterSet[]): void {
    this.#walks++;
    const taken = new Set<string>();
    this.#live.sets.set(scope, sets.map((set) => ({
      ...structuredClone(set),
      fields: set.fields.filter((field) => {
        if (!taken.has(field)) {
          taken.add(field);
          return true;
        }
        report({
          code: 'field-in-two-sets',
          message: `declareSets: "${field}" is in two of scope "${scope}"'s sets; it stays in the first.`,
          at: { scope, set: set.id, field },
        });
        return false;
      }),
    })));
    this.#tell({ kind: 'sets', scope });
  }

  /** Say which fields a component scope HAS. The view needs none: up is open. */
  offer(name: string, fields: readonly string[]): void {
    const next = [...new Set(fields)];
    const before = this.#live.offers.get(name);
    if (before && before.length === next.length && before.every((f, i) => f === next[i])) return;
    if (next.length) this.#live.offers.set(name, next);
    else this.#live.offers.delete(name);
    this.#tell({ kind: 'offer', scope: name });
  }

  /**
   * Write ONE scope's reading of ONE field — a component's own answer, which no
   * other control shares. `only` makes the scope NARROW that one bound
   * component: a legend's switched-off series filter ITS chart, and nothing
   * else. Its rows must be EVERY matching row — one page would lie about the
   * total. `undefined` removes the reading.
   * TRAP T-a-component-part-narrows-one-component · TRAP T-one-query-one-owner
   */
  #write(scope: string, field: string, reading: FieldReading | undefined, at: { only?: BoundControl } = {}): void {
    // A declared part narrows its own component, whoever writes it — a panel too.
    const only = at.only ?? this.#live.parts.get(scope)?.only;
    const bind = only ? this.#bindOf(only) : undefined;
    if (reading && only && bind?.rows !== 'all') {
      report({
        code: 'component-part-on-a-page',
        message: 'write: a scope that narrows one component needs a bound `rows: "all"` component.',
        at: { scope, field },
      });
      return;
    }
    const entry = scopeEntry(this.#live.draft, scope);
    if (bind) entry.narrows = [bind.id];
    if (reading && readingAnswered(reading)) {
      entry.readings[field] = copyReading(answerOf(reading));
      if (!entry.holds.includes(field)) entry.holds = [...entry.holds, field];
    } else {
      Reflect.deleteProperty(entry.readings, field);
      entry.holds = entry.holds.filter((f) => f !== field);
    }
    const narrows = entry.narrows ?? [];
    prune(this.#live.draft);
    /* A scope that narrows ONE component filters rows already here — no fetch,
       so no Apply, even with a remote member. */
    if (this.remote && narrows.length) copyScope(this.#live.draft, this.#live.applied, scope);
    this.#tell({ kind: 'write', scope, field, narrows });
  }

  /**
   * A component's OWN default filter — readings that narrow `only` it — as its
   * scope in the Query. It is put back under any Query that does not name that
   * scope, so a View pick keeps it; `undefined` forgets it and its scope.
   * TRAP T-a-component-default-outlives-a-view
   */
  declareDefault(
    scope: string,
    readings: Readonly<Record<string, FieldReading>> | undefined,
    at: { only?: BoundControl } = {},
  ): void {
    const was = this.#live.draft.scopes[scope]?.readings ?? {};
    if (!readings) {
      this.#live.defaults.delete(scope);
      for (const field of Object.keys(was)) this.#write(scope, field, undefined);
      return;
    }
    // Its OWN before the first write compiles, so a View-held field cannot set it aside.
    this.#live.defaults.set(scope, emptyScope());
    for (const field of Object.keys(was)) if (!(field in readings)) this.#write(scope, field, undefined);
    for (const [field, reading] of Object.entries(readings)) this.#write(scope, field, reading, at);
    const written = this.#live.draft.scopes[scope];
    if (written) {
      const own = structuredClone(written);
      for (const r of Object.values(own.readings)) freezeReading(r);
      this.#live.defaults.set(scope, Object.freeze(own));
    } else this.#live.defaults.delete(scope);
  }

  /**
   * Select values for a FIELD, at its home scope. Every control over that
   * field reads the same answer back; an empty list clears it. `reading`
   * carries the rest of the question — the condition and its text.
   *
   * ONE SLOT PER FIELD. A component that narrows only ITSELF must `write()` its
   * own scope instead: a second writer here does not narrow, it REPLACES.
   * TRAP T-a-filter-applies-down-its-scope
   */
  #select(field: string, picked: readonly unknown[], reading: FieldReading = {}): void {
    this.#put(field, picked, reading);
    this.#tell({ kind: 'select', field });
  }

  /** Write a field's answer, telling no one. */
  #put(field: string, picked: readonly unknown[], reading: FieldReading = {}): void {
    // Its OWN copy: a caller that edits its object after changes nothing here.
    const next: FieldReading = copyReading(this.#raw(field, picked, reading));
    /* CONDITIONS count. A field answered only by rows has no picked values and
       no typed text. TRAP T-many-conditions-are-one-reading */
    setReading(this.#live.draft, field, readingAnswered(next) ? next : undefined);
  }

  /**
   * A bar's filter Switch. OFF stops every answer in force in this scope,
   * keeping each; ON brings back exactly those. While it is off,
   * nothing comes into force there. TRAP T-the-filter-switch-keeps-what-it-turned-off
   */
  #suspendScope(scope: string, suspended = true): void {
    if (suspended === !!this.#live.draft.scopes[scope]?.suspended) return;
    const entry = scopeEntry(this.#live.draft, scope);
    let fields: string[];
    if (suspended) {
      // Each answer drops what the filters before it rule out, as one field's OFF does. TODO 523 F3
      const dropped: string[] = [];
      for (const [field, reading] of Object.entries(entry.readings)) {
        const kept = reading.suspended ? null : this.#standing(scope, field, reading);
        if (!kept || kept.length >= (reading.picked?.length ?? 0)) continue;
        this.#put(field, kept, kept.length ? reading : {});
        dropped.push(field);
      }
      entry.suspended = { fields: [] };
      // Compiling lists what the Switch turned off.
      this.#tell({ kind: 'recompose' });
      fields = [...new Set([...entry.suspended.fields, ...dropped])];
    } else {
      const off = entry.suspended!;
      delete entry.suspended;
      fields = off.fields.filter((f) => f in entry.readings);
      for (const f of fields) {
        const { suspended: _off, ...on } = entry.readings[f]!;
        entry.readings[f] = on;
      }
      prune(this.#live.draft);
      this.#tell({ kind: 'recompose' });
    }
    // The Switch is its scope's Apply, remote too.
    this.commit({ scope });
    this.#tell({ kind: 'drawn', fields, bars: scope });
    // Its sort and group go off and on with it: the rows are arranged again. Will, TODO 398
    if (entry.sort?.length || entry.group) this.#tell({ kind: 'arranged', group: !!entry.group });
  }

  /**
   * Switch answers OFF and on, keeping each: one field's, at its home, or —
   * `null` — every answer in a scope, its bar's Switch. On gives the same
   * reading back; a field already so changes nothing.
   * TRAP T-the-filter-switch-keeps-what-it-turned-off · TRAP T-grid-suspend-is-not-clear
   */
  suspend(scope: string, field: string | null, off: boolean): void {
    if (field === null) {
      this.#suspendScope(scope, off);
      return;
    }
    const held = readingOf(this.#live.draft, field);
    if (!held || !!held.suspended === off) return;
    const { suspended: _was, ...on } = held;
    if (!off) return this.#select(field, held.picked ?? [], on);
    const kept = this.#standing(homes(this.#live.draft).get(field) ?? scope, field, held);
    // None left, the field clears.
    if (held.picked?.length && !kept.length) this.#select(field, []);
    else this.#select(field, kept, { ...on, suspended: true });
  }

  /** A field's picks less those the filters before it rule out: going OFF, they go —
   *  they could never come back on (TODO 462). Conditions stay. Will, TODOs 465, 523 F3 */
  #standing(scope: string, field: string, reading: FieldReading): unknown[] {
    const picked = reading.picked ?? [];
    const out = modeOf(reading) === 'advanced' ? undefined : this.#knows(field)?.ruledOut?.(scope, field);
    return out ? picked.filter((v) => out(valueKey(v)) === null) : [...picked];
  }

  /** Say what a scope holds now. An empty list forgets the scope. */
  hold(name: string, fields: readonly string[]): void {
    const next = [...fields];
    const before = this.#live.draft.scopes[name]?.holds ?? [];
    // A no-op must not wake every listener — a bar re-renders on this.
    if (before.length === next.length && before.every((f, i) => f === next[i])) return;
    /* LET GO, and held nowhere else: its answer goes with it. Removing a chip
       is a clear. Cleared FIRST, while this scope still holds it, so the
       controls over this scope are drawn the clear. TRAP T-one-query-one-owner */
    const elsewhere = (field: string): boolean => eachScope(this.#live.draft)
      .some(([id, s]) => id !== name && s.holds.includes(field));
    for (const field of before) {
      if (!next.includes(field) && !elsewhere(field) && readingOf(this.#live.draft, field)) this.#select(field, []);
    }
    const draft = this.#live.draft;
    const entry = scopeEntry(draft, name);
    const added = next.filter((f) => !before.includes(f));
    const dropped = before.filter((f) => !next.includes(f));
    /* THE VIEW TAKES a field a component scope holds: that scope keeps its own
       answer, not in force — `{}` for none. One that lets a field go keeps none.
       Will, D2 A. TRAP T-a-superseded-chip-suspends-it-is-never-removed */
    if (name === VIEW) {
      for (const [id, s] of eachScope(draft)) {
        if (id === VIEW) continue;
        for (const f of added) if (s.holds.includes(f)) (s.superseded ??= {})[f] = copyReading(s.readings[f] ?? {});
      }
    } else for (const f of dropped) forget(entry, f);
    const was = homes(draft);
    entry.holds = next;
    rehome(draft);
    // …and LETS GO: its home below gets back the answer it kept, or clears.
    if (name === VIEW) for (const f of dropped) this.#giveBack(f);
    /* RAISING CARRIES THE ANSWER, and lowering brings it back: an answer that
       moved scope narrows from where it lives now, at once, and is drawn there.
       TRAP T-up-is-open-down-is-closed */
    const now = homes(draft);
    const moved = [...now].filter(([field, home]) => was.get(field) !== home).map(([field]) => field);
    this.#carry(moved);
    this.#tell({ kind: 'hold', scope: name, moved });
  }

  /** Put some of a scope's fields in this order, in the places they hold; the
   *  rest keep theirs. A reader dragged one. Will, TODO 452 */
  order(name: string, fields: readonly string[]): void {
    const holds = this.scope(name);
    const named = new Set(fields.filter((f) => holds.includes(f)));
    const next = [...named];
    const ordered = holds.map((f) => (named.has(f) ? next.shift()! : f));
    if (ordered.every((f, i) => f === holds[i])) return;
    // In both copies: an order is no answer to Apply.
    for (const query of new Set([this.#live.applied, this.#live.draft])) {
      const entry = query.scopes[name];
      if (entry) entry.holds = ordered.filter((f) => entry.holds.includes(f));
    }
    this.#tell({ kind: 'order', scope: name });
  }

  /** The View let go of a field: its home below gets back the answer it kept
   *  — or clears, for `{}` — and no scope keeps one for it now. */
  #giveBack(field: string): void {
    const draft = this.#live.draft;
    const home = holderOf(draft, field);
    for (const [id, s] of eachScope(draft)) {
      const kept = s.superseded?.[field];
      if (!kept) continue;
      forget(s, field);
      if (id !== home) continue;
      if (Object.keys(kept).length) s.readings[field] = kept;
      else Reflect.deleteProperty(s.readings, field);
    }
  }

  /**
   * Move a filter between scopes — ONE call, because the removal is not
   * optional: two `hold()`s could be interrupted between them.
   * RAISED to the view, it leaves EVERY component; LOWERED, it leaves the view
   * and lands in one component. Returns whether it moved; a component that
   * does not have the field refuses, and says so.
   */
  move(field: string, from: string, to: string): boolean {
    if (!this.canHold(to, field)) {
      report({
        code: 'scope-refused',
        message: 'move: a component scope may hold only its own fields.',
        at: { field, from, to, offers: (this.#live.offers.get(to) ?? []).join(',') },
      });
      return false;
    }
    const was = homes(this.#live.draft);
    const scopes = moveHold(this.#live.draft, field, from, to);
    rehome(this.#live.draft);
    // An answer that moved narrows from where it lives now, at once. TRAP T-up-is-open-down-is-closed
    const now = homes(this.#live.draft);
    const moved = [...now].filter(([f, home]) => was.get(f) !== home).map(([f]) => f);
    this.#carry(moved);
    this.#tell({ kind: 'move', scopes, moved: moved.length > 0 });
    return true;
  }

  /** A scope lets ONE field go. */
  release(scope: string, id: string): void {
    this.hold(scope, this.scope(scope).filter((f) => f !== id));
    this.#tell({ kind: 'bars', scope });
  }

  /** A scope TAKES fields — sent DOWN from the View to the one scope named,
   *  or UP from a chart with its answer. TRAP T-send-to-view-filters */
  take(scope: string, ids: readonly string[], from?: string): void {
    if (from === VIEW && scope !== VIEW) {
      for (const id of ids) this.#lower(id, scope);
      return;
    }
    if (scope === VIEW && from) for (const id of ids) this.#setCameFrom(id, from);
    const part = from ? this.#live.parts.get(from) : undefined;
    const answer = part && from ? this.reading(from, part.field) : undefined;
    this.#holdEach(scope, [...ids]);
    // The chart lets go of it: the View narrows every component now.
    if (part && answer && from && ids.includes(part.field)) {
      this.#write(from, part.field, undefined);
      this.#select(part.field, answer.picked ?? [], answer);
      this.commit();
      this.#tell({ kind: 'bars', scope });
    }
  }

  /** A scope holds each of these fields. */
  #holdEach(scope: string, ids: readonly string[]): void {
    const fields = ids.filter((id) => !this.holds(scope, id));
    if (fields.length) this.hold(scope, [...this.scope(scope), ...fields]);
    this.#tell({ kind: 'bars', scope });
  }

  /** Remember, or forget, where a View field came up from, in both copies. */
  #setCameFrom(field: string, from: string | undefined): void {
    for (const query of new Set([this.#live.draft, this.#live.applied])) setCameFrom(query, field, from);
  }

  /** SEND a View field DOWN: the View lets go of it, and its answer goes to
   *  the one scope named. TRAP T-send-to-view-filters */
  #lower(field: string, to: string): void {
    if (!this.holds(VIEW, field)) return;
    const answer = this.reading(VIEW, field);
    const part = this.#live.parts.get(to);
    if (!part && !this.canHold(to, field)) return;
    /* ONE SCOPE AT A TIME. A scope the field came up from still holds its
       place: each lets go first, while the View still holds the answer.
       Will, TODO 168. TRAP T-send-to-view-filters */
    for (const [id, scope] of eachScope(this.#live.draft)) {
      if (id === VIEW || id === to || !scope.holds.includes(field)) continue;
      this.hold(id, scope.holds.filter((f) => f !== field));
      this.#tell({ kind: 'bars', scope: id });
    }
    // Held BELOW first, so the answer moves there and is not cleared.
    if (!part && !this.holds(to, field)) this.hold(to, [...this.scope(to), field]);
    /* THE VIEW'S ANSWER WINS, whole — its mode and its rows: what a scope kept
       from before the field went up is dropped. TRAP T-send-to-view-filters */
    for (const [, s] of eachScope(this.#live.draft)) forget(s, field);
    this.hold(VIEW, this.scope(VIEW).filter((f) => f !== field));
    // A chart's own scope takes the picks; the View's answer went with its hold.
    if (part) this.#write(to, field, answer?.picked?.length ? { picked: [...answer.picked] } : undefined);
    this.#setCameFrom(field, undefined);
    this.commit();
    this.#tell({ kind: 'bars', scope: VIEW });
    if (!part) this.#tell({ kind: 'bars', scope: to });
  }

  /**
   * ONE FIELD'S ANSWER — what a control asks when the reader changes it. It
   * lands at the field's home. In a PART's scope, or with `only`, it is that
   * component's own answer, which narrows it alone. A field no scope holds is
   * first held in a component scope that may hold it; the View holds nothing
   * it is not given. The answer already in force changes nothing and tells no
   * one. `null` clears it. 366 step 18 · TRAP T-one-query-one-owner
   */
  setReading(scope: string, field: string, reading: FieldReading | null, at: { only?: BoundControl } = {}): void {
    if (at.only || this.#live.parts.has(scope) || this.#live.draft.scopes[scope]?.narrows?.length) {
      const next = reading && readingAnswered(reading) ? reading : undefined;
      if (sameReading(this.#live.draft.scopes[scope]?.readings[field], next)) return;
      this.#write(scope, field, next, at);
      return;
    }
    // A heading's answer to a field no scope holds is held in its grid's scope, and its bar draws the chip. TRAP T-a-heading-asks-through-the-source
    const fresh = !!reading && scope !== VIEW && !this.scopeOf(field) && this.canHold(scope, field);
    if (fresh) this.hold(scope, [...this.scope(scope), field]);
    const picked = reading?.picked ?? [];
    const next = this.#raw(field, picked, reading ?? {});
    if (!sameReading(readingOf(this.#live.draft, field), readingAnswered(next) ? next : undefined)) this.#select(field, picked, reading ?? {});
    if (fresh) this.#tell({ kind: 'bars', scope });
  }

  /**
   * letGo(scope, field, keys) — the filters before a field rule these picks out:
   * they leave its APPLIED answer, and no Apply is asked — the rows had them out
   * already. A draft follows only while it is still the applied answer: one the
   * reader changed is theirs. Will, TODO 512 (A); 518 · TRAP T-a-ruled-out-value-is-greyed
   */
  letGo(scope: string, field: string, keys: readonly string[]): void {
    const { applied, draft } = this.#live;
    const was = applied.scopes[scope]?.readings[field];
    const kept = was?.picked?.filter((v) => !keys.includes(valueKey(v)));
    if (!was || !kept || kept.length === was.picked!.length) return;
    if (draft !== applied && sameReading(draft.scopes[scope]?.readings[field], was)) {
      draft.scopes[scope]!.readings[field] = { ...was, picked: kept };
    }
    applied.scopes[scope]!.readings[field] = { ...was, picked: kept };
    // ONE compile: what is applied moved; then the field is drawn its answer.
    this.#tell({ kind: 'commit' });
    this.#tell({ kind: 'drawn', fields: [field] });
  }

  /**
   * declarePresets(scope, presets) — a scope's PRESETS: the app's own named
   * conditions, each a boolean chip that writes them into the fields. TODO 493, 510
   */
  declarePresets(scope: string, presets: readonly { id: string; label: string; readings: Readonly<Record<string, FieldReading>> }[]): void {
    this.#presets.set(scope, new Map(presets.map((p) => [p.id, { label: p.label, readings: structuredClone(p.readings) as Record<string, FieldReading> }])));
    this.#tell({ kind: 'preset', scope });
  }
  /** Each scope's presets, by id. */
  readonly #presets = new Map<string, Map<string, { label: string; readings: Record<string, FieldReading> }>>();

  /** A scope's presets, in order: each its id, its name and the readings it writes. */
  presets(scope: string): { id: string; label: string; readings: Readonly<Record<string, FieldReading>> }[] {
    return [...this.#presets.get(scope) ?? []].map(([id, p]) => ({ id, label: p.label, readings: p.readings }));
  }

  /** Is this preset ON: every row it writes still in its field's answer, in force —
   *  the draft's, or with `applied`, what the rows are under. TODO 510 */
  presetOn(scope: string, id: string, applied = false): boolean {
    const preset = this.#presets.get(scope)?.get(id);
    if (!preset) return false;
    const query = applied ? this.#live.applied : this.#live.draft;
    const entries = Object.entries(preset.readings).filter(([, given]) => asRows(given).length);
    // Each at its field's home, where setReading writes it.
    return entries.length > 0 && entries.every(([field, given]) => holdsRows(readingOf(query, field), asRows(given)));
  }

  /** The scopes whose presets write this field: its answer moving moves their on. */
  presetsOver(field: string): string[] {
    return [...this.#presets].filter(([, ps]) => [...ps.values()].some((p) => field in p.readings)).map(([scope]) => scope);
  }

  /**
   * setPreset(scope, id, on) — a preset ON writes its conditions into each field's
   * answer, at the field's home (or held here), ANDed with what it holds; OFF
   * takes them out. Its on is read from the fields — editing one away turns it
   * off. With `commit`, the fields it moved are applied at once. Will, TODO 510 (A)
   * TRAP T-a-preset-is-its-own-part
   */
  setPreset(scope: string, id: string, on: boolean, commit = false): void {
    const preset = this.#presets.get(scope)?.get(id);
    if (!preset || this.presetOn(scope, id) === on) return;
    this.batch(() => {
      const moved: string[] = [];
      for (const [field, given] of Object.entries(preset.readings)) {
        const rows = asRows(given);
        if (!rows.length) continue;
        // At its home — held here, where nothing holds it and this scope may.
        const home = this.scopeOf(field) ?? scope;
        const now = readingOf(this.#live.draft, field);
        if (!on && !now) continue;
        this.setReading(home, field, on ? withRows(now, rows) : withoutRows(now!, rows));
        moved.push(field);
      }
      if (commit) for (const field of moved) this.commit({ field });
    });
    this.#tell({ kind: 'preset', scope });
  }

  /** Clear all, Reset all: every answer homed in these scopes goes — a
   *  carry-over field's stays, with `carry` — and what a Switch turned off is
   *  forgotten; `organise` clears their sort and group too. The one door that
   *  clears what it does not name. TRAP T-a-field-can-carry-over-views */
  reset(scopes: readonly string[], options: { carry?: boolean; organise?: boolean } = {}): void {
    this.batch(() => {
      for (const id of scopes) {
        const s = this.#live.draft.scopes[id];
        if (!s) continue;
        if (s.suspended) s.suspended = { fields: [] };
        for (const field of Object.keys(s.readings)) {
          if (options.carry && this.#knows(field)?.carriesOver(field)) continue;
          const start = this.#starts.get(id)?.get(field);
          if (s.narrows?.length || this.#live.parts.has(id)) this.#write(id, field, undefined);
          // A field with a start goes back to it, never to every row. TODO 403
          else if (start) this.#select(field, [...start.picked ?? []], start);
          else this.#select(field, []);
        }
      }
      // The arrangement in a scope it resets, never another source's. TODO 523 S3
      const { scope } = arrangementOf(this.#live.applied, (id) => scopes.includes(id));
      if (options.organise && scope) {
        this.clearSort(scope);
        this.setGroup(null, scope);
      }
      // …and a SLOT's own Group and Sort, its chart's. TODO 548
      for (const id of options.organise ? scopes : []) {
        const shown = this.presentation(id);
        if (shown.group || shown.sort) this.present(id, { group: undefined, sort: undefined });
      }
    });
  }

  /** The doors one act calls are ONE change to the page: one `query-change`. */
  batch(fn: () => void): void {
    if (this.#batched) {
      fn();
      return;
    }
    this.#batched = { fields: [], scopes: [] };
    try {
      fn();
    } finally {
      const said = this.#batched;
      this.#batched = null;
      // ONE Apply for the act, after every edit in it. 366 step 21
      const applies = this.#applies;
      this.#applies = [];
      if (applies.map((at) => this.#send(at)).some(Boolean)) this.#tell({ kind: 'commit' });
      if (said.fields.length || said.scopes.length) {
        this.#announce({ fields: [...new Set(said.fields)], scopes: [...new Set(said.scopes)] });
      }
    }
  }

  /** SEND the draft — Apply, where a scope waits. One field, one scope, or all. It loads. */
  commit(at: { scope?: string; field?: string } = {}): void {
    if (!this.waiting()) return;
    if (this.#batched) this.#applies.push(at);
    else if (this.#send(at)) this.#tell({ kind: 'commit' });
  }

  /** Copy what an Apply sends onto `applied`. Nothing waiting: false, and the
   *  Apply tells no one. 366 step 21 */
  #send(at: { scope?: string; field?: string }): boolean {
    const { draft, applied } = this.#live;
    if (at.field ? sameField(draft, applied, at.field) : at.scope ? sameScope(draft, applied, at.scope) : false) return false;
    if (at.field) copyField(draft, applied, at.field);
    else if (at.scope) copyScope(draft, applied, at.scope);
    else this.#live.applied = structuredClone(draft);
    if (at.field || at.scope) copyHolds(draft, this.#live.applied);
    return true;
  }

  /** Put the applied answers back over the draft — Discard, where a scope waits.
   *  One field, one scope, or all. Every control over them is drawn the applied answer. */
  discard(at: { scope?: string; field?: string } = {}): void {
    if (!this.waiting()) return;
    const before = new Set(this.#answered());
    if (at.field) copyField(this.#live.applied, this.#live.draft, at.field);
    else if (at.scope) copyScope(this.#live.applied, this.#live.draft, at.scope);
    else this.#live.draft = structuredClone(this.#live.applied);
    this.#tell({ kind: 'drawn', fields: [...new Set([...before, ...this.#answered()])], pending: true });
  }

  /** The chip that drives the highlight, if one does. TODO 441 */
  get highlighted(): { scope: string; field: string } | null {
    for (const [scope, s] of Object.entries(this.#live.draft.scopes)) if (s.highlight) return { scope, field: s.highlight };
    return null;
  }

  /** Make a field's chip the highlight's driver, or let it go: ONE in the Query,
   *  in both copies, as a mark is no answer to Apply. Will, TODO 441 */
  highlight(scope: string, field: string, on: boolean): void {
    const was = this.highlighted;
    if (on ? was?.scope === scope && was.field === field : was?.field !== field) return;
    for (const query of new Set([this.#live.applied, this.#live.draft])) {
      for (const s of Object.values(query.scopes)) delete s.highlight;
      if (on) scopeEntry(query, scope).highlight = field;
    }
    this.#tell({ kind: 'recompose' });
    this.#tell({ kind: 'drawn', fields: [...new Set([field, ...(was ? [was.field] : [])])] });
  }

  /** The chip hovered — or one value of it — while it previews the highlight. TODOs 449, 459 */
  get previewed(): { scope: string; field: string; value?: string } | null {
    return this.#preview;
  }

  /** Preview a field's chip as the highlight's driver, or stop. Never in the
   *  Query, so never saved, and it moves no row: no load. Will, TODO 449.
   *  TRAP T-a-hovered-chip-previews-the-highlight */
  preview(scope: string, field: string, on: boolean, value?: string): void {
    const was = this.#preview;
    if (on ? was?.scope === scope && was.field === field && was.value === value : !was || was.scope !== scope || was.field !== field) return;
    this.#preview = on ? { scope, field, ...(value != null ? { value } : {}) } : null;
    this.#tell({ kind: 'mark' });
  }
  /** The chip hovered, or null. */
  #preview: { scope: string; field: string; value?: string } | null = null;

  /**
   * Order by one field, or stop. Every re-ordering returns to page 1.
   * `field: null` SUSPENDS — the column moves to `sortSuspended`, so one more
   * click resumes it. `clearSort()` is how a caller forgets.
   * TRAP T-a-suspended-sort-is-one-owners-job
   */
  setSort(field: string | null, direction: SortDirection = 'asc', scope?: string): void {
    if (field) this.#arrange({ sort: [{ field, direction }], sortSuspended: undefined }, scope);
    else {
      // A second suspend in a row must not overwrite the memory with nothing.
      const live = this.#arrangedFor(scope).sort[0];
      this.#arrange({ sort: [], ...(live ? { sortSuspended: live } : {}) }, scope);
    }
    this.#tell({ kind: 'arranged', group: false });
  }

  /** Resume the suspended sort — the scope's source's. No-op when there is none. */
  resumeSort(scope?: string): void {
    const held = this.#arrangedFor(scope).sortSuspended;
    if (!held) return;
    this.setSort(held.field, held.direction ?? 'asc', scope);
  }

  /** Forget the sort entirely — the gesture that is NOT a suspend. */
  clearSort(scope?: string): void {
    this.#arrange({ sort: [], sortSuspended: undefined }, scope);
    this.#tell({ kind: 'arranged', group: false });
  }

  /** The arrangement of the source that draws in `scope`: another's is not read. TODO 523 S3 */
  #arrangedFor(scope?: string): Arrangement {
    const theirs = this.#theirs(scope);
    return arrangementOf(this.#live.applied, (id) => !theirs(id));
  }

  /** Group by a field, or stop. A grid draws it; the Query holds it. */
  setGroup(field: string | null, scope?: string): void {
    this.#arrange({ group: field }, scope);
    this.#tell({ kind: 'arranged', group: true });
  }

  /** A slot's presentation, as kept: a copy; none, an empty one. TODO 548 */
  presentation(scope: string): Presentation {
    return { ...this.#live.applied.scopes[scope]?.presentation };
  }

  /** What its page DEFINES a slot shows — and a default per view, its grid's and
   *  its charts' — under what is kept. Not in the Query: only what the reader
   *  changed is. Will, TODO 548 */
  declarePresentation(scope: string, presentation: PresentationDefinition): void {
    this.#defined.set(scope, structuredClone(presentation));
  }

  /** A slot's presentation as shown in a view: what is kept, over that view's
   *  definition, over the slot's. The reader's pick wins. `kept` false: the
   *  definition alone, what Default picks. Will, TODOs 548, 572 */
  presented(scope: string, view?: 'grid' | 'chart', kept = true): Presentation {
    const { grid, chart, ...base } = this.#defined.get(scope) ?? {};
    const own = view === 'grid' ? grid : view === 'chart' ? chart : undefined;
    return { ...base, ...own, ...(kept ? this.presentation(scope) : {}) };
  }

  /** Each slot's definition. */
  readonly #defined = new Map<string, PresentationDefinition>();

  /** Change a slot's presentation, at once in BOTH copies — it filters nothing, so
   *  no Apply waits. A key given `undefined` goes back to the definition. Will, TODO 548 */
  present(scope: string, patch: Partial<Record<keyof Presentation, string | undefined>>): void {
    for (const query of new Set([this.#live.applied, this.#live.draft])) {
      const entry = scopeEntry(query, scope);
      const merged: Record<string, unknown> = { ...entry.presentation, ...patch };
      const next = Object.fromEntries(Object.entries(merged).filter(([, value]) => value != null && value !== ''));
      if (Object.keys(next).length) entry.presentation = next as Presentation;
      else delete entry.presentation;
    }
    prune(this.#live.applied);
    if (this.#live.draft !== this.#live.applied) prune(this.#live.draft);
    this.#tell({ kind: 'presented', scope });
  }

  /** The rows' free-text search, with the arrangement. */
  setSearch(term: string, scope?: string): void {
    this.#arrange({ search: term }, scope);
    this.#tell({ kind: 'arranged', group: false });
  }

  /**
   * Restore a whole Query — a reload, a trip away and back, a View's own
   * defaults. Resolves once every member has drawn it.
   *
   * `holds: 'keep'` — a View: a scope the definition gives no `holds` keeps
   * the chips it has, and every answer is a clean slate. `by` rides on the
   * `query-change` it fires. `lay` edits the whole Query before it goes on: the
   * App Context's answer over the View (TODO 453).
   * TRAP T-one-query-one-owner · TRAP T-a-reload-replays-the-readers-answers · TRAP T-a-view-is-json
   */
  async setQuery(
    query: Query | QueryDefaults, options: { holds?: 'keep'; by?: string; lay?: (query: Query) => void } = {},
  ): Promise<void> {
    if (query?.v !== 1 || typeof query.scopes !== 'object') {
      report({ code: 'unknown-query', message: 'setQuery: not a v1 Query, so nothing was restored.' });
      return;
    }
    const next = definitionOf(query, options.holds === 'keep', this.#live.draft, {
      defaults: this.#live.defaults,
      starts: this.#live.starts,
      readingsOf: (where) => this.#readingsOf(where),
      carriesOver: (f) => this.#knows(f)?.carriesOver(f) ?? false,
    });
    options.lay?.(next);
    this.#fillStarts(next);
    const was = arrangementOf(this.#live.applied);
    const before = this.#answered();
    this.#live.applied = next;
    this.#live.draft = this.waiting() ? structuredClone(next) : next;
    rehome(this.#live.draft);
    await Promise.all([...this.#members].map((m) => m.heard({ kind: 'query', was, before })));
    this.#announce({
      fields: [...new Set([...before, ...this.#answered()])], scopes: this.scopes, ...(options.by ? { by: options.by } : {}),
    });
  }

  /**
   * The answer a field OPENS on where nothing answers it — a fetching list's
   * first value. A restore, a View or a Reset that leaves it unanswered puts it
   * back. Will, TODO 403 · TRAP T-a-fetching-list-opens-on-its-first-value
   */
  startWith(scope: string, field: string, reading: FieldReading): void {
    let fields = this.#starts.get(scope);
    if (!fields) this.#starts.set(scope, (fields = new Map()));
    fields.set(field, copyReading(reading));
    // Taken now, in place: it is how the page opens, not a change to it.
    this.#fillStarts(this.#live.applied);
    if (this.#live.draft !== this.#live.applied) this.#fillStarts(this.#live.draft);
  }
  /** Each scope's start answers, by field. */
  readonly #starts = new Map<string, Map<string, FieldReading>>();

  /** Each held field with a start and no answer — not one turned off — takes it. */
  #fillStarts(query: Query): void {
    for (const [id, fields] of this.#starts) {
      const scope = query.scopes[id];
      if (!scope) continue;
      for (const [field, start] of fields) {
        const had = scope.readings[field];
        if (!scope.holds.includes(field) || (had && (readingAnswered(had) || had.suspended))) continue;
        scope.readings[field] = copyReading(start);
      }
    }
  }

  /** The whole question as JSON — the Query as applied, with its arrangement.
   *  TRAP T-a-page-goes-out-as-json */
  export(): QueryState {
    const query = structuredClone(this.#live.applied);
    // It names its arrangement, none too: a View saved from it puts back the rows as they were.
    if (!arrangementOf(query).scope) query.scopes[VIEW] = { ...(query.scopes[VIEW] ?? emptyScope()), sort: [] };
    return { v: 1, query };
  }

  /** Take a question back in, exactly. */
  async import(state: QueryState): Promise<void> {
    if (state?.v !== 1) {
      report({ code: 'unknown-state', message: 'import: not a v1 query state, so nothing was taken in.' });
      return;
    }
    await this.setQuery(state.query);
  }

  /** Write the arrangement into the Query, in BOTH copies: the scope given,
   *  else the one that arranges now, else the View; every other scope loses
   *  it. It compiles nothing. 366 step 8 · TRAP T-group-and-sort-are-component-scope */
  #arrange(next: ArrangeEdit, scope?: string): void {
    /* ONE arranging scope per SOURCE: a scope another source draws a page in
       keeps its own. With one source, every scope is its. 366 step 25 */
    const theirs = this.#theirs(scope);
    const now = arrangementOf(this.#live.applied, (id) => !theirs(id));
    const at = scope ?? now.scope ?? VIEW;
    const sort = next.sort ?? now.sort;
    const group = 'group' in next ? next.group ?? null : now.group;
    const sortSuspended = 'sortSuspended' in next ? next.sortSuspended : now.sortSuspended;
    const search = next.search ?? now.search;
    for (const query of new Set([this.#live.applied, this.#live.draft])) {
      for (const [id, s] of Object.entries(query.scopes)) {
        if (!theirs(id)) stripArrangement(s);
      }
      if (!sort.length && group == null && !sortSuspended && !search) continue;
      const s = scopeEntry(query, at);
      s.sort = sort.map((by) => ({ ...by }));
      if (group != null) s.group = group;
      if (sortSuspended) s.sortSuspended = { ...sortSuspended };
      if (search) s.search = search;
    }
  }

  /** A reading's answer, its picks as the values the rows hold: a control hands
   *  back the KEY it was given. Picks kept off too. TRAP T-a-value-can-be-an-object */
  #raw(field: string, picked: readonly unknown[], reading: FieldReading): FieldReading {
    const raws = (keys: readonly unknown[]): unknown[] => this.#knows(field)?.raws(field, keys) ?? [...keys];
    return { ...answerOf(reading), picked: raws(picked), ...(reading.off ? { off: raws(reading.off) } : {}) };
  }

  /** The source that draws a page of rows in a scope; none for a scope of the page's. */
  #owner(scope: string): QueryMember | undefined {
    return [...this.#members].find((m) => m.pagedIn(scope));
  }

  /** Is a scope ANOTHER source's than the one that draws in `scope`? None given, none is. */
  #theirs(scope?: string): (id: string) => boolean {
    const owner = scope ? this.#owner(scope) : undefined;
    return (id) => !!owner && !!this.#owner(id) && this.#owner(id) !== owner;
  }

  /** A View's plain conditions as readings: each field by the member that knows it. */
  #readingsOf(where: Where): Record<string, FieldReading> {
    const out: Record<string, FieldReading> = {};
    for (const [field, condition] of Object.entries(where)) {
      Object.assign(out, this.#knows(field)?.readingsOf({ [field]: condition }) ?? readingsOf({ [field]: condition }));
    }
    return out;
  }

  /** Every field the draft answers. */
  #answered(): string[] {
    return Object.values(this.#live.draft.scopes).flatMap((s) => Object.keys(s.readings));
  }

  /** The member that knows a field — else the first. */
  #knows(field: string): QueryMember | undefined {
    const members = [...this.#members];
    return members.find((m) => m.has(field)) ?? members[0];
  }

  /** How any member bound this control. */
  #bindOf(el: BoundControl): MemberBind | undefined {
    for (const m of this.#members) {
      const bind = m.bindOf(el);
      if (bind) return bind;
    }
    return undefined;
  }

  /** Each member hears what the context did, at once, in the order they joined;
   *  then, if a field's answer or a scope's holds moved, the page is told. */
  #tell(change: QueryChange): void {
    this.#settle();
    for (const member of this.#members) void member.heard(change);
    const said = ((): QueryChangeDetail | null => {
      switch (change.kind) {
        case 'write': case 'select': return { fields: [change.field], scopes: [] };
        case 'drawn': return { fields: change.fields, scopes: [] };
        case 'offer': case 'hold': case 'order': case 'presented': return { fields: [], scopes: [change.scope] };
        case 'move': return { fields: [], scopes: change.scopes };
        case 'arranged': return { fields: [], scopes: this.scopes };
        // An Apply is a change to the page too: what keeps the Query hears it. TODO 406
        case 'commit': return {
          fields: [...new Set([...this.#answered(), ...Object.values(this.#live.applied.scopes).flatMap((sc) => Object.keys(sc.readings))])],
          scopes: [],
        };
        default: return null;
      }
    })();
    if (said) this.#announce(said);
  }

  /** ONE event for anything listening to the Query — held to the end of a batch. */
  #announce(detail: QueryChangeDetail): void {
    if (this.#batched) {
      this.#batched.fields.push(...detail.fields);
      this.#batched.scopes.push(...detail.scopes);
      return;
    }
    this.dispatchEvent(new CustomEvent('query-change', { detail }));
  }

  /** A source joins: it gets its handle. A remote one splits the draft from
   *  `applied` once; a draft that exists is kept. */
  join(member: QueryMember): QueryHandle {
    this.#members.add(member);
    if ((member.remote || this.#waiting.size) && this.#live.draft === this.#live.applied) this.#live.draft = copyQuery(this.#live.applied);
    return {
      live: () => this.#live,
      mintId: () => `bind-${++this.#binds}`,
      walkVersion: () => this.#walks,
      pagedIn: (scope) => [...this.#members].some((m) => m.pagedIn(scope)),
      bindOf: (el) => this.#bindOf(el),
      leave: () => { this.#members.delete(member); },
    };
  }
}
