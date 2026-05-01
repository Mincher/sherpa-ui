/**
 * @element sherpa-toast
 * @description Toast notification with auto-dismiss, status variants,
 *   and static factory methods for programmatic creation.
 *
 * @attr {enum}    [data-status=info]          — info | success | warning | critical | urgent
 * @attr {string}  [data-label]                — Toast heading text
 * @attr {string}  [data-value]                — Toast message content
 * @attr {number}  [data-duration=5000]         — Auto-dismiss duration in ms
 * @attr {boolean} [data-timer-dismiss]         — Enable auto-dismiss
 * @attr {boolean} [data-show-close=true]       — Show close button
 * @attr {enum}    [data-position]              — top-right | top-left | bottom-right | bottom-left | top-center | bottom-center
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

export class SherpaToast extends StatusMixin(SherpaElement) {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-toast.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-toast.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-value', 'data-duration', 'data-timer-dismiss', 'data-show-close', 'data-position'];
  }

  /** Toast uses circle-xmark for critical instead of circle-exclamation. */
  static get statusIcons() {
    return {
      ...super.statusIcons,
      critical: 'fa-solid fa-circle-xmark',
    };
  }

  /* ── Static container registry ────────────────────────────────── */

  static #containers = {};

  /* ── Private state ────────────────────────────────────────────── */

  #timeoutId = null;
  #actionCallback = null;

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    this.#syncStatusIcon();
    this.#syncHeading();
    this.#syncValue();

    this.$('.toast-close')?.addEventListener('click', () => this.hide());
    this.$('.toast-action')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true }));
      if (this.#actionCallback) this.#actionCallback();
    });
  }

  onConnect() {
    // Auto-show if created with a value
    if (this.dataset.value) {
      this.show();
    }
  }

  onDisconnect() {
    if (this.#timeoutId) clearTimeout(this.#timeoutId);
  }

  onStatusChanged() {
    this.#syncStatusIcon();
  }

  onAttributeChanged(name) {
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
    const toast = this.$('.toast');
    if (toast) {
      toast.dataset.state = 'visible';
      this.#startAutoHide();
    }
  }

  hide() {
    const toast = this.$('.toast');
    if (!toast) return;
    toast.dataset.state = 'hiding';

    setTimeout(() => {
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
      this.remove();
    }, 300);
  }

  setAction(text, callback) {
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
    const iconClass = this.statusIcon || this.constructor.statusIcons.info;
    iconEl.className = `${iconClass} sherpa-icon default-icon`;
  }

  #syncHeading() {
    const el = this.$('.toast-heading');
    if (el) el.textContent = this.dataset.label || '';
  }

  #syncValue() {
    const el = this.$('.toast-value');
    if (el) el.textContent = this.dataset.value || '';
  }

  #startAutoHide() {
    if (this.dataset.timerDismiss !== 'true') return;
    const duration = parseInt(this.dataset.duration) || 5000;
    if (duration <= 0) return;
    if (this.#timeoutId) clearTimeout(this.#timeoutId);
    this.#timeoutId = setTimeout(() => this.hide(), duration);
  }

  /* ── Static factory methods ───────────────────────────────────── */

  static #stylesInjected = false;

  /** Inject the fixed-position container styles once per document. */
  static #ensureContainerStyles() {
    if (SherpaToast.#stylesInjected) return;
    if (document.getElementById('sherpa-toast-container-styles')) {
      SherpaToast.#stylesInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.id = 'sherpa-toast-container-styles';
    style.textContent = `
      .sherpa-toast-container {
        position: fixed;
        z-index: var(--sherpa-z-toast, 1100);
        display: flex;
        flex-direction: column;
        gap: var(--sherpa-space-xs, 8px);
        padding: var(--sherpa-space-md, 16px);
        pointer-events: none;
        max-width: 100vw;
      }
      .sherpa-toast-container > * { pointer-events: auto; }

      .sherpa-toast-container[data-position="top-right"]    { top: 0; right: 0; align-items: flex-end; }
      .sherpa-toast-container[data-position="top-left"]     { top: 0; left: 0;  align-items: flex-start; }
      .sherpa-toast-container[data-position="bottom-right"] { bottom: 0; right: 0; align-items: flex-end; flex-direction: column-reverse; }
      .sherpa-toast-container[data-position="bottom-left"]  { bottom: 0; left: 0;  align-items: flex-start; flex-direction: column-reverse; }
      .sherpa-toast-container[data-position="top-center"]    { top: 0; left: 50%; transform: translateX(-50%); align-items: center; }
      .sherpa-toast-container[data-position="bottom-center"] { bottom: 0; left: 50%; transform: translateX(-50%); align-items: center; flex-direction: column-reverse; }
    `;
    document.head.appendChild(style);
    SherpaToast.#stylesInjected = true;
  }

  static #getContainer(position) {
    SherpaToast.#ensureContainerStyles();
    if (!SherpaToast.#containers[position]) {
      const el = document.createElement('div');
      el.className = 'sherpa-toast-container';
      el.dataset.position = position;
      document.body.appendChild(el);
      SherpaToast.#containers[position] = el;
    }
    return SherpaToast.#containers[position];
  }

  /**
   * Create and show a toast programmatically.
   * @param {Object} options
   * @returns {SherpaToast}
   */
  static show(options = {}) {
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

    const toast = document.createElement('sherpa-toast');
    toast.dataset.status = status;
    if (heading) toast.dataset.label = heading;
    if (value) toast.dataset.value = value;
    toast.dataset.duration = duration;
    toast.dataset.timerDismiss = timerDismiss ? 'true' : 'false';
    toast.dataset.position = position;

    // Defer action setup until rendered
    if (actionText) {
      toast.rendered.then(() => toast.setAction(actionText, actionCallback));
    }

    const container = SherpaToast.#getContainer(position);
    container.appendChild(toast);

    return toast;
  }

  static success(value, options = {})  { return SherpaToast.show({ ...options, status: 'success', value }); }
  static critical(value, options = {}) { return SherpaToast.show({ ...options, status: 'critical', value }); }
  static warning(value, options = {})  { return SherpaToast.show({ ...options, status: 'warning', value }); }
  static info(value, options = {})     { return SherpaToast.show({ ...options, status: 'info', value }); }
}

customElements.define('sherpa-toast', SherpaToast);
