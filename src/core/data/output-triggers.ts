/**
 * output-triggers.ts — what a graph's OUTPUT TRIGGERS start, and the LOOPS among them across the shelf (Will, plan 949 D4 B,
 * D5 A). An Output Trigger starts the entity its entity row picks (an app's Run Coworker), and each graph with a Trigger
 * that hears its event: the same type, and each row the Trigger names the same (a blank one hears any). A ring of them is
 * a loop: each Output Trigger of the graph that is in one is blocked, and warns. The graph still saves. Pure: no DOM.
 *
 * Map:
 * - Graphed — One graph on the shelf, as the loop check reads it: its id, its name and its nodes.
 * - startsOf — What one graph's Output Triggers start: each its node, and the id of the graph it starts.
 * - startLoops — The Output Triggers of a graph that close a loop, each with the ring in words.
 */
import { OUTPUT_TRIGGER, typeOf, type NodeKind } from './node-kinds.js';
import type { WorkflowNode } from './workflow.js';

type Kinds = Readonly<Record<string, NodeKind>>;

/** One graph on the shelf, as the loop check reads it: its id, its name and its nodes. */
export interface Graphed {
  id: string;
  label?: string;
  graph: { nodes: readonly WorkflowNode[] };
}

const blank = (v: unknown): boolean => v == null || v === '' || (Array.isArray(v) && !v.length);

/** What one graph's Output Triggers start, among the graphs given: each its node, and the id of the graph it starts. */
export function startsOf(graph: Graphed['graph'], shelf: readonly Graphed[], kinds: Kinds): { node: string; to: string }[] {
  const family = kinds[OUTPUT_TRIGGER];
  const trigger = kinds['trigger'];
  if (!family) return [];
  return graph.nodes.filter((n) => n.kind === OUTPUT_TRIGGER).flatMap((n) => {
    const at = typeOf(family, n.values?.['type']);
    const rows = at?.type.rows ?? [];
    const picked = rows.filter((r) => r.control === 'entity').map((r) => n.values?.[r.name]).filter((id): id is string => typeof id === 'string' && shelf.some((g) => g.id === id));
    // A Trigger of the same type hears it where each row both name holds the same, or is blank on the Trigger.
    const hears = at && trigger?.types?.[at.id];
    const keys = hears ? rows.filter((r) => hears.rows?.some((h) => h.name === r.name)).map((r) => r.name) : [];
    const heard = hears ? shelf.filter((g) => g.graph.nodes.some((t) => t.kind === 'trigger' && typeOf(trigger!, t.values?.['type'])?.id === at!.id
      && keys.every((k) => blank(t.values?.[k]) || t.values?.[k] === n.values?.[k]))).map((g) => g.id) : [];
    return [...new Set([...picked, ...heard])].map((to) => ({ node: n.id, to }));
  });
}

/** The Output Triggers of a graph that close a loop across the shelf — it starts a graph that, at any depth, starts it
 *  again — each with the ring in words: "Patching › Report › Patching". The graph is read as given, over its shelf copy. */
export function startLoops(open: Graphed, shelf: readonly Graphed[], kinds: Kinds): Map<string, string> {
  const all = [open, ...shelf.filter((g) => g.id !== open.id)];
  const next = new Map(all.map((g) => [g.id, startsOf(g.graph, all, kinds)]));
  const name = (id: string): string => all.find((g) => g.id === id)?.label ?? id;
  // The ids from `at` back to the open graph, or none.
  const back = (at: string, seen: readonly string[]): string[] | undefined => {
    if (at === open.id) return [...seen, at];
    if (seen.includes(at)) return undefined;
    for (const s of next.get(at) ?? []) {
      const ring = back(s.to, [...seen, at]);
      if (ring) return ring;
    }
    return undefined;
  };
  const loops = new Map<string, string>();
  for (const s of next.get(open.id) ?? []) {
    const ring = loops.has(s.node) ? undefined : back(s.to, []);
    if (ring) loops.set(s.node, [open.id, ...ring].map(name).join(' › '));
  }
  return loops;
}
