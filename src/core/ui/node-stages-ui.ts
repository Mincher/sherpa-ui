/**
 * node-stages-ui.ts — a workflow editor's STAGES on its canvas: one sherpa-node-stage each, in the canvas's `columns`
 * slot; Add stage, Edit (a dialog: name, line, colour), Remove, and Arrange stages, an edit mode with a footer of its
 * own, Save and Cancel. Each change is one edit through its host. Will, 2026-11-10
 *
 * Map:
 * - StageHost — What the stages need of their editor: its workflow, its write, its redraw, and the stage dialog.
 * - Stages — The stages bound to a canvas: drawn, previewed while arranging, and stopped.
 * - bindStages — Bind a workflow editor's stages to its canvas.
 */
import { editWorkflow, nodeWidth, type WorkflowDefinition } from '../data/workflow.js';
import { heldBands, orderStages, stageBands, stagesOf, type StageBand } from '../data/node-stages.js';

/** What the stages need of their editor. */
export interface StageHost {
  /** The workflow the canvas shows, or null where it takes no stages (a Custom Node's inside). */
  workflow(): WorkflowDefinition | null;
  /** Write a changed workflow: one step. */
  write(next: WorkflowDefinition): void;
  /** Draw the canvas again: while arranging, from `preview()`. */
  redraw(): void;
  readOnly(): boolean;
  /** A node's drawn element, to move with its stage while one is dragged. */
  nodeElement(id: string): HTMLElement | undefined;
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
  /** While arranging, the workflow as the new order would leave it; else none. */
  preview(): WorkflowDefinition | null;
  arranging(): boolean;
  stop(): void;
}

type StageElement = HTMLElement & { rendered?: Promise<void> };

/** The default look's colour, as a picker shows it: the stage's own CSS default. */
const DEFAULT_COLOUR = '#b3b3c3';
type Field = HTMLElement & { value: string };

