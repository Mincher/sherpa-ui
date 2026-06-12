/**
 * sherpa-container.js
 * SherpaContainer — Universal container for dashboard composition and standalone
 * card layouts. Owns sizing variants, a named container query scope, state
 * overlays (loading/empty/error), optional interactivity and selection state.
 *
 * @element sherpa-container
 * @category container
 * @description The standard card and widget container for dashboard tiles and content regions.
 *   Use it for every panel or tile inside a sherpa-layout-grid. It owns loading, empty, and
 *   error state overlays via named slots — no conditional HTML needed in the page. Choose
 *   data-variant="resizable" for user-resizable dashboard tiles, "fit" for content-sized
 *   standalone cards. Add data-interactive or data-selectable to make the container a clickable
 *   or radio-selectable surface.
 *
 * @attr {enum}    data-variant=fit   — fit | resizable | fill | worksheet
 * @attr {number}  data-col-span      — Column span: 3 | 6 | 9 | 12 (resizable)
 * @attr {number}  data-row-span      — Row span: 1–8 (resizable).
 * @attr {boolean} data-editable      — Edit mode (e.g. allows menu-driven resize)
 * @attr {enum}    data-resize-mode    — Experimental: "drag" enables a pointer-driven snap-resize grip (default mode uses the header overflow menu only)
 * @attr {boolean} data-menu-open     — Reflected while a descendant menu is open
 * @attr {enum}    data-state         — ready | loading | empty | error
 * @attr {boolean} data-interactive     — Makes the container a clickable surface
 * @attr {boolean} data-selectable      — Makes the container a selectable radio option
 * @attr {boolean} data-selected        — Selected / active state
 * @attr {enum}    data-elevation       — none | sm | md | lg
 * @attr {enum}    data-group-position — Managed by an enclosing <sherpa-container-group>: "first" | "follow". The first tile in a group renders its header normally (and serves as the group title); follower tiles have header content visually muted while the header band preserves height for cross-tile content alignment. Consumers should not set this manually.
 * @attr {boolean} disabled             — Native disabled state
 *
 * @slot (default) — Main content. Rendered inside a scrollable flex-column area with 16px padding.
 *                   Content that exceeds the container's row-span height scrolls vertically.
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

/** Active resize-grip drag gesture state. */
interface ResizeState {
  pointerId: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  colUnit: number;
  rowUnit: number;
  lastCol: number;
  lastRow: number;
}

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

  override onAttributeChanged(name: string): void {
    if (name === 'data-interactive' || name === 'data-selectable') {
      this.#updateInteractive();
      this.#syncAria();
    } else if (name === 'data-selected') {
      this.#syncAria();
      this.#syncFooterSelected();
    }
  }

  /* ── Public API ───────────────────────────────────────────── */

  get selected(): boolean      { return this.hasAttribute('data-selected')    && this.dataset["selected"]    !== 'false'; }
  set selected(v: boolean)     { this.dataset["selected"]    = v ? 'true' : 'false'; }

  get interactive(): boolean   { return this.hasAttribute('data-interactive') && this.dataset["interactive"] !== 'false'; }
  set interactive(v: boolean)  { this.dataset["interactive"] = v ? 'true' : 'false'; }

  get selectable(): boolean    { return this.hasAttribute('data-selectable')  && this.dataset["selectable"]  !== 'false'; }
  set selectable(v: boolean)   { if (v) { this.dataset["selectable"] = 'true'; } else { delete this.dataset["selectable"]; } }

  get disabled(): boolean      { return this.hasAttribute('disabled'); }
  set disabled(v: boolean)     { if (v) { this.setAttribute('disabled', ''); } else { this.removeAttribute('disabled'); } }

  get elevation(): string      { return this.dataset["elevation"] || 'none'; }
  set elevation(v: string)     { if (v) { this.dataset["elevation"] = v; } else { delete this.dataset["elevation"]; } }

  /* ── Private ──────────────────────────────────────────────── */

  #onMenuOpen = (): void => {
    this.dataset["menuOpen"] = "true";
  };

  #onMenuClose = (): void => {
    delete this.dataset["menuOpen"];
  };

  #updateInteractive(): void {
    const focusable = this.interactive || this.selectable;
    if (focusable) {
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    } else {
      this.removeAttribute('tabindex');
    }
  }

  #syncAria(): void {
    if (this.selectable) {
      this.setAttribute('role', 'radio');
      this.setAttribute('aria-checked', this.selected ? 'true' : 'false');
    } else if (this.getAttribute('role') === 'radio') {
      this.removeAttribute('role');
      this.removeAttribute('aria-checked');
    }
  }

  #syncFooterSelected(): void {
    const footer = this.querySelector<HTMLElement>('sherpa-container-footer[data-type="card-select"]');
    if (footer) footer.dataset["selected"] = this.selected ? 'true' : 'false';
  }

  #onClick = (): void => {
    if (this.disabled) return;
    if (this.selectable) {
      const next = !this.selected;
      this.selected = next;
      this.emit('card-select', { selected: next });
    }
    if (this.interactive) {
      this.emit('card-click', {});
    }
  };

  #onKeyDown = (e: KeyboardEvent): void => {
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
     placement). Valid col-spans: 3, 6, 9, 12. Valid row-spans: 1–8.
     The grip element is always in the shadow template; CSS hides
     it unless data-variant="resizable" + data-editable are set.
  ─────────────────────────────────────────────────────────────── */

  static #COL_STOPS = [3, 6, 9, 12];
  static #MIN_ROW = 1;
  static #MAX_ROW = 8;
  #resizeState: ResizeState | null = null;

  #initResizeGrip(): void {
    const grip = this.$<HTMLElement>('.resize-grip');
    if (!grip) return;
    grip.addEventListener('pointerdown', this.#onGripPointerDown);
    grip.addEventListener('pointermove', this.#onGripPointerMove);
    grip.addEventListener('pointerup',   this.#onGripPointerEnd);
    grip.addEventListener('pointercancel', this.#onGripPointerEnd);
  }

  #onGripPointerDown = (e: PointerEvent): void => {
    if (this.disabled) return;
    if (e.button !== 0) return;
    const grip = e.currentTarget as HTMLElement;
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

  #onGripPointerMove = (e: PointerEvent): void => {
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

  #onGripPointerEnd = (e: PointerEvent): void => {
    const s = this.#resizeState;
    if (!s || e.pointerId !== s.pointerId) return;
    const grip = e.currentTarget as HTMLElement;
    if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
    this.#resizeState = null;
  };

  #currentColSpan(): number {
    const v = parseInt(this.dataset["colSpan"] || "", 10);
    return Number.isFinite(v) ? v : (SherpaContainer.#COL_STOPS[0] ?? 3);
  }
  #currentRowSpan(): number {
    const v = parseInt(this.dataset["rowSpan"] || "", 10);
    return Number.isFinite(v) ? v : 1;
  }
  static #nearestColStop(value: number): number {
    const stops = SherpaContainer.#COL_STOPS;
    let best = stops[0] ?? 3;
    let bestDist = Math.abs(value - best);
    for (let i = 1; i < stops.length; i++) {
      const stop = stops[i] ?? 3;
      const d = Math.abs(value - stop);
      if (d < bestDist) { best = stop; bestDist = d; }
    }
    return best;
  }
}

customElements.define("sherpa-container", SherpaContainer);
