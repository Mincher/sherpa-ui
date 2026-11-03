/**
 * query-members.ts — the sources that share one Query: what each tells the
 * context it joins, what each is told, and the context's questions of them all.
 * A QueryContext holds one. DOM-free.
 *
 * Map:
 * - QueryChange — What the context did, as each member hears it.
 * - QueryMember — What a source tells the context it joins.
 * - MemberBind — How a member bound a control.
 * - QueryLive — The Query and the declarations, live: read each time, never kept.
 * - QueryHandle — What a member holds of its context.
 * - QueryMembers — Every source over one Query, and what the context asks of them.
 * - .size — How many sources share this Query.
 * - .remote — Does any member's store wait for Apply?
 * - .add — A source joins.
 * - .delete — A source leaves.
 * - .tell — Each member hears what the context did, at once, in the order they joined.
 * - .hear — Each member hears it, and the context waits for every one.
 * - .pagedIn — Does any member draw a page of rows in this scope?
 * - .presentsIn — Does any member's chart draw a summary in this scope?
 * - .theirs — Is a scope ANOTHER source's than the one that draws in this one?
 * - .knows — The member that knows a field, else the first.
 * - .bindOf — How any member bound this control.
 * - .page — A page, or the rows per page, for the sources that draw a page in a scope.
 * - .mintId — A bind id no other member has made.
 */
import type { Arrangement, Query, ScopeQuery } from './query.js';
import type { BoundControl, FilterSet } from './data-source-types.js';
import type { FieldReading, RuledOut } from './filter-state.js';
import type { QueryPart } from './query-declarations.js';
import type { Where } from './where.js';

/** What the context did, as each member hears it: the follow-ups are the member's. */
export type QueryChange =
  | { kind: 'part'; scope: string; field?: string; left?: string }
  | { kind: 'sets'; scope: string }
  | { kind: 'offer'; scope: string }
  | { kind: 'write'; scope: string; field: string; narrows: string[] }
  | { kind: 'select'; field: string }
  | { kind: 'hold'; scope: string; moved: string[] }
  | { kind: 'move'; scopes: string[]; moved: boolean }
  /** The Query moved: compile it. */
  | { kind: 'recompose' }
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
  /** Does a chart of its draw a summary in this scope — is it a SLOT? TODO 548 */
  presentsIn(scope: string): boolean;
  /** Show this page of its rows, or this many rows a page. */
  page(edit: { page: number } | { pageSize: number }): void;
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

/** How a member bound a control. */
export interface MemberBind {
  id: string;
  rows: 'page' | 'all';
  scope?: string | readonly string[];
}

/** The Query and the declarations, live: read each time, never kept — a pure edit swaps a copy in. */
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
  /** Each component's own default filter, by its scope. */
  readonly defaults: ReadonlyMap<string, ScopeQuery>;
  /** Each scope's answers at the start, as its page defines them. */
  readonly starts: ReadonlyMap<string, ScopeQuery>;
  /** Each scope's filter sets. */
  readonly sets: ReadonlyMap<string, FilterSet[]>;
  /** What each COMPONENT scope has — its own fields. */
  readonly offers: ReadonlyMap<string, string[]>;
  /** Each part, by its scope. */
  readonly parts: ReadonlyMap<string, QueryPart>;
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

/** Every source over one Query, and what the context asks of them. */
export class QueryMembers {
  /** Every source that joined, in join order. */
  readonly #members = new Set<QueryMember>();
  /** Binds made, for an id when the element has none. */
  #binds = 0;

  /** How many sources share this Query. */
  get size(): number {
    return this.#members.size;
  }

  /** Does any member's store wait for Apply? */
  get remote(): boolean {
    return [...this.#members].some((m) => m.remote);
  }

  /** A source joins. */
  add(member: QueryMember): void {
    this.#members.add(member);
  }

  /** A source leaves. */
  delete(member: QueryMember): void {
    this.#members.delete(member);
  }

  /** Each member hears what the context did, at once, in the order they joined. */
  tell(change: QueryChange): void {
    for (const member of this.#members) void member.heard(change);
  }

  /** Each member hears it, and the context waits for every one to settle. */
  async hear(change: QueryChange): Promise<void> {
    await Promise.all([...this.#members].map((m) => m.heard(change)));
  }

  /** Does any member draw a page of rows in this scope? */
  pagedIn(scope: string): boolean {
    return [...this.#members].some((m) => m.pagedIn(scope));
  }

  /** Does any member's chart draw a summary in this scope — is it a SLOT? TODO 548 */
  presentsIn(scope: string): boolean {
    return [...this.#members].some((m) => m.presentsIn(scope));
  }

  /** The source that draws a page of rows in a scope; none for a scope of the page's. */
  #owner(scope: string): QueryMember | undefined {
    return [...this.#members].find((m) => m.pagedIn(scope));
  }

  /** Is a scope ANOTHER source's than the one that draws in `scope`? None given, none is. */
  theirs(scope?: string): (id: string) => boolean {
    const owner = scope ? this.#owner(scope) : undefined;
    return (id) => !!owner && !!this.#owner(id) && this.#owner(id) !== owner;
  }

  /** The member that knows a field — else the first. */
  knows(field: string): QueryMember | undefined {
    const members = [...this.#members];
    return members.find((m) => m.has(field)) ?? members[0];
  }

  /** How any member bound this control. */
  bindOf(el: BoundControl): MemberBind | undefined {
    for (const m of this.#members) {
      const bind = m.bindOf(el);
      if (bind) return bind;
    }
    return undefined;
  }

  /** A page, or the rows per page, for the sources that draw a page in its scope —
   *  or, with no scope or none drawing there, every source's. */
  page(edit: { scope?: string } & ({ page: number } | { pageSize: number })): void {
    const { scope, ...at } = edit;
    const owners = scope === undefined ? [] : [...this.#members].filter((m) => m.pagedIn(scope));
    for (const member of owners.length ? owners : this.#members) member.page(at);
  }

  /** A bind id no other member has made. */
  mintId(): string {
    return `bind-${++this.#binds}`;
  }
}
