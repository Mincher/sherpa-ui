/**
 * @element sherpa-section-header
 * @description Section heading with slots for badge, description, and actions.
 *
 * @attr {string}  [data-label]         — Section title text
 * @attr {enum}    [data-heading-level] — primary | secondary | tertiary
 * @attr {boolean} [data-divider]       — Show bottom divider
 *
 * @slot heading     — Custom heading element (replaces default)
 * @slot badge       — Badge/tag next to heading
 * @slot description — Description text below heading
 * @slot actions     — Action buttons on the right side
 *
 * @prop {string}  heading     — Getter/setter for data-label
 * @prop {string}  headingType — Getter/setter for data-heading-level
 * @prop {boolean} hasDivider  — Getter/setter for data-divider
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaSectionHeader extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-section-header.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-section-header.html', import.meta.url).href; }

  static get observedAttributes() {
    return ['data-label', 'data-heading-level', 'data-divider'];
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    this.#syncHeading();
  }

  onAttributeChanged(name) {
    if (name === 'data-label') {
      this.#syncHeading();
    }
  }

  /**
   * When a custom heading is slotted, hide the default heading text.
   * Other slots use the base `.has-content` toggle.
   */
  onSlotChange(slotEl) {
    super.onSlotChange(slotEl);

    if (slotEl.name === 'heading') {
      const hasCustomHeading = slotEl.assignedNodes().length > 0;
      this.$('.default-heading')?.toggleAttribute('hidden', hasCustomHeading);
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get heading()     { return this.dataset.label || ''; }
  set heading(v)    { v ? (this.dataset.label = v) : delete this.dataset.label; }

  get headingType() { return this.dataset.headingLevel || 'primary'; }
  set headingType(v){ this.dataset.headingLevel = v; }

  get hasDivider()  { return this.dataset.divider === 'true'; }
  set hasDivider(v) { this.dataset.divider = v ? 'true' : 'false'; }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncHeading() {
    const el = this.$('.default-heading');
    if (el) el.textContent = this.dataset.label || '';
  }
}

customElements.define('sherpa-section-header', SherpaSectionHeader);
