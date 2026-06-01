/**
 * sherpa-loader.js
 * SherpaLoader — Animated loading indicator with spinner and optional label.
 *
 * Sets role="status" and aria-live="polite" on the host so assistive
 * technology announces when the loader appears or its label changes.
 *
 * @element sherpa-loader
 * @category feedback
 *
 * @attr {string}  data-label       — Loading text beside the spinner
 * @attr {enum}    data-orientation  — horizontal | vertical
 * @attr {enum}    data-size         — small | default | large
 * @attr {boolean} data-panel        — Surface background panel mode
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaLoader extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("sherpa-loader.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-loader.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-label"];
  }

  els = this.cacheElements({
    label: { selector: '.label', type: HTMLSpanElement }
  });

  /* ── lifecycle ───────────────────────────────────────────── */

  override onRender(): void {
    // Defaults
    if (!this.dataset.orientation) this.dataset.orientation = "horizontal";
    if (!this.dataset.size) this.dataset.size = "default";

    // Accessibility — live region
    if (!this.hasAttribute("role")) this.setAttribute("role", "status");
    if (!this.hasAttribute("aria-live"))
      this.setAttribute("aria-live", "polite");

    this.#syncLabel();
  }

  override onAttributeChanged(name, _old, _new) {
    if (name === "data-label") this.#syncLabel();
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncLabel() {
    if (this.els.label) {
      this.els.label.textContent = this.dataset.label || "";
    }
  }
}

customElements.define("sherpa-loader", SherpaLoader);
export { SherpaLoader };
