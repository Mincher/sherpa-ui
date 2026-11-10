/**
 * query-editor.ts — a page's Query in the ONE node editor (plan 885): the Query as a DOCUMENT, and `bindQueryEditor`, the one
 * editor bound to it. The document reads the Query's derived graph as a definition, with the layout a reader gave it, kept for
 * the tab beside the Query; it takes each edit back as the Query's own requests (`reconcileQuery`), and keeps the Sources a
 * reader placed that the page does not read. Every tool of the one editor reaches it. Will, 2026-11-10
 * TRAP T-one-node-editor · TRAP T-the-node-editor-asks-the-query · TRAP T-a-second-source-is-kept
 *
 * Map:
 * - QueryEditorOptions — What drawing a page's Query needs beyond its source: the definition, the page's components, the doors.
 * - queryDocument — A page's Query as a document the one node editor reads and writes.
 * - bindQueryEditor — The one node editor, on a page's Query.
 */
import type { SherpaNodeList } from '../../components/sherpa-node-list/sherpa-node-list.js';
import type { SherpaLayoutCanvas } from '../../components/sherpa-layout-canvas/sherpa-layout-canvas.js';
import type { SessionStore } from '../browser/session.js';
import type { DataSource } from '../data/data-source.js';
import { entityRefOf } from '../data/entity.js';
import { PRESET_FILTER } from '../data/entity-types.js';
import type { FieldType } from '../data/filter-state.js';
import { NODE_KINDS, paletteOf, type DrawnGraph, type GraphNode, type NodeKind } from '../data/node-kinds.js';
import { checkPage, pageWithQuery, type PageDefinition } from '../data/page-definition.js';
import { VIEW } from '../data/query.js';
import { queryGraph, type KeptSource, type QueryGraphFacts } from '../data/query-graph.js';
import { isGraphLayout, laidOut, layoutOf, queryDefinition, reconcileQuery, rowRequest, type GraphLayout } from '../data/query-document.js';
import { report } from '../data/report.js';
import { valueKey } from '../data/store.js';
import { bindWorkflow, watchQuery, type GraphDocument, type Inspector, type WorkflowEditor, type WorkflowEditorOptions } from './node-graph.js';

/** What drawing a page's Query needs beyond its source: the definition, the page's components, an inspector, and a session to
 *  keep the layout and the kept Sources for the tab. The one editor's own doors (a toolbar, a stage dialog) pass through. */
export interface QueryEditorOptions extends QueryGraphFacts, Pick<WorkflowEditorOptions, 'stageDialog' | 'header'> {
  definition: PageDefinition;
  /** The overlay panel a picked node opens in: its rows again, and a component's live visual. */
  inspector?: Inspector;
  /** Where the layout and the kept Sources are kept for the tab (TODO 551): they survive a reload, and the session's end forgets them. */
  session?: SessionStore;
  /** A `sherpa-node-toolbar`: the one editor's. */
  toolbar?: HTMLElement;
  /** The node panel floating on the canvas: it lists the kinds a Query takes, and each one asked for is a request. */
  panel?: SherpaNodeList;
  /** Where a component node's live copy is copied from, by id: the page's markup where the page is not on screen. Default, the document. */
  markup?: NonElementParentNode;
}

type QuerySource = Pick<DataSource, 'query'> & Partial<Pick<DataSource, 'valuesFor' | 'store' | 'state' | 'results' | 'addEventListener' | 'removeEventListener'>>;

/** Whether a value is a list of kept Sources: each an id and a store. */
function isKept(v: unknown): v is KeptSource[] {
  return Array.isArray(v) && v.every((k: Partial<KeptSource> | null) => typeof k?.id === 'string' && typeof k.store === 'string');
}

