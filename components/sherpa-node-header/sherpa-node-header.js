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
  static get cssUrl() { return new URL("./sherpa-node-header.css", import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-node-header.html", import.meta.url).href; }

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
      "data-icon",
      "data-drill-down",
    ];
  }

  #iconBuiltInEl = null;
  #iconWrapEl = null;
  #drillBtnEl = null;
  #inSocketSlot = null;
  #outSocketSlot = null;
  #bound = false;

  onRender() {
    this.#iconBuiltInEl = this.$(".icon-built-in");
    this.#iconWrapEl = this.$(".icon");
    this.#drillBtnEl = this.$(".drill-down");
    this.#inSocketSlot = this.$('slot[name="input-socket"]');
    this.#outSocketSlot = this.$('slot[name="output-socket"]');

    if (!this.#bound) {
      this.#drillBtnEl?.addEventListener("click", this.#onDrillClick);
      this.#inSocketSlot?.addEventListener("slotchange", this.#tagSockets);
      this.#outSocketSlot?.addEventListener("slotchange", this.#tagSockets);
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
    if (!this.#iconBuiltInEl || !this.#iconWrapEl) return;
    const cls = this.dataset.icon;
    if (cls) {
      this.#iconBuiltInEl.className = `icon-built-in ${cls}`;
      this.#iconWrapEl.toggleAttribute("data-has-built-in", true);
    } else {
      this.#iconBuiltInEl.className = "icon-built-in";
      this.#iconWrapEl.toggleAttribute("data-has-built-in", false);
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
    for (const slot of [this.#inSocketSlot, this.#outSocketSlot]) {
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
