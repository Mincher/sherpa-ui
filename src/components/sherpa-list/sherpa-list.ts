/**
 * sherpa-list — a vertical container for a homogeneous row list.
 *
 * Two ways to fill it:
 *   1. Slot sherpa-list-item children into the default slot (authored markup).
 *   2. populate([{ title, description?, active?, interactive? }]) — data-driven
 *      rows stamped from the <template class="row-tpl"> prototype (the only
 *      structural DOM it creates, which the golden rules allow).
 *
 * The list keeps at most one row active: a delegated `list-item-click` handler
 * clears the active state on every sibling item. An empty-state message
 * (data-empty) shows when there are no rows; CSS owns its visibility.
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

type ListItemEl = HTMLElement & { active?: boolean };

export class SherpaList extends SherpaElement {
  static override css = new URL('./sherpa-list.css', import.meta.url);
  static override html = new URL('./sherpa-list.html', import.meta.url);
  static override observed = ['data-empty'];

  #rows: ListRow[] = [];

  override onRender(): void {
    // One delegated listener enforces single-active across every row, whether
    // the rows were slotted or stamped by populate().
    this.addEventListener('list-item-click', this.#onItemClick);
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
      item.dataset['title'] = row.title;
      if (row.description) item.dataset['description'] = row.description;
      if (row.active) item.setAttribute('data-active', '');
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

  /** Enforce single-active: deactivate every row except the one just clicked. */
  #onItemClick = (event: Event): void => {
    // list-item-click is composed: crossing into this list's shadow tree retargets
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
      if (row !== clicked) row.removeAttribute('data-active');
    }
  };
}

customElements.define('sherpa-list', SherpaList);
