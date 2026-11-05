/**
 * sherpa-layout-canvas — an infinite canvas content area that pans and zooms.
 *
 * A crosshair grid, a minimap, and four floating controls. Will, TODO 25.
 *
 * It OWNS its view — the pan and the zoom are its own, as a grid owns its
 * scroll — and REPORTS each move (`canvas-change`). The minimap is part of it:
 * a second element would be a second owner of one value.
 * TRAP T-a-canvas-owns-its-view
 */
import { SherpaElement, coerceNum, define } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';
import { boxMode, type BoxMode } from '../../core/ui/box-pick.js';
import { toolbarKeys } from '../../core/ui/roving-focus.js';

/** One press of Zoom in or Zoom out. */
const ZOOM_STEP = 1.25;
/** One arrow key's pan, in screen px; Shift pans four times as far. */
const PAN_STEP = 32;
/** What Fit leaves round the content, in screen px. */
const FIT_PADDING = 48;
/** How much of the minimap the content takes on its longer side: the rest is room for the frame. */
const MINIMAP_CONTENT = 0.5;
/** How far a press may move and still be a click, in screen px: a box drag is further. */
const BOX_SLOP = 4;

/** A box on the plane, in plane px. */
interface Box { left: number; top: number; right: number; bottom: number }

/** A press in progress: a pan from where the view was, or a box (its mode from the keys held). */
interface Drag { id: number; x: number; y: number; from: [number, number]; box: boolean; mode: BoxMode }

export class SherpaLayoutCanvas extends SherpaElement {
  static override css = new URL('./sherpa-layout-canvas.css', import.meta.url);
  static override html = new URL('./sherpa-layout-canvas.html', import.meta.url);

  static override props = {
    /* Written BY the canvas: the Pan tool is on. */
    /* Written BY the canvas, while a drag pans. */
    'data-no-minimap': { type: 'boolean', kind: 'style' },
    'data-select-box': { type: 'boolean', kind: 'style' },
    'data-zoom': { type: 'number', kind: 'behaviour' },
    'data-min-zoom': { type: 'number', kind: 'behaviour' },
    'data-max-zoom': { type: 'number', kind: 'behaviour' },
  } as const;
  static override observed = ['data-zoom'];

  /** The zoom, and its bounds — read by the code, so observed, not CSS props. */

  /** Where the plane's origin sits across the view, in screen px. */
  #x = 0;
  /** …and down it. */
  #y = 0;
  /** The zoom: 1 is 100%. */
  #zoom = 1;

  /** The drag in progress: where it started, and the view then. */
  #drag: Drag | null = null;

  /** Space is held: a left drag pans, for a canvas whose plain left drag draws a box. */
  #space = false;

  /** A minimap drag: the pointer, and where it took the view's frame. */
  #mapDrag: { id: number; grab: [number, number] } | null = null;

  /** Redraws the minimap when the canvas changes size. */
  #observer: ResizeObserver | null = null;

  /** Redraws the minimap when a piece of content moves. */
  #moves: MutationObserver | null = null;

