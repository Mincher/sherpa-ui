/**
 * sherpa-panel — a persistent inline panel (a semantic <section> card).
 *
 * Native-first (naming standard D2/D12): a panel is a persistent, in-flow region
 * — not floating (that's overlay-panel) and not a disclosure (that's accordion)
 * — so the correct native home is a plain semantic <section>. There is no native
 * behaviour to adopt, so this file is minimal: it just renders the optional
 * data-heading. Everything else — surface, regions, collapsed state — is CSS.
 *
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
