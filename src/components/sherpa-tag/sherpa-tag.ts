/**
 * sherpa-tag — a small pill with a label. CSS owns the look; JS only fires tag-dismiss.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaTag extends SherpaElement {
  static override css = new URL('./sherpa-tag.css', import.meta.url);
  static override html = new URL('./sherpa-tag.html', import.meta.url);
  /** data-icon: an icon name, or a single raw glyph character. */
  static override props = {
    'data-type': { type: 'enum', kind: 'style', values: ['dot'] },
    'data-icon': { type: 'string', kind: 'content', to: '.glyph', as: 'icon' },
    'data-dismissible': { type: 'boolean', kind: 'style' },
  } as const;

  override onRender(): void {
    this.$('.close')?.addEventListener('button-click', this.#onDismiss);
  }

  /** The close button: say so. CSS shows it with `data-dismissible`. */
  #onDismiss = (event: Event): void => {
    event.stopPropagation();
    this.emit('tag-dismiss');
  };
}

define('sherpa-tag', SherpaTag);
