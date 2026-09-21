/**
 * sherpa-grid-cell — the atomic Data Grid cell.
 *
 * CSS owns all the look and the per-type / opt-in visibility (checkbox, actions,
 * group toggle, sort caret). JS is thin: it wires the three action buttons to
 * their events and flips the sort direction / expanded state on click. Content
 * is a slot; alignment and numeric formatting are the consumer's choice.
 *
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaGridCell extends SherpaElement {
  static override css = new URL('./sherpa-grid-cell.css', import.meta.url);
  static override html = new URL('./sherpa-grid-cell.html', import.meta.url);

  override onRender(): void {
    this.$('.sort')?.addEventListener('click', this.#onSort);
    this.$('.menu')?.addEventListener('click', this.#onMenu);
    this.$('.toggle')?.addEventListener('click', this.#onToggle);
  }

  /**
   * The sort control: ascending ⇄ descending.
   *
   * TWO states, not three — this cell has no column of its own to suspend, so
   * there is nothing for a third state to keep. The data grid's header is the
   * tri-state control (`T-one-cycle-for-one-value`).
   *
   * Reports, then writes only if nothing else will — a bound cell is
   * `data-locked` and its host owns the direction.
   * TRAP T-bind-locks-what-it-owns.
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
