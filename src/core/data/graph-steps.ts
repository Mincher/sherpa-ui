/**
 * graph-steps.ts — a graph READ AS STEPS, beside `routeRead`: each stage's steps in order, numbered "stage.place", and
 * where each step's flow goes, each way of a fork apart (a test's Pass and Fail). What an app says of each step is its own; this is the order
 * and the numbers (Will, TODO 959). A step's order is its depth along the flow, then its place, top to bottom and left to
 * right. A link that only carries data is no flow: into an AI node's Model, or a test's header where its Value A is joined. Pure: no DOM.
 *
 * Map:
 * - StepGoes — Where a step's flow goes: a step, by its number; an output of the graph; or nowhere.
 * - GraphStep — One step: its number, its node, and where its flow goes; each way of a fork apart.
 * - StepStage — One stage's steps, in order.
 * - graphSteps — A graph's steps, stage by stage, each numbered "stage.place", and where each one's flow goes.
 */
import { kindOfNode, nodeKinds, rowsOfNode, socketOf, type NodeConnection, type NodeKind, type RowKind } from './node-kinds.js';
import { flowDepths } from './node-routes.js';
import { stageOf, stagesOf, type NodeStage } from './node-stages.js';
import { START } from './node-start.js';
import type { WorkflowNode } from './workflow.js';

type Kinds = Readonly<Record<string, NodeKind>>;

/** Where a step's flow goes: a step, by its number; an output of the graph (a Group Output row, `''` for its header); or
 *  nowhere, so the run stops there. */
export type StepGoes = { step: string; node: string } | { output: string } | { stop: true };

/** One step: its number ("2.1"), its node, and where its flow goes; each way of a fork apart, by its row (`fork`): a test's
 *  `pass` and `fail` — where one of them leads on (plans 944, 971). */
export interface GraphStep {
  number: string;
  node: string;
  kind: string;
  heading?: string;
  goes: StepGoes[];
  branches?: Readonly<Record<string, StepGoes[]>>;
}

/** One stage's steps, in order. */
export interface StepStage {
  id: string;
  label: string;
  steps: GraphStep[];
}

interface Graph {
  nodes: readonly WorkflowNode[];
  connections?: readonly NodeConnection[];
  stages?: readonly NodeStage[];
}

/** A graph's steps, stage by stage, each numbered "stage.place", and where each one's flow goes. Not a step: the Start, a
 *  Group Input or Output, and a node that only gives another its model. */
export function graphSteps(graph: Graph, kinds: Kinds = nodeKinds()): StepStage[] {
  const held = new Map(graph.nodes.map((n) => [n.id, n]));
  const rowOf = (address: string): RowKind | undefined => {
    const { node, row } = socketOf(address);
    return row === undefined ? undefined : kindOfNode(kinds, held.get(node))?.rows.find((r) => r.name === row);
  };
  // A link that only carries data is no flow: into a row that needs a model, or into a test's header where Value A, the
  // value it tests, is joined (TODO 994), as its Data was.
  const carries = (id: string): boolean => (graph.connections ?? []).some((c) => socketOf(c.to).node === id && rowOf(c.to)?.needs === 'tested');
  const flowless = (r: NodeConnection): boolean => rowOf(r.to)?.needs === 'model' || (socketOf(r.to).row === undefined && carries(r.to));
  const flow = (graph.connections ?? []).filter((r) => !flowless(r));
  const plumbing = (id: string): boolean => {
    const out = (graph.connections ?? []).filter((r) => socketOf(r.from).node === id);
    return out.length > 0 && out.every(flowless);
  };
  const steps = graph.nodes.filter((n) => !n.id.startsWith('#') && n.id !== START && !plumbing(n.id));
  const ids = steps.map((n) => n.id);
  const { depth } = flowDepths(ids, flow.map((r) => [socketOf(r.from).node, socketOf(r.to).node] as const));
  const ordered = [...steps].sort((a, b) => depth.get(a.id)! - depth.get(b.id)! || a.y - b.y || a.x - b.x);
  // Each step's stage: the one it names, else the last whose left edge it stands right of.
  const stages = [...stagesOf(graph)].sort((a, b) => a.x - b.x);
  const stageAt = (n: WorkflowNode): string => stageOf(graph, n) ?? [...stages].reverse().find((s) => n.x >= s.x)?.id ?? stages[0]!.id;
  const read: StepStage[] = stages.map((s) => ({ id: s.id, label: s.label, steps: [] }));
  const number = new Map<string, string>();
  for (const n of ordered) {
    const at = read.findIndex((s) => s.id === stageAt(n));
    number.set(n.id, `${at + 1}.${read[at]!.steps.length + 1}`);
    read[at]!.steps.push({ number: number.get(n.id)!, node: n.id, kind: n.kind, ...(n.heading ? { heading: n.heading } : {}), goes: [] });
  }
  const goes = (from: (address: string) => boolean): StepGoes[] => {
    const to = flow.filter((r) => from(r.from)).map((r) => r.to);
    const said = new Map<string, StepGoes>();
    for (const t of to) {
      const { node, row } = socketOf(t);
      if (node === '#out') said.set(`out:${row ?? ''}`, { output: row ?? '' });
      else if (number.has(node)) said.set(node, { step: number.get(node)!, node });
    }
    return said.size ? [...said.values()] : [{ stop: true }];
  };
  for (const stage of read) {
    for (const step of stage.steps) {
      const at = held.get(step.node);
      const kind = kindOfNode(kinds, at);
      // A Fork's outputs are forks too, as its pick unfolds them (plan 991 D6).
      const forks = (kind ? rowsOfNode(kind, at?.values) : []).filter((r) => r.fork).map((r) => [r.name, goes((address) => address === `${step.node}/${r.name}`)] as const);
      if (forks.some(([, to]) => !('stop' in to[0]!))) step.branches = Object.fromEntries(forks);
      step.goes = goes((address) => socketOf(address).node === step.node);
    }
  }
  return read;
}
