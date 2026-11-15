/**
 * query-lens.ts — a page's QUERY through the lens door (plan 960 U4.5), and a View's (U4.6). Its graph is drawn from the
 * LIVE Query, with the layout a reader gave it; a graph written back is reconciled into the Query's own requests, asked as a
 * chip asks them, and saved as the Query holds it then: the page (`pageWithQuery`) or the View (`viewWithQuery`). Not pure:
 * writing back asks the live Query. One write-back, for the editor's Query document and the MCP alike. DOM-free. Will, 2026-11-13 · docs/history/plan-960-u4-the-lens-door.md
 * TRAP T-the-node-editor-asks-the-query
 *
 * Map:
 * - QueryLensFacts — What the Query's lens reads beside a page: the live Query, how its graph is drawn, the layout given it.
 * - queryOpened — A page's Query through its lens now: the definition it says, and the graph drawn of it, laid out.
 * - queryDrawn — The graph a page's Query draws now, at the places its layout gives.
 * - queryDrawingFacts — What the one drawing reads beside a Query's definition: its stores, and the page's fields.
 * - queryScopes — A page's scopes: the View, each its source declares, and each its live Query holds.
 * - reconcileFacts — What a reconcile needs, read from the live Query: its holds, fields and presets, and the Sources kept.
 * - applyReconciled — Ask the live Query what a reconcile gives; it answers the Sources kept after it.
 * - QUERY_LENS — The Query's lens: a page's Query, saved as the page.
 * - VIEW_LENS — A View's lens: its page's Query with the View on it, saved as the View.
 */
import { pageWithQuery, storeOf, viewWithQuery, type PageDefinition } from './page-definition.js';
import type { QueryContext } from './query-context.js';
import { laidOut, queryDefinition, reconcileQuery, rowRequest, type GraphLayout, type ReconcileFacts, type Reconciled } from './query-document.js';
import { queryLensGraph, type KeptSource, type QueryGraphFacts } from './query-graph.js';
import { VIEW, type QueryDefaults } from './query.js';
import { registerLens, type GraphLens, type LensDefinition } from './lens-registry.js';
import type { DrawnGraph } from './node-kinds.js';
import type { FieldType } from './filter-state.js';
import { pageFields } from './type-definition.js';
import type { WorkflowFacts } from './workflow.js';

/** What the Query's lens reads beside a page: the live Query, how its graph is drawn, and the layout a reader gave it. */
export interface QueryLensFacts extends Omit<QueryGraphFacts, 'presets'> {
  query: Pick<QueryContext, 'draft' | 'ask' | 'scope' | 'fields' | 'presets' | 'presetOn'>;
  layout?: GraphLayout;
  /** A View's page: the page its Query is of. */
  page?: PageDefinition;
}

/** A field's type: the facts', else as the page declares it, or its type does. */
const typeIn = (page: PageDefinition, facts: QueryLensFacts): ((field: string) => string | undefined) => {
  const declared = pageFields(page.source);
  return (field) => facts.type?.(field) ?? declared[field]?.type;
};

/** A page's Query through its lens now: the definition it says, and the graph drawn of it, each at the places its layout
 *  gives. A reconcile reads the definition, never one read off the drawing (plan 1004 T5). */
export function queryOpened(page: PageDefinition, facts: QueryLensFacts): { definition: LensDefinition; drawn: DrawnGraph } {
  const { query, layout = {}, ...rest } = facts;
  const graph = queryLensGraph(query.draft, page, { ...rest, type: typeIn(page, facts), presets: (scope) => query.presets(scope) });
  return { definition: queryDefinition(page.id, graph, layout), drawn: laidOut(graph.drawn, layout) };
}

/** The graph a page's Query draws now, at the places its layout gives. */
export const queryDrawn = (page: PageDefinition, facts: QueryLensFacts): DrawnGraph => queryOpened(page, facts).drawn;

/** What the one drawing reads beside a Query's definition (plan 1004 D2): the app's stores, and the page's store's fields,
 *  each with its words, type and values: those the page declares, each a scope holds, and each status field the store
 *  works out. A Field offers them, a test narrows its types by them, and none warns it is not a field of the rows. */
export function queryDrawingFacts(page: PageDefinition, facts: QueryLensFacts): WorkflowFacts {
  const store = page.source && storeOf(page.source);
  const declared = pageFields(page.source);
  const type = typeIn(page, facts);
  const names = new Set([...Object.keys(declared), ...Object.keys(facts.domains ?? {}), ...Object.values(facts.query.draft.scopes).flatMap((s) => s.holds)]);
  const fields = Object.fromEntries([...names].map((f) => {
    const [label, of, values] = [facts.label?.(f) ?? declared[f]?.label, type(f), facts.values?.(f) ?? facts.domains?.[f]?.values?.map(String)];
    return [f, { ...(label ? { label } : {}), ...(of ? { type: of } : {}), ...(values ? { values } : {}) }];
  }));
  return { ...(facts.stores ? { stores: facts.stores } : {}), ...(store ? { fieldsOf: { [store]: fields } } : {}) };
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

/** A lens on a page's live Query: its graph drawn from the Query; a graph written back as the Query's own requests, asked,
 *  then saved as `save` writes the definition it is (the page, or one of its Views). What the Query cannot take refuses the
 *  whole graph, in its words. */
function queryLens<D>(
  pageOf: (definition: D, facts: QueryLensFacts) => PageDefinition,
  save: (definition: D, query: QueryLensFacts, type: (field: string) => FieldType | undefined) => D,
): GraphLens<D, QueryLensFacts> {
  return {
    toGraph: (definition, facts) => ({ workflow: queryOpened(pageOf(definition, facts!), facts!).definition }),
    fromGraph: (definition, graph, facts) => {
      const f = facts!;
      const page = pageOf(definition, f);
      const { definition: before, drawn } = queryOpened(page, f);
      const done = reconcileQuery(before, graph, drawn, reconcileFacts(page, f));
      if (done.refused.length) return { faults: done.refused.map((r) => r.message) };
      const type = typeIn(page, f);
      applyReconciled(f.query, done, drawn, (kept) => queryDrawn(page, { ...f, kept }), { type, kept: f.kept ?? [] });
      return { definition: save(definition, f, (field) => type(field) as FieldType | undefined) };
    },
  };
}

/** The Query's lens: a page's Query, saved as the page (`pageWithQuery`). */
export const QUERY_LENS = queryLens<PageDefinition>((page) => page, (page, f, type) =>
  pageWithQuery(page, f.query.draft, { ...(f.pageSize !== undefined ? { pageSize: f.pageSize } : {}), type }));

/** A View's lens: its page's Query with the View put on it, saved as the View (`viewWithQuery`); its page is in the facts.
 *  Plan 960 U4.6 */
export const VIEW_LENS = queryLens<{ query?: QueryDefaults }>((_view, f) => {
  if (!f.page) throw new Error('A View is drawn on its page: give the page in the facts.');
  return f.page;
}, (view, f, type) => viewWithQuery(view, f.query.draft, { type }));

registerLens('query', QUERY_LENS);
registerLens('view', VIEW_LENS);
