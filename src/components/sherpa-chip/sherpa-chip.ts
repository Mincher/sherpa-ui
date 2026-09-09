/**
 * sherpa-chip — a compact input/filter chip.
 *
 * CSS handles the look — the neutral surface, the status cascade, the square
 * radius, and the disabled look. The only behaviour is the optional close button
 * (data-dismissible), which fires chip-remove so the app can remove it, plus
 * mirroring the data-icon glyph value.
 * @fires chip-remove — the dismiss button is clicked. bubbles + composed. detail: {}
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaChip extends SherpaElement {
  static override css = new URL('./sherpa-chip.css', import.meta.url);
  static override html = new URL('./sherpa-chip.html', import.meta.url);
  static override observed = ['data-icon'];

  /** The dismissible template adds the close button; default is a plain chip. */
  protected override get templateId(): string | null {
    return this.hasAttribute('data-dismissible') ? 'dismissible' : 'default';
  }

  override onRender(): void {
    this.#syncIcon();
    this.$('.close')?.addEventListener('click', this.#onRemove);
  }

  override onChange(name: string): void {
    if (name === 'data-icon') this.#syncIcon();
  }

  /** data-icon is a glyph string; CSS `:host(:not([data-icon]))` gates visibility. */
  #syncIcon(): void {
    const glyph = this.$('.glyph');
    if (glyph) glyph.textContent = this.dataset['icon'] ?? '';
  }

  #onRemove = (event: Event): void => {
    event.stopPropagation();
    this.emit('chip-remove', {});
  };
}

customElements.define('sherpa-chip', SherpaChip);
