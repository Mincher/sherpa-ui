/**
 * entity-check.ts — the one check of an entity, and its graph as the canvas edits it: the half of the
 * entity's rules that reads node kinds and workflows, so the keeper and the type registry load without
 * it. DOM-free. Will, plan 746 E1, E5 · TRAP T-an-entity-is-an-envelope-and-a-type
 *
 * Map:
 * - EntityFacts — What a check reads beside the entity: the types, the other entities, the kinds, each store's fields.
 * - graphWorkflow — An entity's graph as the workflow its canvas edits, with a Group Input and Output where it has sockets.
 * - entityFaults — Every fault in an entity, in words.
 * - checkEntity — Check an entity; each fault reports. True when none is.
 */
import { report } from './report.js';
import { NODE_KINDS, type NodeKind } from './node-kinds.js';
import { innerOf, kindsOf, nodeLibraryFaults } from './node-library.js';
import { entityKind, isEntity, usesOf, type Entity } from './entity.js';
import { asNode, entityTypes, libraryOf, socketsOf, takes, type EntityType } from './entity-types.js';
import { readWorkflow, type WorkflowDefinition, type WorkflowFacts } from './workflow.js';

type Kinds = Readonly<Record<string, NodeKind>>;

/** What a check reads beside the entity. */
export interface EntityFacts {
  /** The types it may be of; the shipped and the app's, when none given. */
  types?: Readonly<Record<string, EntityType>>;
  /** The other entities that exist: what its graph may place, and what `uses` may name. */
  entities?: readonly Entity[];
  /** The node kinds its graph may use; the shipped, when none given. */
  kinds?: Kinds;
  /** Each store's fields: a Field checks against its Source's. */
  fieldsOf?: WorkflowFacts['fieldsOf'];
}

/** An entity's graph as the workflow its canvas edits — its id the entity's, so its tab draft is its
 *  own — with a Group Input `#in` where it has inputs and a Group Output `#out` where it has outputs,
 *  as a Custom Node's inside is drawn; and the kinds those need. TRAP T-a-graph-is-a-view-of-a-type */
export function graphWorkflow(entity: Entity, kinds: Kinds = NODE_KINDS, types: Readonly<Record<string, EntityType>> = entityTypes()): { workflow: WorkflowDefinition; kinds: Kinds } {
  const { nodes, routes = [], ties, frames } = entity.graph;
  const inner = innerOf({ id: entity.id, kind: entityKind(entity) }, libraryOf([entity], types), kinds);
  if (!inner) return { workflow: { v: 2, id: entity.id, label: entity.label, nodes, routes, ...(ties ? { ties } : {}), ...(frames ? { frames } : {}) }, kinds };
  const { inputs, outputs } = socketsOf(entity, types[entity.type]);
  const touched = (end: string): boolean => routes.some((r) => [r.from, r.to].some((s) => s === end || s.startsWith(`${end}/`)));
  const kept = (id: string): boolean => (id === '#in' ? !!inputs.length || touched('#in') : id === '#out' ? !!outputs.length || touched('#out') : true);
  const drawn = inner.workflow.nodes.filter((n) => kept(n.id));
  // Its own kind is not offered on its own canvas (a graph that holds itself is a loop); a group kind only where its node is drawn.
  const offered = Object.entries(inner.kinds).filter(([id]) => id !== entityKind(entity) && (!id.startsWith('#') || drawn.some((n) => n.kind === id)));
  return { workflow: { ...inner.workflow, label: entity.label, nodes: drawn }, kinds: Object.fromEntries(offered) };
}

/** The way round a loop of entities that starts at one, as labels; none when it does not come back. */
function loopOf(start: Entity, all: readonly Entity[]): string[] | undefined {
  const by = new Map(all.map((e) => [e.id, e]));
  const next = (e: Entity): Entity[] => {
    const named = [...(e.uses ?? []), ...usesOf(e.graph, all)];
    return [...new Set(named.map((u) => u.id))].flatMap((id) => (by.has(id) ? [by.get(id)!] : []));
  };
  const walk = (e: Entity, path: readonly Entity[]): readonly Entity[] | undefined => {
    for (const to of next(e)) {
      if (to.id === start.id) return [...path, e];
      if (path.some((p) => p.id === to.id) || to.id === e.id) continue;
      const found = walk(to, [...path, e]);
      if (found) return found;
    }
    return undefined;
  };
  const ring = walk(start, []);
  return ring && [...ring, start].map((e) => e.label);
}

