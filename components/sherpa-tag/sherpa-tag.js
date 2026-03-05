/**
 * sherpa-tag.js
 * AuxTag — Compact label component with variant and status support.
 *
 * Usage:
 *   <sherpa-tag data-status="success">New</sherpa-tag>
 *   <sherpa-tag data-variant="secondary">5</sherpa-tag>
 *
 * Attributes:
 *   - data-variant:   primary (default), secondary
 *   - data-status:    critical, info, success, warning, urgent
 *   - data-collapsed: "true" renders as small circular indicator
 */

import { AuxElement } from '../utilities/sherpa-element/sherpa-element.js';

export class AuxTag extends AuxElement {

  static get cssUrl()  { return new URL('./sherpa-tag.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-tag.html', import.meta.url).href; }

  onRender() {
  }
}

customElements.define('sherpa-tag', AuxTag);