/** A page's Query as a document the one node editor reads and writes. */
export function queryDocument(source: QuerySource, { definition, session, markup = document, ...facts }: QueryEditorOptions): GraphDocument {
  const query = source.query;
  const typeOf = (field: string): string | undefined => facts.type?.(field) ?? definition.source?.fields?.[field]?.type;
  const values = facts.values ?? ((field: string) => source.valuesFor?.(field)?.map((v) => valueKey(v)));
  // The layout a reader gave the graph: kept for the tab, beside the Query, which holds none of it.
  const layoutAt = `/node-layout/${definition.id}`;
  session?.persist(layoutAt, { shared: false, guard: isGraphLayout });
  let layout: GraphLayout = (session?.get(layoutAt) as GraphLayout | undefined) ?? {};
  // A Source the page does not read is the editor's, kept for the tab beside the layout. TRAP T-a-second-source-is-kept
  const keptAt = `/node-sources/${definition.id}`;
  session?.persist(keptAt, { shared: false, guard: isKept });
  let kept: readonly KeptSource[] = (session?.get(keptAt) as KeptSource[] | undefined) ?? [];
  const keep = (next: readonly KeptSource[]): void => {
    kept = next;
    session?.set(keptAt, kept);
  };
  const derived = (): DrawnGraph => queryGraph(query.draft, definition, {
    ...facts, type: typeOf, values, presets: (scope) => query.presets(scope), domains: source.store?.domains ?? {}, pageSize: source.state?.pageSize ?? null, kept,
  });
  // The graph `read` last gave: a reconcile reads its nodes' rows and refs.
  let drawn = laidOut(derived(), layout);
  // The page's Preset Filters, as its Query declares them: placed as Custom Nodes. TODO 776
  const scopesOf = (): string[] => [...new Set([VIEW, ...Object.keys(definition.source?.scopes ?? {}), ...Object.keys(query.draft.scopes)])];
  const customs = (): Record<string, NodeKind> => Object.fromEntries(scopesOf().flatMap((scope) => query.presets(scope)
    .filter((p) => entityRefOf(p.id).type === PRESET_FILTER)
    .map((p) => [p.id, { heading: p.label, icon: 'filter', description: 'This page\'s Preset Filter.', rows: [], model: 'ScopeDefinition.presets', graphs: ['query'], category: 'Custom Nodes' } as NodeKind])));
  // A component's live copy, kept while the same component is shown: it asks the provider as the page's does.
  let visual: { id: string; el: HTMLElement } | null = null;
  // Its own writes and restores are no change from outside.
  let quiet = 0;
  return {
    // Its kinds now: the registry's, and the page's Preset Filters.
    get kinds() {
      return { ...NODE_KINDS, ...customs() };
    },
    read() {
      drawn = laidOut(derived(), layout);
      return queryDefinition(definition.id, drawn, layout);
    },
    graph(def) {
      const g = laidOut(derived(), layoutOf(def));
      return { ...g, ...(def.ties ? { ties: def.ties } : {}), ...(def.frames ? { frames: def.frames } : {}) };
    },
    write(next) {
      const before = queryDefinition(definition.id, drawn, layout);
      const done = reconcileQuery(before, next, drawn, {
        type: typeOf, values, kept,
        // A Preset Filter is placed in the scope that declares it. TODO 776
        scopeOf: (kind) => scopesOf().find((scope) => query.presets(scope).some((p) => p.id === kind)),
        place: {
          holds: (scope) => query.scope(scope), fields: (scope) => query.fields(scope),
          presets: (scope) => query.presets(scope), on: (scope, id) => query.presetOn(scope, id), kept,
          ...(definition.source?.store ? { store: definition.source.store } : {}), ...(facts.stores ? { stores: facts.stores } : {}),
        },
      });
      for (const { code, message } of done.refused) report({ code, message });
      if (done.kept) keep(done.kept);
      layout = done.layout;
      session?.set(layoutAt, layout);
      quiet++;
      try {
        // Each row against the Query as the last one left it: a type changed first may reshape the rest.
        for (const row of done.edits) {
          const asked = rowRequest(derived(), row, { type: typeOf, kept });
          if (asked && 'kept' in asked) keep(asked.kept);
          else if (asked) query.ask(asked.request);
        }
        for (const request of done.requests) query.ask(request);
      } finally {
        quiet--;
      }
    },
    snapshot: () => ({ query: query.draft, kept, layout }),
    restore(snap) {
      const to = snap as { query: typeof query.draft; kept: readonly KeptSource[]; layout: GraphLayout } | undefined;
      if (!to) return;
      keep(to.kept);
      layout = to.layout;
      session?.set(layoutAt, layout);
      // A step on the Query is its WHOLE restore, as a chip's undo is; Apply is no step. TRAP T-an-edit-is-a-step
      if (JSON.stringify(to.query) === JSON.stringify(query.draft)) return;
      quiet++;
      return query.restoreDraft(to.query, { by: 'undo' }).finally(() => { quiet--; });
    },
    watch(changed) {
      const heard = (): void => { if (!quiet) changed(); };
      query.addEventListener('query-change', heard);
      return () => query.removeEventListener('query-change', heard);
    },
    palette: () => paletteOf({ ...NODE_KINDS, ...customs() }, 'query'),
    visual(node: GraphNode) {
      const id = node.ref?.['component'];
      const page = id ? markup.getElementById(id) : null;
      if (!id || !page) return null;
      if (visual?.id === id) return visual.el;
      // A COPY of the page's own component: its ids would clash, so it has none.
      const el = document.importNode(page, true) as HTMLElement;
      for (const one of [el, ...el.querySelectorAll('[id]')]) one.removeAttribute('id');
      const scope = node.ref?.['scope'];
      if (scope && scope !== VIEW) el.setAttribute('data-scope', scope);
      el.style.blockSize = '18rem';
      visual = { id, el };
      return el;
    },
    save() {
      const page = pageWithQuery(definition, query.draft, { pageSize: source.state?.pageSize ?? null, type: (f) => typeOf(f) as FieldType | undefined });
      return checkPage(page) ? page : false;
    },
    runs: 'A page\'s filters run as the page loads: Fetch and Play run a workflow',
    lights: (canvas) => watchQuery(canvas, source, definition),
  };
}

/** The one node editor, on a page's Query: it draws what the controls show — the draft — and asks the Query for each edit
 *  through the one door a chip asks through. TRAP T-one-command-one-door */
export function bindQueryEditor(canvas: SherpaLayoutCanvas, source: QuerySource, options: QueryEditorOptions): WorkflowEditor {
  const doc = queryDocument(source, options);
  const { inspector, toolbar, panel, session, stageDialog, header } = options;
  return bindWorkflow(canvas, doc.read(), {
    document: doc, kinds: doc.kinds,
    ...(inspector ? { inspector } : {}), ...(toolbar ? { toolbar } : {}), ...(panel ? { panel } : {}),
    ...(session ? { session } : {}), ...(stageDialog ? { stageDialog } : {}), ...(header ? { header } : {}),
  });
}

