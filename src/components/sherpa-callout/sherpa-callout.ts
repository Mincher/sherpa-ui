/**
 * sherpa-callout — a boxed status message.
 *
 * A soft coloured box with an accent bar down the side, an icon, a title and
 * message, and an optional close button. The colour comes from data-status, and
 * CSS handles it. JS only writes the heading text. The one bit of behaviour is the
 * close button, which fires callout-dismiss.
 *
 * @fires callout-dismiss — detail: none
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaCallout extends SherpaElement {
  static override css = new URL('./sherpa-callout.css', import.meta.url);
  static override html = new URL('./sherpa-callout.html', import.meta.url);
  static override observed = ['data-heading'];

  override onRender(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'note');
    this.#syncTitle();
    this.$('.close')?.addEventListener('click', this.#onDismiss);
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncTitle();
  }

  /** Dismiss the callout: emit the event and remove the element. */
  dismiss(): void {
    this.emit('callout-dismiss');
    this.remove();
  }

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['heading'] ?? '';
  }

  #onDismiss = (event: Event): void => {
    event.stopPropagation();
    this.dismiss();
  };
}

customElements.define('sherpa-callout', SherpaCallout);
