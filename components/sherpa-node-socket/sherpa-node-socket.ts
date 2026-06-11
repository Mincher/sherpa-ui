/**
 * sherpa-node-socket.js — Connection-point primitive for sherpa-node.
 *
 * Pure presentational element. Emits a single high-level event on
 * pointerdown so the canvas/connection-manager can drive drag-to-connect.
 *
 * @element sherpa-node-socket
 * @category content
 * @description Connection point on a sherpa-node for drag-to-connect edge creation. Pure
 *   presentational element — the canvas drives all interaction based on the
 *   sherpa-socket-pointerdown event. Set data-direction="in" for input sockets and "out" for
 *   output sockets. Place inside a sherpa-node-row; not used standalone.
 *
 * @attr {enum}    data-direction        — "in" | "out"
 * @attr {enum}    data-location         — "header" | "row" (auto-detected from DOM context)
 * @attr {enum}    data-variant          — "single" | "multiple" | "step-single" | "step-multiple" (replaces data-multi for inputs)
 * @attr {boolean} data-multi            — DEPRECATED: use data-variant instead. Input accepts multiple connections
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
  static override get sharedStyles(): string[] {
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
      "data-variant",
      "data-multi",
      "data-connected",
      "data-status",
      "data-port-name",
      "data-connection-count",
      "data-flow-active",
    ];
  }

  public els = this.cacheElements({
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

    this.#autoDetectLocation();
    this.#syncVariantToMulti();
    this.#syncCount();
  }

  override onAttributeChanged(name: string): void {
    if (name === "data-variant") {
      this.#syncVariantToMulti();
      this.#syncCount();
    } else if (
      name === "data-connection-count" ||
      name === "data-multi" ||
      name === "data-connected" ||
      name === "data-direction"
    ) {
      this.#syncCount();
    }
  }

  /**
   * Auto-detect location from DOM context instead of relying on parent tagging.
   * Checks if socket is within a [slot="header"] ancestor to determine header vs row.
   */
  #autoDetectLocation(): void {
    // Skip if already explicitly set
    if (this.dataset["location"]) return;

    // Walk up the DOM to find if we're inside a header slot
    let el: Element | null = this.parentElement;
    while (el && el !== document.body) {
      if (el.getAttribute("slot") === "header") {
        this.dataset["location"] = "header";
        return;
      }
      el = el.parentElement;
    }

    // Default to row if not in header
    this.dataset["location"] = "row";
  }

  /**
   * Sync the new data-variant attribute to the legacy data-multi attribute
   * for backward compatibility with existing CSS.
   *
   * Variant mapping:
   * - single → data-multi absent
   * - multiple → data-multi present
   * - step-single → data-multi absent (step variant for header/control-flow)
   * - step-multiple → data-multi present (step variant for header/control-flow)
   */
  #syncVariantToMulti(): void {
    const variant = this.dataset["variant"];
    if (!variant) return;

    const isMulti = variant === "multiple" || variant === "step-multiple";
    if (isMulti) {
      this.setAttribute("data-multi", "");
    } else {
      this.removeAttribute("data-multi");
    }
  }

  #syncCount(): void {
    const n = parseInt(this.dataset["connectionCount"] || "0", 10);
    const count = Number.isFinite(n) && n > 0 ? n : 0;

    // Per-connection dots only exist on input sockets (the template's
    // .connectors container is hidden via CSS for outputs anyway, but
    // we also gate here so we never inject dots on outputs).
    if (!this.els.connectors || !this.els.connectorTpl) return;
    if (this.dataset["direction"] === "out") {
      this.els.connectors.replaceChildren();
      return;
    }
    // Render exactly `count` dots — zero when disconnected.
    const proto = this.els.connectorTpl.content.firstElementChild;
    const dots: Node[] = [];
    if (proto) {
      for (let i = 0; i < count; i++) {
        dots.push(proto.cloneNode(true));
      }
    }
    this.els.connectors.replaceChildren(...dots);
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get portName(): string { return this.dataset["portName"] || ""; }
  get direction(): string { return this.dataset["direction"] || "in"; }
  get connected(): boolean { return this.hasAttribute("data-connected"); }
  set connected(v: boolean) {
    if (v) this.setAttribute("data-connected", "");
    else this.removeAttribute("data-connected");
  }

  /* ── Events ────────────────────────────────────────────────────── */

  #onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    this.emit("sherpa-socket-pointerdown", {
      direction: this.direction,
      portName: this.portName,
      status: this.dataset["status"] || "default",
      originalEvent: e,
    });
  };
}

if (!customElements.get("sherpa-node-socket")) {
  customElements.define("sherpa-node-socket", SherpaNodeSocket);
}
