/**
 * sherpa-toolbar — a horizontal strip of controls. Layout only, no behaviour:
 * a leading slot that stretches and a trailing slot that hugs its content.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaToolbar extends SherpaElement {
  static override css = new URL('./sherpa-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-toolbar.html', import.meta.url);
}

customElements.define('sherpa-toolbar', SherpaToolbar);
