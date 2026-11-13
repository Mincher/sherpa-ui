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
 * - savedCategories — The categories a reader may save a Custom Node or a graph in: Custom Nodes, Runbooks, and the app's.
 * - EntityType — One type: a type.v1 with its graph part, and the code JSON cannot say: its settings check and defaults.
 * - FILTER — The Filter type's id: a preset of its store's pages, and the first half of its preset's id.
 * - ENTITY_TYPES — The types the library ships: `filter` and `node`.
 * - entityTypes — Every type now: the shipped, and those an app registered.
 * - recipientTypes — The app's types whose rows a message may go to (`recipient: true`): the library names none.
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
import type { TypeDefinition } from './type-definition.js';
import { typeFaults } from './type-faults.js';
import { categoryOf, entityKind, entityRefOf, ENTITY_SCHEMA, definitionOf, type Entity } from './entity.js';
import { layoutParts } from './graph-layout.js';
import type { WorkflowDefinition } from './workflow.js';

/** The categories a reader may save a Custom Node or a graph in (plan 936 D3 A): Custom Nodes, Runbooks, and each one an
 *  app's graph types name. A row type's category lists rows, not nodes. */
export function savedCategories(types: Readonly<Record<string, Pick<EntityType, 'category' | 'graph'>>> = entityTypes()): string[] {
  return [...new Set(['Custom Nodes', 'Runbooks', ...Object.values(types).flatMap((t) => (t.graph && t.category ? [t.category] : []))])];
}

/** One type: a type.v1 — its id (a kebab-case noun: an entity's `type`, and the first half of a use's kind), its words,
 *  its category in the Nodes panel (plan 936; none, Custom Nodes) and its graph part — and the code JSON cannot say: its
 *  settings check (a `node`'s socket lists) and the settings a new entity starts with. Plan 960 U2 */
export interface EntityType extends Omit<TypeDefinition, '$schema' | 'v'> {
  $schema?: string;
  v?: 1;
  /** The schema that says what its settings hold (schemas/), for authors and the tests. */
  schema?: string;
  /** Faults in its settings, in words; none when they are as the type keeps them. */
  settingsFaults?(settings: Readonly<Record<string, unknown>>): string[];
  /** The settings a new entity of this type starts with. */
  defaults?: Readonly<Record<string, unknown>>;
}

/** Faults for keys a settings object may not have, and one it must. */
function keysFault(settings: Readonly<Record<string, unknown>>, allowed: readonly string[], required: readonly string[] = []): string[] {
  return [
    ...Object.keys(settings).filter((k) => !allowed.includes(k)).map((k) => `it has the setting "${k}", which this type does not keep`),
    ...required.filter((k) => !(k in settings)).map((k) => `it has no "${k}"`),
  ];
}

/** The Filter type's id: a preset of its store's pages, its preset's id `filter:<id>`, its
 *  use's kind. TRAP T-a-filter-is-a-preset-of-its-store */
export const FILTER = 'filter';

