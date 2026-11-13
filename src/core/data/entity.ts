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
 * - Entity — One entity, as JSON: its draft, and the versions it has published.
 * - EntityDefinition — What a version keeps of an entity: its name, words, body and settings; never its tags or category.
 * - EntityVersion — One published version: its number, when and by whom, a note, a content hash, its definition.
 * - definitionPart — An entity's definition, as a version keeps it.
 * - EntityQuery — A body in place of a graph: a Filter's Where, the one truth; its lens draws its graph from it.
 * - EntityLibrary — The preset entities of an app, by id, and the types they are of (entities.v3).
 * - isEntity — Whether a value has the SHAPE of an entity, with one body; the persist guard.
 * - EntityBody — An entity's one body: a graph, or a query.
 * - withBody — The entity with this body in place of its own: one body, never both.
 * - bodyOf — An entity's body as it keeps it: its query, else its graph.
 * - entityGraph — An entity's graph: its own, else the one its lens draws from its query; every read is this door.
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
import { layoutParts } from './graph-layout.js';
import { registeredLens } from './lens-registry.js';
import type { Where } from './where.js';

/** The id of the envelope's schema, for the `$schema` of a file. */
export const ENTITY_SCHEMA = 'https://sherpa-ui.dev/schemas/entity.v3.json';

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
  /** Not laid out yet: the editor unfurls it the first time it shows it, and a Save drops this (TODO 958). */
  unfurl?: true;
}

/** One entity, as JSON. `origin` is set when it is read and never written. Its graph (or query), name and settings
 *  are its working DRAFT; `versions` are what it has published (plan 972). */
export interface Entity {
  $schema?: string;
  v: 3;
  type: string;
  id: string;
  label: string;
  description?: string;
  /** Words a reader gives it, to organise and find it: the node panel lists it under each. */
  tags?: readonly string[];
  /** The category its node stands in, in the Nodes panel, as Runbooks (plan 936). None: a `node`'s settings', its type's,
   *  else Custom Nodes. */
  category?: string;
  /** Its body: a graph; or, for a type whose graph part says `query: true` (a Filter), its query. One, never both. */
  graph?: EntityGraph;
  query?: EntityQuery;
  settings?: Readonly<Record<string, unknown>>;
  uses?: readonly EntityRef[];
  /** Its published versions, newest first. A save never edits or drops one; the shelf publishes the first on a new id's
   *  first save. Plan 972 */
  versions?: readonly EntityVersion[];
  origin?: 'preset' | 'mine';
}

/** What a version keeps of an entity: its name, words, body and settings. Its tags and category only file it in the Nodes
 *  panel, so they are no part of a version: they apply at once, and no use goes stale for them. Plan 972 */
export type EntityDefinition = Pick<Entity, 'label' | 'description' | 'graph' | 'query' | 'settings'>;

/** One published version: its number, when and by whom, a note, its definition's content hash, and its definition. */
export interface EntityVersion {
  number: number;
  at: string;
  by?: string;
  note?: string;
  hash: string;
  definition: EntityDefinition;
}

/** An entity's definition, as a version keeps it: its own parts only, none left undefined. */
export function definitionPart(entity: Entity): EntityDefinition {
  const { label, description, graph, query, settings } = entity;
  return { label, ...(description ? { description } : {}), ...(graph ? { graph } : {}), ...(query ? { query } : {}), ...(settings ? { settings } : {}) };
}

/** A body in place of a graph (plan 960 U4.4b): a Filter's Where, the one truth; its lens draws its graph from it. */
export interface EntityQuery {
  where: Where;
}

