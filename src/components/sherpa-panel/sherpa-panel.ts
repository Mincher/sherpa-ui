/**
 * sherpa-panel — a persistent inline panel (a semantic <section> card).
 *
 * Native-first (naming standard D2/D12): a panel is a persistent, in-flow region
 * — not floating (that's overlay-panel) and not a disclosure (that's accordion)
 * — so the correct native home is a plain semantic <section>. There is no native
 * behaviour to adopt, so this file is minimal: it just renders the optional
 * data-heading. Everything else — surface, regions, collapsed state — is CSS.
 *
 * @element sherpa-panel
 * @attr {string}  data-heading   — convenience header label (a slotted [slot=header] overrides it)
 * @attr {boolean} data-collapsed — hides the body/footer, leaving the header
 * @attr {enum}    data-status    — status colour cascade (critical | warning | success | info | urgent)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaPanel extends SherpaElement {
  static override css = new URL('./sherpa-panel.css', import.meta.url);
  static override html = new URL('./sherpa-panel.html', import.meta.url);
  static override observed = ['data-heading'];

  override onRender(): void {
    this.#syncHeading();
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncHeading();
  }

  #syncHeading(): void {
    const label = this.$('.heading-text');
    if (label) label.textContent = this.dataset.heading ?? '';
  }
}

customElements.define('sherpa-panel', SherpaPanel);
