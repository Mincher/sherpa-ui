/**
 * @component sherpa-product-bar
 *
 * Top-level product branding bar with icon, name, navigation, and actions.
 *
 * ── Data attributes ───────────────────────────────────────────
 * @attr {string}  [data-product-name]   Product display name
 * @attr {string}  [data-product-icon]   Font Awesome icon class (e.g. "fa-cube")
 *
 * ── Slots ─────────────────────────────────────────────────────
 * icon     — Custom product icon content
 * default  — Navigation items
 * actions  — Right-aligned action buttons
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaProductBar extends SherpaElement {
  static get cssUrl() {
    return new URL("sherpa-product-bar.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("sherpa-product-bar.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-product-name",
      "data-product-icon",
    ];
  }

  /** @type {HTMLSpanElement|null} */
  #nameEl = null;
  /** @type {HTMLDivElement|null} */
  #iconEl = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#nameEl = this.$(".product-name");
    this.#iconEl = this.$(".product-icon");

    // ARIA
    if (!this.hasAttribute("role")) this.setAttribute("role", "banner");

    this.#syncName();
    this.#syncIcon();
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-product-name":
        this.#syncName();
        break;
      case "data-product-icon":
        this.#syncIcon();
        break;
    }
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncName() {
    if (this.#nameEl) {
      this.#nameEl.textContent = this.dataset.productName || "";
    }
  }

  #syncIcon() {
    if (!this.#iconEl) return;

    const iconClass = this.dataset.productIcon;
    const iconEl = this.#iconEl.querySelector(".auto-icon");

    if (iconClass && iconEl) {
      iconEl.className = `auto-icon fa-solid ${iconClass}`;
    }
    this.toggleAttribute("data-has-icon", !!iconClass);
  }
}

customElements.define("sherpa-product-bar", SherpaProductBar);
export { SherpaProductBar };
