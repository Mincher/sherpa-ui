/**
 * sherpa-loader — an animated loading indicator.
 *
 * Attribute-only in appearance: the spinner, its size, orientation and the
 * optional panel surface are all CSS keyed off `data-*`. The only JS is a11y —
 * the host is a live region so assistive tech announces when the loader appears
 * or its label changes.
 *
 * @element sherpa-loader
 * @attr {enum}    data-size         small | default | large
 * @attr {enum}    data-orientation  horizontal | vertical
 * @attr {boolean} data-panel        solid surface background for full-area states
 * @slot label — loading text shown beside the spinner
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaLoader extends SherpaElement {
  static override css = new URL('./sherpa-loader.css', import.meta.url);
  static override html = new URL('./sherpa-loader.html', import.meta.url);

  override onRender(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'status');
    if (!this.hasAttribute('aria-live')) this.setAttribute('aria-live', 'polite');
  }
}

customElements.define('sherpa-loader', SherpaLoader);
