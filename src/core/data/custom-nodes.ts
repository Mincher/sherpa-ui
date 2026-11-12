/**
 * custom-nodes.ts — CUSTOM NODES, ONE WAY: a door for each act on one, for every caller alike — the editor, an MCP tool, an
 * app's assistant (Will, plan 942). A Custom Node is an ENTITY (D1 A): of a type, which may fix its category and sockets
 * (D2 A); its graph is what it does. Each door checks as Save checks (`entityFaults`) and answers in words: what it kept,
 * or why not. Pure of the DOM: it works through an `EntityShelf`.
 *
 * Map:
 * - NodeAnswer — What a door answers: the id it kept, or the faults that refused it, in words.
 * - NodeChange — What an update may change: its name, line, tags and category; a `node`'s sockets; its graph.
 * - createNode — Keep a new Custom Node from its JSON: an entity, its id free or given.
 * - readNode — One Custom Node: the entity, and the node it offers.
 * - updateNode — Change one of the reader's Custom Nodes: a preset is read only.
 * - deleteNode — Forget one of the reader's Custom Nodes, unless a graph uses it.
 */
import { isEntity, readEntity, type Entity } from './entity.js';
import { asNode, entityTypes } from './entity-types.js';
import { entityFaults, type EntityFacts } from './entity-check.js';
import { freeId } from './graph-views.js';
import type { EntityShelf } from './entity-shelf.js';
import type { NodeDefinition, NodeOutput, NodeSocket } from './node-library.js';

/** What a door answers: the id it kept, or the faults that refused it, in words. */
export type NodeAnswer = { id: string } | { faults: string[] };

/** What an update may change: its name, line, tags and category; a `node`'s sockets; its graph. */
export interface NodeChange {
  label?: string;
  description?: string;
  tags?: readonly string[];
  category?: string;
  inputs?: readonly NodeSocket[];
  outputs?: readonly NodeOutput[];
  graph?: Entity['graph'];
}

/** Every entity the shelf holds, whole: what a check reads beside the one it checks. */
const everyEntity = (shelf: EntityShelf): Entity[] => shelf.list().flatMap((s) => shelf.get(s.id) ?? []);

/** Check, then keep: the faults, or the id kept. A shelf that refuses for another reason says so. */
async function keep(shelf: EntityShelf, entity: Entity, facts: EntityFacts): Promise<NodeAnswer> {
  const faults = entityFaults(entity, { ...facts, entities: everyEntity(shelf).filter((e) => e.id !== entity.id) });
  if (faults.length) return { faults };
  return (await shelf.save(entity)) ? { id: entity.id } : { faults: [`"${entity.id}" was not kept: the shelf refused it`] };
}

/** Keep a new Custom Node from its JSON — an entity; a `node` when it names no type — as the reader's own. With no id, or
 *  none free, its name gives one. */
export async function createNode(shelf: EntityShelf, json: unknown, facts: EntityFacts = {}): Promise<NodeAnswer> {
  let value: unknown = json;
  if (typeof json === 'string') {
    try {
      value = JSON.parse(json);
    } catch {
      return { faults: ['it is not JSON'] };
    }
  }
  const read = readEntity(value) as Partial<Entity> & Record<string, unknown>;
  const label = typeof read?.label === 'string' ? read.label.trim() : '';
  if (!label) return { faults: ['it has no name: give it a label'] };
  const type = typeof read.type === 'string' ? read.type : 'node';
  const taken = shelf.list().map((e) => e.id);
  const id = typeof read.id === 'string' && read.id && !taken.includes(read.id) ? read.id : freeId(label, taken, type);
  const { origin: _origin, $schema: _schema, ...rest } = read;
  const entity = { ...rest, v: 2, type, id, label, graph: read.graph ?? { nodes: [] }, ...(type === 'node' && !read.settings ? { settings: { inputs: [], outputs: [] } } : {}) };
  if (!isEntity(entity)) return { faults: ['it is not an entity: a v2 with a type, an id, a name and a graph'] };
  return keep(shelf, entity, facts);
}

/** One Custom Node: the entity, and the node it offers (its sockets, category and icon, by its type). */
export function readNode(shelf: EntityShelf, id: string): { entity: Entity; node: NodeDefinition } | undefined {
  const entity = shelf.get(id);
  return entity && { entity, node: asNode(entity, entityTypes()) };
}

/** Change one of the reader's Custom Nodes: a preset is read only, and a type that fixes its sockets keeps them. */
export async function updateNode(shelf: EntityShelf, id: string, change: NodeChange, facts: EntityFacts = {}): Promise<NodeAnswer> {
  const was = shelf.get(id);
  if (!was) return { faults: [`there is no "${id}"`] };
  if (was.origin === 'preset') return { faults: [`"${id}" is a preset, which is read only: copy it to change it`] };
  const sockets = change.inputs || change.outputs;
  if (sockets && was.type !== 'node') return { faults: [`a ${was.type}'s sockets are its type's: they do not change`] };
  const { inputs, outputs, ...plain } = change;
  const settings = sockets ? { ...was.settings, ...(inputs ? { inputs } : {}), ...(outputs ? { outputs } : {}) } : was.settings;
  const { origin: _origin, ...own } = was;
  const next: Entity = { ...own, ...plain, ...(settings ? { settings } : {}) };
  return keep(shelf, next, facts);
}

/** Forget one of the reader's Custom Nodes; a preset, or one a graph uses, stays, and says why. */
export function deleteNode(shelf: EntityShelf, id: string): NodeAnswer {
  if (!shelf.get(id)) return { faults: [`there is no "${id}"`] };
  const why = shelf.whyKept(id);
  if (why) return { faults: [why] };
  return shelf.remove(id) ? { id } : { faults: [`"${id}" was not removed`] };
}
