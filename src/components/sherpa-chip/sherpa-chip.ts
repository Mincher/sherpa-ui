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
  /** data-icon is a glyph string; CSS `:host(:not([data-icon]))` gates visibility. */
  static override props = {
    'data-icon': { type: 'string', kind: 'content', to: '.glyph' },
  } as const;

  /** The dismissible template adds the close button; default is a plain chip. */
  protected override get templateId(): string | null {
    return this.hasAttribute('data-dismissible') ? 'dismissible' : 'default';
  }

  override onRender(): void {
    this.$('.close')?.addEventListener('click', this.#onRemove);
  }

  #onRemove = (event: Event): void => {
    event.stopPropagation();
    this.emit('chip-remove', {});
  };
}

customElements.define('sherpa-chip', SherpaChip);
