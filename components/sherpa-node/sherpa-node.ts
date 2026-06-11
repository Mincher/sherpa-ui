/**
 * sherpa-node.js — Host element for a node-graph node.
 *
 * Mirrors data-x / data-y attributes to the --sherpa-node-x/y CSS vars
 * so position is purely declarative and animatable.
 *
 * Exposes getPortPositions() so the host canvas can measure where each
 * socket lives in node-local coordinates (unscaled, top-left origin).
 *
 * Template system:
 *   • data-subtypes — JSON. Either a flat array [{value,label}] or a
 *     grouped array [{label, options:[{value,label}]}]. Grouped form
 *     renders <optgroup>s in the picker (e.g. "Preset" vs "Custom").
 *   • data-subtype  — Currently-selected sub-type value.
 *   • Light-DOM <template class="rows-tpl" data-kind="…" data-subtype="…">
 *     children act as row-prototypes. On subtype change the matching
 *     template's content is cloned into light DOM, replacing any rows
 *     that came from a previous template clone (those are tagged
 *     data-template-row).
 *   • Conditional visibility: Use data-show-if="name=value" on rows.
 *     Supports: =, !=, OR (|), AND (,). Example: data-show-if="type=Email, priority!=Low"
 *   • Value preservation: Control values are automatically preserved across
 *     template swaps (including empty strings).
 *   • Validation: Missing templates log warnings in development mode.
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
 * @description A draggable node in a sherpa-node-canvas graph. Represents a single entity in
 *   a visual workflow or data-flow diagram. Contains sherpa-node-row children (header and body
 *   rows) and sherpa-node-socket elements as connection points. Position is declared via
 *   data-x/data-y and mirrored to CSS custom properties so the canvas can read layout state
 *   from the DOM. Use data-kind to set the node type; use data-subtypes for a sub-type picker.
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
 * @slot header  — A <sherpa-node-row data-variant="header">
 * @slot         — Default: zero or more <sherpa-node-row>s (body variant) plus optional
 *                 <template class="rows-tpl"…> prototypes
 * @slot footer  — Optional footer
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { computeNodeOutput, nodeValueToString, type NodeOutputValue } from "../utilities/node-compute.js";
import "../utilities/node-kinds/index.js";

/** A subtype picker option — flat {value,label} or a grouped {label, options}. */
interface SubtypeOption {
  value?: string;
  label?: string;
  disabled?: boolean;
  options?: SubtypeOption[];
}

export class SherpaNode extends SherpaElement {
  static override get cssUrl(): string { return new URL("./sherpa-node.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-node.html", import.meta.url).href; }


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

  public els = this.cacheElements({
    node: '.node'
  });

