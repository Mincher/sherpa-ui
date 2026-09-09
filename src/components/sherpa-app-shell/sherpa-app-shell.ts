/**
 * sherpa-app-shell — the boilerplate frame for an app or a view.
 *
 * A pure wrapper: the shadow template lays out a nav | header / nav | content
 * grid with three empty named slots. Consumers drop <sherpa-nav>, an app header,
 * and their view content into the slots. Layout, collapse, and the no-header
 * mode are all CSS-owned off the host data-* attributes — this file adds no
 * behaviour beyond observing those attrs so the base class re-renders slot state.
 *
 * @attr {boolean} data-nav-collapsed  collapse the nav rail to icon width
 * @attr {boolean} data-no-header      drop the header row; content spans full height
 * @slot nav       the navigation rail
 * @slot header    the app header row
 * @slot (default) the view content
 * @fires nothing
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaAppShell extends SherpaElement {
  static override css = new URL('./sherpa-app-shell.css', import.meta.url);
  static override html = new URL('./sherpa-app-shell.html', import.meta.url);
  static override observed = ['data-nav-collapsed', 'data-no-header'];
}

customElements.define('sherpa-app-shell', SherpaAppShell);
