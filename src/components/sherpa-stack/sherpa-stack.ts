/**
 * sherpa-stack — a run of items in one direction, with a token gap.
 *
 * No JS: direction, gap, alignment and wrapping are all [data-*] selectors in
 * the CSS. The class exists only to give the element a shadow root and sheet.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaStack extends SherpaElement {
  static override css = new URL('./sherpa-stack.css', import.meta.url);
  static override html = new URL('./sherpa-stack.html', import.meta.url);
}

customElements.define('sherpa-stack', SherpaStack);
