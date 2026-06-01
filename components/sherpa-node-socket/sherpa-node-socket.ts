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
  static override get cssUrl(): string { return new URL("./sherpa-node-socket.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-node-socket.html", import.meta.url).href; }


  /** Adopt the sherpa-node family tokens into every shadow root. */
  static get sharedStyles() {
    return [
      ...super.sharedStyles,
      new URL("../sherpa-node/sherpa-node-tokens.css", import.meta.url).href,
    ];
  }

  static override get observedAttributes(): string[] {
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

  els = this.cacheElements({
    btn: { selector: '.socket', type: HTMLButtonElement },
    connectors: '.connectors',
    connectorTpl: { selector: '.connector-tpl', type: HTMLTemplateElement }
  });

  #bound = false;

  override onRender(): void {

    if (!this.#bound) {
      this.els.btn?.addEventListener("pointerdown", this.#onPointerDown);
      this.#bound = true;
    }

    this.#syncCount();
  }

  override onAttributeChanged(name) {
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
    if (!this.els.connectors || !this.els.connectorTpl) return;
    if (this.dataset.direction === "out") {
      this.els.connectors.replaceChildren();
      return;
    }
    // Render exactly `count` dots — zero when disconnected.
    const dots = [];
    for (let i = 0; i < count; i++) {
      dots.push(this.els.connectorTpl.content.firstElementChild.cloneNode(true));
    }
    this.els.connectors.replaceChildren(...dots);
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
