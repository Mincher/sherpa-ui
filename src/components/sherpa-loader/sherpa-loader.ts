/**
 * sherpa-loader — a spinning "please wait" indicator. CSS owns the whole look;
 * the only JS is the screen-reader role, so it announces itself when it appears.
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
