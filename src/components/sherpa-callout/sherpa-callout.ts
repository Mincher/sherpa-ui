/**
 * sherpa-callout — a status message box.
 *
 * A soft status surface with a leading accent bar, an icon, a title/message,
 * and an optional dismiss button. The status colour and surface tint are pure
 * CSS off data-status; the title is the only text JS writes (from data-title).
 * The single behaviour is the dismiss button, which emits `callout-dismiss`.
 *
 * @fires callout-dismiss — detail: none
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaCallout extends SherpaElement {
  static override css = new URL('./sherpa-callout.css', import.meta.url);
  static override html = new URL('./sherpa-callout.html', import.meta.url);
  static override observed = ['data-title'];

  override onRender(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'note');
    this.#syncTitle();
    this.$('.close')?.addEventListener('click', this.#onDismiss);
  }

  override onChange(name: string): void {
    if (name === 'data-title') this.#syncTitle();
  }

  /** Dismiss the callout: emit the event and remove the element. */
  dismiss(): void {
    this.emit('callout-dismiss');
    this.remove();
  }

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['title'] ?? '';
  }

  #onDismiss = (event: Event): void => {
    event.stopPropagation();
    this.dismiss();
  };
}

customElements.define('sherpa-callout', SherpaCallout);
