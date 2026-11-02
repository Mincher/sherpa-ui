/**
 * sherpa-callout — a boxed status message.
 *
 * A soft coloured box with an accent bar down the side, an icon, a title and
 * message, and an optional close button. The colour comes from data-status, and
 * CSS handles it. JS only writes the heading text. The one bit of behaviour is the
 * close button, which fires callout-dismiss. `data-type="banner"` is Figma's
 * Banner: one row across its parent. Will, TODO 656
 *
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaCallout extends SherpaElement {
  static override css = new URL('./sherpa-callout.css', import.meta.url);
  static override html = new URL('./sherpa-callout.html', import.meta.url);
  static override props = {
    'data-dismissible': { type: 'boolean', kind: 'style' },
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
    'data-type': { type: 'enum', kind: 'style', values: ['callout', 'banner'] },
    // It dismisses itself after this many ms, as `sherpa-toast` does. Off by default.
    'data-duration': { type: 'number', kind: 'behaviour' },
  } as const;

  static override aria = { role: 'status' };

  /** The auto-dismiss timer. */
  #timer: ReturnType<typeof setTimeout> | null = null;

  override onRender(): void {
    this.$('.close')?.addEventListener('button-click', this.#onDismiss);
  }

  override onConnect(): void {
    this.#time();
  }

  override onDisconnect(): void {
    this.#stop();
  }

  override onChange(name: string): void {
    if (name === 'data-duration') this.#time();
  }

  /** Dismiss the callout: emit the event and remove the element. */
  dismiss(): void {
    this.#stop();
    this.emit('callout-dismiss');
    this.remove();
  }

  /** Start the auto-dismiss timer again, where it has a duration. */
  #time(): void {
    this.#stop();
    const duration = this.num('data-duration', 0);
    if (duration > 0) this.#timer = setTimeout(() => this.dismiss(), duration);
  }

  /** Stop the auto-dismiss timer. */
  #stop(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  /** The dismiss button. */
  #onDismiss = (event: Event): void => {
    event.stopPropagation();
    this.dismiss();
  };
}

define('sherpa-callout', SherpaCallout);
