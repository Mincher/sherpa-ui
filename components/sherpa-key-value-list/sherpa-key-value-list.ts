/**
 * @element sherpa-key-value-list
 * @category content
 * @description Semantic description list built on the native <dl> element.
 *   Content authored as <dt>/<dd> pairs. Layout, density, striping and borders
 *   controlled via host attributes and CSS.
 *
 * @attr {enum}    [data-layout]    — horizontal | vertical (default: horizontal)
 * @attr {enum}    [data-density]   — compact | base | comfortable (default: base)
 * @attr {boolean} [data-striped]   — Alternate row backgrounds
 * @attr {boolean} [data-bordered]  — Show borders (default: true)
 * @attr {boolean} [data-truncate]  — Clip long values with ellipsis
 * @attr {string}  [data-key-width] — Key column width (default: auto)
 * @attr {enum}    [data-type]      — Template variant
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-tag/sherpa-tag.js';

export class SherpaKeyValueList extends SherpaElement {

  static override get cssUrl(): string  { return new URL('./sherpa-key-value-list.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-key-value-list.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-type"];
  }

  override get templateId(): string {
    return this.dataset["type"] || 'default';
  }

  override onRender(): void {
    const keyWidth = this.dataset["keyWidth"];
    if (keyWidth && keyWidth !== 'auto') {
      this.style.setProperty('--_key-width', keyWidth);
    }
  }
}

customElements.define('sherpa-key-value-list', SherpaKeyValueList);
