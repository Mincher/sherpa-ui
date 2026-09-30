/**
 * sherpa-calendar — a date picker.
 *
 * TRAP T-calendar-view-is-not-the-figma-type — data-type is Figma's axis,
 * data-view is the code's own zoom.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-calendar-cell/sherpa-calendar-cell.js';
import '../sherpa-button/sherpa-button.js';

/** A month's name in the reader's own words, as the platform says it. TODO 84. */
const monthName = (month: number, width: 'long' | 'short' = 'long'): string =>
  Temporal.PlainDate.from({ year: 2000, month, day: 1 }).toLocaleString(undefined, { month: width });

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
type View = 'day' | 'month' | 'year';
type CalType = 'single' | 'range';


/** The date part of a value that may carry a `Thh:mm` tail. */
const datePart = (v: string | null | undefined): string => (v ?? '').split('T')[0] ?? '';

/** A value's day, or null when it names none. */
function parseIso(iso: string | null | undefined): Temporal.PlainDate | null {
  const d = datePart(iso);
  if (!ISO_RE.test(d)) return null;
  try {
    return Temporal.PlainDate.from(d);
  } catch {
    return null;
  }
}

/** Today, where the reader is. */
const today = (): Temporal.PlainDate => Temporal.Now.plainDateISO();

export class SherpaCalendar extends SherpaElement {
  static override css = new URL('./sherpa-calendar.css', import.meta.url);
  static override html = new URL('./sherpa-calendar.html', import.meta.url);
  static override props = {
    /* Drawn inline rather than in a popover — no card, no footer. */
    'data-embedded': { type: 'boolean', kind: 'style' },
  } as const;

  static override observed = [
    'data-value', 'data-value-start', 'data-value-end',
    'data-min', 'data-max', 'data-available', 'data-view', 'data-type', 'data-has-time',
  ];

  /** The month on view — its year is the month and year views' too. */
  #shown = today().toPlainYearMonth();
  /** True while the USER's own click is writing a value. */
  #picking = false;

