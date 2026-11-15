/**
 * graph-layout.ts — how a graph is DRAWN: its ties, frames, stages and lanes, and where each part sits. A Custom Node's
 * definition, an entity's graph, the body a use opens and a page's Query (its layout, for the tab) each keep them, through
 * the helpers here. Pure, and light: no import at run time. TODO 947, 1001, 1004e · TRAP T-a-place-is-no-edit
 *
 * Map:
 * - LayoutParts — How a graph is drawn: its ties, frames, stages and lanes, and whether it is laid out yet.
 * - layoutParts — A graph's layout, each part only where it holds something.
 * - isGroupEnd — Whether a node is a body's Group Input or Output: placed from its body, never kept or moved.
 * - connectionKey — A connection's key in its graph, as its bends are kept by: `from>to`.
 * - Placed — A graph as its places are read from it: nodes, connections, ties, stages, swimlanes, its marks.
 * - GraphPlaces — Where a graph is drawn, each part by its id: what saves itself, never an edit.
 * - placesOf — Where a graph is drawn, each part by its id.
 * - isGraphPlaces — Whether a stored value is a GraphPlaces: a wrong shape is dropped, never drawn.
 * - withoutPlaces — A graph with nothing of where it is drawn: what it does alone, for a hash.
 * - withPlaces — A graph with these places on each part they name; a part they do not name keeps its own.
 * - tiesAmong — The ties left when only these connections remain: a tie keeps its connections still there; with none, it goes.
 */
import type { NodeConnection, NodeSize, NodeTie } from './node-kinds.js';
import type { NodeFrame } from './node-frames.js';
import type { WorkflowDefinition } from './workflow.js';

/** How a graph is drawn: its ties, frames, stages and lanes, and each node's place before the lanes. */
export interface LayoutParts {
  ties?: readonly NodeTie[];
  frames?: readonly NodeFrame[];
  stages?: NonNullable<WorkflowDefinition['stages']>;
  lanes?: NonNullable<WorkflowDefinition['lanes']>;
  beforeLanes?: NonNullable<WorkflowDefinition['beforeLanes']>;
  /** Not laid out yet: it travels with the layout, wherever a graph goes, until the editor unfurls it (TODO 958). */
  unfurl?: true;
  /** Laid out by hand: a move set it, so the graph is not unfurled when it opens; the toolbar's Unfurl clears it (D4 A). */
  byHand?: true;
}

/** A graph's layout, each part only where it holds something: no empty list is kept, nor places with no lanes to put back. */
export function layoutParts(g: { readonly [K in keyof LayoutParts]?: LayoutParts[K] | undefined }): LayoutParts {
  return {
    ...(g.ties?.length ? { ties: g.ties } : {}), ...(g.frames?.length ? { frames: g.frames } : {}), ...(g.stages?.length ? { stages: g.stages } : {}),
    ...(g.lanes?.length ? { lanes: g.lanes, ...(g.beforeLanes ? { beforeLanes: g.beforeLanes } : {}) } : {}),
    ...(g.unfurl ? { unfurl: true as const } : {}), ...(g.byHand ? { byHand: true as const } : {}),
  };
}

/** Whether a node is a body's Group Input or Output: placed from its body each time, never kept, moved or framed. The
 *  Start, the other `#` node, is kept and moved as any node (TODO 955). */
export const isGroupEnd = (id: string): boolean => id === '#in' || id === '#out';

/** A connection's key in its graph, as its bends are kept by: `from>to`. */
export const connectionKey = (r: Pick<NodeConnection, 'from' | 'to'>): string => `${r.from}>${r.to}`;

type Point = { x: number; y: number };
type Stage = NonNullable<WorkflowDefinition['stages']>[number];

/** A graph as its places are read from it: its nodes, connections, ties and stages, its swimlanes, its unfurl mark. */
export interface Placed {
  nodes: readonly { id: string; x: number; y: number; size?: NodeSize | undefined }[];
  connections?: readonly NodeConnection[] | undefined;
  ties?: readonly NodeTie[] | undefined;
  stages?: readonly Stage[] | undefined;
  lanes?: WorkflowDefinition['lanes'] | undefined;
  beforeLanes?: WorkflowDefinition['beforeLanes'] | undefined;
  unfurl?: true | undefined;
  byHand?: true | undefined;
}

/** Where a graph is drawn, each part by its id: what saves itself and is no part of a version (Will, TODO 1001; plan 1001
 *  D1 A). A node's place and size, each tie whole (a tie made or cut is layout too: Will, 2026-11-15), a connection's
 *  bends (none, `[]`), a stage's left and width, the swimlanes with the places before them, and the unfurl and by-hand marks. A node's
 *  stage is no place: it changes the run (D2 A). */
export interface GraphPlaces {
  nodes: Readonly<Record<string, Point & { size?: NodeSize }>>;
  /** None: the graph keeps its own. */
  ties?: readonly NodeTie[];
  bends: Readonly<Record<string, readonly Point[]>>;
  stages: Readonly<Record<string, { x: number; w?: number }>>;
  lanes?: WorkflowDefinition['lanes'];
  beforeLanes?: WorkflowDefinition['beforeLanes'];
  unfurl?: true;
  byHand?: true;
}