/** Bind a workflow editor's stages to its canvas. */
export function bindStages(canvas: HTMLElement, host: StageHost): Stages {
  const drawn = new Map<string, StageElement>();
  /** Arranging: the order so far, and the stage being dragged. */
  let arranging: { order: string[]; drag?: { id: string; dx: number } } | null = null;
  let footer: HTMLElement | null = null;
  /** Add stage, and More with Arrange stages: made once, in the canvas's `columns-end` slot. */
  const tools = stageTools(() => onAdd(), () => start());
  let editing: string | null = null;
  /** The colour the dialog opened with: a picker always holds one, so only a change is written. */
  let opened = '';

  const preview = (): WorkflowDefinition | null => {
    const w = host.workflow();
    return w && arranging ? orderStages(w, arranging.order, nodeWidth) : null;
  };
  const shown = (): WorkflowDefinition | null => preview() ?? host.workflow();
  const bandsOf = (w: WorkflowDefinition): StageBand[] => stageBands(w, nodeWidth).bands;

  const draw = (): void => {
    const w = shown();
    const stages = w ? stagesOf(w) : [];
    for (const [id, el] of drawn) {
      if (stages.some((s) => s.id === id)) continue;
      el.remove();
      drawn.delete(id);
    }
    // Add stage and Arrange stages, at the canvas's top right: not while arranging, nor read only.
    if (w && !arranging && !host.readOnly()) canvas.append(tools);
    else tools.remove();
    if (!w) return;
    const out = host.moving?.() ?? new Set<string>();
    const bands = out.size ? heldBands(w, nodeWidth, out) : bandsOf(w);
    const ro = host.readOnly();
    stages.forEach((stage, i) => {
      let el = drawn.get(stage.id);
      if (!el) {
        el = document.createElement('sherpa-node-stage');
        el.slot = 'columns';
        el.dataset['stage'] = stage.id;
        drawn.set(stage.id, el);
      }
      // In order: the DOM's is the reading order.
      canvas.append(el);
      const band = bands[i]!;
      el.setAttribute('data-heading', stage.label);
      put(el, 'data-description', stage.description);
      put(el, 'data-colour', stage.colour);
      el.setAttribute('data-x', String(band.left));
      el.setAttribute('data-w', String(band.right - band.left));
      el.toggleAttribute('data-removable', stages.length > 1 && !ro);
      el.toggleAttribute('data-editing', !!arranging);
      el.toggleAttribute('data-locked', ro);
    });
  };

  const stageOfEvent = (event: Event): string | undefined =>
    (event.target instanceof HTMLElement && event.target.localName === 'sherpa-node-stage' ? event.target.dataset['stage'] : undefined);

  // — Add, Edit, Remove —
  const onAdd = (): void => {
    const w = host.workflow();
    if (w && !host.readOnly()) host.write(editWorkflow(w, { addStage: {} }));
  };
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
    if (action === 'edit') openEdit(id);
    else if (action === 'remove' && !host.readOnly()) host.write(editWorkflow(w, { removeStage: id }));
  };

  // — Arrange stages: an edit mode, its own footer; Save writes the order as one step, Cancel or Escape leaves it —
  const start = (): void => {
    const w = host.workflow();
    if (!w || host.readOnly() || arranging) return;
    arranging = { order: stagesOf(w).map((s) => s.id) };
    canvas.setAttribute('data-editing', '');
    footer = arrangeFooter();
    canvas.append(footer);
    host.redraw();
  };
  const leave = (): void => {
    if (!arranging) return;
    arranging = null;
    canvas.removeAttribute('data-editing');
    footer?.remove();
    footer = null;
    host.redraw();
  };
  const save = (): void => {
    const w = host.workflow();
    const order = arranging?.order;
    leave();
    if (w && order) host.write(editWorkflow(w, { orderStages: order }));
  };
  /** The footer's Cancel and Save: made once each time the mode starts, gone when it ends. */
  const arrangeFooter = (): HTMLElement => {
    const bar = document.createElement('sherpa-container-footer');
    bar.slot = 'footer';
    const button = (label: string, action: string, look?: string): HTMLElement => {
      const b = document.createElement('sherpa-button');
      b.setAttribute('data-label', label);
      b.setAttribute('data-action', action);
      if (look) b.setAttribute('data-look', look);
      b.addEventListener('click', action === 'save' ? save : leave);
      return b;
    };
    bar.append(button('Cancel', 'cancel'), button('Save', 'save', 'saturated'));
    return bar;
  };
  /** A dragged stage, and its nodes, follow the pointer; let go, the stages take the order their middles say. */
  const onDrag = (event: Event): void => {
    const id = stageOfEvent(event);
    const { dx, phase } = (event as CustomEvent<{ dx: number; phase: 'move' | 'end' | 'cancel' }>).detail;
    const w = preview();
    if (!id || !arranging || !w) return;
    const bands = bandsOf(w);
    const band = bands.find((b) => b.id === id);
    if (!band) return;
    if (phase === 'move') {
      drawn.get(id)?.setAttribute('data-x', String(band.left + dx));
      for (const n of w.nodes) if (n.stage === id) host.nodeElement(n.id)?.setAttribute('data-x', String(n.x + dx));
      return;
    }
    if (phase === 'end') {
      const middle = (b: StageBand): number => (b.left + b.right) / 2 + (b.id === id ? dx : 0);
      arranging.order = [...bands].sort((a, b) => middle(a) - middle(b)).map((b) => b.id);
    }
    host.redraw();
  };
  const onStep = (event: Event): void => {
    const id = stageOfEvent(event);
    const { by } = (event as CustomEvent<{ by: number }>).detail;
    if (!id || !arranging) return;
    const order = arranging.order;
    const at = order.indexOf(id);
    const to = Math.max(0, Math.min(order.length - 1, at + by));
    if (at < 0 || to === at) return;
    order.splice(at, 1);
    order.splice(to, 0, id);
    host.redraw();
    // The keys stay on the stage they moved.
    requestAnimationFrame(() => drawn.get(id)?.shadowRoot?.querySelector<HTMLElement>('.bar')?.focus());
  };
  const onKey = (event: KeyboardEvent): void => {
    if (arranging && event.key === 'Escape') {
      event.preventDefault();
      leave();
    }
  };

  const save$ = host.dialog?.querySelector('[data-action="save"]');
  const cancel$ = host.dialog?.querySelector('[data-action="cancel"]');
  save$?.addEventListener('click', saveEdit);
  cancel$?.addEventListener('click', cancelEdit);
  canvas.addEventListener('stage-menu-select', onMenu);
  canvas.addEventListener('stage-drag', onDrag);
  canvas.addEventListener('stage-step', onStep);
  canvas.addEventListener('keydown', onKey);

  return {
    draw,
    preview,
    arranging: () => !!arranging,
    stop(): void {
      leave();
      for (const el of drawn.values()) el.remove();
      drawn.clear();
      tools.remove();
      save$?.removeEventListener('click', saveEdit);
      cancel$?.removeEventListener('click', cancelEdit);
      canvas.removeEventListener('stage-menu-select', onMenu);
      canvas.removeEventListener('stage-drag', onDrag);
      canvas.removeEventListener('stage-step', onStep);
      canvas.removeEventListener('keydown', onKey);
    },
  };
}

/** Add stage, and More with Arrange stages, as one group. A pick is answered once the menu has shut: what it starts hides
 *  the group, and a menu hidden while it shuts stays open in name. */
function stageTools(add: () => void, arrange: () => void): HTMLElement {
  const group = document.createElement('sherpa-group');
  group.slot = 'columns-end';
  group.className = 'stage-tools';
  const button = (cls: string, icon: string, label: string): HTMLElement => {
    const b = document.createElement('sherpa-button');
    b.className = cls;
    b.setAttribute('data-type', 'icon');
    b.setAttribute('data-size', 'sm');
    b.setAttribute('data-icon-start', icon);
    b.setAttribute('aria-label', label);
    return b;
  };
  const plus = button('add-stage', 'plus', 'Add stage');
  plus.setAttribute('data-tip', 'Add stage');
  plus.addEventListener('click', add);
  const more = button('stages-more', 'ellipsis-horizontal', 'Stages');
  more.setAttribute('aria-haspopup', 'menu');
  const menu = document.createElement('sherpa-menu');
  menu.slot = 'menu';
  menu.setAttribute('data-align', 'end');
  const item = document.createElement('button');
  item.type = 'button';
  item.value = 'arrange';
  item.textContent = 'Arrange stages';
  menu.append(item);
  more.append(menu);
  more.addEventListener('menu-select', (event) => {
    if ((event as CustomEvent<{ value?: string }>).detail?.value === 'arrange') queueMicrotask(arrange);
  });
  group.append(plus, more);
  return group;
}

/** Set an attribute, or take it away when there is nothing to say. */
function put(el: Element, name: string, value: string | undefined): void {
  if (value) el.setAttribute(name, value);
  else el.removeAttribute(name);
}
