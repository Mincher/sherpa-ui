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
    'data-heading': { type: 'string', kind: 'content' },
    'data-type': { type: 'enum', kind: 'style', values: ['callout', 'banner'] },
    // It dismisses itself after this many ms, as `sherpa-toast` does. Off by default.
    'data-duration': { type: 'number', kind: 'behaviour' },
    // Its host owns whether it stays: a dismiss is reported, and it stays. PRINCIPLES 21
    'data-locked': { type: 'boolean', kind: 'behaviour' },
    // Shown again, its timer starts again: a banner hidden until a notice waits.
    'hidden': { type: 'boolean', kind: 'behaviour' },
  } as const;
  static override observed = ['data-duration'];

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
    if (name === 'data-duration' || name === 'hidden') this.#time();
  }

  /** Dismiss the callout: emit the event and remove the element — unless it is
   *  locked, when its host decides. */
  dismiss(): void {
    this.#stop();
    this.emit('callout-dismiss');
    if (!this.hasAttribute('data-locked')) this.remove();
  }

  /** Start the auto-dismiss timer again, where it has a duration. */
  #time(): void {
    this.#stop();
    const duration = this.num('data-duration', 0);
    // Only while it shows: hidden, nobody could read it.
    if (duration > 0 && !this.hidden) this.#timer = setTimeout(() => this.dismiss(), duration);
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
