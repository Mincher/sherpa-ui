/**
 * lens.ts — the LENS DOOR (plan 960 U4.1): one way, per type, to draw a definition as a graph and write the graph back.
 * The JSON is the one truth (D1): a graph is always made from it, and written back to it through the door, or refused in
 * words. Every entity type's lens is the identity, as its definition IS a graph; an app or the library registers one for a
 * type that is not (a page's Query, plan 960 U4.3). The editor and the MCP call only this door. DOM-free.
 * The list it reads, and `registerLens`, are lens-registry.ts's. Will, 2026-11-13 · docs/history/plan-960-u4-the-lens-door.md
 *
 * Map:
 * - ENTITY_LENS — An entity's lens, the identity: its graph is its definition.
 * - lensOf — A type's lens: the one registered, else an entity type's, the identity; none, it has none.
 */
import type { Entity } from './entity.js';
import { entityFaults, graphWorkflow, type EntityFacts } from './entity-check.js';
import { entityTypes } from './entity-types.js';
import { graphOfWorkflow } from './graph-views.js';
import { registeredLens, type GraphLens } from './lens-registry.js';

/** An entity's lens, the identity: its graph is its definition, drawn as its canvas edits it and kept as the shelf checks
 *  it. A type that registers its own lens may call it for a graph body. */
export const ENTITY_LENS: GraphLens<Entity, EntityFacts> = {
  toGraph: (entity, facts = {}) => graphWorkflow(entity, facts.kinds, facts.types),
  fromGraph: (before, graph, facts = {}) => {
    const definition: Entity = { ...before, graph: graphOfWorkflow(graph) };
    const faults = entityFaults(definition, facts);
    return faults.length ? { faults } : { definition };
  },
};

/** A type's lens: the one registered; else, for a type of entity, the identity, as its definition is a graph. None, it has
 *  none, and is no graph. */
export function lensOf(type: string): GraphLens | undefined {
  return registeredLens(type) ?? (type in entityTypes() ? ENTITY_LENS as GraphLens : undefined);
}
