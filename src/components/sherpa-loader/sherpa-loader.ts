/**
 * sherpa-loader — a spinning "please wait" indicator.
 *
 * CSS handles the whole look — the spinner, its size, its direction, and the
 * optional background panel. The only JS is for screen readers: it makes the
 * loader announce itself when it appears or its label changes.
 *
 * @element sherpa-loader
 * @attr {enum}    data-size         sm | md | lg   (default md)
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