  override onRender(): void {
    // TRAP T-a-toolbar-moves-by-arrow-and-keeps-its-tabs
    const controls = this.$('.controls');
    if (controls) toolbarKeys(controls);
    const viewport = this.$<HTMLElement>('.viewport');
    viewport?.addEventListener('wheel', this.#onWheel, { passive: false });
    viewport?.addEventListener('pointerdown', this.#onPointerDown);
    viewport?.addEventListener('keydown', this.#onKey);
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
      viewport?.addEventListener(type, this.#onPointer as EventListener);
    }
    this.$('.pan')?.addEventListener('button-click', this.#onPanTool);
    this.$('.zoom-in')?.addEventListener('button-click', () => this.zoomBy(ZOOM_STEP));
    this.$('.zoom-out')?.addEventListener('button-click', () => this.zoomBy(1 / ZOOM_STEP));
    this.$('.options')?.addEventListener('menu-select', this.#onOption);
    const minimap = this.$<HTMLElement>('.minimap');
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      minimap?.addEventListener(type, this.#onMinimap as EventListener);
    }
    this.$('slot:not([name])')?.addEventListener('slotchange', () => this.#drawMinimap());
    // A card in the `panel` slot takes the bottom left: the minimap moves out from under it.
    const panel = this.$<HTMLSlotElement>('slot[name="panel"]');
    panel?.addEventListener('slotchange', () => this.toggleState('has-panel', panel.assignedElements().length > 0));
    this.#zoom = this.#clamp(coerceNum(this.dataset['zoom'], 1));
    this.#apply(false);
  }

  override onConnect(): void {
    this.#observer = new ResizeObserver(() => this.#drawMinimap());
    this.#observer.observe(this);
    // Capture: a node's header takes Space for itself, and stops it.
    this.on(window, 'keydown', (event) => this.#onSpace(event as KeyboardEvent, true), { capture: true });
    this.on(window, 'keyup', (event) => this.#onSpace(event as KeyboardEvent, false), { capture: true });
    // A key pressed or let go mid-drag changes the marquee's mode at once.
    for (const type of ['keydown', 'keyup']) this.on(window, type, (event) => {
      if (this.#drag?.box && this.hasState('boxing')) this.$('.viewport')?.setAttribute('data-mode', this.#drag.mode = boxMode(event as KeyboardEvent));
    });
    this.on(window, 'blur', () => this.#onSpace(null, false));
    // A piece says where it sits in its own style; the canvas writes only its own.
    this.#moves = new MutationObserver((records) => {
      if (records.some((r) => r.target.parentElement === this)) this.#drawMinimap();
    });
    this.#moves.observe(this, { attributes: true, attributeFilter: ['style'], subtree: true });
  }

  override onDisconnect(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#moves?.disconnect();
    this.#moves = null;
  }

  override onChange(name: string, _old: string | null, value: string | null): void {
    // A HOST's zoom, not the one this canvas just wrote.
    if (name === 'data-zoom' && value != null && Number(value) !== SherpaLayoutCanvas.#round(this.#zoom)) {
      this.zoomTo(coerceNum(value, this.#zoom));
    } else if (name === 'data-no-minimap') {
      this.#drawMinimap();
    }
  }

  /** The view now: the plane origin's place in it, and the zoom. */
  get view(): { x: number; y: number; zoom: number } {
    return { x: this.#x, y: this.#y, zoom: this.#zoom };
  }

  /** Move the plane origin to (x, y) in the view, in screen px. */
  panTo(x: number, y: number): void {
    this.#x = x;
    this.#y = y;
    this.#apply();
  }

  /** Zoom to `zoom`, keeping the point at (cx, cy) in the view where it is —
   *  the view's middle unless given. */
  zoomTo(zoom: number, cx?: number, cy?: number): void {
    const next = this.#clamp(zoom);
    const { width, height } = this.#size();
    const px = cx ?? width / 2;
    const py = cy ?? height / 2;
    // The plane point under (px, py) stays under it.
    this.#x = px - ((px - this.#x) * next) / this.#zoom;
    this.#y = py - ((py - this.#y) * next) / this.#zoom;
    this.#zoom = next;
    this.#apply();
  }

  /** Zoom by a factor, about the view's middle. */
  zoomBy(factor: number): void {
    this.zoomTo(this.#zoom * factor);
  }

  /** Fit every piece of content in the view, no nearer than 100%. */
  fit(): void {
    const bounds = this.#contentBox();
    if (!bounds) return this.panTo(0, 0);
    const { width, height } = this.#size();
    const w = Math.max(1, bounds.right - bounds.left);
    const h = Math.max(1, bounds.bottom - bounds.top);
    const zoom = this.#clamp(Math.min(1, (width - FIT_PADDING * 2) / w, (height - FIT_PADDING * 2) / h));
    this.#zoom = zoom;
    this.#x = (width - w * zoom) / 2 - bounds.left * zoom;
    this.#y = (height - h * zoom) / 2 - bounds.top * zoom;
    this.#apply();
  }

  /** A zoom as the attribute says it. */
  static #round(zoom: number): number {
    return Math.round(zoom * 1000) / 1000;
  }

  /** How near and how far it may zoom. */
  #bounds(): [number, number] {
    return [coerceNum(this.dataset['minZoom'], 0.25), coerceNum(this.dataset['maxZoom'], 4)];
  }

  /** The zoom, inside its bounds. */
  #clamp(zoom: number): number {
    const [min, max] = this.#bounds();
    return Math.min(max, Math.max(min, Number.isFinite(zoom) ? zoom : 1));
  }

  /** The view's size. */
  #size(): { width: number; height: number } {
    const rect = this.$<HTMLElement>('.viewport')?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }

  /** Write the view where CSS reads it, redraw the minimap, and report. */
  #apply(report = true): void {
    this.style.setProperty('--_x', `${this.#x}px`);
    this.style.setProperty('--_y', `${this.#y}px`);
    this.style.setProperty('--_zoom', String(this.#zoom));
    this.set('data-zoom', String(SherpaLayoutCanvas.#round(this.#zoom)));
    const at = Math.round(this.#zoom * 100);
    this.$('.viewport')?.setAttribute('aria-label', `Canvas, ${at}%`);
    const [min, max] = this.#bounds();
    for (const [sel, off] of [['.zoom-in', this.#zoom >= max], ['.zoom-out', this.#zoom <= min]] as const) {
      this.$(sel)?.toggleAttribute('disabled', off);
    }
    this.#drawMinimap();
    if (report) this.emit('canvas-change', this.view);
  }

  /* ── Pointer, wheel and keys ──────────────────────────────────────────── */

  /** A wheel pans; with Ctrl or ⌘ — a trackpad's pinch — it zooms about the pointer. */
  #onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.zoomTo(this.#zoom * Math.exp(-event.deltaY * 0.01), event.clientX - rect.left, event.clientY - rect.top);
    } else {
      this.panTo(this.#x - event.deltaX, this.#y - event.deltaY);
    }
  };

  /** A drag pans with the Pan tool on, with Space held, or with the middle button. On blank canvas a plain
   *  left drag pans too — or, with `data-select-box`, draws a box and reports it. */
  #onPointerDown = (event: PointerEvent): void => {
    const blank = event.target === event.currentTarget;
    const pan = event.button === 1 || (event.button === 0 && (this.hasState('panning') || (this.#space && blank) || (blank && !this.hasAttribute('data-select-box'))));
    const box = !pan && event.button === 0 && blank;
    if (!pan && !box) return;
    event.preventDefault();
    this.#drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: [this.#x, this.#y], box, mode: boxMode(event) };
    // A synthetic pointer has nothing to capture.
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch { /* the drag still follows the pointer's own events */ }
    if (!box) this.toggleState('dragging', true);
  };

  /** Follow the drag, and end it: a pan moves the view; a box is drawn, and on release reported in plane px. */
  #onPointer = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.box) return this.#onBox(event, drag);
    if (event.type === 'pointermove') {
      this.panTo(drag.from[0] + event.clientX - drag.x, drag.from[1] + event.clientY - drag.y);
      return;
    }
    this.#drag = null;
    this.toggleState('dragging', false);
  };

  /** A box drag: the marquee follows the pointer; a release past a click's slop reports it. */
  #onBox(event: PointerEvent, drag: Drag): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const [left, right] = [Math.min(drag.x, event.clientX) - rect.left, Math.max(drag.x, event.clientX) - rect.left];
    const [top, bottom] = [Math.min(drag.y, event.clientY) - rect.top, Math.max(drag.y, event.clientY) - rect.top];
    const far = Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > BOX_SLOP;
    if (event.type === 'pointermove') {
      const marquee = this.$<HTMLElement>('.marquee');
      if (far && marquee) {
        this.toggleState('boxing', true);
        this.$('.viewport')?.setAttribute('data-mode', drag.mode = boxMode(event));
        Object.assign(marquee.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
      }
      return;
    }
    this.#drag = null;
    this.toggleState('boxing', false);
    this.$('.viewport')?.removeAttribute('data-mode');
    if (event.type !== 'pointerup' || !far) return;
    const plane = (px: number, py: number): [number, number] => [(px - this.#x) / this.#zoom, (py - this.#y) / this.#zoom];
    const [a, b] = [plane(left, top), plane(right, bottom)];
    this.emit('canvas-box', { left: a[0], top: a[1], right: b[0], bottom: b[1], mode: boxMode(event) });
  }

  /** Space held: a left drag pans. Not while typing or on a button. */
  #onSpace(event: KeyboardEvent | null, down: boolean): void {
    if (event && event.key !== ' ') return;
    const first = event?.composedPath()[0];
    if (down && first instanceof Element && first.matches('input, select, textarea, [contenteditable], button, a')) return;
    // Space on the canvas itself must not scroll the page.
    if (down && first === this.$('.viewport')) event?.preventDefault();
    this.#space = down;
    this.toggleState('pan-ready', down);
  }

  /** The arrows pan; + and - zoom; 0 is 100%. Content keeps its own keys. */
  #onKey = (event: KeyboardEvent): void => {
    if (event.target !== event.currentTarget) return;
    const step = event.shiftKey ? PAN_STEP * 4 : PAN_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (move) this.panTo(this.#x + move[0], this.#y + move[1]);
    else if (event.key === '+' || event.key === '=') this.zoomBy(ZOOM_STEP);
    else if (event.key === '-' || event.key === '_') this.zoomBy(1 / ZOOM_STEP);
    else if (event.key === '0') this.zoomTo(1);
    else return;
    event.preventDefault();
  };

  /** The Pan tool: on, a drag anywhere moves the view. */
  #onPanTool = (): void => {
    const on = !this.hasState('panning');
    this.toggleState('panning', on);
    this.$('.pan')?.setAttribute('aria-pressed', String(on));
  };

  /** Fit, 100%, or the minimap on or off. */
  #onOption = (event: Event): void => {
    const value = (event as CustomEvent).detail?.value;
    if (value === 'fit') this.fit();
    else if (value === 'actual') this.zoomTo(1);
    else if (value === 'minimap') this.toggleAttribute('data-no-minimap');
  };

  /* ── The minimap ──────────────────────────────────────────────────────── */

  /** Every piece of content's box on the plane, and the box round them all. */
  #boxes(): Box[] {
    // The content's own slot: the banners' comes first in the template.
    const slot = this.$<HTMLSlotElement>('slot:not([name])');
    return (slot?.assignedElements() ?? []).filter((el): el is HTMLElement => el instanceof HTMLElement)
      .map((el) => ({ left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight }));
  }

  /** The box round every piece of content, or null for none. */
  #contentBox(): Box | null {
    const boxes = this.#boxes();
    if (!boxes.length) return null;
    return boxes.reduce((a, b) => ({
      left: Math.min(a.left, b.left), top: Math.min(a.top, b.top),
      right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom),
    }));
  }

  /** The view's box on the plane. */
  #viewBox(): Box {
    const { width, height } = this.#size();
    const left = -this.#x / this.#zoom;
    const top = -this.#y / this.#zoom;
    return { left, top, right: left + width / this.#zoom, bottom: top + height / this.#zoom };
  }

  /** How the minimap maps the plane: the box it shows — all of it — and its scale. It
   *  follows the CONTENT, never the view, so a zoom resizes the frame and the content holds still. */
  #minimapScale(): { box: Box; scale: number } | null {
    const map = this.$<HTMLElement>('.minimap');
    if (!map || this.hasAttribute('data-no-minimap')) return null;
    const around = this.#contentBox() ?? this.#viewBox();
    const w = Math.max(1, around.right - around.left);
    const h = Math.max(1, around.bottom - around.top);
    const scale = MINIMAP_CONTENT * Math.min(map.clientWidth / w, map.clientHeight / h);
    if (!Number.isFinite(scale) || scale <= 0) return null;
    // The content in the middle of the map.
    const left = around.left + (w - map.clientWidth / scale) / 2;
    const top = around.top + (h - map.clientHeight / scale) / 2;
    return { box: { left, top, right: left + map.clientWidth / scale, bottom: top + map.clientHeight / scale }, scale };
  }

  /** Draw the content and the view, small. */
  #drawMinimap(): void {
    const items = this.$('.minimap-items');
    const viewEl = this.$<HTMLElement>('.minimap-view');
    const mapped = this.#minimapScale();
    if (!items || !viewEl || !mapped) return;
    const { box, scale } = mapped;
    const place = (el: HTMLElement, b: Box): void => {
      el.style.left = `${(b.left - box.left) * scale}px`;
      el.style.top = `${(b.top - box.top) * scale}px`;
      el.style.width = `${(b.right - b.left) * scale}px`;
      el.style.height = `${(b.bottom - b.top) * scale}px`;
    };
    items.replaceChildren(...this.#boxes().map((b) => {
      const item = this.clone<HTMLElement>('template.minimap-item-tpl')!;
      place(item, b);
      return item;
    }));
    place(viewEl, this.#viewBox());
  }

  /** A press puts the view's middle there; a drag on the frame keeps its hold. Either
   *  stops at the minimap's edge — or, for a frame larger than the map, keeps it covered. */
  #onMinimap = (event: PointerEvent): void => {
    const mapped = this.#minimapScale();
    if (!mapped) return;
    if (event.type === 'pointerdown') {
      if (event.button !== 0) return;
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch { /* a synthetic pointer */ }
      const view = this.#viewBox();
      const at = this.#onMap(event, mapped);
      const inFrame = at[0] >= view.left && at[0] <= view.right && at[1] >= view.top && at[1] <= view.bottom;
      const grab: [number, number] = inFrame
        ? [at[0] - view.left, at[1] - view.top]
        : [(view.right - view.left) / 2, (view.bottom - view.top) / 2];
      this.#mapDrag = { id: event.pointerId, grab };
    }
    const drag = this.#mapDrag;
    if (!drag || event.pointerId !== drag.id) return;
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      this.#mapDrag = null;
      this.#drawMinimap();
      return;
    }
    const at = this.#onMap(event, mapped);
    const view = this.#viewBox();
    const { box } = mapped;
    // Between the map's two edges, whichever way round the frame's size puts them.
    const keep = (want: number, start: number, end: number, size: number): number =>
      Math.min(Math.max(want, Math.min(start, end - size)), Math.max(start, end - size));
    const left = keep(at[0] - drag.grab[0], box.left, box.right, view.right - view.left);
    const top = keep(at[1] - drag.grab[1], box.top, box.bottom, view.bottom - view.top);
    this.panTo(-left * this.#zoom, -top * this.#zoom);
  };

  /** Where a pointer on the minimap is, on the plane. */
  #onMap(event: PointerEvent, mapped: { box: Box; scale: number }): [number, number] {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return [
      mapped.box.left + (event.clientX - rect.left) / mapped.scale,
      mapped.box.top + (event.clientY - rect.top) / mapped.scale,
    ];
  }
}

define('sherpa-layout-canvas', SherpaLayoutCanvas);
