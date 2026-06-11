/**
 * @element sherpa-view-header
 * @category shell
 * @description Heading bar for a full page or named view. Contains the page title, optional
 *   breadcrumbs, favourite toggle, export button, and a view-selection slot for scoped view
 *   switching. Use once per page, slotted into the view-header slot of sherpa-layout-grid.
 *   Wire view-export to trigger PDF or CSV generation; wire favorite-toggle to persist user
 *   bookmark preferences.
 *
 * @attr {string}  data-label              — View heading text
 * @attr {boolean} data-show-debug-toggles — Show debug toggle controls
 * @attr {boolean} data-favorite           — Favorite state
 * @attr {boolean} data-edit-mode          — Edit mode active
 * @attr {boolean} data-back-button        — Show built-in back button
 * @attr {string}  data-export-title       — Title for PDF export
 * @attr {json}    data-breadcrumbs        — Breadcrumb trail. JSON array
 *   of `{label, href?}` objects. Renders the inline breadcrumb row when
 *   present; hidden otherwise.
 *
 * @slot title-icon  — Optional icon shown to the left of the heading label
 * @slot view-selection — Optional <sherpa-input-select> for scoped views
 *
 * @fires edit-mode-change
 *   bubbles: true, composed: true
 *   detail: { editMode: boolean }
 * @fires view-export
 *   bubbles: true, composed: true
 *   detail: { title: string }
 * @fires favorite-toggle
 *   bubbles: true, composed: true
 *   detail: { viewId: string, favorite: boolean }
 * @fires view-header-back
 *   bubbles: true, composed: true
 *   detail: {}
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
import '../sherpa-container-overlay/sherpa-container-overlay.js';
import '../sherpa-tag/sherpa-tag.js';
import '../sherpa-breadcrumbs/sherpa-breadcrumbs.js';

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { ThemeManager } from '../utilities/theme-manager.js';

// Link the .sherpa-view-header-group utility styles into the document once.
(function ensureViewHeaderGroupStyles() {
  const id = 'sherpa-view-header-group-styles';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./sherpa-view-header-group.css', import.meta.url).href;
  document.head.appendChild(link);
}());

/** A selectable view-picker entry. */
interface PickerItem {
  value: string;
  label?: string;
  badge?: string;
  badgeStatus?: string;
  checked?: boolean;
}

export class SherpaViewHeader extends SherpaElement {
  static override get cssUrl(): string  { return new URL('./sherpa-view-header.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-view-header.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-label', 'data-show-debug-toggles', 'data-favorite', 'data-edit-mode', 'data-back-button', 'data-export-title', 'data-breadcrumbs'];
  }

  #viewId: string | null = null;
  #viewPickerEls: HTMLElement[] = [];
  #pickerItems: PickerItem[] = [];
  #pickerValue: string | null = null;
  #optionSlotObserver: MutationObserver | null = null;
  #pickerRowTpl: HTMLTemplateElement | null = null;
  #pickerTriggerTpl: HTMLTemplateElement | null = null;
  #pickerBadgeTpl: HTMLTemplateElement | null = null;
  #pickerMenuTpl: HTMLTemplateElement | null = null;

