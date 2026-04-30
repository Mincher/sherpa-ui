/**
 * sherpa-node-socket.js — Connection-point primitive for sherpa-node.
 *
 * Pure presentational element. Emits a single high-level event on
 * pointerdown so the canvas/connection-manager can drive drag-to-connect.
 *
 * @element sherpa-node-socket
 *
 * @attr {enum}    data-direction        — "in" | "out"
 * @attr {enum}    data-location         — "header" | "row" (auto-set by parent slot)
 * @attr {boolean} data-multi            — Input accepts multiple connections
 * @attr {boolean} data-connected        — Filled with accent color
 * @attr {string}  data-port-name        — Port identifier
 * @attr {enum}    data-status           — "default" | "true" | "false"
 * @attr {number}  data-connection-count — Set by canvas; drives multi-input height growth
 *
 * @fires sherpa-socket-pointerdown
 *   bubbles: true, composed: true
 *   detail: { direction, portName, status, originalEvent }
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaNodeSocket extends SherpaElement {
  static get cssUrl() { return new URL("./sherpa-node-socket.css", import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-node-socket.html", import.meta.url).href; }


  /** Adopt the sherpa-node family tokens into every shadow root. */
  static get sharedStyles() {
    return [
      ...super.sharedStyles,
      new URL("../sherpa-node/sherpa-node-tokens.css", import.meta.url).href,
    ];
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-direction",
      "data-location",
      "data-multi",
      "data-connected",
      "data-status",
      "data-port-name",
      "data-connection-count",
    ];
  }

  #btnEl = null;

  onRender() {
    this.#btnEl = this.$(".socket");
    this.#syncCount();
  }

  onAttributeChanged(name) {
    if (name === "data-connection-count") this.#syncCount();
  }

  #syncCount() {
    const n = parseInt(this.dataset.connectionCount || "1", 10);
    this.style.setProperty("--_count", String(Number.isFinite(n) && n > 0 ? n : 1));
  }

  onConnect() {
    this.#btnEl?.addEventListener("pointerdown", this.#onPointerDown);
  }

  onDisconnect() {
    this.#btnEl?.removeEventListener("pointerdown", this.#onPointerDown);
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get portName() { return this.dataset.portName || ""; }
  get direction() { return this.dataset.direction || "in"; }
  get connected() { return this.hasAttribute("data-connected"); }
  set connected(v) {
    if (v) this.setAttribute("data-connected", "");
    else this.removeAttribute("data-connected");
  }

  /* ── Events ────────────────────────────────────────────────────── */

  #onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    this.dispatchEvent(new CustomEvent("sherpa-socket-pointerdown", {
      bubbles: true,
      composed: true,
      detail: {
        direction: this.direction,
        portName: this.portName,
        status: this.dataset.status || "default",
        originalEvent: e,
      },
    }));
  };
}

if (!customElements.get("sherpa-node-socket")) {
  customElements.define("sherpa-node-socket", SherpaNodeSocket);
}
