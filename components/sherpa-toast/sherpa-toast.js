/**
 * sherpa-toast.js
 * SherpaToast — Toast notification extending SherpaElement.
 *
 * @element sherpa-toast
 *
 * @attr {string}  data-status         — info | success | warning | critical | urgent (default: info)
 * @attr {string}  data-label          — toast heading text
 * @attr {string}  data-value          — toast message content
 * @attr {number}  data-duration       — auto-dismiss duration in ms (default: 5000)
 * @attr {string}  data-timer-dismiss  — "true" | "false" — enable auto-dismiss
 * @attr {string}  data-show-close     — "true" | "false" — show close button (default: "true")
 * @attr {string}  data-position       — top-right | top-left | bottom-right | bottom-left | top-center | bottom-center
 *
 * @fires close  — fired when toast is closed
 * @fires action — fired when action button is clicked
 *
 * @method show()  — show the toast
 * @method hide()  — hide the toast
 * @method setAction(text, callback) — add action button
 *
 * Static methods:
 * @method SherpaToast.show(options)             — create + show a toast
 * @method SherpaToast.success(value, options)   — show success toast
 * @method SherpaToast.critical(value, options)  — show critical toast
 * @method SherpaToast.warning(value, options)   — show warning toast
 * @method SherpaToast.info(value, options)      — show info toast
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

  static #getContainer(position) {
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
