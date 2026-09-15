/**
 * sherpa-nav-section — a section-label divider for a navigation rail.
 *
 * A short label followed by a horizontal rule. Groups items inside a nav. On a
 * collapsed rail (data-collapsed) CSS hides the label and leaves only the rule.
 * JS does nothing but mirror data-label into the label span — everything else
 * is HTML + CSS.
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
    'data-label': { type: 'string', kind: 'content', to: '.label' },
  } as const;
}

customElements.define('sherpa-nav-section', SherpaNavSection);
