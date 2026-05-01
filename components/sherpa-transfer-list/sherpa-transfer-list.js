/**
 * @element sherpa-transfer-list
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
  static get cssUrl()  { return new URL('./sherpa-transfer-list.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-transfer-list.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-source-heading', 'data-target-heading'];
  }

  /** @type {Array<{ value: string, label: string, selected: boolean }>} */
  #options = [];
  #sourceFilter = '';
  #targetFilter = '';
  /** @type {Set<string>} */
  #checked = new Set();

  /* ── lifecycle ─────────────────────────────────────────── */

  onRender() {
    this.#syncHeadings();

    this.$('.source-pane .pane-search')?.addEventListener('input', this.#onSourceSearch);
    this.$('.target-pane .pane-search')?.addEventListener('input', this.#onTargetSearch);
    this.$('.ctrl-add')?.addEventListener('button-click',        this.#onAddSelected);
    this.$('.ctrl-add-all')?.addEventListener('button-click',    this.#onAddAll);
    this.$('.ctrl-remove')?.addEventListener('button-click',     this.#onRemoveSelected);
    this.$('.ctrl-remove-all')?.addEventListener('button-click', this.#onRemoveAll);

    this.#renderPanes();
  }

  onAttributeChanged(name) {
    if (name === 'data-source-heading' || name === 'data-target-heading') this.#syncHeadings();
  }

  /* ── public api ────────────────────────────────────────── */

  setOptions(options = []) {
    this.#options = options.map((o) => ({
      value: String(o.value),
      label: String(o.label ?? o.value),
      selected: !!o.selected,
    }));
    this.#checked.clear();
    this.#renderPanes();
  }

  getSelectedValues() {
    return this.#options.filter((o) => o.selected).map((o) => o.value);
  }

  /* ── handlers ──────────────────────────────────────────── */

  #onSourceSearch = (e) => { this.#sourceFilter = (e.target.value || '').toLowerCase(); this.#renderPanes(); };
  #onTargetSearch = (e) => { this.#targetFilter = (e.target.value || '').toLowerCase(); this.#renderPanes(); };

  #onAddSelected = () => {
    const moved = [];
    for (const value of this.#checked) {
      const opt = this.#options.find((o) => o.value === value);
      if (opt && !opt.selected) { opt.selected = true; moved.push(value); }
    }
    this.#checked.clear();
    if (moved.length) this.#fire(moved, 'add');
    this.#renderPanes();
  };

  #onAddAll = () => {
    const moved = [];
    for (const opt of this.#options) {
      if (!opt.selected && this.#matches(opt.label, this.#sourceFilter)) {
        opt.selected = true;
        moved.push(opt.value);
      }
    }
    if (moved.length) this.#fire(moved, 'add');
    this.#renderPanes();
  };

  #onRemoveSelected = () => {
    const moved = [];
    for (const value of this.#checked) {
      const opt = this.#options.find((o) => o.value === value);
      if (opt && opt.selected) { opt.selected = false; moved.push(value); }
    }
    this.#checked.clear();
    if (moved.length) this.#fire(moved, 'remove');
    this.#renderPanes();
  };

  #onRemoveAll = () => {
    const moved = [];
    for (const opt of this.#options) {
      if (opt.selected && this.#matches(opt.label, this.#targetFilter)) {
        opt.selected = false;
        moved.push(opt.value);
      }
    }
    if (moved.length) this.#fire(moved, 'remove');
    this.#renderPanes();
  };

  /* ── helpers ───────────────────────────────────────────── */

  #matches(label, filter) {
    return !filter || label.toLowerCase().includes(filter);
  }

  #syncHeadings() {
    const src = this.$('.source-list');
    const tgt = this.$('.target-list');
    if (src) src.dataset.heading = this.dataset.sourceHeading || 'Available';
    if (tgt) tgt.dataset.heading = this.dataset.targetHeading || 'Selected';
  }

  #renderPanes() {
    const sourceList = this.$('.source-list');
    const targetList = this.$('.target-list');
    const tpl = this.$('template.option-tpl');
    if (!sourceList || !targetList || !tpl) return;

    sourceList.replaceChildren();
    targetList.replaceChildren();

    for (const opt of this.#options) {
      const visibleFilter = opt.selected ? this.#targetFilter : this.#sourceFilter;
      if (!this.#matches(opt.label, visibleFilter)) continue;

      const frag  = tpl.content.cloneNode(true);
      const item  = frag.querySelector('sherpa-list-item');
      const check = frag.querySelector('.option-check');
      item.dataset.label = opt.label;
      item.dataset.value = opt.value;
      check.dataset.checked = this.#checked.has(opt.value) ? '' : null;
      if (this.#checked.has(opt.value)) check.setAttribute('data-checked', '');
      check.addEventListener('change', (e) => {
        const isChecked = e.target.hasAttribute('data-checked') || e.target.checked;
        if (isChecked) this.#checked.add(opt.value);
        else this.#checked.delete(opt.value);
      });

      (opt.selected ? targetList : sourceList).appendChild(frag);
    }
  }

  #fire(moved, direction) {
    this.dispatchEvent(new CustomEvent('transfer-change', {
      bubbles: true, composed: true,
      detail: { values: this.getSelectedValues(), moved, direction },
    }));
  }
}

customElements.define('sherpa-transfer-list', SherpaTransferList);
