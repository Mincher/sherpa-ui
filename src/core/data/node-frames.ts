/**
 * node-frames.ts — a FRAME: picked nodes under one header, a title and a line. It saves only which nodes;
 * its box is drawn round them. It changes no data. Pure: no DOM. Will, TODO 778 · docs/history/plan-778-frames.md
 * · TRAP T-a-frame-is-drawn-round-its-nodes
 *
 * Map:
 * - NodeFrame — One frame: its id, its title and line, and the nodes it holds.
 * - FramedGraph — A drawn graph with its frames.
 * - framesAmong — The frames left when only some nodes remain: each keeps its nodes still there, and none, it goes.
 * - framed — The frames after framing these nodes: taken from the frames they were in, and a new one.
 * - frameFaults — Every fault in a graph's frames, in words.
 */
import type { DrawnGraph } from './node-kinds.js';

/** One frame: its id, its title and line, and the nodes it holds, in order. */
export interface NodeFrame {
  id: string;
  label?: string;
  description?: string;
  nodes: readonly string[];
}

/** A drawn graph with its frames. */
export type FramedGraph = DrawnGraph & { frames?: readonly NodeFrame[] };

/** The frames left when only these nodes remain: a frame keeps its nodes still there; with none, it goes. */
export function framesAmong(frames: readonly NodeFrame[] | undefined, nodes: readonly string[] | ReadonlySet<string>): NodeFrame[] {
  const there = nodes instanceof Set ? nodes : new Set(nodes as readonly string[]);
  return (frames ?? []).flatMap((f) => {
    const kept = f.nodes.filter((id) => there.has(id));
    return kept.length ? [kept.length === f.nodes.length ? f : { ...f, nodes: kept }] : [];
  });
}

/** The frames after framing these nodes: each is taken from the frame it was in (one left with none goes),
 *  and the new frame is last, under a free id and, unless named, "Frame" and its number. */
export function framed(frames: readonly NodeFrame[] | undefined, nodes: readonly string[], ask: { id?: string; label?: string; description?: string } = {}): NodeFrame[] {
  const ids = [...new Set(nodes)];
  const left = (frames ?? []).flatMap((f) => {
    const kept = f.nodes.filter((id) => !ids.includes(id));
    return kept.length ? [kept.length === f.nodes.length ? f : { ...f, nodes: kept }] : [];
  });
  const free = (n: number): number => (left.some((f) => f.id === `frame-${n}`) ? free(n + 1) : n);
  const n = free(1);
  const description = ask.description?.trim();
  return [...left, { id: ask.id ?? `frame-${n}`, label: ask.label?.trim() || `Frame ${n}`, ...(description ? { description } : {}), nodes: ids }];
}

/** Every fault in a graph's frames, in words: two frames one id, a frame of no node, a node not there, a node in two. */
export function frameFaults(frames: readonly NodeFrame[] | undefined, nodes: readonly string[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const holder = new Map<string, string>();
  for (const frame of frames ?? []) {
    if (seen.has(frame.id)) problems.push(`two frames are "${frame.id}"`);
    seen.add(frame.id);
    if (!frame.nodes?.length) problems.push(`the frame "${frame.id}" frames no node`);
    for (const id of frame.nodes ?? []) {
      if (!nodes.includes(id)) problems.push(`the frame "${frame.id}" frames the node "${id}", which is not there`);
      else if (holder.has(id) && holder.get(id) !== frame.id) problems.push(`the node "${id}" is in two frames, "${holder.get(id)}" and "${frame.id}"`);
      else holder.set(id, frame.id);
    }
  }
  return problems;
}
