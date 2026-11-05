/**
 * entity-types.ts — the TYPE REGISTRY of entities and the one check of an entity: which families
 * its graph may place, which sockets it demands, its own settings; whether it uses what is there
 * and holds itself nowhere. Any entity may be placed as a node in any graph (`asNode`: D1). An app
 * adds its types with `registerEntityType`. The data layer has no schema validator, so the checks
 * are hand-written, as `checkNodeLibrary`'s are; the schemas in schemas/ say the same for authors
 * and the tests hold the two together. DOM-free. Will, plan 746 E1 · TRAP T-an-entity-is-an-envelope-and-a-type
 *
 * Map:
 * - EntityType — One type: its words, the families its graph may place, its sockets, its settings check.
 * - ENTITY_TYPES — The types the library ships: `preset-filter` and `node`.
 * - entityTypes — Every type now: the shipped, and those an app registered.
 * - registerEntityType — An app adds a type; a clash with a shipped one is refused. It answers how to take it back.
 * - EntityFacts — What a check reads beside the entity: the types, the other entities, the kinds, the fields.
 * - socketsOf — The inputs and outputs an entity has: its type's, or for a `node` its own settings'.
 * - asNode — An entity as the Custom Node it offers: any entity can be placed in any graph (D1).
 * - libraryOf — Entities as a node library keyed by use kind, so a use runs, diffs and updates as a Custom Node does.
 * - entityOf — A workflow's graph as an entity of a type.
 * - entityFaults — Every fault in an entity, in words.
 * - checkEntity — Check an entity; each fault reports. True when none is.
 */
import { report } from './report.js';
import { NODE_KINDS, type NodeKind } from './node-kinds.js';
import { kindsOf, nodeLibraryFaults, type NodeDefinition, type NodeLibrary, type NodeOutput, type NodeSocket } from './node-library.js';
import { entityKind, isEntity, usesOf, ENTITY_SCHEMA, definitionOf, type Entity } from './entity.js';
import type { WorkflowDefinition, WorkflowFacts } from './workflow.js';

type Kinds = Readonly<Record<string, NodeKind>>;

/** One type: its words, the families its graph may place, its sockets, its settings check. */
export interface EntityType {
  /** A kebab-case noun: the `type` of an entity, and the first half of a use's kind. */
  id: string;
  label: string;
  icon?: string;
  /** The schema that says what its settings hold (schemas/), for authors and the tests. */
  schema?: string;
  /** Faults in its settings, in words; none when they are as the type keeps them. */
  settingsFaults?(settings: Readonly<Record<string, unknown>>): string[];
  /** The families (a kind's category) its graph may place; none given, any. A use of an entity is always allowed. */
  families?: readonly string[];
  /** The sockets it demands: `#in` and `#out`. A `node` has none here: its settings say them. */
  inputs?: readonly NodeSocket[];
  outputs?: readonly NodeOutput[];
  /** Only DEFINED (false), or it needs the runner to be of use. */
  runs: boolean;
}

const ID = /^[a-z][a-z0-9-]*$/;

/** Faults for keys a settings object may not have, and one it must. */
function keysFault(settings: Readonly<Record<string, unknown>>, allowed: readonly string[], required: readonly string[] = []): string[] {
  return [
    ...Object.keys(settings).filter((k) => !allowed.includes(k)).map((k) => `it has the setting "${k}", which this type does not keep`),
    ...required.filter((k) => !(k in settings)).map((k) => `it has no "${k}"`),
  ];
}

/** The types the library ships: `preset-filter` and `node`. */
export const ENTITY_TYPES: Readonly<Record<string, EntityType>> = {
  'preset-filter': {
    id: 'preset-filter', label: 'Preset Filter', icon: 'filter', schema: 'entity-preset-filter.v1.json',
    // A graph that decides a condition: where its rows come from, the values, the logic, the collections; no Output (its `#out` is the end).
    families: ['Sources', 'Variables', 'Logic', 'Collections'],
    outputs: [{ name: 'where', label: 'Where', type: 'boolean' }],
    runs: false,
    settingsFaults: (s) => [...keysFault(s, ['source']), ...('source' in s && typeof s['source'] !== 'string' ? ['its source is not a name'] : [])],
  },
  node: {
    id: 'node', label: 'Custom Node', icon: 'folder', schema: 'entity-node.v1.json', runs: false,
    settingsFaults: (s) => [
      ...keysFault(s, ['inputs', 'outputs', 'category', 'icon'], ['inputs', 'outputs']),
      ...(['inputs', 'outputs'] as const).filter((k) => k in s && !Array.isArray(s[k])).map((k) => `its ${k} are not a list`),
      ...(['category', 'icon'] as const).filter((k) => k in s && typeof s[k] !== 'string').map((k) => `its ${k} is not text`),
    ],
  },
};

const added = new Map<string, EntityType>();

/** Every type now: the shipped, and those an app registered. */
export function entityTypes(): Readonly<Record<string, EntityType>> {
  return { ...Object.fromEntries(added), ...ENTITY_TYPES };
}

/** An app adds a type, from its own file. A clash with a shipped type, or a type that is no name, is
 *  refused and reported. It answers how to take it back, or none when refused. */
