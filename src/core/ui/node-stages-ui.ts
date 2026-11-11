/**
 * node-stages-ui.ts — a workflow editor's STAGES on its canvas: one sherpa-node-stage each, in the canvas's `columns`
 * slot; on each, Move left and Move right, and More: Edit (a dialog: name, line, colour), Add stage before, Add stage
 * after and Remove. Each change is one edit through its host. Will, 2026-11-10 · TODO 893
 *
 * Map:
 * - StageHost — What the stages need of their editor: its workflow, its write, and the stage dialog.
 * - Stages — The stages bound to a canvas: drawn, and stopped.
 * - bindStages — Bind a workflow editor's stages to its canvas.
 */
import { editWorkflow, nodeWidth, type WorkflowDefinition } from '../data/workflow.js';
import { heldBands, stageBands, stagesOf } from '../data/node-stages.js';
import { keepOrder } from './keep-order.js';

/** What the stages need of their editor. */
export interface StageHost {
  /** The workflow the canvas shows, or null where it takes no stages (a Custom Node's inside). */
  workflow(): WorkflowDefinition | null;
  /** Write a changed workflow: one step. */
  write(next: WorkflowDefinition): void;
  readOnly(): boolean;
  /** The nodes a Shift-drag has taken out of their stages: the stages hold still as they stood, without them. */
  moving?(): ReadonlySet<string>;
  /** A `sherpa-dialog` that asks a stage's name, line and colour: fields `[name=label]`, `[name=description]` and
   *  `[name=colour]` (a colour field), buttons `[data-action=save]` and `[data-action=cancel]`. Without it, Edit is not offered. */
  dialog?: (HTMLElement & { show(): void; hide(): void }) | null;
}

/** The stages bound to a canvas. */
export interface Stages {
  /** Draw the stages of what the canvas shows; none where it takes no stages. */
  draw(): void;
  stop(): void;
}

type StageElement = HTMLElement & { rendered?: Promise<void> };

/** The default look's colour, as a picker shows it: the stage's own CSS default. */
const DEFAULT_COLOUR = '#b3b3c3';
type Field = HTMLElement & { value: string };

