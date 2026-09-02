/**
 * sherpa-tag — a small pill with a label.
 *
 * CSS handles the look — the colour, the style, and the collapsed state. The only
 * behaviour is the optional close button, which fires tag-remove so the app can
 * remove it.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaTag extends SherpaElement {
  static override css = new URL('./sherpa-tag.css', import.meta.url);
  static override html = new URL('./sherpa-tag.html', import.meta.url);

  /** The removable template adds the close button; default is a plain pill. */
  protected override get templateId(): string | null {
    return this.hasAttribute('data-removable') ? 'removable' : 'default';
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
