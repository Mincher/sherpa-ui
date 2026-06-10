/**
 * sherpa-proposal-preview.js
 * SherpaProposalPreview — Agent proposal renderer.
 *
 * @element sherpa-proposal-preview
 * @category ai
 * @description Displays an AI agent's proposed changes as a structured diff view. Use inside a
 *   sherpa-chat-message or a dedicated panel when an agent needs to present what it is about
 *   to do before executing. Slot one sherpa-proposal-op per change into the ops slot, and slot
 *   decision buttons (Approve / Reject / Edit) into the decision slot.
 *
 * @attr {string} data-rationale  Italic rationale shown above the ops.
 *
 * @slot ops      — One <sherpa-proposal-op> per change.
 * @slot raw      — Raw proposal payload (typically a <pre>).
 * @slot decision — Decision controls (typically <sherpa-button> trio).
 *
 * @prop {string} rationale — Getter/setter for data-rationale.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaProposalPreview extends SherpaElement {
  static override get cssUrl(): string  { return new URL("./sherpa-proposal-preview.css",  import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-proposal-preview.html", import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-rationale"];
  }

  #rationaleEl: HTMLElement | null = null;

  override onRender(): void {
    this.#rationaleEl = this.$<HTMLElement>(".rationale");
    this.#syncRationale();
  }

  override onAttributeChanged(name: string) {
    if (name === "data-rationale") this.#syncRationale();
  }

  #syncRationale() {
    if (this.#rationaleEl) this.#rationaleEl.textContent = this.dataset["rationale"] || "";
  }

  /* ── public API ──────────────────────────────────────────── */
  get rationale()  { return this.dataset["rationale"] || ""; }
  set rationale(v) { if (v == null) this.removeAttribute("data-rationale"); else this.dataset["rationale"] = String(v); }
}

customElements.define("sherpa-proposal-preview", SherpaProposalPreview);
export { SherpaProposalPreview };
