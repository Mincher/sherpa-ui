/**
 * sherpa-section-header.js
 * AuxSectionHeader — Section heading with slots extending AuxElement.
 *
 * Usage:
 *   <sherpa-section-header data-label="Section Title"></sherpa-section-header>
 *
 *   <sherpa-section-header data-label="Dashboard" data-divider="true">
 *     <span slot="description">Overview of your metrics</span>
 *     <sherpa-button slot="actions" data-variant="tertiary">
 *       <i slot="icon-start" class="fa-solid fa-plus"></i>
 *       Add Widget
 *     </sherpa-button>
 *   </sherpa-section-header>
 *
 * Slots:
 *   - heading: Custom heading element (replaces default heading)
 *   - badge: Badge/tag next to heading
 *   - description: Description text below heading
 *   - actions: Action buttons on the right side
 *
 * Attributes:
 *   - data-label:         Section title text
 *   - data-heading-level: "primary" | "secondary" | "tertiary"
 *   - data-divider:       "true" | "false" — Shows bottom divider
 */

import { AuxElement } from '../utilities/sherpa-element/sherpa-element.js';

export class AuxSectionHeader extends AuxElement {

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

customElements.define('sherpa-section-header', AuxSectionHeader);
