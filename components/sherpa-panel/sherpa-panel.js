/**
 * sherpa-panel.js
 * SherpaPanel — Slide-out or inline panel with header and content area.
 *
 * @element sherpa-panel
 *
 * @attr {enum}    data-variant   — inline | overlay | side
 * @attr {enum}    data-position  — left | right | both
 * @attr {boolean} data-expanded  — Expanded (visible) state
 * @attr {string}  data-heading   — Heading text
 * @attr {string}  data-width     — Custom width (CSS value)
 *
 * @slot           — Default slot for panel body content
 * @slot controls  — Header control buttons
 * @slot metadata  — Metadata content area
 * @slot actions   — Action bar content
 *
 * @fires panel-toggle — Fired when expanded state changes
 *   bubbles: true, composed: true
 *   detail: { expanded: boolean }
 * @fires panel-close — Fired when the close button is clicked
 *   bubbles: true, composed: true
 *   detail: { }
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
