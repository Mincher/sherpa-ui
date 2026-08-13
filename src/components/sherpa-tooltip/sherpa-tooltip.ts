/**
 * sherpa-tooltip — a hover/focus tooltip that wraps a trigger.
 *
 * Deliberately minimal. Show/hide is pure CSS off :hover / :focus-within — no JS
 * positioning, no anchor bookkeeping (that's what "JS is the last resort" buys us).
 * The tip lives in an absolutely-positioned bubble whose side is chosen by CSS off
 * data-placement. JS does exactly two things: mirror data-text into the bubble, and
 * set the trigger's aria-describedby so assistive tech reads the tip.
 *
 * @element sherpa-tooltip
 * @attr {string} data-text      — tip text (or use the `tip` slot for rich content)
 * @attr {enum}   data-placement — top (default) | bottom | left | right
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
  static override observed = ['data-text', 'data-placement'];

  override onRender(): void {
    if (!this.dataset['placement']) this.dataset['placement'] = 'top';

    const bubble = this.$('.bubble');
    if (bubble && !bubble.id) bubble.id = `sherpa-tip-${++uid}`;
    if (bubble) this.setAttribute('aria-describedby', bubble.id);

    this.#syncText();
  }

  override onChange(name: string): void {
    if (name === 'data-text') this.#syncText();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get text(): string {
    return this.dataset['text'] ?? '';
  }
  set text(value: string) {
    if (value) this.dataset['text'] = value;
    else delete this.dataset['text'];
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** Mirror data-text into the bubble's text span (CSS handles all visibility). */
  #syncText(): void {
    const el = this.$('.tip-text');
    if (el) el.textContent = this.dataset['text'] ?? '';
  }
}

customElements.define('sherpa-tooltip', SherpaTooltip);
