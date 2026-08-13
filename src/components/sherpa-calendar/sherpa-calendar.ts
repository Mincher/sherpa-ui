/**
 * sherpa-calendar — a single-date month-grid picker.
 *
 * Renders a weekday header and a grid of day cells for the viewed month, built
 * with the JS Date API (no Temporal). Prev / next step the month. data-value (ISO
 * YYYY-MM-DD) is the selected day, highlighted in the grid; data-min / data-max
 * bound the selectable range (out-of-range days are disabled). Clicking a selectable
 * day emits datetime-change { value: ISO }.
 *
 * The only structural DOM this component creates is the data-driven day grid, via a
 * cloning prototype (<template class="cal-day-tpl">) — which the golden rules allow.
 * Everything a day can look like (selected / today / out-of-range / blank) is CSS,
 * selected off data-* attributes JS stamps on each cell.
 *
 * @fires datetime-change  detail: { value: string }  — a selectable day was clicked
 */
import { SherpaElement } from '../../core/sherpa-element.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Zero-pad to two digits. */
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Build an ISO YYYY-MM-DD from a year / 0-indexed month / day. */
const toIso = (y: number, m: number, d: number): string => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** Parse an ISO YYYY-MM-DD into [year, monthIndex, day], or null. */
function parseIso(iso: string | null | undefined): [number, number, number] | null {
  if (!iso || !ISO_RE.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return [y, m - 1, d];
}

export class SherpaCalendar extends SherpaElement {
  static override css = new URL('./sherpa-calendar.css', import.meta.url);
  static override html = new URL('./sherpa-calendar.html', import.meta.url);
  static override observed = ['data-value', 'data-min', 'data-max'];

  /** Currently viewed year / 0-indexed month (drives the grid). */
  #viewYear = new Date().getFullYear();
  #viewMonth = new Date().getMonth();

  override onRender(): void {
    // Snap the view to the selected month, if any.
    const sel = parseIso(this.dataset['value']);
    if (sel) {
      this.#viewYear = sel[0];
      this.#viewMonth = sel[1];
    }
    this.$('.cal-prev')?.addEventListener('click', this.#onPrev);
    this.$('.cal-next')?.addEventListener('click', this.#onNext);
    this.$('.cal-days')?.addEventListener('click', this.#onDayClick);
    this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-value') {
      const sel = parseIso(this.dataset['value']);
      if (sel) {
        this.#viewYear = sel[0];
        this.#viewMonth = sel[1];
      }
    }
    this.#render();
  }

  /* ── Public API ─────────────────────────────────────────────────────── */

  /** Selected day (ISO YYYY-MM-DD), or ''. Mirrors data-value. */
  get value(): string {
    return this.dataset['value'] ?? '';
  }
  set value(v: string) {
    if (v) this.dataset['value'] = v;
    else delete this.dataset['value'];
  }

  /* ── Rendering ──────────────────────────────────────────────────────── */

  #render(): void {
    const label = this.$('.cal-label');
    if (label) label.textContent = `${MONTHS[this.#viewMonth]} ${this.#viewYear}`;
    this.#renderDays();
  }

  #renderDays(): void {
    const grid = this.$('.cal-days');
    const tpl = this.$<HTMLTemplateElement>('.cal-day-tpl');
    if (!grid || !tpl) return;

    const y = this.#viewYear;
    const m = this.#viewMonth;
    const firstWeekday = new Date(y, m, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const selected = this.dataset['value'] ?? '';
    const min = this.dataset['min'] ?? '';
    const max = this.dataset['max'] ?? '';
    const todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    grid.replaceChildren();

    // Leading spacer cells so day 1 lands under its weekday column.
    for (let i = 0; i < firstWeekday; i++) {
      const blank = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      blank.setAttribute('data-blank', '');
      blank.textContent = '';
      blank.setAttribute('disabled', '');
      grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toIso(y, m, d);
      const cell = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      cell.textContent = String(d);
      cell.dataset['iso'] = iso;
      if (iso === selected) cell.setAttribute('data-selected', '');
      if (iso === todayIso) cell.setAttribute('data-today', '');
      const outOfRange = (min && iso < min) || (max && iso > max);
      if (outOfRange) cell.setAttribute('disabled', '');
      grid.appendChild(cell);
    }
  }

  /* ── Interaction ────────────────────────────────────────────────────── */

  #onPrev = (): void => this.#step(-1);
  #onNext = (): void => this.#step(+1);

  #step(direction: number): void {
    let m = this.#viewMonth + direction;
    let y = this.#viewYear;
    if (m < 0) { m = 11; y -= 1; }
    else if (m > 11) { m = 0; y += 1; }
    this.#viewMonth = m;
    this.#viewYear = y;
    this.#render();
  }

  #onDayClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-day');
    if (!cell || cell.hasAttribute('disabled') || cell.hasAttribute('data-blank')) return;
    const iso = cell.dataset['iso'];
    if (!iso) return;
    this.dataset['value'] = iso;
    this.#render();
    this.emit('datetime-change', { value: iso });
  };
}

customElements.define('sherpa-calendar', SherpaCalendar);
