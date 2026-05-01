/**
 * sherpa-proposal-preview.js
 * SherpaProposalPreview — Agent proposal renderer.
 *
 * @element sherpa-proposal-preview
 *
 * @attr {string} [data-rationale]  Italic rationale shown above the ops.
 *
 * @slot ops      — One <sherpa-proposal-op> per change.
 * @slot raw      — Raw proposal payload (typically a <pre>).
 * @slot decision — Decision controls (typically <sherpa-button> trio).
 *
 * @prop {string} rationale — Getter/setter for data-rationale.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaProposalPreview extends SherpaElement {
  static get cssUrl()  { return new URL("./sherpa-proposal-preview.css",  import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-proposal-preview.html", import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-rationale"];
  }

  /** @type {HTMLElement|null} */ #rationaleEl = null;

  onRender() {
    this.#rationaleEl = this.$(".rationale");
    this.#syncRationale();
  }

  onAttributeChanged(name) {
    if (name === "data-rationale") this.#syncRationale();
  }

  #syncRationale() {
    if (this.#rationaleEl) this.#rationaleEl.textContent = this.dataset.rationale || "";
  }

  /* ── public API ──────────────────────────────────────────── */
  get rationale()  { return this.dataset.rationale || ""; }
  set rationale(v) { if (v == null) this.removeAttribute("data-rationale"); else this.dataset.rationale = String(v); }
}

customElements.define("sherpa-proposal-preview", SherpaProposalPreview);
export { SherpaProposalPreview };
