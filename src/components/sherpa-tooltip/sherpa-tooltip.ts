/**
 * sherpa-tooltip — a hint bubble shown on hover or focus.
 *
 * The bubble is the shared tip: opened in the top layer by its root's own
 * listeners, and placed by CSS, as every component's. TRAP T-a-tooltip-is-always-in-the-top-layer
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

export class SherpaTooltip extends SherpaElement {
  static override css = new URL('./sherpa-tooltip.css', import.meta.url);
  static override html = new URL('./sherpa-tooltip.html', import.meta.url);
  static override props = {
    'data-text': { type: 'string', kind: 'content', to: '.tip-text' },
    'data-placement': { type: 'enum', kind: 'style', values: ['top', 'bottom', 'left', 'right'] },
  } as const;

  /* ── Public API ──────────────────────────────────────────────────────── */

  get text(): string {
    return this.dataset['text'] ?? '';
  }
  set text(value: string) {
    this.set('data-text', value || null);
  }
}

define('sherpa-tooltip', SherpaTooltip);
