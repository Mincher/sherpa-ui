/**
 * sherpa-node-row.js — Generic field row for sherpa-node bodies.
 *
 * Pure layout component. Holds slots; emits no events.
 * Slot presence is auto-mirrored on the host as data-has-{slotname}
 * via SherpaElement's default onSlotChange handler.
 *
 * @element sherpa-node-row
 *
 * @attr {boolean} data-multi  — Visually expand for multi-input rows
 *
 * @slot label         — Field label
 * @slot control       — Input/select/chip group
 * @slot helper        — Optional helper text
 * @slot input-socket  — Slot in the LEFT gutter
 * @slot output-socket — Slot in the RIGHT gutter
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaNodeRow extends SherpaElement {
  static get cssUrl() { return new URL("./sherpa-node-row.css", import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-node-row.html", import.meta.url).href; }


  /** Adopt the sherpa-node family tokens into every shadow root. */
  static get sharedStyles() {
    return [
      ...super.sharedStyles,
      new URL("../sherpa-node/sherpa-node-tokens.css", import.meta.url).href,
    ];
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-multi"];
  }

  #inSocketSlot = null;
  #outSocketSlot = null;

  onRender() {
    this.#inSocketSlot = this.$('slot[name="input-socket"]');
    this.#outSocketSlot = this.$('slot[name="output-socket"]');
  }

  onConnect() {
    this.#inSocketSlot?.addEventListener("slotchange", this.#tagSockets);
    this.#outSocketSlot?.addEventListener("slotchange", this.#tagSockets);
    this.#tagSockets();
  }

  onDisconnect() {
    this.#inSocketSlot?.removeEventListener("slotchange", this.#tagSockets);
    this.#outSocketSlot?.removeEventListener("slotchange", this.#tagSockets);
  }

  /** Tag slotted <sherpa-node-socket> with data-location="row". */
  #tagSockets = () => {
    for (const slot of [this.#inSocketSlot, this.#outSocketSlot]) {
      if (!slot) continue;
      const assigned = slot.assignedElements({ flatten: true });
      for (const el of assigned) {
        if (el.localName === "sherpa-node-socket") {
          el.setAttribute("data-location", "row");
        }
      }
    }
  };
}

if (!customElements.get("sherpa-node-row")) {
  customElements.define("sherpa-node-row", SherpaNodeRow);
}
