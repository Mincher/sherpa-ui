/**
 * sherpa-tag — a compact labelled pill.
 *
 * Nearly attribute-only: colour, variant, and collapsed state are pure CSS off
 * `data-*`. The only behaviour is the removable close button, which emits
 * `tag-remove` for the host application to act on.
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