/** Bind a workflow editor's stages to its canvas. */
export function bindStages(canvas: HTMLElement, host: StageHost): Stages {
  const drawn = new Map<string, StageElement>();
  let editing: string | null = null;
  /** The colour the dialog opened with: a picker always holds one, so only a change is written. */
  let opened = '';

  const draw = (): void => {
    const w = host.workflow();
    const stages = w ? stagesOf(w) : [];
    for (const [id, el] of drawn) {
      if (stages.some((s) => s.id === id)) continue;
      el.remove();
      drawn.delete(id);
    }
    if (!w) return;
    const out = host.moving?.() ?? new Set<string>();
    const bands = out.size ? heldBands(w, nodeWidth, out) : stageBands(w, nodeWidth).bands;
    const ro = host.readOnly();
    stages.forEach((stage, i) => {
      let el = drawn.get(stage.id);
      if (!el) {
        el = document.createElement('sherpa-node-stage');
        el.slot = 'columns';
        el.dataset['stage'] = stage.id;
        drawn.set(stage.id, el);
      }
      const band = bands[i]!;
      el.setAttribute('data-heading', stage.label);
      put(el, 'data-description', stage.description);
      put(el, 'data-colour', stage.colour);
      el.setAttribute('data-x', String(band.left));
      el.setAttribute('data-w', String(band.right - band.left));
      el.toggleAttribute('data-removable', stages.length > 1 && !ro);
      el.toggleAttribute('data-first', i === 0);
      el.toggleAttribute('data-last', i === stages.length - 1);
      el.toggleAttribute('data-locked', ro);
    });
    // In order: the DOM's is the reading order. Only one out of place moves. TRAP T-a-redraw-keeps-what-it-can
    keepOrder(canvas, stages.map((stage) => drawn.get(stage.id)!));
  };

  const stageOfEvent = (event: Event): string | undefined =>
    (event.target instanceof HTMLElement && event.target.localName === 'sherpa-node-stage' ? event.target.dataset['stage'] : undefined);

  // — Edit, Add before or after, Remove, Move —
  const field = (name: string): Field | null => host.dialog?.querySelector<Field>(`[name="${name}"]`) ?? null;
  const openEdit = (id: string): void => {
    const stage = stagesOf(host.workflow() ?? { nodes: [] }).find((s) => s.id === id);
    if (!stage || !host.dialog || host.readOnly()) return;
    editing = id;
    field('label')!.value = stage.label;
    if (field('description')) field('description')!.value = stage.description ?? '';
    // A picker holds a colour always: none set, it shows the default look's.
    opened = stage.colour ?? DEFAULT_COLOUR;
    if (field('colour')) field('colour')!.value = opened;
    host.dialog.show();
    field('label')?.focus();
  };
  const saveEdit = (): void => {
    const w = host.workflow();
    if (!w || !editing) return;
    const label = field('label')?.value.trim() ?? '';
    if (!label) return void field('label')?.setAttribute('data-error', 'A stage needs a name.');
    field('label')?.removeAttribute('data-error');
    const colour = field('colour')?.value;
    const changed = colour && colour.toLowerCase() !== opened.toLowerCase() ? { colour } : {};
    host.write(editWorkflow(w, { setStage: { id: editing, label, description: field('description')?.value ?? '', ...changed } }));
    editing = null;
    host.dialog?.hide();
  };
  const cancelEdit = (): void => {
    editing = null;
    host.dialog?.hide();
  };
  const onMenu = (event: Event): void => {
    const id = stageOfEvent(event);
    const action = (event as CustomEvent<{ action: string }>).detail?.action;
    const w = host.workflow();
    if (!id || !w) return;
    if (action === 'edit') return openEdit(id);
    if (host.readOnly()) return;
    if (action === 'remove') host.write(editWorkflow(w, { removeStage: id }));
    else if (action === 'add-before') host.write(editWorkflow(w, { addStage: { before: id } }));
    else if (action === 'add-after') host.write(editWorkflow(w, { addStage: { after: id } }));
  };
  /** Move left or right: one place along the row, its nodes with it, one step. */
  const onMove = (event: Event): void => {
    const id = stageOfEvent(event);
    const { by } = (event as CustomEvent<{ by: number }>).detail;
    const w = host.workflow();
    if (!id || !w || host.readOnly()) return;
    const order = stagesOf(w).map((s) => s.id);
    const at = order.indexOf(id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= order.length) return;
    order.splice(at, 1);
    order.splice(to, 0, id);
    host.write(editWorkflow(w, { orderStages: order }));
    // The keys stay on the stage that moved: at its button, or its bar where that button is now off (at an end).
    const side = by < 0 ? '.move-left' : '.move-right';
    requestAnimationFrame(() => {
      const root = drawn.get(id)?.shadowRoot;
      const button = root?.querySelector<HTMLElement>(side);
      (button && !button.hasAttribute('disabled') ? button : root?.querySelector<HTMLElement>('.bar'))?.focus();
    });
  };

  const save$ = host.dialog?.querySelector('[data-action="save"]');
  const cancel$ = host.dialog?.querySelector('[data-action="cancel"]');
  save$?.addEventListener('click', saveEdit);
  cancel$?.addEventListener('click', cancelEdit);
  canvas.addEventListener('stage-menu-select', onMenu);
  canvas.addEventListener('stage-move', onMove);

  return {
    draw,
    stop(): void {
      for (const el of drawn.values()) el.remove();
      drawn.clear();
      save$?.removeEventListener('click', saveEdit);
      cancel$?.removeEventListener('click', cancelEdit);
      canvas.removeEventListener('stage-menu-select', onMenu);
      canvas.removeEventListener('stage-move', onMove);
    },
  };
}

/** Set an attribute, or take it away when there is nothing to say. */
function put(el: Element, name: string, value: string | undefined): void {
  if (value) el.setAttribute(name, value);
  else el.removeAttribute(name);
}
