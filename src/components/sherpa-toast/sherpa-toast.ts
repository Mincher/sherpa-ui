/**
 * sherpa-toast — a transient notification.
 *
 * A status-tinted card with a message and a close button. It auto-dismisses after
 * data-duration ms (a timer started once on connect) and can be closed manually.
 * Either path fires toast-dismiss and removes the element. The status LOOK is pure
 * CSS off data-status; JS only carries the message, the timer, and the value API.
 *
 * Static convenience: SherpaToast.info/success/warning/critical(message, opts?)
 * create a toast, append it (to opts.container or document.body), and return it.
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
  static override observed = ['data-message'];

  #timer: ReturnType<typeof setTimeout> | null = null;

  override onRender(): void {
    this.#syncMessage();
    this.$('.close')?.addEventListener('click', () => this.dismiss());
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
    this.#syncMessage();
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

  #syncMessage(): void {
    const el = this.$('.message');
    if (el && this.dataset['message'] !== undefined) el.textContent = this.dataset['message'];
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
