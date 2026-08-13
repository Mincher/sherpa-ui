/**
 * sherpa-panel — a titled, collapsible content panel.
 *
 * A sectioned surface: a header (data-title or a slotted heading, plus optional
 * controls), a scrollable body (default slot), and an optional footer. A chevron
 * button in the header collapses the body to just its title row. Everything
 * visible is CSS off data-* and the base class's data-has-{slot} reflection — JS
 * only writes the title text, flips data-collapsed on the toggle, keeps
 * aria-expanded in sync, and emits panel-toggle.
 *
 * @element sherpa-panel
 * @attr {string}  data-title      — header text (or use the `heading` slot)
 * @attr {boolean} data-collapsed  — collapsed state (read/write)
 *
 * @slot heading   — custom heading content (overrides data-title)
 * @slot controls  — header control buttons, before the collapse toggle
 * @slot (default) — the panel body
 * @slot footer    — a pinned footer region (reflects data-has-footer)
 *
 * @fires panel-toggle — every collapse/expand. bubbles + composed. detail: { collapsed: boolean }
 *
 * @prop {boolean} collapsed — collapsed state (read/write)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaPanel extends SherpaElement {
  static override css = new URL('./sherpa-panel.css', import.meta.url);
  static override html = new URL('./sherpa-panel.html', import.meta.url);
  static override observed = ['data-title', 'data-collapsed'];

  override onRender(): void {
    this.#syncTitle();
    this.#syncAria();
    this.$('.toggle')?.addEventListener('click', this.#onToggle);
  }

  override onChange(name: string): void {
    if (name === 'data-title') this.#syncTitle();
    else this.#syncAria();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get collapsed(): boolean {
    return this.hasAttribute('data-collapsed');
  }
  set collapsed(value: boolean) {
    this.toggleAttribute('data-collapsed', value);
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #onToggle = (): void => {
    this.collapsed = !this.collapsed;
    this.emit('panel-toggle', { collapsed: this.collapsed });
  };

  #syncTitle(): void {
    const el = this.$('.title-text');
    if (el) el.textContent = this.dataset['title'] ?? '';
  }

  #syncAria(): void {
    const toggle = this.$('.toggle');
    if (toggle) toggle.setAttribute('aria-expanded', String(!this.collapsed));
  }
}

customElements.define('sherpa-panel', SherpaPanel);
