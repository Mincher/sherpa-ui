/**
 * node-start.ts — the START: a top graph's entry point, always there (Will, plan 949 D3 B). Each Trigger joins it by its
 * header's True; it sends nothing (D2 A), and its line to each Source is drawn, never kept (Will). It is kept as any node
 * is, and moved, unfurled and arranged as one (Will, TODO 955): added where a graph has none, beside the Triggers joined
 * to it in the first stage; never removed; always in the first stage. A graph with a Group Input or Output is entered by
 * them, and has none. A Model joined to its Model row is the graph's PRIMARY: every AI node uses it, in its Custom
 * Nodes too, unless one is joined to its own (plan 951). Pure: no DOM.
 *
 * Map:
 * - START — The Start's node id, and its kind's: `#start`.
 * - START_KIND — The Start's kind: an input for many Triggers; an output for its drawn lines; a Model row. Not in the panel.
 * - ModelPick — A provider and its model, as a Model node picks them.
 * - modelInto — The pick of the Model node a connection into a row comes from.
 * - primaryOf — The graph's primary model: the pick of the Model joined to its Start's Model row; none, it has none.
 * - withStartKind — The kinds with the Start's: what draws and checks a top graph adds.
 * - hasStart — Whether a graph has a Start: one with no Group Input or Group Output.
 * - withStart — The graph with its Start, in the first stage; one added stands right of its Triggers there, clear of all.
 * - startFaults — What joins the Start that may not, in words: only a Trigger does, by its header; none leaves it.
 * - unstarted — Whether a node is a Trigger that is not joined to the Start: it warns.
 */
import { socketOf, type NodeConnection, type NodeKind } from './node-kinds.js';
import { DEFAULT_STAGE, STAGE_PAD } from './node-stages.js';

/** The Start's node id, and its kind's: `#start`. */
export const START = '#start';

/** The Start's kind: an input that takes many Triggers; an output, for its lines to the Sources, which are drawn and send
 *  nothing (D2 A); a Model row, the graph's primary, which a graph may go without. It wears its Triggers' look; its `#`
 *  keeps it out of the panel. */
export const START_KIND: NodeKind = {
  heading: 'Start', icon: 'play', description: 'Where the graph starts: its Triggers join it', input: 'boolean', many: true,
  output: 'boolean', rows: [{ name: 'model', label: 'Model', input: 'object', needs: 'model', optional: true }], model: 'start', graphs: ['workflow'], category: 'Triggers',
};

/** A provider and its model, as a Model node picks them. */
export interface ModelPick {
  provider?: string;
  model: string;
}

/** The pick of the Model node a connection into `to` comes from; none, it is no Model's, or picks no model. */
export function modelInto(graph: Pick<Graph, 'connections'> & { nodes: readonly { id: string; kind: string; values?: Readonly<Record<string, unknown>> }[] }, to: string): ModelPick | undefined {
  const from = (graph.connections ?? []).find((r) => r.to === to);
  const node = from && graph.nodes.find((n) => n.id === socketOf(from.from).node);
  const { provider, model } = node?.kind === 'model' ? node.values ?? {} : {};
  return typeof model === 'string' && model ? { model, ...(typeof provider === 'string' && provider ? { provider } : {}) } : undefined;
}

/** The graph's primary model: the pick of the Model joined to its Start's Model row; none, it has none (plan 951). */
export const primaryOf = (graph: Parameters<typeof modelInto>[0]): ModelPick | undefined => modelInto(graph, `${START}/model`);

/** The kinds with the Start's: what draws and checks a top graph adds, as a body's adds its Group Input's. */
export const withStartKind = <K extends Readonly<Record<string, NodeKind>>>(kinds: K): K => (START in kinds ? kinds : { ...kinds, [START]: START_KIND });

/** The space between the Start and the Triggers joined to it, and below a node in its way, in plane px. */
const GAP = 120;
const BELOW = 40;
/** The Start's own height, a header alone. */
const START_HEIGHT = 64;

