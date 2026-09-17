/**
 * sherpa-calendar-cell — one day, month or year in a calendar's grid.
 *
 * Composes the Figma "Calendar Cell" (276:16589), which Will split onto the
 * Calendar page as one of the visual parts a calendar is built FROM. The
 * component owns the cell's box, its three states and its text; the calendar
 * owns which day each one is and what happens when it is pressed.
 *
 * A real <button>, so keyboard, focus and screen-reader behaviour come free.
 *
 * The node's `State` axis is default | today | selected-range. The code widens
 * the range half into three — start, mid, end — because a run of days has to
 * square only the corners that MEET, which one Figma variant cannot express on
 * its own (it is drawn as the middle of a run).
 *
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
    // Only write the label when one was GIVEN — a cell using the default slot
    // would otherwise have its slotted content replaced by an empty string.
    if (label != null) {
      const el = this.$('.label');
      if (el) el.textContent = label;
    }
    // `disabled` is mirrored onto the real control, so the browser owns the
    // behaviour rather than CSS pretending.
    this.$<HTMLButtonElement>('.cell')?.toggleAttribute('disabled', this.hasAttribute('disabled'));
  }

  #onClick = (): void => {
    if (this.hasAttribute('disabled')) return;
    this.emit('cell-click', { value: this.value });
  };
}
customElements.define('sherpa-calendar-cell', SherpaCalendarCell);
