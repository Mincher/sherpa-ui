/**
 * @element sherpa-section-header
 * @category content
 * @description Semantic heading row for a content section within a page or panel. Use above any
 *   logically distinct content group that needs a title, optional badge, description, and
 *   trailing action buttons. Three heading levels (primary, secondary, tertiary) control
 *   typographic weight. Add data-divider for a separator line beneath the heading.
 *
 * @attr {string}  data-label         — Section title text
 * @attr {enum}    data-heading-level — primary | secondary | tertiary
 * @attr {boolean} data-divider       — Show bottom divider
 *
 * @slot heading     — Custom heading element (replaces default)
 * @slot badge       — Badge/tag next to heading
 * @slot description — Description text below heading
 * @slot actions     — Action buttons on the right side
 *
 * @prop {string}  headingType — Getter/setter for data-heading-level
 * @prop {boolean} hasDivider  — Getter/setter for data-divider
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaSectionHeader extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-section-header.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-section-header.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return ['data-label', 'data-heading-level', 'data-divider'];
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  override onRender(): void {
    this.#syncHeading();
  }

  override onAttributeChanged(name: string): void {
    if (name === 'data-label') {
      this.#syncHeading();
    }
  }

  /**
   * When a custom heading is slotted, hide the default heading text.
   * Other slots use the base `.has-content` toggle.
   */
  override onSlotChange(slotEl: HTMLSlotElement): void {
    super.onSlotChange(slotEl);

    if (slotEl.name === 'heading') {
      const hasCustomHeading = slotEl.assignedNodes().length > 0;
      this.$('.default-heading')?.toggleAttribute('hidden', hasCustomHeading);
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */


  get headingType(): string { return this.dataset["headingLevel"] || 'primary'; }
  set headingType(v: string){ this.dataset["headingLevel"] = v; }

  get hasDivider(): boolean  { return this.dataset["divider"] === 'true'; }
  set hasDivider(v: boolean) { this.dataset["divider"] = v ? 'true' : 'false'; }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncHeading(): void {
    const el = this.$('.default-heading');
    if (el) el.textContent = this.dataset["label"] || '';
  }
}

customElements.define('sherpa-section-header', SherpaSectionHeader);
