/**
 * sherpa-app-shell — the boilerplate frame for an app or a view.
 *
 * A wrapper: the shadow template lays out a nav | header / nav | content grid.
 * Matching the Figma App Shell, the nav and header are PRE-COMPOSED — a
 * <sherpa-nav> and <sherpa-app-header> ship as the named-slot defaults; consumers
 * drop view content in the default slot and can replace the nav/header by slotting
 * their own. Layout, collapse, and the no-header mode are all CSS-owned off the
 * host data-* attributes — this file adds no behaviour beyond observing those attrs.
 *
 * @attr {boolean} data-nav-collapsed  collapse the nav rail to icon width
 * @attr {boolean} data-no-header      drop the header row; content spans full height
 * @slot nav       replace the default <sherpa-nav>
 * @slot header    replace the default <sherpa-app-header>
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
