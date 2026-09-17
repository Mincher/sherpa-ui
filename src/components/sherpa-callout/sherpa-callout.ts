/**
 * sherpa-callout — a boxed status message.
 *
 * A soft coloured box with an accent bar down the side, an icon, a title and
 * message, and an optional close button. The colour comes from data-status, and
 * CSS handles it. JS only writes the heading text. The one bit of behaviour is the
 * close button, which fires callout-dismiss.
 *
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaCallout extends SherpaElement {
  static override css = new URL('./sherpa-callout.css', import.meta.url);
  static override html = new URL('./sherpa-callout.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
  } as const;

  override onRender(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    this.$('.close')?.addEventListener('click', this.#onDismiss);
  }

  /** Dismiss the callout: emit the event and remove the element. */
  dismiss(): void {
    this.emit('callout-dismiss');
    this.remove();
  }

  #onDismiss = (event: Event): void => {
    event.stopPropagation();
    this.dismiss();
  };
}

customElements.define('sherpa-callout', SherpaCallout);
