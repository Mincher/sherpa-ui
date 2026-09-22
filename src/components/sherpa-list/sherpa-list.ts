/**
 * sherpa-list — a vertical stack of rows, filled by slotting
 * sherpa-list-item children or by populate(). One row is current at a time.
 *
 * Public API:
 *   data-type  (default — dividers between rows) | bordered | plain (no dividers)
 *   data-empty    empty-state message (shown when no rows are present)
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

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
  static override props = {
    'data-type': { type: 'enum', kind: 'style', values: ['plain'] },
    'data-empty': { type: 'string', kind: 'content', to: '.empty' },
  } as const;

  static override observed = ['data-empty'];

  #rows: ListRow[] = [];

  override onRender(): void {
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
        // Data rows are interactive unless explicitly false.
        row.interactive = r['interactive'] !== false;
        return row;
      });
    this.#render();
  }

  #render(): void {
    // `own-children` — a blanket clear would take the <slot> with it.
    this.renderItems('.body', 'template.row-tpl', this.#rows, {
      clear: 'own-children',
      ownSel: '.body > .row-item',
    });
    this.#syncEmpty();
  }

  /** Rows across both fill modes: slotted + stamped. */
  #rowCount(): number {
    const slotted = this.querySelectorAll(':scope > sherpa-list-item').length;
    const stamped = this.$$('.body > .row-item').length;
    return slotted + stamped;
  }

  // The text is a declared prop; only the flag needs JS — it counts rows.
  #syncEmpty = (): void => {
    const empty = this.#rowCount() === 0 && !!this.dataset['empty'];
    this.toggleAttribute('data-empty-visible', empty);
  };

  /** Clear every row but the one just clicked. */
  #onItemClick = (event: Event): void => {
    // A composed event retargets event.target to the host, so read the path.
    const clicked = event
      .composedPath()
      .find(
        (n): n is ListItemEl => n instanceof HTMLElement && n.localName === 'sherpa-list-item'
      );
    if (!clicked) return;
    const rows = [
      ...this.querySelectorAll<ListItemEl>(':scope > sherpa-list-item'),
      ...this.$$<ListItemEl>('.body .row-item > sherpa-list-item'),
    ];
    for (const row of rows) {
      if (row !== clicked) row.removeAttribute('data-current');
    }
  };
}

customElements.define('sherpa-list', SherpaList);
