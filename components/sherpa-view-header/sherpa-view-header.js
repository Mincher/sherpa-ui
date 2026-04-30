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
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-tag/sherpa-tag.js';

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { ThemeManager } from '../utilities/theme-manager.js';

export class SherpaViewHeader extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-view-header.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-view-header.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-show-debug-toggles', 'data-favorite', 'data-edit-mode', 'data-export-title'];
  }

  #viewId = null;
  #viewPickerEls = [];
  #pickerItems = [];
  #pickerValue = null;
  #optionSlotObserver = null;

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
  setViewId(id) {
    this.#viewId = id;
    if (id) this.dataset.viewId = id;
    else delete this.dataset.viewId;
  }
  getViewId() { return this.#viewId; }
  setFavorite(on) {
    this.dataset.favorite = on ? 'true' : 'false';
    this.#syncFavoriteButton(on);
  }
  isFavorite() { return this.dataset.favorite === 'true'; }

  /**
   * Render an inline view-selection picker into the `view-selection`
   * slot. Replaces any picker chrome from a previous call.
   *
   * @param {Array<{value:string,label:string,badge?:string,badgeStatus?:string}>} items
   * @param {string} [currentValue]  Falsy → first item
   * @param {object} [opts]
   * @param {string} [opts.ariaLabel]
   * @param {string} [opts.placeholder]  Trigger label when no current entry
   *
   * Fires `viewselectionchange` (bubbles, composed) with detail
   * `{ value, item }` when the user picks an option.
   */
  setViewOptions(items, currentValue, opts = {}) {
    this.#renderViewPicker(Array.isArray(items) ? items : [], currentValue, opts);
  }

  /** @returns {string|null} */
  getSelectedViewValue() { return this.#pickerValue; }

  /** Remove any picker chrome and clear stored options. */
  clearViewOptions() {
    this.#viewPickerEls.forEach((el) => el.remove());
    this.#viewPickerEls = [];
    this.#pickerItems = [];
    this.#pickerValue = null;
  }
  #resizeHandler = null;

  onDisconnect() {
    if (this.#optionSlotObserver) {
      this.#optionSlotObserver.disconnect();
      this.#optionSlotObserver = null;
    }
  }

  // ============ Private Methods ============

  onRender() {
    this.#setupSelectors();
    this.#setupExport();
    this.#setupFavorite();
    this.#setupEditMode();
    this.#setupOptionSlotWatcher();

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

    // Apply persisted theme / mode / density on load. The visible
    // selectors have moved to the Settings → Appearance panel; if any
    // legacy markup is still present we keep it wired below.
    ThemeManager.setTheme(ThemeManager.getTheme());
    ThemeManager.setMode(ThemeManager.getMode());
    ThemeManager.setDensity(ThemeManager.getDensity());

    // Theme (brand)
    const themeSelect = this.$('#theme-select');
    if (themeSelect) {
      themeSelect.value = ThemeManager.getTheme();
      themeSelect.addEventListener('change', e => ThemeManager.setTheme(e.target.value));
    }

    // Mode (light / dark / auto)
    const modeSelect = this.$('#mode-select');
    if (modeSelect) {
      modeSelect.value = ThemeManager.getMode();
      modeSelect.addEventListener('change', e => ThemeManager.setMode(e.target.value));
    }

    // Density
    const densitySelect = this.$('#density-select');
    if (densitySelect) {
      densitySelect.value = ThemeManager.getDensity();
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

  // ============ View-selection Picker ============
  // Built-in picker rendered into the `view-selection` slot. Consumers
  // can drive it either programmatically (setViewOptions) or
  // declaratively by adding <option> children with slot="view-selection".

  #setupOptionSlotWatcher() {
    if (this.#optionSlotObserver) return;
    const harvest = () => {
      const opts = [...this.querySelectorAll(':scope > option[slot="view-selection"]')];
      if (!opts.length) return;
      const items = opts.map((o) => ({
        value: o.value || o.getAttribute('value') || o.textContent.trim(),
        label: o.textContent.trim(),
        badge: o.dataset.badge || o.getAttribute('data-badge') || undefined,
        badgeStatus: o.dataset.badgeStatus || o.getAttribute('data-badge-status') || undefined,
      }));
      const selected =
        opts.find((o) => o.hasAttribute('selected'))?.value ||
        opts.find((o) => o.hasAttribute('selected'))?.textContent.trim() ||
        items[0]?.value;
      const ariaLabel = this.dataset.viewSelectionLabel || 'Select view';
      // Remove the originals so they don't leak into layout.
      opts.forEach((o) => o.remove());
      this.setViewOptions(items, selected, { ariaLabel });
    };
    harvest();
    this.#optionSlotObserver = new MutationObserver((records) => {
      const sawOption = records.some((r) =>
        [...r.addedNodes].some(
          (n) => n.nodeType === 1 && n.tagName === 'OPTION' && n.getAttribute('slot') === 'view-selection',
        ),
      );
      if (sawOption) harvest();
    });
    this.#optionSlotObserver.observe(this, { childList: true });
  }

  #renderViewPicker(items, currentValue, { ariaLabel = 'Select view', placeholder = 'Select…' } = {}) {
    // Strip any chrome from a previous render.
    this.#viewPickerEls.forEach((el) => el.remove());
    this.#viewPickerEls = [];
    this.#pickerItems = items;
    if (!items.length) { this.#pickerValue = null; return; }

    const resolvedValue =
      items.find((it) => it.value === currentValue)?.value || items[0].value;
    const currentEntry = items.find((it) => it.value === resolvedValue);
    this.#pickerValue = resolvedValue;

    const trigger = document.createElement('sherpa-button');
    trigger.dataset.viewPicker = '';
    trigger.setAttribute('slot', 'view-selection');
    trigger.setAttribute('data-variant', 'secondary');
    trigger.setAttribute('data-size', 'small');
    trigger.setAttribute('data-icon-end', '\uf078'); // fa-chevron-down
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-label', ariaLabel);
    trigger.setAttribute('data-label', currentEntry?.label || placeholder);
    trigger.style.inlineSize = '240px';
    trigger.style.maxInlineSize = '240px';

    let triggerBadge = null;
    if (currentEntry?.badge) {
      triggerBadge = document.createElement('sherpa-tag');
      triggerBadge.dataset.viewPicker = '';
      triggerBadge.setAttribute('slot', 'view-selection');
      triggerBadge.setAttribute('data-variant', 'secondary');
      if (currentEntry.badgeStatus) {
        triggerBadge.setAttribute('data-status', currentEntry.badgeStatus);
      }
      triggerBadge.textContent = currentEntry.badge;
    }

    const menu = document.createElement('sherpa-menu');
    menu.dataset.viewPicker = '';
    menu.setAttribute('slot', 'view-selection');
    menu.setAttribute('popover', 'auto');
    menu.style.inlineSize = '240px';
    menu.style.minInlineSize = '240px';

    const ul = document.createElement('ul');
    for (const it of items) {
      ul.appendChild(this.#buildPickerRow({
        value: it.value,
        label: it.label,
        badge: it.badge,
        badgeStatus: it.badgeStatus,
        checked: it.value === resolvedValue,
      }));
    }
    menu.appendChild(ul);

    this.appendChild(trigger);
    if (triggerBadge) this.appendChild(triggerBadge);
    this.appendChild(menu);

    this.#viewPickerEls = triggerBadge ? [trigger, triggerBadge, menu] : [trigger, menu];

    // Wait for sherpa-button's shadow DOM, then patch its trigger
    // layout so the label can ellipsis-truncate at a fixed width with
    // the chevron locked to the right.
    const applyTruncation = () => {
      const sr = trigger.shadowRoot;
      if (!sr || !sr.querySelector('.trigger')) return false;
      if (sr.querySelector('style[data-view-picker-truncate]')) return true;
      const style = document.createElement('style');
      style.dataset.viewPickerTruncate = '';
      style.textContent = `
        .trigger { inline-size: 100%; display: inline-flex; align-items: center; justify-content: flex-start; gap: var(--sherpa-space-xs); }
        .label { flex: 1 1 auto; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: start; }
        .icon-end { flex: 0 0 auto; margin-inline-start: auto; }
      `;
      sr.appendChild(style);
      return true;
    };
    const waitForRender = (attempts = 30) => {
      if (applyTruncation()) return;
      if (attempts <= 0) return;
      requestAnimationFrame(() => waitForRender(attempts - 1));
    };
    waitForRender();
    if (trigger.rendered && typeof trigger.rendered.then === 'function') {
      trigger.rendered.then(applyTruncation);
    }

    trigger.addEventListener('buttonclick', (e) => {
      e.stopPropagation();
      if (menu.hasAttribute('open')) menu.hide?.();
      else menu.show?.(trigger);
    });

    menu.addEventListener('menu-select', (e) => {
      const value = e.detail?.value;
      menu.hide?.();
      if (!value) return;
      const picked = this.#pickerItems.find((it) => it.value === value);
      if (!picked) return;
      this.#pickerValue = picked.value;
      // Update trigger label + badge in place so the picker reflects
      // the new selection without a full re-render.
      trigger.setAttribute('data-label', picked.label);
      if (this.#viewPickerEls[1]?.tagName === 'SHERPA-TAG') {
        this.#viewPickerEls[1].remove();
        this.#viewPickerEls.splice(1, 1);
      }
      if (picked.badge) {
        const tag = document.createElement('sherpa-tag');
        tag.dataset.viewPicker = '';
        tag.setAttribute('slot', 'view-selection');
        tag.setAttribute('data-variant', 'secondary');
        if (picked.badgeStatus) tag.setAttribute('data-status', picked.badgeStatus);
        tag.textContent = picked.badge;
        trigger.after(tag);
        this.#viewPickerEls.splice(1, 0, tag);
      }
      // Update the radio-style indicators in the menu.
      menu.querySelectorAll('sherpa-menu-item').forEach((it) => {
        const v = it.getAttribute('value');
        it.setAttribute('aria-checked', v === picked.value ? 'true' : 'false');
        if (v === picked.value) it.setAttribute('data-state', 'selected');
        else it.removeAttribute('data-state');
      });
      this.dispatchEvent(new CustomEvent('viewselectionchange', {
        bubbles: true, composed: true,
        detail: { value: picked.value, item: picked },
      }));
    });
  }

  #buildPickerRow({ value, label, badge, badgeStatus, checked }) {
    const li = document.createElement('li');
    const item = document.createElement('sherpa-menu-item');
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('value', value);
    item.setAttribute('aria-checked', checked ? 'true' : 'false');
    if (checked) item.setAttribute('data-state', 'selected');

    const row = document.createElement('span');
    row.style.cssText =
      'display:flex;align-items:center;gap:var(--sherpa-space-sm);inline-size:100%;';

    const text = document.createElement('span');
    text.textContent = label;
    text.style.cssText = 'flex:1 1 auto;min-inline-size:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    row.appendChild(text);

    if (badge) {
      const tag = document.createElement('sherpa-tag');
      tag.setAttribute('data-variant', 'secondary');
      if (badgeStatus) tag.setAttribute('data-status', badgeStatus);
      tag.style.marginInlineStart = 'auto';
      tag.textContent = badge;
      row.appendChild(tag);
    }

    item.appendChild(row);
    li.appendChild(item);
    return li;
  }

}

customElements.define('sherpa-view-header', SherpaViewHeader);
