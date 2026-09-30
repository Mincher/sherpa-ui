/**
 * sherpa-tooltip — a hint bubble shown on hover or focus.
 *
 * Ordinary mode is pure CSS; JS runs only for floating (top-layer) mode.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

let uid = 0;

export class SherpaTooltip extends SherpaElement {
  static override css = new URL('./sherpa-tooltip.css', import.meta.url);
  static override html = new URL('./sherpa-tooltip.html', import.meta.url);
  static override props = {
    'data-anchor': { type: 'string', kind: 'style' },
    
    'data-text': { type: 'string', kind: 'content', to: '.tip-text' },
    /* Written BY the tooltip: it is positioned, and it has a tip to show. */
    'data-floating': { type: 'boolean', kind: 'style' },
    'data-has-tip': { type: 'boolean', kind: 'style' },
  } as const;

  static override observed = ['data-placement'];

  override onRender(): void {
    if (!this.dataset['placement']) this.dataset['placement'] = 'top';

    const bubble = this.$('.bubble');
    if (bubble && !bubble.id) bubble.id = `sherpa-tip-${++uid}`;
    if (bubble) this.setAttribute('aria-describedby', bubble.id);

    /* On the ANCHOR, so a tooltip can describe a box it does not wrap — which
       is why these need removing and a listener on `this` would not. `on()`
       carries the disconnect signal, so there is nothing to undo. */
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
    /* Only the POPOVER needs undoing by hand: one left open in the top layer
       outlives the element it belongs to. Every listener above carries the
       disconnect signal. */
    this.#hide();
  }

  /** Whether this tooltip places itself in the top layer. */
  get #floating(): boolean {
    return this.hasAttribute('data-floating');
  }

  /** Open the bubble beside the trigger. */
  #onShow = (): void => {
    if (!this.#floating) return;
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
    if (!this.#floating) return;
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
   * Put the floating bubble above its trigger, centred, inside the viewport.
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

    let y = t.top - gap - b.height;
    if (y < gap) y = Math.min(vh - b.height - gap, t.bottom + gap);

    // NOT clampNum: `min` must win, so a bubble wider than the viewport pins
    // LEFT and shows the start of its text. The order is deliberate.
    let x = t.left + t.width / 2 - b.width / 2;
    if (x + b.width > vw - gap) x = vw - b.width - gap;
    if (x < gap) x = gap;

    bubble.style.setProperty('--_x', `${Math.round(x)}px`);
    bubble.style.setProperty('--_y', `${Math.round(y)}px`);
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

customElements.define('sherpa-tooltip', SherpaTooltip);
