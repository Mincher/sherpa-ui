/**
 * @component sherpa-overlay
 *
 * Full-viewport scrim/backdrop with centred content slot.
 *
 * ── Data attributes ───────────────────────────────────────────
 * @attr {flag}    [data-visible]      Shows the overlay
 * @attr {string}  [data-position]     center | top | bottom
 *
 * ── Events ────────────────────────────────────────────────────
 * @fires overlay-dismiss  — Dispatched when the scrim is clicked (not the content).
 *                           detail: { }
 *
 * ── Accessibility ─────────────────────────────────────────────
 * Sets aria-hidden based on visibility. Traps focus within slotted
 * content when visible (if consumer implements focus-trap logic).
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaOverlay extends SherpaElement {
  static get cssUrl() {
    return new URL("sherpa-overlay.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("sherpa-overlay.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-visible"];
  }

  /** @type {HTMLDivElement|null} */
  #scrimEl = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#scrimEl = this.$(".scrim");

    // Default position
    if (!this.dataset.position) this.dataset.position = "center";

    // Accessibility
    this.setAttribute("aria-hidden", "true");

    // Scrim click → dismiss
    this.#scrimEl?.addEventListener("click", this.#onScrimClick);
  }

  onDisconnect() {
    this.#scrimEl?.removeEventListener("click", this.#onScrimClick);
    this.#unlockScroll();
  }

  onAttributeChanged(name) {
    if (name === "data-visible") {
      this.#syncVisibility();
    }
  }

  /* ── handlers ────────────────────────────────────────────── */

  #onScrimClick = (e) => {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("overlay-dismiss", { bubbles: true, composed: true })
    );
  };

  /* ── sync helpers ────────────────────────────────────────── */

  #syncVisibility() {
    const visible = this.hasAttribute("data-visible");
    this.setAttribute("aria-hidden", String(!visible));

    if (visible) {
      this.#lockScroll();
    } else {
      this.#unlockScroll();
    }
  }

  /* ── scroll lock ─────────────────────────────────────────── */

  #lockScroll() {
    document.documentElement.style.setProperty("overflow", "hidden");
  }

  #unlockScroll() {
    document.documentElement.style.removeProperty("overflow");
  }
}

customElements.define("sherpa-overlay", SherpaOverlay);
export { SherpaOverlay };
