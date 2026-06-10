/**
 * @element sherpa-toolbar
 * @category content
 * @description Horizontal layout strip with leading, center, and trailing zones plus an
 *   optional filters row. Use inside containers or panels to hold a title or CTA in the
 *   leading zone, a search field in the center, and icon buttons in the trailing zone. The
 *   filters slot adds a row below the strip for filter chips or a filter bar. Pure layout
 *   component — adds no data logic.
 *
 * @attr {enum} data-density — Display density variant
 * @attr {enum} data-template — Layout variant: default | actions (default: default)
 *
 * @slot leading  — Start zone (title, CTA buttons)
 * @slot center   — Center zone (search — grows to fill)
 * @slot trailing — End zone (icon buttons, overflow menu)
 * @slot filters  — Below the toolbar row (filter bar, chips)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaToolbar extends SherpaElement {
  static override get cssUrl(): string  { return new URL('./sherpa-toolbar.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-toolbar.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-density', 'data-template'];
  }

  /* ── Template selection ───────────────────────────────────────
     Consumers pick a layout via `data-template="actions"` etc.
     Defaults to the leading/center/trailing layout. */
  override get templateId(): string {
    return this.dataset["template"] || 'default';
  }
}

customElements.define('sherpa-toolbar', SherpaToolbar);
