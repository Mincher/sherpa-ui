/**
 * sherpa-input-search.js
 * Search input with magnifying glass icon and clear button.
 *
 * @example
 *   <sherpa-input-search label="Search" placeholder="Search..."></sherpa-input-search>
 *
 * @fires input — { value }
 * @fires change — { value }
 * @fires search — { value } (fired on Enter or clear)
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaInputSearch extends SherpaInputBase {

  static get cssUrl()  { return new URL('./sherpa-input-search.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-search.html', import.meta.url).href; }

  #clearBtn = null;
  #inputEl = null;
  #searchWrapper = null;

  async onInputRender() {
    this.#clearBtn = this.$('.search-clear');
    this.#inputEl = this.getInputElement();
    this.#searchWrapper = this.$('.search-wrapper');
    this.#updateClearVisibility();
  }

  onInputConnect() {
    this.#clearBtn?.addEventListener('click', this.#onClear);
    this.#inputEl?.addEventListener('keydown', this.#onKeyDown);
    this.#inputEl?.addEventListener('input', this.#onValueChange);
  }

  onInputDisconnect() {
    this.#clearBtn?.removeEventListener('click', this.#onClear);
    this.#inputEl?.removeEventListener('keydown', this.#onKeyDown);
    this.#inputEl?.removeEventListener('input', this.#onValueChange);
  }

  /* ── Public API ─────────────────────────────────────────────── */

  clear() {
    const el = this.getInputElement();
    if (el) {
      el.value = '';
      this.#updateClearVisibility();
      this.#fireSearch('');
    }
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #updateClearVisibility() {
    if (!this.#clearBtn) return;
    const hasValue = !!this.#inputEl?.value;

    if (hasValue) {
      this.#clearBtn.removeAttribute('hidden');
      this.#searchWrapper?.classList.add('control-group');
    } else {
      this.#clearBtn.setAttribute('hidden', '');
      this.#searchWrapper?.classList.remove('control-group');
    }
  }

  #fireSearch(value) {
    this.dispatchEvent(new CustomEvent('search', {
      bubbles: true, composed: true, detail: { value }
    }));
  }

  #onClear = () => {
    this.clear();
    this.#inputEl?.focus();
  };

  #onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.#fireSearch(this.#inputEl?.value || '');
    }
  };

  #onValueChange = () => {
    this.#updateClearVisibility();
  };
}

customElements.define('sherpa-input-search', SherpaInputSearch);
