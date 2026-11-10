/**
 * sherpa-node-stage — one stage of a workflow: a column across a sherpa-layout-canvas, its bar at the top and its band
 * down the view. It owns no place: its host writes its edge and width, and it reports its menu and, while arranging,
 * each drag of its bar. Will, 2026-11-10
 */
import { DATA_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
// Defined before the template stamps them.
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';

/** How far a pointer goes, in screen px, before a press is a drag. */
const DRAG_SLOP = 4;

export class SherpaNodeStage extends SherpaElement {
  static override css = new URL('./sherpa-node-stage.css', import.meta.url);
  static override html = new URL('./sherpa-node-stage.html', import.meta.url);

  static override props = {
    'data-heading': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-colour': { type: 'string', kind: 'behaviour' },
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-w': { type: 'number', kind: 'behaviour' },
    'data-removable': { type: 'boolean', kind: 'style' },
    'data-editing': { type: 'boolean', kind: 'style' },
    'data-locked': DATA_PROPS['data-locked'],
  } as const;
  static override observed = ['data-x', 'data-w', 'data-colour'];

  /** The drag in progress: the pointer, where it took hold, and the canvas's zoom. */
  #drag: { id: number; x: number; zoom: number; moved: boolean } | null = null;

  override onRender(): void {
    const bar = this.$<HTMLElement>('.bar');
    bar?.addEventListener('pointerdown', this.#onPointerDown);
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) bar?.addEventListener(type, this.#onPointer as EventListener);
    bar?.addEventListener('keydown', this.#onKey);
    this.$('.more')?.addEventListener('menu-select', this.#onMenu);
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** Where the canvas draws it, and its colour. */
  #sync(): void {
    this.style.setProperty('--x', `${this.num('data-x', 0)}px`);
    this.style.setProperty('--width', `${this.num('data-w', 320)}px`);
    const colour = this.getAttribute('data-colour');
    if (colour) this.style.setProperty('--_colour', colour);
    else this.style.removeProperty('--_colour');
  }

  /** More: Edit or Remove. Reported once the menu has shut: what the host does next may hide the button it hangs from,
   *  and a menu hidden while it shuts stays open in name. */
  #onMenu = (event: Event): void => {
    event.stopPropagation();
    const action = (event as CustomEvent<{ value?: string }>).detail?.value;
    if (action === 'edit' || (action === 'remove' && this.hasAttribute('data-removable'))) queueMicrotask(() => this.emit('stage-menu-select', { action }));
  };

  /** Arranging, a drag on the bar takes hold; not one on More. */
  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.hasAttribute('data-editing')) return;
    // A zoomed canvas scales the column: a screen px is 1/zoom plane px.
    const width = this.num('data-w', 320);
    const zoom = width ? this.getBoundingClientRect().width / width : 1;
    this.#drag = { id: event.pointerId, x: event.clientX, zoom: zoom || 1, moved: false };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch { /* a synthetic pointer has nothing to capture */ }
  };

  /** Follow the drag across, in plane px from where it took hold, and end it. */
  #onPointer = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.id) return;
    const dx = Math.round((event.clientX - drag.x) / drag.zoom);
    if (event.type === 'pointermove') {
      if (!drag.moved && Math.abs(event.clientX - drag.x) < DRAG_SLOP) return;
      drag.moved = true;
      this.toggleState('dragging', true);
      this.emit('stage-drag', { dx, phase: 'move' });
      return;
    }
    this.#drag = null;
    this.toggleState('dragging', false);
    if (drag.moved) this.emit('stage-drag', { dx, phase: event.type === 'pointerup' ? 'end' : 'cancel' });
  };

  /** Arranging, the arrows move it one place left or right. */
  #onKey = (event: KeyboardEvent): void => {
    if (event.target !== event.currentTarget || !this.hasAttribute('data-editing')) return;
    const by = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (!by) return;
    event.preventDefault();
    this.emit('stage-step', { by });
  };
}

define('sherpa-node-stage', SherpaNodeStage);
