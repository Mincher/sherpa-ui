/**
 * sherpa-layout-canvas — an infinite canvas content area that pans and zooms.
 *
 * A crosshair grid, a minimap, and four floating controls. Will, TODO 25.
 *
 * It OWNS its view — the pan and the zoom are its own, as a grid owns its
 * scroll — and REPORTS each move (`canvas-change`). The minimap is part of it:
 * a second element would be a second owner of one value.
 * TRAP T-a-canvas-owns-its-view
 * Its card docks in a panel area. TRAP T-a-panel-area-is-a-layout
 */
import { SherpaElement, coerceNum, define } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-layout-panels/sherpa-layout-panels.js';
import { boxMode, type BoxMode } from '../../core/ui/box-pick.js';
import { toolbarKeys } from '../../core/ui/roving-focus.js';
import { keepOrder } from '../../core/ui/keep-order.js';

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
    'data-editing': { type: 'boolean', kind: 'style' },
    'data-zoom': { type: 'number', kind: 'behaviour' },
    'data-min-zoom': { type: 'number', kind: 'behaviour' },
    'data-max-zoom': { type: 'number', kind: 'behaviour' },
    // The card's area's width, handed back by the host. TRAP T-an-edge-resizes-its-box
    'data-panel-start-width': { type: 'number', kind: 'behaviour' },
    'data-panel-end-width': { type: 'number', kind: 'behaviour' },
  } as const;
  static override observed = ['data-zoom', 'data-panel-start-width', 'data-panel-end-width'];

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
  /** Each piece's box and the box round them, measured once: a piece added, moved or resized measures again. A pan or a
   *  zoom never does — a measure is a layout, and a pan step that forced one cost 35ms on 45 nodes (2026-11-10). */
  #measured: { boxes: Box[]; box: Box | null } | null = null;
  /** What the view shows: measured again only when the canvas or its card is resized. */
  #seenBox: { left: number; top: number; width: number; height: number } | null = null;
  /** The minimap's size: measured again only when the canvas is resized. */
  #mapSize: { w: number; h: number } | null = null;
  /** Watches each piece's size: a node collapsed or grown measures again. */
  #pieces: ResizeObserver | null = null;

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
    this.$('slot:not([name])')?.addEventListener('slotchange', () => { this.#watchPieces(); this.#remeasure(); });
    // The card's area: its width in, and its resize reported as the canvas's own.
    const panels = this.$('.panels');
    this.mirrorAttrs(panels!, ['data-panel-start-width', 'data-panel-end-width']);
    panels?.addEventListener('panel-area-resize', this.#onAreaResize);
    panels?.addEventListener('panel-dock', this.#onDock);
    this.#zoom = this.#clamp(coerceNum(this.dataset['zoom'], 1));
    this.#apply(false);
  }

  override onConnect(): void {
    // The canvas, and what its view shows: the card docks, floats or is resized.
    this.#observer = new ResizeObserver(() => {
      this.#seenBox = null;
      this.#mapSize = null;
      this.#syncSeen();
      this.#drawMinimap();
    });
    this.#observer.observe(this);
    const stage = this.$('.stage');
    if (stage) this.#observer.observe(stage);
    // Capture: a node's header takes Space for itself, and stops it.
    this.on(window, 'keydown', (event) => this.#onSpace(event as KeyboardEvent, true), { capture: true });
    this.on(window, 'keyup', (event) => this.#onSpace(event as KeyboardEvent, false), { capture: true });
    // A key pressed or let go mid-drag changes the marquee's mode at once.
    for (const type of ['keydown', 'keyup']) this.on(window, type, (event) => {
      if (this.#drag?.box && this.hasState('boxing')) this.$('.viewport')?.setAttribute('data-mode', this.#drag.mode = boxMode(event as KeyboardEvent));
    });
    this.on(window, 'blur', () => this.#onSpace(null, false));
    // A piece says where it sits in its own style; the canvas writes only its own.
    // Only a piece's: a column or a row (a stage, a lane) is no content.
    this.#moves = new MutationObserver((records) => {
      if (records.some((r) => r.target.parentElement === this && !(r.target as Element).slot)) this.#remeasure();
    });
    this.#moves.observe(this, { attributes: true, attributeFilter: ['style'], subtree: true });
    this.#watchPieces();
  }

  override onDisconnect(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#moves?.disconnect();
    this.#moves = null;
    this.#pieces?.disconnect();
    this.#pieces = null;
  }

  override onChange(name: string, _old: string | null, value: string | null): void {
    // A HOST's zoom, not the one this canvas just wrote.
    if (name === 'data-zoom' && value != null && Number(value) !== SherpaLayoutCanvas.#round(this.#zoom)) {
      this.zoomTo(coerceNum(value, this.#zoom));
    } else if (name === 'data-no-minimap') {
      this.#mapSize = null;
      this.#drawMinimap();
    } else if (name === 'data-panel-start-width' || name === 'data-panel-end-width') {
      const panels = this.$('.panels');
      if (panels) this.mirrorAttrs(panels, ['data-panel-start-width', 'data-panel-end-width']);
    }
  }

  /** Where what the view shows begins, for the toolbar; and whether a card is docked beside it. */
  #syncSeen(): void {
    const start = Math.round(this.#seen().left);
    this.style.setProperty('--_seen-start', `${start}px`);
    this.toggleState('beside', start > 0);
  }

  /** A dragged panel was dropped on a lit area and docked: the canvas's own report, and the layout's goes no further. */
  #onDock = (event: Event): void => {
    event.stopPropagation();
    this.emit('panel-dock', (event as CustomEvent<{ side: 'start' | 'end'; place: 'top' | 'bottom' | 'only' }>).detail);
  };

  /** The card's area was resized: the canvas's own report; the layout's goes no further. */
  #onAreaResize = (event: Event): void => {
    event.stopPropagation();
    this.emit('panel-area-resize', (event as CustomEvent<{ side: 'start' | 'end'; width: number }>).detail);
  };

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
    const seen = this.#seen();
    const px = cx ?? seen.left + seen.width / 2;
    const py = cy ?? seen.top + seen.height / 2;
    // The plane point under (px, py) stays under it.
    this.#x = px - ((px - this.#x) * next) / this.#zoom;
    this.#y = py - ((py - this.#y) * next) / this.#zoom;
    this.#zoom = next;
    this.#apply();
  }

  /** Zoom by a factor, about the middle of what the view shows. */
  zoomBy(factor: number): void {
    this.zoomTo(this.#zoom * factor);
  }

  /** Fit every piece of content in what the view shows, beside the card; no nearer than 100%. */
  fit(): void {
    const bounds = this.#contentBox();
    const seen = this.#seen();
    if (!bounds) return this.panTo(seen.left, seen.top);
    const w = Math.max(1, bounds.right - bounds.left);
    const h = Math.max(1, bounds.bottom - bounds.top);
    const zoom = this.#clamp(Math.min(1, (seen.width - FIT_PADDING * 2) / w, (seen.height - FIT_PADDING * 2) / h));
    this.#zoom = zoom;
    this.#x = seen.left + (seen.width - w * zoom) / 2 - bounds.left * zoom;
    this.#y = seen.top + (seen.height - h * zoom) / 2 - bounds.top * zoom;
    this.#apply();
  }

  /** A zoom as the attribute says it. */
  static #round(zoom: number): number {
    return Math.round(zoom * 1000) / 1000;
  }

  /** How near and how far it may zoom: out, never short of ALL the content in view (Will, 2026-11-10). */
  #bounds(): [number, number] {
    const min = coerceNum(this.dataset['minZoom'], 0.25);
    const fit = this.#fitZoom();
    return [fit === null ? min : Math.min(min, fit), coerceNum(this.dataset['maxZoom'], 4)];
  }

  /** The zoom that shows all the content in what the view shows, its padding round it; none with no content. */
  #fitZoom(): number | null {
    const box = this.#contentBox();
    const seen = this.#seen();
    if (!box || !seen.width || !seen.height) return null;
    const [w, h] = [Math.max(1, box.right - box.left), Math.max(1, box.bottom - box.top)];
    return Math.max(0.01, Math.min((seen.width - FIT_PADDING * 2) / w, (seen.height - FIT_PADDING * 2) / h));
  }

  /** The zoom, inside its bounds. */
  #clamp(zoom: number): number {
    const [min, max] = this.#bounds();
    return Math.min(max, Math.max(min, Number.isFinite(zoom) ? zoom : 1));
  }

  /** What the view SHOWS: the stage beside the card, in the view's px. The view runs under the card. */
  #seen(): { left: number; top: number; width: number; height: number } {
    if (this.#seenBox) return this.#seenBox;
    const view = this.$<HTMLElement>('.viewport')?.getBoundingClientRect();
    const stage = this.$<HTMLElement>('.stage')?.getBoundingClientRect() ?? view;
    if (!view || !stage) return { left: 0, top: 0, width: 0, height: 0 };
    const seen = { left: stage.left - view.left, top: stage.top - view.top, width: stage.width, height: stage.height };
    // Kept once it is laid out: a resize lets it go.
    if (seen.width && seen.height) this.#seenBox = seen;
    return seen;
  }

  /** The zoom the plane last took: a pan leaves the nodes' styles alone. */
  #planeZoom: number | null = null;

  /** Write the view where CSS reads it — only on the layers that draw by it — redraw the minimap's frame, and report. */
  #apply(report = true): void {
    for (const layer of this.$$<HTMLElement>('.grid, .columns, .rows')) {
      layer.style.setProperty('--_x', `${this.#x}px`);
      layer.style.setProperty('--_y', `${this.#y}px`);
      layer.style.setProperty('--_zoom', String(this.#zoom));
    }
    const plane = this.$<HTMLElement>('.plane');
    if (plane) {
      plane.style.transform = `translate(${this.#x}px, ${this.#y}px) scale(${this.#zoom})`;
      if (this.#planeZoom !== this.#zoom) plane.style.setProperty('--_zoom', String((this.#planeZoom = this.#zoom)));
    }
    this.set('data-zoom', String(SherpaLayoutCanvas.#round(this.#zoom)));
    const at = Math.round(this.#zoom * 100);
    this.$('.viewport')?.setAttribute('aria-label', `Canvas, ${at}%`);
    const [min, max] = this.#bounds();
    for (const [sel, off] of [['.zoom-in', this.#zoom >= max], ['.zoom-out', this.#zoom <= min]] as const) {
      this.$(sel)?.toggleAttribute('disabled', off);
    }
    // A pan or a zoom moves only the view's frame on the minimap: the content holds still there.
    this.#drawMinimapView();
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
    return this.#measure().boxes;
  }

  /** The box round every piece of content, or null for none. */
  #contentBox(): Box | null {
    return this.#measure().box;
  }

  /** Every piece's box, and the box round them: measured once, kept till a piece is added, moved or resized. */
  #measure(): { boxes: Box[]; box: Box | null } {
    if (this.#measured) return this.#measured;
    // The content's own slot: the banners' comes first in the template.
    const boxes = this.#pieceEls().map((el) => ({ left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight }));
    const box = boxes.length ? boxes.reduce((a, b) => ({
      left: Math.min(a.left, b.left), top: Math.min(a.top, b.top),
      right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom),
    })) : null;
    return (this.#measured = { boxes, box });
  }

  /** The pieces: what the content's own slot holds. */
  #pieceEls(): HTMLElement[] {
    return (this.$<HTMLSlotElement>('slot:not([name])')?.assignedElements() ?? []).filter((el): el is HTMLElement => el instanceof HTMLElement);
  }

  /** Watch each piece's size: one collapsed or grown is measured again. */
  #watchPieces(): void {
    this.#pieces?.disconnect();
    this.#pieces ??= new ResizeObserver(() => this.#remeasure());
    for (const el of this.#pieceEls()) this.#pieces.observe(el);
  }

  /** A piece was added, moved or resized: measure again, and draw the minimap from it — once a frame, however many moved:
   *  a drag moves a piece each pointer move, and a measure then is a forced layout. */
  #remeasure(): void {
    this.#measured = null;
    if (this.#minimapQueued) return;
    this.#minimapQueued = true;
    requestAnimationFrame(() => {
      this.#minimapQueued = false;
      this.#drawMinimap();
    });
  }
  /** A minimap draw waits for the next frame. */
  #minimapQueued = false;

  /** What the view shows, as a box on the plane. */
  #viewBox(): Box {
    const seen = this.#seen();
    const left = (seen.left - this.#x) / this.#zoom;
    const top = (seen.top - this.#y) / this.#zoom;
    return { left, top, right: left + seen.width / this.#zoom, bottom: top + seen.height / this.#zoom };
  }

  /** How the minimap maps the plane: the box it shows — all of it — and its scale. It
   *  follows the CONTENT, never the view, so a zoom resizes the frame and the content holds still. */
  #minimapScale(): { box: Box; scale: number } | null {
    const map = this.$<HTMLElement>('.minimap');
    if (!map || this.hasAttribute('data-no-minimap')) return null;
    const around = this.#contentBox() ?? this.#viewBox();
    const w = Math.max(1, around.right - around.left);
    const h = Math.max(1, around.bottom - around.top);
    // Its size, kept: it changes only as the canvas does.
    const size = this.#mapSize ?? { w: map.clientWidth, h: map.clientHeight };
    if (size.w && size.h) this.#mapSize = size;
    const scale = MINIMAP_CONTENT * Math.min(size.w / w, size.h / h);
    if (!Number.isFinite(scale) || scale <= 0) return null;
    // The content in the middle of the map.
    const left = around.left + (w - size.w / scale) / 2;
    const top = around.top + (h - size.h / scale) / 2;
    return { box: { left, top, right: left + size.w / scale, bottom: top + size.h / scale }, scale };
  }

  /** Draw the content and the view, small. */
  #drawMinimap(): void {
    const items = this.$('.minimap-items');
    const viewEl = this.$<HTMLElement>('.minimap-view');
    const mapped = this.#minimapScale();
    if (!items || !viewEl || !mapped) return;
    const place = (el: HTMLElement, b: Box): void => this.#onMapAt(el, b, mapped);
    // The items drawn last time take the new boxes: one taken out and put back is a layout again. TRAP T-a-redraw-keeps-what-it-can
    const had = [...items.children] as HTMLElement[];
    keepOrder(items, this.#boxes().map((b, i) => {
      const item = had[i] ?? this.clone<HTMLElement>('template.minimap-item-tpl')!;
      place(item, b);
      return item;
    }), true);
    place(viewEl, this.#viewBox());
  }

  /** The view's frame on the minimap, alone: a pan or a zoom moves it, and the content holds still. */
  #drawMinimapView(): void {
    const viewEl = this.$<HTMLElement>('.minimap-view');
    const mapped = this.#minimapScale();
    if (!viewEl || !mapped) return;
    this.#onMapAt(viewEl, this.#viewBox(), mapped);
  }

  /** Place one item on the minimap: a box on the plane, scaled. Only a value that changed is written — the same one
   *  written again is a restyle. */
  #onMapAt(el: HTMLElement, b: Box, { box, scale }: { box: Box; scale: number }): void {
    const px = (v: number): string => `${Math.round(v * 100) / 100}px`;
    const at = { left: px((b.left - box.left) * scale), top: px((b.top - box.top) * scale), width: px((b.right - b.left) * scale), height: px((b.bottom - b.top) * scale) };
    for (const [k, v] of Object.entries(at) as [keyof typeof at, string][]) if (el.style[k] !== v) el.style[k] = v;
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
    const seen = this.#seen();
    this.panTo(seen.left - left * this.#zoom, seen.top - top * this.#zoom);
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
