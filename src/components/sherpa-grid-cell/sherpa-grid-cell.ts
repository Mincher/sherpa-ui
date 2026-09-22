/**
 * sherpa-grid-cell — the atomic Data Grid cell.
 *
 * CSS owns the look and all per-type visibility; JS only wires the buttons.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaGridCell extends SherpaElement {
  static override css = new URL('./sherpa-grid-cell.css', import.meta.url);
  static override html = new URL('./sherpa-grid-cell.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-sort-direction': { type: 'enum', kind: 'style', values: ['asc'] },
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
