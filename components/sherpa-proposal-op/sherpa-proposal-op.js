/**
 * sherpa-proposal-op.js
 * SherpaProposalOp — Single change row inside <sherpa-proposal-preview>.
 *
 * @element sherpa-proposal-op
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
  static get cssUrl()  { return new URL("./sherpa-proposal-op.css",  import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-proposal-op.html", import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-op", "data-label"];
  }

  /** @type {HTMLElement|null} */ #tagEl   = null;
  /** @type {HTMLElement|null} */ #labelEl = null;

  onRender() {
    this.#tagEl   = this.$(".tag");
    this.#labelEl = this.$(".label");
    this.#sync();
  }

  onAttributeChanged() { this.#sync(); }

  #sync() {
    if (!this.#tagEl || !this.#labelEl) return;
    const op = this.dataset.op || "";
    this.#tagEl.textContent   = TAGS[op] || "·";
    this.#labelEl.textContent = this.dataset.label || "";
  }
}

customElements.define("sherpa-proposal-op", SherpaProposalOp);
export { SherpaProposalOp };
