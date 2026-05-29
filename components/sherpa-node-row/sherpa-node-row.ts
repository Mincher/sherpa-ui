/**
 * sherpa-node-row.js — Generic field row for sherpa-node bodies.
 *
 * Pure layout component. Holds slots; emits no events.
 * Slot presence is auto-mirrored on the host as data-has-{slotname}
 * via SherpaElement's default onSlotChange handler.
 *
 * @element sherpa-node-row
 * @category content
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
  static override get cssUrl(): string { return new URL("./sherpa-node-row.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-node-row.html", import.meta.url).href; }


  /** Adopt the sherpa-node family tokens into every shadow root. */
  static get sharedStyles() {
    return [
      ...super.sharedStyles,
      new URL("../sherpa-node/sherpa-node-tokens.css", import.meta.url).href,
    ];
  }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-multi"];
  }

  #inSocketSlot = null;
  #outSocketSlot = null;
  #bound = false;

  override onRender(): void {
    this.#inSocketSlot = this.$('slot[name="input-socket"]');
    this.#outSocketSlot = this.$('slot[name="output-socket"]');

    if (!this.#bound) {
      this.#inSocketSlot?.addEventListener("slotchange", this.#tagSockets);
      this.#outSocketSlot?.addEventListener("slotchange", this.#tagSockets);
      this.#bound = true;
    }

    this.#tagSockets();
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
