/**
 * sherpa-node-frame — a frame on a sherpa-layout-canvas: nodes under one header, a title, a line and Release.
 * It owns no place: its host writes the box round its nodes, and it reports each move of its header as a step.
 * Will, TODO 778. TRAP T-a-frame-is-drawn-round-its-nodes
 */
import { DATA_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
// Defined before the template stamps them.
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-button/sherpa-button.js';

/** One arrow key's move, in plane px; Shift moves four times as far. */
const MOVE_STEP = 8;
/** How far a pointer goes, in screen px, before a press is a drag. */
const DRAG_SLOP = 4;
/** Its box, from the attributes its host writes. */
const BOX = ['x', 'y', 'w', 'h'] as const;

export class SherpaNodeFrame extends SherpaElement {
  static override css = new URL('./sherpa-node-frame.css', import.meta.url);
  static override html = new URL('./sherpa-node-frame.html', import.meta.url);

  static override props = {
    'data-heading': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-y': { type: 'number', kind: 'behaviour' },
    'data-w': { type: 'number', kind: 'behaviour' },
    'data-h': { type: 'number', kind: 'behaviour' },
    'data-current': { type: 'boolean', kind: 'style' },
    'data-locked': DATA_PROPS['data-locked'],
  } as const;
  static override observed = ['data-x', 'data-y', 'data-w', 'data-h'];

  /** The drag in progress: the pointer, where it took hold, the canvas's zoom, and the move reported so far. */
  #drag: { id: number; x: number; y: number; zoom: number; sent: [number, number] } | null = null;

  /** The last press was a drag: the click it ends with is no press. */
  #dragged = false;

  override onRender(): void {
    const header = this.$<HTMLElement>('.header');
    header?.addEventListener('pointerdown', this.#onPointerDown);
    header?.addEventListener('dragstart', (event) => event.preventDefault());
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) header?.addEventListener(type, this.#onPointer as EventListener);
    header?.addEventListener('keydown', this.#onKey);
    header?.addEventListener('click', this.#onClick);
    this.$('.release')?.addEventListener('button-click', this.#onRelease);
    this.#place();
  }

  override onChange(name: string): void {
    if (BOX.some((k) => name === `data-${k}`)) this.#place();
  }

  /** Where the canvas draws it: CSS reads the box in px. */
  #place(): void {
    for (const k of BOX) this.style.setProperty(`--_${k}`, `${this.num(`data-${k}`, 0)}px`);
  }

  /** Release: its host takes the frame away. */
  #onRelease = (event?: Event): void => {
    event?.stopPropagation();
    this.emit('frame-release');
  };

  /** Whether an event came from its Release button. */
  #inRelease(event: Event): boolean {
    return event.composedPath().some((n) => n instanceof Element && n.classList.contains('release'));
  }

  /** A drag on the header takes hold, but not one on Release. */
  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.#inRelease(event)) return;
    this.#dragged = false;
    // A zoomed canvas scales the frame: a screen px is 1/zoom plane px.
    const zoom = this.offsetWidth ? this.getBoundingClientRect().width / this.offsetWidth : 1;
    this.#drag = { id: event.pointerId, x: event.clientX, y: event.clientY, zoom: zoom || 1, sent: [0, 0] };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch { /* a synthetic pointer has nothing to capture */ }
  };

  /** Follow the drag, a step at a time, in whole plane px; and end it. */
  #onPointer = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.id) return;
    if (event.type === 'pointermove') {
      if (!this.#dragged && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_SLOP) return;
      this.#dragged = true;
      this.toggleState('dragging', true);
      const total: [number, number] = [Math.round((event.clientX - drag.x) / drag.zoom), Math.round((event.clientY - drag.y) / drag.zoom)];
      const [dx, dy] = [total[0] - drag.sent[0], total[1] - drag.sent[1]];
      if (!dx && !dy) return;
      drag.sent = total;
      this.emit('frame-move', { dx, dy });
      return;
    }
    this.#drag = null;
    this.toggleState('dragging', false);
  };

  /** The arrows move it; Enter or Space picks it; Delete or Backspace releases it. Only on the header itself. */
  #onKey = (event: KeyboardEvent): void => {
    if (event.target !== event.currentTarget) return;
    const step = event.shiftKey ? MOVE_STEP * 4 : MOVE_STEP;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (move) this.emit('frame-move', { dx: move[0], dy: move[1] });
    else if (event.key === 'Enter' || event.key === ' ') this.emit('frame-select');
    else if (event.key === 'Delete' || event.key === 'Backspace') this.#onRelease();
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  /** A press on the header asks to pick it; the click a drag ends with, or one on Release, does not. */
  #onClick = (event: MouseEvent): void => {
    if (this.#inRelease(event)) return;
    if (this.#dragged) {
      this.#dragged = false;
      return;
    }
    this.emit('frame-select');
  };
}

define('sherpa-node-frame', SherpaNodeFrame);
