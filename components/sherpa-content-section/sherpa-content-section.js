/**
 * @element sherpa-content-section
 * @description In-flow content section anchored to the left or right of a
 *   layout column. Fills the available height, owns its own header (heading +
 *   actions), an optional toolbar row, and a scrollable body. Minimisable to
 *   a narrow strip on the side it is anchored to.
 *
 *   This is NOT a drawer — for floating/overlay panels use sherpa-panel
 *   (`data-variant="overlay"`). Use sherpa-content-section when the panel
 *   participates in the page layout grid (e.g. left/right rail of a view).
 *
 * @attr {enum}    [data-position=right]   left | right — anchored side
 * @attr {string}  [data-heading]          Header text
 * @attr {flag}    [data-minimised]        Collapsed to a narrow strip
 * @attr {string}  [data-restore-label]    Optional label shown on the
 *                                         vertical restore strip
 *
 * @slot (default) — Body content
 * @slot toolbar   — Toolbar row beneath the header
 * @slot search    — Sticky search input pinned to the top of the body
 * @slot actions   — Header trailing actions (buttons / menu)
 *
 * @fires section-minimise-change
 *   bubbles: true, composed: true
 *   detail: { minimised: boolean }
 *
 * @method minimise()  — Collapse the section
 * @method restore()   — Expand the section
 * @method toggle()    — Toggle minimised state
 *
 * @csspart header
 * @csspart title
 * @csspart toolbar
 * @csspart body
 *
 * @cssprop --_section-width      — Expanded width (default 320px)
 * @cssprop --_section-min-strip  — Minimised strip width (default 40px)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaContentSection extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-content-section.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-content-section.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-heading',
      'data-restore-label',
      'data-position',
      'data-minimised',
    ];
  }

  /** @type {HTMLElement|null} */ #titleEl    = null;
  /** @type {HTMLElement|null} */ #restoreLbl = null;
  /** @type {HTMLButtonElement|null} */ #minBtn = null;
  /** @type {HTMLButtonElement|null} */ #restoreBtn = null;

  /* ── lifecycle ─────────────────────────────────────────── */

  onRender() {
    if (!this.dataset.position) this.dataset.position = 'right';

    this.#titleEl    = this.$('.section-title');
    this.#restoreLbl = this.$('.restore-label');
    this.#minBtn     = this.$('.minimise-btn');
    this.#restoreBtn = this.$('.restore-btn');

    this.#syncHeading();
    this.#syncRestoreLabel();

    this.#minBtn?.addEventListener('click',     this.#onMinimise);
    this.#restoreBtn?.addEventListener('click', this.#onRestore);
  }

  onAttributeChanged(name, oldVal, newVal) {
    if (name === 'data-heading')        this.#syncHeading();
    if (name === 'data-restore-label')  this.#syncRestoreLabel();
    if (name === 'data-minimised' && oldVal !== newVal) {
      this.dispatchEvent(new CustomEvent('section-minimise-change', {
        bubbles: true, composed: true,
        detail: { minimised: this.hasAttribute('data-minimised') },
      }));
    }
  }

  /* ── public api ────────────────────────────────────────── */

  minimise() { this.toggleAttribute('data-minimised', true); }
  restore()  { this.toggleAttribute('data-minimised', false); }
  toggle()   { this.toggleAttribute('data-minimised'); }

  /* ── handlers ──────────────────────────────────────────── */

  #onMinimise = () => this.minimise();
  #onRestore  = () => this.restore();

  /* ── sync helpers ──────────────────────────────────────── */

  #syncHeading() {
    if (this.#titleEl) this.#titleEl.textContent = this.dataset.heading || '';
  }

  #syncRestoreLabel() {
    if (this.#restoreLbl) {
      this.#restoreLbl.textContent =
        this.dataset.restoreLabel || this.dataset.heading || '';
    }
  }
}

customElements.define('sherpa-content-section', SherpaContentSection);