  override onAttributeChanged(name: string, _oldValue: string | null, newValue: string | null): void {
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
      case 'data-breadcrumbs':
        this.#syncBreadcrumbs(newValue);
        break;
    }
  }

  #applyEditMode(on: boolean): void {
    // Sync toggle state
    const toggle = this.$<HTMLElement>('#edit-mode-toggle');
    if (toggle) toggle.dataset["state"] = on ? 'on' : 'off';
    // Dispatch so app coordinator can toggle containers, body attribute, etc.
    this.emit('edit-mode-change', { editMode: on });
  }

  // ============ Public API ============

  setHeading(name: string): void { this.dataset["label"] = name; }
  getHeading(): string { return this.dataset["label"] || ''; }
  setViewId(id: string | null): void {
    this.#viewId = id;
    if (id) this.dataset["viewId"] = id;
    else delete this.dataset["viewId"];
  }
  getViewId(): string | null { return this.#viewId; }
  setFavorite(on: boolean): void {
    this.dataset["favorite"] = on ? 'true' : 'false';
    this.#syncFavoriteButton(on);
  }
  isFavorite(): boolean { return this.dataset["favorite"] === 'true'; }

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
  setViewOptions(
    items: PickerItem[],
    currentValue?: string | null,
    opts: { ariaLabel?: string; placeholder?: string } = {},
  ): void {
    this.#renderViewPicker(Array.isArray(items) ? items : [], currentValue, opts);
  }

  /** @returns {string|null} */
  getSelectedViewValue(): string | null { return this.#pickerValue; }

  /** Remove any picker chrome and clear stored options. */
  clearViewOptions(): void {
    this.#viewPickerEls.forEach((el) => el.remove());
    this.#viewPickerEls = [];
    this.#pickerItems = [];
    this.#pickerValue = null;
  }
  override onDisconnect(): void {
    if (this.#optionSlotObserver) {
      this.#optionSlotObserver.disconnect();
      this.#optionSlotObserver = null;
    }
  }

  // ============ Private Methods ============

  override onRender(): void {
    this.#pickerRowTpl     = this.$<HTMLTemplateElement>('template.picker-row-tpl');
    this.#pickerTriggerTpl = this.$<HTMLTemplateElement>('template.picker-trigger-tpl');
    this.#pickerBadgeTpl   = this.$<HTMLTemplateElement>('template.picker-badge-tpl');
    this.#pickerMenuTpl    = this.$<HTMLTemplateElement>('template.picker-menu-tpl');
    this.#setupSelectors();
    this.#setupExport();
    this.#setupFavorite();
    this.#setupBackButton();
    this.#setupEditMode();
    this.#setupOptionSlotWatcher();
    this.#syncBreadcrumbs(this.dataset["breadcrumbs"]);

    // Apply any attributes that were set before render completed
    const heading = this.dataset["label"];
    if (heading) {
      const label = this.$('.heading-label');
      if (label) label.textContent = heading;
    }
    this.#syncFavoriteButton(this.dataset["favorite"] === 'true');
  }

  #setupSelectors(): void {
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
    const themeSelect = this.$<HTMLSelectElement>('#theme-select');
    if (themeSelect) {
      themeSelect.value = ThemeManager.getTheme();
      themeSelect.addEventListener('change', e => ThemeManager.setTheme((e.target as HTMLSelectElement).value));
    }

    // Mode (light / dark / auto)
    const modeSelect = this.$<HTMLSelectElement>('#mode-select');
    if (modeSelect) {
      modeSelect.value = ThemeManager.getMode();
      modeSelect.addEventListener('change', e => ThemeManager.setMode((e.target as HTMLSelectElement).value));
    }

    // Density
    const densitySelect = this.$<HTMLSelectElement>('#density-select');
    if (densitySelect) {
      densitySelect.value = ThemeManager.getDensity();
      densitySelect.addEventListener('change', e => ThemeManager.setDensity((e.target as HTMLSelectElement).value));
    }
  }

  #setupExport(): void {
    const btn = this.$('#export-all-btn');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
      const pageTitle = this.getHeading() || this.dataset["exportTitle"] || 'Export';
      this.emit('view-export', { title: pageTitle });
    });
  }

  #setupEditMode(): void {
    const toggle = this.$('#edit-mode-toggle');
    if (!toggle) return;
    toggle.addEventListener('change', (e) => {
      const next = (e as CustomEvent).detail?.checked;
      this.dataset["editMode"] = next ? 'true' : 'false';
    });
  }

  #syncFavoriteButton(on: boolean): void {
    const btn = this.$<HTMLElement>('#favorite-btn');
    if (!btn) return;
    btn.dataset["favorite"] = on.toString();
    // Toggle between filled (solid) and outlined (regular) star via FA classes.
    btn.setAttribute('data-icon-start', on ? 'fa-solid fa-star' : 'fa-regular fa-star');
  }

  #setupFavorite(): void {
    const btn = this.$('#favorite-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = !this.isFavorite();
      this.setFavorite(next);
      this.emit('favorite-toggle', { viewId: this.#viewId, favorite: next });
    });
  }

  #setupBackButton(): void {
    const btn = this.$('#back-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      this.emit('view-header-back', {});
    });
  }

  /**
   * Drive the inline <sherpa-breadcrumbs> from the JSON `data-breadcrumbs`
   * attribute. Each entry: `{label, href?}`. When the array is empty or
   * the attribute is missing/invalid, the row is hidden via
   * `data-has-breadcrumbs`.
   */
  #syncBreadcrumbs(raw: string | null | undefined): void {
    const crumbsEl = this.$<HTMLElement>('#view-breadcrumbs');
    if (!crumbsEl) return;
    let items: { label: string; href?: string }[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          items = parsed
            .filter((it): it is { label?: unknown; href?: unknown } => it && typeof it === 'object')
            .map((it) => {
              const label = String(it.label ?? '').trim();
              if (!label) return null;
              return it.href ? { label, href: String(it.href) } : { label };
            })
            .filter((it): it is { label: string; href?: string } => it !== null);
        }
      } catch {
        // Ignore malformed JSON; treat as empty.
      }
    }
    if (items.length) {
      crumbsEl.dataset["items"] = JSON.stringify(items);
    } else {
      delete crumbsEl.dataset["items"];
    }
    this.toggleAttribute('data-has-breadcrumbs', items.length > 0);
  }

  // ============ View-selection Picker ============
  // Built-in picker rendered into the `view-selection` slot. Consumers
  // can drive it either programmatically (setViewOptions) or
  // declaratively by adding <option> children with slot="view-selection".

  #setupOptionSlotWatcher(): void {
    if (this.#optionSlotObserver) return;
    const harvest = (): void => {
      const opts = [...this.querySelectorAll<HTMLOptionElement>(':scope > option[slot="view-selection"]')];
      if (!opts.length) return;
      const items = opts.map((o) => ({
        value: o.value || o.getAttribute('value') || o.textContent?.trim() || '',
        label: o.textContent?.trim() || '',
        badge: o.dataset["badge"] || o.getAttribute('data-badge') || undefined,
        badgeStatus: o.dataset["badgeStatus"] || o.getAttribute('data-badge-status') || undefined,
      }));
      const selected =
        opts.find((o) => o.hasAttribute('selected'))?.value ||
        opts.find((o) => o.hasAttribute('selected'))?.textContent?.trim() ||
        items[0]?.value;
      const ariaLabel = this.dataset["viewSelectionLabel"] || 'Select view';
      // Remove the originals so they don't leak into layout.
      opts.forEach((o) => o.remove());
      this.setViewOptions(items, selected, { ariaLabel });
    };
    harvest();
    this.#optionSlotObserver = new MutationObserver((records) => {
      const sawOption = records.some((r) =>
        [...r.addedNodes].some(
          (n) => n.nodeType === 1 && (n as Element).tagName === 'OPTION' && (n as Element).getAttribute('slot') === 'view-selection',
        ),
      );
      if (sawOption) harvest();
    });
    this.#optionSlotObserver.observe(this, { childList: true });
  }

  #renderViewPicker(items: PickerItem[], currentValue: string | null | undefined, { ariaLabel = 'Select view', placeholder = 'Select…' } = {}): void {
    // Strip any chrome from a previous render.
    this.#viewPickerEls.forEach((el) => el.remove());
    this.#viewPickerEls = [];
    this.#pickerItems = items;
    if (!items.length) { this.#pickerValue = null; return; }

    const resolvedValue =
      items.find((it) => it.value === currentValue)?.value || items[0]?.value;
    const currentEntry = items.find((it) => it.value === resolvedValue);
    this.#pickerValue = resolvedValue ?? null;

    // Clone trigger from template, set dynamic attributes.
    const triggerTpl = this.#pickerTriggerTpl;
    if (!triggerTpl) return;
    const trigger = (triggerTpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement & {
      rendered?: Promise<unknown>;
    };
    trigger.setAttribute('aria-label', ariaLabel);
    trigger.setAttribute('data-label', currentEntry?.label || placeholder);

    // Clone badge from template (only when the current entry has one).
    let triggerBadge: HTMLElement | null = null;
    if (currentEntry?.badge) {
      const badgeTpl = this.#pickerBadgeTpl;
      if (badgeTpl) {
        triggerBadge = (badgeTpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
        if (currentEntry.badgeStatus) triggerBadge.setAttribute('data-status', currentEntry.badgeStatus);
        triggerBadge.textContent = currentEntry.badge;
      }
    }

    // Clone menu from template; populate its existing <ul> with option rows.
    const menuTpl = this.#pickerMenuTpl;
    if (!menuTpl) return;
    const menu = (menuTpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement & {
      show?(anchor?: HTMLElement): void;
      hide?(): void;
    };
    const ul = menu.querySelector('ul');
    if (!ul) return;
    for (const it of items) {
      ul.appendChild(this.#buildPickerRow({
        value: it.value,
        label: it.label,
        badge: it.badge,
        badgeStatus: it.badgeStatus,
        checked: it.value === resolvedValue,
      }));
    }

    this.appendChild(trigger);
    if (triggerBadge) this.appendChild(triggerBadge);
    this.appendChild(menu);

    this.#viewPickerEls = triggerBadge ? [trigger, triggerBadge, menu] : [trigger, menu];

    trigger.addEventListener('button-click', (e) => {
      e.stopPropagation();
      if (menu.hasAttribute('open')) menu.hide?.();
      else menu.show?.(trigger);
    });

    menu.addEventListener('overlay-select', (e) => {
      const value = (e as CustomEvent).detail?.value;
      menu.hide?.();
      if (!value) return;
      const picked = this.#pickerItems.find((it) => it.value === value);
      if (!picked) return;
      this.#pickerValue = picked.value;
      // Update trigger label + badge in place so the picker reflects
      // the new selection without a full re-render.
      trigger.setAttribute('data-label', picked.label || '');
      if (this.#viewPickerEls[1]?.tagName === 'SHERPA-TAG') {
        this.#viewPickerEls[1].remove();
        this.#viewPickerEls.splice(1, 1);
      }
      if (picked.badge) {
        const badgeTpl2 = this.#pickerBadgeTpl;
        if (badgeTpl2) {
          const tag = (badgeTpl2.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
          if (picked.badgeStatus) tag.setAttribute('data-status', picked.badgeStatus);
          tag.textContent = picked.badge;
          trigger.after(tag);
          this.#viewPickerEls.splice(1, 0, tag);
        }
      }
      // Update the radio-style indicators in the menu.
      menu.querySelectorAll('sherpa-overlay-item').forEach((it) => {
        const v = it.getAttribute('value');
        it.setAttribute('aria-checked', v === picked.value ? 'true' : 'false');
        if (v === picked.value) it.setAttribute('data-state', 'selected');
        else it.removeAttribute('data-state');
      });
      this.emit('view-selection-change', { value: picked.value, item: picked });
    });
  }

  #buildPickerRow({ value, label, badge, badgeStatus, checked }: PickerItem): HTMLElement {
    const rowTpl = this.#pickerRowTpl;
    const node = rowTpl ? (rowTpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement : document.createElement('li');
    const item = node.querySelector('sherpa-overlay-item');
    if (item) {
      item.setAttribute('value', value);
      item.setAttribute('aria-checked', checked ? 'true' : 'false');
      if (checked) item.setAttribute('data-state', 'selected');
    }

    const labelEl = node.querySelector('.picker-label');
    if (labelEl) labelEl.textContent = label ?? '';

    const tag = node.querySelector<HTMLElement>('.picker-badge');
    if (badge && tag) {
      if (badgeStatus) tag.setAttribute('data-status', badgeStatus);
      tag.textContent = badge;
      node.setAttribute('data-has-badge', '');
    }
    return node;
  }

}

customElements.define('sherpa-view-header', SherpaViewHeader);
