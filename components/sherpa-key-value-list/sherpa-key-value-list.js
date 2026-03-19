/**
 * sherpa-key-value-list.js
 * SherpaKeyValueList — Semantic description list built on the native <dl> element.
 *
 * Content is authored directly in the HTML template as <dt>/<dd> pairs.
 * Layout, density, striping and borders are controlled entirely via
 * host attributes and CSS — no JS rendering logic required.
 *
 * Value presentation types are expressed via attributes on <dd>:
 *   data-type="monospace"        — monospace font
 *   data-status="success|…"     — status colour (tokens from status-styles.css)
 *
 * Child components (sherpa-tag, links) are placed directly in <dd>.
 *
 * @element sherpa-key-value-list
 *
 * @attr {string}  layout    - horizontal | vertical (default: horizontal)
 * @attr {string}  density   - compact | base | comfortable (default: base)
 * @attr {boolean} data-striped   - Alternate row backgrounds
 * @attr {boolean} data-bordered  - Show borders (default: true)
 * @attr {boolean} truncate  - Clip long values with ellipsis
 * @attr {string}  key-width - Key column width (default: auto)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-tag/sherpa-tag.js';

export class SherpaKeyValueList extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-key-value-list.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-key-value-list.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-type", "data-key-width"];
  }

  get templateId() {
    return this.dataset.type || 'default';
  }

  onRender() {
    const keyWidth = this.dataset.keyWidth;
    if (keyWidth && keyWidth !== 'auto') {
      this.style.setProperty('--_key-width', keyWidth);
    }
  }
}

customElements.define('sherpa-key-value-list', SherpaKeyValueList);
