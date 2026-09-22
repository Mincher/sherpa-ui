/**
 * sherpa-grid-cell — the atomic Data Grid cell.
 *
 * CSS owns the look and all per-type visibility; JS only wires the buttons.
 */
import { DATA_PROPS, SherpaElement } from '../../core/sherpa-element.js';

export class SherpaGridCell extends SherpaElement {
  static override css = new URL('./sherpa-grid-cell.css', import.meta.url);
  static override html = new URL('./sherpa-grid-cell.html', import.meta.url);

  /* `data-sort-direction` comes from DATA_PROPS — the source writes it, and a
     local copy had values ['asc'], missing both `desc` and the empty string
     that means SUSPENDED. TRAP T-the-shared-vocabulary-is-declared-once */
  static override props = {
    'data-sort-direction': DATA_PROPS['data-sort-direction'],
    'data-type': { type: 'enum', kind: 'style', values: ['filter', 'group', 'header'] },
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
    this.emit('sort-change', { direction: next });
  };

  #onMenu = (event: Event): void => {
    event.stopPropagation();
    this.emit('menu-open', {});
  };

  #onToggle = (event: Event): void => {
    event.stopPropagation();
    const expanded = !this.hasAttribute('data-expanded');
    this.toggleAttribute('data-expanded', expanded);
    this.emit('group-toggle', { expanded });
  };
}

customElements.define('sherpa-grid-cell', SherpaGridCell);
