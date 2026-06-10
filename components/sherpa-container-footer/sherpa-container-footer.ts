/**
 * @element sherpa-container-footer
 * @category container
 * @description Standardised footer for dialogs, popovers, and containers. Use the action-bar
 *   variant (Cancel/Apply) inside dialogs and panels — it fires footer-cancel and footer-apply
 *   events automatically. The slot variant is a transparent pass-through for custom footer
 *   content. The card-select variant renders a radio button for selectable card patterns.
 *   Slot as slot="footer" inside a container or dialog.
 *
 * @attr {enum}    data-type          — action-bar | slot | card-select (default: slot)
 * @attr {string}  data-cancel-label  — Cancel button text (action-bar)
 * @attr {string}  data-apply-label   — Apply button text (action-bar)
 * @attr {boolean} data-show-cancel   — Show cancel button (default: true)
 * @attr {boolean} data-show-apply    — Show apply button (default: true)
 * @attr {boolean} data-apply-closes  — Apply auto-closes parent (default: true)
 * @attr {boolean} data-selected      — Drives radio checked state (card-select)
 *
 * @slot start     — Content aligned to the left (action-bar)
 * @slot (default) — Passthrough content (slot variant)
 *
 * @fires footer-cancel
 *   bubbles: true, composed: true
 *   detail: none
 * @fires footer-apply
 *   bubbles: true, composed: true
 *   detail: { closes: boolean }
 *
 * @prop {string}  type         — Getter/setter for data-type
 * @prop {string}  cancelLabel  — Getter/setter for data-cancel-label
 * @prop {string}  applyLabel   — Getter/setter for data-apply-label
 * @prop {boolean} showCancel   — Getter/setter for data-show-cancel
 * @prop {boolean} showApply    — Getter/setter for data-show-apply
 * @prop {boolean} applyCloses  — Getter/setter for data-apply-closes
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaContainerFooter extends SherpaElement {
  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string {
    return new URL("./sherpa-container-footer.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-container-footer.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-type",
      "data-cancel-label",
      "data-apply-label",
      "data-show-cancel",
      "data-show-apply",
      "data-apply-closes",
      "data-selected",
    ];
  }

  els = this.cacheElements({
    radio: '.card-radio'
  });

  /* ── Template selection ───────────────────────────────────────── */

  override get templateId(): string {
    return this.dataset["type"] || "slot";
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  override onRender(): void {
    this.#syncLabels();
    this.#wireEvents();
    this.#syncRadio();
  }

  override onAttributeChanged(name: string) {
    switch (name) {
      case "data-cancel-label":
      case "data-apply-label":
        this.#syncLabels();
        break;
      case "data-selected":
        this.#syncRadio();
        break;
      // data-show-cancel / data-show-apply visibility handled by CSS:
      //   :host([data-show-cancel="false"]) .cancel-button { display: none; }
      //   :host([data-show-apply="false"])  .apply-button  { display: none; }
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get type() {
    return this.dataset["type"] || "slot";
  }
  set type(v) {
    this.dataset["type"] = v;
  }

  get cancelLabel() {
    return this.dataset["cancelLabel"] || "Cancel";
  }
  set cancelLabel(v) {
    v ? (this.dataset["cancelLabel"] = v) : delete this.dataset["cancelLabel"];
  }

  get applyLabel() {
    return this.dataset["applyLabel"] || "Apply";
  }
  set applyLabel(v) {
    v ? (this.dataset["applyLabel"] = v) : delete this.dataset["applyLabel"];
  }

  get showCancel() {
    return this.dataset["showCancel"] !== "false";
  }
  set showCancel(v) {
    this.dataset["showCancel"] = v ? "true" : "false";
  }

  get showApply() {
    return this.dataset["showApply"] !== "false";
  }
  set showApply(v) {
    this.dataset["showApply"] = v ? "true" : "false";
  }

  get applyCloses() {
    return this.dataset["applyCloses"] !== "false";
  }
  set applyCloses(v) {
    this.dataset["applyCloses"] = v ? "true" : "false";
  }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncRadio() {
    if (!this.els.radio) return;
    this.dataset["selected"] === "true"
      ? this.els.radio.setAttribute("checked", "")
      : this.els.radio.removeAttribute("checked");
  }

  #syncLabels() {
    const cancelBtn = this.$(".cancel-button");
    if (cancelBtn) cancelBtn.textContent = this.cancelLabel;

    const applyBtn = this.$(".apply-button");
    if (applyBtn) applyBtn.textContent = this.applyLabel;
  }

  #wireEvents() {
    const cancelBtn = this.$(".cancel-button");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("footer-cancel", { bubbles: true, composed: true }),
        );
      });
    }

    const applyBtn = this.$(".apply-button");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("footer-apply", {
            bubbles: true,
            composed: true,
            detail: { closes: this.applyCloses },
          }),
        );
      });
    }
  }
}

customElements.define("sherpa-container-footer", SherpaContainerFooter);
