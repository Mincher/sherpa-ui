/**
 * sherpa-canvas — a plane its slotted elements lay out on; with `data-drawn`, where the engine draws HTML in a canvas
 * (Chrome 157 on), a REAL <canvas> they are drawn into. Its view is its attributes. Will, 2026-11-11 (plan 852: A, plain
 * unless a page asks) · TRAP T-a-canvas-draws-live-html
 *
 * Map:
 * - drawsHtml — Whether this engine draws HTML in a canvas: one given `content="drawable"` reads it back.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

/** How far an element's drawing reaches past its own box, each way: what overhangs it — a node's socket tabs (one track,
 *  24px; a big socket's more), a fork's True and False, its caption. Drawn wider than that costs next to nothing. */
const OVERHANG = 64;

/** A canvas that draws HTML: the API as Chrome 157 ships it. */
type DrawingCanvas = HTMLCanvasElement & { content?: string; requestPaint(): void };
type DrawingContext = CanvasRenderingContext2D & {
  drawElementImage(el: Element, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
};

let draws: boolean | undefined;
/** Whether this engine draws HTML in a canvas: one given `content="drawable"` reads it back. */
export function drawsHtml(): boolean {
  if (draws === undefined) {
    const probe = document.createElement('canvas') as DrawingCanvas;
    probe.setAttribute('content', 'drawable');
    draws = probe.content === 'drawable' && 'drawElementImage' in CanvasRenderingContext2D.prototype;
  }
  return draws;
}

/** A plain layer the view moves; or, asked and where the engine can, a real canvas its content is drawn into. */
export class SherpaCanvas extends SherpaElement {
  static override css = new URL('./sherpa-canvas.css', import.meta.url);
  static override html = new URL('./sherpa-canvas.html', import.meta.url);

  static override props = {
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-y': { type: 'number', kind: 'behaviour' },
    'data-zoom': { type: 'number', kind: 'behaviour' },
    // Asked for, not the default: measured at 2,000 nodes, drawn is slower to pan, zoom and drag (plan 852, step 6).
    'data-drawn': { type: 'boolean', kind: 'template' },
    // A view change eases, on the plain layer: its host's step zoom. TODO 896
    'data-ease': { type: 'boolean', kind: 'style' },
  } as const;
  static override observed = ['data-x', 'data-y', 'data-zoom'];
  static override variantAttrs = ['data-drawn'];

  /** Drawn when asked, where the engine can; else plain. Named both ways, so a change either way re-stamps. */
  protected override get templateId(): string | null {
    return this.hasAttribute('data-drawn') && drawsHtml() ? 'drawn' : 'default';
  }

  /** The canvas's 2D context, drawn mode only. */
  #ctx: DrawingContext | null = null;
  /** Watches each slotted element's style: one moved where no paint event sees it (it was not drawn) is drawn again. */
  #moves: MutationObserver | null = null;
  /** Watches the canvas's size in device pixels. */
  #sizes: ResizeObserver | null = null;

  override onRender(): void {
    const canvas = this.#canvas();
    // Re-stamped either way: what watched the last canvas stops, and nothing stays drawable for a canvas gone.
    this.#moves?.disconnect();
    this.#sizes?.disconnect();
    this.#ctx = null;
    if (!canvas) for (const el of this.#items()) el.removeAttribute('drawable');
    if (canvas) {
      this.#ctx = canvas.getContext('2d') as DrawingContext | null;
      this.on(canvas, 'paint', this.#draw);
      // Its grid in device pixels: sharp at any ratio, and set again as it is resized.
      this.#sizes = new ResizeObserver(([entry]) => {
        const box = entry?.devicePixelContentBoxSize?.[0];
        const [w, h] = box ? [box.inlineSize, box.blockSize] : [Math.round(canvas.clientWidth * devicePixelRatio), Math.round(canvas.clientHeight * devicePixelRatio)];
        if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
        canvas.requestPaint();
      });
      this.#sizes.observe(canvas, { box: 'device-pixel-content-box' });
      this.#moves = new MutationObserver(() => canvas.requestPaint());
      this.$('slot')?.addEventListener('slotchange', () => this.#watch());
      this.#watch();
    }
    this.#view();
  }

  override onChange(): void {
    this.#view();
  }

  protected override onDisconnect(): void {
    this.#moves?.disconnect();
    this.#sizes?.disconnect();
  }

  /** Draw again, next frame: something the canvas cannot see moved. */
  paint(): void {
    this.#canvas()?.requestPaint();
  }

  /** The real canvas, drawn mode only. */
  #canvas(): DrawingCanvas | null {
    return this.$<DrawingCanvas>('canvas.surface');
  }

  /** What it draws: every element slotted in, through any slot that forwards it, in order — an SVG too. */
  #items(): Element[] {
    return this.$<HTMLSlotElement>('slot')?.assignedElements({ flatten: true }) ?? [];
  }

  /** Watch each element it draws for a move. */
  #watch(): void {
    this.#moves?.disconnect();
    for (const el of this.#items()) this.#moves?.observe(el, { attributes: true, attributeFilter: ['style'] });
  }

  /** The view: a CSS transform on the plain layer; on the canvas, a paint. */
  #view(): void {
    const canvas = this.#canvas();
    if (canvas) return canvas.requestPaint();
    const surface = this.$<HTMLElement>('.surface');
    if (surface) surface.style.transform = `translate(${this.num('data-x', 0)}px, ${this.num('data-y', 0)}px) scale(${this.num('data-zoom', 1)})`;
  }

  /**
   * Each element the view shows, drawn at its place through the view, with what overhangs it; the rest is not `drawable` —
   * each one that is costs every paint, drawn or not. Inside the canvas an element lays out in FLOW (`position` computes
   * to static), so its place is its resolved `left` and `top`, never its layout box. TRAP T-a-canvas-draws-live-html
   */
  #draw = (): void => {
    const canvas = this.#canvas();
    const ctx = this.#ctx;
    if (!canvas || !ctx) return;
    const [x, y, zoom] = [this.num('data-x', 0), this.num('data-y', 0), this.num('data-zoom', 1)];
    const k = canvas.clientWidth ? canvas.width / canvas.clientWidth : devicePixelRatio;
    const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
    // EVERY box read first: a draw dirties layout, so a read after one lays the whole canvas out again (16 layouts a pan
    // step at 2,000 nodes, 2026-11-11).
    const items = this.#items().map((el) => {
      const style = getComputedStyle(el);
      const [left, top] = [parseFloat(style.left) || 0, parseFloat(style.top) || 0];
      // Its own box: an SVG has no offset size, only its CSS box.
      const [w, h] = el instanceof HTMLElement ? [el.offsetWidth, el.offsetHeight] : [el.clientWidth, el.clientHeight];
      const seen = (left - OVERHANG) * zoom + x < vw && (top - OVERHANG) * zoom + y < vh
        && (left + w + OVERHANG) * zoom + x > 0 && (top + h + OVERHANG) * zoom + y > 0;
      return { el, left, top, w, h, seen };
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k * zoom, 0, 0, k * zoom, k * x, k * y);
    let again = false;
    for (const { el, left, top, w, h, seen } of items) {
      if (!seen || !el.hasAttribute('drawable')) continue;
      try {
        const [sw, sh] = [w + 2 * OVERHANG, h + 2 * OVERHANG];
        ctx.drawElementImage(el, -OVERHANG, -OVERHANG, sw, sh, left - OVERHANG, top - OVERHANG, sw, sh);
      } catch {
        again = true;
      }
    }
    // Then the writes: what the view shows is drawable, the rest not. One newly drawable has no snapshot until the next paint.
    for (const { el, seen } of items) {
      if (seen === el.hasAttribute('drawable')) continue;
      el.toggleAttribute('drawable', seen);
      again ||= seen;
    }
    if (again) canvas.requestPaint();
  };
}

define('sherpa-canvas', SherpaCanvas);
