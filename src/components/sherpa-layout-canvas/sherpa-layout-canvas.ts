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
import { SherpaElement, coerceNum } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';

/** One press of Zoom in or Zoom out. */
const ZOOM_STEP = 1.25;
/** One arrow key's pan, in screen px; Shift pans four times as far. */
const PAN_STEP = 32;
/** What Fit leaves round the content, in screen px. */
const FIT_PADDING = 48;

/** A box on the plane, in plane px. */
interface Box { left: number; top: number; right: number; bottom: number }

export class SherpaLayoutCanvas extends SherpaElement {
  static override css = new URL('./sherpa-layout-canvas.css', import.meta.url);
  static override html = new URL('./sherpa-layout-canvas.html', import.meta.url);

  static override props = {
    /* Written BY the canvas: the Pan tool is on. */
    'data-panning': { type: 'boolean', kind: 'style' },
    /* Written BY the canvas, while a drag pans. */
    'data-dragging': { type: 'boolean', kind: 'style' },
    'data-no-minimap': { type: 'boolean', kind: 'style' },
  } as const;

  /** The zoom, and its bounds — read by the code, so observed, not CSS props. */
  static override observed = ['data-zoom', 'data-min-zoom', 'data-max-zoom'];

  /** Where the plane's origin sits across the view, in screen px. */
  #x = 0;
  /** …and down it. */
  #y = 0;
  /** The zoom: 1 is 100%. */
  #zoom = 1;

  /** The drag in progress: where it started, and the view then. */
  #drag: { id: number; x: number; y: number; from: [number, number] } | null = null;

  /** Redraws the minimap when the canvas changes size. */
  #observer: ResizeObserver | null = null;

  override onRender(): void {
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
    minimap?.addEventListener('pointerdown', this.#onMinimap);
    minimap?.addEventListener('pointermove', this.#onMinimap);
    this.$('slot')?.addEventListener('slotchange', () => this.#drawMinimap());
    this.#zoom = this.#clamp(coerceNum(this.dataset['zoom'], 1));
    this.#apply(false);
  }

  override onConnect(): void {
    this.#observer = new ResizeObserver(() => this.#drawMinimap());
    this.#observer.observe(this);
  }

  override onDisconnect(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  override onChange(name: string, _old: string | null, value: string | null): void {
    // A HOST's zoom, not the one this canvas just wrote.
    if (name === 'data-zoom' && value != null && Number(value) !== SherpaLayoutCanvas.#round(this.#zoom)) {
      this.zoomTo(coerceNum(value, this.#zoom));
    } else if (name === 'data-no-minimap') {
      this.#syncMinimapToggle();
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
    this.dataset['zoom'] = String(SherpaLayoutCanvas.#round(this.#zoom));
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

  /** A drag pans with the Pan tool on, or with the middle button. */
  #onPointerDown = (event: PointerEvent): void => {
    const onContent = event.target !== event.currentTarget && !this.hasAttribute('data-panning');
    if (event.button === 1 || (event.button === 0 && !onContent)) {
      event.preventDefault();
      this.#drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: [this.#x, this.#y] };
      // A synthetic pointer has nothing to capture.
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch { /* the drag still follows the pointer's own events */ }
      this.toggleAttribute('data-dragging', true);
    }
  };

  /** Follow the drag, and end it. */
  #onPointer = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.id) return;
    if (event.type === 'pointermove') {
      this.panTo(drag.from[0] + event.clientX - drag.x, drag.from[1] + event.clientY - drag.y);
      return;
    }
    this.#drag = null;
    this.removeAttribute('data-dragging');
  };

  /** The arrows pan; + and - zoom; 0 is 100%. */
  #onKey = (event: KeyboardEvent): void => {
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
    const on = !this.hasAttribute('data-panning');
    this.toggleAttribute('data-panning', on);
    this.$('.pan')?.setAttribute('aria-pressed', String(on));
  };

  /** Fit, 100%, or the minimap on or off. */
  #onOption = (event: Event): void => {
    const value = (event as CustomEvent).detail?.value;
    if (value === 'fit') this.fit();
    else if (value === 'actual') this.zoomTo(1);
    else if (value === 'minimap') this.toggleAttribute('data-no-minimap');
  };

  /** Its row says what it will do. */
  #syncMinimapToggle(): void {
    const row = this.$('.minimap-toggle');
    if (row) row.textContent = this.hasAttribute('data-no-minimap') ? 'Show minimap' : 'Hide minimap';
  }

  /* ── The minimap ──────────────────────────────────────────────────────── */

  /** Every piece of content's box on the plane, and the box round them all. */
  #boxes(): Box[] {
    const slot = this.$<HTMLSlotElement>('slot');
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

  /** How the minimap maps the plane: the box it shows and its scale. */
  #minimapScale(): { box: Box; scale: number } | null {
    const map = this.$<HTMLElement>('.minimap');
    if (!map || this.hasAttribute('data-no-minimap')) return null;
    const content = this.#contentBox();
    const view = this.#viewBox();
    const box = content ? {
      left: Math.min(content.left, view.left), top: Math.min(content.top, view.top),
      right: Math.max(content.right, view.right), bottom: Math.max(content.bottom, view.bottom),
    } : view;
    const scale = Math.min(map.clientWidth / Math.max(1, box.right - box.left), map.clientHeight / Math.max(1, box.bottom - box.top));
    return Number.isFinite(scale) && scale > 0 ? { box, scale } : null;
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

  /** A press or a drag on the minimap puts the view's middle there. */
  #onMinimap = (event: PointerEvent): void => {
    if (event.type === 'pointermove' && !(event.buttons & 1)) return;
    const mapped = this.#minimapScale();
    if (!mapped) return;
    if (event.type === 'pointerdown') {
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch { /* a synthetic pointer */ }
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const px = mapped.box.left + (event.clientX - rect.left) / mapped.scale;
    const py = mapped.box.top + (event.clientY - rect.top) / mapped.scale;
    const { width, height } = this.#size();
    this.panTo(width / 2 - px * this.#zoom, height / 2 - py * this.#zoom);
  };
}

customElements.define('sherpa-layout-canvas', SherpaLayoutCanvas);
