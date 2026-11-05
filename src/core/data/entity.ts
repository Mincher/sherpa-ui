/**
 * entity.ts — the ENVELOPE of an entity: a graph saved under a type, an id and a name, with the
 * settings its type keeps and the entities its graph places. One shape for every type; a Custom
 * Node is the type `node`. Light, so the keeper can import it. The checks are in entity-types.
 * DOM-free. Will, plan 746 E1 · TRAP T-an-entity-is-an-envelope-and-a-type
 *
 * Map:
 * - ENTITY_SCHEMA — The id of the envelope's schema, for the `$schema` of a file.
 * - EntityRef — One entity a graph places: its type and id.
 * - EntityGraph — An entity's graph: a workflow's nodes and routes, with `#in` and `#out` as a Custom Node has.
 * - Entity — One entity, as JSON.
 * - EntityLibrary — The preset entities of an app, by id (entities.v1).
 * - isEntity — Whether a value has the SHAPE of an entity; the persist guard.
 * - entityKind — The kind a use of an entity has in a graph: `<type>:<id>`, and a Custom Node's plain id.
 * - usesOf — The entities a graph places, from its nodes' kinds, among the entities given.
 * - nodeEntityOf — A Custom Node definition as an entity of the type `node`.
 * - definitionOf — A `node` entity as the Custom Node definition the node panel and the editor read.
 */
import type { NodeRoute, NodeTie } from './node-kinds.js';
import type { NodeDefinition, NodeOutput, NodeSocket } from './node-library.js';
import type { WorkflowNode } from './workflow.js';

/** The id of the envelope's schema, for the `$schema` of a file. */
export const ENTITY_SCHEMA = 'https://sherpa-ui.dev/schemas/entity.v1.json';

const ID = /^[a-z][a-z0-9-]*$/;

/** One entity a graph places: its type and id. */
export interface EntityRef {
  type: string;
  id: string;
}

/** An entity's graph: a workflow's nodes and routes, with `#in` and `#out` as a Custom Node has. */
export interface EntityGraph {
  nodes: readonly WorkflowNode[];
  routes?: readonly NodeRoute[];
  ties?: readonly NodeTie[];
}

/** One entity, as JSON. `origin` is set when it is read and never written. */
export interface Entity {
  $schema?: string;
  v: 1;
  type: string;
  id: string;
  label: string;
  description?: string;
  graph: EntityGraph;
  settings?: Readonly<Record<string, unknown>>;
  uses?: readonly EntityRef[];
  origin?: 'preset' | 'mine';
}

/** The preset entities of an app, by id (entities.v1). */
export interface EntityLibrary {
  $schema?: string;
  v: 1;
  entities: Readonly<Record<string, Entity>>;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Whether a value has the SHAPE of an entity: a v1 with a type, an id, a name and a graph. */
export function isEntity(value: unknown): value is Entity {
  if (!isObject(value) || value['v'] !== 1) return false;
  const { type, id, label, graph } = value;
  return typeof type === 'string' && ID.test(type) && typeof id === 'string' && ID.test(id)
    && typeof label === 'string' && !!label.trim() && isObject(graph) && Array.isArray(graph['nodes'])
    && (value['settings'] === undefined || isObject(value['settings']));
}

/** The kind a use of an entity has in a graph: `<type>:<id>`. A Custom Node's is its plain id. */
export const entityKind = (entity: Pick<Entity, 'type' | 'id'>): string => (entity.type === 'node' ? entity.id : `${entity.type}:${entity.id}`);

/** The entities a graph places, read from its nodes' kinds, among the entities given. */
export function usesOf(graph: Pick<EntityGraph, 'nodes'>, among: readonly Pick<Entity, 'type' | 'id'>[]): EntityRef[] {
  const found = new Map<string, EntityRef>();
  for (const node of graph.nodes) {
    const hit = among.find((e) => entityKind(e) === node.kind);
    if (hit) found.set(node.kind, { type: hit.type, id: hit.id });
  }
  return [...found.values()];
}

/** A Custom Node definition as an entity of the type `node`: its sockets are its settings. */
export function nodeEntityOf(id: string, definition: NodeDefinition): Entity {
  return {
    v: 1, type: 'node', id, label: definition.label,
    ...(definition.description ? { description: definition.description } : {}),
    graph: { nodes: definition.nodes, ...(definition.routes ? { routes: definition.routes } : {}), ...(definition.ties ? { ties: definition.ties } : {}) },
    settings: { inputs: definition.inputs, outputs: definition.outputs, ...(definition.category ? { category: definition.category } : {}), ...(definition.icon ? { icon: definition.icon } : {}) },
    ...(definition.preset ? { origin: 'preset' as const } : {}),
  };
}

/** A `node` entity as the Custom Node definition the node panel and the editor read; a preset's is read only. */
export function definitionOf(entity: Entity): NodeDefinition {
  const s = entity.settings ?? {};
  return {
    v: 1, label: entity.label,
    inputs: Array.isArray(s['inputs']) ? s['inputs'] as NodeSocket[] : [], outputs: Array.isArray(s['outputs']) ? s['outputs'] as NodeOutput[] : [],
    nodes: entity.graph.nodes, ...(entity.graph.routes ? { routes: entity.graph.routes } : {}), ...(entity.graph.ties ? { ties: entity.graph.ties } : {}),
    ...(entity.description ? { description: entity.description } : {}),
    ...(typeof s['category'] === 'string' ? { category: s['category'] } : {}), ...(typeof s['icon'] === 'string' ? { icon: s['icon'] } : {}),
    ...(entity.origin === 'preset' ? { preset: true as const } : {}),
  };
}
