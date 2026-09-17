/**
 * sherpa-stack — a run of items in one direction, with a token gap.
 *
 * There is no JS. Every part of it is a [data-*] selector in the CSS: the
 * direction, the gap, the alignment, whether items wrap. The class exists only
 * to give the element a shadow root and its stylesheet.
 *
 * It is the vertical counterpart to sherpa-toolbar (the horizontal two-zone
 * strip). Before it, every app hand-wrote `display: flex; flex-direction:
 * column; gap: …` in its own stylesheet for a form, a settings page, a dialog
 * footer or a row of cards.
 *
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaStack extends SherpaElement {
  static override css = new URL('./sherpa-stack.css', import.meta.url);
  static override html = new URL('./sherpa-stack.html', import.meta.url);
}

customElements.define('sherpa-stack', SherpaStack);
