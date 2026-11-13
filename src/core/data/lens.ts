/**
 * lens.ts — the LENS DOOR (plan 960 U4.1): one way, per type, to draw a definition as a graph and write the graph back.
 * The JSON is the one truth (D1): a graph is always made from it, and written back to it through the door, or refused in
 * words. Every entity type's lens is the identity, as its definition IS a graph; an app or the library registers one for a
 * type that is not (a page's Query, plan 960 U4.3). The editor and the MCP call only this door. DOM-free.
 * Will, 2026-11-13 · docs/history/plan-960-u4-the-lens-door.md
 *
 * Map:
 * - LensAnswer — What writing a graph back gives: the definition it says now, or why not, in words.
 * - GraphLens — How one type's definitions are drawn as a graph and written back.
 * - registerLens — An app or the library gives a type its lens; it answers how to take it back.
 * - lensOf — A type's lens: the one registered, else an entity type's, the identity; none, it has none.
 */
import type { Entity } from './entity.js';
import { entityFaults, graphWorkflow, type EntityFacts } from './entity-check.js';
import { entityTypes } from './entity-types.js';
import { graphOfWorkflow } from './graph-views.js';
import type { NodeKind } from './node-kinds.js';
import { report } from './report.js';
import type { WorkflowDefinition } from './workflow.js';

type Kinds = Readonly<Record<string, NodeKind>>;

/** What writing a graph back gives: the definition it says now, or why not, in words. */
export type LensAnswer<D> = { definition: D } | { faults: string[] };

/** How one type's definitions are drawn as a graph and written back. */
export interface GraphLens<D = unknown, F = unknown> {
  /** The definition as the graph the one editor edits, and the kinds it draws beside the shipped (a body's Group Input). */
  toGraph(definition: D, facts?: F): { workflow: WorkflowDefinition; kinds?: Kinds };
  /** The graph written back over the definition it was drawn from: the definition now, or the faults that refuse it. */
  fromGraph(before: D, graph: WorkflowDefinition, facts?: F): LensAnswer<D>;
}

/** An entity's lens: its graph is its definition, drawn as its canvas edits it and kept as the shelf checks it. */
const ENTITY_LENS: GraphLens<Entity, EntityFacts> = {
  toGraph: (entity, facts = {}) => graphWorkflow(entity, facts.kinds, facts.types),
  fromGraph: (before, graph, facts = {}) => {
    const definition: Entity = { ...before, graph: graphOfWorkflow(graph) };
    const faults = entityFaults(definition, facts);
    return faults.length ? { faults } : { definition };
  },
};

const lenses = new Map<string, GraphLens>();

/** An app or the library gives a type its lens. A type with one already is refused and reported. It answers how to take it
 *  back, or none. */
export function registerLens<D, F>(type: string, lens: GraphLens<D, F>): (() => void) | undefined {
  if (lenses.has(type)) {
    report({ code: 'lens', message: `registerLens: "${type}" has a lens already; take it back first.`, at: { type } });
    return undefined;
  }
  lenses.set(type, lens as GraphLens);
  return () => { if (lenses.get(type) === lens) lenses.delete(type); };
}

/** A type's lens: the one registered; else, for a type of entity, the identity, as its definition is a graph. None, it has
 *  none, and is no graph. */
export function lensOf(type: string): GraphLens | undefined {
  return lenses.get(type) ?? (type in entityTypes() ? ENTITY_LENS as GraphLens : undefined);
}
