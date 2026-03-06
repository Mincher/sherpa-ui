/**
 * SherpaViewHeader - View header toolbar with toggles and settings.
 * Manages edit mode, auto-fill, theme, and density preferences.
 */
import '../sherpa-switch/sherpa-switch.js';
import '../sherpa-button/sherpa-button.js';

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaViewHeader extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-view-header.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-view-header.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-show-metrics', 'data-label', 'data-show-debug-toggles', 'data-favorite', 'data-edit-mode'];
  }

  #viewId = null;

  onAttributeChanged(name, oldValue, newValue) {
    switch (name) {
      case 'data-show-metrics': this.#applyShowMetrics(newValue === 'true'); break;
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

  #applyShowMetrics(show) {
    document.body.toggleAttribute('data-hide-metrics', !show);
  }

  #applyEditMode(on) {
    document.body.toggleAttribute('data-edit-mode', on);
    // Toggle editable on all containers so handles show
    document.querySelectorAll('sherpa-container').forEach(c => {
      c.toggleAttribute('data-editable', on);
    });
    // Sync toggle state
    const toggle = this.$('#edit-mode-toggle');
    if (toggle) toggle.dataset.state = on ? 'on' : 'off';
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
  setShowMetrics(show) {
    this.dataset.showMetrics = show ? 'true' : 'false';
    const toggle = this.$('#show-metrics-toggle');
    if (toggle) toggle.state = show ? 'on' : 'off';
  }
  isShowMetrics() { return this.dataset.showMetrics === 'true'; }

  onDisconnect() {}

  // ============ Private Methods ============

  onRender() {
    this.#setupToggles();
    this.#setupSelectors();
    this.#setupExport();
    this.#setupFeedback();
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

  #setupToggles() {
    // Show KPI metrics toggle (default ON)
    const showMetricsToggle = this.$('#show-metrics-toggle');
    if (showMetricsToggle) {
      // Initialize from toggle state
      const showMetrics = showMetricsToggle.dataset.state === 'on';
      this.setShowMetrics(showMetrics);
      this.#applyShowMetrics(showMetrics);
      showMetricsToggle.addEventListener('change', e => {
        this.setShowMetrics(e.detail.checked);
      });
    }
  }

  #setupSelectors() {
    // Theme (brand)
    const themeSelect = this.$('#theme-select');
    if (themeSelect) {
      const saved = localStorage.getItem('sherpa-theme') || 'apex-2-core';
      themeSelect.value = saved;
      this.#applyTheme(saved);
      themeSelect.addEventListener('change', e => {
        localStorage.setItem('sherpa-theme', e.target.value);
        this.#applyTheme(e.target.value);
      });
    }

    // Mode (light / dark / auto)
    const modeSelect = this.$('#mode-select');
    if (modeSelect) {
      const saved = localStorage.getItem('sherpa-mode') || 'auto';
      modeSelect.value = saved;
      this.#applyMode(saved);
      modeSelect.addEventListener('change', e => {
        localStorage.setItem('sherpa-mode', e.target.value);
        this.#applyMode(e.target.value);
      });
    }

    // Density
    const densitySelect = this.$('#density-select');
    if (densitySelect) {
      const saved = localStorage.getItem('sherpa-density') || 'base';
      densitySelect.value = saved;
      document.documentElement.setAttribute('data-density', saved);
      densitySelect.addEventListener('change', e => {
        localStorage.setItem('sherpa-density', e.target.value);
        document.documentElement.setAttribute('data-density', e.target.value);
      });
    }
  }

  #applyTheme(theme) {
    // Swap the @import URL in <style id="sherpa-theme"> to load the selected theme file
    const themeStyle = document.getElementById('sherpa-theme');
    if (themeStyle) {
      themeStyle.textContent = `@import url("/css/styles/sherpa-theme-${theme}.css") layer(tokens);`;
    }
  }

  #applyMode(mode) {
    // Mode switching via color-scheme property — drives CSS light-dark() resolution
    // "auto" → "light dark" (OS preference), "light" → forced light, "dark" → forced dark
    document.documentElement.style.colorScheme = mode === 'auto' ? 'light dark' : mode;
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

}

customElements.define('sherpa-view-header', SherpaViewHeader);
