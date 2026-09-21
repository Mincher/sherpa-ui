/**
 * sherpa-calendar-cell — one day, month or year in a calendar's grid. A real
 * <button>, so keyboard, focus and screen-reader behaviour come free.
 *
 * Figma's `State` axis has one selected-range variant; the code widens it into
 * start | mid | end, because only the corners that MEET a neighbour are squared.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaCalendarCell extends SherpaElement {
  static override css = new URL('./sherpa-calendar-cell.css', import.meta.url);
  static override html = new URL('./sherpa-calendar-cell.html', import.meta.url);
  static override observed = ['data-label', 'disabled'];

  override onRender(): void {
    this.#sync();
    this.$('.cell')?.addEventListener('click', this.#onClick);
  }

  override onChange(): void {
    this.#sync();
  }

  /** The ISO date this cell stands for, or its own label if none was set. */
  get value(): string {
    return this.dataset['value'] ?? this.dataset['label'] ?? '';
  }

  #sync(): void {
    const label = this.dataset['label'];
    // Only when GIVEN — otherwise an empty string wipes the slotted content.
    if (label != null) {
      const el = this.$('.label');
      if (el) el.textContent = label;
    }
    // Mirror onto the real control so the browser owns the behaviour.
    this.$<HTMLButtonElement>('.cell')?.toggleAttribute('disabled', this.hasAttribute('disabled'));
  }

  #onClick = (): void => {
    if (this.hasAttribute('disabled')) return;
    this.emit('cell-click', { value: this.value });
  };
}
customElements.define('sherpa-calendar-cell', SherpaCalendarCell);
