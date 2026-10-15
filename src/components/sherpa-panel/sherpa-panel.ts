/**
 * sherpa-panel — a persistent inline panel; a semantic <section> card.
 *
 * Not floating (that is overlay-panel) and not a disclosure (that is accordion).
 * No native behaviour to adopt — surface, regions and collapsed state are CSS.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
// Defined before the template stamps it.
import '../sherpa-container-header/sherpa-container-header.js';

export class SherpaPanel extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-container-regions.css', import.meta.url),
    new URL('./sherpa-panel.css', import.meta.url),
  ];
  static override html = new URL('./sherpa-panel.html', import.meta.url);
  static override props = {
    'data-collapsed': { type: 'boolean', kind: 'style' },
    'data-heading': { type: 'string', kind: 'content', to: '.heading', as: 'attr' },
  } as const;
}

define('sherpa-panel', SherpaPanel);
