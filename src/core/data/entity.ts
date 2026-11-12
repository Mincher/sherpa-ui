/**
 * entity.ts — the ENVELOPE of an entity: a graph saved under a type, an id and a name, with the
 * settings its type keeps and the entities its graph places. One shape for every type; a Custom
 * Node is the type `node`. Light, so the keeper can import it. The types are in entity-types, the checks in entity-check.
 * DOM-free. Will, plan 746 E1 · TRAP T-an-entity-is-an-envelope-and-a-type
 *
 * Map:
 * - ENTITY_SCHEMA — The id of the envelope's schema, for the `$schema` of a file.
 * - EntityRef — One entity a graph places: its type and id.
 * - EntityGraph — An entity's graph: a workflow's nodes and connections, with `#in` and `#out` as a Custom Node has.
 * - Entity — One entity, as JSON.
 * - EntityLibrary — The preset entities of an app, by id (entities.v2).
 * - inNewWords — A graph or Custom Node body saved before plan 934 as it reads now: its routes are connections.
 * - readEntity — An entity as this version reads it: a v1, saved before plan 934, read once as a v2.
 * - isEntity — Whether a value has the SHAPE of an entity; the persist guard.
 * - entityKind — The kind a use of an entity has in a graph: `<type>:<id>`, and a Custom Node's plain id.
 * - entityRefOf — The entity a use's kind names: the inverse of `entityKind`.
 * - usesOf — The entities a graph places, from its nodes' kinds, among the entities given.
 * - nodeEntityOf — The entity a Custom Node definition is, by its use's kind: the inverse of `asNode`.
 * - categoryOf — An entity's own category: its own, else a `node`'s settings'.
 * - definitionOf — A `node` entity as the Custom Node definition the node panel and the editor read.
 */
import type { NodeConnection, NodeTie } from './node-kinds.js';
import type { NodeDefinition, NodeOutput, NodeSocket } from './node-library.js';
import type { WorkflowDefinition, WorkflowNode } from './workflow.js';
import type { NodeFrame } from './node-frames.js';

/** The id of the envelope's schema, for the `$schema` of a file. */
export const ENTITY_SCHEMA = 'https://sherpa-ui.dev/schemas/entity.v2.json';

const ID = /^[a-z][a-z0-9-]*$/;

/** One entity a graph places: its type and id. */
export interface EntityRef {
  type: string;
  id: string;
}

/** An entity's graph: a workflow's nodes and connections, with `#in` and `#out` as a Custom Node has. */
export interface EntityGraph {
  nodes: readonly WorkflowNode[];
  connections?: readonly NodeConnection[];
  ties?: readonly NodeTie[];
  frames?: readonly NodeFrame[];
  /** How its canvas lays it out, kept by a Save as the frames are (TODO 933). */
  stages?: WorkflowDefinition['stages'];
  lanes?: WorkflowDefinition['lanes'];
  beforeLanes?: WorkflowDefinition['beforeLanes'];
}

/** One entity, as JSON. `origin` is set when it is read and never written. */
export interface Entity {
  $schema?: string;
  v: 2;
  type: string;
  id: string;
  label: string;
  description?: string;
  /** Words a reader gives it, to organise and find it: the node panel lists it under each. */
  tags?: readonly string[];
  /** The category its node stands in, in the Nodes panel, as Runbooks (plan 936). None: a `node`'s settings', its type's,
   *  else Custom Nodes. */
  category?: string;
  graph: EntityGraph;
  settings?: Readonly<Record<string, unknown>>;
  uses?: readonly EntityRef[];
  origin?: 'preset' | 'mine';
}

