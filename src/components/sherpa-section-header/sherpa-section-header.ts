/**
 * sherpa-section-header — a semantic heading row for a content section.
 *
 * A title (from data-title, or a slotted heading), an optional description, and
 * a trailing actions slot. data-size scales the heading typography; data-divider
 * draws a separator beneath the row. Everything visible is CSS off data-* and the
 * base class's data-has-{slot} reflection — JS only writes the title text.
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
