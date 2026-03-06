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
    // If a Font Awesome class is specified and no slot content exists,
    // inject an <i> element into the icon container
    if (!this.#iconEl) return;

    const iconClass = this.dataset.productIcon;
    const existingIcon = this.#iconEl.querySelector(".auto-icon");

    if (iconClass) {
      if (existingIcon) {
        existingIcon.className = `auto-icon fa-solid ${iconClass}`;
      } else {
        const i = document.createElement("i");
        i.className = `auto-icon fa-solid ${iconClass}`;
        i.setAttribute("aria-hidden", "true");
        this.#iconEl.appendChild(i);
      }
      // Ensure the icon container is visible via data-has-icon
      if (!this.hasAttribute("data-has-icon")) {
        this.toggleAttribute("data-has-icon", true);
      }
    }
  }
}

customElements.define("sherpa-product-bar", SherpaProductBar);
export { SherpaProductBar };
