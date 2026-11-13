/**
 * lens-registry.ts — the lenses an app or the library REGISTERED, by type: the lens door's list (plan 960 U4.1), kept with
 * type-only imports, so the envelope (`entityGraph`) asks it with no import loop. `lensOf` (lens.ts) is the door. DOM-free.
 *
 * Map:
 * - LensAnswer — What writing a graph back gives: the definition it says now, or why not, in words.
 * - GraphLens — How one type's definitions are drawn as a graph and written back.
 * - registerLens — An app or the library gives a type its lens; it answers how to take it back.
 * - registeredLens — The lens a type was given, if any.
 */
import type { EntityGraph } from './entity.js';
import type { NodeKind } from './node-kinds.js';
import { report } from './report.js';
import type { WorkflowDefinition } from './workflow.js';

type Kinds = Readonly<Record<string, NodeKind>>;

/** What writing a graph back gives: the definition it says now, or why not, in words. */
export type LensAnswer<D> = { definition: D } | { faults: string[] };

/** How one type's definitions are drawn as a graph and written back. */
export interface GraphLens<D = unknown, F = unknown> {
  /** The definition as the graph the one editor edits, and the kinds it draws beside the shipped (a body's Group Input). */
  toGraph(definition: D, facts?: F): { workflow: WorkflowDefinition; kinds?: Kinds };
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