  /** The subtype dropdown (a sherpa-input-select), if present. */
  get #subtypeSelect(): (HTMLElement & { setOptions?: (options: unknown[]) => void; value?: string }) | null {
    return this.$('.subtype-select');
  }

  #bound = false;

  override onRender(): void {

    if (!this.#bound) {
      this.els.node?.addEventListener("pointerdown", this.#onPointerDown);
      this.#subtypeSelect?.addEventListener("change", this.#onSubtypeChange);
      this.#subtypeSelect?.addEventListener("pointerdown", this.#stopPointer);
      this.#subtypeSelect?.addEventListener("click", this.#stopPointer);
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

  override onAttributeChanged(name: string): void {
    if (name === "data-x" || name === "data-y") this.#syncPosition();
    else if (name === "data-w") this.#syncWidth();
    else if (name === "data-subtypes") this.#syncSubtypeOptions();
    else if (name === "data-subtype-label") this.#syncSubtypeOptions();
    else if (name === "data-subtype") {
      if (this.#subtypeSelect && this.#subtypeSelect.getAttribute("value") !== this.dataset["subtype"]) {
        this.#subtypeSelect.setAttribute("value", this.dataset["subtype"] || "");
      }
      this.#applyTemplate();
    }
    else if (name === "data-kind") this.#applyTemplate();
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get nodeId(): string { return this.dataset["nodeId"] || ""; }

  /**
   * Get all available template kinds and subtypes registered on this node.
   * Useful for building UI that lets users select node types.
   * Returns: Map<kind, subtype[]>
   */
  getAvailableTemplates(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    const templates = this.querySelectorAll<HTMLTemplateElement>("template.rows-tpl[data-kind][data-subtype]");
    for (const tpl of templates) {
      const kind = tpl.dataset["kind"];
      const subtype = tpl.dataset["subtype"];
      if (!kind || !subtype) continue;
      if (!map.has(kind)) map.set(kind, []);
      map.get(kind)?.push(subtype);
    }
    return map;
  }

  /**
   * Check if a template exists for the given kind and subtype.
   * Useful for validation before setting data-kind/data-subtype.
   */
  hasTemplate(kind: string, subtype: string): boolean {
    return !!this.querySelector(
      `template.rows-tpl[data-kind="${CSS.escape(kind)}"][data-subtype="${CSS.escape(subtype)}"]`
    );
  }

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
  getPortPositions(): Map<string, { x: number; y: number; side: string; multi: boolean; count: number; height: number; status: string }> {
    const map = new Map<string, { x: number; y: number; side: string; multi: boolean; count: number; height: number; status: string }>();
    const hostRect = this.getBoundingClientRect();
    const sockets = this.querySelectorAll<HTMLElement>("sherpa-node-socket[data-port-name]");
    for (const sock of sockets) {
      const r = sock.getBoundingClientRect();
      const portName = sock.dataset["portName"];
      if (!portName) continue;
      const side = sock.dataset["direction"] === "out" ? "out" : "in";
      const multi = sock.hasAttribute("data-multi");
      const count = parseInt(sock.dataset["connectionCount"] || "1", 10) || 1;
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
   * Returns NodeOutputValue. The canvas coerces to string via nodeValueToString()
   *   before writing into a downstream input control via setInputValue().
   */
  getOutputValue(portName: string, incoming: Record<string, unknown> = {}): NodeOutputValue {
    if (!portName) return null;
    const socket = this.querySelector<HTMLElement>(
      `sherpa-node-socket[data-direction="out"][data-port-name="${CSS.escape(portName)}"]`,
    );
    if (!socket) return null;
    return computeNodeOutput(portName, {
      kind:         this.dataset["kind"]    || "",
      subtype:      this.dataset["subtype"] || "",
      socketStatus: socket.dataset["status"] || "",
      controls:     this.#getControlValues(),
      incoming,
    });
  }

  /**
   * Mirror an upstream value into the row-control matching `portName`,
   * and lock the control so the user can't override the driven value.
   * No-op if the node has no row-level input socket for that port.
   */
  setInputValue(portName: string, value: unknown): void {
    const ctrl = this.#getControlForInputPort(portName);
    if (!ctrl) return;
    const v = nodeValueToString(value as NodeOutputValue);
    if (ctrl.getAttribute("value") !== v) ctrl.setAttribute("value", v);
    if (!ctrl.hasAttribute("readonly")) ctrl.setAttribute("readonly", "");
    // <select> ignores `readonly`; mirror to `disabled` so it can't change.
    if (ctrl.localName === "sherpa-input-select" && !ctrl.hasAttribute("disabled")) {
      ctrl.setAttribute("disabled", "");
    }
    ctrl.setAttribute("data-driven", "");
  }

  /** Restore an input control to user-editable state and clear value. */
  clearInputValue(portName: string): void {
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
  #getControlValues(): Record<string, string> {
    const out: Record<string, string> = {};
    const ctrls = this.querySelectorAll<HTMLElement & { value?: string }>("[slot='control'][name]");
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
      matches `portName`. The control's `name` must equal `portName` so
      that cross-port rows (e.g. an `agent` socket sitting in the `Type`
      row of ai.chat) don't accidentally write to the wrong control. */
  #getControlForInputPort(portName: string): Element | null {
    const socket = this.querySelector(
      `sherpa-node-row > sherpa-node-socket[data-direction="in"][data-port-name="${CSS.escape(portName)}"]`,
    );
    const row = socket?.closest("sherpa-node-row");
    const ctrl = row?.querySelector(`:scope > [slot='control'][name="${CSS.escape(portName)}"]`);
    return ctrl ?? null;
  }

  #onControlChange = (e: Event): void => {
    // Ignore our own subtype dropdown — that has its own event path.
    const subtypeSelect = this.#subtypeSelect;
    if (subtypeSelect && e.composedPath().includes(subtypeSelect)) return;
    // Re-evaluate conditional row visibility on every value change.
    this.#applyShowIf();
    // Driven controls fire change as a side-effect of being written by
    // the canvas; suppress those to avoid an event loop.
    const tgt = e.composedPath().find((n) => n instanceof Element && n.hasAttribute("data-driven"));
    if (tgt) return;
    this.emit("sherpa-node-value-change", { nodeId: this.nodeId });
  };

  /* ── Internals ─────────────────────────────────────────────────── */

  #syncPosition(): void {
    const x = parseFloat(this.dataset["x"] || "0") || 0;
    const y = parseFloat(this.dataset["y"] || "0") || 0;
    this.style.setProperty("--sherpa-node-x", `${x}px`);
    this.style.setProperty("--sherpa-node-y", `${y}px`);
  }

  #syncWidth(): void {
    const w = parseFloat(this.dataset["w"] || "");
    if (Number.isFinite(w) && w > 0) {
      this.style.setProperty("--sherpa-node-w", `${w}px`);
    } else {
      this.style.removeProperty("--sherpa-node-w");
    }
  }

  #syncSubtypeOptions(): void {
    const select = this.#subtypeSelect;
    if (!select) return;
    const raw = this.dataset["subtypes"];
    if (!raw) {
      select.setOptions?.([]);
      return;
    }
    let opts: SubtypeOption[];
    try { opts = JSON.parse(raw); }
    catch { opts = []; }
    // Normalise: each entry is either a flat {value,label} option or a
    // grouped {label, options:[…]} block. Grouped entries pass through
    // to <optgroup>; flat entries are stringified for safety.
    const isGrouped = opts.some((o) => o && Array.isArray(o.options));
    const normalised: SubtypeOption[] = isGrouped
      ? opts.map((o) => Array.isArray(o?.options)
          ? {
              label: String(o.label ?? ""),
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
      : opts.map((o) => ({
          value: String(o.value ?? ""),
          label: String(o.label ?? o.value ?? ""),
        }));
    // Count selectable options (flat + grouped) to decide whether the
    // subtype select has anything to choose between.
    const totalChoices = isGrouped
      ? normalised.reduce((n, o) => n + (Array.isArray(o.options) ? o.options.length : 1), 0)
      : normalised.length;
    // Hide the subtype select entirely when there's nothing to choose
    // between — single-subtype nodes have no business showing a
    // disabled "Type" dropdown. Toggled via host attribute; CSS owns
    // the actual visibility (see sherpa-node.css).
    this.toggleAttribute("data-single-subtype", totalChoices <= 1);
    // Allow per-host relabelling of the subtype select (e.g. logic
    // nodes label it "Operation" rather than the default "Type").
    const label = this.dataset["subtypeLabel"] || "Type";
    if (select.getAttribute("data-label") !== label) {
      select.setAttribute("data-label", label);
    }
    const apply = (): void => {
      if (typeof select.setOptions !== "function") return;
      select.setOptions(normalised);
      const firstValue = isGrouped
        ? normalised.find((g) => g.options?.length)?.options?.[0]?.value
        : normalised[0]?.value;
      const initial = this.dataset["subtype"] || (firstValue ?? "");
      if (initial) select.setAttribute("value", initial);
    };
    // sherpa-input-select upgrades asynchronously; wait if needed.
    if (typeof select.setOptions === "function") {
      apply();
    } else {
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
  #applyTemplate(): void {
    const kind = this.dataset["kind"] || "";
    const subtype = this.dataset["subtype"] || "";
    if (!subtype) return;
    const tpl = this.querySelector<HTMLTemplateElement>(
      `template.rows-tpl[data-kind="${CSS.escape(kind)}"][data-subtype="${CSS.escape(subtype)}"]`
    );
    if (!tpl) {
      // No templates attached yet — auto-load from the catalogue and retry.
      if (!this.querySelector("template.rows-tpl")) {
        import("./sherpa-node-templates.js").then(({ attachAllTemplatesForKind }) =>
          attachAllTemplatesForKind(this, kind).then(() => this.#applyTemplate())
        );
        return;
      }
      // Templates present but this specific subtype isn't registered — log a warning.
      if (typeof process === "undefined" || process.env?.["NODE_ENV"] !== "production") {
        console.warn(
          `[sherpa-node] No template found for kind="${kind}" subtype="${subtype}". ` +
          `Available templates:`,
          [...this.querySelectorAll("template.rows-tpl")].map(t =>
            `kind="${t.getAttribute("data-kind") || "?"}" subtype="${t.getAttribute("data-subtype") || "?"}"`
          )
        );
      }
      return;
    }
    // Capture existing template-row control values BEFORE removing
    // them, so we can restore them onto the freshly-cloned template.
    // Without this, every #applyTemplate run (including the one that
    // fires when a node is reattached after a subgraph push/pop
    // snapshot/restore cycle) silently wipes user-set values.
    const preserved = new Map<string, string>();
    for (const ctrl of this.querySelectorAll(
      ":scope > [data-template-row] [slot='control'][name]"
    )) {
      const name = ctrl.getAttribute("name");
      // Preserve all values, including empty strings - empty is a valid state
      // (e.g., user cleared the field). Only skip null/undefined.
      const v = ctrl.getAttribute("value");
      if (name && v != null) preserved.set(name, v);
    }
    // Remove rows from a previous template clone (tagged data-template-row).
    for (const old of [...this.querySelectorAll(":scope > [data-template-row]")]) {
      old.remove();
    }
    const clone = tpl.content.cloneNode(true) as DocumentFragment;
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
        if (name && preserved.has(name)) {
          const value = preserved.get(name);
          if (value !== undefined) ctrl.setAttribute("value", value);
        }
      }
    }
    this.appendChild(clone);
    // Optional: templates may declare helper text for the built-in
    // subtype (Type) select via `data-subtype-helper="…"` on the
    // <template> element — mirror it onto the subtype-select.
    const helper = tpl.getAttribute("data-subtype-helper") || "";
    if (this.#subtypeSelect) {
      if (helper) this.#subtypeSelect.setAttribute("data-helper", helper);
      else this.#subtypeSelect.removeAttribute("data-helper");
    }
    // Apply data-show-if conditional row visibility, then re-apply
    // whenever a control value changes (handled in #onControlChange).
    queueMicrotask(() => this.#applyShowIf());
    // Tell the canvas a template swap may have changed available
    // controls / sockets; defer so the new elements have time to
    // upgrade before the propagation pass reads their values.
    queueMicrotask(() => {
      this.emit("sherpa-node-value-change", { nodeId: this.nodeId, reason: "template" });
    });
  }

  /**
   * Evaluate `data-show-if` on every template-cloned row and toggle
   * the `hidden` attribute.
   *
   * Supported syntax:
   *   data-show-if="ctrlName=val|val2"         — Show if value is val OR val2
   *   data-show-if="ctrlName!=val"             — Show if value is NOT val
   *   data-show-if="type=Notify, severity=High" — AND: both conditions must be true
   *
   * Multiple clauses (comma-separated) are AND-ed together.
   * The referenced control is matched by its `name` attribute on a
   * sibling `[slot="control"]` within the same node. Subtype select
   * is also addressable via the special name "subtype".
   */
  #applyShowIf(): void {
    const rows = this.querySelectorAll(":scope > [data-template-row][data-show-if]");
    if (!rows.length) return;
    const readVal = (name: string): string => {
      if (name === "subtype") return this.dataset["subtype"] || "";
      const ctrl = this.querySelector<HTMLElement & { value?: string }>(`:scope > [data-template-row] > [slot="control"][name="${CSS.escape(name)}"]`);
      if (!ctrl) return "";
      return ctrl.getAttribute("value") ?? ctrl.value ?? "";
    };
    for (const row of rows) {
      const expr = row.getAttribute("data-show-if") || "";
      const clauses = expr.split(",").map((s) => s.trim()).filter(Boolean);
      const ok = clauses.every((c) => {
        // Support both = and != operators
        const isNegated = c.includes("!=");
        const [name, vals] = c.split(isNegated ? "!=" : "=").map((s) => s.trim());
        if (!name || vals == null) return true;
        const allowed = vals.split("|").map((s) => s.trim());
        const currentVal = String(readVal(name));
        const matches = allowed.includes(currentVal);
        return isNegated ? !matches : matches;
      });
      row.toggleAttribute("hidden", !ok);
    }
  }

  #onSubtypeChange = (e: Event): void => {
    // sherpa-input-select fires a `change` CustomEvent with detail.value.
    // Fall back to reading value off the element for safety.
    const value = (e as CustomEvent)?.detail?.value ?? this.#subtypeSelect?.getAttribute("value") ?? "";
    this.setAttribute("data-subtype", value);
    this.emit("sherpa-node-subtype-change", { nodeId: this.nodeId, subtype: value });
  };

  #stopPointer = (e: Event): void => { e.stopPropagation(); };

  #onPointerDown = (e: Event): void => {
    // Sockets stop propagation themselves; everything else here is body.
    this.emit("sherpa-node-pointerdown", { nodeId: this.nodeId, originalEvent: e });
  };
}

if (!customElements.get("sherpa-node")) {
  customElements.define("sherpa-node", SherpaNode);
}
