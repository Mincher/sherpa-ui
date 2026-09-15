/**
 * sherpa-tooltip — a little hint bubble that shows on hover or focus.
 *
 * Wrap it around whatever it describes. Showing and hiding is pure CSS off hover
 * and focus — no JS. The bubble sits to whichever side data-placement picks, and
 * CSS handles that. JS does just two things: write the tip text into the bubble,
 * and link it to the trigger so screen readers read it out.
 *
 * @element sherpa-tooltip
 * @attr {string} data-text      — tip text (or use the `tip` slot for rich content)
 * @attr {enum}   data-placement — top (default) | bottom | left | right
 * @attr {string} data-anchor — a selector (resolved in this element's own root)
 *                for the box the tip describes, when wrapping it is not
 *                possible. Defaults to this element.
 * @attr {boolean} data-floating — place the bubble in the TOP LAYER from measured
 *                coordinates rather than relative to the host. For a tooltip
 *                inside a box that clips, where the absolute bubble is cut off.
 *
 * @slot (default) — the trigger the tooltip describes
 * @slot tip       — rich tip content (overrides data-text)
 *
 * @fires nothing — visibility is CSS-driven.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

let uid = 0;

export class SherpaTooltip extends SherpaElement {
  static override css = new URL('./sherpa-tooltip.css', import.meta.url);
  static override html = new URL('./sherpa-tooltip.html', import.meta.url);
  /** Mirror data-text into the bubble's text span (CSS handles all visibility). */
  static override props = {
    'data-text': { type: 'string', kind: 'content', to: '.tip-text' },
  } as const;

  static override observed = ['data-placement'];

  override onRender(): void {
    if (!this.dataset['placement']) this.dataset['placement'] = 'top';

    const bubble = this.$('.bubble');
    if (bubble && !bubble.id) bubble.id = `sherpa-tip-${++uid}`;
    if (bubble) this.setAttribute('aria-describedby', bubble.id);

    // FLOATING MODE only. The bubble goes into the top layer, past every
    // ancestor's clip, and is placed from measured coordinates — so JS has to
    // know when it is showing. The ordinary mode stays pure CSS.
    //
    // The listeners go on the ANCHOR, which is this element unless data-anchor
    // names another. That is how a tooltip can describe a box it does not wrap:
    // wrapping is not always possible, because an element inserted between a
    // host and its content breaks every `:host(…) .child` rule in that
    // component's stylesheet.
    const anchor = this.#anchor();
    anchor.addEventListener('pointerenter', this.#onShow);
    anchor.addEventListener('pointerleave', this.#onHide);
    anchor.addEventListener('focusin', this.#onShow);
    anchor.addEventListener('focusout', this.#onHide);
  }

  /**
   * What the bubble describes: this element, or the box `data-anchor` names.
   *
   * The selector is resolved against the tooltip's own ROOT — its shadow host's
   * tree — so a component can point it at one of its own parts without exposing
   * an id to the document.
   */
  #anchor(): HTMLElement {
    const sel = this.dataset['anchor'];
    if (!sel) return this;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.querySelector<HTMLElement>(sel) ?? this;
  }

  override onDisconnect(): void {
    // A popover left open in the top layer would outlive the element it belongs
    // to — it is not a child of it any more, as far as painting goes.
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
    // NOTHING TO SAY, nothing to show. A tooltip with no text and no slotted tip
    // would open an empty bubble — a bare shadow over the trigger.
    if (!this.dataset['text'] && !this.hasAttribute('data-has-tip')) return;
    const bubble = this.$<HTMLElement>('.bubble');
    if (!bubble) return;
    // SHOW FIRST, then measure: a closed popover is `display: none` and its own
    // size reads as 0, so it cannot be centred before it is up.
    bubble.showPopover();
    this.#place();
    // A scroll or a resize moves the trigger; the bubble is fixed in the top
    // layer and would stay behind. It is a HINT, so closing is honest and
    // cheaper than following. `capture`, because an ancestor's scroll does not
    // bubble.
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
   * Put the floating bubble above its trigger, centred, and inside the viewport.
   *
   * Measured rather than anchored: CSS `anchor-name` resolves inside ONE tree
   * and this bubble is in the tooltip's shadow root while the trigger is
   * slotted from the caller's. Re-probed on Chromium 153 — supported, and it
   * silently drops the box at the viewport's far corner.
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

    // Centred, pulled back inside either edge.
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
