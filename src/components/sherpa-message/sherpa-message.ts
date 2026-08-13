/**
 * sherpa-message — a lightweight inline status strip.
 *
 * A single-row status message: a leading status glyph, the message text (slotted
 * or from data-label), and an optional dismiss button. Unlike sherpa-callout (a
 * padded box with an accent bar and stacked title/message), this is a thin inline
 * strip meant to sit within a form section or at the top of a region.
 *
 * The status hue and its soft surface tint are pure CSS off data-status. The one
 * behaviour is the dismiss button, which emits `message-dismiss` and removes the
 * element.
 *
 * @fires message-dismiss — detail: none
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaMessage extends SherpaElement {
  static override css = new URL('./sherpa-message.css', import.meta.url);
  static override html = new URL('./sherpa-message.html', import.meta.url);
  static override observed = ['data-label'];

  override onRender(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    this.#syncLabel();
    this.$('.close')?.addEventListener('click', this.#onDismiss);
  }

  override onChange(name: string): void {
    if (name === 'data-label') this.#syncLabel();
  }

  /** Dismiss the message: emit the event and remove the element. */
  dismiss(): void {
    this.emit('message-dismiss');
    this.remove();
  }

  #syncLabel(): void {
    const el = this.$('.label');
    if (el) el.textContent = this.dataset['label'] ?? '';
  }

  #onDismiss = (event: Event): void => {
    event.stopPropagation();
    this.dismiss();
  };
}

customElements.define('sherpa-message', SherpaMessage);
