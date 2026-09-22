/**
 * sherpa-section-header — a heading row above a section of content.
 *
 * A title (from data-heading, or your own slotted heading), an optional description,
 * and a slot for action buttons on the right. data-size sets how big the heading
 * is; the bottom rule shows by default (set data-divider="none" to hide it). CSS handles the look; JS only
 * writes the heading text.
 */
import { SHARED_PROPS, SherpaElement } from '../../core/sherpa-element.js';

export class SherpaSectionHeader extends SherpaElement {
  static override css = new URL('./sherpa-section-header.css', import.meta.url);
  static override html = new URL('./sherpa-section-header.html', import.meta.url);
  static override props = {
    'data-divider': { type: 'enum', kind: 'style', values: ['none'] },
    'data-size': SHARED_PROPS['data-size'],
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
  } as const;
}

customElements.define('sherpa-section-header', SherpaSectionHeader);
