/**
 * sherpa-tooltip — a hint bubble shown on hover or focus.
 *
 * Showing, hiding and placement are pure CSS. JS writes the tip text and links
 * the bubble to the trigger for screen readers.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

let uid = 0;

export class SherpaTooltip extends SherpaElement {
  static override css = new URL('./sherpa-tooltip.css', import.meta.url);
  static override html = new URL('./sherpa-tooltip.html', import.meta.url);
  static override props = {
    'data-text': { type: 'string', kind: 'content', to: '.tip-text' },
  } as const;

  static override observed = ['data-placement'];

  override onRender(): void {
    if (!this.dataset['placement']) this.dataset['placement'] = 'top';

    const bubble = this.$('.bubble');
    if (bubble && !bubble.id) bubble.id = `sherpa-tip-${++uid}`;
    if (bubble) this.setAttribute('aria-describedby', bubble.id);

    // Listeners are for FLOATING MODE only; the ordinary mode stays pure CSS.
    // They go on the ANCHOR so a tooltip can describe a box it does not wrap.
    const anchor = this.#anchor();
    anchor.addEventListener('pointerenter', this.#onShow);
    anchor.addEventListener('pointerleave', this.#onHide);
    anchor.addEventListener('focusin', this.#onShow);
    anchor.addEventListener('focusout', this.#onHide);
  }

  /**
   * What the bubble describes: this element, or the box `data-anchor` names.
   *
   * Resolved against the tooltip's own root, so a component can point it at one
   * of its own parts without exposing an id to the document.
   */
  #anchor(): HTMLElement {
    const sel = this.dataset['anchor'];
    if (!sel) return this;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.querySelector<HTMLElement>(sel) ?? this;
  }

  override onDisconnect(): void {
    // A popover left open in the top layer outlives the element it belongs to.
    this.#hide();
    const anchor = this.#anchor();
    anchor.removeEventListener('pointerenter', this.#onShow);
    anchor.removeEventListener('pointerleave', this.#onHide);
    anchor.removeEventListener('focusin', this.#onShow);
    anchor.removeEventListener('focusout', this.#onHide);
    window.removeEventListener('scroll', this.#onHide, { capture: true });
    window.removeEventListener('resize', this.#onHide);
  }

  /** Whether this tooltip places itself in the top layer. */
  get #floating(): boolean {
    return this.hasAttribute('data-floating');
  }

  #onShow = (): void => {
    if (!this.#floating) return;
    // No text and no slotted tip would open an empty bubble.
    if (!this.dataset['text'] && !this.hasAttribute('data-has-tip')) return;
    const bubble = this.$<HTMLElement>('.bubble');
    if (!bubble) return;
    // SHOW FIRST, then measure: a closed popover is `display: none` and reads 0.
    bubble.showPopover();
    this.#place();
    // Scroll or resize moves the trigger while the bubble stays put, so close.
    // `capture`, because an ancestor's scroll does not bubble.
    window.addEventListener('scroll', this.#onHide, { capture: true, passive: true });
    window.addEventListener('resize', this.#onHide, { passive: true });
  };

  #onHide = (): void => {
    if (!this.#floating) return;
    this.#hide();
  };

  #hide(): void {
    const bubble = this.$<HTMLElement>('.bubble');
    // `matches` first: hidePopover() on a closed popover throws.
    if (bubble?.matches(':popover-open')) bubble.hidePopover();
    window.removeEventListener('scroll', this.#onHide, { capture: true });
    window.removeEventListener('resize', this.#onHide);
  }

  /** Gap between the trigger and the bubble — the tooltip's own space/2xs. */
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

    // Above the trigger, flipping below when there is no room up there.
    let y = t.top - gap - b.height;
    if (y < gap) y = Math.min(vh - b.height - gap, t.bottom + gap);

    // NOT clampNum: here `min` wins the conflict, so a bubble wider than the
    // viewport pins LEFT and shows the start of its text. The order is deliberate.
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
