/**
 * sherpa-node — one node of a node editor, a card on a sherpa-layout-canvas.
 * It sits at its `data-x` and `data-y`. Will, TODO 78.
 *
 * It MOVES ITSELF — a drag on its header, or the arrow keys there — and reports
 * each move (`node-move`), unless `data-locked` says the host owns the place.
 * A press only REPORTS (`node-select`): the host writes `data-current`, as only
 * it sees every node. TRAP T-a-node-moves-itself-and-reports
 */
import { DATA_PROPS, SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
// Defined before the template stamps it.
import '../sherpa-container-header/sherpa-container-header.js';
import { SOCKETS, socketRect, type SocketSide } from './node-sockets.js';

/** One arrow key's move, in plane px; Shift moves four times as far. */
const MOVE_STEP = 8;
/** How far a pointer goes, in screen px, before a press is a drag. */
const DRAG_SLOP = 4;

export class SherpaNode extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-container-regions.css', import.meta.url),
    new URL('../../core/sherpa-node-sockets.css', import.meta.url),
    new URL('./sherpa-node.css', import.meta.url),
  ];
  static override html = new URL('./sherpa-node.html', import.meta.url);

  static override props = {
    'data-heading': { type: 'string', kind: 'content' },
    'data-icon': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-input-socket': SHARED_PROPS['data-input-socket'],
    'data-output-socket': SHARED_PROPS['data-output-socket'],
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-y': { type: 'number', kind: 'behaviour' },
    'data-current': { type: 'boolean', kind: 'style' },
    'data-step': { type: 'enum', kind: 'style', values: ['running', 'done', 'failed', 'skipped'] },
    'data-caption': { type: 'string', kind: 'content' },
    'data-locked': DATA_PROPS['data-locked'],
  } as const;

  /** The drag in progress: the pointer, where it took hold, the place then, and the canvas's zoom. */
  #drag: { id: number; x: number; y: number; from: [number, number]; zoom: number } | null = null;

  /** The last press was a drag: the click it ends with is no press. */
  #dragged = false;

  override onRender(): void {
    const header = this.$<HTMLElement>('.header');
    header?.addEventListener('pointerdown', this.#onPointerDown);
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
      header?.addEventListener(type, this.#onPointer as EventListener);
    }
    header?.addEventListener('keydown', this.#onKey);
    this.addEventListener('click', this.#onClick);
    this.#place();
    this.#sync();
  }

  override onChange(name: string): void {
    if (name === 'data-x' || name === 'data-y') this.#place();
    else if (name === 'data-current') this.#sync();
  }

  /** A header socket's box on the screen, for a connector to join; null when it has none. */
  socketRect(side: SocketSide): DOMRect | null {
    return socketRect(this.$<HTMLElement>(`.header ${SOCKETS[side]}`));
  }

  /** Where the canvas puts it. */
  #place(): void {
    this.style.setProperty('--x', `${this.num('data-x', 0)}px`);
    this.style.setProperty('--y', `${this.num('data-y', 0)}px`);
  }

  /** The selected node says so to assistive tech. */
  #sync(): void {
    const header = this.$('.header');
    if (this.hasAttribute('data-current')) header?.setAttribute('aria-current', 'true');
    else header?.removeAttribute('aria-current');
  }

  /** Move to (x, y) on the plane, in whole px — unless the host owns the place — and report. */
  #move(x: number, y: number): void {
    const to = { x: Math.round(x), y: Math.round(y) };
    if (to.x === this.num('data-x', 0) && to.y === this.num('data-y', 0)) return;
    if (!this.hasAttribute('data-locked')) {
      this.set('data-x', to.x);
      this.set('data-y', to.y);
    }
    this.emit('node-move', to);
  }

  /** A drag on the header takes hold. */
  #onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.#dragged = false;
    // A zoomed canvas scales the node: a screen px is 1/zoom plane px.
    const zoom = this.offsetWidth ? this.getBoundingClientRect().width / this.offsetWidth : 1;
    this.#drag = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      from: [this.num('data-x', 0), this.num('data-y', 0)], zoom: zoom || 1,
    };
    // A synthetic pointer has nothing to capture.
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch { /* the drag still follows the pointer's own events */ }
  };

  /** Follow the drag, and end it. */
  #onPointer = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.id) return;
    if (event.type === 'pointermove') {
      if (!this.#dragged && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_SLOP) return;
      this.#dragged = true;
      this.toggleState('dragging', true);
      this.#move(drag.from[0] + (event.clientX - drag.x) / drag.zoom, drag.from[1] + (event.clientY - drag.y) / drag.zoom);
      return;
    }
    this.#drag = null;
    this.toggleState('dragging', false);
  };

  /** The arrows move it; Enter or Space selects it. */
  #onKey = (event: KeyboardEvent): void => {
    const step = event.shiftKey ? MOVE_STEP * 4 : MOVE_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) this.#move(this.num('data-x', 0) + move[0], this.num('data-y', 0) + move[1]);
    else if (event.key === 'Enter' || event.key === ' ') this.emit('node-select');
    else return;
    event.preventDefault();
  };

  /** A press anywhere on it asks to select it; the click a drag ends with does not. */
  #onClick = (): void => {
    if (this.#dragged) {
      this.#dragged = false;
      return;
    }
    this.emit('node-select');
  };
}

define('sherpa-node', SherpaNode);
