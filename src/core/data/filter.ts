/**
 * filter.ts — a Filter entity as a PRESET of its store's pages. Its graph is drawn as its
 * canvas draws it, then read as ONE condition by the Outgoing JSON's reader (`conditionAt`), a use of
 * another read inside and so flattened; each comparison as the Query editor reads one (`editedCondition`);
 * then each field's own, in the plain form a page's preset has. After that it takes the one door every
 * preset takes: `presetReadings`, then `declarePresets`. DOM-free. Will, TODO 776
 * · docs/history/plan-776-preset-filters-in-data.md · TRAP T-a-filter-is-a-preset-of-its-store
 *
 * Map:
 * - PagePreset — A preset as a page declares it: its id, its name and each field's condition, in the plain form.
 * - FilterFacts — What reading one needs beside it: the other entities (a use's), the types, the kinds, each store's fields.
 * - sourceOf — The store a Filter reads: its settings', else the one its graph's Source names.
 * - presetOfEntity — A Filter as a page's preset, or why it is none, in words.
 * - presetsOver — The Filters over one store as its pages' presets, the app's then the reader's, and each fault.
 * - filterOf — A page's preset or a saved filter as the Filter it is, keeping its Where; or why not, in words.
 * - whereChanges — What changed between two Wheres, field by field, in words.
 * - FILTER_LENS — A Filter's lens: drawn from its Where, else its graph; written back as a Where where one says it all.
 */
import { entityGraph, entityKind, withBody, type Entity, type EntityGraph } from './entity.js';
import { FILTER, entityTypes, libraryOf, type EntityType } from './entity-types.js';
import { graphWorkflow } from './entity-check.js';
import { innerOf, kindsOf } from './node-library.js';
import { conditionAt, leafOf, type Said } from './node-flow.js';
import { nodeKinds, type DrawnGraph, type GraphNode, type NodeKind } from './node-kinds.js';
import { OP_LABELS, groupOf, type Condition, type ConditionLeaf } from './store.js';
import { parseWhere, whereOfTree, type Where } from './where.js';
import { editedCondition, whereGraph } from './query-graph.js';
import { workflowGraph, type WorkflowFacts } from './workflow.js';
import { ENTITY_LENS } from './lens.js';
import { registerLens, type GraphLens } from './lens-registry.js';
import type { EntityFacts } from './entity-check.js';
import type { SavedFilter } from './query.js';

/** A preset as a page declares it: its id, its name and each field's condition, in the plain form. */
export interface PagePreset {
  id: string;
  label: string;
  where: Where;
}

/** What reading a Filter needs beside it: the other entities, so a use of one is read inside; the
 *  types and kinds; and each store's fields, which a Field picks from by its Source. */
export interface FilterFacts {
  entities?: readonly Entity[];
  types?: Readonly<Record<string, EntityType>>;
  kinds?: Readonly<Record<string, NodeKind>>;
  fieldsOf?: WorkflowFacts['fieldsOf'];
}

/** The store a Filter reads: its settings' `source`, else the one its graph's Source names. Plan 776 D4 */
export function sourceOf(entity: Pick<Entity, 'type' | 'settings' | 'graph' | 'query'>): string | undefined {
  const named = entity.settings?.['source'];
  if (typeof named === 'string' && named) return named;
  const store = entityGraph(entity).nodes.find((n) => n.kind === 'source')?.values?.['store'];
  return typeof store === 'string' && store ? store : undefined;
}

/** A tree with each comparison read as the Query editor reads an edited one; or the first part that says too
 *  little, or what a preset cannot hold: a constant that decides it, a boolean only a run gives (TODO 780). */
function leavesRead(tree: Said): { tree: Condition } | { fault: string } {
  if (tree === true) return { fault: 'it always holds, so it filters nothing' };
  if (tree === false) return { fault: 'it never holds, and tests no Field to say so on' };
  if ('boolean' in tree) return { fault: `"${tree.boolean}" is a boolean only a run gives` };
  const parts = groupOf(tree);
  if (parts) {
    const read = (parts[1] as readonly Said[]).map(leavesRead);
    const bad = read.find((r) => 'fault' in r);
    return bad ?? { tree: { ...tree, [parts[0]]: read.map((r) => (r as { tree: Condition }).tree) } as Condition };
  }
  const { field, op, value } = tree as ConditionLeaf;
  if (!op) return { fault: `its comparison of "${field ?? ''}" has no operator` };
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return { fault: `its comparison of "${field ?? ''}" has no value` };
  // Text as a row holds it is read as the Query editor reads it; a number or a list of numbers stays as it is.
  const text = typeof value === 'string' || (Array.isArray(value) && value.every((v) => typeof v === 'string'));
  return { tree: { ...(field ? { field } : {}), ...(text ? editedCondition(op, value as string | string[]) : { op, value }) } };
}

