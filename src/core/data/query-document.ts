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
 * - RowEdit — One row's new value, by its node's id and the row's name.
 * - Reconciled — What a written definition asks of the Query.
 * - ReconcileFacts — What a reconcile needs of the Query: its types and values, its placing, and the kept Sources.
 * - reconcileQuery — What changed between two definitions, as row edits, requests, kept Sources, layout and refusals.
 * - rowRequest — What one row's new value asks, against the Query's graph as it is now.
 */
import { placed, socketOf, storedValues, type DrawnGraph, type GraphEdit, type NodePlaces, type NodeConnection, type NodeTie } from './node-kinds.js';
import { framesAmong, type NodeFrame } from './node-frames.js';
import type { NodeStage } from './node-stages.js';
import type { NodeLane } from './node-lanes.js';
import { bendFault, type Bend } from './connector-bends.js';
import { tiesAmong, type WorkflowDefinition, type WorkflowNode } from './workflow.js';
import { graphRequest, keptEdit, orderRequest, placeRequest, connectionRequest, type KeptSource, type PlaceFacts, type QueryGraphFacts } from './query-graph.js';
import { VIEW, type QueryRequest } from './query.js';

/** What a reader gave a Query's graph that the Query does not hold: kept beside it, for the tab. */
export interface GraphLayout {
  places?: NodePlaces;
  /** A connection's bend points, by `from>to`. */
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

const bendKey = (r: Pick<NodeConnection, 'from' | 'to'>): string => `${r.from}>${r.to}`;

/** A Query's derived graph, at the places, sizes and bends its layout gives. */
export function laidOut(graph: DrawnGraph, layout: GraphLayout): DrawnGraph {
  const at = placed(graph, layout.places ?? {});
  return { ...at, connections: at.connections.map((r) => (layout.bends?.[bendKey(r)] ? { ...r, via: layout.bends[bendKey(r)]! } : r)) };
}

/** A Query's drawn graph (laid out), and its layout, as a definition: each node's rows as its values. */
export function queryDefinition(id: string, graph: DrawnGraph, layout: GraphLayout): WorkflowDefinition {
  const nodes = graph.nodes.map((n): WorkflowNode => {
    const values = storedValues(n.rows);
    const stage = layout.staged?.[n.id];
    return { id: n.id, kind: n.kind, x: n.x, y: n.y, ...(n.size ? { size: n.size } : {}), ...(Object.keys(values).length ? { values } : {}), ...(stage ? { stage } : {}) };
  });
  const ids = nodes.map((n) => n.id);
  const ties = tiesAmong(layout.ties as NodeTie[] | undefined, graph.connections);
  const frames = framesAmong(layout.frames, ids);
  // Its name, where a trail names it: a page's Query (plan 960 U4.7b).
  return {
    v: 3, id, label: 'Query', nodes, connections: graph.connections,
    ...(ties.length ? { ties } : {}), ...(frames.length ? { frames } : {}),
    ...(layout.stages?.length ? { stages: layout.stages } : {}), ...(layout.lanes?.length ? { lanes: layout.lanes } : {}),
  };
}

/** The layout a definition holds: every node's place and size, each connection's bends, its ties, frames, stages and lanes. */
export function layoutOf(definition: WorkflowDefinition): GraphLayout {
  const places = Object.fromEntries(definition.nodes.map((n) => [n.id, { x: n.x, y: n.y, ...(n.size ? { size: n.size } : {}) }]));
  const bends = Object.fromEntries((definition.connections ?? []).flatMap((r) => (r.via?.length ? [[bendKey(r), r.via]] : [])));
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

/** One row's new value, by its node's id and the row's name: asked of the Query as the edit of that row. */
export interface RowEdit {
  node: string;
  row: string;
  value: unknown;
}

/** What a written definition asks of the Query: its rows' new values, in order (a node's type first), to ask one at a
 *  time against the Query as each leaves it (`rowRequest`); its other requests; the kept Sources, where they changed; the
 *  layout to keep; and what it cannot do, in words. */
export interface Reconciled {
  edits: RowEdit[];
  requests: QueryRequest[];
  kept?: KeptSource[];
  layout: GraphLayout;
  /** What it cannot do: a code (query-connection, query-remove, query-place) and the words. */
  refused: { code: string; message: string }[];
}

/** What a reconcile needs of the Query: its types and values, what placing a node needs, and the Sources the editor keeps. */
export interface ReconcileFacts extends Pick<QueryGraphFacts, 'type' | 'values'> {
  place: PlaceFacts;
  kept: readonly KeptSource[];
  /** The scope a kind of node belongs in wherever it is placed: a Filter's declaring scope. */
  scopeOf?: (kind: string) => string | undefined;
}

/** The words a cut or a removal is refused in: the Query's connections and nodes are its readings. */
const CONNECTIONS_READ = 'The Query\'s connections are its readings: turn a condition off, or clear it, to take it from its scope.';
const NODES_READ = 'The Query\'s nodes are its readings: turn a condition off, or clear it, to take it from its scope.';

/**
 * What changed between two definitions of a Query, as the Query's own requests: a row's new value (`graphRequest`, or a
 * kept Source's Store); a bar's chips in another order (`orderRequest`); a new connection (`connectionRequest`); a new node (`placeRequest`, in the scope of the node it joins, else
 * the View). A read-only row changed, a connection cut, or a reading removed, is refused; a kept Source removed goes. The layout is the written one's.
 * `graph` is the Query's graph as `before` was drawn from it. A kind that belongs in one scope (`scopeOf`) is placed there.
 */
export function reconcileQuery(before: WorkflowDefinition, after: WorkflowDefinition, graph: DrawnGraph, facts: ReconcileFacts): Reconciled {
  const edits: RowEdit[] = [];
  const requests: QueryRequest[] = [];
  const refused = new Map<string, { code: string; message: string }>();
  const refuse = (code: string, message: string): void => { refused.set(`${code}:${message}`, { code, message }); };
  let kept: KeptSource[] | undefined;
  const drawn = new Map(graph.nodes.map((n) => [n.id, n]));
  const was = new Map(before.nodes.map((n) => [n.id, n]));
  const now = new Map(after.nodes.map((n) => [n.id, n]));
  // A row's new value: each row whose value changed, a node's type first — the Query may reshape the rest itself.
  for (const node of after.nodes) {
    const old = was.get(node.id);
    const live = drawn.get(node.id);
    if (!old || !live) continue;
    const names = [...new Set([...Object.keys(old.values ?? {}), ...Object.keys(node.values ?? {})])]
      .filter((name) => JSON.stringify(old.values?.[name]) !== JSON.stringify(node.values?.[name]) && live.rows.some((r) => r.name === name))
      .sort((a, b) => Number(b === 'type') - Number(a === 'type'));
    for (const name of names) {
      const row = live.rows.find((r) => r.name === name)!;
      if (row.editable) edits.push({ node: node.id, row: name, value: node.values?.[name] });
      else refuse('query-row', `No command takes "${row.label}" on "${live.heading}"${row.hint ? `: ${row.hint}` : '.'}`);
    }
    // A bar's chips in another order: the Query's order.
    const order = orderRequest(live, node.values);
    if (order) requests.push(order);
  }
  // A new node: placed in the scope of the node it joins, else the View. Its own connections are the Query's to draw.
  const added = after.nodes.filter((n) => !was.has(n.id) && !drawn.has(n.id));
  const fresh = new Set(added.map((n) => n.id));
  for (const node of added) {
    const joined = (after.connections ?? []).flatMap((r) => {
      const [a, b] = [socketOf(r.from).node, socketOf(r.to).node];
      return a === node.id ? [b] : b === node.id ? [a] : [];
    });
    const scope = facts.scopeOf?.(node.kind) ?? joined.map((id) => drawn.get(id)?.ref?.['scope']).find(Boolean) ?? VIEW;
    const answer = placeRequest(node.kind, scope, { ...facts.place, kept: kept ?? facts.kept });
    if ('refused' in answer) refuse('query-place', answer.refused);
    else if ('keep' in answer) kept = [...(kept ?? facts.kept), answer.keep];
    else requests.push(answer.request);
  }
  // A new connection between nodes the Query draws: the command it asks, or why not. One cut is refused, as is a reading removed.
  const key = (r: NodeConnection): string => `${r.from}>${r.to}`;
  const had = new Set((before.connections ?? []).map(key));
  const has = new Set((after.connections ?? []).map(key));
  for (const connection of after.connections ?? []) {
    if (had.has(key(connection)) || fresh.has(socketOf(connection.from).node) || fresh.has(socketOf(connection.to).node)) continue;
    const answer = connectionRequest(graph, connection, facts);
    if (answer && 'refused' in answer) refuse('query-connection', answer.refused);
    else if (answer) requests.push(answer.request);
  }
  for (const connection of before.connections ?? []) {
    if (!has.has(key(connection)) && now.has(socketOf(connection.from).node) && now.has(socketOf(connection.to).node)) refuse('query-connection', CONNECTIONS_READ);
  }
  for (const node of before.nodes) {
    if (now.has(node.id)) continue;
    const own = drawn.get(node.id)?.ref?.['kept'];
    if (own) kept = (kept ?? facts.kept).filter((k) => k.id !== own);
    else refuse('query-remove', NODES_READ);
  }
  return { edits, requests, ...(kept ? { kept } : {}), layout: layoutOf({ ...after, nodes: after.nodes.filter((n) => !fresh.has(n.id)) }), refused: [...refused.values()] };
}

/**
 * What one row's new value asks, against the Query's graph AS IT IS NOW: the Query's request, or a kept Source's new Store;
 * nothing where the row already says it (the Query reshaped it when the type changed) or is gone.
 */
export function rowRequest(graph: DrawnGraph, edit: RowEdit, facts: Pick<ReconcileFacts, 'type' | 'kept'>): { request: QueryRequest } | { kept: KeptSource[] } | null {
  const node = graph.nodes.find((n) => n.id === edit.node);
  const row = node?.rows.find((r) => r.name === edit.row);
  if (!node || !row || JSON.stringify(row.value ?? null) === JSON.stringify(edit.value ?? null)) return null;
  const graphEdit: GraphEdit = { node, row, value: edit.value };
  const kept = keptEdit(facts.kept, graphEdit);
  if (kept) return { kept };
  const request = graphRequest(graphEdit, facts);
  return request ? { request } : null;
}
