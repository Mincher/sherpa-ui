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
 *   • data-subtypes — JSON. Either a flat array [{value,label}] or a
 *     grouped array [{label, options:[{value,label}]}]. Grouped form
 *     renders <optgroup>s in the picker (e.g. "Preset" vs "Custom").
 *   • data-subtype  — Currently-selected sub-type value.
 *   • Light-DOM <template class="rows-tpl" data-kind="…" data-subtype="…">
 *     children act as row-prototypes. On subtype change the matching
 *     template's content is cloned into light DOM, replacing any rows
 *     that came from a previous template clone (those are tagged
 *     data-template-row).
 *
 * Custom subtypes (consumer contract):
 *   The "Custom" group is a hook for consumers to inject saved-graph
 *   entries (e.g. user-saved subgraphs). Consumers populate it by
 *   overwriting data-subtypes with their own grouped JSON, e.g.
 *
 *     node.dataset["subtypes"] = JSON.stringify([
 *       { label: "Preset", options: presetSubtypes },
 *       { label: "Custom", options: [
 *         { value: "saved:abc123", label: "Monitor CPU usage" },
 *       ]},
 *     ]);
 *
 *   When the user picks a "Custom" entry, the consumer should listen
 *   for sherpa-node-subtype-change, and — if the value matches a saved
 *   group — replace the source node with a `group`-kind node at the
 *   same position/id, then push the saved subgraph into it via
 *   canvas.pushSubgraph(). sherpa-ui ships only the picker mechanism;
 *   the saved-groups registry is the consumer's concern.
 *
 * @element sherpa-node
 * @category content
 *
 * @attr {enum}    data-kind     — One of: source | group | variable | math |
 *                                 logic | time | collection | util | output |
 *                                 delegate | chat | action
 * @attr {boolean} data-selected — Highlights the node
 * @attr {number}  data-x        — X position in canvas-local px
 * @attr {number}  data-y        — Y position in canvas-local px
 * @attr {number}  data-w        — Optional min-width in px. Nodes are
 *                                 intrinsic-width flex columns by
 *                                 default; set this to enforce a floor.
 * @attr {string}  data-node-id  — Stable node identifier
 * @attr {json}    data-subtypes — Flat Array<{value,label}> OR grouped
 *                                 Array<{label, options:[{value,label}]}>
 * @attr {string}  data-subtype  — Current sub-type value
 * @attr {string}  data-subtype-label — Optional label override displayed on the
 *                                  sub-type picker trigger (falls back to the
 *                                  matching option's label when omitted)
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
  static override get cssUrl(): string { return new URL("./sherpa-node.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-node.html", import.meta.url).href; }


  /** Adopt the sherpa-node family tokens into every shadow root. */
  static override get sharedStyles() {
    return [
      ...super.sharedStyles,
      new URL("../sherpa-node/sherpa-node-tokens.css", import.meta.url).href,
    ];
  }

  static override get observedAttributes(): string[] {
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
      "data-subtype-label",
    ];
  }

  els = this.cacheElements({
    node: '.node',
    subtypeSelect: { selector: '.subtype-select', type: HTMLSelectElement }
  });

  #bound = false;

  override onRender(): void {

    if (!this.#bound) {
      this.els.node?.addEventListener("pointerdown", this.#onPointerDown);
      this.els.subtypeSelect?.addEventListener("change", this.#onSubtypeChange);
      this.els.subtypeSelect?.addEventListener("pointerdown", this.#stopPointer);
      this.els.subtypeSelect?.addEventListener("click", this.#stopPointer);
      // Light-DOM <sherpa-input-*> controls bubble `change` (composed:true)
      // up to the host. Re-emit a node-level event so the canvas can run
      // value propagation along edges.
      this.addEventListener("change", this.#onControlChange);
      this.#bound = true;
    }

    this.#syncPosition();
    this.#syncWidth();
    this.#syncSubtypeOptions();
    this.#applyTemplate();
  }

  override onAttributeChanged(name: string) {
    if (name === "data-x" || name === "data-y") this.#syncPosition();
    else if (name === "data-w") this.#syncWidth();
    else if (name === "data-subtypes") this.#syncSubtypeOptions();
    else if (name === "data-subtype-label") this.#syncSubtypeOptions();
    else if (name === "data-subtype") {
      if (this.els.subtypeSelect && this.els.subtypeSelect.getAttribute("value") !== this.dataset["subtype"]) {
        this.els.subtypeSelect.setAttribute("value", this.dataset["subtype"] || "");
      }
      this.#applyTemplate();
    }
    else if (name === "data-kind") this.#applyTemplate();
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get nodeId() { return this.dataset["nodeId"] || ""; }

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
      // @ts-expect-error - TODO: Fix type
      const portName = sock.dataset["portName"];
      // @ts-expect-error - TODO: Fix type
      const side = sock.dataset["direction"] === "out" ? "out" : "in";
      const multi = sock.hasAttribute("data-multi");
      // @ts-expect-error - TODO: Fix type
      const count = parseInt(sock.dataset["connectionCount"] || "1", 10) || 1;
      // @ts-expect-error - TODO: Fix type
      const status = sock.dataset["status"] || "";
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
  // @ts-expect-error - TODO: Fix type
  getOutputValue(portName, incoming = {}) {
    if (!portName) return null;
    const socket = this.querySelector(
      `sherpa-node-socket[data-direction="out"][data-port-name="${CSS.escape(portName)}"]`,
    );
    if (!socket) return null;

    // True/false branch outputs emit fixed branch markers per the
    // demo spec: 1 for the "true" branch, 2 for the "false" branch.
    // @ts-expect-error - TODO: Fix type
    const status = socket.dataset["status"] || "";
    if (status === "true")  return "1";
    if (status === "false") return "2";

    const kind    = this.dataset["kind"] || "";
    const subtype = this.dataset["subtype"] || "";
    const ctrls   = this.#getControlValues();

    // Helper: prefer an upstream-driven incoming value, otherwise the
    // matching local control. This lets a connected input override
    // whatever the user typed locally.
    // @ts-expect-error - TODO: Fix type
    const inOr = (port, ctrlName, fallback = "") => {
      // @ts-expect-error - TODO: Fix type
      if (incoming[port] !== undefined) return incoming[port];
      // @ts-expect-error - TODO: Fix type
      if (ctrls[ctrlName] !== undefined) return ctrls[ctrlName];
      return fallback;
    };
    // @ts-expect-error - TODO: Fix type
    const num = (v, def = 0) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : def;
    };

    if (kind === "source")    return "1";
    if (kind === "variable")  {
      if (subtype === "property") {
        // @ts-expect-error - TODO: Fix type
        const cat = ctrls.category || "";
        // @ts-expect-error - TODO: Fix type
        const fld = ctrls.field || "";
        return cat && fld ? `${cat}.${fld}` : (cat || fld || null);
      }
      // @ts-expect-error - TODO: Fix type
      return ctrls.value ?? null;
    }
    if (kind === "math") {
      const a = num(inOr("a", "a"));
      const b = num(inOr("b", "b"));
      // @ts-expect-error - TODO: Fix type
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
        case "average":   return inArr.length ? String(inArr.reduce((s: any, n: any) => s + n, 0) / inArr.length) : "";
        case "round": {
          const v = num(inArr[0]);
          // @ts-expect-error - TODO: Fix type
          const p = num(ctrls.places);
          const m = Math.pow(10, p);
          return String(Math.round(v * m) / m);
        }
        case "increment": {
          const v = num(inArr[0]);
          // @ts-expect-error - TODO: Fix type
          const s = num(ctrls.step, 1);
          return String(v + s);
        }
        default: return null;
      }
    }
    if (kind === "collection") return subtype || null;
    if (kind === "util") {
      // util nodes carry their primary value in the first control,
      // except concatenate which composes its inputs.
      if (subtype === "concatenate") {
        // @ts-expect-error - TODO: Fix type
        const op = ctrls.operation || "Append";
        const a = String(inOr("a", "a", ""));
        const b = String(inOr("b", "b", ""));
        if (!a && !b) return null;
        return op === "Prepend" ? `${b}${a}` : `${a}${b}`;
      }
      const first = Object.values(ctrls).find((v) => v !== "" && v != null);
      return first ?? subtype ?? null;
    }
    if (kind === "ai") {
      // AI nodes surface their selected configuration so downstream
      // inputs can preview the value flowing through the edge.
      // @ts-expect-error - TODO: Fix type
      if (subtype === "model")    return ctrls.model    || null;
      // @ts-expect-error - TODO: Fix type
      if (subtype === "delegate") return ctrls.agent    || null;
      if (subtype === "chat") {
        // @ts-expect-error - TODO: Fix type
        if (portName === "response")        return ctrls.response        || null;
        // @ts-expect-error - TODO: Fix type
        if (portName === "recommendations") return ctrls.recommendations || null;
        // Default chat output: prefer response, fall back to preset/type.
        // @ts-expect-error - TODO: Fix type
        return ctrls.response || ctrls.preset || ctrls.type || null;
      }
      return null;
    }
    // Standalone AI-family kinds (templates moved these out of kind="ai"
    // into top-level kinds; mirror the same value-surfacing behaviour
    // so downstream inputs receive the chosen configuration).
    // @ts-expect-error - TODO: Fix type
    if (kind === "model")    return ctrls.model || null;
    // @ts-expect-error - TODO: Fix type
    if (kind === "delegate") return ctrls.agent || null;
    if (kind === "chat") {
      // @ts-expect-error - TODO: Fix type
      if (portName === "response")        return ctrls.response        || null;
      // @ts-expect-error - TODO: Fix type
      if (portName === "recommendations") return ctrls.recommendations || null;
      // @ts-expect-error - TODO: Fix type
      return ctrls.response || ctrls.preset || ctrls.type || null;
    }
    if (kind === "action") {
      // @ts-expect-error - TODO: Fix type
      if (subtype === "ticket") return ctrls.ticketNumber || ctrls.action || null;
      return null;
    }
    // logic nodes only expose status outputs (handled above).
    return null;
  }

  /**
   * Mirror an upstream value into the row-control matching `portName`,
   * and lock the control so the user can't override the driven value.
   * No-op if the node has no row-level input socket for that port.
   */
  // @ts-expect-error - TODO: Fix type
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
  // @ts-expect-error - TODO: Fix type
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
      // @ts-expect-error - TODO: Fix type
      const v = (c.value !== undefined ? c.value : c.getAttribute("value")) ?? "";
      // @ts-expect-error - TODO: Fix type
      out[name] = v;
    }
    return out;
  }

  /** Find the `slot="control"` element inside the row whose input-socket
      matches `portName`. The control's `name` must equal `portName` so
      that cross-port rows (e.g. an `agent` socket sitting in the `Type`
      row of ai.chat) don't accidentally write to the wrong control. */
  // @ts-expect-error - TODO: Fix type
  #getControlForInputPort(portName) {
    const socket = this.querySelector(
      `sherpa-node-row > sherpa-node-socket[data-direction="in"][data-port-name="${CSS.escape(portName)}"]`,
    );
    const row = socket?.closest("sherpa-node-row");
    const ctrl = row?.querySelector(`:scope > [slot='control'][name="${CSS.escape(portName)}"]`);
    return ctrl ?? null;
  }

  #onControlChange = (e: Event) => {
    // Ignore our own subtype dropdown — that has its own event path.
    // @ts-expect-error - TODO: Fix type
    if (e.composedPath().includes(this.els.subtypeSelect)) return;
    // Re-evaluate conditional row visibility on every value change.
    this.#applyShowIf();
    // Driven controls fire change as a side-effect of being written by
    // the canvas; suppress those to avoid an event loop.
    // @ts-expect-error - TODO: Fix type
    const tgt = e.composedPath().find((n) => n?.hasAttribute?.("data-driven"));
    if (tgt) return;
    this.dispatchEvent(new CustomEvent("sherpa-node-value-change", {
      bubbles: true, composed: true,
      detail: { nodeId: this.nodeId },
    }));
  };

  /* ── Internals ─────────────────────────────────────────────────── */

  #syncPosition() {
    const x = parseFloat(this.dataset["x"] || "0") || 0;
    const y = parseFloat(this.dataset["y"] || "0") || 0;
    this.style.setProperty("--sherpa-node-x", `${x}px`);
    this.style.setProperty("--sherpa-node-y", `${y}px`);
  }

  #syncWidth() {
    const w = parseFloat(this.dataset["w"] || "");
    if (Number.isFinite(w) && w > 0) {
      this.style.setProperty("--sherpa-node-w", `${w}px`);
    } else {
      this.style.removeProperty("--sherpa-node-w");
    }
  }

  #syncSubtypeOptions() {
    if (!this.els.subtypeSelect) return;
    const raw = this.dataset["subtypes"];
    if (!raw) {
      // @ts-expect-error - TODO: Fix type
      if (typeof this.els.subtypeSelect.setOptions === "function") {
        // @ts-expect-error - TODO: Fix type
        this.els.subtypeSelect.setOptions([]);
      }
      return;
    }
    let opts;
    try { opts = JSON.parse(raw); }
    catch { opts = []; }
    // Normalise: each entry is either a flat {value,label} option or a
    // grouped {label, options:[…]} block. Grouped entries pass through
    // to <optgroup>; flat entries are stringified for safety.
    // @ts-expect-error - TODO: Fix type
    const isGrouped = opts.some((o) => o && Array.isArray(o.options));
    const normalised = isGrouped
      // @ts-expect-error - TODO: Fix type
      ? opts.map((o) => Array.isArray(o?.options)
          ? {
              label: String(o.label ?? ""),
              // @ts-expect-error - TODO: Fix type
              options: o.options.map((opt) => ({
                value: String(opt.value ?? ""),
                label: String(opt.label ?? opt.value ?? ""),
                disabled: !!opt.disabled,
              })),
            }
          : {
              value: String(o.value ?? ""),
              label: String(o.label ?? o.value ?? ""),
            })
      // @ts-expect-error - TODO: Fix type
      : opts.map((o) => ({
          value: String(o.value ?? ""),
          label: String(o.label ?? o.value ?? ""),
        }));
    // Count selectable options (flat + grouped) to decide whether the
    // subtype select has anything to choose between.
    const totalChoices = isGrouped
      ? normalised.reduce((n: any, o: any) => n + (Array.isArray(o.options) ? o.options.length : 1), 0)
      : normalised.length;
    // Hide the subtype select entirely when there's nothing to choose
    // between — single-subtype nodes have no business showing a
    // disabled "Type" dropdown. Toggled via host attribute; CSS owns
    // the actual visibility (see sherpa-node.css).
    this.toggleAttribute("data-single-subtype", totalChoices <= 1);
    // Allow per-host relabelling of the subtype select (e.g. logic
    // nodes label it "Operation" rather than the default "Type").
    if (this.els.subtypeSelect) {
      const label = this.dataset["subtypeLabel"] || "Type";
      if (this.els.subtypeSelect.getAttribute("data-label") !== label) {
        this.els.subtypeSelect.setAttribute("data-label", label);
      }
    }
    const apply = () => {
      // @ts-expect-error - TODO: Fix type
      if (typeof this.els.subtypeSelect.setOptions !== "function") return;
      // @ts-expect-error - TODO: Fix type
      this.els.subtypeSelect.setOptions(normalised);
      const firstValue = isGrouped
        // @ts-expect-error - TODO: Fix type
        ? normalised.find((g) => g.options?.length)?.options?.[0]?.value
        : normalised[0]?.value;
      const initial = this.dataset["subtype"] || (firstValue ?? "");
      // @ts-expect-error - TODO: Fix type
      if (initial) this.els.subtypeSelect.setAttribute("value", initial);
    };
    // sherpa-input-select upgrades asynchronously; wait if needed.
    // @ts-expect-error - TODO: Fix type
    if (typeof this.els.subtypeSelect.setOptions === "function") {
      apply();
    // @ts-expect-error - TODO: Fix type
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
    const kind = this.dataset["kind"] || "";
    const subtype = this.dataset["subtype"] || "";
    if (!subtype) return;
    const tpl = this.querySelector(
      `template.rows-tpl[data-kind="${CSS.escape(kind)}"][data-subtype="${CSS.escape(subtype)}"]`
    );
    if (!tpl) return;
    // Capture existing template-row control values BEFORE removing
    // them, so we can restore them onto the freshly-cloned template.
    // Without this, every #applyTemplate run (including the one that
    // fires when a node is reattached after a subgraph push/pop
    // snapshot/restore cycle) silently wipes user-set values.
    const preserved = new Map();
    for (const ctrl of this.querySelectorAll(
      ":scope > [data-template-row] [slot='control'][name]"
    )) {
      const name = ctrl.getAttribute("name");
      const v = ctrl.getAttribute("value");
      if (name && v != null && v !== "") preserved.set(name, v);
    }
    // Remove rows from a previous template clone (tagged data-template-row).
    for (const old of [...this.querySelectorAll(":scope > [data-template-row]")]) {
      old.remove();
    }
    // @ts-expect-error - TODO: Fix type
    const clone = tpl.content.cloneNode(true);
    // Tag every top-level element so future swaps can find them.
    for (const el of [...clone.children]) {
      if (el.nodeType === 1) el.setAttribute("data-template-row", "");
    }
    // Restore preserved values onto the matching freshly-cloned controls
    // before they hit the live DOM (so attributeChangedCallback only
    // fires once with the right value).
    if (preserved.size) {
      for (const ctrl of clone.querySelectorAll("[slot='control'][name]")) {
        const name = ctrl.getAttribute("name");
        if (preserved.has(name)) ctrl.setAttribute("value", preserved.get(name));
      }
    }
    this.appendChild(clone);
    // Optional: templates may declare helper text for the built-in
    // subtype (Type) select via `data-subtype-helper="…"` on the
    // <template> element — mirror it onto the subtype-select.
    const helper = tpl.getAttribute("data-subtype-helper") || "";
    if (this.els.subtypeSelect) {
      if (helper) this.els.subtypeSelect.setAttribute("data-helper", helper);
      else this.els.subtypeSelect.removeAttribute("data-helper");
    }
    // Apply data-show-if conditional row visibility, then re-apply
    // whenever a control value changes (handled in #onControlChange).
    queueMicrotask(() => this.#applyShowIf());
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

  /**
   * Evaluate `data-show-if` on every template-cloned row and toggle
   * the `hidden` attribute. Format: `data-show-if="ctrlName=val|val2"`.
   * Multiple clauses comma-separated are AND-ed:
   *   data-show-if="type=Notify, severity=Critical"
   * The referenced control is matched by its `name` attribute on a
   * sibling `[slot="control"]` within the same node. Subtype select
   * is also addressable via the special name "subtype".
   */
  #applyShowIf() {
    const rows = this.querySelectorAll(":scope > [data-template-row][data-show-if]");
    if (!rows.length) return;
    // @ts-expect-error - TODO: Fix type
    const readVal = (name) => {
      if (name === "subtype") return this.dataset["subtype"] || "";
      const ctrl = this.querySelector(`:scope > [data-template-row] > [slot="control"][name="${CSS.escape(name)}"]`);
      if (!ctrl) return "";
      // @ts-expect-error - TODO: Fix type
      return ctrl.getAttribute("value") ?? ctrl.value ?? "";
    };
    for (const row of rows) {
      const expr = row.getAttribute("data-show-if") || "";
      const clauses = expr.split(",").map((s) => s.trim()).filter(Boolean);
      const ok = clauses.every((c) => {
        const [name, vals] = c.split("=").map((s) => s.trim());
        if (!name || vals == null) return true;
        const allowed = vals.split("|").map((s) => s.trim());
        return allowed.includes(String(readVal(name)));
      });
      row.toggleAttribute("hidden", !ok);
    }
  }

  #onSubtypeChange = (e: Event) => {
    // sherpa-input-select fires a `change` CustomEvent with detail.value.
    // Fall back to reading value off the element for safety.
    // @ts-expect-error - TODO: Fix type
    const value = e?.detail?.value ?? this.els.subtypeSelect?.getAttribute("value") ?? "";
    this.setAttribute("data-subtype", value);
    this.dispatchEvent(new CustomEvent("sherpa-node-subtype-change", {
      bubbles: true, composed: true,
      detail: { nodeId: this.nodeId, subtype: value },
    }));
  };

  #stopPointer = (e: Event) => { e.stopPropagation(); };

  #onPointerDown = (e: Event) => {
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