/**
 * A Filter as a page's PRESET: its id its use's kind, its name, and what its Where says,
 * each field's own condition in the plain form. A use of another inside it is read inside, so it
 * flattens. Why it is none, in words: it sends no condition, a node says none, it says Any of two
 * fields, or a constant decides it. Plan 776 D1, D5, D6 · TRAP T-a-filter-is-a-preset-of-its-store
 */
export function presetOfEntity(entity: Entity, facts: FilterFacts = {}): { preset: PagePreset } | { fault: string } {
  // One that keeps its Where says it: nothing to read (plan 960 U4.4b).
  if (entity.query) return { preset: { id: entityKind(entity), label: entity.label, where: entity.query.where } };
  const types = facts.types ?? entityTypes();
  const library = libraryOf([entity, ...(facts.entities ?? []).filter((e) => e.id !== entity.id)], types);
  const kinds = { ...kindsOf(library), ...(facts.kinds ?? nodeKinds()) };
  // Its Fields read its store's rows, where no Source's reach them: a preset of its store.
  const store = sourceOf(entity);
  const drawn = { ...(facts.fieldsOf ? { fieldsOf: facts.fieldsOf } : {}), ...(store ? { rowsFrom: store } : {}) };
  const { workflow, kinds: own } = graphWorkflow(entity, kinds, types);
  const graph = workflowGraph(workflow, drawn, own);
  // A use: the graph inside it, drawn as its own canvas draws it.
  const inner = (node: GraphNode): DrawnGraph | undefined => {
    const use = innerOf(node, library, kinds);
    return use && workflowGraph(use.workflow, drawn, use.kinds);
  };
  const at = `the Filter "${entity.label}"`;
  const { tree, faults } = conditionAt(graph, '#out/where', { inner });
  if (faults.length) return { fault: `${at}: ${faults[0]}` };
  if (tree === undefined) return { fault: `${at} sends no condition to its Where` };
  // Never: Any of nothing on each field its tests name, so the preset is on the bar and, on, holds no row.
  if (tree === false) {
    const fields = [...new Set(graph.nodes.flatMap((n) => {
      const leaf = ['condition', 'time', 'tag'].includes(n.kind) ? leafOf(graph, n) : undefined;
      return leaf && 'leaf' in leaf && leaf.leaf.field ? [leaf.leaf.field] : [];
    }))];
    if (!fields.length) return { fault: `${at}: it never holds, and tests no Field to say so on` };
    return { preset: { id: entityKind(entity), label: entity.label, where: Object.fromEntries(fields.map((f) => [f, { or: [] }])) } };
  }
  const read = leavesRead(tree);
  const split = 'fault' in read ? read : whereOfTree(read.tree);
  return 'fault' in split ? { fault: `${at}: ${split.fault}` } : { preset: { id: entityKind(entity), label: entity.label, where: split.where } };
}

/** The Filters over one store, as its pages' presets: the app's, read only, then the reader's, in
 *  the shelf's order. One that says no condition is left out, and its fault said. Plan 776 D4, D11 */
export function presetsOver(store: string, entities: readonly Entity[], facts: Omit<FilterFacts, 'entities'> = {}): { presets: PagePreset[]; faults: string[] } {
  const presets: PagePreset[] = [];
  const faults: string[] = [];
  for (const entity of entities) {
    if (entity.type !== FILTER || sourceOf(entity) !== store) continue;
    const made = presetOfEntity(entity, { ...facts, entities });
    if ('fault' in made) faults.push(made.fault);
    else presets.push(made.preset);
  }
  return { presets, faults };
}

/** A page's preset, or a saved filter by its id, as the Filter it is (plan 960 U4.4b): one type, keeping its Where. A saved
 *  filter in more than one scope is no one Filter, and says why. */
