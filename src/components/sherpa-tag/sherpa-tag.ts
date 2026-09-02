/**
 * sherpa-tag — a small pill with a label.
 *
 * CSS handles the look — the colour, the style, and the dot type (data-type="dot").
 * The only behaviour is the optional close button (data-dismissible), which fires
 * tag-remove so the app can remove it, plus mirroring the data-icon glyph value.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaTag extends SherpaElement {
  static override css = new URL('./sherpa-tag.css', import.meta.url);
  static override html = new URL('./sherpa-tag.html', import.meta.url);
  static override observed = ['data-icon'];

  /** The dismissible template adds the close button; default is a plain pill. */
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
    this.emit('tag-remove');
  };
}

customElements.define('sherpa-tag', SherpaTag);
