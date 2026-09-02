/**
 * sherpa-transfer-list — two lists you shuttle items between.
 *
 * Give it all the items with populate([{ value, label, selected? }]); each one
 * starts in the left (available) or right (selected) list based on its `selected`
 * flag. Tick some rows, then use the arrow buttons in the middle to move them
 * across. Each move fires transfer-change with the values now on the right.
 *
 * @fires transfer-change — detail: { selected: string[], moved: string[], direction: 'add' | 'remove' }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

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
  static override observed = ['data-source-heading', 'data-target-heading'];

  #items: Item[] = [];
  /** Values staged (checked) for the next move, in either pane. */
  #staged = new Set<string>();

  override onRender(): void {
    this.#syncHeadings();
    this.$('.moves')?.addEventListener('click', this.#onMoveClick);
    // A row's leading control fires item-select; stage/unstage on it.
    this.$('.panes')?.addEventListener('item-select', this.#onRowSelect as EventListener);
    this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-source-heading' || name === 'data-target-heading') this.#syncHeadings();
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

  /* ── Public API ────────────────────────────────────────────────────── */

  /** Values currently in the selected (right) pane. */
  get selected(): string[] {
    return this.#items.filter((i) => i.selected).map((i) => i.value);
  }

  getSelectedValues(): string[] {
    return this.selected;
  }

  /* ── Rendering ─────────────────────────────────────────────────────── */

  #syncHeadings(): void {
    const src = this.$('.source .pane-heading');
    if (src) src.textContent = this.dataset['sourceHeading'] ?? 'Available';
    const tgt = this.$('.target .pane-heading');
    if (tgt) tgt.textContent = this.dataset['targetHeading'] ?? 'Selected';
  }

  #render(): void {
    const sourceList = this.$('.source .pane-list');
    const targetList = this.$('.target .pane-list');
    const tpl = this.$<HTMLTemplateElement>('template.row-tpl');
    if (!sourceList || !targetList || !tpl) return;

    sourceList.replaceChildren();
    targetList.replaceChildren();

    for (const item of this.#items) {
      const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      row.dataset['value'] = item.value;
      const listItem = row.querySelector('sherpa-list-item') as HTMLElement;
      listItem.dataset['heading'] = item.label;
      listItem.toggleAttribute('data-selected', this.#staged.has(item.value));
      (item.selected ? targetList : sourceList).appendChild(row);
    }
    // Empty-state visibility is CSS, keyed on whether a pane has rows.
    this.$('.source')?.toggleAttribute('data-empty', !this.#items.some((i) => !i.selected));
    this.$('.target')?.toggleAttribute('data-empty', !this.#items.some((i) => i.selected));
  }

  /* ── Interaction (all same shadow tree — event.target is reliable) ──── */

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

  /**
   * Move items into (select=true) or out of the selected pane. When `all`, every
   * item in the origin pane moves; otherwise only staged (checked) items do.
   */
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
