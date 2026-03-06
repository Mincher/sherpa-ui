/**
 * @component sherpa-loader
 *
 * Animated loading indicator with spinner and optional label.
 *
 * ── Data attributes ───────────────────────────────────────────
 * @attr {string}  [data-label]                  Loading text beside the spinner
 * @attr {string}  [data-orientation=horizontal]  horizontal | vertical
 * @attr {string}  [data-size=default]            small | default | large
 * @attr {flag}    [data-panel]                   Surface background panel
 *
 * ── Accessibility ─────────────────────────────────────────────
 * Sets role="status" and aria-live="polite" on the host so assistive
 * technology announces when the loader appears or its label changes.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaLoader extends SherpaElement {
  static get cssUrl() {
    return new URL("sherpa-loader.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("sherpa-loader.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-label"];
  }

  /** @type {HTMLSpanElement|null} */
  #labelEl = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#labelEl = this.$(".label");

    // Defaults
    if (!this.dataset.orientation) this.dataset.orientation = "horizontal";
    if (!this.dataset.size) this.dataset.size = "default";

    // Accessibility — live region
    if (!this.hasAttribute("role")) this.setAttribute("role", "status");
    if (!this.hasAttribute("aria-live"))
      this.setAttribute("aria-live", "polite");

    this.#syncLabel();
  }

  onAttributeChanged(name, _old, _new) {
    if (name === "data-label") this.#syncLabel();
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncLabel() {
    if (this.#labelEl) {
      this.#labelEl.textContent = this.dataset.label || "";
    }
  }
}

customElements.define("sherpa-loader", SherpaLoader);
export { SherpaLoader };
