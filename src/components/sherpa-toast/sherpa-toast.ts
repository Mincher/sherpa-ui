/**
 * sherpa-toast — a pop-up message that removes itself after a delay.
 *
 * The static helpers share one `.sherpa-toast-stack` column, cloned from the
 * template; its CSS is sherpa-toast-stack.css, in the page. CSS owns colour,
 * corner and both animations.
 *
 * Map:
 * - ToastOptions — Options for the static factory helpers.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

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
  // TRAP T-a-page-sheet-is-for-what-a-component-puts-in-the-page
  static override pageCss = new URL('./sherpa-toast-stack.css', import.meta.url);
  static override props = {
    // Beside the slot, never in it: slotted words win by CSS.
    // TRAP T-slot-guards-only-when-filled
    'data-heading': { type: 'string', kind: 'content', to: '.heading-text' },
    'data-value': { type: 'string', kind: 'content', to: '.value' },
    'data-action': { type: 'string', kind: 'content', to: '.action' },
  } as const;

  /** The auto-dismiss timer. */
  #timer: ReturnType<typeof setTimeout> | null = null;

  /** Made by a helper with no container: it joins the shared stack once it has drawn. */
  #joinsStack = false;

  override onRender(): void {
    this.$('.close')?.addEventListener('button-click', () => this.dismiss());
    this.$('.action')?.addEventListener('click', () => this.emit('toast-action'));
    // LAST: the move disconnects it, which aborts `this.signal`.
    if (this.#joinsStack && this.isConnected) this.#joinStack();
  }

  override onConnect(): void {
    // :host cannot see its parent, so the state says it.
    this.toggleState('stacked', this.parentElement?.classList.contains('sherpa-toast-stack') === true);
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
    if (this.hasState('leaving')) return;
    this.emit('toast-dismiss');
    this.toggleState('leaving', true);

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
    toast.dataset['heading'] = message;
    if (options.duration !== undefined) toast.dataset['duration'] = String(options.duration);
    if (options.value !== undefined) toast.dataset['value'] = options.value;
    if (options.action !== undefined) toast.dataset['action'] = options.action;
    // No container: into the page, then the shared stack once it has drawn.
    toast.#joinsStack = !options.container;
    (options.container ?? document.body).appendChild(toast);
    return toast;
  }

  /** Into the page's shared stack, cloned from this template by the first toast
   *  that draws. Light DOM, so the app can target it. */
  #joinStack(): void {
    this.#joinsStack = false;
    const stack = document.querySelector('body > .sherpa-toast-stack') ?? this.clone('template.toast-stack-tpl');
    if (!stack) return;
    if (!stack.isConnected) document.body.appendChild(stack);
    stack.appendChild(this);
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

define('sherpa-toast', SherpaToast);
