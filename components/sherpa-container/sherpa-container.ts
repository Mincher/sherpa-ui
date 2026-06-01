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
 * @attr {boolean} [data-editable]      — Edit mode (e.g. allows menu-driven resize)
 * @attr {enum}    [data-resize-mode]    — Experimental: "drag" enables a pointer-driven snap-resize grip (default mode uses the header overflow menu only)
 * @attr {boolean} [data-menu-open]     — Reflected while a descendant menu is open
 * @attr {enum}    [data-state]         — ready | loading | empty | error
 * @attr {boolean} data-interactive     — Makes the container a clickable surface
 * @attr {boolean} data-selectable      — Makes the container a selectable radio option
 * @attr {boolean} data-selected        — Selected / active state
 * @attr {enum}    data-elevation       — none | sm | md | lg
 * @attr {enum}    [data-group-position] — Managed by an enclosing <sherpa-container-group>: "first" | "follow". The first tile in a group renders its header normally (and serves as the group title); follower tiles have header content visually muted while the header band preserves height for cross-tile content alignment. Consumers should not set this manually.
 * @attr {boolean} disabled             — Native disabled state
 *
 * @slot (default) — Main content (dashboard children or card body)
 * @slot header    — Card-style header (use sherpa-container-header); edge-to-edge with separator
 * @slot footer    — Card-style footer (use sherpa-container-footer or sherpa-button)
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
  static override get htmlUrl(): string {
    return new URL("./sherpa-container.html", import.meta.url).href;
  }

  static override get cssUrl(): string {
    return new URL("./sherpa-container.css", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-selected', 'data-selectable', 'data-interactive', 'disabled', 'data-elevation'];
  }

  /* ── Lifecycle ─────────────────────────────────────────────── */

  override onRender(): void {
    super.onRender();
    if (!this.dataset["variant"]) this.dataset["variant"] = "fit";
    this.#initResizeGrip();

    // Reflect descendant overflow-menu state onto the host so CSS can
    // elevate z-index and switch overflow visibility.
    this.addEventListener("menu-open", this.#onMenuOpen);
    this.addEventListener("menu-close", this.#onMenuClose);

    // Normalise boolean-presence attributes ("") → explicit "true" so CSS value selectors match.
    if (this.dataset["selectable"]  === '') this.dataset["selectable"]  = 'true';
    if (this.dataset["interactive"] === '') this.dataset["interactive"] = 'true';
    if (this.dataset["selected"]    === '') this.dataset["selected"]    = 'true';

    // Selectable containers are implicitly interactive.
    if (this.selectable && !this.interactive) this.dataset["interactive"] = 'true';

    if ((this.interactive || this.selectable) && !this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
    this.#syncAria();
    this.#syncFooterSelected();
    this.addEventListener('keydown', this.#onKeyDown);
    this.addEventListener('click',   this.#onClick);
  }

  override onAttributeChanged(name: string) {
    if (name === 'data-interactive' || name === 'data-selectable') {
      this.#updateInteractive();
      this.#syncAria();
    } else if (name === 'data-selected') {
      this.#syncAria();
      this.#syncFooterSelected();
    }
  }

  /* ── Public API ───────────────────────────────────────────── */

  get selected()     { return this.hasAttribute('data-selected')    && this.dataset["selected"]    !== 'false'; }
  set selected(v)    { this.dataset["selected"]    = v ? 'true' : 'false'; }

  get interactive()  { return this.hasAttribute('data-interactive') && this.dataset["interactive"] !== 'false'; }
  set interactive(v) { this.dataset["interactive"] = v ? 'true' : 'false'; }

  get selectable()   { return this.hasAttribute('data-selectable')  && this.dataset["selectable"]  !== 'false'; }
  set selectable(v)  { v ? this.dataset["selectable"] = 'true' : delete this.dataset["selectable"]; }

  get disabled()     { return this.hasAttribute('disabled'); }
  set disabled(v)    { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  get elevation()    { return this.dataset["elevation"] || 'none'; }
  set elevation(v)   { v ? this.dataset["elevation"] = v : delete this.dataset["elevation"]; }

  /* ── Private ──────────────────────────────────────────────── */

  #onMenuOpen = () => {
    this.dataset["menuOpen"] = "true";
  };

  #onMenuClose = () => {
    delete this.dataset["menuOpen"];
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
    const footer = this.querySelector('sherpa-container-footer[data-type="card-select"]');
    if (footer) footer.dataset["selected"] = this.selected ? 'true' : 'false';
  }

  #onClick = () => {
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

  #onKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;
    if (!(this.interactive || this.selectable)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#onClick();
    }
  };

  /* ── Resize grip (snap-to-span) ───────────────────────────────
     Pointer-driven resize that snaps to whole col/row-span
     increments. Writes `data-col-span` / `data-row-span` only;
     never sets inline width/height (which would override grid
     placement). Valid col-spans: 3, 6, 9, 12. Valid row-spans: 1–6.
     The grip element is always in the shadow template; CSS hides
     it unless data-variant="resizable" + data-editable are set.
  ─────────────────────────────────────────────────────────────── */

  static #COL_STOPS = [3, 6, 9, 12];
  static #MIN_ROW = 1;
  static #MAX_ROW = 6;
  #resizeState = null;

  #initResizeGrip() {
    const grip = this.$('.resize-grip');
    if (!grip) return;
    grip.addEventListener('pointerdown', this.#onGripPointerDown);
    grip.addEventListener('pointermove', this.#onGripPointerMove);
    grip.addEventListener('pointerup',   this.#onGripPointerEnd);
    grip.addEventListener('pointercancel', this.#onGripPointerEnd);
  }

  #onGripPointerDown = (e: Event) => {
    if (this.disabled) return;
    if (e.button !== 0) return;
    const grip = e.currentTarget;
    e.preventDefault();
    e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    const rect = this.getBoundingClientRect();
    const startCol = this.#currentColSpan();
    const startRow = this.#currentRowSpan();
    this.#resizeState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
      colUnit: rect.width  / Math.max(1, startCol),
      rowUnit: rect.height / Math.max(1, startRow),
      lastCol: startCol,
      lastRow: startRow,
    };
  };

  #onGripPointerMove = (e: Event) => {
    const s = this.#resizeState;
    if (!s || e.pointerId !== s.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const targetCol = (s.startW + dx) / s.colUnit;
    const targetRow = (s.startH + dy) / s.rowUnit;
    const nextCol = SherpaContainer.#nearestColStop(targetCol);
    const nextRow = Math.max(
      SherpaContainer.#MIN_ROW,
      Math.min(SherpaContainer.#MAX_ROW, Math.round(targetRow)),
    );
    if (nextCol !== s.lastCol) {
      this.dataset["colSpan"] = String(nextCol);
      s.lastCol = nextCol;
    }
    if (nextRow !== s.lastRow) {
      this.dataset["rowSpan"] = String(nextRow);
      s.lastRow = nextRow;
    }
  };

  #onGripPointerEnd = (e: Event) => {
    const s = this.#resizeState;
    if (!s || e.pointerId !== s.pointerId) return;
    const grip = e.currentTarget;
    if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
    this.#resizeState = null;
  };

  #currentColSpan() {
    const v = parseInt(this.dataset["colSpan"], 10);
    return Number.isFinite(v) ? v : SherpaContainer.#COL_STOPS[0];
  }
  #currentRowSpan() {
    const v = parseInt(this.dataset["rowSpan"], 10);
    return Number.isFinite(v) ? v : 1;
  }
  static #nearestColStop(value) {
    const stops = SherpaContainer.#COL_STOPS;
    let best = stops[0];
    let bestDist = Math.abs(value - stops[0]);
    for (let i = 1; i < stops.length; i++) {
      const d = Math.abs(value - stops[i]);
      if (d < bestDist) { best = stops[i]; bestDist = d; }
    }
    return best;
  }
}

customElements.define("sherpa-container", SherpaContainer);
