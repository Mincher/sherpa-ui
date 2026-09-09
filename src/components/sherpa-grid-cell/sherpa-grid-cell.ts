/**
 * sherpa-grid-cell — the atomic Data Grid cell.
 *
 * CSS owns all the look and the per-type / opt-in visibility (checkbox, actions,
 * group toggle, sort caret). JS is thin: it wires the three action buttons to
 * their events and flips the sort direction / expanded state on click. Content
 * is a slot; alignment and numeric formatting are the consumer's choice.
 *
 * @element sherpa-grid-cell
 * @attr {enum}    data-type            cell | header | filter | group
 * @attr {boolean} data-has-checkbox    show the leading selection checkbox
 * @attr {boolean} data-has-actions     show the trailing sort + menu buttons
 * @attr {enum}    data-sort-direction  asc | desc (header sort state)
 * @attr {boolean} data-expanded        group open state
 *
 * @fires sort-change  — the sort button is clicked. bubbles + composed. detail: { direction: 'asc' | 'desc' }
 * @fires menu-open    — the menu button is clicked. bubbles + composed. detail: {}
 * @fires group-toggle — the group toggle is clicked. bubbles + composed. detail: { expanded: boolean }
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

  #onSort = (event: Event): void => {
    event.stopPropagation();
    const next = this.dataset['sortDirection'] === 'asc' ? 'desc' : 'asc';
    this.dataset['sortDirection'] = next;
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
