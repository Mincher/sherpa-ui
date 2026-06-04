/**
 * @element sherpa-input-search
 * @category input
 * @extends SherpaInputBase
 * @description Search input with magnifying glass icon and clear button.
 *   Inherits label, description, helper, layout, validation from SherpaInputBase.
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires search
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @method clear() — Clear the search field and fire search event
 */

import { SherpaInputBase } from "../utilities/sherpa-input-base/sherpa-input-base.js";
import type { ChangeEventDetail } from "../utilities/types.js";
import "../sherpa-button/sherpa-button.js";

export class SherpaInputSearch extends SherpaInputBase {

  static override get cssUrl(): string {
    return new URL("./sherpa-input-search.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-input-search.html", import.meta.url).href;
  }

  #clearBtnEl: HTMLElement | null = null;
  #inputEl: HTMLInputElement | null = null;

  override async onInputRender(): Promise<void> {
    this.#clearBtnEl = this.$<HTMLElement>(".search-clear");
    this.#inputEl = this.getInputElement() as HTMLInputElement;
    this.#updateClearVisibility();
  }

  override onInputConnect(): void {
    this.#clearBtnEl?.addEventListener("click", this.#onClear);
    this.#inputEl?.addEventListener("keydown", this.#onKeyDown);
    this.#inputEl?.addEventListener("input", this.#onValueChange);
  }

  override onInputDisconnect(): void {
    this.#clearBtnEl?.removeEventListener("click", this.#onClear);
    this.#inputEl?.removeEventListener("keydown", this.#onKeyDown);
    this.#inputEl?.removeEventListener("input", this.#onValueChange);
  }

  /* ── Public API ─────────────────────────────────────────────── */

  clear(): void {
    const el = this.getInputElement();
    if (el) {
      el.value = "";
      this.#updateClearVisibility();
      this.#fireSearch("");
    }
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #updateClearVisibility(): void {
    const hasValue = !!this.#inputEl?.value;
    this.toggleAttribute("data-has-value", hasValue);
  }

  #fireSearch(value: string): void {
    this.dispatchEvent(
      new CustomEvent<ChangeEventDetail<string>>("search", {
        bubbles: true,
        composed: true,
        detail: { value },
      }),
    );
  }

  #onClear = (): void => {
    this.clear();
    this.#inputEl?.focus();
  };

  #onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      this.#fireSearch(this.#inputEl?.value || "");
    }
  };

  #onValueChange = (): void => {
    this.#updateClearVisibility();
  };
}

customElements.define("sherpa-input-search", SherpaInputSearch);
