/**
 * @element sherpa-layout-view
 * @category shell
 * @description Body-content view layout. An embedded
 *   <sherpa-view-header> sits at the top, optional left/right side rails
 *   flank a scrollable content column. The whole region is bounded to
 *   the viewport height by default so the rails stay anchored and only
 *   the content column scrolls.
 *
 *   This is the body-area sibling of <sherpa-layout-grid>:
 *     - sherpa-layout-grid → resizable dashboard grid (12/6/3 cols)
 *     - sherpa-layout-view → standard "view header + rails + scrolling
 *       content" page region
 *
 *   The page chrome (app header / global nav) is the consumer's
 *   responsibility — this component does not include them.
 *
 * @attr {string} [data-heading]      — Header title (shown when present)
 * @attr {string} [data-export-title] — Forwarded to embedded view-header
 * @attr {enum}   [data-fill=viewport] — viewport | parent
 *                                       viewport: clamp to 100dvh
 *                                       parent:   fill flex parent
 * @attr {boolean} [data-pad]         — Apply padding inside the content column
 * @attr {enum}   [data-gap]          — sm | base | lg — gap between
 *                                      stacked content children
 *
 * @slot (default)        — Body content (stacked vertically)
 * @slot header-actions   — Forwarded to the embedded view-header's
 *                          view-selection slot
 * @slot side-panel-start — Leading rail (typically sherpa-panel)
 * @slot side-panel-end   — Trailing rail (typically sherpa-panel)
 *
 * @csspart header
 * @csspart body
 * @csspart content
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-view-header/sherpa-view-header.js';

export class SherpaLayoutView extends SherpaElement {
  static override get cssUrl(): string  { return new URL('./sherpa-layout-view.css',  import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-layout-view.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-heading',
      'data-export-title',
      'data-breadcrumbs',
    ];
  }

  /** @type {HTMLElement|null} */ #headerEl = null;

  override onRender(): void {
    this.#headerEl = this.$('sherpa-view-header.view-header');
    this.#syncHeader();
  }

  override onAttributeChanged(name) {
    if (name === 'data-heading' || name === 'data-export-title' || name === 'data-breadcrumbs') {
      this.#syncHeader();
    }
  }

  #syncHeader() {
    const header = this.#headerEl;
    if (!header) return;
    const heading = this.getAttribute('data-heading');
    if (heading != null) header.setAttribute('data-label', heading);
    else header.removeAttribute('data-label');
    const exportTitle = this.getAttribute('data-export-title');
    if (exportTitle != null) header.setAttribute('data-export-title', exportTitle);
    else header.removeAttribute('data-export-title');
    const breadcrumbs = this.getAttribute('data-breadcrumbs');
    if (breadcrumbs != null) header.setAttribute('data-breadcrumbs', breadcrumbs);
    else header.removeAttribute('data-breadcrumbs');
  }
}

customElements.define('sherpa-layout-view', SherpaLayoutView);
