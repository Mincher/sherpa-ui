/**
 * @element sherpa-container
 * @description Pure wrapper container for dashboard composition. Owns sizing
 *   (variant, col/row span) and exposes a named container query scope
 *   (`sherpa-container`) so descendant viz components (charts, grids) can
 *   adapt their internal layout via container queries.
 *
 *   Header, filter bar, and metric content all live as light-DOM children —
 *   the container does no structural rendering of its own.
 *
 *   Resize behaviour (col/row span adjustment via overflow menu) is provided
 *   by the ResizeBehavior mixin, which injects menu items into a light-DOM
 *   <template data-menu-resize>.
 *
 * @attr {enum}    [data-variant=fit]   — fit | resizable | fill
 * @attr {number}  [data-col-span]      — Column span: 3 | 6 | 9 | 12 (resizable)
 * @attr {number}  [data-row-span]      — Row span: 1–6 (resizable)
 * @attr {boolean} [data-editable]      — Edit mode (enables resize grip)
 * @attr {boolean} [data-menu-open]     — Reflected while a descendant menu is open
 *
 * @slot (default) — Consumer composition: sherpa-container-header,
 *                   sherpa-filter-bar, viz components.
 *
 * @fires container-increase-cols — Bubbled from injected resize menu items
 * @fires container-decrease-cols — Bubbled from injected resize menu items
 * @fires container-increase-rows — Bubbled from injected resize menu items
 * @fires container-decrease-rows — Bubbled from injected resize menu items
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { ResizeBehavior } from "../utilities/resize-behavior.js";

export class SherpaContainer extends ResizeBehavior(SherpaElement) {
  static get htmlUrl() {
    return new URL("./sherpa-container.html", import.meta.url).href;
  }

  static get cssUrl() {
    return new URL("./sherpa-container.css", import.meta.url).href;
  }

  /* ── Lifecycle ─────────────────────────────────────────────── */

  onRender() {
    if (!this.dataset.variant) this.dataset.variant = "fit";
  }

  onConnect() {
    super.onConnect();
    // Reflect descendant overflow-menu state onto the host so CSS can
    // elevate z-index and switch overflow visibility.
    this.addEventListener("menu-open", this.#onMenuOpen);
    this.addEventListener("menu-close", this.#onMenuClose);
  }

  onDisconnect() {
    super.onDisconnect();
    this.removeEventListener("menu-open", this.#onMenuOpen);
    this.removeEventListener("menu-close", this.#onMenuClose);
  }

  #onMenuOpen = () => {
    this.dataset.menuOpen = "true";
  };

  #onMenuClose = () => {
    delete this.dataset.menuOpen;
  };
}

customElements.define("sherpa-container", SherpaContainer);
