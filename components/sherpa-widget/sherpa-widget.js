/**
 * sherpa-widget.js
 * SherpaWidget — Card-like widget wrapper with heading, sizing, and loading.
 *
 * Usage:
 *   <sherpa-widget data-heading="Revenue">
 *     <span>$12,450</span>
 *   </sherpa-widget>
 *
 *   <sherpa-widget data-heading="Pipeline" data-size="large" data-loading>
 *     <div>Loading chart data…</div>
 *     <sherpa-button slot="footer" data-label="Refresh"></sherpa-button>
 *   </sherpa-widget>
 *
 * Slots:
 *   header  — Custom heading content
 *   default — Widget body content
 *   footer  — Footer actions
 *
 * Attributes:
 *   data-heading — Widget heading text
 *   data-size    — small | medium | large
 *   data-loading — Boolean, shows loading overlay
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaWidget extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-widget.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-widget.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-heading',
      'data-size',
      'data-loading',
    ];
  }

  /* ── Element refs ─────────────────────────────────────────────── */

  #headingEl;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#headingEl = this.$('.heading-text');

    // Defaults
    if (!this.dataset.size) this.dataset.size = 'medium';

    this.#syncHeading();
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-heading': this.#syncHeading(); break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get loading() { return this.hasAttribute('data-loading'); }
  set loading(v) { this.toggleAttribute('data-loading', Boolean(v)); }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncHeading() {
    if (this.#headingEl) {
      this.#headingEl.textContent = this.dataset.heading || '';
    }
  }
}

customElements.define('sherpa-widget', SherpaWidget);