/** The preset entities of an app, by id, and the types they are of, each a type.v1 by its id (entities.v3; plan 960 U2). */
export interface EntityLibrary {
  $schema?: string;
  v: 3;
  types?: Readonly<Record<string, import('./type-definition.js').TypeDefinition>>;
  entities: Readonly<Record<string, Entity>>;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Whether a value has the SHAPE of a version: a number from 1, when, a hash and a definition. */
const isVersion = (v: unknown): boolean => isObject(v) && Number.isInteger(v['number']) && (v['number'] as number) >= 1
  && typeof v['at'] === 'string' && typeof v['hash'] === 'string' && isObject(v['definition']);

/** Whether a value has the SHAPE of an entity: a v3 with a type, an id, a name and ONE body: a graph, or a query; and its
 *  versions, where it has them. A v2 is no entity: a stored one goes (plan 972; Will: never convert). */
export function isEntity(value: unknown): value is Entity {
  if (!isObject(value) || value['v'] !== 3) return false;
  if (value['versions'] !== undefined && !(Array.isArray(value['versions']) && value['versions'].every(isVersion))) return false;
  const { type, id, label, graph, query } = value;
  const drawn = isObject(graph) && Array.isArray(graph['nodes']);
  const said = isObject(query) && isObject(query['where']);
  return typeof type === 'string' && ID.test(type) && typeof id === 'string' && ID.test(id)
    && typeof label === 'string' && !!label.trim() && drawn !== said && (graph === undefined || drawn) && (query === undefined || said)
    && (value['settings'] === undefined || isObject(value['settings']));
}

/** An entity's one body: a graph, or a query. */
export type EntityBody = { graph: EntityGraph; query?: never } | { query: EntityQuery; graph?: never };

/** The entity with this body in place of its own: one body, never both. */
export function withBody<E extends Pick<Entity, 'graph' | 'query'>>(entity: E, body: EntityBody): E {
  const { graph: _graph, query: _query, ...rest } = entity;
  return { ...rest, ...body } as unknown as E;
}

/** An entity's body as it keeps it: its query, else its graph. */
export const bodyOf = (entity: Pick<Entity, 'type' | 'graph' | 'query'>): EntityBody =>
  (entity.query ? { query: entity.query } : { graph: entityGraph(entity) });

const NO_GRAPH: EntityGraph = { nodes: [] };

/** An entity's graph: its own; else, for a query body, the one its type's lens draws from it (a Filter's Where); else
 *  none, an empty graph. Every read of an entity's graph is this one door. Plan 960 U4.4b */
export function entityGraph(entity: Pick<Entity, 'type' | 'graph'> & Partial<Entity>): EntityGraph {
  if (entity.graph) return entity.graph;
  return (entity.query && registeredLens(entity.type)?.graphOf?.(entity)) || NO_GRAPH;
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
    v: 3, type, id, label: definition.label,
    ...(definition.description ? { description: definition.description } : {}),
    ...(definition.tags?.length ? { tags: definition.tags } : {}),
    ...(type !== 'node' && definition.category ? { category: definition.category } : {}),
    graph: { nodes: definition.nodes, ...(definition.connections ? { connections: definition.connections } : {}), ...layoutParts(definition) },
    ...(settings ? { settings } : {}),
    ...(definition.preset ? { origin: 'preset' as const } : {}),
  };
}

/** An entity's own category: its own, else a `node`'s settings' (plan 942: read one way). None: its type's, else Custom Nodes. */
export function categoryOf(entity: Pick<Entity, 'category' | 'settings'>): string | undefined {
  const s = entity.settings?.['category'];
  return entity.category ?? (typeof s === 'string' ? s : undefined);
}

/** A graph's parts a Custom Node definition carries: its nodes, its connections and its layout. */
const definitionParts = (graph: EntityGraph): Pick<NodeDefinition, 'nodes' | 'connections'> & ReturnType<typeof layoutParts> =>
  ({ nodes: graph.nodes, ...(graph.connections ? { connections: graph.connections } : {}), ...layoutParts(graph) });

/** A `node` entity as the Custom Node definition the node panel and the editor read; a preset's is read only. */
export function definitionOf(entity: Entity): NodeDefinition {
  const s = entity.settings ?? {};
  return {
    v: 1, label: entity.label,
    inputs: Array.isArray(s['inputs']) ? s['inputs'] as NodeSocket[] : [], outputs: Array.isArray(s['outputs']) ? s['outputs'] as NodeOutput[] : [],
    ...definitionParts(entityGraph(entity)),
    ...(entity.description ? { description: entity.description } : {}),
    ...(entity.tags?.length ? { tags: entity.tags } : {}),
    ...(categoryOf(entity) ? { category: categoryOf(entity)! } : {}),
    ...(typeof s['icon'] === 'string' ? { icon: s['icon'] } : {}),
    ...(entity.origin === 'preset' ? { preset: true as const } : {}),
  };
}
