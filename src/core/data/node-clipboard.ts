/**
 * node-clipboard.ts — COPY nodes of a workflow and PASTE them, with or without their connections. Pure: no DOM.
 * A paste gets new ids; a copy keeps the node's values, its name, its size and what it was made from.
 * A frame or a tie is not copied. A Group Input or Output (`#…`) is not copied.
 *
 * Map:
 * - NodeClip — What a copy holds: the nodes, and every connection that touches one of them.
 * - copyNodes — A copy of these nodes, from a workflow.
 * - pasteNodes — A workflow with a clip pasted in, its new ids, and where each copy stands.
 */
import { editWorkflow, type WorkflowDefinition, type WorkflowNode } from './workflow.js';
import { kindOfNode, socketOf, takesMany, type NodeKind, type NodeConnection } from './node-kinds.js';

/** What a copy holds: the nodes, and every connection that touches one of them. */
export interface NodeClip {
  nodes: readonly WorkflowNode[];
  connections: readonly NodeConnection[];
}

/** A copy of these nodes, from a workflow. */
export function copyNodes(workflow: WorkflowDefinition, ids: readonly string[]): NodeClip {
  const take = new Set(ids.filter((id) => !id.startsWith('#')));
  const nodes = workflow.nodes.filter((n) => take.has(n.id)).map((n) => structuredClone(n));
  const connections = (workflow.connections ?? [])
    .filter((r) => take.has(socketOf(r.from).node) || take.has(socketOf(r.to).node))
    .map(({ from, to }) => ({ from, to }));
  return { nodes, connections };
}

/**
 * The workflow with a clip pasted in, `dx` and `dy` px from where it was copied. `connections` joins each copy as its
 * original is joined: connections between the copies, connections into them, and connections out of them — an output goes only to
 * an input that takes several connections, since another would take the original's place.
 */
export function pasteNodes(
  workflow: WorkflowDefinition, clip: NodeClip, at: { dx: number; dy: number; connections?: boolean }, kinds: Readonly<Record<string, NodeKind>>,
): { workflow: WorkflowDefinition; ids: string[]; moved: Record<string, string> } {
  let next = workflow;
  const moved: Record<string, string> = {};
  const used = new Set(workflow.nodes.map((n) => n.id));
  for (const node of clip.nodes) {
    let n = 1;
    while (used.has(`${node.kind}-${n}`)) n++;
    const id = `${node.kind}-${n}`;
    used.add(id);
    moved[node.id] = id;
    next = editWorkflow(next, { add: { ...structuredClone(node), id, x: Math.round(node.x + at.dx), y: Math.round(node.y + at.dy) } }, kinds);
  }
  if (at.connections) {
    const rename = (address: string): string => {
      const { node } = socketOf(address);
      return node in moved ? `${moved[node]}${address.slice(node.length)}` : address;
    };
    for (const connection of clip.connections) {
      const [from, to] = [socketOf(connection.from), socketOf(connection.to)];
      const [fromCopied, toCopied] = [from.node in moved, to.node in moved];
      if (!toCopied) {
        const target = next.nodes.find((n) => n.id === to.node);
        const kind = target && kindOfNode(kinds, target);
        if (!kind || !takesMany(kind, to.row)) continue;
      }
      if (!fromCopied && !next.nodes.some((n) => n.id === from.node)) continue;
      next = editWorkflow(next, { connection: { from: rename(connection.from), to: rename(connection.to) } }, kinds);
    }
  }
  return { workflow: next, ids: Object.values(moved), moved };
}