  override onRender(): void {
    const anchor = parseIso(this.dataset['value'] ?? this.dataset['valueStart'])
      ?? this.#availableAnchor();
    if (anchor) this.#shown = anchor.toPlainYearMonth();
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
    this.$('.cal-today')?.addEventListener('button-click', this.#onToday);
    this.$('.cal-cancel')?.addEventListener('button-click', this.#onCancel);
    this.$('.cal-apply')?.addEventListener('button-click', this.#onApply);
    this.#syncTimeInput();
    this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-value' || name === 'data-value-start') {
      // Jump to the value only when a HOST set it — TRAP T-picking-stops-the-grid-following.
      if (!this.#picking) {
        const anchor = parseIso(this.dataset['value'] ?? this.dataset['valueStart']);
        if (anchor) this.#shown = anchor.toPlainYearMonth();
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

  /** Draw the header label and the grid for the current view. */
  #render(): void {
    for (const label of this.#headerEls('.cal-label')) {
      label.textContent =
        this.#view === 'day' ? this.#dayLabel()
        : this.#view === 'month' ? String(this.#shown.year)
        : `${this.#decadeStart()}–${this.#decadeStart() + 11}`;
    }
    if (this.#view === 'day') this.#renderDays();
    else if (this.#view === 'month') this.#renderMonths();
    else this.#renderYears();
  }

  /** What the stepper says in day view — TRAP T-range-header-names-both-months. */
  #dayLabel(): string {
    const { year } = this.#shown;
    const left = monthName(this.#shown.month);
    if (this.#type !== 'range') return `${left} ${year}`;
    const next = this.#shown.add({ months: 1 });
    const right = `${monthName(next.month)} ${next.year}`;
    return next.year === year ? `${left} – ${right}` : `${left} ${year} – ${right}`;
  }

  /** One cloned day cell. */
  #cell(): HTMLElement {
    // Fails HERE with the selector named, not at whichever property is touched first.
    const cell = this.clone('template.cal-cell-tpl');
    if (!cell) throw new Error('sherpa-calendar: template.cal-cell-tpl is missing or empty');
    return cell;
  }

  /** How many months, or years, make one row of their grid — the CSS's three tracks. */
  static readonly PER_ROW = 3;

  /** Put a cell in its grid's last ROW, opening a new one when `first` in it. */
  #toRow(grid: Element, cell: HTMLElement, first: boolean): void {
    if (first) grid.appendChild(this.clone('template.cal-row-tpl')!);
    grid.lastElementChild!.appendChild(cell);
  }

  /** Stamp the day grid. TRAP T-two-months-share-one-grid — `data-two-up` is the GRID's. */
  #renderDays(): void {
    const grid = this.$('.cal-days');
    if (!grid) return;
    grid.replaceChildren();

    const twoUp = this.#type === 'range';
    grid.toggleAttribute('data-two-up', twoUp);
    this.$('.cal-weekdays')?.toggleAttribute('data-two-up', twoUp);

    this.#stampMonth(grid, this.#shown, 1);
    if (twoUp) this.#stampMonth(grid, this.#shown.add({ months: 1 }), 9);
  }

  /**
   * The month to open on when nothing is picked yet — the latest available day.
   * TRAP T-calendar-anchors-where-the-data-is — anywhere else opens on a grid
   * of disabled cells.
   */
  #availableAnchor(): Temporal.PlainDate | null {
    const days = this.#availableDays();
    if (!days?.size) return null;
    let latest = '';
    for (const d of days) if (d > latest) latest = d;
    return parseIso(latest);
  }

  /** The days that may be picked, or null when every day may. */
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
   * What may be picked: a span, a set of days, or both — ONE rule, asked of a
   * day, a month and a year. A RANGE spans days, so only its BOUNDS come from
   * the data — the first and last days with records; a day between with none
   * is still an end. TRAP T-a-range-is-bounded-by-the-data
   */
  #limits(): { min: string; max: string; days: Set<string> | null } {
    const available = this.#availableDays();
    const ends = this.#type === 'range' && available?.size ? [...available].sort() : null;
    return {
      min: this.dataset['min'] ?? ends?.[0] ?? '',
      max: this.dataset['max'] ?? ends?.at(-1) ?? '',
      days: ends ? null : available,
    };
  }

  /** Is there a day to pick from `from` to `to`? A month or a year with none
   *  is inactive, as such a day is. Will, TODO 135. */
  #hasPick(from: string, to: string): boolean {
    const { min, max, days } = this.#limits();
    if ((max && from > max) || (min && to < min)) return false;
    if (!days) return true;
    const lo = min && min > from ? min : from;
    const hi = max && max < to ? max : to;
    for (const day of days) if (day >= lo && day <= hi) return true;
    return false;
  }

  /**
   * Stamp one month's cells, starting at `column` (1 or 9 in the shared
   * 15-track grid) — so every cell must state its own column and row.
   */
  #stampMonth(grid: HTMLElement, month: Temporal.PlainYearMonth, column: number): void {
    // ISO weekdays run Monday 1 to Sunday 7, so column 1 is Monday, as in Figma's header.
    const firstWeekday = month.toPlainDate({ day: 1 }).dayOfWeek - 1;
    const { min, max, days } = this.#limits();
    const todayIso = today().toString();

    const single = this.#type === 'single' ? datePart(this.dataset['value']) : '';
    const start = this.#type === 'range' ? datePart(this.dataset['valueStart']) : '';
    const end = this.#type === 'range' ? datePart(this.dataset['valueEnd']) : '';

    let slot = 0;
    let row = 1;
    const place = (cell: HTMLElement): void => {
      cell.style.gridColumn = String(column + slot);
      cell.style.gridRow = String(row);
      this.#toRow(grid, cell, slot === 0);
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
      // A spacer, not a day: nothing to read.
      blank.removeAttribute('role');
      blank.setAttribute('aria-hidden', 'true');
      place(blank);
    }
    for (let d = 1; d <= month.daysInMonth; d++) {
      const iso = month.toPlainDate({ day: d }).toString();
      const cell = this.#cell();
      cell.setAttribute('data-label', String(d));
      cell.dataset['value'] = iso;
      cell.dataset['iso'] = iso;
      // `data-state` paints; the flags beside it are a TEST query surface and
      // are read by no CSS. TRAP T-cell-state-is-the-only-paint
      if (iso === todayIso) {
        cell.setAttribute('data-today', '');
        cell.setAttribute('data-state', 'today');
        cell.setAttribute('aria-current', 'date');
      }
      const outOfSpan = (min && iso < min) || (max && iso > max);
      if (outOfSpan || (days && !days.has(iso))) cell.setAttribute('disabled', '');

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
    }
  }

  /** Draw the twelve months. */
  #renderMonths(): void {
    const grid = this.$('.cal-months');
    if (!grid) return;
    const sel = parseIso(this.dataset['value'] ?? this.dataset['valueStart']);
    const now = today();
    const { year } = this.#shown;
    grid.replaceChildren();
    for (let i = 0; i < 12; i++) {
      const month = Temporal.PlainYearMonth.from({ year, month: i + 1 });
      const cell = this.#cell();
      cell.textContent = monthName(i + 1, 'short');
      // 0-based, as it always was.
      cell.dataset['month'] = String(i);
      const from = month.toPlainDate({ day: 1 }).toString();
      if (!this.#hasPick(from, month.toPlainDate({ day: month.daysInMonth }).toString())) cell.setAttribute('disabled', '');
      // Selected is written second, so it wins.
      if (now.year === year && now.month === i + 1) {
        cell.setAttribute('data-today', '');
        cell.setAttribute('data-state', 'today');
        cell.setAttribute('aria-current', 'date');
      }
      if (sel && sel.year === year && sel.month === i + 1) {
        cell.setAttribute('data-selected', '');
        cell.setAttribute('data-state', 'selected');
        cell.setAttribute('aria-selected', 'true');
      }
      this.#toRow(grid, cell, i % SherpaCalendar.PER_ROW === 0);
    }
  }

