/**
 * query-context.ts — the Query of one app Context, and what its page declares
 * about it. Every source over the page joins it, so there is one Query.
 * 366 step 12: a context of one — each source still makes its own.
 * DOM-free. TRAP T-one-query-one-owner
 *
 * Map:
 * - QueryMember — What a source tells the context it joins.
 * - QueryLive — The Query and the declarations, live: written in place, never copied.
 * - QueryHandle — What a member holds of its context.
 * - QueryContext — The Query of one app Context, shared by every source in it.
 * - .applied — The Query the rows are under. A copy.
 * - .draft — What the reader is editing. A copy.
 * - .remote — Does any member's store wait for Apply?
 * - .reading — One scope's reading of one field, or undefined. The Query's own, frozen.
 * - .scope — The fields a scope holds, in order — hold()'s read-back.
 * - .scopes — Every scope that holds a field, by id.
 * - .holds — Is this field held HERE?
 * - .scopeOf — Which scope holds this field, or null.
 * - .fields — The fields a scope may hold.
 * - .canHold — May this scope hold this field?
 * - .defaultFor — A component's own default, as `declareDefault` left it — not its answer now.
 * - .partFacts — What `declarePart` was told for this scope, or undefined.
 * - .scopeFacts — What `declareScope` was told — not the fallbacks `scopeLabel()` and `arranges()` answer with.
 * - .scopeLabel — A scope's name as a reader sees it, or its id.
 * - .arranges — Does Group and Sort arrange this scope's rows?
 * - .sets — A scope's filter sets, as declared.
 * - .pending — Has this field been changed and not yet applied?
 * - .dirty — Has anything in this scope — or any scope — been changed and not applied?
 * - .join — A source joins: it gets its handle.
 */
import type { BoundControl, FilterSet } from './data-source-types.js';
import { copyQuery, freezeReading, sameReading, VIEW, type Query, type ScopeQuery } from './query.js';
import { answerIn, answersOf, holderOf, holdsField } from './query-edits.js';
import type { FieldReading } from './filter-state.js';

/** What a source tells the context it joins. */
export interface QueryMember {
  /** Its store waits for Apply. */
  readonly remote: boolean;
  /** Does it show rows — a grid, a list — in this scope? */
  showsRows(scope: string): boolean;
  /** How it bound this control, if it did. */
  bindOf(el: BoundControl): { scope?: string | readonly string[] } | undefined;
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
  /** The live Query and declarations. */
  live(): QueryLive;
  /** A bind id no other member has made. */
  mintId(): string;
  /** Does any member show rows in this scope? */
  showsRows(scope: string): boolean;
  /** How any member bound this control. */
  bindOf(el: BoundControl): { scope?: string | readonly string[] } | undefined;
  /** Leave the context. */
  leave(): void;
}

/** The Query of one app Context, shared by every source in it. */
export class QueryContext {
  /** The one Query, and the declarations. */
  readonly #live: QueryLive;
  /** Every source that joined. */
  readonly #members = new Set<QueryMember>();
  /** Binds made, for an id when the element has none. */
  #binds = 0;

  constructor() {
    const applied: Query = { v: 1, scopes: {} };
    this.#live = {
      applied, draft: applied,
      defaults: new Map(), labels: new Map(), arranges: new Map(), sets: new Map(), offers: new Map(), parts: new Map(),
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
   *  component scope that shows a grid or a list does, and the View does not.
   *  Will, TODO 99. TRAP T-group-and-sort-are-component-scope */
  arranges(scope: string): boolean {
    return this.#live.arranges.get(scope)
      ?? (scope !== VIEW && [...this.#members].some((m) => m.showsRows(scope)));
  }

  /** A scope's filter sets, as declared. */
  sets(scope: string): FilterSet[] {
    return structuredClone(this.#live.sets.get(scope) ?? []);
  }

  /** Has this field been changed and not yet applied? Never, with no remote member. */
  pending(field: string): boolean {
    if (!this.remote) return false;
    return !sameReading(answerIn(this.#live.applied, field), answerIn(this.#live.draft, field));
  }

  /** Has anything in this scope — or in any scope — been changed and not applied? */
  dirty(scope?: string): boolean {
    if (!this.remote) return false;
    const ids = scope ? [scope]
      : [...new Set([...Object.keys(this.#live.applied.scopes), ...Object.keys(this.#live.draft.scopes)])];
    return ids.some((id) => JSON.stringify(answersOf(this.#live.applied.scopes[id]))
      !== JSON.stringify(answersOf(this.#live.draft.scopes[id])));
  }

  /** A source joins: it gets its handle. A remote one splits the draft from
   *  `applied` once; a draft that exists is kept. */
  join(member: QueryMember): QueryHandle {
    this.#members.add(member);
    if (member.remote && this.#live.draft === this.#live.applied) this.#live.draft = copyQuery(this.#live.applied);
    return {
      live: () => this.#live,
      mintId: () => `bind-${++this.#binds}`,
      showsRows: (scope) => [...this.#members].some((m) => m.showsRows(scope)),
      bindOf: (el) => {
        for (const m of this.#members) {
          const bind = m.bindOf(el);
          if (bind) return bind;
        }
        return undefined;
      },
      leave: () => { this.#members.delete(member); },
    };
  }
}
