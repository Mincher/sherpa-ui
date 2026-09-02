/**
 * sherpa-list — a vertical stack of rows.
 *
 * Two ways to fill it:
 *   1. Slot in sherpa-list-item children yourself.
 *   2. Give it data with populate([{ title, description?, active?, interactive? }])
 *      and it draws the rows for you.
 *
 * Only one row is current at a time — clicking a row clears the others. If
 * there are no rows, an empty-state message (data-empty) shows in their place.
 *
 * Public API:
 *   data-variant  default | bordered | divided
 *   data-empty    empty-state message (shown when no rows are present)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

interface ListRow {
  title: string;
  description?: string;
  active?: boolean;
  interactive?: boolean;
}

type ListItemEl = HTMLElement & { current?: boolean };

export class SherpaList extends SherpaElement {
  static override css = new URL('./sherpa-list.css', import.meta.url);
  static override html = new URL('./sherpa-list.html', import.meta.url);
  static override observed = ['data-empty'];

  #rows: ListRow[] = [];

  override onRender(): void {
    // One delegated listener enforces a single current row across every row,
    // whether the rows were slotted or stamped by populate().
    this.addEventListener('item-click', this.#onItemClick);
    this.$('slot')?.addEventListener('slotchange', this.#syncEmpty);
    if (this.#rows.length) this.#render();
    this.#syncEmpty();
  }

  override onChange(name: string): void {
    if (name === 'data-empty') this.#syncEmpty();
  }

  /** populate([{ title, description?, active?, interactive? }]) — data rows. */
  protected override renderData(data: unknown): void {
    const list = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    this.#rows = list
      .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
      .map((r): ListRow => {
        const row: ListRow = { title: String(r['title'] ?? '') };
        if (r['description'] != null) row.description = String(r['description']);
        if (r['active']) row.active = true;
        // Data-driven rows default to interactive unless explicitly disabled.
        row.interactive = r['interactive'] !== false;
        return row;
      });
    this.#render();
  }

  #render(): void {
    const container = this.$('.rows');
    const tpl = this.$<HTMLTemplateElement>('template.row-tpl');
    if (!container || !tpl) return;

    container.replaceChildren();
    for (const row of this.#rows) {
      const item = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      item.dataset['heading'] = row.title;
      if (row.description) item.dataset['description'] = row.description;
      if (row.active) item.setAttribute('data-current', '');
      if (row.interactive) item.setAttribute('data-interactive', '');
      container.appendChild(item);
    }
    this.#syncEmpty();
  }

  /** Live count of rows across both fill modes (slotted + data-driven). */
  #rowCount(): number {
    const slotted = this.querySelectorAll(':scope > sherpa-list-item').length;
    const stamped = this.$$('.rows > sherpa-list-item').length;
    return slotted + stamped;
  }

  #syncEmpty = (): void => {
    const el = this.$('.empty');
    if (el) el.textContent = this.dataset['empty'] ?? '';
    const empty = this.#rowCount() === 0 && !!this.dataset['empty'];
    this.toggleAttribute('data-empty-visible', empty);
  };

  /** Enforce a single current row: clear every row except the one just clicked. */
  #onItemClick = (event: Event): void => {
    // item-click is composed: crossing into this list's shadow tree retargets
    // event.target to the list host, so find the real item via composedPath().
    const clicked = event
      .composedPath()
      .find(
        (n): n is ListItemEl => n instanceof HTMLElement && n.localName === 'sherpa-list-item'
      );
    if (!clicked) return;
    const rows = [
      ...this.querySelectorAll<ListItemEl>(':scope > sherpa-list-item'),
      ...this.$$<ListItemEl>('.rows > sherpa-list-item'),
    ];
    for (const row of rows) {
      if (row !== clicked) row.removeAttribute('data-current');
    }
  };
}

customElements.define('sherpa-list', SherpaList);
