/**
 * query-document.ts — a page's QUERY as a definition the one node editor reads and writes (plan 885). READ: the Query's
 * derived graph as a v2 workflow definition, with the LAYOUT a reader gave it (places, sizes, bends, ties, frames, stages,
 * lanes), which the Query holds none of. WRITTEN: a RECONCILE — what changed between two definitions, asked of the Query
 * through its own doors (a chip's), the Sources the editor keeps, the layout, and what is refused, in words. DOM-free.
 * Will, 2026-11-10 · docs/history/plan-885-one-node-editor.md · TRAP T-the-node-editor-asks-the-query
 *
 * Map:
 * - GraphLayout — What a reader gave a Query's graph that the Query does not hold.
 * - isGraphLayout — Whether a stored value is a GraphLayout.
 * - laidOut — A Query's derived graph, at the places, sizes and bends its layout gives.
 * - queryDefinition — A Query's drawn graph, and its layout, as a definition.
 * - layoutOf — The layout a definition holds.
 * - Reconciled — What a written definition asks of the Query.
 * - ReconcileFacts — What a reconcile needs of the Query: its types and values, its placing, and the kept Sources.
 * - reconcileQuery — What changed between two definitions, as requests, kept Sources, layout and refusals.
 */
import { placed, socketOf, type DrawnGraph, type GraphEdit, type NodePlaces, type NodeRoute, type NodeTie } from './node-kinds.js';
import { framesAmong, type NodeFrame } from './node-frames.js';
import type { NodeStage } from './node-stages.js';
import type { NodeLane } from './node-lanes.js';
import { bendFault, type Bend } from './route-bends.js';
import { tiesAmong, type WorkflowDefinition, type WorkflowNode } from './workflow.js';
import { graphRequest, keptEdit, placeRequest, routeRequest, type KeptSource, type PlaceFacts, type QueryGraphFacts } from './query-graph.js';
import { VIEW, type QueryRequest } from './query.js';

/** What a reader gave a Query's graph that the Query does not hold: kept beside it, for the tab. */
export interface GraphLayout {
  places?: NodePlaces;
  /** A route's bend points, by `from>to`. */
  bends?: Readonly<Record<string, readonly Bend[]>>;
  ties?: readonly NodeTie[];
  frames?: readonly NodeFrame[];
  stages?: readonly NodeStage[];
  lanes?: readonly NodeLane[];
  /** The stage each node is in, by node. */
  staged?: Readonly<Record<string, string>>;
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): boolean => v === undefined || Array.isArray(v);

/** Whether a stored value is a GraphLayout: a wrong shape is dropped, never drawn. */
export function isGraphLayout(v: unknown): v is GraphLayout {
  if (!record(v)) return false;
  const places = v['places'];
  const bends = v['bends'];
  return (places === undefined || (record(places) && Object.values(places).every((p) => record(p) && typeof p['x'] === 'number' && typeof p['y'] === 'number')))
    && (bends === undefined || (record(bends) && Object.values(bends).every((b) => !bendFault(b))))
    && list(v['ties']) && list(v['frames']) && list(v['stages']) && list(v['lanes'])
    && (v['staged'] === undefined || record(v['staged']));
}

const bendKey = (r: Pick<NodeRoute, 'from' | 'to'>): string => `${r.from}>${r.to}`;

/** A Query's derived graph, at the places, sizes and bends its layout gives. */
export function laidOut(graph: DrawnGraph, layout: GraphLayout): DrawnGraph {
  const at = placed(graph, layout.places ?? {});
  return { ...at, routes: at.routes.map((r) => (layout.bends?.[bendKey(r)] ? { ...r, via: layout.bends[bendKey(r)]! } : r)) };
}

/** A Query's drawn graph (laid out), and its layout, as a definition: each node's rows as its values. */
export function queryDefinition(id: string, graph: DrawnGraph, layout: GraphLayout): WorkflowDefinition {
  const nodes = graph.nodes.map((n): WorkflowNode => {
    const values = Object.fromEntries(n.rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== '').map((r) => [r.name, r.value]));
    const stage = layout.staged?.[n.id];
    return { id: n.id, kind: n.kind, x: n.x, y: n.y, ...(n.size ? { size: n.size } : {}), ...(Object.keys(values).length ? { values } : {}), ...(stage ? { stage } : {}) };
  });
  const ids = nodes.map((n) => n.id);
  const ties = tiesAmong(layout.ties as NodeTie[] | undefined, graph.routes);
  const frames = framesAmong(layout.frames, ids);
  return {
    v: 2, id, nodes, routes: graph.routes,
    ...(ties.length ? { ties } : {}), ...(frames.length ? { frames } : {}),
    ...(layout.stages?.length ? { stages: layout.stages } : {}), ...(layout.lanes?.length ? { lanes: layout.lanes } : {}),
  };
}

