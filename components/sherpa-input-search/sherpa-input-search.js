/**
 * @element sherpa-input-search
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
import "../sherpa-button/sherpa-button.js";

export class SherpaInputSearch extends SherpaInputBase {
  static get cssUrl() {
    return new URL("./sherpa-input-search.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-input-search.html", import.meta.url).href;
  }

  #clearBtn = null;
  #inputEl = null;

  async onInputRender() {
    this.#clearBtn = this.$(".search-clear");
    this.#inputEl = this.getInputElement();
    this.#updateClearVisibility();
  }

  onInputConnect() {
    this.#clearBtn?.addEventListener("click", this.#onClear);
    this.#inputEl?.addEventListener("keydown", this.#onKeyDown);
    this.#inputEl?.addEventListener("input", this.#onValueChange);
  }

  onInputDisconnect() {
    this.#clearBtn?.removeEventListener("click", this.#onClear);
    this.#inputEl?.removeEventListener("keydown", this.#onKeyDown);
    this.#inputEl?.removeEventListener("input", this.#onValueChange);
  }

  /* ── Public API ─────────────────────────────────────────────── */

  clear() {
    const el = this.getInputElement();
    if (el) {
      el.value = "";
      this.#updateClearVisibility();
      this.#fireSearch("");
    }
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #updateClearVisibility() {
    const hasValue = !!this.#inputEl?.value;
    this.toggleAttribute("data-has-value", hasValue);
  }

  #fireSearch(value) {
    this.dispatchEvent(
      new CustomEvent("search", {
        bubbles: true,
        composed: true,
        detail: { value },
      }),
    );
  }

  #onClear = () => {
    this.clear();
    this.#inputEl?.focus();
  };

  #onKeyDown = (e) => {
    if (e.key === "Enter") {
      this.#fireSearch(this.#inputEl?.value || "");
    }
  };

  #onValueChange = () => {
    this.#updateClearVisibility();
  };
}

customElements.define("sherpa-input-search", SherpaInputSearch);