/** The preset entities of an app, by id (entities.v2), and the types of Custom Node they are of, as JSON (plan 942). */
export interface EntityLibrary {
  $schema?: string;
  v: 2;
  /** Each type by id: a category, an icon and fixed sockets (`node-type.v1`); each node of it a sub-graph. */
  types?: Readonly<Record<string, Omit<import('./entity-types.js').EntityType, 'id' | 'settingsFaults'>>>;
  entities: Readonly<Record<string, Entity>>;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A graph or Custom Node body saved before plan 934 as it reads now: its `routes`, each zip tie's, and the
 *  `was` of each use of a Custom Node are `connections`. One saved since is as it was. Pure.
 *  TRAP T-a-saved-graph-is-read-in-the-new-words */
export function inNewWords<T>(body: T): T {
  if (!isObject(body)) return body;
  const { routes, ties, nodes, ...rest } = body;
  return {
    ...rest,
    ...(nodes !== undefined ? { nodes: Array.isArray(nodes) ? nodes.map((n) => (isObject(n) && isObject(n['was']) ? { ...n, was: inNewWords(n['was']) } : n)) : nodes } : {}),
    ...(routes !== undefined && rest['connections'] === undefined ? { connections: routes } : {}),
    ...(ties !== undefined ? { ties: Array.isArray(ties) ? ties.map((t) => inNewWords(t)) : ties } : {}),
  } as T;
}

/** An entity as this version reads it: a v1, saved before plan 934, read once as a v2, its graph in the new
 *  words. Anything else is as it was, for `isEntity` to judge. */
export function readEntity(value: unknown): unknown {
  if (!isObject(value) || value['v'] !== 1 || !isObject(value['graph'])) return value;
  const { $schema, ...rest } = value;
  return { ...(typeof $schema === 'string' ? { $schema: $schema.replace('entity.v1.json', 'entity.v2.json') } : {}), ...rest, v: 2, graph: inNewWords(value['graph']) };
}

/** Whether a value has the SHAPE of an entity: a v1 with a type, an id, a name and a graph. */
export function isEntity(value: unknown): value is Entity {
  if (!isObject(value) || value['v'] !== 2) return false;
  const { type, id, label, graph } = value;
  return typeof type === 'string' && ID.test(type) && typeof id === 'string' && ID.test(id)
    && typeof label === 'string' && !!label.trim() && isObject(graph) && Array.isArray(graph['nodes'])
    && (value['settings'] === undefined || isObject(value['settings']));
}

/** The kind a use of an entity has in a graph: `<type>:<id>`. A Custom Node's is its plain id. */
export const entityKind = (entity: Pick<Entity, 'type' | 'id'>): string => (entity.type === 'node' ? entity.id : `${entity.type}:${entity.id}`);

/** The entity a use's kind names: the inverse of `entityKind`. */
export function entityRefOf(kind: string): EntityRef {
  const at = kind.indexOf(':');
  return at < 0 ? { type: 'node', id: kind } : { type: kind.slice(0, at), id: kind.slice(at + 1) };
}

/** The entities a graph places, read from its nodes' kinds, among the entities given. */
export function usesOf(graph: Pick<EntityGraph, 'nodes'>, among: readonly Pick<Entity, 'type' | 'id'>[]): EntityRef[] {
  const found = new Map<string, EntityRef>();
  for (const node of graph.nodes) {
    const hit = among.find((e) => entityKind(e) === node.kind);
    if (hit) found.set(node.kind, { type: hit.type, id: hit.id });
  }
  return [...found.values()];
}

/** The entity a Custom Node definition is, by the kind its use has: the inverse of `asNode`. A plain id is
 *  the type `node`, its sockets its settings; `<type>:<id>` is that type's, its own settings carried. */
export function nodeEntityOf(kind: string, definition: NodeDefinition): Entity {
  const { type, id } = entityRefOf(kind);
  const settings = type === 'node'
    ? { inputs: definition.inputs, outputs: definition.outputs, ...(definition.category ? { category: definition.category } : {}), ...(definition.icon ? { icon: definition.icon } : {}) }
    : definition.settings;
  return {
    v: 2, type, id, label: definition.label,
    ...(definition.description ? { description: definition.description } : {}),
    ...(definition.tags?.length ? { tags: definition.tags } : {}),
    ...(type !== 'node' && definition.category ? { category: definition.category } : {}),
    graph: {
      nodes: definition.nodes, ...(definition.connections ? { connections: definition.connections } : {}), ...(definition.ties ? { ties: definition.ties } : {}), ...(definition.frames ? { frames: definition.frames } : {}),
      ...(definition.lanes?.length ? { lanes: definition.lanes } : {}), ...(definition.beforeLanes ? { beforeLanes: definition.beforeLanes } : {}),
    },
    ...(settings ? { settings } : {}),
    ...(definition.preset ? { origin: 'preset' as const } : {}),
  };
}

/** An entity's own category: its own, else a `node`'s settings' (plan 942: read one way). None: its type's, else Custom Nodes. */
export function categoryOf(entity: Pick<Entity, 'category' | 'settings'>): string | undefined {
  const s = entity.settings?.['category'];
  return entity.category ?? (typeof s === 'string' ? s : undefined);
}

/** A `node` entity as the Custom Node definition the node panel and the editor read; a preset's is read only. */
export function definitionOf(entity: Entity): NodeDefinition {
  const s = entity.settings ?? {};
  return {
    v: 1, label: entity.label,
    inputs: Array.isArray(s['inputs']) ? s['inputs'] as NodeSocket[] : [], outputs: Array.isArray(s['outputs']) ? s['outputs'] as NodeOutput[] : [],
    nodes: entity.graph.nodes, ...(entity.graph.connections ? { connections: entity.graph.connections } : {}), ...(entity.graph.ties ? { ties: entity.graph.ties } : {}),
    ...(entity.graph.frames ? { frames: entity.graph.frames } : {}),
    ...(entity.graph.lanes?.length ? { lanes: entity.graph.lanes } : {}), ...(entity.graph.beforeLanes ? { beforeLanes: entity.graph.beforeLanes } : {}),
    ...(entity.description ? { description: entity.description } : {}),
    ...(entity.tags?.length ? { tags: entity.tags } : {}),
    ...(categoryOf(entity) ? { category: categoryOf(entity)! } : {}),
    ...(typeof s['icon'] === 'string' ? { icon: s['icon'] } : {}),
    ...(entity.origin === 'preset' ? { preset: true as const } : {}),
  };
}
