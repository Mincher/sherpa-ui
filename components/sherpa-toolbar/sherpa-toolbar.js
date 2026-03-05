/**
 * sherpa-toolbar.js
 * Generic horizontal toolbar with leading/center/trailing content zones
 * and an optional filters row below.
 *
 * Pure layout component — no data logic. Consumers slot buttons,
 * search inputs, filter bars, and other controls into the zones.
 *
 * Usage:
 *   <sherpa-toolbar>
 *     <span slot="leading" class="text-label-sm">Data Grid</span>
 *     <sherpa-input-search slot="center"></sherpa-input-search>
 *     <sherpa-button slot="trailing" data-variant="tertiary" data-size="small"
 *       data-icon-start="&#xf019;" aria-label="Export"></sherpa-button>
 *     <sherpa-filter-bar slot="filters">…</sherpa-filter-bar>
 *   </sherpa-toolbar>
 *
 * Slots:
 *   leading   — Start zone (title, CTA buttons)
 *   center    — Center zone (search — grows to fill)
 *   trailing  — End zone (icon buttons, overflow menu)
 *   filters   — Below the toolbar row (filter bar, chips)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaToolbar extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-toolbar.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-toolbar.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-density'];
  }
}

customElements.define('sherpa-toolbar', SherpaToolbar);
