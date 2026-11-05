/**
 * preset-filter.ts — a Preset Filter entity as a PRESET of its store's pages. Its graph is drawn as its
 * canvas draws it, then read as ONE condition by the Outgoing JSON's reader (`conditionAt`), a use of
 * another read inside and so flattened; each comparison as the Query editor reads one (`editedCondition`);
 * then each field's own, in the plain form a page's preset has. After that it takes the one door every
 * preset takes: `presetReadings`, then `declarePresets`. DOM-free. Will, TODO 776
 * · docs/history/plan-776-preset-filters-in-data.md · TRAP T-a-preset-filter-is-a-preset-of-its-store
 *
 * Map:
 * - PagePreset — A preset as a page declares it: its id, its name and each field's condition, in the plain form.
 * - PresetFilterFacts — What reading one needs beside it: the other entities (a use's), the types, the kinds and the fields.
 * - sourceOf — The store a Preset Filter reads: its settings', else the one its graph's Store names.
 * - presetOfEntity — A Preset Filter as a page's preset, or why it is none, in words.
 * - presetsOver — The Preset Filters over one store as its pages' presets, the app's then the reader's, and each fault.
 */
import { entityKind, type Entity } from './entity.js';
import { PRESET_FILTER, entityTypes, libraryOf, type EntityType } from './entity-types.js';
import { graphWorkflow } from './entity-check.js';
import { innerOf, kindsOf } from './node-library.js';
import { conditionAt, type Said } from './node-flow.js';
import { NODE_KINDS, type DrawnGraph, type GraphNode, type NodeKind } from './node-kinds.js';
import { groupOf, type Condition, type ConditionLeaf } from './store.js';
import { whereOfTree, type Where } from './where.js';
import { editedCondition } from './query-graph.js';
import { workflowGraph, type WorkflowFacts } from './workflow.js';

/** A preset as a page declares it: its id, its name and each field's condition, in the plain form. */
export interface PagePreset {
  id: string;
  label: string;
  where: Where;
}

/** What reading a Preset Filter needs beside it: the other entities, so a use of one is read inside; the
 *  types and kinds; and the page's fields, which a row picks from. */
export interface PresetFilterFacts {
  entities?: readonly Entity[];
  types?: Readonly<Record<string, EntityType>>;
  kinds?: Readonly<Record<string, NodeKind>>;
  fields?: WorkflowFacts['fields'];
}

/** The store a Preset Filter reads: its settings' `source`, else the one its graph's Store names. Plan 776 D4 */
export function sourceOf(entity: Pick<Entity, 'settings' | 'graph'>): string | undefined {
  const named = entity.settings?.['source'];
  if (typeof named === 'string' && named) return named;
  const store = entity.graph.nodes.find((n) => n.kind === 'store')?.values?.['store'];
  return typeof store === 'string' && store ? store : undefined;
}

/** A tree with each comparison read as the Query editor reads an edited one; or the first part that says too
 *  little, or what a preset cannot hold: a constant that decides it, a boolean only a run gives (TODO 780). */
function leavesRead(tree: Said): { tree: Condition } | { fault: string } {
  if (tree === true) return { fault: 'it always holds, so it filters nothing' };
  if (tree === false) return { fault: 'it never holds, so no row passes' };
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
 * A Preset Filter as a page's PRESET: its id its use's kind, its name, and what its Where says,
 * each field's own condition in the plain form. A use of another inside it is read inside, so it
 * flattens. Why it is none, in words: it sends no condition, a node says none, it says Any of two
 * fields, or a constant decides it. Plan 776 D1, D5, D6 · TRAP T-a-preset-filter-is-a-preset-of-its-store
 */
export function presetOfEntity(entity: Entity, facts: PresetFilterFacts = {}): { preset: PagePreset } | { fault: string } {
  const types = facts.types ?? entityTypes();
  const library = libraryOf([entity, ...(facts.entities ?? []).filter((e) => e.id !== entity.id)], types);
  const kinds = { ...kindsOf(library), ...(facts.kinds ?? NODE_KINDS) };
  const drawn = { ...(facts.fields ? { fields: facts.fields } : {}) };
  const { workflow, kinds: own } = graphWorkflow(entity, kinds, types);
  const graph = workflowGraph(workflow, drawn, own);
  // A use: the graph inside it, drawn as its own canvas draws it.
  const inner = (node: GraphNode): DrawnGraph | undefined => {
    const use = innerOf(node, library, kinds);
    return use && workflowGraph(use.workflow, drawn, use.kinds);
  };
  const at = `the Preset Filter "${entity.label}"`;
  const { tree, faults } = conditionAt(graph, '#out/where', { inner });
  if (faults.length) return { fault: `${at}: ${faults[0]}` };
  if (tree === undefined) return { fault: `${at} sends no condition to its Where` };
  const read = leavesRead(tree);
  const split = 'fault' in read ? read : whereOfTree(read.tree);
  return 'fault' in split ? { fault: `${at}: ${split.fault}` } : { preset: { id: entityKind(entity), label: entity.label, where: split.where } };
}

/** The Preset Filters over one store, as its pages' presets: the app's, read only, then the reader's, in
 *  the shelf's order. One that says no condition is left out, and its fault said. Plan 776 D4, D11 */
export function presetsOver(store: string, entities: readonly Entity[], facts: Omit<PresetFilterFacts, 'entities'> = {}): { presets: PagePreset[]; faults: string[] } {
  const presets: PagePreset[] = [];
  const faults: string[] = [];
  for (const entity of entities) {
    if (entity.type !== PRESET_FILTER || sourceOf(entity) !== store) continue;
    const made = presetOfEntity(entity, { ...facts, entities });
    if ('fault' in made) faults.push(made.fault);
    else presets.push(made.preset);
  }
  return { presets, faults };
}
