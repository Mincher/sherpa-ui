/**
 * @element sherpa-transfer-list
 * @category data
 * @description Two-pane shuttle (available <-> selected). Composes
 *   sherpa-list, sherpa-list-item, sherpa-input-checkbox,
 *   sherpa-input-search, sherpa-button.
 *
 * @attr {string}  [data-source-heading=Available] — Available pane heading
 * @attr {string}  [data-target-heading=Selected]  — Selected pane heading
 * @attr {boolean} [data-search]                   — Show search inputs
 *
 * @fires transfer-change
 *   bubbles: true, composed: true
 *   detail: { values: string[], moved?: string[], direction?: 'add'|'remove' }
 *
 * @method setOptions(options)        — options: [{ value, label, selected? }]
 * @method getSelectedValues()        — Returns array of currently-selected values
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-list/sherpa-list.js';
import '../sherpa-list-item/sherpa-list-item.js';
import '../sherpa-input-checkbox/sherpa-input-checkbox.js';
import '../sherpa-input-search/sherpa-input-search.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaTransferList extends SherpaElement {
  static override get cssUrl(): string  { return new URL('./sherpa-transfer-list.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-transfer-list.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-source-heading', 'data-target-heading'];
  }

  /** @type {Array<{ value: string, label: string, selected: boolean }>} */
  #options = [];
  #sourceFilter = '';
  #targetFilter = '';
  /** @type {Set<string>} */
  #checked = new Set();

  /* ── lifecycle ─────────────────────────────────────────── */

  override onRender(): void {
    this.#syncHeadings();

    this.$('.source-pane .pane-search')?.addEventListener('input', this.#onSourceSearch);
    this.$('.target-pane .pane-search')?.addEventListener('input', this.#onTargetSearch);
    this.$('.ctrl-add')?.addEventListener('button-click',        this.#onAddSelected);
    this.$('.ctrl-add-all')?.addEventListener('button-click',    this.#onAddAll);
    this.$('.ctrl-remove')?.addEventListener('button-click',     this.#onRemoveSelected);
    this.$('.ctrl-remove-all')?.addEventListener('button-click', this.#onRemoveAll);

    this.#renderPanes();
  }

  override onAttributeChanged(name: string) {
    if (name === 'data-source-heading' || name === 'data-target-heading') this.#syncHeadings();
  }

  /* ── public api ────────────────────────────────────────── */

  setOptions(options = []) {
    // @ts-expect-error - TODO: Fix type
    this.#options = options.map((o) => ({
      // @ts-expect-error - TODO: Fix type
      value: String(o.value),
      // @ts-expect-error - TODO: Fix type
      label: String(o.label ?? o.value),
      // @ts-expect-error - TODO: Fix type
      selected: !!o.selected,
    }));
    this.#checked.clear();
    this.#renderPanes();
  }

  getSelectedValues() {
    // @ts-expect-error - TODO: Fix type
    return this.#options.filter((o) => o.selected).map((o) => o.value);
  }

  /* ── handlers ──────────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #onSourceSearch = (e: Event) => { this.#sourceFilter = (e.target.value || '').toLowerCase(); this.#renderPanes(); };
  // @ts-expect-error - TODO: Fix type
  #onTargetSearch = (e: Event) => { this.#targetFilter = (e.target.value || '').toLowerCase(); this.#renderPanes(); };

  #onAddSelected = () => {
    const moved = [];
    for (const value of this.#checked) {
      // @ts-expect-error - TODO: Fix type
      const opt = this.#options.find((o) => o.value === value);
      // @ts-expect-error - TODO: Fix type
      if (opt && !opt.selected) { opt.selected = true; moved.push(value); }
    }
    this.#checked.clear();
    if (moved.length) this.#fire(moved, 'add');
    this.#renderPanes();
  };

  #onAddAll = () => {
    const moved = [];
    for (const opt of this.#options) {
      // @ts-expect-error - TODO: Fix type
      if (!opt.selected && this.#matches(opt.label, this.#sourceFilter)) {
        // @ts-expect-error - TODO: Fix type
        opt.selected = true;
        // @ts-expect-error - TODO: Fix type
        moved.push(opt.value);
      }
    }
    if (moved.length) this.#fire(moved, 'add');
    this.#renderPanes();
  };

  #onRemoveSelected = () => {
    const moved = [];
    for (const value of this.#checked) {
      // @ts-expect-error - TODO: Fix type
      const opt = this.#options.find((o) => o.value === value);
      // @ts-expect-error - TODO: Fix type
      if (opt && opt.selected) { opt.selected = false; moved.push(value); }
    }
    this.#checked.clear();
    if (moved.length) this.#fire(moved, 'remove');
    this.#renderPanes();
  };

  #onRemoveAll = () => {
    const moved = [];
    for (const opt of this.#options) {
      // @ts-expect-error - TODO: Fix type
      if (opt.selected && this.#matches(opt.label, this.#targetFilter)) {
        // @ts-expect-error - TODO: Fix type
        opt.selected = false;
        // @ts-expect-error - TODO: Fix type
        moved.push(opt.value);
      }
    }
    if (moved.length) this.#fire(moved, 'remove');
    this.#renderPanes();
  };

  /* ── helpers ───────────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #matches(label, filter) {
    return !filter || label.toLowerCase().includes(filter);
  }

  #syncHeadings() {
    const src = this.$('.source-list');
    const tgt = this.$('.target-list');
    // @ts-expect-error - TODO: Fix type
    if (src) src.dataset["heading"] = this.dataset["sourceHeading"] || 'Available';
    // @ts-expect-error - TODO: Fix type
    if (tgt) tgt.dataset["heading"] = this.dataset["targetHeading"] || 'Selected';
  }

  #renderPanes() {
    const sourceList = this.$('.source-list');
    const targetList = this.$('.target-list');
    const tpl = this.$('template.option-tpl');
    if (!sourceList || !targetList || !tpl) return;

    sourceList.replaceChildren();
    targetList.replaceChildren();

    for (const opt of this.#options) {
      // @ts-expect-error - TODO: Fix type
      const visibleFilter = opt.selected ? this.#targetFilter : this.#sourceFilter;
      // @ts-expect-error - TODO: Fix type
      if (!this.#matches(opt.label, visibleFilter)) continue;

      // @ts-expect-error - TODO: Fix type
      const frag  = tpl.content.cloneNode(true);
      const item  = frag.querySelector('sherpa-list-item');
      const check = frag.querySelector('.option-check');
      // @ts-expect-error - TODO: Fix type
      item.dataset["label"] = opt.label;
      // @ts-expect-error - TODO: Fix type
      item.dataset["value"] = opt.value;
      // @ts-expect-error - TODO: Fix type
      check.dataset["checked"] = this.#checked.has(opt.value) ? '' : null;
      // @ts-expect-error - TODO: Fix type
      if (this.#checked.has(opt.value)) check.setAttribute('data-checked', '');
      // @ts-expect-error - TODO: Fix type
      check.addEventListener('change', (e) => {
        const isChecked = e.target.hasAttribute('data-checked') || e.target.checked;
        // @ts-expect-error - TODO: Fix type
        if (isChecked) this.#checked.add(opt.value);
        // @ts-expect-error - TODO: Fix type
        else this.#checked.delete(opt.value);
      });

      // @ts-expect-error - TODO: Fix type
      (opt.selected ? targetList : sourceList).appendChild(frag);
    }
  }

  // @ts-expect-error - TODO: Fix type
  #fire(moved, direction) {
    this.dispatchEvent(new CustomEvent('transfer-change', {
      bubbles: true, composed: true,
      detail: { values: this.getSelectedValues(), moved, direction },
    }));
  }
}

customElements.define('sherpa-transfer-list', SherpaTransferList);
