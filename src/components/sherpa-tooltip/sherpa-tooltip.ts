/**
 * sherpa-tooltip — a hint bubble shown on hover or focus.
 *
 * The bubble is a popover, opened on hover or focus and placed from measured
 * coordinates, so no box it sits in clips it. TRAP T-a-tooltip-is-always-in-the-top-layer
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

let uid = 0;

type Side = 'top' | 'bottom' | 'left' | 'right';
const SIDES: readonly Side[] = ['top', 'bottom', 'left', 'right'];
const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

export class SherpaTooltip extends SherpaElement {
  static override css = new URL('./sherpa-tooltip.css', import.meta.url);
  static override html = new URL('./sherpa-tooltip.html', import.meta.url);
  static override props = {
    'data-anchor': { type: 'string', kind: 'style' },
    
    'data-text': { type: 'string', kind: 'content', to: '.tip-text' },
    /* Written BY the tooltip: it has a tip to show. */
    'data-has-tip': { type: 'boolean', kind: 'style' },
    'data-placement': { type: 'enum', kind: 'style', values: ['top', 'bottom', 'left', 'right'] },
  } as const;

  override onRender(): void {
    if (!this.dataset['placement']) this.dataset['placement'] = 'top';

    const bubble = this.$('.bubble');
    if (bubble && !bubble.id) bubble.id = `sherpa-tip-${++uid}`;
    if (bubble) this.setAttribute('aria-describedby', bubble.id);
  }

  /** On the ANCHOR, so a tooltip can describe a box it does not wrap. Wired on
   *  EVERY connect: `on()` carries the disconnect signal. TRAP T-abort-controller-per-connect */
  override onConnect(): void {
    const anchor = this.#anchor();
    this.on(anchor, 'pointerenter', this.#onShow);
    this.on(anchor, 'pointerleave', this.#onHide);
    this.on(anchor, 'focusin', this.#onShow);
    this.on(anchor, 'focusout', this.#onHide);
  }

  /** Its text changed while it shows: an empty bubble says nothing, so it
   *  shuts; new words are a new width, so it is placed again. */
  override onChange(name: string): void {
    if (name !== 'data-text' || !this.$('.bubble')?.matches(':popover-open')) return;
    if (this.dataset['text'] || this.hasAttribute('data-has-tip')) this.#place();
    else this.#hide();
  }

  /** What the bubble describes: this element, or the box `data-anchor` names. */
  #anchor(): HTMLElement {
    const sel = this.dataset['anchor'];
    if (!sel) return this;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.querySelector<HTMLElement>(sel) ?? this;
  }

  override onDisconnect(): void {
    // Only the POPOVER is undone by hand: left open, it outlives the element.
    this.#hide();
  }

  /** Open the bubble beside the trigger. */
  #onShow = (): void => {
    // No text and no slotted tip would open an empty bubble.
    if (!this.dataset['text'] && !this.hasAttribute('data-has-tip')) return;
    const bubble = this.$<HTMLElement>('.bubble');
    if (!bubble) return;
    // SHOW FIRST, then measure: a closed popover is `display: none` and reads 0.
    bubble.showPopover();
    this.#place();
    /* While OPEN only — a shut tooltip has nothing to hide. `capture`, because
       an ancestor's scroll does not bubble. No rAF here: this HIDES rather
       than re-places, so it reads no layout.
       TRAP T-a-layout-read-belongs-in-a-frame */
    this.#openAc = new AbortController();
    const whileOpen = { while: this.#openAc.signal, passive: true } as const;
    this.on(window, 'scroll', this.#onHide, { ...whileOpen, capture: true });
    this.on(window, 'resize', this.#onHide, whileOpen);
  };

  /** Close the bubble. */
  #onHide = (): void => {
    this.#hide();
  };

  /** Hide the popover and stop listening for its dismiss. */
  #hide(): void {
    const bubble = this.$<HTMLElement>('.bubble');
    // `matches` first: hidePopover() on a closed popover throws.
    if (bubble?.matches(':popover-open')) bubble.hidePopover();
    this.#openAc?.abort();
    this.#openAc = null;
  }

  /** Aborts when the bubble shuts — the viewport listeners' own lifetime. */
  #openAc: AbortController | null = null;

  /** Gap between the trigger and the bubble, in px. */
  static readonly OFFSET = 4;

  /**
   * Put the bubble beside its trigger on `data-placement`'s side, or the
   * opposite one when that does not fit, centred, inside the viewport.
   *
   * Measured rather than anchored — TRAP T-anchor-cross-root.
   */
  #place(): void {
    const bubble = this.$<HTMLElement>('.bubble');
    if (!bubble) return;
    const t = this.#anchor().getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const gap = SherpaTooltip.OFFSET;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    const preferred = (this.dataset['placement'] as Side | undefined) ?? 'top';
    const fits: Record<Side, boolean> = {
      top: t.top - gap - b.height >= gap,
      bottom: t.bottom + gap + b.height <= vh - gap,
      left: t.left - gap - b.width >= gap,
      right: t.right + gap + b.width <= vw - gap,
    };
    const side = [preferred, OPPOSITE[preferred]].find((s) => fits[s]) ?? preferred;

    // NOT clampNum: `min` must win, so a bubble wider than the viewport pins
    // LEFT and shows the start of its text. The order is deliberate.
    const across = (from: number, size: number, own: number, limit: number): number =>
      Math.max(gap, Math.min(from + size / 2 - own / 2, limit - own - gap));
    const x = side === 'left' ? t.left - gap - b.width
      : side === 'right' ? t.right + gap
        : across(t.left, t.width, b.width, vw);
    const y = side === 'top' ? t.top - gap - b.height
      : side === 'bottom' ? t.bottom + gap
        : across(t.top, t.height, b.height, vh);

    bubble.style.setProperty('--_x', `${Math.round(x)}px`);
    bubble.style.setProperty('--_y', `${Math.round(y)}px`);
    // Which side it landed on, for the arrow.
    for (const s of SIDES) this.toggleState(`side-${s}`, s === side);
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get text(): string {
    return this.dataset['text'] ?? '';
  }
  set text(value: string) {
    if (value) this.dataset['text'] = value;
    else delete this.dataset['text'];
  }
}

define('sherpa-tooltip', SherpaTooltip);
