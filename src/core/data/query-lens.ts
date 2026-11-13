/**
 * query-lens.ts — a page's QUERY through the lens door (plan 960 U4.5). Its graph is drawn from the LIVE Query, with the
 * layout a reader gave it; a graph written back is reconciled into the Query's own requests, asked as a chip asks them, and
 * the page saved as the Query holds it then (`pageWithQuery`). Not pure: writing back asks the live Query. One write-back, for
 * the editor's Query document and the MCP alike. DOM-free. Will, 2026-11-13 · docs/history/plan-960-u4-the-lens-door.md
 * TRAP T-the-node-editor-asks-the-query
 *
 * Map:
 * - QueryLensFacts — What the Query's lens reads beside a page: the live Query, how its graph is drawn, the layout given it.
 * - queryDrawn — The graph a page's Query draws now, at the places its layout gives.
 * - queryScopes — A page's scopes: the View, each its source declares, and each its live Query holds.
 * - reconcileFacts — What a reconcile needs, read from the live Query: its holds, fields and presets, and the Sources kept.
 * - applyReconciled — Ask the live Query what a reconcile gives; it answers the Sources kept after it.
 * - QUERY_LENS — The Query's lens: drawn from the live Query; written back as its requests, then the page saved.
 */
import { pageWithQuery, storeOf, type PageDefinition } from './page-definition.js';
import type { QueryContext } from './query-context.js';
import { laidOut, queryDefinition, reconcileQuery, rowRequest, type GraphLayout, type ReconcileFacts, type Reconciled } from './query-document.js';
import { queryGraph, type KeptSource, type QueryGraphFacts } from './query-graph.js';
import { VIEW } from './query.js';
import { registerLens, type GraphLens } from './lens.js';
import type { DrawnGraph } from './node-kinds.js';
import type { FieldType } from './filter-state.js';
import { pageFields } from './type-definition.js';

/** What the Query's lens reads beside a page: the live Query, how its graph is drawn, and the layout a reader gave it. */
export interface QueryLensFacts extends Omit<QueryGraphFacts, 'presets'> {
  query: Pick<QueryContext, 'draft' | 'ask' | 'scope' | 'fields' | 'presets' | 'presetOn'>;
  layout?: GraphLayout;
}

/** A field's type: the facts', else as the page declares it, or its type does. */
const typeIn = (page: PageDefinition, facts: QueryLensFacts): ((field: string) => string | undefined) => {
  const declared = pageFields(page.source);
  return (field) => facts.type?.(field) ?? declared[field]?.type;
};

/** The graph a page's Query draws now, at the places its layout gives. */
export function queryDrawn(page: PageDefinition, facts: QueryLensFacts): DrawnGraph {
  const { query, layout = {}, ...drawn } = facts;
  return laidOut(queryGraph(query.draft, page, { ...drawn, type: typeIn(page, facts), presets: (scope) => query.presets(scope) }), layout);
}

/** A page's scopes: the View, each its source declares, and each its live Query holds. */
export const queryScopes = (page: PageDefinition, query: Pick<QueryContext, 'draft'>): string[] =>
  [...new Set([VIEW, ...Object.keys(page.source?.scopes ?? {}), ...Object.keys(query.draft.scopes)])];

/** What a reconcile needs, read from the live Query: its holds, fields and presets, which are on, the page's store and the
 *  Sources kept. A Filter is placed in the scope that declares it (TODO 776). */
export function reconcileFacts(page: PageDefinition, facts: QueryLensFacts): ReconcileFacts {
  const { query } = facts;
  const kept = facts.kept ?? [];
  const scopes = queryScopes(page, query);
  const store = page.source && storeOf(page.source);
  return {
    type: typeIn(page, facts), ...(facts.values ? { values: facts.values } : {}), kept,
    scopeOf: (kind) => scopes.find((scope) => query.presets(scope).some((p) => p.id === kind)),
    place: {
      holds: (scope) => query.scope(scope), fields: (scope) => query.fields(scope),
      presets: (scope) => query.presets(scope), on: (scope, id) => query.presetOn(scope, id), kept,
      ...(store ? { store } : {}), ...(facts.stores ? { stores: facts.stores } : {}),
    },
  };
}

/** Ask the live Query what a reconcile gives: each row against the graph as the last one left it (a type changed first may
 *  reshape the rest; the first, as it was read), then each request. It answers the Sources kept after it. */
export function applyReconciled(
  query: Pick<QueryContext, 'ask'>, done: Reconciled, first: DrawnGraph, again: (kept: readonly KeptSource[]) => DrawnGraph,
  facts: { type?: (field: string) => string | undefined; kept: readonly KeptSource[] },
): readonly KeptSource[] {
  let kept = done.kept ?? facts.kept;
  for (const [i, row] of done.edits.entries()) {
    const asked = rowRequest(i || done.kept ? again(kept) : first, row, { ...(facts.type ? { type: facts.type } : {}), kept });
    if (asked && 'kept' in asked) kept = asked.kept;
    else if (asked) query.ask(asked.request);
  }
  for (const request of done.requests) query.ask(request);
  return kept;
}

/** The Query's lens: a page's graph drawn from its live Query; a graph written back as the Query's own requests, asked, and
 *  the page saved as the Query holds it then. What the Query cannot take refuses the whole graph, in its words. */
export const QUERY_LENS: GraphLens<PageDefinition, QueryLensFacts> = {
  toGraph: (page, facts) => ({ workflow: queryDefinition(page.id, queryDrawn(page, facts!), facts!.layout ?? {}) }),
  fromGraph: (page, graph, facts) => {
    const f = facts!;
    const drawn = queryDrawn(page, f);
    const done = reconcileQuery(queryDefinition(page.id, drawn, f.layout ?? {}), graph, drawn, reconcileFacts(page, f));
    if (done.refused.length) return { faults: done.refused.map((r) => r.message) };
    const type = typeIn(page, f);
    applyReconciled(f.query, done, drawn, (kept) => queryDrawn(page, { ...f, kept }), { type, kept: f.kept ?? [] });
    return { definition: pageWithQuery(page, f.query.draft, { ...(f.pageSize !== undefined ? { pageSize: f.pageSize } : {}), type: (field) => type(field) as FieldType | undefined }) };
  },
};

registerLens('query', QUERY_LENS);
