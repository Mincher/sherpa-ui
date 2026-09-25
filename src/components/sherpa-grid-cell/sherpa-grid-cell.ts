/**
 * sherpa-grid-cell — the atomic Data Grid cell.
 *
 * CSS owns the look and all per-type visibility; JS only wires the buttons.
 */
import { DATA_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaGridCell extends SherpaElement {
  static override css = new URL('./sherpa-grid-cell.css', import.meta.url);
  static override html = new URL('./sherpa-grid-cell.html', import.meta.url);

  /* `data-sort-direction` comes from DATA_PROPS — the source writes it, and a
     local copy had values ['asc'], missing both `desc` and the empty string
     that means SUSPENDED. TRAP T-the-shared-vocabulary-is-declared-once */
  static override props = {
    'data-sort-direction': DATA_PROPS['data-sort-direction'],
    'data-type': { type: 'enum', kind: 'style', values: ['filter', 'group', 'header'] },
    /* The column this cell belongs to, and the group value it heads. Both ride
       out in an event detail so a listener above the cell can act on it. */
    'data-field': { type: 'string', kind: 'style' },
    'data-value': { type: 'string', kind: 'style' },
    'data-locked': DATA_PROPS['data-locked'],
    /* A group header cell reports whether its group is open. */
    'data-expanded': { type: 'boolean', kind: 'style' },
  } as const;

  override onRender(): void {
    this.$('.sort')?.addEventListener('click', this.#onSort);
    this.$('.menu')?.addEventListener('click', this.#onMenu);
    this.$('.toggle')?.addEventListener('click', this.#onToggle);
  }

  /**
   * Sort: asc ⇄ desc only — the grid header owns the third, suspended state
   * (`T-one-cycle-for-one-value`). Always reports; writes only when unlocked.
   * TRAP T-bind-locks-what-it-owns
   */
  #onSort = (event: Event): void => {
    event.stopPropagation();
    const next = this.dataset['sortDirection'] === 'asc' ? 'desc' : 'asc';
    if (!this.hasAttribute('data-locked')) this.dataset['sortDirection'] = next;
    // `field` too: the grid's own sort-change carries it, and a detail without
    // one cannot be read by any listener above a single cell.
    this.emit('sort-change', { field: this.dataset['field'] ?? '', direction: next });
  };

  /** The cell's menu button — it must not sort or select the row. */
  #onMenu = (event: Event): void => {
    event.stopPropagation();
    this.emit('menu-open', {});
  };

  /* `collapsed`, NOT `expanded`: sherpa-data-grid emits the same event name with
     the opposite sense, so a host listening over a subtree that holds both got
     contradictory answers for one gesture.
     TRAP T-one-event-name-one-detail-shape */
  #onToggle = (event: Event): void => {
    event.stopPropagation();
    const expanded = !this.hasAttribute('data-expanded');
    this.toggleAttribute('data-expanded', expanded);
    this.emit('group-toggle', { value: this.dataset['value'] ?? '', collapsed: !expanded });
  };
}

customElements.define('sherpa-grid-cell', SherpaGridCell);
