/**
 * sherpa-prompt-composer.js
 * SherpaPromptComposer — Auto-growing prompt textarea with circular
 * send button. Designed for AI / chat surfaces.
 *
 * @element sherpa-prompt-composer
 * @category ai
 *
 * @attr {string}  data-placeholder — Placeholder text.
 * @attr {boolean} data-disabled    — Disables input + send.
 * @attr {number}  data-max-height  — Max textarea height in px (default 160).
 *
 * @fires prompt-submit — Fired on submit (Enter or send button) when
 *   the trimmed value is non-empty. Detail: { value: string }.
 *   The input is NOT cleared automatically — the host should call
 *   `clear()` once the prompt has been accepted, so a slow consumer
 *   can keep the prompt visible while it streams a response.
 *
 * @prop {string}  value           — Current textarea value.
 * @method focus()                  — Focus the textarea.
 * @method clear()                  — Clear and reset the textarea height.
 * @method setBusy(boolean)         — Toggle disabled state.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaPromptComposer extends SherpaElement {
  static override get cssUrl(): string  { return new URL("./sherpa-prompt-composer.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-prompt-composer.html", import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-placeholder",
      "data-disabled",
      "data-max-height",
    ];
  }

  els = this.cacheElements({
    form: { selector: '.composer', type: HTMLFormElement },
    input: { selector: '.composer-input', type: HTMLTextAreaElement },
    send: { selector: '.composer-send', type: HTMLButtonElement }
  });

  #bound = false;

  /* ── lifecycle ───────────────────────────────────────────── */

  override onRender(): void {
    if (!this.#bound) {
      this.els.form?.addEventListener("submit", this.#onSubmit);
      this.els.input?.addEventListener("input",   this.#onInput);
      this.els.input?.addEventListener("keydown", this.#onKeyDown);
      this.#bound = true;
    }

    this.#syncPlaceholder();
    this.#syncDisabled();
    this.#syncMaxHeight();
  }

  override onAttributeChanged(name) {
    switch (name) {
      case "data-placeholder": this.#syncPlaceholder(); break;
      case "data-disabled":    this.#syncDisabled();    break;
      case "data-max-height":  this.#syncMaxHeight();   break;
    }
  }

  /* ── handlers ────────────────────────────────────────────── */

  #onSubmit = (e: Event) => {
    e.preventDefault();
    if (this.#isDisabled()) return;
    const value = (this.els.input?.value ?? "").trim();
    if (!value) return;
    this.dispatchEvent(new CustomEvent("prompt-submit", {
      bubbles: true,
      composed: true,
      detail: { value },
    }));
  };

  #onInput = () => this.#autoresize();

  #onKeyDown = (e: Event) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.els.form?.requestSubmit();
    }
  };

  /* ── sync helpers ────────────────────────────────────────── */

  #syncPlaceholder() {
    if (this.els.input) this.els.input.placeholder = this.dataset.placeholder ?? "";
  }
  #syncDisabled() {
    const off = this.#isDisabled();
    if (this.els.input) this.els.input.disabled = off;
    if (this.els.send)  this.els.send.disabled  = off;
  }
  #syncMaxHeight() {
    const px = Number(this.dataset.maxHeight);
    if (Number.isFinite(px) && px > 0) this.style.setProperty("--_max-height", `${px}px`);
    else this.style.removeProperty("--_max-height");
    this.#autoresize();
  }
  #isDisabled() { return this.hasAttribute("data-disabled"); }

  #autoresize() {
    if (!this.els.input) return;
    this.els.input.style.height = "auto";
    this.els.input.style.height =
      Math.min(this.els.input.scrollHeight, parseInt(getComputedStyle(this).getPropertyValue("--_max-height")) || 160) + "px";
  }

  /* ── public API ──────────────────────────────────────────── */

  get value()        { return this.els.input?.value ?? ""; }
  set value(v)       { if (this.els.input) { this.els.input.value = v ?? ""; this.#autoresize(); } }

  focus()            { this.els.input?.focus(); }
  clear()            { this.value = ""; }
  setBusy(busy)      {
    if (busy) this.setAttribute("data-disabled", "");
    else      this.removeAttribute("data-disabled");
  }
}

customElements.define("sherpa-prompt-composer", SherpaPromptComposer);
export { SherpaPromptComposer };
