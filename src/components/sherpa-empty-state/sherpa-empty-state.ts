/**
 * sherpa-empty-state — a centred placeholder for a blank list, grid, or region.
 *
 * A decorative icon area, a title (data-title), a message (data-description or
 * slotted body), and an optional action slot. The icon glyph, size, and every
 * region's visibility are pure CSS off data-* and the base class's data-has-{slot}
 * reflection — JS only writes the title and message text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaEmptyState extends SherpaElement {
  static override css = new URL('./sherpa-empty-state.css', import.meta.url);
  static override html = new URL('./sherpa-empty-state.html', import.meta.url);
  static override observed = ['data-title', 'data-description'];

  override onRender(): void {
    this.#syncTitle();
    this.#syncDescription();
  }

  override onChange(name: string): void {
    if (name === 'data-title') this.#syncTitle();
    else if (name === 'data-description') this.#syncDescription();
  }

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['title'] ?? '';
  }

  #syncDescription(): void {
    const el = this.$('.message-text');
    if (el) el.textContent = this.dataset['description'] ?? '';
  }
}

customElements.define('sherpa-empty-state', SherpaEmptyState);
