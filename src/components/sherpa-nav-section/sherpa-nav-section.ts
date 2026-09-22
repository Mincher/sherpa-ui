/**
 * sherpa-nav-section — a section label plus a rule, grouping items in a nav rail.
 *
 * Public API:
 *   data-label      the section label text (rendered verbatim)
 *   data-collapsed  present on a collapsed rail — hides the label
 *
 * @tier sub-component
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaNavSection extends SherpaElement {
  static override css = new URL('./sherpa-nav-section.css', import.meta.url);
  static override html = new URL('./sherpa-nav-section.html', import.meta.url);
  static override tier = 'sub-component' as const;
  static override props = {
    'data-collapsed': { type: 'boolean', kind: 'style' },
    'data-label': { type: 'string', kind: 'content', to: '.label' },
  } as const;
}

customElements.define('sherpa-nav-section', SherpaNavSection);
