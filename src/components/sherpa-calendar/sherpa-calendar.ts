/**
 * sherpa-calendar — a date picker.
 *
 * TRAP T-calendar-view-is-not-the-figma-type — data-type is Figma's axis,
 * data-view is the code's own zoom.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-calendar-cell/sherpa-calendar-cell.js';
import '../sherpa-button/sherpa-button.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
type View = 'day' | 'month' | 'year';
type CalType = 'single' | 'range';

const pad2 = (n: number): string => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number): string => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** The date part of a value that may carry a `Thh:mm` tail. */
const datePart = (v: string | null | undefined): string => (v ?? '').split('T')[0] ?? '';

function parseIso(iso: string | null | undefined): [number, number, number] | null {
  const d = datePart(iso);
  if (!d || !ISO_RE.test(d)) return null;
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return [y, m - 1, day];
}

export class SherpaCalendar extends SherpaElement {
  static override css = new URL('./sherpa-calendar.css', import.meta.url);
  static override html = new URL('./sherpa-calendar.html', import.meta.url);
  static override observed = [
    'data-value', 'data-value-start', 'data-value-end',
    'data-min', 'data-max', 'data-available', 'data-view', 'data-type', 'data-has-time',
  ];

  /** Currently viewed year / 0-indexed month. */
  #viewYear = new Date().getFullYear();
  #viewMonth = new Date().getMonth();
  /** True while the USER's own click is writing a value. */
  #picking = false;