/** What the Start reads of a graph: its nodes and their places, and its connections. */
interface Graph {
  nodes: readonly { id: string; kind: string; x: number; y: number; size?: { w: number }; stage?: string }[];
  connections?: readonly NodeConnection[];
  stages?: readonly { id: string; x: number }[];
}

/** A node's width or height on the plane, as the caller draws it. */
type WidthOf = (node: { size?: { w: number } }) => number;
type HeightOf = (node: { id: string }) => number;

/** Whether a graph has a Start: one with no Group Input or Group Output, which enter a Custom Node's body or a type's graph. */
export const hasStart = (graph: Pick<Graph, 'nodes'>): boolean => !graph.nodes.some((n) => n.id === '#in' || n.id === '#out');

/** The graph with its Start, in the first stage (Will). One added stands right of the Triggers joined to it there, at
 *  their middle; with none, at the first stage's left edge, or left of every node where no stage is written; and down past
 *  any node in its way. One kept stays where it is, in the first stage. A graph that has its Start so, or has none, is
 *  given back. */
export function withStart<G extends Graph>(graph: G, widthOf: WidthOf, heightOf: HeightOf = () => 120): G {
  if (!hasStart(graph)) return graph;
  const first = graph.stages?.[0];
  const kept = graph.nodes.find((n) => n.id === START);
  if (kept) return !first || kept.stage === first.id ? graph : { ...graph, nodes: graph.nodes.map((n) => (n === kept ? { ...n, stage: first.id } : n)) };
  const joined = new Set((graph.connections ?? []).filter((r) => r.to === START).map((r) => socketOf(r.from).node));
  const triggers = graph.nodes.filter((n) => joined.has(n.id) && (!first || n.stage === first.id));
  const w = widthOf({});
  const x = triggers.length ? Math.max(...triggers.map((n) => n.x + widthOf(n))) + GAP
    : first ? first.x + STAGE_PAD : Math.min(0, ...graph.nodes.map((n) => n.x)) - w - GAP;
  const inWay = (y: number): G['nodes'][number] | undefined => graph.nodes.find((n) => x < n.x + widthOf(n) && n.x < x + w && y < n.y + heightOf(n) && n.y < y + START_HEIGHT);
  let y = triggers.length ? Math.round(triggers.reduce((sum, n) => sum + n.y, 0) / triggers.length) : Math.min(0, ...graph.nodes.map((n) => n.y));
  for (let hit = inWay(y), i = 0; hit && i < graph.nodes.length; hit = inWay(y), i++) y = hit.y + heightOf(hit) + BELOW;
  return { ...graph, nodes: [...graph.nodes, { id: START, kind: START, x, y, stage: first?.id ?? DEFAULT_STAGE.id }] };
}

/** What joins the Start that may not, in words: only a Trigger does, by its header (plan 949 D1 A); and none leaves it,
 *  as its lines to the Sources are drawn, never kept. */
export function startFaults(graph: Graph): string[] {
  const held = new Map(graph.nodes.map((n) => [n.id, n]));
  return (graph.connections ?? []).flatMap((r) => {
    if (socketOf(r.from).node === START) return [`the connection "${r.from}" → "${r.to}": the Start's lines to the Sources are drawn, and none is kept`];
    if (r.to !== START) return [];
    const from = socketOf(r.from);
    return held.get(from.node)?.kind === 'trigger' && from.row === undefined ? [] : [`the connection "${r.from}" → "${START}": only a Trigger joins the Start, by its header`];
  });
}

/** Whether a node is a Trigger that is not joined to the Start, in a graph that has one: it warns "Connect it to the Start". */
export function unstarted(graph: Graph, node: { id: string; kind: string }): boolean {
  return node.kind === 'trigger' && hasStart(graph) && !(graph.connections ?? []).some((r) => r.from === node.id && r.to === START);
}
