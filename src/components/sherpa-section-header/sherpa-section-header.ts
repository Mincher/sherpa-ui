/**
 * sherpa-section-header — a heading row above a section of content.
 *
 * A title (from data-heading, or your own slotted heading), an optional description,
 * and a slot for action buttons on the right. data-size sets how big the heading
 * is; data-divider draws a line under the row. CSS handles the look; JS only
 * writes the heading text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaSectionHeader extends SherpaElement {
  static override css = new URL('./sherpa-section-header.css', import.meta.url);
  static override html = new URL('./sherpa-section-header.html', import.meta.url);
  static override observed = ['data-heading'];

  override onRender(): void {
    this.#syncTitle();
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncTitle();
  }

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['heading'] ?? '';
  }
}

customElements.define('sherpa-section-header', SherpaSectionHeader);
