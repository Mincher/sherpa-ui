/**
 * sherpa-accordion — an expand/collapse disclosure section.
 *
 * A header button toggles a collapsible content region. All the visible work —
 * the open/closed animation (grid-template-rows 0fr→1fr), the chevron rotation,
 * the disabled look — is CSS keyed off `data-expanded`. JS only flips that
 * attribute on activation, keeps `aria-expanded` in sync, and emits
 * `accordion-toggle`. Keyboard (Enter/Space) rides on the native <button> trigger.
 *
 * @element sherpa-accordion
 * @attr {boolean} data-expanded — open state (read/write)
 * @attr {string}  data-title    — header text (or use the `title` slot)
 * @attr {boolean} disabled      — blocks interaction
 *
 * @slot title    — custom header content (overrides data-title)
 * @slot (default) — the collapsible panel content
 *
 * @fires accordion-toggle — every toggle. bubbles + composed. detail: { expanded: boolean }
 *
 * @prop {boolean} expanded — open state (read/write)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaAccordion extends SherpaElement {
  static override css = new URL('./sherpa-accordion.css', import.meta.url);
  static override html = new URL('./sherpa-accordion.html', import.meta.url);
  static override observed = ['data-expanded', 'data-title', 'disabled'];

  override onRender(): void {
    this.#syncTitle();
    this.#syncAria();
    this.$('.trigger')?.addEventListener('click', this.#onClick);
  }

  override onChange(name: string): void {
    if (name === 'data-title') this.#syncTitle();
    else this.#syncAria();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get expanded(): boolean {
    return this.hasAttribute('data-expanded');
  }
  set expanded(value: boolean) {
    this.toggleAttribute('data-expanded', value);
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(value: boolean) {
    this.toggleAttribute('disabled', value);
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #onClick = (): void => {
    if (this.disabled) return;
    this.expanded = !this.expanded;
    this.emit('accordion-toggle', { expanded: this.expanded });
  };

  /** A data-title value fills the header text span (the slot overrides it via CSS). */
  #syncTitle(): void {
    const el = this.$('.title-text');
    if (el) el.textContent = this.dataset['title'] ?? '';
  }

  /** Keep the trigger button + panel wired for assistive tech. */
  #syncAria(): void {
    const trigger = this.$('.trigger');
    if (trigger) {
      trigger.setAttribute('aria-expanded', String(this.expanded));
      trigger.toggleAttribute('disabled', this.disabled);
    }
  }
}

customElements.define('sherpa-accordion', SherpaAccordion);
