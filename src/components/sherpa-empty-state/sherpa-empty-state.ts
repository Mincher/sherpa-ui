/**
 * sherpa-empty-state — the "nothing here yet" placeholder for a blank area.
 *
 * A centred icon, a title (data-heading), a message (data-description or your own
 * slotted content), and an optional slot for an action button. CSS handles the
 * icon and what shows; JS only writes the heading and message text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaEmptyState extends SherpaElement {
  static override css = new URL('./sherpa-empty-state.css', import.meta.url);
  static override html = new URL('./sherpa-empty-state.html', import.meta.url);
  static override observed = ['data-heading', 'data-description'];

  override onRender(): void {
    this.#syncTitle();
    this.#syncDescription();
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncTitle();
    else if (name === 'data-description') this.#syncDescription();
  }

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['heading'] ?? '';
  }

  #syncDescription(): void {
    const el = this.$('.message-text');
    if (el) el.textContent = this.dataset['description'] ?? '';
  }
}

customElements.define('sherpa-empty-state', SherpaEmptyState);
