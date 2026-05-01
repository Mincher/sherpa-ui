/**
 * @element sherpa-toolbar
 * @description Generic horizontal toolbar with leading/center/trailing content
 *   zones and an optional filters row. Pure layout component — no data logic.
 *
 * @attr {enum} [data-density] — Display density variant
 *
 * @slot leading  — Start zone (title, CTA buttons)
 * @slot center   — Center zone (search — grows to fill)
 * @slot trailing — End zone (icon buttons, overflow menu)
 * @slot filters  — Below the toolbar row (filter bar, chips)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaToolbar extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-toolbar.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-toolbar.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-density', 'data-template'];
  }

  /* ── Template selection ───────────────────────────────────────
     Consumers pick a layout via `data-template="actions"` etc.
     Defaults to the leading/center/trailing layout. */
  get templateId() {
    return this.dataset.template || 'default';
  }
}

customElements.define('sherpa-toolbar', SherpaToolbar);
