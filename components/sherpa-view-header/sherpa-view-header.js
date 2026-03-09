/**
 * SherpaViewHeader - View header toolbar with toggles and settings.
 *
 * Manages heading, favorites, feedback popover, global filter bar, and
 * export intent. Theme/mode/density preferences are delegated to ThemeManager.
 * Edit-mode is dispatched as an event — the consumer/app coordinator
 * handles toggling containers.
 *
 * Events (all bubble + composed):
 *   editmodechange   — { editMode: boolean }
 *   viewexport       — { title: string }
 *   favoritetoggle   — { viewId, favorite }
 *   globalfilterchange — (dispatched on document) { filters }
 */
import '../sherpa-switch/sherpa-switch.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-filter-bar/sherpa-filter-bar.js';

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { TIME_RANGE_PRESETS } from '../utilities/timeframes.js';
import { ThemeManager } from '../utilities/theme-manager.js';

export class SherpaViewHeader extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-view-header.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-view-header.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-show-debug-toggles', 'data-favorite', 'data-edit-mode', 'data-feedback-src'];
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
      case 'data-feedback-src':
        this.#syncFeedbackSrc(newValue);
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
  onDisconnect() {}

  // ============ Private Methods ============

  onRender() {
    this.#setupSelectors();
    this.#setupExport();
    this.#setupFeedback();
    this.#setupFavorite();
    this.#setupEditMode();
    this.#setupGlobalFilterBar();

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
      const pageTitle = this.getHeading() || 'Dashboard Export';
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
        bubbles: true,
        detail: { viewId: this.#viewId, favorite: next }
      }));
    });
  }

  #syncFeedbackSrc(url) {
    const iframe = this.$('#feedback-iframe');
    if (iframe) iframe.src = url || 'about:blank';
  }

  #setupFeedback() {
    const btn = this.$('#feedback-btn');
    const popover = this.$('#feedback-popover');
    const backdrop = this.$('#feedback-backdrop');
    const closeBtn = this.$('#feedback-close');
    if (!btn || !popover) return;

    const position = () => {
      const r = btn.getBoundingClientRect();
      popover.style.setProperty('--_feedback-left', `${Math.max(16, r.right - 640)}px`);
      popover.style.setProperty('--_feedback-top', `${Math.min(r.bottom + 8, window.innerHeight - 816)}px`);
    };

    const open = () => { position(); popover.toggleAttribute('data-open', true); backdrop?.toggleAttribute('data-open', true); };
    const close = () => { popover.removeAttribute('data-open'); backdrop?.removeAttribute('data-open'); };

    btn.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    window.addEventListener('resize', () => popover.hasAttribute('data-open') && position());
  }

  /**
   * Set up the global filter bar.
   * Populates datetime-range chips with TIME_RANGE_PRESETS and
   * dispatches `globalfilterchange` on document when filters change.
   */
  #setupGlobalFilterBar() {
    const filterBar = this.$('.global-filter-bar');
    if (!filterBar) return;

    // Wait a tick for the filter bar to render, then populate chips
    requestAnimationFrame(() => {
      const dateChips = filterBar.querySelectorAll(
        'sherpa-button[data-filter-type="datetime-range"]',
      );
      for (const chip of dateChips) {
        const options = TIME_RANGE_PRESETS.map(p => ({
          value: p.key,
          text: p.label,
        }));
        chip.setOptions?.(options);
      }
    });

    // Listen for filterchange from the global filter bar and dispatch
    // globalfilterchange on document so all viz children pick it up.
    filterBar.addEventListener('filterchange', (e) => {
      document.dispatchEvent(
        new CustomEvent('globalfilterchange', {
          detail: { filters: e.detail?.filters || [] },
        }),
      );
    });
  }

}

customElements.define('sherpa-view-header', SherpaViewHeader);
