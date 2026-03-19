/**
 * @element sherpa-view-header
 * @description View header toolbar with toggles and settings.
 *   Manages heading, favorites, feedback popover, and export intent.
 *
 * @attr {string}  [data-label]              — View heading text
 * @attr {boolean} [data-show-debug-toggles] — Show debug toggle controls
 * @attr {boolean} [data-favorite]           — Favorite state
 * @attr {boolean} [data-edit-mode]          — Edit mode active
 * @attr {string}  [data-export-title]       — Title for PDF export
 *
 * @fires editmodechange
 *   bubbles: true, composed: true
 *   detail: { editMode: boolean }
 * @fires viewexport
 *   bubbles: true, composed: true
 *   detail: { title: string }
 * @fires favoritetoggle
 *   bubbles: true, composed: true
 *   detail: { viewId: string, favorite: boolean }
 *
 * @method setHeading(name)     — Set heading text
 * @method getHeading()         — Get heading text
 * @method setViewId(id)        — Set view identifier
 * @method getViewId()          — Get view identifier
 * @method setFavorite(on)      — Set favorite state
 * @method isFavorite()         — Returns boolean
 */
import '../sherpa-switch/sherpa-switch.js';
import '../sherpa-button/sherpa-button.js';

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { ThemeManager } from '../utilities/theme-manager.js';

export class SherpaViewHeader extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-view-header.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-view-header.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-show-debug-toggles', 'data-favorite', 'data-edit-mode', 'data-export-title'];
  }

  #viewId = null;

  onAttributeChanged(name, oldValue, newValue) {
    switch (name) {
      case 'data-label': {
        const label = this.$('.heading-label');
        if (label) label.textContent = newValue || '';
        break;
      }
      case 'data-favorite':
        this.#syncFavoriteButton(newValue === 'true');
        break;
      case 'data-edit-mode':
        this.#applyEditMode(newValue === 'true');
        break;
    }
  }

  #applyEditMode(on) {
    // Sync toggle state
    const toggle = this.$('#edit-mode-toggle');
    if (toggle) toggle.dataset.state = on ? 'on' : 'off';
    // Dispatch so app coordinator can toggle containers, body attribute, etc.
    this.dispatchEvent(new CustomEvent('editmodechange', {
      bubbles: true, composed: true,
      detail: { editMode: on },
    }));
  }

  // ============ Public API ============

  setHeading(name) { this.dataset.label = name; }
  getHeading() { return this.dataset.label || ''; }
  setViewId(id) { this.#viewId = id; }
  getViewId() { return this.#viewId; }
  setFavorite(on) {
    this.dataset.favorite = on ? 'true' : 'false';
    this.#syncFavoriteButton(on);
  }
  isFavorite() { return this.dataset.favorite === 'true'; }
  #resizeHandler = null;

  onDisconnect() {
  }

  // ============ Private Methods ============

  onRender() {
    this.#setupSelectors();
    this.#setupExport();
    this.#setupFavorite();
    this.#setupEditMode();

    // Apply any attributes that were set before render completed
    const heading = this.dataset.label;
    if (heading) {
      const label = this.$('.heading-label');
      if (label) label.textContent = heading;
    }
    this.#syncFavoriteButton(this.dataset.favorite === 'true');
  }

  #setupSelectors() {
    // Initialise ThemeManager with CSS base URL resolved from this module
    ThemeManager.init({
      cssBaseUrl: new URL('../../css/styles/', import.meta.url).href,
    });

    // Theme (brand)
    const themeSelect = this.$('#theme-select');
    if (themeSelect) {
      themeSelect.value = ThemeManager.getTheme();
      ThemeManager.setTheme(ThemeManager.getTheme());
      themeSelect.addEventListener('change', e => ThemeManager.setTheme(e.target.value));
    }

    // Mode (light / dark / auto)
    const modeSelect = this.$('#mode-select');
    if (modeSelect) {
      modeSelect.value = ThemeManager.getMode();
      ThemeManager.setMode(ThemeManager.getMode());
      modeSelect.addEventListener('change', e => ThemeManager.setMode(e.target.value));
    }

    // Density
    const densitySelect = this.$('#density-select');
    if (densitySelect) {
      densitySelect.value = ThemeManager.getDensity();
      ThemeManager.setDensity(ThemeManager.getDensity());
      densitySelect.addEventListener('change', e => ThemeManager.setDensity(e.target.value));
    }
  }

  #setupExport() {
    const btn = this.$('#export-all-btn');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
      const pageTitle = this.getHeading() || this.dataset.exportTitle || 'Export';
      this.dispatchEvent(new CustomEvent('viewexport', {
        bubbles: true, composed: true,
        detail: { title: pageTitle }
      }));
    });
  }

  #setupEditMode() {
    const toggle = this.$('#edit-mode-toggle');
    if (!toggle) return;
    toggle.addEventListener('change', e => {
      const next = e.detail.checked;
      this.dataset.editMode = next ? 'true' : 'false';
    });
  }

  #syncFavoriteButton(on) {
    const btn = this.$('#favorite-btn');
    if (!btn) return;
    btn.dataset.favorite = on.toString();
    // Toggle between filled and outlined star via the icon-start attribute
    btn.setAttribute('data-icon-start', on ? '\uf005' : '\uf005');
    if (!on) btn.setAttribute('data-icon-weight', 'regular');
    else btn.removeAttribute('data-icon-weight');
  }

  #setupFavorite() {
    const btn = this.$('#favorite-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = !this.isFavorite();
      this.setFavorite(next);
      this.dispatchEvent(new CustomEvent('favoritetoggle', {
        bubbles: true, composed: true,
        detail: { viewId: this.#viewId, favorite: next }
      }));
    });
  }

}

customElements.define('sherpa-view-header', SherpaViewHeader);
