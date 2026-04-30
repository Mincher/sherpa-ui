/**
 * sherpa-node.js — Host element for a node-graph node.
 *
 * Mirrors data-x / data-y attributes to the --sherpa-node-x/y CSS vars
 * so position is purely declarative and animatable.
 *
 * Exposes getPortPositions() so the host canvas can measure where each
 * socket lives in node-local coordinates (unscaled, top-left origin).
 *
 * Sub-type system:
 *   • data-subtypes — JSON array [{value,label}] populates a built-in
 *     <select> beneath the header.
 *   • data-subtype  — Currently-selected sub-type.
 *   • Light-DOM <template class="rows-tpl" data-kind="…" data-subtype="…">
 *     children act as row-prototypes. On subtype change the matching
 *     template's content is cloned into light DOM, replacing any rows
 *     that came from a previous template clone (those are tagged
 *     data-template-row).
 *
 * @element sherpa-node
 *
 * @attr {enum}    data-kind     — One of: source | group | variable | math |
 *                                 logic | time | collection | util | output
 * @attr {boolean} data-selected — Highlights the node
 * @attr {number}  data-x        — X position in canvas-local px
 * @attr {number}  data-y        — Y position in canvas-local px
 * @attr {number}  data-w        — Width override in px (default 240)
 * @attr {string}  data-node-id  — Stable node identifier
 * @attr {json}    data-subtypes — Array<{value,label}>; shows the dropdown
 * @attr {string}  data-subtype  — Current sub-type value
 *
 * @fires sherpa-node-pointerdown
 *   bubbles: true, composed: true
 *   detail: { nodeId, originalEvent }
 *
 * @fires sherpa-node-subtype-change
 *   bubbles: true, composed: true
 *   detail: { nodeId, subtype }
 *
 * @slot header  — A <sherpa-node-header>
 * @slot         — Default: zero or more <sherpa-node-row>s plus optional
 *                 <template class="rows-tpl"…> prototypes
 * @slot footer  — Optional footer
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaNode extends SherpaElement {
  static get cssUrl() { return new URL("./sherpa-node.css", import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-node.html", import.meta.url).href; }


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
      "data-kind",
      "data-selected",
      "data-x",
      "data-y",
      "data-w",
      "data-node-id",
      "data-subtypes",
      "data-subtype",
    ];
  }

  #nodeEl = null;
  #subtypeSelect = null;

  onRender() {
    this.#nodeEl = this.$(".node");
    this.#subtypeSelect = this.$(".subtype-select");
    this.#syncPosition();
    this.#syncWidth();
    this.#syncSubtypeOptions();
    this.#applyTemplate();
  }

  onConnect() {
    this.#nodeEl?.addEventListener("pointerdown", this.#onPointerDown);
    this.#subtypeSelect?.addEventListener("change", this.#onSubtypeChange);
    this.#subtypeSelect?.addEventListener("pointerdown", this.#stopPointer);
    this.#subtypeSelect?.addEventListener("click", this.#stopPointer);
  }

  onDisconnect() {
    this.#nodeEl?.removeEventListener("pointerdown", this.#onPointerDown);
    this.#subtypeSelect?.removeEventListener("change", this.#onSubtypeChange);
    this.#subtypeSelect?.removeEventListener("pointerdown", this.#stopPointer);
    this.#subtypeSelect?.removeEventListener("click", this.#stopPointer);
  }

  onAttributeChanged(name) {
    if (name === "data-x" || name === "data-y") this.#syncPosition();
    else if (name === "data-w") this.#syncWidth();
    else if (name === "data-subtypes") this.#syncSubtypeOptions();
    else if (name === "data-subtype") {
      if (this.#subtypeSelect && this.#subtypeSelect.value !== this.dataset.subtype) {
        this.#subtypeSelect.value = this.dataset.subtype || "";
      }
      this.#applyTemplate();
    }
    else if (name === "data-kind") this.#applyTemplate();
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get nodeId() { return this.dataset.nodeId || ""; }

  /**
   * Returns a Map<portKey, {x, y, side, multi, count}> of every socket in
   * this node, in node-local px (relative to host bounding box, top-left).
   * portKey = portName for default; for multi-input sockets the canvas
   * derives index keys (`portName#0`, `portName#1`, …) externally.
   */
  /**
   * Returns a Map<portName, {x, y, side, multi, count, height, status}> of
   * every socket in this node, in node-local UNSCALED px (top-left origin
   * relative to the host bounding box). Position is the socket's geometric
   * centre — sockets straddle the node edge via translateX(±50%) so the
   * centre IS the connection anchor for both directions.
   *
   * NOTE: rect deltas are returned raw and the canvas is responsible for
   * dividing by its own zoom when converting to world space. This keeps
   * the node free of canvas-transform knowledge.
   */
  getPortPositions() {
    const map = new Map();
    const hostRect = this.getBoundingClientRect();
    const sockets = this.querySelectorAll("sherpa-node-socket[data-port-name]");
    for (const sock of sockets) {
      const r = sock.getBoundingClientRect();
      const portName = sock.dataset.portName;
      const side = sock.dataset.direction === "out" ? "out" : "in";
      const multi = sock.hasAttribute("data-multi");
      const count = parseInt(sock.dataset.connectionCount || "1", 10) || 1;
      const status = sock.dataset.status || "";
      const x = (r.left + r.right) / 2 - hostRect.left;
      const y = (r.top + r.bottom) / 2 - hostRect.top;
      map.set(portName, { x, y, side, multi, count, height: r.height, status });
    }
    return map;
  }

  /* ── Internals ─────────────────────────────────────────────────── */

  #syncPosition() {
    const x = parseFloat(this.dataset.x || "0") || 0;
    const y = parseFloat(this.dataset.y || "0") || 0;
    this.style.setProperty("--sherpa-node-x", `${x}px`);
    this.style.setProperty("--sherpa-node-y", `${y}px`);
  }

  #syncWidth() {
    const w = parseFloat(this.dataset.w || "");
    if (Number.isFinite(w) && w > 0) {
      this.style.setProperty("--sherpa-node-w", `${w}px`);
    } else {
      this.style.removeProperty("--sherpa-node-w");
    }
  }

  #syncSubtypeOptions() {
    if (!this.#subtypeSelect) return;
    let raw = this.dataset.subtypes;
    if (!raw) {
      this.#subtypeSelect.replaceChildren();
      return;
    }
    let opts;
    try { opts = JSON.parse(raw); }
    catch { opts = []; }
    const frag = document.createDocumentFragment();
    for (const o of opts) {
      const el = document.createElement("option");
      el.value = String(o.value ?? "");
      el.textContent = String(o.label ?? o.value ?? "");
      frag.appendChild(el);
    }
    this.#subtypeSelect.replaceChildren(frag);
    if (this.dataset.subtype) {
      this.#subtypeSelect.value = this.dataset.subtype;
    } else if (opts.length) {
      this.#subtypeSelect.value = String(opts[0].value);
    }
  }

  /**
   * Find a child <template class="rows-tpl" data-kind="K" data-subtype="S">
   * matching current host data-kind + data-subtype and clone its content
   * into light DOM, replacing any prior template-cloned rows.
   *
   * Per the Template Completeness Rule: NO createElement here for
   * structural rows — JS only clones what HTML declares.
   */
  #applyTemplate() {
    const kind = this.dataset.kind || "";
    const subtype = this.dataset.subtype || "";
    if (!subtype) return;
    const tpl = this.querySelector(
      `template.rows-tpl[data-kind="${CSS.escape(kind)}"][data-subtype="${CSS.escape(subtype)}"]`
    );
    if (!tpl) return;
    // Remove rows from a previous template clone (tagged data-template-row).
    for (const old of [...this.querySelectorAll(":scope > [data-template-row]")]) {
      old.remove();
    }
    const clone = tpl.content.cloneNode(true);
    // Tag every top-level element so future swaps can find them.
    for (const el of [...clone.children]) {
      if (el.nodeType === 1) el.setAttribute("data-template-row", "");
    }
    this.appendChild(clone);
  }

  #onSubtypeChange = (e) => {
    const value = e.target.value;
    this.setAttribute("data-subtype", value);
    this.dispatchEvent(new CustomEvent("sherpa-node-subtype-change", {
      bubbles: true, composed: true,
      detail: { nodeId: this.nodeId, subtype: value },
    }));
  };

  #stopPointer = (e) => { e.stopPropagation(); };

  #onPointerDown = (e) => {
    // Sockets stop propagation themselves; everything else here is body.
    this.dispatchEvent(new CustomEvent("sherpa-node-pointerdown", {
      bubbles: true,
      composed: true,
      detail: { nodeId: this.nodeId, originalEvent: e },
    }));
  };
}

if (!customElements.get("sherpa-node")) {
  customElements.define("sherpa-node", SherpaNode);
}
