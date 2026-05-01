/**
 * @element sherpa-layout-grid
 * @description Responsive dashboard grid. Slotted
 *   <sherpa-container data-variant="resizable"> children take grid spans
 *   from their data-col-span / data-row-span attributes.
 *
 *   Replaces the legacy `.sherpa-content-area` CSS class with a real
 *   web component so the grid setup, breakpoints, and span rules are
 *   shadow-scoped and don't leak into consumer CSS.
 *
 * @attr {string}  [data-row-height]      — CSS length for grid-auto-rows (default: 160px)
 * @attr {enum}    [data-content]         — "static" — opts out of grid; stacks children
 *
 * @slot (default) — sherpa-container children
 *
 * @cssprop --maxColCount — Integer column count (default 12, registered)
 * @cssprop --row-height  — Row height (default 160px, registered)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaLayoutGrid extends SherpaElement {
  static get htmlUrl() {
    return new URL("./sherpa-layout-grid.html", import.meta.url).href;
  }

  static get cssUrl() {
    return new URL("./sherpa-layout-grid.css", import.meta.url).href;
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-row-height"];
  }

  onRender() {
    this.#syncRowHeight();
  }

  onAttributeChanged(name) {
    if (name === "data-row-height") this.#syncRowHeight();
  }

  #syncRowHeight() {
    const value = this.dataset.rowHeight;
    if (value) {
      this.style.setProperty("--row-height", value);
    } else {
      this.style.removeProperty("--row-height");
    }
  }
}

customElements.define("sherpa-layout-grid", SherpaLayoutGrid);