/** Where a graph is drawn, each part by its id. */
export function placesOf(graph: Placed): GraphPlaces {
  return {
    nodes: Object.fromEntries(graph.nodes.map((n) => [n.id, { x: n.x, y: n.y, ...(n.size ? { size: n.size } : {}) }])),
    ties: (graph.ties ?? []).map((t) => ({ id: t.id, x: t.x, y: t.y, connections: t.connections.map(({ from, to }) => ({ from, to })) })),
    bends: Object.fromEntries((graph.connections ?? []).map((c) => [connectionKey(c), c.via ?? []])),
    stages: Object.fromEntries((graph.stages ?? []).map((st) => [st.id, st.w === undefined ? { x: st.x } : { x: st.x, w: st.w }])),
    ...(graph.lanes?.length ? { lanes: graph.lanes, ...(graph.beforeLanes ? { beforeLanes: graph.beforeLanes } : {}) } : {}),
    ...(graph.unfurl ? { unfurl: true as const } : {}), ...(graph.byHand ? { byHand: true as const } : {}),
  };
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const point = (v: unknown): v is Record<string, unknown> => record(v) && Number.isFinite(v['x']) && Number.isFinite(v['y']);
const each = (v: unknown, ok: (one: unknown) => boolean): boolean => record(v) && Object.values(v).every(ok);

/** Whether a stored value is a GraphPlaces: a wrong shape is dropped, never drawn. */
export function isGraphPlaces(v: unknown): v is GraphPlaces {
  if (!record(v)) return false;
  return each(v['nodes'], (n) => point(n) && (n['size'] === undefined || record(n['size'])))
    && (v['ties'] === undefined || Array.isArray(v['ties']) && v['ties'].every((t) => point(t) && typeof t['id'] === 'string' && Array.isArray(t['connections'])
      && t['connections'].every((r) => record(r) && typeof r['from'] === 'string' && typeof r['to'] === 'string')))
    && each(v['bends'], (b) => Array.isArray(b) && b.every(point))
    && each(v['stages'], (st) => record(st) && Number.isFinite(st['x']))
    && (v['lanes'] === undefined || Array.isArray(v['lanes'])) && (v['beforeLanes'] === undefined || each(v['beforeLanes'], point))
    && (v['unfurl'] === undefined || v['unfurl'] === true) && (v['byHand'] === undefined || v['byHand'] === true);
}

/** A graph with nothing of where it is drawn: what it does alone, for a hash. */
export function withoutPlaces(graph: Placed): Record<string, unknown> {
  const { nodes, connections, ties: _ties, stages, lanes: _lanes, beforeLanes: _before, unfurl: _unfurl, byHand: _hand, ...rest } = graph;
  return {
    ...rest,
    nodes: nodes.map(({ x: _x, y: _y, size: _size, ...n }) => n),
    ...(connections ? { connections: connections.map(({ via: _via, ...c }) => c) } : {}),
    ...(stages ? { stages: stages.map(({ x: _x, w: _w, ...st }) => st) } : {}),
  };
}

/** A graph with these places on each part they name; a part they do not name (one added since) keeps its own. Its ties,
 *  swimlanes and marks are theirs: a tie keeps the connections the graph still has, and with none it goes. */
export function withPlaces<G extends Placed>(graph: G, places: GraphPlaces): G {
  const { ties: _ties, lanes: _lanes, beforeLanes: _before, unfurl: _unfurl, byHand: _hand, ...rest } = graph;
  const nodes = graph.nodes.map((n) => {
    const at = places.nodes[n.id];
    if (!at) return n;
    const { size: _size, ...bare } = n;
    return { ...bare, x: at.x, y: at.y, ...(at.size ? { size: at.size } : {}) };
  });
  const connections = graph.connections?.map((c) => {
    const via = places.bends[connectionKey(c)];
    if (!via) return c;
    const { via: _via, ...bare } = c;
    return via.length ? { ...bare, via } : bare;
  });
  const ties = places.ties ? tiesAmong(places.ties, graph.connections ?? []) : graph.ties ?? [];
  const stages = graph.stages?.map((st) => {
    const at = places.stages[st.id];
    if (!at) return st;
    const { w: _w, ...bare } = st;
    return { ...bare, x: at.x, ...(at.w === undefined ? {} : { w: at.w }) };
  });
  return {
    ...rest, nodes,
    ...(connections ? { connections } : {}), ...(ties.length ? { ties } : {}), ...(stages ? { stages } : {}),
    ...(places.lanes ? { lanes: places.lanes, ...(places.beforeLanes ? { beforeLanes: places.beforeLanes } : {}) } : {}),
    ...(places.unfurl ? { unfurl: true as const } : {}), ...(places.byHand ? { byHand: true as const } : {}),
  } as unknown as G;
}

/** The ties left when only these connections remain: a tie keeps its connections still there; with none, it goes. */
export function tiesAmong(ties: readonly NodeTie[] | undefined, connections: readonly Pick<NodeConnection, 'from' | 'to'>[]): NodeTie[] {
  return (ties ?? []).flatMap((t) => {
    const kept = t.connections.filter((r) => connections.some((x) => x.from === r.from && x.to === r.to));
    return kept.length ? [kept.length === t.connections.length ? t : { ...t, connections: kept }] : [];
  });
}
