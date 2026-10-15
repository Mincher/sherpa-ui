/**
 * sherpa-chip — a compact input/filter chip.
 *
 * CSS handles the look — the neutral surface, the status cascade, the square
 * radius, and the disabled look. The only behaviour is the optional close button
 * (data-dismissible), which fires chip-dismiss so the app can remove it, plus
 * mirroring the data-icon glyph value.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaChip extends SherpaElement {
  static override css = new URL('./sherpa-chip.css', import.meta.url);
  static override html = new URL('./sherpa-chip.html', import.meta.url);
  /**
   * data-icon takes an icon name ("price-tag") or a single raw
   * glyph character. CSS `:host(:not([data-icon]))` gates visibility.
   */
  static override props = {
    'data-icon': { type: 'string', kind: 'content', to: '.glyph', as: 'icon' },
    'data-dismissible': { type: 'boolean', kind: 'style' },
  } as const;

  override onRender(): void {
    this.$('.close')?.addEventListener('button-click', this.#onDismiss);
  }

  /** The close button: say so. CSS shows it with `data-dismissible`. */
  #onDismiss = (event: Event): void => {
    event.stopPropagation();
    this.emit('chip-dismiss');
  };
}

define('sherpa-chip', SherpaChip);
