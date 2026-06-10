/**
 * sherpa-node-row.js — Unified row component for sherpa-node.
 *
 * Handles both header rows and body rows via data-variant attribute.
 * Pure layout component. Holds slots; emits events only for header actions.
 * Slot presence is auto-mirrored on the host as data-has-{slotname}
 * via SherpaElement's default onSlotChange handler.
 *
 * @element sherpa-node-row
 * @category content
 * @description Unified row inside a sherpa-node, handling both header rows (data-variant="header")
 *   and body rows (data-variant="body"). Header rows show an icon, title, and optional drill-down
 *   button. Body rows provide slots for a field label, an input control, and an optional socket.
 *   Always a child of sherpa-node; not used standalone.
 *
 * @attr {enum}    data-variant   — "header" | "body" (default: "body")
 * @attr {boolean} data-multi     — Visually expand for multi-input rows
 * @attr {string}  data-icon      — FontAwesome class for built-in icon (header variant only)
 * @attr {boolean} data-drill-down — Show drill-down button (header variant only)
 *
 * @fires sherpa-node-drilldown (header variant only)
 *   bubbles: true, composed: true
 *   detail: { nodeId | null }
 *
 * @slot icon          — Custom leading icon (header variant only, overrides data-icon)
 * @slot title         — Header title text (header variant)
 * @slot actions       — Trailing icons/buttons (header variant)
 * @slot label         — Field label (body variant)
 * @slot control       — Input/select/chip group (body variant)
 * @slot helper        — Optional helper text (body variant)
 * @slot input-socket  — Slot in the LEFT gutter
 * @slot output-socket — Slot in the RIGHT gutter
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaNodeRow extends SherpaElement {
  static override get cssUrl(): string { return new URL("./sherpa-node-row.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-node-row.html", import.meta.url).href; }


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
      "data-variant",
      "data-multi",
      "data-icon",
      "data-drill-down",
    ];
  }

  els = this.cacheElements({
    iconBuiltIn: '.icon-built-in',
    iconWrap: '.icon',
    drillBtn: '.drill-down'
  });

  #bound = false;

  override onRender(): void {
    if (!this.#bound) {
      this.els.drillBtn?.addEventListener("click", this.#onDrillClick);
      this.#bound = true;
    }

    this.#syncIcon();
  }

  override onAttributeChanged(name: string) {
    if (name === "data-icon") this.#syncIcon();
  }

  /* ── Internals ─────────────────────────────────────────────────── */

  #syncIcon() {
    if (!this.els.iconBuiltIn || !this.els.iconWrap) return;
    const cls = this.dataset["icon"];
    if (cls) {
      this.els.iconBuiltIn.className = `icon-built-in ${cls}`;
      this.els.iconWrap.toggleAttribute("data-has-built-in", true);
    } else {
      this.els.iconBuiltIn.className = "icon-built-in";
      this.els.iconWrap.toggleAttribute("data-has-built-in", false);
    }
  }

  #onDrillClick = (e: Event) => {
    e.stopPropagation();
    const node = this.closest<HTMLElement>("sherpa-node");
    this.emit("sherpa-node-drilldown", { nodeId: node?.dataset?.["nodeId"] || null });
  };
}

if (!customElements.get("sherpa-node-row")) {
  customElements.define("sherpa-node-row", SherpaNodeRow);
}
