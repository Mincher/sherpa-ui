/**
 * graph-models.ts — every model a graph uses, in it and in each Custom Node inside it, at any depth: the primary first,
 * each with how many AI nodes use it (plan 951). An AI node uses the Model joined to its own Model row, else the primary;
 * one joined from a Group Input uses what reaches that row of its use. Pure: no DOM.
 * Will, TODO 951 · docs/history/plan-951-one-model-for-the-graph.md
 *
 * Map:
 * - GraphModel — One model a graph uses: its provider and model, how many AI nodes use it, and whether it is the primary.
 * - graphModels — Every model a graph uses, the primary first, each with how many AI nodes use it.
 */
import { kindOfNode, nodeKinds, socketOf, type NodeKind } from './node-kinds.js';
import { innerOf, kindsOf, type NodeLibrary } from './node-library.js';
import { hasStart, modelInto, primaryOf, type ModelPick } from './node-start.js';
import type { WorkflowDefinition } from './workflow.js';

type Kinds = Readonly<Record<string, NodeKind>>;
type Graph = Pick<WorkflowDefinition, 'nodes' | 'connections'>;

/** One model a graph uses: its provider and model, how many AI nodes use it, and whether it is the primary. */
export interface GraphModel extends ModelPick {
  uses: number;
  primary?: true;
}

/** Every model a graph uses, the primary first, even where no AI node uses it; then the rest, in the order first met. */
export function graphModels(workflow: Graph, library: NodeLibrary = { v: 1, nodes: {} }, kinds: Kinds = nodeKinds()): GraphModel[] {
  const primary = hasStart(workflow) ? primaryOf(workflow) : undefined;
  const counted = new Map<string, GraphModel>();
  const key = (pick: ModelPick): string => `${pick.provider ?? ''}/${pick.model}`;
  if (primary) counted.set(key(primary), { ...primary, uses: 0, primary: true });
  // What reaches a row: the pick of the Model joined to it, or, from a Group Input, what reaches that row of the use.
  const reaching = (graph: Graph, address: string, given: (row: string) => ModelPick | undefined): ModelPick | undefined => {
    const joined = (graph.connections ?? []).find((r) => r.to === address);
    const from = joined && socketOf(joined.from);
    return from?.node === '#in' ? given(from.row ?? '') : modelInto(graph, address);
  };
  const walk = (graph: Graph, here: Kinds, given: (row: string) => ModelPick | undefined, stack: readonly string[]): void => {
    for (const node of graph.nodes) {
      for (const row of kindOfNode(here, node)?.rows ?? []) {
        if (row.needs !== 'model' || row.optional) continue;
        const address = `${node.id}/${row.name}`;
        const pick = (graph.connections ?? []).some((r) => r.to === address) ? reaching(graph, address, given) : primary;
        if (pick) counted.set(key(pick), { ...pick, ...counted.get(key(pick)), uses: (counted.get(key(pick))?.uses ?? 0) + 1 });
      }
      // A Custom Node's body, its Group Input's rows given what reaches the use's; one that holds itself is walked once.
      const inner = stack.includes(node.kind) ? undefined : innerOf(node, library, kinds);
      if (inner) walk(inner.workflow, inner.kinds, (name) => reaching(graph, `${node.id}/${name}`, given), [...stack, node.kind]);
    }
  };
  walk(workflow, { ...kindsOf(library), ...kinds }, () => undefined, []);
  return [...counted.values()];
}
