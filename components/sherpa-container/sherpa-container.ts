/**
 * sherpa-container.ts
 * SherpaContainer — Universal surface for dashboard tiles, standalone cards,
 * and floating UI (popovers, menus, panels, dialogs).
 *
 * A container is always the same element. What changes is configuration:
 *   • In-flow card/tile    — default usage; no popover attribute
 *   • Floating surface     — add popover="auto"|"manual" for top-layer promotion
 *   • Menu surface         — floating + data-layout="menu"
 *   • Paged wizard         — floating + data-paged
 *   • Edge panel           — floating popover="manual" + data-rounding-end="none"
 *
 * Declarative anchor wiring (zero JS required):
 *   <button popovertarget="my-menu">Open</button>
 *   <sherpa-container id="my-menu" popover="auto" anchor="my-menu"
 *                     data-placement="bottom-start" data-elevation="md">
 *
 * @element sherpa-container
 * @category container
 * @description Universal surface for dashboard composition and floating UI.
 *   Use in-flow (no popover attribute) for grid tiles and standalone cards.
 *   Add popover="auto" for menus, popovers, and panels — the browser handles
 *   top-layer promotion and light-dismiss automatically. Wire anchoring with
 *   the native `anchor` attribute or by calling show(element) imperatively.
 *
 * ── In-flow attributes ────────────────────────────────────────────────────
 * @attr {enum}    data-variant=fit   — fit | resizable | fill | worksheet
 * @attr {number}  data-col-span      — Column span: 3 | 6 | 9 | 12 (resizable)
 * @attr {number}  data-row-span      — Row span: 1–8 (resizable)
 * @attr {boolean} data-editable      — Edit mode (allows resize affordances)
 * @attr {boolean} data-menu-open     — Reflected while a descendant menu is open
 * @attr {enum}    data-state         — ready | loading | empty | error
 * @attr {boolean} data-interactive   — Makes the container a clickable surface
 * @attr {boolean} data-selectable    — Makes the container a selectable radio option
 * @attr {boolean} data-selected      — Selected / active state
 * @attr {enum}    data-elevation     — none | sm | md | lg
 * @attr {boolean} disabled           — Native disabled state
 *
 * ── Floating attributes (when popover is set) ─────────────────────────────
 * @attr {string}  anchor             — Id of the anchor element (native HTML)
 * @attr {boolean} data-open          — Declarative open/close
 * @attr {enum}    data-placement     — bottom-start (default for menu) | bottom |
 *                                      bottom-end | top-start | top-end | top |
 *                                      inline-start | inline-end
 * @attr {boolean} data-flip          — Enable CSS position-try-fallbacks flip
 * @attr {enum}    data-layout        — menu — switches to menu surface template
 * @attr {boolean} data-paged         — Switches to paged wizard template
 * @attr {number}  data-page          — Active 0-based page index (paged)
 * @attr {number}  data-pages         — Total page count (paged)
 * @attr {string}  data-heading       — Header title text (floating surface)
 * @attr {boolean} data-loading       — Show loading spinner (menu layout)
 * @attr {string}  data-loading-text  — Loading caption (menu layout)
 * @attr {enum}    data-animation     — slide — entrance/exit animation
 * @attr {enum}    data-rounding-start  — none — zero radius on inline-start edge
 * @attr {enum}    data-rounding-end    — none — zero radius on inline-end edge
 * @attr {enum}    data-rounding-top    — none — zero radius on block-start edge
 * @attr {enum}    data-rounding-bottom — none — zero radius on block-end edge
 *
 * ── Slots (in-flow) ───────────────────────────────────────────────────────
 * @slot (default) — Main content area (16px padding; scrolls when constrained)
 * @slot header    — Card header (use sherpa-container-header); edge-to-edge
 * @slot footer    — Card footer (use sherpa-container-footer or sherpa-button)
 * @slot loading   — Shown when data-state="loading"
 * @slot empty     — Shown when data-state="empty"
 * @slot error     — Shown when data-state="error"
 *
 * ── Slots (floating surface) ──────────────────────────────────────────────
 * @slot (default)   — Body content / menu items
 * @slot icon        — Header leading icon (floating surface)
 * @slot header-end  — Header trailing content (floating surface)
 *
 * ── Events ────────────────────────────────────────────────────────────────
 * @fires card-click   — Interactive container clicked/activated
 *   bubbles: true, composed: true, detail: {}
 * @fires card-select  — Selectable container selection changed
 *   bubbles: true, composed: true, detail: { selected: boolean }
 * @fires container-open  — Floating container opened
 *   bubbles: true, composed: true, detail: {}
 * @fires container-close — Floating container closed
 *   bubbles: true, composed: true, detail: {}
 * @fires container-select — Overlay item activated
 *   bubbles: true, composed: true
 *   detail: { item, action, value, label, selection, checked, group, data }
 * @fires container-page-change — Page navigation advanced
 *   bubbles: true, composed: true, detail: { page, total }
 * @fires container-page-finish — Last page reached
 *   bubbles: true, composed: true, detail: { page, total }
 * @fires container-increase-cols — (resizable) step up column span
 * @fires container-decrease-cols — (resizable) step down column span
 * @fires container-increase-rows — (resizable) increment row span
 * @fires container-decrease-rows — (resizable) decrement row span
 *
 * ── Props ─────────────────────────────────────────────────────────────────
 * @prop {boolean} open        — Whether the floating container is visible
 * @prop {boolean} selected    — Selected state (read/write)
 * @prop {boolean} interactive — Clickable state (read/write)
 * @prop {boolean} selectable  — Selectable state (read/write)
 * @prop {boolean} disabled    — Disabled state (read/write)
 * @prop {string}  elevation   — Shadow level (read/write)
 * @prop {Element} floatSource — The anchor element that opened the floating container
 *
 * ── Static API ────────────────────────────────────────────────────────────
 * @method getContentTemplate(id) — Return light-DOM content template HTML by id
 * @prop   ready                  — Promise that resolves when content templates loaded
 */

