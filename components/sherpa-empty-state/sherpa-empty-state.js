/**
 * sherpa-empty-state.js
 * AuxEmptyState — Empty-state placeholder extending AuxElement.
 *
 * Usage:
 *   <sherpa-empty-state heading="No data" description="Nothing to show"></sherpa-empty-state>
 *   <sherpa-empty-state illustration="search">
 *     <h2 slot="heading">No results</h2>
 *     <p slot="description">Try adjusting your search</p>
 *     <sherpa-button slot="actions" variant="primary">Clear filters</sherpa-button>
 *   </sherpa-empty-state>
 *
 * Slots:
 *   - illustration, heading, description, (default), actions, footer
 *
 * Attributes:
 *   - heading / description / illustration / small-print
 */

import { AuxElement } from '../utilities/sherpa-element/sherpa-element.js';

/* ── Built-in illustration SVGs ──────────────────────────────── */

const ILLUSTRATIONS = {
  empty: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="50" stroke="currentColor" stroke-width="2" stroke-dasharray="8 4" opacity="0.3"/>
    <rect x="35" y="40" width="50" height="40" rx="4" stroke="currentColor" stroke-width="2" opacity="0.5"/>
    <line x1="45" y1="55" x2="75" y2="55" stroke="currentColor" stroke-width="2" opacity="0.3"/>
    <line x1="45" y1="65" x2="65" y2="65" stroke="currentColor" stroke-width="2" opacity="0.3"/>
  </svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="50" cy="50" r="30" stroke="currentColor" stroke-width="3" opacity="0.5"/>
    <line x1="72" y1="72" x2="95" y2="95" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
    <path d="M40 50 L45 55 L60 40" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
  </svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <path d="M20 35 L20 85 L100 85 L100 45 L55 45 L45 35 Z" stroke="currentColor" stroke-width="2" fill="none" opacity="0.5"/>
    <line x1="40" y1="60" x2="80" y2="60" stroke="currentColor" stroke-width="2" opacity="0.3"/>
    <line x1="40" y1="70" x2="70" y2="70" stroke="currentColor" stroke-width="2" opacity="0.3"/>
  </svg>`,
  data: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <ellipse cx="60" cy="40" rx="40" ry="15" stroke="currentColor" stroke-width="2" opacity="0.5"/>
    <path d="M20 40 L20 80 Q60 100 100 80 L100 40" stroke="currentColor" stroke-width="2" fill="none" opacity="0.5"/>
    <ellipse cx="60" cy="60" rx="40" ry="15" stroke="currentColor" stroke-width="2" opacity="0.3"/>
  </svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="2" opacity="0.5"/>
    <line x1="45" y1="45" x2="75" y2="75" stroke="currentColor" stroke-width="3" opacity="0.5"/>
    <line x1="75" y1="45" x2="45" y2="75" stroke="currentColor" stroke-width="3" opacity="0.5"/>
  </svg>`,
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="2" opacity="0.5"/>
    <path d="M40 60 L55 75 L85 45" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
  </svg>`,
};

/* ── Component ─────────────────────────────────────────────────── */

export class AuxEmptyState extends AuxElement {

  static get cssUrl()  { return new URL('./sherpa-empty-state.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-empty-state.html', import.meta.url).href; }

  static get observedAttributes() {
    return ['data-label', 'data-description', 'data-illustration', 'data-small-print'];
  }

  /* ── Cached element refs ──────────────────────────────────────── */

  #titleEl = null;
  #descriptionEl = null;
  #illustrationWrapper = null;
  #illustrationDefault = null;
  #headingWrapper = null;
  #buttonsWrapper = null;
  #smallPrintWrapper = null;
  #smallPrintText = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#titleEl            = this.$('.sherpa-empty-state__title');
    this.#descriptionEl      = this.$('.sherpa-empty-state__description');
    this.#illustrationWrapper = this.$('.sherpa-empty-state__illustration');
    this.#illustrationDefault = this.$('.sherpa-empty-state__illustration-default');
    this.#headingWrapper     = this.$('.sherpa-empty-state__heading');
    this.#buttonsWrapper     = this.$('.sherpa-empty-state__buttons');
    this.#smallPrintWrapper  = this.$('.sherpa-empty-state__small-print');
    this.#smallPrintText     = this.$('.sherpa-empty-state__small-print-text');

    this.#syncAll();
  }

  onConnect() {
    // Slot listeners are auto-wired by AuxElement; override onSlotChange for visibility logic.
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-label':       this.#updateHeading(); break;
      case 'data-description': this.#updateDescription(); break;
      case 'data-illustration': this.#updateIllustration(); break;
      case 'data-small-print': this.#updateSmallPrint(); break;
    }
    this.#applySlotState();
  }

  /**
   * Override AuxElement's default slot-change handler to also
   * re-evaluate section visibility whenever slot content changes.
   */
  onSlotChange(slotEl) {
    super.onSlotChange(slotEl);
    this.#applySlotState();
  }

  /* ── Public getters / setters ─────────────────────────────────── */

  get heading()      { return this.dataset.label || ''; }
  set heading(v)     { v ? this.dataset.label = v : delete this.dataset.label; }

  get description()  { return this.dataset.description || ''; }
  set description(v) { v ? this.dataset.description = v : delete this.dataset.description; }

  get illustration() { return this.dataset.illustration || ''; }
  set illustration(v){ v ? this.dataset.illustration = v : delete this.dataset.illustration; }

  get smallPrint()   { return this.dataset.smallPrint || ''; }
  set smallPrint(v)  { v ? this.dataset.smallPrint = v : delete this.dataset.smallPrint; }

  /* ── Sync helpers ─────────────────────────────────────────────── */

  #syncAll() {
    this.#updateHeading();
    this.#updateDescription();
    this.#updateIllustration();
    this.#updateSmallPrint();
    this.#applySlotState();
  }

  #updateHeading() {
    if (this.#titleEl) this.#titleEl.textContent = this.heading;
  }

  #updateDescription() {
    if (this.#descriptionEl) this.#descriptionEl.textContent = this.description;
  }

  #updateIllustration() {
    if (this.#illustrationDefault) {
      this.#illustrationDefault.innerHTML = ILLUSTRATIONS[this.illustration] || '';
    }
  }

  #updateSmallPrint() {
    if (this.#smallPrintText) this.#smallPrintText.textContent = this.smallPrint;
  }

  /* ── Section visibility ───────────────────────────────────────── */

  #applySlotState() {
    if (!this.#headingWrapper) return;

    const slotHas = (name) => {
      const slot = this.shadow.querySelector(name ? `slot[name="${name}"]` : 'slot:not([name])');
      if (!slot) return false;
      const nodes = slot.assignedNodes({ flatten: true });
      return nodes.some(n =>
        n.nodeType === Node.ELEMENT_NODE ||
        (n.nodeType === Node.TEXT_NODE && n.textContent.trim())
      );
    };

    const hasIllustrationSlot = slotHas('illustration');
    const hasHeadingSlot      = slotHas('heading');
    const hasDescriptionSlot  = slotHas('description');
    const hasDefaultSlot      = slotHas(null);
    const hasActions          = slotHas('actions');
    const hasFooterSlot       = slotHas('footer');

    const hasHeadingAttr      = Boolean(this.heading);
    const hasDescriptionAttr  = Boolean(this.description);
    const hasSmallPrintAttr   = Boolean(this.smallPrint);
    const hasIllustrationAttr = Boolean(this.illustration);

    if (this.#illustrationWrapper) {
      this.#illustrationWrapper.hidden = !(hasIllustrationSlot || hasIllustrationAttr);
      if (this.#illustrationDefault) {
        this.#illustrationDefault.hidden = hasIllustrationSlot || !hasIllustrationAttr;
      }
    }

    if (this.#titleEl) this.#titleEl.hidden = hasHeadingSlot || !hasHeadingAttr;
    if (this.#descriptionEl) this.#descriptionEl.hidden = hasDescriptionSlot || !hasDescriptionAttr;

    if (this.#headingWrapper) {
      this.#headingWrapper.hidden = !(hasHeadingSlot || hasDescriptionSlot || hasDefaultSlot || hasHeadingAttr || hasDescriptionAttr);
    }

    if (this.#buttonsWrapper) this.#buttonsWrapper.hidden = !hasActions;

    if (this.#smallPrintWrapper) {
      this.#smallPrintWrapper.hidden = !(hasFooterSlot || hasSmallPrintAttr);
    }
    if (this.#smallPrintText) {
      this.#smallPrintText.hidden = hasFooterSlot || !hasSmallPrintAttr;
    }
  }
}

customElements.define('sherpa-empty-state', AuxEmptyState);
