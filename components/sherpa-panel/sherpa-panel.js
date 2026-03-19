/**
 * @component sherpa-panel
 *
 * Slide-out or inline panel with header, optional action bar, and content slot.
 *
 * ── Data attributes ───────────────────────────────────────────
 * @attr {string}  [data-variant=inline]     inline | overlay
 * @attr {string}  [data-position=right]     left | right
 * @attr {flag}    [data-expanded]           Expanded (visible) state
 * @attr {string}  [data-heading]            Heading text
 * @attr {string}  [data-width]             Custom width (CSS value)
 *
 * ── Events ────────────────────────────────────────────────────
 * @fires panel-toggle  — { expanded: boolean }
 * @fires panel-close   — Dispatched when the close button is clicked
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaPanel extends SherpaElement {
  static get cssUrl() {
    return new URL("sherpa-panel.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("sherpa-panel.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-heading",
      "data-expanded",
      "data-width",
    ];
  }

  /** @type {HTMLSpanElement|null} */
  #headingEl = null;
  /** @type {HTMLButtonElement|null} */
  #closeBtnEl = null;
  /** @type {HTMLButtonElement|null} */
  #triggerEl = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#headingEl = this.$(".header-title");
    this.#closeBtnEl = this.$(".close-btn");
    this.#triggerEl = this.$(".collapse-trigger");

    // Defaults
    if (!this.dataset.variant) this.dataset.variant = "inline";
    if (!this.dataset.position) this.dataset.position = "right";

    // Listeners
    this.#closeBtnEl?.addEventListener("click", this.#onClose);
    this.#triggerEl?.addEventListener("click", this.#onExpand);

    this.#syncHeading();
    this.#syncWidth();
  }

  onDisconnect() {
    this.#closeBtnEl?.removeEventListener("click", this.#onClose);
    this.#triggerEl?.removeEventListener("click", this.#onExpand);
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-heading":
        this.#syncHeading();
        break;
      case "data-expanded":
        this.#syncToggle();
        break;
      case "data-width":
        this.#syncWidth();
        break;
    }
  }

  /* ── handlers ────────────────────────────────────────────── */

  #onClose = () => {
    delete this.dataset.expanded;
    this.dispatchEvent(
      new CustomEvent("panel-close", { bubbles: true, composed: true })
    );
  };

  #onExpand = () => {
    this.dataset.expanded = "";
  };

  /* ── sync helpers ────────────────────────────────────────── */

  #syncHeading() {
    if (this.#headingEl) {
      this.#headingEl.textContent = this.dataset.heading || "";
    }
  }

  #syncToggle() {
    const expanded = this.hasAttribute("data-expanded");
    this.dispatchEvent(
      new CustomEvent("panel-toggle", {
        bubbles: true,
        composed: true,
        detail: { expanded },
      })
    );
  }

  #syncWidth() {
    if (this.dataset.width) {
      this.style.setProperty("--_panel-width", this.dataset.width);
    } else {
      this.style.removeProperty("--_panel-width");
    }
  }
}

customElements.define("sherpa-panel", SherpaPanel);
export { SherpaPanel };
