/**
 * sherpa-node-header.js — 48-tall header for sherpa-node.
 *
 * Provides:
 *   • Built-in icon shorthand via data-icon="fa-..." (FontAwesome class)
 *   • Built-in drill-down button via data-drill-down (used by Group nodes)
 *   • Auto-tags slotted sockets with data-location="header" so their
 *     CSS picks the correct shape from the locked matrix.
 *
 * @element sherpa-node-header
 * @category content
 *
 * @attr {string}  data-icon        — FontAwesome class (e.g. "fa-solid fa-cube")
 * @attr {boolean} data-drill-down  — Show built-in drill-down button
 *
 * @fires sherpa-node-drilldown
 *   bubbles: true, composed: true
 *   detail: { nodeId | null }
 *
 * @slot icon          — Custom leading icon (overrides data-icon)
 * @slot title         — Header title text
 * @slot actions       — Trailing icons/buttons
 * @slot input-socket  — Slot in left gutter (control-flow input)
 * @slot output-socket — Slot in right gutter (control-flow output)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaNodeHeader extends SherpaElement {
  static override get cssUrl(): string { return new URL("./sherpa-node-header.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-node-header.html", import.meta.url).href; }

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
      "data-icon",
      "data-drill-down",
    ];
  }

  els = this.cacheElements({
    iconBuiltIn: '.icon-built-in',
    iconWrap: '.icon',
    drillBtn: '.drill-down',
    inSocketSlot: 'slot[name="input-socket"]',
    outSocketSlot: 'slot[name="output-socket"]'
  });

  #bound = false;

  override onRender(): void {
    if (!this.#bound) {
      this.els.drillBtn?.addEventListener("click", this.#onDrillClick);
      this.els.inSocketSlot?.addEventListener("slotchange", this.#tagSockets);
      this.els.outSocketSlot?.addEventListener("slotchange", this.#tagSockets);
      this.#bound = true;
    }

    this.#syncIcon();
    this.#tagSockets();
  }

  onAttributeChanged(name) {
    if (name === "data-icon") this.#syncIcon();
  }

  /* ── Internals ─────────────────────────────────────────────────── */

  #syncIcon() {
    if (!this.els.iconBuiltIn || !this.els.iconWrap) return;
    const cls = this.dataset.icon;
    if (cls) {
      this.els.iconBuiltIn.className = `icon-built-in ${cls}`;
      this.els.iconWrap.toggleAttribute("data-has-built-in", true);
    } else {
      this.els.iconBuiltIn.className = "icon-built-in";
      this.els.iconWrap.toggleAttribute("data-has-built-in", false);
    }
  }

  #onDrillClick = (e) => {
    e.stopPropagation();
    const node = this.closest("sherpa-node");
    this.dispatchEvent(new CustomEvent("sherpa-node-drilldown", {
      bubbles: true,
      composed: true,
      detail: { nodeId: node?.dataset?.nodeId || null },
    }));
  };

  #tagSockets = () => {
    for (const slot of [this.els.inSocketSlot, this.els.outSocketSlot]) {
      if (!slot) continue;
      const assigned = slot.assignedElements({ flatten: true });
      for (const el of assigned) {
        if (el.localName === "sherpa-node-socket") {
          el.setAttribute("data-location", "header");
        }
      }
    }
  };
}

if (!customElements.get("sherpa-node-header")) {
  customElements.define("sherpa-node-header", SherpaNodeHeader);
}
