/**
 * lens-registry.ts — the lenses an app or the library REGISTERED, by type: the lens door's list (plan 960 U4.1), kept with
 * type-only imports, so the envelope (`entityGraph`) asks it with no import loop. `lensOf` (lens.ts) is the door. DOM-free.
 *
 * Map:
 * - LensNode — What a lens says of one node beyond what a kept graph holds: what it is to the lens, its rows, Off, warnings.
 * - LensDefinition — A graph as a lens gives it: a definition whose nodes say what each is to the lens.
 * - LensAnswer — What writing a graph back gives: the definition it says now, or why not, in words.
 * - GraphLens — How one type's definitions are drawn as a graph and written back.
 * - registerLens — An app or the library gives a type its lens; it answers how to take it back.
 * - registeredLens — The lens a type was given, if any.
 */
import type { EntityGraph } from './entity.js';
import type { NodeKind } from './node-kinds.js';
import { report } from './report.js';
import type { WorkflowDefinition, WorkflowNode } from './workflow.js';

type Kinds = Readonly<Record<string, NodeKind>>;

/** What a lens says of one node beyond what a kept graph holds (plan 1004c): what the node is to the lens, the rows a
 *  reader may change there, a row's words, whether it is kept but not applied, its own icon and its warnings. The drawing carries each through, and
 *  the lens reads an edit back by them. TRAP T-the-node-editor-asks-the-query */
export interface LensNode extends WorkflowNode {
  /** What the node is to its lens, as an edit of it is read back: drawn on the node untouched. */
  ref?: Readonly<Record<string, string>>;
  /** The rows a reader may change here; every other row is read only. None: every row, as a kept graph's. */
  editable?: readonly string[];
  /** A row's words, by its name: why it is read only here, or what it does. */
  hints?: Readonly<Record<string, string>>;
  /** Kept, not applied: a filter turned off. */
  off?: true;
  /** Its own icon, in place of its kind's: a Filter's. */
  icon?: string;
  /** What its lens warns of, on the node or one row: a Source the page does not read. */
  warnings?: readonly { row?: string; words: string }[];
  /** The rows of its kind the lens leaves out here: a kept Source's page rows, the bar's Switch where the bar is not. */
  omit?: readonly string[];
}

/** A graph as a lens gives it: a definition whose nodes say what each is to the lens. */
export interface LensDefinition extends Omit<WorkflowDefinition, 'nodes'> {
  nodes: readonly LensNode[];
}

/** What writing a graph back gives: the definition it says now, or why not, in words. */
export type LensAnswer<D> = { definition: D } | { faults: string[] };

/** How one type's definitions are drawn as a graph and written back. */
export interface GraphLens<D = unknown, F = unknown> {
  /** The definition as the graph the one editor edits, and the kinds it draws beside the shipped (a body's Group Input). */
  toGraph(definition: D, facts?: F): { workflow: LensDefinition; kinds?: Kinds };
  /** The graph written back over the definition it was drawn from: the definition now, or the faults that refuse it. */
  fromGraph(before: D, graph: WorkflowDefinition, facts?: F): LensAnswer<D>;
  /** For an entity that keeps a query body: the graph it says, as a graph body is kept (`entityGraph` reads it). */
  graphOf?(definition: D): EntityGraph;
  /** How two of its graphs differ in what they SAY, as rows of words; none: they are compared node by node. A use's
   *  Update pane shows these. */
  changes?(was: EntityGraph, now: EntityGraph): { key: string; value: string }[] | undefined;
}

const lenses = new Map<string, GraphLens>();

/** An app or the library gives a type its lens. A type with one already is refused and reported. It answers how to take it
 *  back, or none. */
export function registerLens<D, F>(type: string, lens: GraphLens<D, F>): (() => void) | undefined {
  if (lenses.has(type)) {
    report({ code: 'lens', message: `registerLens: "${type}" has a lens already; take it back first.`, at: { type } });
    return undefined;
  }
  lenses.set(type, lens as GraphLens);
  return () => { if (lenses.get(type) === lens) lenses.delete(type); };
}

/** The lens a type was given, if any. */
export const registeredLens = (type: string): GraphLens | undefined => lenses.get(type);
