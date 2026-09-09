/**
 * sherpa-toast — a pop-up message that goes away on its own.
 *
 * A coloured card with a message and a close button. It disappears by itself
 * after data-duration milliseconds, or you can close it early. Either way it
 * fires toast-dismiss and removes itself. CSS handles the colour from data-status.
 *
 * Shortcut: SherpaToast.info/success/warning/critical(message, opts?) makes a
 * toast, adds it to the page, and hands it back.
 * @fires toast-dismiss — the toast is dismissed (close or auto). bubbles + composed. detail: {}
 * @fires toast-action  — the action link is clicked. bubbles + composed. detail: {}
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** Options for the static factory helpers. */
export interface ToastOptions {
  /** Auto-dismiss delay in ms. 0 disables the timer. Default 5000. */
  duration?: number;
  /** Where to append the toast. Defaults to document.body. */
  container?: HTMLElement;
}

type ToastStatus = 'info' | 'success' | 'warning' | 'critical';

export class SherpaToast extends SherpaElement {
  static override css = new URL('./sherpa-toast.css', import.meta.url);
  static override html = new URL('./sherpa-toast.html', import.meta.url);
  static override observed = ['data-heading', 'data-message', 'data-value', 'data-action'];

  #timer: ReturnType<typeof setTimeout> | null = null;

  override onRender(): void {
    this.#syncContent();
    this.$('.close')?.addEventListener('click', () => this.dismiss());
    this.$('.action')?.addEventListener('click', () => this.emit('toast-action', {}));
  }

  override onConnect(): void {
    const duration = Number(this.dataset['duration'] ?? '5000');
    if (Number.isFinite(duration) && duration > 0) {
      this.#timer = setTimeout(() => this.dismiss(), duration);
    }
  }

  override onDisconnect(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  override onChange(): void {
    this.#syncContent();
  }

  /** Dismiss the toast: stop the timer, announce, and remove from the DOM. */
  dismiss(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.emit('toast-dismiss');
    this.remove();
  }

  /** Mirror heading (data-heading, or the data-message alias), value, and action. */
  #syncContent(): void {
    const heading = this.$('.heading');
    const headingText = this.dataset['heading'] ?? this.dataset['message'];
    if (heading && headingText !== undefined) heading.textContent = headingText;
    const value = this.$('.value');
    if (value) value.textContent = this.dataset['value'] ?? '';
    const action = this.$('.action');
    if (action) action.textContent = this.dataset['action'] ?? '';
  }

  /* ── Static factory helpers ────────────────────────────────────────── */

  static show(message: string, status: ToastStatus, options: ToastOptions = {}): SherpaToast {
    const toast = document.createElement('sherpa-toast') as SherpaToast;
    toast.dataset['status'] = status;
    toast.dataset['message'] = message;
    if (options.duration !== undefined) toast.dataset['duration'] = String(options.duration);
    (options.container ?? document.body).appendChild(toast);
    return toast;
  }

  static info(message: string, options?: ToastOptions): SherpaToast {
    return SherpaToast.show(message, 'info', options);
  }
  static success(message: string, options?: ToastOptions): SherpaToast {
    return SherpaToast.show(message, 'success', options);
  }
  static warning(message: string, options?: ToastOptions): SherpaToast {
    return SherpaToast.show(message, 'warning', options);
  }
  static critical(message: string, options?: ToastOptions): SherpaToast {
    return SherpaToast.show(message, 'critical', options);
  }
}

customElements.define('sherpa-toast', SherpaToast);
