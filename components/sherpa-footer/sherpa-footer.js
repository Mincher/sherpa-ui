/**
 * @element sherpa-footer
 * @description Reusable footer with multiple template variants.
 *   Template selected via data-type attribute.
 *
 * @attr {enum}    [data-type]          — action-bar | slot (default: slot)
 * @attr {string}  [data-cancel-label]  — Cancel button text (action-bar)
 * @attr {string}  [data-apply-label]   — Apply button text (action-bar)
 * @attr {boolean} [data-show-cancel]   — Show cancel button (default: true)
 * @attr {boolean} [data-show-apply]    — Show apply button (default: true)
 * @attr {boolean} [data-apply-closes]  — Apply auto-closes parent (default: true)
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

export class SherpaFooter extends SherpaElement {
  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl() {
    return new URL("./sherpa-footer.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-footer.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      "data-type",
      "data-cancel-label",
      "data-apply-label",
      "data-show-cancel",
      "data-show-apply",
      "data-apply-closes",
    ];
  }

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    return this.dataset.type || "slot";
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    this.#syncLabels();
    this.#wireEvents();
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-cancel-label":
      case "data-apply-label":
        this.#syncLabels();
        break;
      // data-show-cancel / data-show-apply visibility handled by CSS:
      //   :host([data-show-cancel="false"]) .cancel-button { display: none; }
      //   :host([data-show-apply="false"])  .apply-button  { display: none; }
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get type() {
    return this.dataset.type || "slot";
  }
  set type(v) {
    this.dataset.type = v;
  }

  get cancelLabel() {
    return this.dataset.cancelLabel || "Cancel";
  }
  set cancelLabel(v) {
    v ? (this.dataset.cancelLabel = v) : delete this.dataset.cancelLabel;
  }

  get applyLabel() {
    return this.dataset.applyLabel || "Apply";
  }
  set applyLabel(v) {
    v ? (this.dataset.applyLabel = v) : delete this.dataset.applyLabel;
  }

  get showCancel() {
    return this.dataset.showCancel !== "false";
  }
  set showCancel(v) {
    this.dataset.showCancel = v ? "true" : "false";
  }

  get showApply() {
    return this.dataset.showApply !== "false";
  }
  set showApply(v) {
    this.dataset.showApply = v ? "true" : "false";
  }

  get applyCloses() {
    return this.dataset.applyCloses !== "false";
  }
  set applyCloses(v) {
    this.dataset.applyCloses = v ? "true" : "false";
  }

  /* ── Private ──────────────────────────────────────────────────── */

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

customElements.define("sherpa-footer", SherpaFooter);
