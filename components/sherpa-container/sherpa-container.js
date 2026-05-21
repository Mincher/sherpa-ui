/**
 * sherpa-container.js
 * SherpaContainer — Universal container for dashboard composition and standalone
 * card layouts. Owns sizing variants, a named container query scope, state
 * overlays (loading/empty/error), optional interactivity and selection state.
 *
 * @element sherpa-container
 * @category container
 *
 * @attr {enum}    [data-variant=fit]   — fit | resizable | fill | worksheet
 * @attr {number}  [data-col-span]      — Column span: 3 | 6 | 9 | 12 (resizable)
 * @attr {number}  [data-row-span]      — Row span: 1–6 (resizable)
 * @attr {boolean} [data-editable]      — Edit mode (enables resize grip)
 * @attr {boolean} [data-menu-open]     — Reflected while a descendant menu is open
 * @attr {enum}    [data-state]         — ready | loading | empty | error
 * @attr {boolean} data-interactive     — Makes the container a clickable surface
 * @attr {boolean} data-selectable      — Makes the container a selectable radio option
 * @attr {boolean} data-selected        — Selected / active state
 * @attr {enum}    data-elevation       — none | sm | md | lg
 * @attr {boolean} disabled             — Native disabled state
 *
 * @slot (default) — Main content (dashboard children or card body)
 * @slot header    — Card-style header (use sherpa-header); edge-to-edge with separator
 * @slot footer    — Card-style footer (use sherpa-footer or sherpa-button)
 * @slot loading   — Shown when data-state="loading"
 * @slot empty     — Shown when data-state="empty"
 * @slot error     — Shown when data-state="error"
 *
 * @fires card-click   — Fired when an interactive container is clicked or keyboard-activated
 *   bubbles: true, composed: true
 *   detail: {}
 * @fires card-select  — Fired when a selectable container's selection changes
 *   bubbles: true, composed: true
 *   detail: { selected: boolean }
 * @fires container-increase-cols — Bubbled from injected resize menu items
 * @fires container-decrease-cols — Bubbled from injected resize menu items
 * @fires container-increase-rows — Bubbled from injected resize menu items
 * @fires container-decrease-rows — Bubbled from injected resize menu items
 *
 * @prop {boolean} selected    — Selected state (read/write)
 * @prop {boolean} interactive — Clickable state (read/write)
 * @prop {boolean} selectable  — Selectable state (read/write)
 * @prop {boolean} disabled    — Disabled state (read/write)
 * @prop {string}  elevation   — Shadow level (read/write)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { ResizeBehavior } from "../utilities/resize-behavior.js";

export class SherpaContainer extends ResizeBehavior(SherpaElement) {
  static get htmlUrl() {
    return new URL("./sherpa-container.html", import.meta.url).href;
  }

  static get cssUrl() {
    return new URL("./sherpa-container.css", import.meta.url).href;
  }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-selected', 'data-selectable', 'data-interactive', 'disabled', 'data-elevation'];
  }

  /* ── Lifecycle ─────────────────────────────────────────────── */

  onRender() {
    if (!this.dataset.variant) this.dataset.variant = "fit";
  }

  onConnect() {
    super.onConnect();
    // Reflect descendant overflow-menu state onto the host so CSS can
    // elevate z-index and switch overflow visibility.
    this.addEventListener("menu-open", this.#onMenuOpen);
    this.addEventListener("menu-close", this.#onMenuClose);

    // Normalise boolean-presence attributes ("") → explicit "true" so CSS value selectors match.
    if (this.dataset.selectable  === '') this.dataset.selectable  = 'true';
    if (this.dataset.interactive === '') this.dataset.interactive = 'true';
    if (this.dataset.selected    === '') this.dataset.selected    = 'true';

    // Selectable containers are implicitly interactive.
    if (this.selectable && !this.interactive) this.dataset.interactive = 'true';

    if ((this.interactive || this.selectable) && !this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
    this.#syncAria();
    this.#syncFooterSelected();
    this.addEventListener('keydown', this.#handleKeydown);
    this.addEventListener('click',   this.#handleClick);
  }

  onDisconnect() {
    super.onDisconnect();
    this.removeEventListener("menu-open",  this.#onMenuOpen);
    this.removeEventListener("menu-close", this.#onMenuClose);
    this.removeEventListener('keydown', this.#handleKeydown);
    this.removeEventListener('click',   this.#handleClick);
  }

  onAttributeChanged(name) {
    if (name === 'data-interactive' || name === 'data-selectable') {
      this.#updateInteractive();
      this.#syncAria();
    } else if (name === 'data-selected') {
      this.#syncAria();
      this.#syncFooterSelected();
    }
  }

  /* ── Public API ───────────────────────────────────────────── */

  get selected()     { return this.hasAttribute('data-selected')    && this.dataset.selected    !== 'false'; }
  set selected(v)    { this.dataset.selected    = v ? 'true' : 'false'; }

  get interactive()  { return this.hasAttribute('data-interactive') && this.dataset.interactive !== 'false'; }
  set interactive(v) { this.dataset.interactive = v ? 'true' : 'false'; }

  get selectable()   { return this.hasAttribute('data-selectable')  && this.dataset.selectable  !== 'false'; }
  set selectable(v)  { v ? this.dataset.selectable = 'true' : delete this.dataset.selectable; }

  get disabled()     { return this.hasAttribute('disabled'); }
  set disabled(v)    { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  get elevation()    { return this.dataset.elevation || 'none'; }
  set elevation(v)   { v ? this.dataset.elevation = v : delete this.dataset.elevation; }

  /* ── Private ──────────────────────────────────────────────── */

  #onMenuOpen = () => {
    this.dataset.menuOpen = "true";
  };

  #onMenuClose = () => {
    delete this.dataset.menuOpen;
  };

  #updateInteractive() {
    const focusable = this.interactive || this.selectable;
    if (focusable) {
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    } else {
      this.removeAttribute('tabindex');
    }
  }

  #syncAria() {
    if (this.selectable) {
      this.setAttribute('role', 'radio');
      this.setAttribute('aria-checked', this.selected ? 'true' : 'false');
    } else if (this.getAttribute('role') === 'radio') {
      this.removeAttribute('role');
      this.removeAttribute('aria-checked');
    }
  }

  #syncFooterSelected() {
    const footer = this.querySelector('sherpa-footer[data-type="card-select"]');
    if (footer) footer.dataset.selected = this.selected ? 'true' : 'false';
  }

  #handleClick = () => {
    if (this.disabled) return;
    if (this.selectable) {
      const next = !this.selected;
      this.selected = next;
      this.dispatchEvent(new CustomEvent('card-select', { bubbles: true, composed: true, detail: { selected: next } }));
    }
    if (this.interactive) {
      this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true, detail: {} }));
    }
  };

  #handleKeydown = (e) => {
    if (this.disabled) return;
    if (!(this.interactive || this.selectable)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#handleClick();
    }
  };
}

customElements.define("sherpa-container", SherpaContainer);
