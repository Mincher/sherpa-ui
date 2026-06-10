/**
 * @element sherpa-app-shell
 * @category shell
 * @description Top-level full-page application chrome that composes the nav sidebar, product bar,
 *   and main content area. Slot a sherpa-nav into "nav", a sherpa-product-bar-v2 into
 *   "product-bar", and a sherpa-layout-grid into the default slot. The shell automatically
 *   offsets the content column when the nav is pinned vs. collapsed. Use data-content="static"
 *   and data-fill="viewport" on the inner layout grid for a full-height scrollable app layout.
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
