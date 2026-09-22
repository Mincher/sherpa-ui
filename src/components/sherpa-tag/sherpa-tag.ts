/** sherpa-tag — a small pill with a label. CSS owns the look; JS only fires tag-remove. */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaTag extends SherpaElement {
  static override css = new URL('./sherpa-tag.css', import.meta.url);
  static override html = new URL('./sherpa-tag.html', import.meta.url);
  /** data-icon: a Font Awesome class list or a single raw glyph character. */
  static override props = {
    'data-type': { type: 'enum', kind: 'style', values: ['dot'] },
    'data-icon': { type: 'string', kind: 'content', to: '.glyph', as: 'icon' },
  } as const;

  /** Picks the template, so a change must re-stamp. */
  static override variantAttrs = ['data-dismissible'];

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
