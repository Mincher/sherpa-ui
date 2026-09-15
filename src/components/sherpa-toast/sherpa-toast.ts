/**
 * sherpa-toast — a pop-up message that goes away on its own.
 *
 * A card with a message and a close button. It lives in the TOP-RIGHT corner,
 * slides in, waits five seconds, then slides out and removes itself. You can also
 * close it early. Either way it fires toast-dismiss. CSS owns the colour (from
 * data-status), the corner and both animations.
 *
 * Several toasts stack: the factory helpers drop them into one shared
 * `.sherpa-toast-stack` column in the top-right, so a new toast pushes the older
 * ones down instead of covering them.
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
  /** Where to append the toast. Defaults to the shared top-right stack. */
  container?: HTMLElement;
  /**
   * The second line, under the heading (data-value). The toast has always
   * rendered it; only the factory had no way to pass it, so an app wanting both
   * lines had to build the element by hand and lose the shared stack with it.
   */
  value?: string;
  /** An action link in the toast (data-action). Fires toast-action when clicked. */
  action?: string;
}

/** How long the leave animation runs — keep in step with sherpa-toast-out. */
const LEAVE_MS = 160;
/** The default auto-dismiss delay. */
const DEFAULT_DURATION = 5000;

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
    const duration = Number(this.dataset['duration'] ?? String(DEFAULT_DURATION));
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

  /**
   * Dismiss the toast: stop the timer, announce, play the leave animation, then
   * remove the node. The event fires immediately so app code isn't kept waiting on
   * the animation.
   */
  dismiss(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.hasAttribute('data-leaving')) return; // already on its way out
    this.emit('toast-dismiss');
    this.toggleAttribute('data-leaving', true);
    setTimeout(() => this.#removeAndTidy(), LEAVE_MS);
  }

  /** Remove the toast, and the shared stack too once it is empty. */
  #removeAndTidy(): void {
    const stack = this.parentElement;
    this.remove();
    if (stack?.classList.contains('sherpa-toast-stack') && !stack.children.length) stack.remove();
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
    if (options.value !== undefined) toast.dataset['value'] = options.value;
    if (options.action !== undefined) toast.dataset['action'] = options.action;
    const host = options.container ?? SherpaToast.#stack();
    // Inside the shared stack the container owns the corner, so the toast returns
    // to normal flow and the column spaces them.
    if (host.classList.contains('sherpa-toast-stack')) toast.dataset['stacked'] = '';
    host.appendChild(toast);
    return toast;
  }

  /**
   * The shared top-right stack, created on first use. A light-DOM element (not a
   * shadow root), so its geometry is plain CSS the app can also target.
   */
  static #stack(): HTMLElement {
    const existing = document.querySelector<HTMLElement>('.sherpa-toast-stack');
    if (existing) return existing;
    const stack = document.createElement('div');
    stack.className = 'sherpa-toast-stack';
    stack.style.cssText = [
      'position:fixed',
      'top:var(--sherpa-display-mode-space-base, 16px)',
      'right:var(--sherpa-display-mode-space-base, 16px)',
      'z-index:1000',
      'display:flex',
      'flex-direction:column',
      'gap:var(--sherpa-display-mode-space-xs, 8px)',
      'pointer-events:none', // the stack never blocks the page …
    ].join(';');
    document.body.appendChild(stack);
    return stack;
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
