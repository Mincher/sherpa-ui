/**
 * sherpa-section-header — a heading row above a section of content.
 *
 * A title (from data-title, or your own slotted heading), an optional description,
 * and a slot for action buttons on the right. data-size sets how big the heading
 * is; data-divider draws a line under the row. CSS handles the look; JS only
 * writes the title text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaSectionHeader extends SherpaElement {
  static override css = new URL('./sherpa-section-header.css', import.meta.url);
  static override html = new URL('./sherpa-section-header.html', import.meta.url);
  static override observed = ['data-title'];

  override onRender(): void {
    this.#syncTitle();
  }

  override onChange(name: string): void {
    if (name === 'data-title') this.#syncTitle();
  }

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['title'] ?? '';
  }
}

customElements.define('sherpa-section-header', SherpaSectionHeader);
