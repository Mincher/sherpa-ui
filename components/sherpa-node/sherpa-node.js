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
    // Light-DOM <sherpa-input-*> controls bubble `change` (composed:true)
    // up to the host. Re-emit a node-level event so the canvas can run
    // value propagation along edges.
    this.addEventListener("change", this.#onControlChange);
  }

  onDisconnect() {
    this.#nodeEl?.removeEventListener("pointerdown", this.#onPointerDown);
    this.#subtypeSelect?.removeEventListener("change", this.#onSubtypeChange);
    this.#subtypeSelect?.removeEventListener("pointerdown", this.#stopPointer);
    this.#subtypeSelect?.removeEventListener("click", this.#stopPointer);
    this.removeEventListener("change", this.#onControlChange);
  }

  onAttributeChanged(name) {
    if (name === "data-x" || name === "data-y") this.#syncPosition();
    else if (name === "data-w") this.#syncWidth();
    else if (name === "data-subtypes") this.#syncSubtypeOptions();
    else if (name === "data-subtype") {
      if (this.#subtypeSelect && this.#subtypeSelect.getAttribute("value") !== this.dataset.subtype) {
        this.#subtypeSelect.setAttribute("value", this.dataset.subtype || "");
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

  /* ── Value passthrough API ─────────────────────────────────────── */

  /**
   * Compute the value emitted on a given output port.
   *
   * `incoming` is a plain object mapping inputPortName → value (string)
   *   or value[] (for `data-multi` aggregation ports). The canvas builds
   *   this map by resolving every edge that targets this node.
   *
   * Returns string|null. The canvas writes this string into any
   *   downstream input control via setInputValue().
   */
  getOutputValue(portName, incoming = {}) {
    if (!portName) return null;
    const socket = this.querySelector(
      `sherpa-node-socket[data-direction="out"][data-port-name="${CSS.escape(portName)}"]`,
    );
    if (!socket) return null;

    // True/false branch outputs emit fixed branch markers per the
    // demo spec: 1 for the "true" branch, 2 for the "false" branch.
    const status = socket.dataset.status || "";
    if (status === "true")  return "1";
    if (status === "false") return "2";

    const kind    = this.dataset.kind || "";
    const subtype = this.dataset.subtype || "";
    const ctrls   = this.#getControlValues();

    // Helper: prefer an upstream-driven incoming value, otherwise the
    // matching local control. This lets a connected input override
    // whatever the user typed locally.
    const inOr = (port, ctrlName, fallback = "") => {
      if (incoming[port] !== undefined) return incoming[port];
      if (ctrls[ctrlName] !== undefined) return ctrls[ctrlName];
      return fallback;
    };
    const num = (v, def = 0) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : def;
    };

    if (kind === "source")    return "1";
    if (kind === "variable")  {
      if (subtype === "property") {
        const cat = ctrls.category || "";
        const fld = ctrls.field || "";
        return cat && fld ? `${cat}.${fld}` : (cat || fld || null);
      }
      return ctrls.value ?? null;
    }
    if (kind === "math") {
      const a = num(inOr("a", "a"));
      const b = num(inOr("b", "b"));
      const inV = incoming.in;
      const inArr = Array.isArray(inV) ? inV.map(num) : (inV !== undefined ? [num(inV)] : []);
      switch (subtype) {
        case "add":       return String(a + b);
        case "subtract":  return String(a - b);
        case "multiply":  return String(a * b);
        case "divide":    return b === 0 ? "" : String(a / b);
        case "ratio":     return b === 0 ? "" : String(a / b);
        case "floor":     return inArr.length ? String(Math.min(...inArr)) : "";
        case "ceiling":   return inArr.length ? String(Math.max(...inArr)) : "";
        case "average":   return inArr.length ? String(inArr.reduce((s, n) => s + n, 0) / inArr.length) : "";
        case "round": {
          const v = num(inArr[0]);
          const p = num(ctrls.places);
          const m = Math.pow(10, p);
          return String(Math.round(v * m) / m);
        }
        case "increment": {
          const v = num(inArr[0]);
          const s = num(ctrls.step, 1);
          return String(v + s);
        }
        default: return null;
      }
    }
    if (kind === "collection") return subtype || null;
    if (kind === "util") {
      // util nodes carry their primary value in the first control.
      const first = Object.values(ctrls).find((v) => v !== "" && v != null);
      return first ?? subtype ?? null;
    }
    // logic nodes only expose status outputs (handled above).
    return null;
  }

  /**
   * Mirror an upstream value into the row-control matching `portName`,
   * and lock the control so the user can't override the driven value.
   * No-op if the node has no row-level input socket for that port.
   */
  setInputValue(portName, value) {
    const ctrl = this.#getControlForInputPort(portName);
    if (!ctrl) return;
    const v = value == null ? "" : String(value);
    if (ctrl.getAttribute("value") !== v) ctrl.setAttribute("value", v);
    if (!ctrl.hasAttribute("readonly")) ctrl.setAttribute("readonly", "");
    // <select> ignores `readonly`; mirror to `disabled` so it can't change.
    if (ctrl.localName === "sherpa-input-select" && !ctrl.hasAttribute("disabled")) {
      ctrl.setAttribute("disabled", "");
    }
    ctrl.setAttribute("data-driven", "");
  }

  /** Restore an input control to user-editable state and clear value. */
  clearInputValue(portName) {
    const ctrl = this.#getControlForInputPort(portName);
    if (!ctrl) return;
    if (ctrl.hasAttribute("data-driven")) {
      ctrl.removeAttribute("readonly");
      if (ctrl.localName === "sherpa-input-select") {
        ctrl.removeAttribute("disabled");
      }
      ctrl.removeAttribute("data-driven");
      ctrl.setAttribute("value", "");
    }
  }

  /* ── Internals: value plumbing ─────────────────────────────────── */

  /** Map of `name` → current value for every sherpa-input-* in this node. */
  #getControlValues() {
    const out = {};
    const ctrls = this.querySelectorAll("[slot='control'][name]");
    for (const c of ctrls) {
      const name = c.getAttribute("name");
      if (!name) continue;
      // SherpaInputBase exposes value either via the `value` getter or
      // as the host attribute. Both fall back to "".
      const v = (c.value !== undefined ? c.value : c.getAttribute("value")) ?? "";
      out[name] = v;
    }
    return out;
  }

  /** Find the `slot="control"` element inside the row whose input-socket
      matches `portName`. */
  #getControlForInputPort(portName) {
    const socket = this.querySelector(
      `sherpa-node-row > sherpa-node-socket[data-direction="in"][data-port-name="${CSS.escape(portName)}"]`,
    );
    const row = socket?.closest("sherpa-node-row");
    return row?.querySelector(":scope > [slot='control']") ?? null;
  }

  #onControlChange = (e) => {
    // Ignore our own subtype dropdown — that has its own event path.
    if (e.composedPath().includes(this.#subtypeSelect)) return;
    // Driven controls fire change as a side-effect of being written by
    // the canvas; suppress those to avoid an event loop.
    const tgt = e.composedPath().find((n) => n?.hasAttribute?.("data-driven"));
    if (tgt) return;
    this.dispatchEvent(new CustomEvent("sherpa-node-value-change", {
      bubbles: true, composed: true,
      detail: { nodeId: this.nodeId },
    }));
  };

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
    const raw = this.dataset.subtypes;
    if (!raw) {
      if (typeof this.#subtypeSelect.setOptions === "function") {
        this.#subtypeSelect.setOptions([]);
      }
      return;
    }
    let opts;
    try { opts = JSON.parse(raw); }
    catch { opts = []; }
    const normalised = opts.map((o) => ({
      value: String(o.value ?? ""),
      label: String(o.label ?? o.value ?? ""),
    }));
    const apply = () => {
      if (typeof this.#subtypeSelect.setOptions !== "function") return;
      this.#subtypeSelect.setOptions(normalised);
      const initial = this.dataset.subtype || (normalised[0]?.value ?? "");
      if (initial) this.#subtypeSelect.setAttribute("value", initial);
    };
    // sherpa-input-select upgrades asynchronously; wait if needed.
    if (typeof this.#subtypeSelect.setOptions === "function") {
      apply();
    } else if (window.customElements?.whenDefined) {
      customElements.whenDefined("sherpa-input-select").then(apply);
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
    // Tell the canvas a template swap may have changed available
    // controls / sockets; defer so the new elements have time to
    // upgrade before the propagation pass reads their values.
    queueMicrotask(() => {
      this.dispatchEvent(new CustomEvent("sherpa-node-value-change", {
        bubbles: true, composed: true,
        detail: { nodeId: this.nodeId, reason: "template" },
      }));
    });
  }

  #onSubtypeChange = (e) => {
    // sherpa-input-select fires a `change` CustomEvent with detail.value.
    // Fall back to reading value off the element for safety.
    const value = e?.detail?.value ?? this.#subtypeSelect?.getAttribute("value") ?? "";
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
