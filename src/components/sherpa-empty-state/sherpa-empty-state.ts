/**
 * sherpa-empty-state — the "nothing here yet" placeholder for a blank area.
 *
 * A centred icon, a title (data-heading), a message (data-description or your own
 * slotted content), an optional action slot, and an optional muted fine-print
 * line (data-small-print or a slotted small-print). CSS handles the icon and what
 * shows; JS only writes the heading, message, and small-print text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaEmptyState extends SherpaElement {
  static override css = new URL('./sherpa-empty-state.css', import.meta.url);
  static override html = new URL('./sherpa-empty-state.html', import.meta.url);
  static override observed = ['data-heading', 'data-description', 'data-small-print'];

  override onRender(): void {
    this.#syncTitle();
    this.#syncDescription();
    this.#syncSmallPrint();
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncTitle();
    else if (name === 'data-description') this.#syncDescription();
    else if (name === 'data-small-print') this.#syncSmallPrint();
  }

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['heading'] ?? '';
  }

  #syncDescription(): void {
    const el = this.$('.message-text');
    if (el) el.textContent = this.dataset['description'] ?? '';
  }

  #syncSmallPrint(): void {
    const el = this.$('.small-print-text');
    if (el) el.textContent = this.dataset['smallPrint'] ?? '';
  }
}

customElements.define('sherpa-empty-state', SherpaEmptyState);