export function registerEntityType(type: EntityType): (() => void) | undefined {
  if (!ID.test(String(type?.id)) || typeof type.label !== 'string' || typeof type.runs !== 'boolean') {
    report({ code: 'entity-type', message: 'registerEntityType: a type needs an id that is a name (lowercase letters, digits, hyphens), a label and `runs`.', at: {} });
    return undefined;
  }
  if (type.id in ENTITY_TYPES) {
    report({ code: 'entity-type', message: `registerEntityType: "${type.id}" is a type the library ships, which an app does not replace.`, at: { type: type.id } });
    return undefined;
  }
  added.set(type.id, type);
  return () => { if (added.get(type.id) === type) added.delete(type.id); };
}

/** What a check reads beside the entity. */
export interface EntityFacts {
  /** The types it may be of; the shipped and the app's, when none given. */
  types?: Readonly<Record<string, EntityType>>;
  /** The other entities that exist: what its graph may place, and what `uses` may name. */
  entities?: readonly Entity[];
  /** The node kinds its graph may use; the shipped, when none given. */
  kinds?: Kinds;
  fields?: WorkflowFacts['fields'];
}

/** The inputs and outputs an entity has: its type's, or for a `node` its own settings'. */
export function socketsOf(entity: Entity, type: EntityType | undefined = entityTypes()[entity.type]): { inputs: NodeSocket[]; outputs: NodeOutput[] } {
  const s = entity.settings ?? {};
  if (entity.type === 'node' || !type) {
    return { inputs: Array.isArray(s['inputs']) ? s['inputs'] as NodeSocket[] : [], outputs: Array.isArray(s['outputs']) ? s['outputs'] as NodeOutput[] : [] };
  }
  return { inputs: [...(type.inputs ?? [])], outputs: [...(type.outputs ?? [])] };
}

/** An entity as the Custom Node it offers: its graph in a box, with its sockets. Any entity can be placed in
 *  any graph (D1); `nodeKindOf` of this is its kind, and `entityKind` its id. */
export function asNode(entity: Entity, types: Readonly<Record<string, EntityType>> = entityTypes()): NodeDefinition {
  const type = types[entity.type];
  const { inputs, outputs } = socketsOf(entity, type);
  const s = entity.settings ?? {};
  return {
    ...definitionOf({ ...entity, settings: { ...s, inputs, outputs } }),
    icon: typeof s['icon'] === 'string' ? s['icon'] : type?.icon ?? 'folder',
  };
}

/** Entities as a node library keyed by use kind (`<type>:<id>`; a `node`'s is its id): the workflow
 *  functions, `innerOf`, `useOf`, `definitionDiff` and `updateInstance` then take an entity as they take a
 *  Custom Node, and a use follows its definition with the version and snapshot recorded. */
export function libraryOf(entities: readonly Entity[], types: Readonly<Record<string, EntityType>> = entityTypes()): NodeLibrary {
  return { v: 1, nodes: Object.fromEntries(entities.map((e) => [entityKind(e), asNode(e, types)])) };
}

/** A workflow's graph as an entity of a type, ready to check and save. */
export function entityOf(workflow: Pick<WorkflowDefinition, 'id' | 'label' | 'nodes' | 'routes' | 'ties'>, type: string, settings?: Readonly<Record<string, unknown>>): Entity {
  return {
    $schema: ENTITY_SCHEMA, v: 1, type, id: workflow.id, label: workflow.label ?? workflow.id,
    graph: { nodes: workflow.nodes, ...(workflow.routes ? { routes: workflow.routes } : {}), ...(workflow.ties ? { ties: workflow.ties } : {}) },
    ...(settings ? { settings } : {}),
  };
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
 *  keep, a family its type does not take, an output nothing reaches, a use that is not there, a loop of
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
  // A use of an entity is a node whose kind is its kind; it is the one place a family does not bound.
  for (const node of entity.graph.nodes) {
    const kind = kinds[node.kind];
    if (!kind || kind.model === 'graph' || !type.families) continue;
    const family = kind.category ?? 'Other';
    if (!type.families.includes(family)) problems.push(`${at} places "${node.id}", of the family "${family}", which a ${type.label} does not take: ${type.families.join(', ')}`);
  }
  for (const node of entity.graph.nodes) {
    if (node.kind.includes(':') && !(node.kind in kinds)) {
      problems.push(`${at} places "${node.id}", a use of "${node.kind}", which is not there`);
    }
  }
  for (const out of type.outputs ?? []) {
    if (!(entity.graph.routes ?? []).some((r) => r.to === '#out' || r.to === `#out/${out.name}`)) problems.push(`${at} sends nothing to its output "${out.name}": route one to #out/${out.name}`);
  }
  for (const use of entity.uses ?? []) {
    if (!all.some((e) => e.type === use.type && e.id === use.id)) problems.push(`${at} uses the ${types[use.type]?.label ?? use.type} "${use.id}", which is not there`);
  }
  const loop = loopOf(entity, all);
  if (loop) problems.push(`${at} holds itself, in a loop: ${loop.join(' › ')}`);

  // The graph and its sockets: a Custom Node's own checks, with the entities around it as kinds.
  const kind = entityKind(entity);
  const found = nodeLibraryFaults({ v: 1, nodes: { [kind]: asNode(entity, types) } }, kinds, facts.fields ? { fields: facts.fields } : {});
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
