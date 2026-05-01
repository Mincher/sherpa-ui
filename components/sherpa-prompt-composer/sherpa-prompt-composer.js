/**
 * sherpa-prompt-composer.js
 * SherpaPromptComposer — Auto-growing prompt textarea with circular
 * send button. Designed for AI / chat surfaces.
 *
 * @element sherpa-prompt-composer
 *
 * @attr {string}  data-placeholder — Placeholder text.
 * @attr {flag}    data-disabled    — Disables input + send.
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
  static get cssUrl()  { return new URL("./sherpa-prompt-composer.css", import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-prompt-composer.html", import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-placeholder",
      "data-disabled",
      "data-max-height",
    ];
  }

  /** @type {HTMLFormElement|null} */    #formEl   = null;
  /** @type {HTMLTextAreaElement|null} */ #inputEl = null;
  /** @type {HTMLButtonElement|null} */   #sendEl  = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#formEl  = this.$(".composer");
    this.#inputEl = this.$(".composer-input");
    this.#sendEl  = this.$(".composer-send");

    this.#formEl?.addEventListener("submit", this.#onSubmit);
    this.#inputEl?.addEventListener("input",   this.#onInput);
    this.#inputEl?.addEventListener("keydown", this.#onKeydown);

    this.#syncPlaceholder();
    this.#syncDisabled();
    this.#syncMaxHeight();
  }

  onDisconnect() {
    this.#formEl?.removeEventListener("submit", this.#onSubmit);
    this.#inputEl?.removeEventListener("input",   this.#onInput);
    this.#inputEl?.removeEventListener("keydown", this.#onKeydown);
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-placeholder": this.#syncPlaceholder(); break;
      case "data-disabled":    this.#syncDisabled();    break;
      case "data-max-height":  this.#syncMaxHeight();   break;
    }
  }

  /* ── handlers ────────────────────────────────────────────── */

  #onSubmit = (e) => {
    e.preventDefault();
    if (this.#isDisabled()) return;
    const value = (this.#inputEl?.value ?? "").trim();
    if (!value) return;
    this.dispatchEvent(new CustomEvent("prompt-submit", {
      bubbles: true,
      composed: true,
      detail: { value },
    }));
  };

  #onInput = () => this.#autoresize();

  #onKeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.#formEl?.requestSubmit();
    }
  };

  /* ── sync helpers ────────────────────────────────────────── */

  #syncPlaceholder() {
    if (this.#inputEl) this.#inputEl.placeholder = this.dataset.placeholder ?? "";
  }
  #syncDisabled() {
    const off = this.#isDisabled();
    if (this.#inputEl) this.#inputEl.disabled = off;
    if (this.#sendEl)  this.#sendEl.disabled  = off;
  }
  #syncMaxHeight() {
    const px = Number(this.dataset.maxHeight);
    if (Number.isFinite(px) && px > 0) this.style.setProperty("--_max-height", `${px}px`);
    else this.style.removeProperty("--_max-height");
    this.#autoresize();
  }
  #isDisabled() { return this.hasAttribute("data-disabled"); }

  #autoresize() {
    if (!this.#inputEl) return;
    this.#inputEl.style.height = "auto";
    this.#inputEl.style.height =
      Math.min(this.#inputEl.scrollHeight, parseInt(getComputedStyle(this).getPropertyValue("--_max-height")) || 160) + "px";
  }

  /* ── public API ──────────────────────────────────────────── */

  get value()        { return this.#inputEl?.value ?? ""; }
  set value(v)       { if (this.#inputEl) { this.#inputEl.value = v ?? ""; this.#autoresize(); } }

  focus()            { this.#inputEl?.focus(); }
  clear()            { this.value = ""; }
  setBusy(busy)      {
    if (busy) this.setAttribute("data-disabled", "");
    else      this.removeAttribute("data-disabled");
  }
}

customElements.define("sherpa-prompt-composer", SherpaPromptComposer);
export { SherpaPromptComposer };
