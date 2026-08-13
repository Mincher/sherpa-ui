/**
 * sherpa-app-header — the top application header bar (app-shell's header slot).
 *
 * A simple flex bar: a leading region (title from data-title, or a breadcrumb
 * slot) on the inline-start edge, an optional search slot in the middle, and a
 * trailing actions slot on the end. Almost entirely declarative — the base class
 * reflects slot presence to data-has-{slot}; JS only mirrors data-title text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaAppHeader extends SherpaElement {
  static override css = new URL('./sherpa-app-header.css', import.meta.url);
  static override html = new URL('./sherpa-app-header.html', import.meta.url);
  static override observed = ['data-title'];

  override onRender(): void {
    this.#syncTitle();
  }

  override onChange(): void {
    this.#syncTitle();
  }

  /** data-title text into the heading; CSS collapses it when empty. */
  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['title'] ?? '';
  }
}

customElements.define('sherpa-app-header', SherpaAppHeader);
