/**
 * sherpa-example.js
 * SherpaExample — One-line description of what this component does.
 *
 * @element sherpa-example
 * @category control
 *
 * @attr {string}  data-label    — Visible label text displayed inside the component
 * @attr {enum}    data-variant  — Visual style: primary | secondary | tertiary
 * @attr {string}  data-icon-start — Icon character code for the leading icon (e.g. &#xf067;)
 * @attr {string}  data-description — Secondary description text (shown when present)
 * @attr {boolean} disabled      — Native disabled state
 *
 * @slot           — Default content slot
 * @slot actions   — Trailing action buttons or secondary content
 *
 * @fires example-click — Fired when the component is activated by click or keyboard.
 *   bubbles: true, composed: true
 *   detail: { }
 *
 * @method focus() — Programmatically focus the component
 *   @returns {void}
 *
 * @csspart wrapper — The main wrapper element
 *
 * @cssprop --sherpa-example-gap — Gap between icon and label (default: 8px)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaExample extends SherpaElement {

  /* ── Static ───────────────────────────────────────────────────── */

  static get cssUrl() {
    return new URL('./sherpa-example.css', import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL('./sherpa-example.html', import.meta.url).href;
  }

  static get observedAttributes() {
    // Always spread super — inherits data-status, aria attributes, and others from SherpaElement.
    return [...super.observedAttributes, 'data-label', 'data-variant', 'data-icon-start', 'data-description'];
  }

  /* ── Private refs ─────────────────────────────────────────────── */

  #labelEl      = null;
  #descriptionEl = null;
  #iconStartEl  = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  /**
   * onRender() — Shadow DOM is populated and ready.
   * Cache element refs, set attribute defaults, wire internal event listeners.
   */
  onRender() {
    this.#labelEl       = this.$('.label');
    this.#descriptionEl = this.$('.description');
    this.#iconStartEl   = this.$('.icon-start');

    // Set a default variant so CSS variant selectors always match something.
    if (!this.dataset.variant) this.dataset.variant = 'primary';

    this.#syncLabel();
    this.#syncDescription();
    this.#syncIconStart();

    // Wire internal click — delegate from wrapper to avoid shadow boundary issues.
    this.$('.wrapper').addEventListener('click', () => {
      if (this.disabled) return;
      this.#emit('example-click', {});
    });
  }

  /**
   * onConnect() — Element has entered the document.
   * Runs once after the first render. Use for DOM-presence-dependent setup
   * (e.g. ResizeObserver, IntersectionObserver, external event listeners).
   */
  onConnect() {
    // Example: this.#resizeObserver.observe(this);
  }

  /**
   * onDisconnect() — Element has been removed from the document.
   * Clean up: disconnect observers, remove external event listeners, clear timers.
   */
  onDisconnect() {
    // Example: this.#resizeObserver.disconnect();
  }

  /**
   * onAttributeChanged(name, oldValue, newValue)
   * Called for every attribute in observedAttributes that changes after initial render.
   * Always call super first.
   */
  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);

    if (name === 'data-label')       this.#syncLabel();
    if (name === 'data-description') this.#syncDescription();
    if (name === 'data-icon-start')  this.#syncIconStart();
  }

  /**
   * onStatusChanged(status)
   * Called when the inherited data-status value changes (set on an ancestor).
   * Override to react to status changes — e.g. updating ARIA labels.
   */
  onStatusChanged(status) {
    // Example: this.setAttribute('aria-label', `${status}: ${this.dataset.label}`);
  }

  /* ── Public methods ───────────────────────────────────────────── */

  focus() {
    this.$('.wrapper')?.focus();
  }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncLabel() {
    if (this.#labelEl) {
      this.#labelEl.textContent = this.dataset.label ?? '';
    }
  }

  #syncDescription() {
    if (this.#descriptionEl) {
      this.#descriptionEl.textContent = this.dataset.description ?? '';
    }
  }

  #syncIconStart() {
    if (this.#iconStartEl) {
      // innerHTML to support HTML character code glyphs (e.g. &#xf067;)
      this.#iconStartEl.innerHTML = this.dataset.iconStart ?? '';
    }
  }

  /**
   * #emit(name, detail) — Dispatch a CustomEvent on this element.
   * Always bubbles and composes through shadow DOM boundaries.
   */
  #emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, {
      bubbles:  true,
      composed: true,
      detail,
    }));
  }
}

customElements.define('sherpa-example', SherpaExample);
