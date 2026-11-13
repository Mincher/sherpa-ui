/**
 * graph-layout.ts — how a graph is DRAWN: its ties, frames, stages and lanes. A Custom Node's definition, an entity's
 * graph and the body a use opens each keep them, through the one helper here. Pure, and light: no import at run time.
 * TODO 947
 *
 * Map:
 * - LayoutParts — How a graph is drawn: its ties, frames, stages and lanes, and whether it is laid out yet.
 * - layoutParts — A graph's layout, each part only where it holds something.
 * - isGroupEnd — Whether a node is a body's Group Input or Output: placed from its body, never kept or moved.
 */
import type { NodeTie } from './node-kinds.js';
import type { NodeFrame } from './node-frames.js';
import type { WorkflowDefinition } from './workflow.js';

/** How a graph is drawn: its ties, frames, stages and lanes, and each node's place before the lanes. */
export interface LayoutParts {
  ties?: readonly NodeTie[];
  frames?: readonly NodeFrame[];
  stages?: NonNullable<WorkflowDefinition['stages']>;
  lanes?: NonNullable<WorkflowDefinition['lanes']>;
  beforeLanes?: NonNullable<WorkflowDefinition['beforeLanes']>;
  /** Not laid out yet: it travels with the layout, wherever a graph goes, until the editor unfurls it (TODO 958). */
  unfurl?: true;
}

/** A graph's layout, each part only where it holds something: no empty list is kept, nor places with no lanes to put back. */
export function layoutParts(g: { readonly [K in keyof LayoutParts]?: LayoutParts[K] | undefined }): LayoutParts {
  return {
    ...(g.ties?.length ? { ties: g.ties } : {}), ...(g.frames?.length ? { frames: g.frames } : {}), ...(g.stages?.length ? { stages: g.stages } : {}),
    ...(g.lanes?.length ? { lanes: g.lanes, ...(g.beforeLanes ? { beforeLanes: g.beforeLanes } : {}) } : {}),
    ...(g.unfurl ? { unfurl: true as const } : {}),
  };
}

/** Whether a node is a body's Group Input or Output: placed from its body each time, never kept, moved or framed. The
 *  Start, the other `#` node, is kept and moved as any node (TODO 955). */
export const isGroupEnd = (id: string): boolean => id === '#in' || id === '#out';
