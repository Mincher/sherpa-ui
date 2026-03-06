/**
 * @component sherpa-progress-bar
 *
 * Horizontal progress indicator — determinate or indeterminate.
 *
 * ── Data attributes ───────────────────────────────────────────
 * @attr {string}  [data-label]              Task label above the bar
 * @attr {string}  [data-value]              0–100 percentage (determinate)
 * @attr {string}  [data-variant=determinate] determinate | indeterminate
 * @attr {string}  [data-status-text]        Override auto-generated status text
 *
 * ── Accessibility ─────────────────────────────────────────────
 * Sets role="progressbar" with aria-valuemin, aria-valuemax, and
 * aria-valuenow (determinate) or removes aria-valuenow (indeterminate).
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaProgressBar extends SherpaElement {
  static get cssUrl() {
    return new URL("sherpa-progress-bar.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("sherpa-progress-bar.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-value",
      "data-variant",
      "data-status-text",
    ];
  }

  /** @type {HTMLSpanElement|null} */
  #labelEl = null;
  /** @type {HTMLDivElement|null} */
  #fillEl = null;
  /** @type {HTMLSpanElement|null} */
  #statusEl = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#labelEl = this.$(".label");
    this.#fillEl = this.$(".fill");
    this.#statusEl = this.$(".status");

    // Defaults
    if (!this.dataset.variant) this.dataset.variant = "determinate";

    // Accessibility
    if (!this.hasAttribute("role")) this.setAttribute("role", "progressbar");
    this.setAttribute("aria-valuemin", "0");
    this.setAttribute("aria-valuemax", "100");

    this.#syncLabel();
    this.#syncValue();
  }

  onAttributeChanged(name, _old, _new) {
    switch (name) {
      case "data-label":
        this.#syncLabel();
        break;
      case "data-value":
      case "data-variant":
      case "data-status-text":
        this.#syncValue();
        break;
    }
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncLabel() {
    if (this.#labelEl) {
      this.#labelEl.textContent = this.dataset.label || "";
    }
  }

  #syncValue() {
    const isIndeterminate = this.dataset.variant === "indeterminate";
    const raw = parseFloat(this.dataset.value);
    const value = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;

    // Fill width
    if (this.#fillEl) {
      this.#fillEl.style.setProperty("--_progress", `${value}%`);
    }

    // ARIA
    if (isIndeterminate) {
      this.removeAttribute("aria-valuenow");
    } else {
      this.setAttribute("aria-valuenow", String(value));
    }

    // Status text
    if (this.#statusEl) {
      if (isIndeterminate) {
        this.#statusEl.textContent = "";
      } else {
        this.#statusEl.textContent =
          this.dataset.statusText || `Loading: ${Math.round(value)}%`;
      }
    }
  }
}

customElements.define("sherpa-progress-bar", SherpaProgressBar);
export { SherpaProgressBar };
