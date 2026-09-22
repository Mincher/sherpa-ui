/**
 * sherpa-empty-state — the "nothing here yet" placeholder for a blank area.
 *
 * A centred icon, a title (data-heading), a message (data-description or your own
 * slotted content), an optional action slot, and an optional muted fine-print
 * line (data-small-print or a slotted small-print). CSS handles the icon and what
 * shows; JS only writes the heading, message, and small-print text.
 */
import { SHARED_PROPS, SherpaElement } from '../../core/sherpa-element.js';

export class SherpaEmptyState extends SherpaElement {
  static override css = new URL('./sherpa-empty-state.css', import.meta.url);
  static override html = new URL('./sherpa-empty-state.html', import.meta.url);
  static override props = {
    'data-illustration': { type: 'enum', kind: 'style', values: ['data', 'empty', 'error', 'folder', 'search', 'success'] },
    'data-size': SHARED_PROPS['data-size'],
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
    'data-description': { type: 'string', kind: 'content', to: '.message-text' },
    'data-small-print': { type: 'string', kind: 'content', to: '.small-print-text' },
  } as const;
}

customElements.define('sherpa-empty-state', SherpaEmptyState);
