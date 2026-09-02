/**
 * sherpa-quick-filter — a filter chip you can toggle on and off.
 *
 * Clicking it flips it on or off and fires quick-filter-click. CSS handles the
 * look — the accent colour, the on-state tint, the count badge, the caret, and
 * the disabled look. JS only writes the label and count.
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

  get current(): boolean {
    return this.hasAttribute('data-current');
  }
  set current(v: boolean) {
    this.toggleAttribute('data-current', v);
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
    this.current = !this.current;
    this.emit('quick-filter-click', { active: this.current });
  };
}

customElements.define('sherpa-quick-filter', SherpaQuickFilter);
