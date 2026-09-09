/**
 * sherpa-toolbar — a horizontal strip of controls.
 *
 * Just layout. It has two zones — leading and trailing — each a slot you drop
 * controls into. The leading zone stretches to fill; trailing stays the size of
 * its content. Empty zones collapse on their own. No behaviour of its own.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaToolbar extends SherpaElement {
  static override css = new URL('./sherpa-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-toolbar.html', import.meta.url);
}

customElements.define('sherpa-toolbar', SherpaToolbar);
