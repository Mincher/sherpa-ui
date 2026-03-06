/**
 * sherpa-accordion.js
 * SherpaAccordion — Collapsible content panel with heading trigger.
 *
 * Renders a clickable trigger row containing a label and chevron icon.
 * Clicking the trigger toggles the content panel open/closed. Supports
 * keyboard activation (Enter / Space) and ARIA expanded state.
 *
 * Usage:
 *   <sherpa-accordion data-label="Section Title">
 *     Panel content goes here.
 *   </sherpa-accordion>
 *
 *   <sherpa-accordion data-label="Details" data-expanded>
 *     <p>Initially expanded content.</p>
 *   </sherpa-accordion>
 *
 *   <sherpa-accordion data-label="With icon" data-icon="fa-solid fa-gear">
 *     <p>Content with a leading icon.</p>
 *   </sherpa-accordion>
 *
 * Slots:
 *   - heading:  Custom heading content (replaces default label)
 *   - actions:  Trailing action buttons in the trigger row
 *   - (default): Panel content revealed when expanded
 *
 * Attributes:
 *   - data-label:    Heading text for the trigger row
 *   - data-expanded: Boolean — open/closed state
 *   - data-icon:     FontAwesome class for the optional leading icon
 *   - disabled:      Prevents interaction
 *
 * @fires accordion-toggle — { expanded: boolean } when toggled
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaAccordion extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-accordion.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-accordion.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-expanded', 'data-icon', 'disabled'];
  }

  /* ── Cached refs ──────────────────────────────────────────────── */

  #triggerEl  = null;
  #labelEl   = null;
  #iconEl    = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#triggerEl = this.$('.accordion-trigger');
    this.#labelEl  = this.$('.trigger-label');
    this.#iconEl   = this.$('.trigger-icon');

    this.#syncLabel();
    this.#syncIcon();
    this.#syncExpanded();
  }

  onConnect() {
    this.#triggerEl?.addEventListener('click', this.#handleTriggerClick);
    this.#triggerEl?.addEventListener('keydown', this.#handleTriggerKeydown);
  }

  onDisconnect() {
    this.#triggerEl?.removeEventListener('click', this.#handleTriggerClick);
    this.#triggerEl?.removeEventListener('keydown', this.#handleTriggerKeydown);
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-label':    this.#syncLabel(); break;
      case 'data-expanded': this.#syncExpanded(); break;
      case 'data-icon':     this.#syncIcon(); break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /** Whether the accordion panel is currently expanded. */
  get expanded() { return this.hasAttribute('data-expanded'); }
  set expanded(v) { this.toggleAttribute('data-expanded', Boolean(v)); }

  /** The heading label text. */
  get label() { return this.dataset.label || ''; }
  set label(v) { v ? (this.dataset.label = v) : delete this.dataset.label; }

  /** Toggle expanded state programmatically. */
  toggle() {
    if (this.hasAttribute('disabled')) return;
    this.expanded = !this.expanded;
    this.#emitToggle();
  }

  /* ── Sync methods ─────────────────────────────────────────────── */

  #syncLabel() {
    if (this.#labelEl) this.#labelEl.textContent = this.dataset.label || '';
  }

  #syncExpanded() {
    const isExpanded = this.hasAttribute('data-expanded');
    if (this.#triggerEl) {
      this.#triggerEl.setAttribute('aria-expanded', String(isExpanded));
    }
  }

  #syncIcon() {
    if (!this.#iconEl) return;
    // Clear previous icon classes and set new ones
    this.#iconEl.className = 'trigger-icon';
    if (this.dataset.icon) {
      this.dataset.icon.split(' ').forEach(cls => {
        if (cls) this.#iconEl.classList.add(cls);
      });
    }
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #handleTriggerClick = (e) => {
    if (this.hasAttribute('disabled')) return;
    // Don't toggle if the click was on an action button in the slot
    if (e.target.closest('slot[name="actions"]')) return;
    this.toggle();
  };

  #handleTriggerKeydown = (e) => {
    if (this.hasAttribute('disabled')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.toggle();
    }
  };

  #emitToggle() {
    this.dispatchEvent(new CustomEvent('accordion-toggle', {
      bubbles: true,
      composed: true,
      detail: { expanded: this.expanded },
    }));
  }
}

customElements.define('sherpa-accordion', SherpaAccordion);