import '../sherpa-overlay-item/sherpa-overlay-item.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { ResizeBehavior } from '../utilities/resize-behavior.js';
import { FloatingBehavior } from '../utilities/floating-behavior.js';
import type { FloatingBehaviorStatics } from '../utilities/floating-behavior.js';
import { clearElementCache } from '../utilities/element-cache.js';

const HTML_URL = new URL('./sherpa-container.html', import.meta.url).href;

/** Active resize-grip drag gesture state. */
interface ResizeState {
  pointerId: number;
  startX: number; startY: number;
  startW: number; startH: number;
  colUnit: number; rowUnit: number;
  lastCol: number; lastRow: number;
}

export class SherpaContainer extends FloatingBehavior(ResizeBehavior(SherpaElement)) {

  static override get htmlUrl(): string { return HTML_URL; }
  static override get cssUrl(): string {
    return new URL('./sherpa-container.css', import.meta.url).href;
  }

  /** Adopt sherpa-anchor.css for CSS Anchor Positioning support. */
  public static override useAnchor = true;

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-selected', 'data-selectable', 'data-interactive', 'disabled', 'data-elevation',
      'data-open', 'anchor', 'data-heading', 'data-template', 'data-layout', 'data-paged',
      'data-page', 'data-pages', 'data-loading-text',
    ];
  }

  /* ── Static content template registry ─────────────────────────── */

  static {
    (FloatingBehavior(ResizeBehavior(SherpaElement)) as unknown as FloatingBehaviorStatics)
      .preloadTemplates(HTML_URL);
  }

  /** Return a registered light-DOM content template HTML string by id. */
  static getTemplate(id: string): string {
    return (FloatingBehavior(ResizeBehavior(SherpaElement)) as unknown as FloatingBehaviorStatics)
      .getContentTemplate(HTML_URL, id);
  }

  /** Promise that resolves once content templates are loaded. */
  static get ready(): Promise<void> {
    return (FloatingBehavior(ResizeBehavior(SherpaElement)) as unknown as FloatingBehaviorStatics)
      .templatesReady(HTML_URL);
  }

  /* ── Template selection ────────────────────────────────────────── */

  override get templateId(): string {
    if (!this.hasAttribute('popover')) return 'default';
    if (this.hasAttribute('data-paged')) return 'paged';
    if (this.dataset['layout'] === 'menu') return 'menu';
    return 'floating';
  }

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  override onRender(): void {
    super.onRender();

    if (!this.hasAttribute('popover')) {
      // ── In-flow card setup ──────────────────────────────────────
      if (!this.dataset['variant']) this.dataset['variant'] = 'fit';
      this.#initResizeGrip();
      this.addEventListener('menu-open',  this.#onMenuOpen);
      this.addEventListener('menu-close', this.#onMenuClose);
      if (this.dataset['selectable']  === '') this.dataset['selectable']  = 'true';
      if (this.dataset['interactive'] === '') this.dataset['interactive'] = 'true';
      if (this.dataset['selected']    === '') this.dataset['selected']    = 'true';
      if (this.selectable && !this.interactive) this.dataset['interactive'] = 'true';
      if ((this.interactive || this.selectable) && !this.hasAttribute('tabindex')) {
        this.setAttribute('tabindex', '0');
      }
      this.#syncAria();
      this.#syncFooterSelected();
      this.addEventListener('keydown', this.#onKeyDown);
      this.addEventListener('click',   this.#onClick);
    } else {
      // ── Floating surface setup ──────────────────────────────────
      if (!this.dataset['placement']) {
        this.dataset['placement'] = this.dataset['layout'] === 'menu' ? 'bottom-start' : 'bottom';
      }
      this._initFloating();
      this.#syncHeading();
      this.#syncLoadingText();
      this._syncPageIndicator();

      const closeBtn = this.$('.close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
    }
  }

  override onAttributeChanged(name: string, _old: string | null, _new: string | null): void {
    switch (name) {
      case 'data-interactive':
      case 'data-selectable':
        this.#updateInteractive();
        this.#syncAria();
        break;
      case 'data-selected':
        this.#syncAria();
        this.#syncFooterSelected();
        break;
      case 'data-open':
        if (this.hasAttribute('data-open')) { this.show(); } else { this.hide(); }
        break;
      case 'anchor':
        if (this.hasAttribute('data-open') || this.open) {
          const id = this.getAttribute('anchor');
          if (id) {
            const el = document.getElementById(id);
            if (el) this._initFloating();
          }
        }
        break;
      case 'data-heading':
        this.#syncHeading();
        break;
      case 'data-layout':
      case 'data-paged':
      case 'data-template': {
        if (!this.hasAttribute('popover')) break;
        const newTplId = this.templateId;
        void this.renderTemplate(newTplId).then(() => {
          clearElementCache(this);
          const closeBtn = this.$('.close-btn');
          if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
          this.#wireFloatingPageButtons();
          this.#syncHeading();
          this._syncPageIndicator();
        });
        break;
      }
      case 'data-page':
      case 'data-pages':
        this._syncPageIndicator();
        if (name === 'data-page') {
          this.emit('container-page-change', { page: this.page, total: this.pages });
        }
        break;
      case 'data-loading-text':
        this.#syncLoadingText();
        break;
    }
  }

  /* ── populate() — canonical data entry (floating menu surface) ── */

  override renderData(source: unknown): void {
    this._renderMenuData(source);
  }

  override populate(data: unknown): void {
    this.renderData(data);
  }

  /* ── Public card API ───────────────────────────────────────────── */

  get selected(): boolean    { return this.hasAttribute('data-selected'); }
  set selected(v: boolean)   { this.toggleAttribute('data-selected', v); }

  get interactive(): boolean { return this.hasAttribute('data-interactive'); }
  set interactive(v: boolean){ this.toggleAttribute('data-interactive', v); }

  get selectable(): boolean  { return this.hasAttribute('data-selectable'); }
  set selectable(v: boolean) { this.toggleAttribute('data-selectable', v); }

  get disabled(): boolean    { return this.hasAttribute('disabled'); }
  set disabled(v: boolean)   { if (v) { this.setAttribute('disabled', ''); } else { this.removeAttribute('disabled'); } }

  get elevation(): string    { return this.dataset['elevation'] || 'none'; }
  set elevation(v: string)   { if (v) { this.dataset['elevation'] = v; } else { delete this.dataset['elevation']; } }

  /* ── Private card helpers ──────────────────────────────────────── */

  #onMenuOpen  = (): void => { this.setAttribute('data-menu-open', ''); };
  #onMenuClose = (): void => { this.removeAttribute('data-menu-open'); };

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
    if (footer) footer.dataset['selected'] = this.selected ? 'true' : 'false';
  }

  #onClick = (): void => {
    if (this.disabled) return;
    if (this.selectable) {
      const next = !this.selected;
      this.selected = next;
      this.emit('card-select', { selected: next });
    }
    if (this.interactive) { this.emit('card-click', {}); }
  };

  #onKeyDown = (e: KeyboardEvent): void => {
    if (this.disabled) return;
    if (!(this.interactive || this.selectable)) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.#onClick(); }
  };

  /* ── Private floating helpers ──────────────────────────────────── */

  #syncHeading(): void {
    const el = this.$('.overlay-heading');
    if (el) el.textContent = this.dataset['heading'] ?? '';
  }

  #syncLoadingText(): void {
    const el = this.$('.overlay-loader-text');
    if (el) el.textContent = this.dataset['loadingText'] ?? '';
  }

  #wireFloatingPageButtons(): void {
    const back = this.$('.page-back');
    const next = this.$('.page-next');
    if (back) back.addEventListener('click', () => this.prevPage());
    if (next) next.addEventListener('click', () => {
      if (this.page >= this.pages - 1) {
        this.emit('container-page-finish', { page: this.page, total: this.pages });
      } else { this.nextPage(); }
    });
  }

  /* ── Resize grip (snap-to-span) ────────────────────────────────── */

  static #COL_STOPS = [3, 6, 9, 12];
  static #MIN_ROW   = 1;
  static #MAX_ROW   = 8;
  #resizeState: ResizeState | null = null;

  #initResizeGrip(): void {
    const grip = this.$<HTMLElement>('.resize-grip');
    if (!grip) return;
    grip.addEventListener('pointerdown',   this.#onGripPointerDown);
    grip.addEventListener('pointermove',   this.#onGripPointerMove);
    grip.addEventListener('pointerup',     this.#onGripPointerEnd);
    grip.addEventListener('pointercancel', this.#onGripPointerEnd);
  }

  #onGripPointerDown = (e: PointerEvent): void => {
    if (this.disabled || e.button !== 0) return;
    const grip = e.currentTarget as HTMLElement;
    e.preventDefault(); e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    const rect = this.getBoundingClientRect();
    const startCol = this.#currentColSpan();
    const startRow = this.#currentRowSpan();
    this.#resizeState = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      startW: rect.width, startH: rect.height,
      colUnit: rect.width  / Math.max(1, startCol),
      rowUnit: rect.height / Math.max(1, startRow),
      lastCol: startCol, lastRow: startRow,
    };
  };

  #onGripPointerMove = (e: PointerEvent): void => {
    const s = this.#resizeState;
    if (!s || e.pointerId !== s.pointerId) return;
    const nextCol = SherpaContainer.#nearestColStop((s.startW + e.clientX - s.startX) / s.colUnit);
    const nextRow = Math.max(
      SherpaContainer.#MIN_ROW,
      Math.min(SherpaContainer.#MAX_ROW, Math.round((s.startH + e.clientY - s.startY) / s.rowUnit)),
    );
    if (nextCol !== s.lastCol) { this.dataset['colSpan'] = String(nextCol); s.lastCol = nextCol; }
    if (nextRow !== s.lastRow) { this.dataset['rowSpan'] = String(nextRow); s.lastRow = nextRow; }
  };

  #onGripPointerEnd = (e: PointerEvent): void => {
    const s = this.#resizeState;
    if (!s || e.pointerId !== s.pointerId) return;
    const grip = e.currentTarget as HTMLElement;
    if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
    this.#resizeState = null;
  };

  #currentColSpan(): number {
    const v = parseInt(this.dataset['colSpan'] ?? '', 10);
    return Number.isFinite(v) ? v : (SherpaContainer.#COL_STOPS[0] ?? 3);
  }
  #currentRowSpan(): number {
    const v = parseInt(this.dataset['rowSpan'] ?? '', 10);
    return Number.isFinite(v) ? v : 1;
  }
  static #nearestColStop(value: number): number {
    let best = SherpaContainer.#COL_STOPS[0] ?? 3;
    let bestDist = Math.abs(value - best);
    for (let i = 1; i < SherpaContainer.#COL_STOPS.length; i++) {
      const stop = SherpaContainer.#COL_STOPS[i] ?? 3;
      const d = Math.abs(value - stop);
      if (d < bestDist) { best = stop; bestDist = d; }
    }
    return best;
  }
}

customElements.define('sherpa-container', SherpaContainer);
export default SherpaContainer;