/** The types the library ships: `filter` and `node`. */
export const ENTITY_TYPES: Readonly<Record<string, EntityType>> = {
  [FILTER]: {
    id: FILTER, label: 'Filter', icon: 'filter', schema: 'entity-filter.v1.json',
    // A graph that decides a condition: where its rows come from, its values and sums, the logic, dates, sort and group, text and
    // tags; no Output (its `#out` is the end). A Sort, Group or Count saved before is a Collection's type (plan 749 P3).
    graph: {
      families: ['Sources', 'Variables', 'Math', 'Logic', 'Time', 'Organise', 'Utils'],
      outputs: [{ name: 'where', label: 'Where', type: 'boolean' }],
      // It keeps its Where where a Where says it all, else its graph (plan 960 U4.4b, D6).
      query: true,
      runs: false,
    },
    settingsFaults: (s) => [...keysFault(s, ['source']), ...('source' in s && typeof s['source'] !== 'string' ? ['its source is not a name'] : [])],
  },
  node: {
    id: 'node', label: 'Custom Node', icon: 'folder', schema: 'entity-node.v1.json', graph: { runs: false }, defaults: { inputs: [], outputs: [] },
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

/** The app's types whose rows a message may go to (`recipient: true`): the library names none. Plan 960 U4.9 */
export const recipientTypes = (): EntityType[] => Object.values(entityTypes()).filter((type) => type.recipient);

/** An app adds a type, from its own file or as JSON (a type.v1 with its graph part, an entities file's `types`; plans 942
 *  D2 A, 960 U2). A type typeFaults refuses, or a clash with a shipped one, is refused and reported. It answers how to
 *  take it back, or none. */
export function registerEntityType(type: EntityType): (() => void) | undefined {
  const { schema: _schema, settingsFaults: _check, defaults: _defaults, ...json } = type ?? ({} as EntityType);
  const faults = typeFaults({ ...json, v: 1 });
  if (faults.length) {
    report({ code: 'entity-type', message: `registerEntityType: the type ${JSON.stringify(type?.id ?? null)} is refused: ${faults.join('; ')}.`, at: { ...(typeof type?.id === 'string' ? { type: type.id } : {}) } });
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
export function takes(type: Pick<EntityType, 'graph'>, kind: Pick<NodeKind, 'model' | 'category'>): boolean {
  const families = type.graph?.families;
  return kind.model === 'graph' || !families || families.includes(kind.category ?? 'Other');
}

/** The inputs and outputs an entity has: its type's, or for a `node` its own settings'. */
export function socketsOf(entity: Entity, type: EntityType | undefined = entityTypes()[entity.type]): { inputs: NodeSocket[]; outputs: NodeOutput[] } {
  const s = entity.settings ?? {};
  if (entity.type === 'node' || !type) {
    return { inputs: Array.isArray(s['inputs']) ? s['inputs'] as NodeSocket[] : [], outputs: Array.isArray(s['outputs']) ? s['outputs'] as NodeOutput[] : [] };
  }
  return { inputs: [...(type.graph?.inputs ?? [])], outputs: [...(type.graph?.outputs ?? [])] };
}

/** An entity as the Custom Node it offers: its graph in a box, with its sockets. Any entity can be placed in
 *  any graph (D1); `nodeKindOf` of this is its kind, and `entityKind` its id. */
export function asNode(entity: Entity, types: Readonly<Record<string, EntityType>> = entityTypes()): NodeDefinition {
  const type = types[entity.type];
  const { inputs, outputs } = socketsOf(entity, type);
  const s = entity.settings ?? {};
  // Its category: its own, else its type's (plans 936, 942).
  const own = categoryOf(entity);
  return {
    ...definitionOf({ ...entity, settings: { ...s, inputs, outputs }, ...(!own && type?.category ? { category: type.category } : {}) }),
    icon: typeof s['icon'] === 'string' ? s['icon'] : type?.icon ?? 'folder',
    // Its own settings ride with it, so a copy made in the editor is saved as its type again.
    ...(entity.type !== 'node' && entity.settings ? { settings: entity.settings } : {}),
  };
}

/** Entities as a node library keyed by use kind (`<type>:<id>`; a `node`'s is its id): the workflow
 *  functions, `innerOf`, `useOf`, `definitionDiff` and `updateInstance` then take an entity as they take a
 *  Custom Node, and a use follows its definition with the version and snapshot recorded. */
export function libraryOf(entities: readonly Entity[], types: Readonly<Record<string, EntityType>> = entityTypes()): NodeLibrary {
  // One of a type that is not reusable is no node (plan 949).
  return { v: 1, nodes: Object.fromEntries(entities.filter((e) => types[e.type]?.graph?.reusable !== false).map((e) => [entityKind(e), asNode(e, types)])) };
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
export function entityOf(workflow: Pick<WorkflowDefinition, 'id' | 'label' | 'nodes' | 'connections' | 'ties' | 'frames' | 'stages' | 'lanes' | 'beforeLanes'>, type: string, settings?: Readonly<Record<string, unknown>>): Entity {
  // Its stages and swimlanes are kept as its frames are: a Save that dropped them lost them on the next load (TODO 933).
  return {
    $schema: ENTITY_SCHEMA, v: 2, type, id: workflow.id, label: workflow.label ?? workflow.id,
    graph: { nodes: workflow.nodes, ...(workflow.connections ? { connections: workflow.connections } : {}), ...layoutParts(workflow) },
    ...(settings ? { settings } : {}),
  };
}
