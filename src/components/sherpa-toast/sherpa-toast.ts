/**
 * sherpa-toast — a pop-up message that removes itself after a delay.
 *
 * The static helpers share one `.sherpa-toast-stack` column. CSS owns colour,
 * corner and both animations.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** Options for the static factory helpers. */
export interface ToastOptions {
  /** Auto-dismiss delay in ms. 0 disables the timer. Default 5000. */
  duration?: number;
  /** Where to append the toast. Defaults to the shared top-right stack. */
  container?: HTMLElement;
  /** The second line, under the heading (data-value). */
  value?: string;
  /** An action link (data-action). Fires toast-action when clicked. */
  action?: string;
}

/** A safety net, never the duration — it must not beat a real animation. TRAP T-css-owns-the-leave-duration */
const LEAVE_FALLBACK_MS = 1000;
const DEFAULT_DURATION = 5000;

type ToastStatus = 'info' | 'success' | 'warning' | 'critical';

export class SherpaToast extends SherpaElement {
  static override css = new URL('./sherpa-toast.css', import.meta.url);
  static override html = new URL('./sherpa-toast.html', import.meta.url);
  static override props = {
    'data-stacked': { type: 'boolean', kind: 'style' },
    // The heading span holds a <slot>, so a slotted heading must survive —
    // TRAP T-slot-guards-only-when-filled. data-message is the legacy alias.
    'data-heading': {
      type: 'string', kind: 'content', to: '.heading',
      fallbackAttr: 'data-message', skipWhen: 'slot',
    },
    'data-value': { type: 'string', kind: 'content', to: '.value' },
    'data-action': { type: 'string', kind: 'content', to: '.action' },
  } as const;

  #timer: ReturnType<typeof setTimeout> | null = null;

  override onRender(): void {
    this.$('.close')?.addEventListener('click', () => this.dismiss());
    this.$('.action')?.addEventListener('click', () => this.emit('toast-action', {}));
  }

  override onConnect(): void {
    const duration = this.num('data-duration', DEFAULT_DURATION);
    if (duration > 0) {
      this.#timer = setTimeout(() => this.dismiss(), duration);
    }
  }

  override onDisconnect(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  /** Stop the timer, announce, play the leave animation, then remove the node. */
  dismiss(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.hasAttribute('data-leaving')) return;
    this.emit('toast-dismiss');
    this.toggleAttribute('data-leaving', true);

    // The fallback covers an animation that never runs at all.
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      this.#removeAndTidy();
    };
    this.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, LEAVE_FALLBACK_MS);
  }

  /** Remove the toast, and the shared stack too once it is empty. */
  #removeAndTidy(): void {
    const stack = this.parentElement;
    this.remove();
    if (stack?.classList.contains('sherpa-toast-stack') && !stack.children.length) stack.remove();
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
    // In the shared stack the CONTAINER owns the corner: the toast stays in flow.
    if (host.classList.contains('sherpa-toast-stack')) toast.dataset['stacked'] = '';
    host.appendChild(toast);
    return toast;
  }

  /** The shared top-right stack, made on first use. Light DOM, so the app can target it. */
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
      'pointer-events:none', // the stack never blocks the page
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