  override onRender(): void {
    const anchor = parseIso(this.dataset['value'] ?? this.dataset['valueStart'])
      ?? this.#availableAnchor();
    if (anchor) { this.#viewYear = anchor[0]; this.#viewMonth = anchor[1]; }
    if (!this.dataset['view']) this.dataset['view'] = 'day';
    // Project the stepper BEFORE binding, so it exists to bind to.
    if (this.hasAttribute('data-embedded')) this.#projectHeader();
    for (const el of this.#headerEls('.cal-prev')) el.addEventListener('click', this.#onPrev);
    for (const el of this.#headerEls('.cal-next')) el.addEventListener('click', this.#onNext);
    for (const el of this.#headerEls('.cal-label')) el.addEventListener('click', this.#onLabel);
    this.$('.cal-days')?.addEventListener('click', this.#onDayClick);
    this.$('.cal-months')?.addEventListener('click', this.#onMonthClick);
    this.$('.cal-years')?.addEventListener('click', this.#onYearClick);
    this.$('.cal-time')?.addEventListener('input', this.#onTimeInput);
    this.$('.cal-today')?.addEventListener('click', this.#onToday);
    this.$('.cal-cancel')?.addEventListener('click', this.#onCancel);
    this.$('.cal-apply')?.addEventListener('click', this.#onApply);
    this.#syncTimeInput();
    this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-value' || name === 'data-value-start') {
      // Jump to the value only when a HOST set it — TRAP T-picking-stops-the-grid-following.
      if (!this.#picking) {
        const anchor = parseIso(this.dataset['value'] ?? this.dataset['valueStart']);
        if (anchor) { this.#viewYear = anchor[0]; this.#viewMonth = anchor[1]; }
      }
    }
    if (name === 'data-value') this.#syncTimeInput();
    this.#render();
  }

  /* ── Public API ─────────────────────────────────────────────────────── */

  get value(): string { return this.dataset['value'] ?? ''; }
  set value(v: string) { if (v) this.dataset['value'] = v; else delete this.dataset['value']; }

  get #view(): View {
    const v = this.dataset['view'];
    return v === 'month' || v === 'year' ? v : 'day';
  }

  get #type(): CalType {
    return this.dataset['type'] === 'range' ? 'range' : 'single';
  }

  get #hasTime(): boolean {
    return this.dataset['hasTime'] != null;
  }

  /* ── Rendering ──────────────────────────────────────────────────────── */

  /**
   * One header control, wherever it lives — own shadow DOM or projected.
   * TRAP T-slot-assigns-direct-children-only — an embedded header is a sibling
   * in the PARENT.
   */
  #headerEls(sel: string): HTMLElement[] {
    const own = this.$<HTMLElement>(sel);
    const projected = (this.parentElement ?? this).querySelector<HTMLElement>(
      `:scope > .cal-header-projected ${sel}`,
    );
    return [own, projected].filter((e): e is HTMLElement => !!e);
  }

  /** Stepper into the HOST's header, not this element, or the slot never assigns it. */
  #projectHeader(): void {
    const header = this.clone('template.cal-header-tpl');
    if (!header) return;
    const host = this.parentElement ?? this;
    if (host.querySelector(':scope > .cal-header-projected')) return;
    host.appendChild(header);
  }

  #render(): void {
    for (const label of this.#headerEls('.cal-label')) {
      label.textContent =
        this.#view === 'day' ? this.#dayLabel()
        : this.#view === 'month' ? String(this.#viewYear)
        : `${this.#decadeStart()}–${this.#decadeStart() + 11}`;
    }
    if (this.#view === 'day') this.#renderDays();
    else if (this.#view === 'month') this.#renderMonths();
    else this.#renderYears();
  }

  /** What the stepper says in day view — TRAP T-range-header-names-both-months. */
  #dayLabel(): string {
    const left = `${MONTHS[this.#viewMonth]}`;
    if (this.#type !== 'range') return `${left} ${this.#viewYear}`;
    const next = new Date(this.#viewYear, this.#viewMonth + 1, 1);
    const right = `${MONTHS[next.getMonth()]} ${next.getFullYear()}`;
    return next.getFullYear() === this.#viewYear
      ? `${left} – ${right}`
      : `${left} ${this.#viewYear} – ${right}`;
  }

  #cell(): HTMLElement {
    // Fails HERE with the selector named, not at whichever property is touched first.
    const cell = this.clone('template.cal-cell-tpl');
    if (!cell) throw new Error('sherpa-calendar: template.cal-cell-tpl is missing or empty');
    return cell;
  }

  /** Stamp the day grid. TRAP T-two-months-share-one-grid — `data-two-up` is the GRID's. */
  #renderDays(): void {
    const grid = this.$('.cal-days');
    if (!grid) return;
    grid.replaceChildren();

    const twoUp = this.#type === 'range';
    grid.toggleAttribute('data-two-up', twoUp);
    this.$('.cal-weekdays')?.toggleAttribute('data-two-up', twoUp);

    this.#stampMonth(grid, this.#viewYear, this.#viewMonth, 1);
    if (!twoUp) return;

    const next = new Date(this.#viewYear, this.#viewMonth + 1, 1);
    this.#stampMonth(grid, next.getFullYear(), next.getMonth(), 9);
  }

  /**
   * The month to open on when nothing is picked yet — the latest available day.
   * TRAP T-calendar-anchors-where-the-data-is — anywhere else opens on a grid
   * of disabled cells.
   */
  #availableAnchor(): [number, number, number] | null {
    const days = this.#availableDays();
    if (!days?.size) return null;
    let latest = '';
    for (const d of days) if (d > latest) latest = d;
    return parseIso(latest);
  }

  #availableDays(): Set<string> | null {
    const raw = this.dataset['available'];
    if (raw == null) return null;
    return new Set(
      raw
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
    );
  }

  /**
   * Stamp one month's cells, starting at `column` (1 or 9 in the shared
   * 15-track grid) — so every cell must state its own column and row.
   */
  #stampMonth(grid: HTMLElement, y: number, m: number, column: number): void {
    // Mon=0…Sun=6, so column 1 is Monday as in the Figma weekday header.
    const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const min = this.dataset['min'] ?? '';
    const max = this.dataset['max'] ?? '';
    const available = this.#availableDays();
    const todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    const single = this.#type === 'single' ? datePart(this.dataset['value']) : '';
    const start = this.#type === 'range' ? datePart(this.dataset['valueStart']) : '';
    const end = this.#type === 'range' ? datePart(this.dataset['valueEnd']) : '';

    let slot = 0;
    let row = 1;
    const place = (cell: HTMLElement): void => {
      cell.style.gridColumn = String(column + slot);
      cell.style.gridRow = String(row);
      slot += 1;
      if (slot === 7) {
        slot = 0;
        row += 1;
      }
    };

    for (let i = 0; i < firstWeekday; i++) {
      const blank = this.#cell();
      blank.setAttribute('data-blank', '');
      blank.setAttribute('disabled', '');
      place(blank);
      grid.appendChild(blank);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toIso(y, m, d);
      const cell = this.#cell();
      cell.setAttribute('data-label', String(d));
      cell.dataset['value'] = iso;
      cell.dataset['iso'] = iso;
      // TRAP T-cell-state-is-the-only-paint — the older flags stay for the
      // month and year grids' own CSS.
      if (iso === todayIso) {
        cell.setAttribute('data-today', '');
        cell.setAttribute('data-state', 'today');
        cell.setAttribute('aria-current', 'date');
      }
      const outOfSpan = (min && iso < min) || (max && iso > max);
      const notInData = available != null && !available.has(iso);
      if (outOfSpan || notInData) cell.setAttribute('disabled', '');

      if (this.#type === 'single') {
        if (iso === single) {
          cell.setAttribute('data-selected', '');
          cell.setAttribute('data-state', 'selected');
          cell.setAttribute('aria-selected', 'true');
        }
      } else {
        const isStart = !!start && iso === start;
        const isEnd = !!end && iso === end;
        if (isStart || isEnd) {
          cell.setAttribute('data-selected', '');
          cell.setAttribute('data-range-end', '');
          // A single-day range is both ends at once.
          cell.setAttribute(
            'data-state',
            isStart && isEnd ? 'selected' : isStart ? 'range-start' : 'range-end',
          );
          cell.setAttribute('aria-selected', 'true');
        } else if (start && end && iso > start && iso < end) {
          cell.setAttribute('data-in-range', '');
          cell.setAttribute('data-state', 'range-mid');
          cell.setAttribute('aria-selected', 'true');
        }
      }
      place(cell);
      grid.appendChild(cell);
    }
  }

  #renderMonths(): void {
    const grid = this.$('.cal-months');
    if (!grid) return;
    const sel = parseIso(this.dataset['value'] ?? this.dataset['valueStart']);
    const now = new Date();
    grid.replaceChildren();
    MONTHS_SHORT.forEach((name, i) => {
      const cell = this.#cell();
      cell.textContent = name;
      cell.dataset['month'] = String(i);
      // Selected is written second, so it wins.
      if (now.getFullYear() === this.#viewYear && now.getMonth() === i) {
        cell.setAttribute('data-today', '');
        cell.setAttribute('data-state', 'today');
        cell.setAttribute('aria-current', 'date');
      }
      if (sel && sel[0] === this.#viewYear && sel[1] === i) {
        cell.setAttribute('data-selected', '');
        cell.setAttribute('data-state', 'selected');
        cell.setAttribute('aria-selected', 'true');
      }
      grid.appendChild(cell);
    });
  }

  #renderYears(): void {
    const grid = this.$('.cal-years');
    if (!grid) return;
    const start = this.#decadeStart();
    const sel = parseIso(this.dataset['value'] ?? this.dataset['valueStart']);
    const nowY = new Date().getFullYear();
    grid.replaceChildren();
    for (let i = 0; i < 12; i++) {
      const year = start + i;
      const cell = this.#cell();
      cell.textContent = String(year);
      cell.dataset['year'] = String(year);
      // Selected is written second, so it wins.
      if (year === nowY) {
        cell.setAttribute('data-today', '');
        cell.setAttribute('data-state', 'today');
        cell.setAttribute('aria-current', 'date');
      }
      if (sel && sel[0] === year) {
        cell.setAttribute('data-selected', '');
        cell.setAttribute('data-state', 'selected');
        cell.setAttribute('aria-selected', 'true');
      }
      grid.appendChild(cell);
    }
  }

  /** First year of the 12-year block the view year sits in. */
  #decadeStart(): number {
    return this.#viewYear - ((this.#viewYear % 12));
  }

  #syncTimeInput(): void {
    const input = this.$<HTMLInputElement>('.cal-time');
    if (!input) return;
    const v = this.dataset['value'] ?? '';
    const t = v.includes('T') ? v.split('T')[1] ?? '' : '';
    input.value = TIME_RE.test(t) ? t : '';
  }

