/**
 * @element sherpa-toast
 * @category feedback
 * @description Toast notification with auto-dismiss, status variants,
 *   and static factory methods for programmatic creation.
 *
 * @attr {enum}    data-status=info          — info | success | warning | critical | urgent
 * @attr {string}  data-label                — Toast heading text
 * @attr {string}  data-value                — Toast message content
 * @attr {number}  data-duration=5000         — Auto-dismiss duration in ms
 * @attr {boolean} data-timer-dismiss         — Enable auto-dismiss
 * @attr {boolean} data-show-close=true       — Show close button
 * @attr {enum}    data-position              — top-right | top-left | bottom-right | bottom-left | top-center | bottom-center
 *
 * @fires close
 *   bubbles: true, composed: true
 *   detail: none
 * @fires action
 *   bubbles: true, composed: true
 *   detail: none
 *
 * @method show()                    — Show the toast
 * @method hide()                    — Hide with animation and remove
 * @method setAction(text, callback) — Add action button
 * @method SherpaToast.show(options)           — (static) Create + show toast
 * @method SherpaToast.success(value, options) — (static) Success toast
 * @method SherpaToast.critical(value, options)— (static) Critical toast
 * @method SherpaToast.warning(value, options) — (static) Warning toast
 * @method SherpaToast.info(value, options)    — (static) Info toast
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';

/** Options accepted by SherpaToast.show() and the status helpers. */
interface ToastOptions {
  status?: string;
  heading?: string;
  value?: string;
  duration?: number;
  timerDismiss?: boolean;
  position?: string;
  actionText?: string | null;
  actionCallback?: (() => void) | null;
}

export class SherpaToast extends StatusMixin(SherpaElement) {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-toast.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-toast.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-label', 'data-value', 'data-duration', 'data-timer-dismiss', 'data-show-close', 'data-position'];
  }

  /** Toast uses circle-xmark for critical instead of circle-exclamation. */
  static override get statusIcons() {
    return {
      ...super.statusIcons,
      critical: 'fa-solid fa-circle-xmark',
    };
  }

  /* ── Static container registry ────────────────────────────────── */

  static #containers: Record<string, HTMLElement> = {};

  /* ── Private state ────────────────────────────────────────────── */

  #timeoutId: ReturnType<typeof setTimeout> | null = null;
  #actionCallback: (() => void) | null = null;

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  override onRender(): void {
    this.#syncStatusIcon();
    this.#syncHeading();
    this.#syncValue();

    this.$('.toast-close')?.addEventListener('click', () => this.hide());
    this.$('.toast-action')?.addEventListener('click', () => {
      this.emit('action');
      if (this.#actionCallback) this.#actionCallback();
    });
  }

  override onConnect(): void {
    // Auto-show if created with a value
    if (this.dataset["value"]) {
      this.show();
    }
  }

  override onDisconnect(): void {
    if (this.#timeoutId) clearTimeout(this.#timeoutId);
  }

  onStatusChanged() {
    this.#syncStatusIcon();
  }

  override onAttributeChanged(name: string) {
    switch (name) {
      case 'data-label':
        this.#syncHeading();
        break;
      case 'data-value':
        this.#syncValue();
        break;
    }
  }

  /* ── Public methods ───────────────────────────────────────────── */

  show() {
    const toast = this.$<HTMLElement>('.toast');
    if (toast) {
      toast.dataset["state"] = 'visible';
      this.#startAutoHide();
    }
  }

  hide() {
    const toast = this.$<HTMLElement>('.toast');
    if (!toast) return;
    toast.dataset["state"] = 'hiding';

    setTimeout(() => {
      this.emit('close');
      const container = this.parentElement;
      this.remove();
      if (container?.childElementCount === 0) {
        const pos = container.dataset["position"];
        if (pos) delete SherpaToast.#containers[pos];
        container.remove();
      }
    }, 300);
  }

  setAction(text: string, callback: (() => void) | null) {
    this.#actionCallback = callback;
    const btn = this.$('.toast-action');
    if (btn) {
      btn.textContent = text;
      btn.toggleAttribute('data-visible', !!text);
    }
  }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncStatusIcon() {
    const iconEl = this.$('.default-icon');
    if (!iconEl) return;
    const iconClass = this.statusIcon || (this.constructor as typeof SherpaToast).statusIcons["info"];
    iconEl.className = `${iconClass} sherpa-icon default-icon`;
  }

  #syncHeading() {
    const el = this.$('.toast-heading');
    if (el) el.textContent = this.dataset["label"] || '';
  }

  #syncValue() {
    const el = this.$('.toast-value');
    if (el) el.textContent = this.dataset["value"] || '';
  }

  #startAutoHide() {
    if (this.dataset["timerDismiss"] !== 'true') return;
    const duration = parseInt(this.dataset["duration"] || "") || 5000;
    if (duration <= 0) return;
    if (this.#timeoutId) clearTimeout(this.#timeoutId);
    this.#timeoutId = setTimeout(() => this.hide(), duration);
  }

  /* ── Static factory methods ───────────────────────────────────── */

  static #containerStylesLinked = false;

  /** Link the fixed-position container stylesheet once per document. */
  static #ensureContainerStyles() {
    if (SherpaToast.#containerStylesLinked) return;
    if (document.getElementById('sherpa-toast-container-styles')) {
      SherpaToast.#containerStylesLinked = true;
      return;
    }
    const link = document.createElement('link');
    link.id = 'sherpa-toast-container-styles';
    link.rel = 'stylesheet';
    link.href = new URL('./sherpa-toast-container.css', import.meta.url).href;
    document.head.appendChild(link);
    SherpaToast.#containerStylesLinked = true;
  }

  static #getContainer(position: string): HTMLElement {
    SherpaToast.#ensureContainerStyles();
    if (!SherpaToast.#containers[position]) {
      const el = document.createElement('div');
      el.className = 'sherpa-toast-container';
      el.dataset["position"] = position;
      el.setAttribute('role', 'log');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-relevant', 'additions');
      document.body.appendChild(el);
      SherpaToast.#containers[position] = el;
    }
    return SherpaToast.#containers[position]!;
  }

  /**
   * Create and show a toast programmatically.
   */
  static show(options: ToastOptions = {}): SherpaToast {
    const {
      status = 'info',
      heading = '',
      value = '',
      duration = 5000,
      timerDismiss = false,
      position = 'top-right',
      actionText = null,
      actionCallback = null,
    } = options;

    const toast = document.createElement('sherpa-toast') as SherpaToast;
    toast.dataset["status"] = status;
    if (heading) toast.dataset["label"] = heading;
    if (value) toast.dataset["value"] = value;
    toast.dataset["duration"] = String(duration);
    toast.dataset["timerDismiss"] = timerDismiss ? 'true' : 'false';
    toast.dataset["position"] = position;

    // Defer action setup until rendered
    if (actionText) {
      toast.rendered.then(() => toast.setAction(actionText, actionCallback));
    }

    const container = SherpaToast.#getContainer(position);
    container.appendChild(toast);

    return toast;
  }

  static success(value: string, options: ToastOptions = {})  { return SherpaToast.show({ ...options, status: 'success', value }); }
  static critical(value: string, options: ToastOptions = {}) { return SherpaToast.show({ ...options, status: 'critical', value }); }
  static warning(value: string, options: ToastOptions = {})  { return SherpaToast.show({ ...options, status: 'warning', value }); }
  static info(value: string, options: ToastOptions = {})     { return SherpaToast.show({ ...options, status: 'info', value }); }
}

customElements.define('sherpa-toast', SherpaToast);
