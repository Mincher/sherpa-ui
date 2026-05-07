/**
 * sherpa-node-socket.js — Connection-point primitive for sherpa-node.
 *
 * Pure presentational element. Emits a single high-level event on
 * pointerdown so the canvas/connection-manager can drive drag-to-connect.
 *
 * @element sherpa-node-socket
 * @category content
 *
 * @attr {enum}    data-direction        — "in" | "out"
 * @attr {enum}    data-location         — "header" | "row" (auto-set by parent slot)
 * @attr {boolean} data-multi            — Input accepts multiple connections
 * @attr {boolean} data-connected        — Filled with accent color
 * @attr {string}  data-port-name        — Port identifier
 * @attr {enum}    data-status           — "default" | "true" | "false"
 * @attr {number}  data-connection-count — Set by canvas; drives the count of stacked dots inside input sockets
 * @attr {boolean} data-flow-active       — Group input sockets only: subgraph has a source→output flow; renders larger filled dot
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
      "data-flow-active",
    ];
  }

  #btnEl = null;
  #connectorsEl = null;
  #connectorTpl = null;

  onRender() {
    this.#btnEl = this.$(".socket");
    this.#connectorsEl = this.$(".connectors");
    this.#connectorTpl = this.shadowRoot?.querySelector(".connector-tpl");
    this.#syncCount();
  }

  onAttributeChanged(name) {
    if (
      name === "data-connection-count" ||
      name === "data-multi" ||
      name === "data-connected" ||
      name === "data-direction"
    ) {
      this.#syncCount();
    }
  }

  #syncCount() {
    const n = parseInt(this.dataset.connectionCount || "0", 10);
    const count = Number.isFinite(n) && n > 0 ? n : 0;

    // Per-connection dots only exist on input sockets (the template's
    // .connectors container is hidden via CSS for outputs anyway, but
    // we also gate here so we never inject dots on outputs).
    if (!this.#connectorsEl || !this.#connectorTpl) return;
    if (this.dataset.direction === "out") {
      this.#connectorsEl.replaceChildren();
      return;
    }
    // Render exactly `count` dots — zero when disconnected.
    const dots = [];
    for (let i = 0; i < count; i++) {
      dots.push(this.#connectorTpl.content.firstElementChild.cloneNode(true));
    }
    this.#connectorsEl.replaceChildren(...dots);
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
