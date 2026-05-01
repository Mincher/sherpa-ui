/**
 * sherpa-chat-message.js
 * SherpaChatMessage — Chat bubble for AI / messaging surfaces.
 *
 * @element sherpa-chat-message
 *
 * @attr {enum}   data-role         "user" | "ai" (default "ai").
 * @attr {string} data-avatar-icon  Font Awesome class for the
 *                                  default ai avatar glyph.
 *
 * @slot avatar   — Custom avatar content. Suppresses the default icon.
 * @slot (default) — Bubble body content.
 *
 * @prop {string} role        — Getter/setter for data-role.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaChatMessage extends SherpaElement {
  static get cssUrl()  { return new URL("./sherpa-chat-message.css", import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-chat-message.html", import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-role",
      "data-avatar-icon",
    ];
  }

  /** @type {HTMLElement|null} */ #iconEl = null;

  onRender() {
    this.#iconEl = this.$(".avatar-icon");
    if (!this.dataset.role) this.dataset.role = "ai";
    this.#syncIcon();
  }

  onAttributeChanged(name) {
    if (name === "data-avatar-icon") this.#syncIcon();
  }

  #syncIcon() {
    if (!this.#iconEl) return;
    const cls = this.dataset.avatarIcon || "";
    // Preserve the structural class while swapping the FA glyph classes.
    this.#iconEl.className = `avatar-icon ${cls}`.trim();
  }

  /* ── public API ──────────────────────────────────────────── */

  get role()  { return this.dataset.role || "ai"; }
  set role(v) { this.dataset.role = v === "user" ? "user" : "ai"; }
}

customElements.define("sherpa-chat-message", SherpaChatMessage);
export { SherpaChatMessage };
