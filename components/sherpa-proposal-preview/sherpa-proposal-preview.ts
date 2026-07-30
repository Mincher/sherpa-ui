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
 * @slot decision — Decision controls. Give each control a data-action of
 *                  "accept" | "reject" | "edit" and the preview emits the
 *                  matching canonical event when it's clicked.
 *
 * @fires proposal-accept — A decision control with data-action="accept" was clicked
 *   bubbles: true, composed: true · detail: { ops: Array<{op, target?, field?, value?}> }
 * @fires proposal-reject — data-action="reject" clicked · bubbles, composed · detail: {}
 * @fires proposal-edit   — data-action="edit" clicked   · bubbles, composed · detail: {}
 *
 * @prop {string} rationale — Getter/setter for data-rationale.
 * @method getOps() — Read the current ops as structured data from the slotted sherpa-proposal-op children
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import type { EventHandler } from "../utilities/types.js";

/** A structured proposal op read from a slotted sherpa-proposal-op. */
export interface ProposalOpData {
  op: string;
  target?: string;
  field?: string;
  value?: string;
  label?: string;
}

class SherpaProposalPreview extends SherpaElement {
  static override get cssUrl(): string  { return new URL("./sherpa-proposal-preview.css",  import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-proposal-preview.html", import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-rationale"];
  }

  #rationaleEl: HTMLElement | null = null;
  #bound = false;

  override onRender(): void {
    this.#rationaleEl = this.$<HTMLElement>(".rationale");
    if (!this.#bound) {
      // Decision buttons live in the light-DOM `decision` slot; their clicks
      // bubble to the host. Match by data-action and emit canonical events.
      this.addEventListener("click", this.#onDecisionClick);
      this.#bound = true;
    }
    this.#syncRationale();
  }

  override onAttributeChanged(name: string): void {
    if (name === "data-rationale") this.#syncRationale();
  }

  #syncRationale(): void {
    if (this.#rationaleEl) this.#rationaleEl.textContent = this.dataset["rationale"] || "";
  }

  /** Read the slotted sherpa-proposal-op children as structured data. */
  public getOps(): ProposalOpData[] {
    return [...this.querySelectorAll<HTMLElement>("sherpa-proposal-op")].map((el) => ({
      op: el.dataset["op"] || "update",
      target: el.dataset["target"],
      field: el.dataset["field"],
      value: el.dataset["value"],
      label: (el.textContent || "").trim() || undefined,
    }));
  }

  #onDecisionClick: EventHandler<MouseEvent> = (e: MouseEvent) => {
    const control = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    const action = control?.dataset["action"];
    if (action === "accept") this.emit("proposal-accept", { ops: this.getOps() });
    else if (action === "reject") this.emit("proposal-reject", {});
    else if (action === "edit") this.emit("proposal-edit", {});
  };

  /* ── public API ──────────────────────────────────────────── */
  get rationale(): string  { return this.dataset["rationale"] || ""; }
  set rationale(v: string) { if (v == null) { this.removeAttribute("data-rationale"); } else { this.dataset["rationale"] = String(v); } }
}

customElements.define("sherpa-proposal-preview", SherpaProposalPreview);
export { SherpaProposalPreview };
