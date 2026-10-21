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
 * - .join — A source joins: it gets its handle.
 */
import type { BoundControl, FilterSet } from './data-source-types.js';
import { copyQuery, type Query, type ScopeQuery } from './query.js';

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
