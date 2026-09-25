/**
 * sherpa-transfer-list — two panes you shuttle items between.
 * An item's `selected` flag IS its pane; each move fires transfer-change.
 *
 * Map:
 * - TransferItem — A transfer-list item.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

/** A transfer-list item. */
export interface TransferItem {
  value: string;
  label?: string;
  selected?: boolean;
}

interface Item {
  value: string;
  label: string;
  selected: boolean;
}

export class SherpaTransferList extends SherpaElement {
  static override css = new URL('./sherpa-transfer-list.css', import.meta.url);
  static override html = new URL('./sherpa-transfer-list.html', import.meta.url);
  static override props = {
    'data-source-heading': { type: 'string', kind: 'content', to: '.source .pane-heading', default: 'Available' },
    'data-target-heading': { type: 'string', kind: 'content', to: '.target .pane-heading', default: 'Selected' },
  } as const;

  #items: Item[] = [];
  /** Values staged (checked) for the next move, in either pane. */
  #staged = new Set<string>();

  override onRender(): void {
    this.$('.moves')?.addEventListener('click', this.#onMoveClick);
    this.$('.panes')?.addEventListener('item-select', this.#onRowSelect as EventListener);
    this.#render();
  }

  /** populate([{ value, label, selected? }]) — the full item pool. */
  protected override renderData(data: unknown): void {
    const rows = Array.isArray(data)
      ? (data as Array<{ value: unknown; label?: unknown; selected?: unknown }>)
      : [];
    this.#items = rows.map((o) => ({
      value: String(o.value),
      label: String(o.label ?? o.value),
      selected: !!o.selected,
    }));
    this.#staged.clear();
    this.#render();
  }

  /** Values currently in the selected (right) pane. */
  get selected(): string[] {
    return this.#items.filter((i) => i.selected).map((i) => i.value);
  }

  /** REPLACES the selected pane; unknown values are ignored. */
  set selected(values: readonly string[]) {
    const wanted = new Set(values);
    for (const item of this.#items) item.selected = wanted.has(item.value);
    this.#staged.clear();
    this.#render();
  }

  /** @deprecated Read `selected` instead. */
  getSelectedValues(): string[] {
    return this.selected;
  }

  #render(): void {
    const sourceList = this.$('.source .pane-list');
    const targetList = this.$('.target .pane-list');
    const tpl = this.$<HTMLTemplateElement>('template.row-tpl');
    if (!sourceList || !targetList || !tpl) return;

    sourceList.replaceChildren();
    targetList.replaceChildren();

    for (const item of this.#items) {
      const row = this.cloneItem('template.row-tpl', item);
      if (!row) continue;
      row
        .querySelector('sherpa-list-item')!
        .toggleAttribute('data-selected', this.#staged.has(item.value));
      (item.selected ? targetList : sourceList).appendChild(row);
    }
    this.$('.source')?.toggleAttribute('data-empty', !this.#items.some((i) => !i.selected));
    this.$('.target')?.toggleAttribute('data-empty', !this.#items.some((i) => i.selected));
  }

  #onRowSelect = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.row');
    const value = row?.dataset['value'];
    if (!value) return;
    const selected = (event as CustomEvent).detail?.selected;
    if (selected) this.#staged.add(value);
    else this.#staged.delete(value);
  };

  #onMoveClick = (event: Event): void => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-move]');
    const move = btn?.dataset['move'];
    if (!move) return;
    switch (move) {
      case 'add': this.#move(true, false); break;
      case 'add-all': this.#move(true, true); break;
      case 'remove': this.#move(false, false); break;
      case 'remove-all': this.#move(false, true); break;
    }
  };

  /** Move into (select) or out of the selected pane — `all` ignores staging. */
  #move(select: boolean, all: boolean): void {
    const moved: string[] = [];
    for (const item of this.#items) {
      const inOrigin = item.selected !== select; // origin is the opposite pane
      if (!inOrigin) continue;
      if (!all && !this.#staged.has(item.value)) continue;
      item.selected = select;
      moved.push(item.value);
      this.#staged.delete(item.value);
    }
    if (!moved.length) return;
    this.#render();
    this.emit('transfer-change', {
      selected: this.selected,
      moved,
      direction: select ? 'add' : 'remove',
    });
  }
}

customElements.define('sherpa-transfer-list', SherpaTransferList);
