/**
 * sherpa-tag.js
 * SherpaTag — Compact label component with variant and status support.
 *
 * @element sherpa-tag
 *
 * @attr {enum}    data-variant   — primary | secondary
 * @attr {enum}    data-status    — critical | info | success | warning | urgent
 * @attr {boolean} data-collapsed — Renders as small circular indicator
 *
 * @slot — Default slot for tag label content
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaTag extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-tag.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-tag.html', import.meta.url).href; }
}

customElements.define('sherpa-tag', SherpaTag);
