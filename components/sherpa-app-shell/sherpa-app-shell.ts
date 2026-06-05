/**
 * @element sherpa-app-shell
 * @category shell
 * @description Full-page application shell. Composes sherpa-nav,
 *   sherpa-product-bar-v2, and a default content slot (typically
 *   sherpa-layout-grid) into the standard nav-rail | product-bar /
 *   content layout.
 *
 *   Nav rail width is tracked entirely via CSS :has() — no JS required.
 *   When the slotted sherpa-nav has data-pinned="true", :host:has()
 *   widens the rail from 60px to 320px and .app-main margin follows.
 *
 * @slot nav          — sherpa-nav element (absolutely positioned)
 * @slot product-bar  — sherpa-product-bar-v2 (flex: 0 0 auto, 48px)
 * @slot (default)    — main content area (typically sherpa-layout-grid)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaAppShell extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("./sherpa-app-shell.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-app-shell.html", import.meta.url).href;
  }
}

customElements.define("sherpa-app-shell", SherpaAppShell);