/** The layout a definition holds: every node's place and size, each route's bends, its ties, frames, stages and lanes. */
export function layoutOf(definition: WorkflowDefinition): GraphLayout {
  const places = Object.fromEntries(definition.nodes.map((n) => [n.id, { x: n.x, y: n.y, ...(n.size ? { size: n.size } : {}) }]));
  const bends = Object.fromEntries((definition.routes ?? []).flatMap((r) => (r.via?.length ? [[bendKey(r), r.via]] : [])));
  const staged = Object.fromEntries(definition.nodes.flatMap((n) => (n.stage ? [[n.id, n.stage]] : [])));
  return {
    places,
    ...(Object.keys(bends).length ? { bends } : {}),
    ...(definition.ties?.length ? { ties: definition.ties } : {}),
    ...(definition.frames?.length ? { frames: definition.frames } : {}),
    ...(definition.stages?.length ? { stages: definition.stages } : {}),
    ...(definition.lanes?.length ? { lanes: definition.lanes } : {}),
    ...(Object.keys(staged).length ? { staged } : {}),
  };
}

/** What a written definition asks of the Query: its requests, in order; the kept Sources, where they changed; the
 *  layout to keep; and what it cannot do, in words. */
export interface Reconciled {
  requests: QueryRequest[];
  kept?: KeptSource[];
  layout: GraphLayout;
  refused: string[];
}

/** What a reconcile needs of the Query: its types and values, what placing a node needs, and the Sources the editor keeps. */
export interface ReconcileFacts extends Pick<QueryGraphFacts, 'type' | 'values'> {
  place: PlaceFacts;
  kept: readonly KeptSource[];
}

const READINGS = 'The Query\'s nodes and routes are its readings: turn a condition off, or clear it, to take it from its scope.';

/**
 * What changed between two definitions of a Query, as the Query's own requests: a row's new value (`graphRequest`, or a
 * kept Source's Store); a new route (`routeRequest`); a new node (`placeRequest`, in the scope of the node it joins, else
 * the View). A route cut, or a reading removed, is refused; a kept Source removed goes. The layout is the written one's.
 * `graph` is the Query's graph as `before` was drawn from it.
 */
export function reconcileQuery(before: WorkflowDefinition, after: WorkflowDefinition, graph: DrawnGraph, facts: ReconcileFacts): Reconciled {
  const requests: QueryRequest[] = [];
  const refused = new Set<string>();
  let kept: KeptSource[] | undefined;
  const drawn = new Map(graph.nodes.map((n) => [n.id, n]));
  const was = new Map(before.nodes.map((n) => [n.id, n]));
  const now = new Map(after.nodes.map((n) => [n.id, n]));
  // A row's new value: each row whose value changed, as the edit of that row.
  for (const node of after.nodes) {
    const old = was.get(node.id);
    const live = drawn.get(node.id);
    if (!old || !live) continue;
    for (const name of new Set([...Object.keys(old.values ?? {}), ...Object.keys(node.values ?? {})])) {
      const [a, b] = [old.values?.[name], node.values?.[name]];
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
      const row = live.rows.find((r) => r.name === name);
      if (!row) continue;
      const edit: GraphEdit = { node: live, row, value: b };
      const keptNext = keptEdit(kept ?? facts.kept, edit);
      if (keptNext) kept = keptNext;
      else {
        const request = graphRequest(edit, facts);
        if (request) requests.push(request);
      }
    }
  }
  // A new node: placed in the scope of the node it joins, else the View. Its own routes are the Query's to draw.
  const added = after.nodes.filter((n) => !was.has(n.id) && !drawn.has(n.id));
  const fresh = new Set(added.map((n) => n.id));
  for (const node of added) {
    const joined = (after.routes ?? []).flatMap((r) => {
      const [a, b] = [socketOf(r.from).node, socketOf(r.to).node];
      return a === node.id ? [b] : b === node.id ? [a] : [];
    });
    const scope = joined.map((id) => drawn.get(id)?.ref?.['scope']).find(Boolean) ?? VIEW;
    const answer = placeRequest(node.kind, scope, { ...facts.place, kept: kept ?? facts.kept });
    if ('refused' in answer) refused.add(answer.refused);
    else if ('keep' in answer) kept = [...(kept ?? facts.kept), answer.keep];
    else requests.push(answer.request);
  }
  // A new route between nodes the Query draws: the command it asks, or why not. One cut is refused, as is a reading removed.
  const key = (r: NodeRoute): string => `${r.from}>${r.to}`;
  const had = new Set((before.routes ?? []).map(key));
  const has = new Set((after.routes ?? []).map(key));
  for (const route of after.routes ?? []) {
    if (had.has(key(route)) || fresh.has(socketOf(route.from).node) || fresh.has(socketOf(route.to).node)) continue;
    const answer = routeRequest(graph, route, facts);
    if (answer && 'refused' in answer) refused.add(answer.refused);
    else if (answer) requests.push(answer.request);
  }
  for (const route of before.routes ?? []) {
    if (!has.has(key(route)) && now.has(socketOf(route.from).node) && now.has(socketOf(route.to).node)) refused.add(READINGS);
  }
  for (const node of before.nodes) {
    if (now.has(node.id)) continue;
    const own = drawn.get(node.id)?.ref?.['kept'];
    if (own) kept = (kept ?? facts.kept).filter((k) => k.id !== own);
    else refused.add(READINGS);
  }
  return { requests, ...(kept ? { kept } : {}), layout: layoutOf({ ...after, nodes: after.nodes.filter((n) => !fresh.has(n.id)) }), refused: [...refused] };
}
