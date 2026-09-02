/**
 * sherpa-calendar — a date picker.
 *
 * It has three views: days, months, and years. Clicking the header label zooms
 * out (day → month → year); picking a month or year zooms back in. The prev/next
 * arrows move by a month in the day view, a year in the month view, and a decade
 * in the year view. data-value holds the chosen day as YYYY-MM-DD; data-min and
 * data-max set the range of days you can pick.
 *
 * All three views share one cell template, and CSS shows whichever view is
 * active. Each cell's look — selected, today, out of range, blank — is CSS.
 *
 * @fires datetime-change  detail: { value: string }  — a selectable day was clicked
 */
import { SherpaElement } from '../../core/sherpa-element.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
type Layout = 'day' | 'month' | 'year';

const pad2 = (n: number): string => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number): string => `${y}-${pad2(m + 1)}-${pad2(d)}`;

function parseIso(iso: string | null | undefined): [number, number, number] | null {
  if (!iso || !ISO_RE.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return [y, m - 1, d];
}

export class SherpaCalendar extends SherpaElement {
  static override css = new URL('./sherpa-calendar.css', import.meta.url);
  static override html = new URL('./sherpa-calendar.html', import.meta.url);
  static override observed = ['data-value', 'data-min', 'data-max', 'data-layout'];

  /** Currently viewed year / 0-indexed month (drives the grids). */
  #viewYear = new Date().getFullYear();
  #viewMonth = new Date().getMonth();

  override onRender(): void {
    const sel = parseIso(this.dataset['value']);
    if (sel) { this.#viewYear = sel[0]; this.#viewMonth = sel[1]; }
    if (!this.dataset['layout']) this.dataset['layout'] = 'day';
    this.$('.cal-prev')?.addEventListener('click', this.#onPrev);
    this.$('.cal-next')?.addEventListener('click', this.#onNext);
    this.$('.cal-label')?.addEventListener('click', this.#onLabel);
    this.$('.cal-days')?.addEventListener('click', this.#onDayClick);
    this.$('.cal-months')?.addEventListener('click', this.#onMonthClick);
    this.$('.cal-years')?.addEventListener('click', this.#onYearClick);
    this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-value') {
      const sel = parseIso(this.dataset['value']);
      if (sel) { this.#viewYear = sel[0]; this.#viewMonth = sel[1]; }
    }
    this.#render();
  }

  /* ── Public API ─────────────────────────────────────────────────────── */

  get value(): string { return this.dataset['value'] ?? ''; }
  set value(v: string) { if (v) this.dataset['value'] = v; else delete this.dataset['value']; }

  get #layout(): Layout {
    const l = this.dataset['layout'];
    return l === 'month' || l === 'year' ? l : 'day';
  }

  /* ── Rendering ──────────────────────────────────────────────────────── */

  #render(): void {
    const label = this.$('.cal-label');
    if (label) {
      label.textContent =
        this.#layout === 'day' ? `${MONTHS[this.#viewMonth]} ${this.#viewYear}`
        : this.#layout === 'month' ? String(this.#viewYear)
        : `${this.#decadeStart()}–${this.#decadeStart() + 11}`;
    }
    if (this.#layout === 'day') this.#renderDays();
    else if (this.#layout === 'month') this.#renderMonths();
    else this.#renderYears();
  }

  #cell(): HTMLElement {
    const tpl = this.$<HTMLTemplateElement>('.cal-cell-tpl')!;
    return tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
  }

  #renderDays(): void {
    const grid = this.$('.cal-days');
    if (!grid) return;
    const y = this.#viewYear, m = this.#viewMonth;
    const firstWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const selected = this.dataset['value'] ?? '';
    const min = this.dataset['min'] ?? '';
    const max = this.dataset['max'] ?? '';
    const todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    grid.replaceChildren();
    for (let i = 0; i < firstWeekday; i++) {
      const blank = this.#cell();
      blank.setAttribute('data-blank', '');
      blank.setAttribute('disabled', '');
      grid.appendChild(blank);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toIso(y, m, d);
      const cell = this.#cell();
      cell.textContent = String(d);
      cell.dataset['iso'] = iso;
      if (iso === selected) cell.setAttribute('data-selected', '');
      if (iso === todayIso) cell.setAttribute('data-today', '');
      if ((min && iso < min) || (max && iso > max)) cell.setAttribute('disabled', '');
      grid.appendChild(cell);
    }
  }

  #renderMonths(): void {
    const grid = this.$('.cal-months');
    if (!grid) return;
    const sel = parseIso(this.dataset['value']);
    const now = new Date();
    grid.replaceChildren();
    MONTHS_SHORT.forEach((name, i) => {
      const cell = this.#cell();
      cell.textContent = name;
      cell.dataset['month'] = String(i);
      if (sel && sel[0] === this.#viewYear && sel[1] === i) cell.setAttribute('data-selected', '');
      if (now.getFullYear() === this.#viewYear && now.getMonth() === i) cell.setAttribute('data-today', '');
      grid.appendChild(cell);
    });
  }

  #renderYears(): void {
    const grid = this.$('.cal-years');
    if (!grid) return;
    const start = this.#decadeStart();
    const sel = parseIso(this.dataset['value']);
    const nowY = new Date().getFullYear();
    grid.replaceChildren();
    for (let i = 0; i < 12; i++) {
      const year = start + i;
      const cell = this.#cell();
      cell.textContent = String(year);
      cell.dataset['year'] = String(year);
      if (sel && sel[0] === year) cell.setAttribute('data-selected', '');
      if (year === nowY) cell.setAttribute('data-today', '');
      grid.appendChild(cell);
    }
  }

  /** First year of the 12-year block the view year sits in. */
  #decadeStart(): number {
    return this.#viewYear - ((this.#viewYear % 12));
  }

  /* ── Interaction ────────────────────────────────────────────────────── */

  #onPrev = (): void => this.#step(-1);
  #onNext = (): void => this.#step(+1);

  /** Prev/next steps by month (day), year (month), or 12-year block (year). */
  #step(direction: number): void {
    if (this.#layout === 'day') {
      let m = this.#viewMonth + direction, y = this.#viewYear;
      if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
      this.#viewMonth = m; this.#viewYear = y;
    } else if (this.#layout === 'month') {
      this.#viewYear += direction;
    } else {
      this.#viewYear += direction * 12;
    }
    this.#render();
  }

  /** The label zooms out: day → month → year. */
  #onLabel = (): void => {
    this.dataset['layout'] = this.#layout === 'day' ? 'month' : 'year';
    this.#render();
  };

  #onMonthClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    const m = cell?.dataset['month'];
    if (m == null) return;
    this.#viewMonth = Number(m);
    this.dataset['layout'] = 'day'; // zoom back in to the days of the chosen month
    this.#render();
  };

  #onYearClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    const y = cell?.dataset['year'];
    if (y == null) return;
    this.#viewYear = Number(y);
    this.dataset['layout'] = 'month'; // zoom in to the months of the chosen year
    this.#render();
  };

  #onDayClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    if (!cell || cell.hasAttribute('disabled') || cell.hasAttribute('data-blank')) return;
    const iso = cell.dataset['iso'];
    if (!iso) return;
    this.dataset['value'] = iso;
    this.#render();
    this.emit('datetime-change', { value: iso });
  };
}

customElements.define('sherpa-calendar', SherpaCalendar);