/** Every fault in an entity, in words: not an entity, a type the app lacks, settings the type does not
 *  keep, a family its type does not take, an output nothing reaches (once it places a node), a use that is not there, a loop of
 *  entities, and each fault of the graph itself, named by its path. Faults come in the data layer's
 *  words; it never throws. */
export function entityFaults(entity: Entity, facts: EntityFacts = {}): string[] {
  if (!isEntity(entity)) return ['it is not an entity: a v1 with a type, an id, a name and a graph'];
  const types = facts.types ?? entityTypes();
  const type = types[entity.type];
  const at = `the ${type?.label ?? entity.type} "${entity.id}"`;
  if (!type) return [`${at} is of the type "${entity.type}", which this app does not have: ${Object.keys(types).join(', ')}`];
  const problems: string[] = [];
  const others = (facts.entities ?? []).filter((e) => !(e.type === entity.type && e.id === entity.id));
  const all = [...others, entity];
  for (const fault of type.settingsFaults?.(entity.settings ?? {}) ?? []) problems.push(`${at}: ${fault}`);

  const kinds: Kinds = { ...kindsOf(libraryOf(others, types)), ...(facts.kinds ?? NODE_KINDS) };
  // A use of an entity is a node whose kind is its kind; it is the one place a family does not bound. An old kind reads as today's.
  for (const node of readWorkflow({ v: 2, id: entity.id, nodes: entity.graph.nodes }, kinds).workflow?.nodes ?? []) {
    const kind = kinds[node.kind];
    if (!kind || takes(type, kind)) continue;
    problems.push(`${at} places "${node.id}", of the family "${kind.category ?? 'Other'}", which a ${type.label} does not take: ${type.families!.join(', ')}`);
  }
  for (const node of entity.graph.nodes) {
    if (node.kind.includes(':') && !(node.kind in kinds)) {
      problems.push(`${at} places "${node.id}", a use of "${node.kind}", which is not there`);
    }
  }
  // An EMPTY graph is a new one: its outputs are asked for once it places a node. TRAP T-a-graph-is-a-view-of-a-type
  for (const out of entity.graph.nodes.length ? type.outputs ?? [] : []) {
    if (!(entity.graph.routes ?? []).some((r) => r.to === '#out' || r.to === `#out/${out.name}`)) problems.push(`${at} sends nothing to its output "${out.name}": route one to #out/${out.name}`);
  }
  for (const use of entity.uses ?? []) {
    if (!all.some((e) => e.type === use.type && e.id === use.id)) problems.push(`${at} uses the ${types[use.type]?.label ?? use.type} "${use.id}", which is not there`);
  }
  const loop = loopOf(entity, all);
  if (loop) problems.push(`${at} holds itself, in a loop: ${loop.join(' › ')}`);

  // The graph and its sockets: a Custom Node's own checks, with the entities around it as kinds.
  const kind = entityKind(entity);
  const found = nodeLibraryFaults({ v: 1, nodes: { [kind]: asNode(entity, types) } }, kinds, facts.fieldsOf ? { fieldsOf: facts.fieldsOf } : {});
  const own = `the Custom Node "${kind}"`;
  for (const fault of found) {
    if (/holds itself/.test(fault)) continue;
    problems.push(fault.startsWith(own) ? `${at}${fault.slice(own.length)}` : fault);
  }
  return [...new Set(problems)];
}

/** Check an entity; each fault reports, and it never throws. True when none is. */
export function checkEntity(entity: Entity, facts: EntityFacts = {}): boolean {
  const problems = entityFaults(entity, facts);
  // A Custom Node's faults keep the code they always had.
  const code = (entity as { type?: unknown })?.type === 'node' ? 'node-library' : 'entity';
  for (const problem of problems) report({ code, message: `checkEntity: ${problem}.`, at: { entity: String((entity as { id?: unknown })?.id ?? '') } });
  return !problems.length;
}
