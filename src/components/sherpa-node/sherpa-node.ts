/**
 * sherpa-node — one node of a node editor, a card on a sherpa-layout-canvas.
 * It sits at its `data-x` and `data-y`. Will, TODO 78.
 *
 * It MOVES ITSELF — a drag on its header, or the arrow keys there — and reports
 * each move (`node-move`), unless `data-locked` says the host owns the place.
 * A press only REPORTS (`node-select`): the host writes `data-current`, as only
 * it sees every node. TRAP T-a-node-moves-itself-and-reports
 * Its sockets are drawn by type; a fork adds a footer. TRAP T-a-socket-is-drawn-by-its-type
 * A warning is its host's words: the warning look, and the header's tip. TRAP T-a-node-reads-null-from-what-it-cannot-use
 * A portal of a picked portal's name is `data-linked`: it looks picked. TRAP T-a-portal-hop-is-resolved-once
 */
import { DATA_PROPS, SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
// Defined before the template stamps it.
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-button/sherpa-button.js';
import { primaryKey, primaryLabel } from '../../core/ui/modifier-key.js';
import { SOCKETS, socketRect, type SocketSide } from './node-sockets.js';
import { nodeTitle } from '../../core/data/node-title.js';

/** One arrow key's move, in plane px; Shift moves four times as far. */
const MOVE_STEP = 8;
/** How far a pointer goes, in screen px, before a press is a drag. */
const DRAG_SLOP = 4;
/** The most a node grows each way: double its natural size. */
const MAX_SCALE = 2;

export class SherpaNode extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-container-regions.css', import.meta.url),
    new URL('../../core/sherpa-node-sockets.css', import.meta.url),
    new URL('../../core/sherpa-node-look.css', import.meta.url),
    new URL('./sherpa-node.css', import.meta.url),
  ];
  static override html = new URL('./sherpa-node.html', import.meta.url);
  static override pageCss = new URL('./sherpa-node-connectors.css', import.meta.url);

  static override props = {
    'data-heading': { type: 'string', kind: 'content' },
    'data-kind': { type: 'string', kind: 'content' },
    'data-icon': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-input-socket': SHARED_PROPS['data-input-socket'],
    'data-output-socket': SHARED_PROPS['data-output-socket'],
    'data-input-connected': SHARED_PROPS['data-input-connected'],
    'data-output-connected': SHARED_PROPS['data-output-connected'],
    'data-input-many': SHARED_PROPS['data-input-many'],
    'data-category': { type: 'string', kind: 'style' },
    'data-scale-w': { type: 'number', kind: 'behaviour' },
    'data-scale-h': { type: 'number', kind: 'behaviour' },
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-y': { type: 'number', kind: 'behaviour' },
    'data-current': { type: 'boolean', kind: 'style' },
    'data-active': { type: 'boolean', kind: 'style' },
    'data-joined': { type: 'boolean', kind: 'style' },
    'data-linked': { type: 'boolean', kind: 'style' },
    'data-step': { type: 'enum', kind: 'style', values: ['running', 'done', 'failed', 'skipped'] },
    'data-caption': { type: 'string', kind: 'content' },
    'data-warning': { type: 'string', kind: 'content' },
    'data-locked': DATA_PROPS['data-locked'],
    'data-resizable': { type: 'boolean', kind: 'style' },
    'data-chain-drag': { type: 'boolean', kind: 'behaviour' },
    'data-collapsed': { type: 'boolean', kind: 'style' },
    'data-summary': { type: 'string', kind: 'content' },
    'data-inputs': { type: 'number', kind: 'behaviour' },
    'data-outputs': { type: 'number', kind: 'behaviour' },
    'data-inputs-connected': { type: 'number', kind: 'behaviour' },
    'data-outputs-connected': { type: 'number', kind: 'behaviour' },
    'data-hide-unconnected': { type: 'boolean', kind: 'style' },
    'data-reveal': { type: 'boolean', kind: 'style' },
    'data-sub-graph': { type: 'boolean', kind: 'style' },
  } as const;
  // The app's settings: the handle and Alt+Arrow exist only while one is on, a saved size drawn either way (TODO 748);
  // ⌘ or Ctrl on a move asks to pull the nodes it joins only while the other is (plan 918).
  static override settings = { 'data-resizable': 'resizeNodes', 'data-chain-drag': 'chainDrag' };
  static override observed = ['data-x', 'data-y', 'data-scale-w', 'data-scale-h', 'data-inputs', 'data-outputs', 'data-inputs-connected', 'data-outputs-connected'];

  /** The drag in progress: the pointer, where it took hold, the place then, and the canvas's zoom. */
  #drag: { id: number; x: number; y: number; from: [number, number]; zoom: number } | null = null;

  /** The resize in progress: the pointer, and the size then in px and in times natural. */
  #grow: { id: number; x: number; y: number; w: number; h: number; sw: number; sh: number; zoom: number } | null = null;

  /** The last press was a drag: the click it ends with is no press. */
  #dragged = false;

  override onRender(): void {
    const header = this.$<HTMLElement>('.header');
    header?.addEventListener('pointerdown', this.#onPointerDown);
    // Text or an icon already selected on the page would otherwise start a native drag, not a move.
    header?.addEventListener('dragstart', (event) => event.preventDefault());
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
      header?.addEventListener(type, this.#onPointer as EventListener);
    }
    header?.addEventListener('keydown', this.#onKey);
    const handle = this.$<HTMLElement>('.resize');
    handle?.setAttribute('title', `Drag to resize. Hold ${primaryLabel} to keep the shape.`);
    handle?.addEventListener('pointerdown', this.#onGrowDown);
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) handle?.addEventListener(type, this.#onGrow as EventListener);
    handle?.addEventListener('dragstart', (event) => event.preventDefault());
    this.addEventListener('click', this.#onClick);
    this.$('.open')?.addEventListener('button-click', (event) => {
      event.stopPropagation();
      this.emit('node-open');
    });
    this.#place();
    this.#fit();
    this.#sync();
    this.#title();
    this.#stacks();
    // The stacks start at the header's middle: its height, where the CSS reads it.
    if (header) new ResizeObserver(() => this.style.setProperty('--_head-h', `${header.offsetHeight}px`)).observe(header);
  }

  override onChange(name: string): void {
    if (name === 'data-x' || name === 'data-y') this.#place();
    else if (name === 'data-scale-w' || name === 'data-scale-h') this.#fit();
    else if (name === 'data-current') this.#sync();
    else if (name === 'data-heading' || name === 'data-kind' || name === 'data-collapsed' || name === 'data-summary') this.#title();
    else if (name.startsWith('data-inputs') || name.startsWith('data-outputs')) this.#stacks();
  }

  /** The stacks' counts, where the CSS reads them. */
  #stacks(): void {
    for (const [attr, prop] of [['data-inputs', '--_ins'], ['data-outputs', '--_outs'], ['data-inputs-connected', '--_ins-connected'], ['data-outputs-connected', '--_outs-connected']] as const) {
      this.style.setProperty(prop, String(this.num(attr, 0)));
    }
  }

  /** Its name, in its header: a name of its own after its kind ("Field: Device type"); collapsed, followed by what its
   *  first field holds ("Condition: Equals"). Will, 2026-11-10, 2026-11-11 · TRAP T-a-custom-title-follows-its-kind */
  #title(): void {
    const own = this.getAttribute('data-heading') || 'Node';
    const heading = nodeTitle(this.getAttribute('data-kind') || own, own);
    const summary = this.hasAttribute('data-collapsed') ? this.getAttribute('data-summary') : null;
    this.$('.heading')?.setAttribute('data-heading', summary ? `${heading}: ${summary}` : heading);
  }

  /** A socket's box on the screen, for a connector to join: the header's; null when it has none. */
  socketRect(side: SocketSide): DOMRect | null {
    return socketRect(this.$<HTMLElement>(`.header ${SOCKETS[side]}`));
  }

  /** Where the canvas puts it. */
  #place(): void {
    this.style.setProperty('--x', `${this.num('data-x', 0)}px`);
    this.style.setProperty('--y', `${this.num('data-y', 0)}px`);
  }

  /** Its size: the width in times 15rem, and a least height in times its natural one. */
  #fit(): void {
    const w = this.#scale('data-scale-w');
    const h = this.#scale('data-scale-h');
    this.style.setProperty('--_scale-w', String(w));
    const root = this.$<HTMLElement>('.root');
    if (!root) return;
    root.style.minBlockSize = '';
    if (h > 1) root.style.minBlockSize = `${root.offsetHeight * h}px`;
  }

  /** One of its scales, held between 1 and 2. */
  #scale(name: string): number {
    return Math.min(MAX_SCALE, Math.max(1, this.num(name, 1)));
  }

  /** Resize to these scales, held between 1 and 2 — unless the host owns the size — and report. */
  #resize(w: number, h: number): void {
    const to = { w: Math.round(Math.min(MAX_SCALE, Math.max(1, w)) * 100) / 100, h: Math.round(Math.min(MAX_SCALE, Math.max(1, h)) * 100) / 100 };
    if (to.w === this.#scale('data-scale-w') && to.h === this.#scale('data-scale-h')) return;
    if (!this.hasAttribute('data-locked')) {
      this.set('data-scale-w', to.w === 1 ? null : to.w);
      this.set('data-scale-h', to.h === 1 ? null : to.h);
    }
    this.emit('node-resize', to);
  }

  /** The handle takes hold. */
  #onGrowDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    // Focus stays in the node, so Undo and the arrows still reach it.
    this.$<HTMLElement>('.header')?.focus({ preventScroll: true });
    const zoom = this.offsetWidth ? this.getBoundingClientRect().width / this.offsetWidth : 1;
    const sw = this.#scale('data-scale-w');
    const sh = this.#scale('data-scale-h');
    this.#grow = {
      id: event.pointerId, x: event.clientX, y: event.clientY, sw, sh, zoom: zoom || 1,
      w: this.offsetWidth, h: this.$<HTMLElement>('.root')!.offsetHeight,
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch { /* the drag still follows the pointer's own events */ }
  };

  /** Follow the resize, and end it. Each way is held between its natural size and double it. */
  #onGrow = (event: PointerEvent): void => {
    const grow = this.#grow;
    if (!grow || event.pointerId !== grow.id) return;
    if (event.type !== 'pointermove') {
      this.#grow = null;
      this.toggleState('resizing', false);
      return;
    }
    this.toggleState('resizing', true);
    const rw = (grow.w + (event.clientX - grow.x) / grow.zoom) / grow.w;
    const rh = (grow.h + (event.clientY - grow.y) / grow.zoom) / grow.h;
    if (primaryKey(event)) {
      // The aspect kept: both scale by the one factor that moved more.
      const f = Math.abs(rw - 1) >= Math.abs(rh - 1) ? rw : rh;
      const k = Math.min(Math.max(f, Math.max(1 / grow.sw, 1 / grow.sh)), Math.min(MAX_SCALE / grow.sw, MAX_SCALE / grow.sh));
      this.#resize(grow.sw * k, grow.sh * k);
    } else {
      this.#resize(grow.sw * rw, grow.sh * rh);
    }
  };

  /** The selected node says so to assistive tech. */
  #sync(): void {
    const header = this.$('.header');
    if (this.hasAttribute('data-current')) header?.setAttribute('aria-current', 'true');
    else header?.removeAttribute('aria-current');
  }

  /** Move to (x, y) on the plane, in whole px — unless the host owns the place — and report; with ⌘ or Ctrl held and
   *  chain dragging on, it asks to pull the nodes it joins (`chain`). */
  #move(x: number, y: number, held: { metaKey: boolean; ctrlKey: boolean }): void {
    const to = { x: Math.round(x), y: Math.round(y) };
    if (to.x === this.num('data-x', 0) && to.y === this.num('data-y', 0)) return;
    if (!this.hasAttribute('data-locked')) {
      this.set('data-x', to.x);
      this.set('data-y', to.y);
    }
    this.emit('node-move', this.hasAttribute('data-chain-drag') && primaryKey(held) ? { ...to, chain: true } : to);
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
      this.#move(drag.from[0] + (event.clientX - drag.x) / drag.zoom, drag.from[1] + (event.clientY - drag.y) / drag.zoom, event);
      return;
    }
    this.#drag = null;
    this.toggleState('dragging', false);
  };

  /** The arrows move it; Enter or Space selects it. */
  #onKey = (event: KeyboardEvent): void => {
    if (event.altKey) {
      if (!this.hasAttribute('data-resizable')) return;
      // Alt and an arrow: a tenth of its natural size wider or taller, or less.
      const grows: Record<string, [number, number]> = { ArrowRight: [0.1, 0], ArrowLeft: [-0.1, 0], ArrowDown: [0, 0.1], ArrowUp: [0, -0.1] };
      const g = grows[event.key];
      if (!g) return;
      this.#resize(this.#scale('data-scale-w') + g[0], this.#scale('data-scale-h') + g[1]);
      event.preventDefault();
      return;
    }
    const step = event.shiftKey ? MOVE_STEP * 4 : MOVE_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) this.#move(this.num('data-x', 0) + move[0], this.num('data-y', 0) + move[1], event);
    else if (event.key === 'Enter' || event.key === ' ') this.emit('node-select');
    else return;
    event.preventDefault();
  };

  /** A press anywhere on it asks to select it; the click a drag ends with does not, nor a press of its drill-down. */
  #onClick = (event: MouseEvent): void => {
    const open = this.$('.open');
    if (open && event.composedPath().includes(open)) return;
    if (this.#dragged) {
      this.#dragged = false;
      return;
    }
    this.emit('node-select');
  };
}

define('sherpa-node', SherpaNode);