  /* ── Interaction ────────────────────────────────────────────────────── */

  #onPrev = (): void => this.#step(-1);
  #onNext = (): void => this.#step(+1);

  /** Steps by month, year, or 12-year block — whichever the view shows. */
  #step(direction: number): void {
    if (this.#view === 'day') {
      let m = this.#viewMonth + direction, y = this.#viewYear;
      if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
      this.#viewMonth = m; this.#viewYear = y;
    } else if (this.#view === 'month') {
      this.#viewYear += direction;
    } else {
      this.#viewYear += direction * 12;
    }
    this.#render();
  }

  /** The label zooms out: day → month → year. */
  #onLabel = (): void => {
    this.dataset['view'] = this.#view === 'day' ? 'month' : 'year';
    this.#render();
  };

  #onMonthClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    const m = cell?.dataset['month'];
    if (m == null) return;
    this.#viewMonth = Number(m);
    this.dataset['view'] = 'day';
    this.#render();
  };

  #onYearClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    const y = cell?.dataset['year'];
    if (y == null) return;
    this.#viewYear = Number(y);
    this.dataset['view'] = 'month';
    this.#render();
  };

  #onDayClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    if (!cell || cell.hasAttribute('disabled') || cell.hasAttribute('data-blank')) return;
    const iso = cell.dataset['iso'];
    if (!iso) return;
    if (this.#type === 'range') this.#pickRange(iso);
    else this.#pickSingle(iso);
  };

  /** Sets data-value, with the time tail when hasTime. */
  #pickSingle(iso: string): void {
    const time = this.#hasTime ? this.#currentTime() : '';
    const value = time ? `${iso}T${time}` : iso;
    this.dataset['value'] = value;
    this.#syncTimeInput();
    this.#render();
    this.emit('datetime-change', { value });
  }

  /** Range mode — two-click start→end; a 3rd click restarts. Ends are ordered. */
  #pickRange(iso: string): void {
    const start = datePart(this.dataset['valueStart']);
    const end = datePart(this.dataset['valueEnd']);
    this.#picking = true;
    try {
      if (!start || (start && end)) {
        this.dataset['valueStart'] = iso;
        delete this.dataset['valueEnd'];
        this.#render();
        return;
      }
      let s = start, e = iso;
      if (e < s) { [s, e] = [e, s]; }
      this.dataset['valueStart'] = s;
      this.dataset['valueEnd'] = e;
      this.#render();
      this.emit('range-select', { start: s, end: e });
    } finally {
      // A stuck flag would ignore the host for good.
      this.#picking = false;
    }
  }

  #currentTime(): string {
    const input = this.$<HTMLInputElement>('.cal-time');
    return input && TIME_RE.test(input.value) ? input.value : '';
  }

  #onTimeInput = (): void => {
    const date = datePart(this.dataset['value']);
    if (!date) return;
    const time = this.#currentTime();
    const value = time ? `${date}T${time}` : date;
    this.dataset['value'] = value;
    this.emit('datetime-change', { value });
  };

  /* ── Footer actions ─────────────────────────────────────────────────── */

  /**
   * Jump to today and select it.
   * TRAP T-embedded-footer-needs-a-public-verb — an embedded calendar's Today
   * button lives in the HOST's footer, so it needs a public door.
   */
  today(): void {
    this.#onToday();
  }

  /** Goes through the normal pick path, so the events fire. */
  #onToday = (): void => {
    const now = new Date();
    this.#viewYear = now.getFullYear();
    this.#viewMonth = now.getMonth();
    this.dataset['view'] = 'day';
    const iso = toIso(now.getFullYear(), now.getMonth(), now.getDate());
    const min = this.dataset['min'] ?? '';
    const max = this.dataset['max'] ?? '';
    if ((min && iso < min) || (max && iso > max)) { this.#render(); return; }
    if (this.#type === 'range') this.#pickRange(iso);
    else this.#pickSingle(iso);
  };

  /** Carries no value; the host tears down or reverts. */
  #onCancel = (): void => {
    this.emit('calendar-cancel', {});
  };

  #onApply = (): void => {
    this.emit('calendar-apply', { value: this.dataset['value'] ?? '' });
  };
}

customElements.define('sherpa-calendar', SherpaCalendar);