  /** Draw a twelve-year block. */
  #renderYears(): void {
    const grid = this.$('.cal-years');
    if (!grid) return;
    const start = this.#decadeStart();
    const sel = parseIso(this.dataset['value'] ?? this.dataset['valueStart']);
    const nowY = today().year;
    grid.replaceChildren();
    for (let i = 0; i < 12; i++) {
      const year = start + i;
      const cell = this.#cell();
      cell.textContent = String(year);
      cell.dataset['year'] = String(year);
      if (!this.#hasPick(`${year}-01-01`, `${year}-12-31`)) cell.setAttribute('disabled', '');
      // Selected is written second, so it wins.
      if (year === nowY) {
        cell.setAttribute('data-today', '');
        cell.setAttribute('data-state', 'today');
        cell.setAttribute('aria-current', 'date');
      }
      if (sel && sel.year === year) {
        cell.setAttribute('data-selected', '');
        cell.setAttribute('data-state', 'selected');
        cell.setAttribute('aria-selected', 'true');
      }
      this.#toRow(grid, cell, i % SherpaCalendar.PER_ROW === 0);
    }
  }

  /** First year of the 12-year block the view year sits in. */
  #decadeStart(): number {
    return this.#shown.year - (this.#shown.year % 12);
  }

  /** Mirror the value's time onto the time field. */
  #syncTimeInput(): void {
    const input = this.$<HTMLInputElement>('.cal-time');
    if (!input) return;
    const v = this.dataset['value'] ?? '';
    const t = v.includes('T') ? v.split('T')[1] ?? '' : '';
    input.value = TIME_RE.test(t) ? t : '';
  }

  /* ── Interaction ────────────────────────────────────────────────────── */

  /** Step back one month, year or block. */
  #onPrev = (): void => this.#step(-1);
  /** Step forward one month, year or block. */
  #onNext = (): void => this.#step(+1);

  /** Steps by month, year, or 12-year block — whichever the view shows. */
  #step(direction: number): void {
    const by = this.#view === 'day' ? { months: direction }
      : { years: this.#view === 'month' ? direction : direction * 12 };
    this.#shown = this.#shown.add(by);
    this.#render();
  }

  /** The label zooms out: day → month → year. */
  #onLabel = (): void => {
    this.dataset['view'] = this.#view === 'day' ? 'month' : 'year';
    this.#render();
  };

  /** A month was picked: show its days. */
  #onMonthClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    const m = cell?.dataset['month'];
    if (m == null || cell?.hasAttribute('disabled')) return;
    this.#shown = this.#shown.with({ month: Number(m) + 1 });
    this.dataset['view'] = 'day';
    this.#render();
  };

  /** A year was picked: show its months. */
  #onYearClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    const y = cell?.dataset['year'];
    if (y == null || cell?.hasAttribute('disabled')) return;
    this.#shown = this.#shown.with({ year: Number(y) });
    this.dataset['view'] = 'month';
    this.#render();
  };

  /** A day was picked: set the value, or one end of a range. */
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

  /** The time in the time field, or nothing if it is not a time. */
  #currentTime(): string {
    const input = this.$<HTMLInputElement>('.cal-time');
    return input && TIME_RE.test(input.value) ? input.value : '';
  }

  /** The time changed: put it on the picked day. */
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
    const now = today();
    this.#shown = now.toPlainYearMonth();
    this.dataset['view'] = 'day';
    const iso = now.toString();
    const min = this.dataset['min'] ?? '';
    const max = this.dataset['max'] ?? '';
    if ((min && iso < min) || (max && iso > max)) { this.#render(); return; }
    if (this.#type === 'range') this.#pickRange(iso);
    else this.#pickSingle(iso);
  };

  /** Carries no value; the host tears down or reverts. */
  #onCancel = (): void => {
    this.emit('calendar-cancel');
  };

  /** Apply: report the value. */
  #onApply = (): void => {
    this.emit('calendar-apply', { value: this.dataset['value'] ?? '' });
  };
}

customElements.define('sherpa-calendar', SherpaCalendar);
