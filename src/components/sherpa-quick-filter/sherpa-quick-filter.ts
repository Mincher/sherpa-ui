/**
 * sherpa-quick-filter — a toggleable filter chip for toolbars.
 *
 * Behaviour only: it toggles data-active on click and emits quick-filter-click.
 * All appearance (type accent, active tint, count badge, menu caret, disabled) is
 * CSS off data-*. Label and count are mirrored into the chip; nothing else is JS.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaQuickFilter extends SherpaElement {
  static override css = new URL('./sherpa-quick-filter.css', import.meta.url);
  static override html = new URL('./sherpa-quick-filter.html', import.meta.url);
  static override observed = ['data-label', 'data-count'];

  override onRender(): void {
    this.#syncText();
    this.$('.chip')?.addEventListener('click', this.#onClick);
  }

  override onChange(): void {
    this.#syncText();
  }

  get active(): boolean {
    return this.hasAttribute('data-active');
  }
  set active(v: boolean) {
    this.toggleAttribute('data-active', v);
  }

  #syncText(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
    const count = this.$('.count');
    if (count) count.textContent = this.dataset['count'] ?? '';
  }

  #onClick = (): void => {
    if (this.hasAttribute('disabled')) return;
    this.active = !this.active;
    this.emit('quick-filter-click', { active: this.active });
  };
}

customElements.define('sherpa-quick-filter', SherpaQuickFilter);
