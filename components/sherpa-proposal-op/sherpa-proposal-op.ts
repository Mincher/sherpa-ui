/**
 * sherpa-proposal-op.js
 * SherpaProposalOp — Single change row inside <sherpa-proposal-preview>.
 *
 * @element sherpa-proposal-op
 * @category ai
 *
 * @attr {enum}   [data-op]     add | remove | update | add-edge | remove-edge
 * @attr {string} [data-label]  Body text describing the change.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

const TAGS = {
  "add":         "+",
  "add-edge":    "+",
  "remove":      "−",
  "remove-edge": "−",
  "update":      "~",
};

class SherpaProposalOp extends SherpaElement {
  static override get cssUrl(): string  { return new URL("./sherpa-proposal-op.css",  import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-proposal-op.html", import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-op", "data-label"];
  }

  /** @type {HTMLElement|null} */ #tagEl   = null;
  /** @type {HTMLElement|null} */ #labelEl = null;

  override onRender(): void {
    // @ts-expect-error - TODO: Fix type
    this.#tagEl   = this.$(".tag");
    // @ts-expect-error - TODO: Fix type
    this.#labelEl = this.$(".label");
    this.#sync();
  }

  override onAttributeChanged() { this.#sync(); }

  #sync() {
    if (!this.#tagEl || !this.#labelEl) return;
    const op = this.dataset["op"] || "";
    // @ts-expect-error - TODO: Fix type
    this.#tagEl.textContent   = TAGS[op] || "·";
    // @ts-expect-error - TODO: Fix type
    this.#labelEl.textContent = this.dataset["label"] || "";
  }
}

customElements.define("sherpa-proposal-op", SherpaProposalOp);
export { SherpaProposalOp };
