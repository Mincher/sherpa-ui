/**
 * sherpa-app-shell — the application frame.
 *
 * Entirely declarative: it's a structural grid that slots nav / header / content
 * into fixed regions. The header collapses when empty (base-class data-has-header)
 * and the nav rail narrows on data-nav-collapsed — both pure CSS. No behaviour.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaAppShell extends SherpaElement {
  static override css = new URL('./sherpa-app-shell.css', import.meta.url);
  static override html = new URL('./sherpa-app-shell.html', import.meta.url);
}

customElements.define('sherpa-app-shell', SherpaAppShell);
