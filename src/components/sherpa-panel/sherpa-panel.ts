/**
 * sherpa-panel — a persistent inline panel; a semantic <section> card.
 *
 * Not floating (that is overlay-panel) and not a disclosure (that is accordion).
 * No native behaviour to adopt — surface, regions and collapsed state are CSS.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaPanel extends SherpaElement {
  static override css = new URL('./sherpa-panel.css', import.meta.url);
  static override html = new URL('./sherpa-panel.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.heading-text' },
  } as const;
}

customElements.define('sherpa-panel', SherpaPanel);