export function filterOf(given: PagePreset | (SavedFilter & { id: string }), source: string): { filter: Entity } | { fault: string } {
  let where: Where | undefined = 'where' in given ? given.where : undefined;
  if (!where && 'query' in given) {
    const said = Object.entries(given.query.scopes).filter(([, s]) => s.where && Object.keys(s.where).length);
    if (said.length !== 1) return { fault: `the saved filter "${given.label}" says ${said.length ? 'its filters in more than one scope' : 'no filter'}, so it is no one Filter` };
    where = said[0]![1].where!;
  }
  return { filter: { v: 2, type: FILTER, id: given.id, label: given.label, query: { where: where! }, settings: { source } } };
}

/** One field's condition in a reader's words: "equals trial", "is one of Pro, Enterprise", "in the last 3 months". */
function conditionWords(given: Where[string] | undefined): string {
  const tree = given === undefined ? undefined : parseWhere({ f: given });
  const words = (t: Condition): string => {
    const parts = groupOf(t);
    if (parts) return parts[1].map(words).join(parts[0] === 'and' ? ' and ' : ' or ');
    const { op, value } = t as ConditionLeaf;
    const span = value as { n?: number; unit?: string } | null;
    const said = Array.isArray(value) ? value.join(', ')
      : span && typeof span === 'object' && span.unit ? `${span.n} ${span.unit}${span.n === 1 ? '' : 's'}` : String(value);
    return `${(OP_LABELS[op as keyof typeof OP_LABELS] ?? op).toLowerCase()} ${said}`;
  };
  return tree ? words(tree) : 'no filter';
}

/** A graph read as the Where it says, where it says one. */
const whereOfGraph = (graph: EntityGraph): Where | undefined => {
  const read = presetOfEntity({ v: 2, type: FILTER, id: 'f', label: 'F', graph });
  return 'preset' in read ? read.preset.where : undefined;
};

/** What changed between two Wheres, field by field, in words: "Status", "equals trial to equals suspended". */
export function whereChanges(was: Where, now: Where): { key: string; value: string }[] {
  const fields = [...new Set([...Object.keys(was), ...Object.keys(now)])];
  return fields.filter((f) => JSON.stringify(was[f]) !== JSON.stringify(now[f]))
    .map((f) => ({ key: f, value: `${conditionWords(was[f])} to ${conditionWords(now[f])}` }));
}

/** The kinds a Where can say: a graph of only these is kept as its Where. */
const SAID_BY_A_WHERE = new Set(['source', 'field', 'condition', 'time']);

/** A Filter's lens (plan 960 U4.4b, D6): drawn from its Where, or as its own graph; written back as a Where when the graph
 *  holds only what a Where says (a Source, Fields, tests, And and Or) and reads as one, else as its graph. A Where's places
 *  are not kept: it unfurls when shown. */
export const FILTER_LENS: GraphLens<Entity, EntityFacts> = {
  graphOf: (entity) => whereGraph(entity.query?.where ?? {}, { ...(sourceOf(entity) ? { source: sourceOf(entity)! } : {}) }),
  changes: (was, now) => {
    const [a, b] = [whereOfGraph(was), whereOfGraph(now)];
    return a && b ? whereChanges(a, b) : undefined;
  },
  toGraph: (entity, facts) => ENTITY_LENS.toGraph(entity.query ? withBody(entity, { graph: FILTER_LENS.graphOf!(entity) }) : entity, facts),
  fromGraph: (before, graph, facts) => {
    const answer = ENTITY_LENS.fromGraph(withBody(before, { graph: entityGraph(before) }), graph, facts);
    if ('faults' in answer) return answer;
    const drawn = answer.definition;
    const keeps = (facts?.types ?? entityTypes())[drawn.type]?.graph?.query;
    if (!keeps || !entityGraph(drawn).nodes.every((n) => SAID_BY_A_WHERE.has(n.kind))) return answer;
    const read = presetOfEntity(drawn, facts);
    if ('fault' in read) return answer;
    const source = sourceOf(drawn);
    return { definition: { ...withBody(drawn, { query: { where: read.preset.where } }), ...(source ? { settings: { ...drawn.settings, source } } : {}) } };
  },
};

registerLens(FILTER, FILTER_LENS);
