/**
 * entity-types.ts — the TYPE REGISTRY of entities: which families a type's graph may place, which
 * sockets it demands, its own settings; and the Custom Node any entity offers (`asNode`: D1), which
 * the node panel lists by `offeredKinds`. An app adds its types with `registerEntityType`. Light, so
 * the keeper carries it; the check that reads kinds and workflows is in entity-check. The data layer
 * has no schema validator, so the checks are hand-written, as `checkNodeLibrary`'s are; the schemas
 * in schemas/ say the same for authors and the tests hold the two together. DOM-free.
 * Will, plan 746 E1, E5 · TRAP T-an-entity-is-an-envelope-and-a-type · TRAP T-an-entity-is-used-as-a-node
 *
 * Map:
 * - EntityType — One type: its words, the families its graph may place, its sockets, its settings check.
 * - ENTITY_TYPES — The types the library ships: `preset-filter` and `node`.
 * - entityTypes — Every type now: the shipped, and those an app registered.
 * - registerEntityType — An app adds a type; a clash with a shipped one is refused. It answers how to take it back.
 * - takes — Whether a type's graph may place a kind: a family it takes, or any entity's node.
 * - socketsOf — The inputs and outputs an entity has: its type's, or for a `node` its own settings'.
 * - asNode — An entity as the Custom Node it offers: any entity can be placed in any graph (D1).
 * - libraryOf — Entities as a node library keyed by use kind, so a use runs, diffs and updates as a Custom Node does.
 * - offeredKinds — The kinds a graph's node panel offers: what its type takes, and no node that would hold it in a loop.
 * - entityOf — A workflow's graph as an entity of a type.
 */
import { report } from './report.js';
import type { NodeKind } from './node-kinds.js';
import type { NodeDefinition, NodeLibrary, NodeOutput, NodeSocket } from './node-library.js';
import { entityKind, entityRefOf, ENTITY_SCHEMA, definitionOf, type Entity } from './entity.js';
import type { WorkflowDefinition } from './workflow.js';

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
  /** The settings a new entity of this type starts with. */
  defaults?: Readonly<Record<string, unknown>>;
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
    // A graph that decides a condition: where its rows come from, its values and sums, the logic, dates, collections, text and
    // tags; no Output (its `#out` is the end). A Sort, Group or Count saved before is a Collection's type (plan 749 P3).
    families: ['Sources', 'Variables', 'Math', 'Logic', 'Time', 'Collections', 'Utils'],
    outputs: [{ name: 'where', label: 'Where', type: 'boolean' }],
    runs: false,
    settingsFaults: (s) => [...keysFault(s, ['source']), ...('source' in s && typeof s['source'] !== 'string' ? ['its source is not a name'] : [])],
  },
  node: {
    id: 'node', label: 'Custom Node', icon: 'folder', schema: 'entity-node.v1.json', runs: false, defaults: { inputs: [], outputs: [] },
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

/** Whether a type's graph may place a kind: one of a family it takes (none given, any), or a node any
 *  entity offers, which no family bounds (D1). The check and the node panel both ask it. */
export function takes(type: Pick<EntityType, 'families'>, kind: Pick<NodeKind, 'model' | 'category'>): boolean {
  return kind.model === 'graph' || !type.families || type.families.includes(kind.category ?? 'Other');
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
    // Its own settings ride with it, so a copy made in the editor is saved as its type again.
    ...(entity.type !== 'node' && entity.settings ? { settings: entity.settings } : {}),
  };
}

/** Entities as a node library keyed by use kind (`<type>:<id>`; a `node`'s is its id): the workflow
 *  functions, `innerOf`, `useOf`, `definitionDiff` and `updateInstance` then take an entity as they take a
 *  Custom Node, and a use follows its definition with the version and snapshot recorded. */
export function libraryOf(entities: readonly Entity[], types: Readonly<Record<string, EntityType>> = entityTypes()): NodeLibrary {
  return { v: 1, nodes: Object.fromEntries(entities.map((e) => [entityKind(e), asNode(e, types)])) };
}

/** The kinds a graph's node panel offers, of those given: a kind its type `takes`; and a Custom Node —
 *  any entity's — but the graph's own and any that holds it, at any depth, which would be a loop.
 *  `host` is the kind of the graph shown (`<type>:<id>`, a `node`'s plain id); none, a workflow of no
 *  entity, which is offered all. `graphs` are what each kind places: a library's nodes, a draft over
 *  its own. TRAP T-an-entity-is-used-as-a-node */
export function offeredKinds<K extends Pick<NodeKind, 'model' | 'category'>>(
  kinds: Readonly<Record<string, K>>, host: string | undefined, graphs: Readonly<Record<string, Pick<NodeDefinition, 'nodes'>>>,
  types: Readonly<Record<string, EntityType>> = entityTypes(),
): Record<string, K> {
  if (!host) return { ...kinds };
  const type = types[entityRefOf(host).type];
  const holds = (kind: string, seen: Set<string>): boolean => {
    if (kind === host) return true;
    if (seen.has(kind)) return false;
    seen.add(kind);
    return (graphs[kind]?.nodes ?? []).some((n) => holds(n.kind, seen));
  };
  return Object.fromEntries(Object.entries(kinds).filter(([id, kind]) => (kind.model === 'graph' ? !holds(id, new Set()) : !type || takes(type, kind))));
}

/** A workflow's graph as an entity of a type, ready to check and save. */
export function entityOf(workflow: Pick<WorkflowDefinition, 'id' | 'label' | 'nodes' | 'routes' | 'ties'>, type: string, settings?: Readonly<Record<string, unknown>>): Entity {
  return {
    $schema: ENTITY_SCHEMA, v: 1, type, id: workflow.id, label: workflow.label ?? workflow.id,
    graph: { nodes: workflow.nodes, ...(workflow.routes ? { routes: workflow.routes } : {}), ...(workflow.ties ? { ties: workflow.ties } : {}) },
    ...(settings ? { settings } : {}),
  };
}
