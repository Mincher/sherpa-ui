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
