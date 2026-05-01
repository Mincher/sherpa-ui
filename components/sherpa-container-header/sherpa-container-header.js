/**
 * sherpa-container-header.js
 * SherpaContainerHeader — Header row for sherpa-container.
 *
 * Renders title, description, and optional action buttons (drag handle,
 * open-external, overflow menu). Built to be slotted as a light-DOM child
 * of sherpa-container, but works inside any host element.
 *
 * Events from the embedded sherpa-button (menu-open, menu-close, buttonclick)
 * bubble and compose out of the header's shadow DOM and continue through
 * its host into any ancestor — no re-dispatching required.
 *
 * @element sherpa-container-header
 *
 * @attr {string}  [data-title]          — Heading text
 * @attr {string}  [data-description]    — Secondary text (hidden when empty)
 * @attr {boolean} [data-open-external]  — Show the open-external button
 * @attr {boolean} [data-menu-button]    — Show the overflow menu button
 * @attr {boolean} [data-drag-handle]    — Show the drag handle
 *
 * @csspart header-row — Outer header element
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaContainerHeader extends SherpaElement {
  static get htmlUrl() {
    return new URL("./sherpa-container-header.html", import.meta.url).href;
  }

  static get cssUrl() {
    return new URL("./sherpa-container-header.css", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-title",
      "data-description",
    ];
  }

  /** @type {HTMLElement|null} */
  #titleEl = null;
  /** @type {HTMLElement|null} */
  #descriptionEl = null;

  /* ── Lifecycle ─────────────────────────────────────────────── */

  onRender() {
    this.#titleEl = this.$(".header-title");
    this.#descriptionEl = this.$(".header-description");
    this.#syncTitle();
    this.#syncDescription();
  }

  onAttributeChanged(name) {
    if (name === "data-title") this.#syncTitle();
    if (name === "data-description") this.#syncDescription();
  }

  /* ── Private sync ──────────────────────────────────────────── */

  #syncTitle() {
    if (this.#titleEl) this.#titleEl.textContent = this.dataset.title || "";
  }

  #syncDescription() {
    if (this.#descriptionEl)
      this.#descriptionEl.textContent = this.dataset.description || "";
  }
}

customElements.define("sherpa-container-header", SherpaContainerHeader);
