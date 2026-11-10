/**
 * node-lanes-ui.ts — a workflow editor's SWIMLANES on its canvas: one sherpa-node-lane for each band that holds a node, in
 * the canvas's `rows` slot, drawn from the bands the data layer lays out. Will, 2026-11-10
 *
 * Map:
 * - drawLanes — Draw a workflow's lanes and junctions on a canvas; none, take them away.
 */
import type { NodeKind } from '../data/node-kinds.js';
import { laneBands } from '../data/node-lanes.js';
import type { WorkflowDefinition } from '../data/workflow.js';

const drawnOn = new WeakMap<HTMLElement, Map<string, HTMLElement>>();

/** Draw a workflow's lanes and junctions on a canvas, by its nodes' drawn heights; with none, or no workflow, take them away. */
export function drawLanes(
  canvas: HTMLElement, workflow: WorkflowDefinition | null, heightOf: (node: { id: string }) => number, kinds: Readonly<Record<string, NodeKind>>,
): void {
  let drawn = drawnOn.get(canvas);
  if (!drawn) drawnOn.set(canvas, (drawn = new Map()));
  const bands = workflow ? laneBands(workflow, heightOf, kinds).bands : [];
  const colours = new Map((workflow?.lanes ?? []).map((l) => [l.id, l.colour]));
  for (const [id, el] of drawn) {
    if (bands.some((b) => b.id === id)) continue;
    el.remove();
    drawn.delete(id);
  }
  for (const band of bands) {
    let el = drawn.get(band.id);
    if (!el) {
      el = document.createElement('sherpa-node-lane');
      el.slot = 'rows';
      drawn.set(band.id, el);
    }
    canvas.append(el);
    el.setAttribute('data-heading', band.label);
    el.setAttribute('data-type', band.junction ? 'junction' : 'lane');
    const colour = colours.get(band.id);
    if (colour) el.setAttribute('data-colour', colour);
    else el.removeAttribute('data-colour');
    el.setAttribute('data-y', String(band.top));
    el.setAttribute('data-h', String(band.bottom - band.top));
  }
}
