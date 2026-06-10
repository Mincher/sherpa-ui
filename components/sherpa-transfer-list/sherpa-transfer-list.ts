/**
 * @element sherpa-transfer-list
 * @category data
 * @description Two-pane shuttle control for moving items between "available" and "selected"
 *   lists. Use for configuration UIs where users explicitly choose a subset from a pool —
 *   column selection, permission assignment, notification recipients. Supply the full pool
 *   via setOptions([ {value, label, selected?} ]); read the result via getSelectedValues().
 *   Add data-search to show search inputs above each pane.
 *
 * @attr {string}  data-source-heading=Available — Available pane heading
 * @attr {string}  data-target-heading=Selected  — Selected pane heading
 * @attr {boolean} data-search                   — Show search inputs
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
import '../sherpa-select-checkbox/sherpa-select-checkbox.js';
import '../sherpa-input-search/sherpa-input-search.js';
import '../sherpa-button/sherpa-button.js';

/** A transfer-list option. */
interface TransferOption {
  value: string;
  label: string;
  selected: boolean;
}

export class SherpaTransferList extends SherpaElement {
  static override get cssUrl(): string  { return new URL('./sherpa-transfer-list.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-transfer-list.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-source-heading', 'data-target-heading'];
  }

  #options: TransferOption[] = [];
  #sourceFilter = '';
  #targetFilter = '';
  #checked = new Set<string>();

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

  setOptions(options: Array<{ value: unknown; label?: unknown; selected?: unknown }> = []) {
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

  #onSourceSearch = (e: Event) => { this.#sourceFilter = ((e.target as HTMLInputElement).value || '').toLowerCase(); this.#renderPanes(); };
  #onTargetSearch = (e: Event) => { this.#targetFilter = ((e.target as HTMLInputElement).value || '').toLowerCase(); this.#renderPanes(); };

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

  #matches(label: string, filter: string) {
    return !filter || label.toLowerCase().includes(filter);
  }

  #syncHeadings() {
    const src = this.$<HTMLElement>('.source-list');
    const tgt = this.$<HTMLElement>('.target-list');
    if (src) src.dataset["heading"] = this.dataset["sourceHeading"] || 'Available';
    if (tgt) tgt.dataset["heading"] = this.dataset["targetHeading"] || 'Selected';
  }

  #renderPanes() {
    const sourceList = this.$('.source-list');
    const targetList = this.$('.target-list');
    const tpl = this.$<HTMLTemplateElement>('template.option-tpl');
    if (!sourceList || !targetList || !tpl) return;

    sourceList.replaceChildren();
    targetList.replaceChildren();

    for (const opt of this.#options) {
      const visibleFilter = opt.selected ? this.#targetFilter : this.#sourceFilter;
      if (!this.#matches(opt.label, visibleFilter)) continue;

      const frag  = tpl.content.cloneNode(true) as DocumentFragment;
      const item  = frag.querySelector<HTMLElement>('sherpa-list-item');
      const check = frag.querySelector<HTMLElement & { checked?: boolean }>('.option-check');
      if (item) {
        item.dataset["label"] = opt.label;
        item.dataset["value"] = opt.value;
      }
      if (check) {
        if (this.#checked.has(opt.value)) check.setAttribute('data-checked', '');
        check.addEventListener('change', (e) => {
          const t = e.target as HTMLElement & { checked?: boolean };
          const isChecked = t.hasAttribute('data-checked') || !!t.checked;
          if (isChecked) this.#checked.add(opt.value);
          else this.#checked.delete(opt.value);
        });
      }

      (opt.selected ? targetList : sourceList).appendChild(frag);
    }
  }

  #fire(moved: string[], direction: 'add' | 'remove') {
    this.emit('transfer-change', { values: this.getSelectedValues(), moved, direction });
  }
}

customElements.define('sherpa-transfer-list', SherpaTransferList);
