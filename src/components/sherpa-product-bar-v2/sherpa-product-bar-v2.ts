/**
 * sherpa-product-bar-v2 — the product branding bar.
 *
 * A horizontal bar: a brand name (data-name, or a brand slot) on the inline-start
 * edge, an optional nav slot in the middle, and a trailing actions slot. The old
 * component's system-menu popover orchestration is dropped — this is a structural
 * bar; consumers wire their own switcher into the slots. JS only mirrors the name.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaProductBarV2 extends SherpaElement {
  static override css = new URL('./sherpa-product-bar-v2.css', import.meta.url);
  static override html = new URL('./sherpa-product-bar-v2.html', import.meta.url);
  static override observed = ['data-name'];

  override onRender(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'banner');
    this.#syncName();
  }

  override onChange(): void {
    this.#syncName();
  }

  /** data-name text into the brand label; CSS collapses it when empty. */
  #syncName(): void {
    const el = this.$('.name');
    if (el) el.textContent = this.dataset['name'] ?? '';
  }
}

customElements.define('sherpa-product-bar-v2', SherpaProductBarV2);
