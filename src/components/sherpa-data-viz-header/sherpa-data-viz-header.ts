/**
 * sherpa-data-viz-header — the header strip of a metric or a chart's card:
 * Figma's Data Viz Header (1456:30467). CSS owns every part's presence.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaDataVizHeader extends SherpaElement {
  static override css = new URL('./sherpa-data-viz-header.css', import.meta.url);
  static override html = new URL('./sherpa-data-viz-header.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    // A slotted icon wins over the data-icon glyph.
    'data-icon': { type: 'string', kind: 'content', to: '.icon', as: 'icon' },
  } as const;
}

customElements.define('sherpa-data-viz-header', SherpaDataVizHeader);
