/**
 * sherpa-toolbar — a horizontal control strip.
 *
 * Pure layout: a flex bar with start / center / end zones (each a named slot).
 * The center zone grows to fill; start and end hug their content. The base class
 * reflects data-has-{slot} so empty zones collapse — no JS touches visibility.
 * Adds no data logic.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaToolbar extends SherpaElement {
  static override css = new URL('./sherpa-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-toolbar.html', import.meta.url);
}

customElements.define('sherpa-toolbar', SherpaToolbar);
