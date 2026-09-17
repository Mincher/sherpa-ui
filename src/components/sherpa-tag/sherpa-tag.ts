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
  /**
   * data-icon takes a Font Awesome class list ("fa-solid fa-tag") or a single raw
   * glyph character. CSS `:host(:not([data-icon]))` gates visibility.
   */
  static override props = {
    'data-icon': { type: 'string', kind: 'content', to: '.glyph', as: 'icon' },
  } as const;

  /** `data-dismissible` picks the tree, so a change to it has to re-stamp. */
  static override variantAttrs = ['data-dismissible'];

  /** The dismissible template adds the close button; default is a plain pill. */
  protected override get templateId(): string | null {
    return this.hasAttribute('data-dismissible') ? 'dismissible' : 'default';
  }

  override onRender(): void {
    this.$('.close')?.addEventListener('click', this.#onRemove);
  }

  #onRemove = (event: Event): void => {
    event.stopPropagation();
    this.emit('tag-remove');
  };
}

customElements.define('sherpa-tag', SherpaTag);
