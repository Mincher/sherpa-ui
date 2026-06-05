/**
 * @element sherpa-app-shell
 * @category shell
 * @description Full-page application shell. Composes sherpa-nav,
 *   sherpa-product-bar-v2, and a default content slot (typically
 *   sherpa-layout-grid) into the standard nav-rail | product-bar /
 *   content layout.
 *
 *   CSS applies the main-column offset from a mirrored data-nav-pinned
 *   host attribute. JS only syncs the nav pin state onto the shell.
 *   Put the page body inside a <sherpa-layout-grid> in the default slot,
 *   usually with data-content="static" and data-fill="viewport".
 *
 * @slot nav          — sherpa-nav element (absolutely positioned)
 * @slot product-bar  — sherpa-product-bar-v2 (flex: 0 0 auto, 48px)
 * @slot (default)    — main content area (typically a sherpa-layout-grid)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaAppShell extends SherpaElement {
  #wired = false;

  static override get cssUrl(): string {
    return new URL("./sherpa-app-shell.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-app-shell.html", import.meta.url).href;
  }

  override onRender(): void {
    const navSlot = this.$<HTMLSlotElement>('slot[name="nav"]');
    if (!navSlot) return;

    const syncNavState = () => {
      const nav = navSlot
        .assignedElements({ flatten: true })
        .find((el): el is HTMLElement => el instanceof HTMLElement && el.tagName === 'SHERPA-NAV');
      this.toggleAttribute('data-nav-pinned', nav?.dataset['pinned'] === 'true');
    };

    if (!this.#wired) {
      navSlot.addEventListener('slotchange', syncNavState);
      this.addEventListener('navpinchange', syncNavState as EventListener);
      this.#wired = true;
    }

    syncNavState();
  }
}

customElements.define("sherpa-app-shell", SherpaAppShell);
