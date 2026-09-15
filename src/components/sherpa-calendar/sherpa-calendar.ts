/**
 * sherpa-calendar — a date picker.
 *
 * It has three views: days, months, and years. Clicking the header label zooms
 * out (day → month → year); picking a month or year zooms back in. The prev/next
 * arrows move by a month in the day view, a year in the month view, and a decade
 * in the year view. data-min / data-max set the range of days you can pick, and
 * data-available narrows that to the days a host says exist in its data.
 *
 * TYPE (data-type = single | range) mirrors the Figma Calendar `Type` axis:
 *   single (default) — one day. data-value holds it as YYYY-MM-DD.
 *   range            — two-click start→end selection. data-value-start /
 *                      data-value-end hold the two ends (YYYY-MM-DD). Days
 *                      between get data-in-range; the two ends get data-range-end.
 *
 * hasTime (data-has-time) mirrors the Figma boolean: shows a native
 * <input type="time"> in the footer. When set, data-value carries the time too as
 * YYYY-MM-DDThh:mm (single mode); the grid still keys off the date part.
 *
 * data-view (day | month | year) is the code's own zoom mechanism — it is the
 * equivalent of the Figma Calendar's Grid-collection swap (the grid the component
 * shows). It is NOT the Figma Type axis and is intentionally kept.
 *
 * All three views share one cell template, and CSS shows whichever view is
 * active. Each cell's look — selected, today, in-range, out of range, blank — is CSS.
 *
 * @fires datetime-change  detail: { value: string }              — a single day (or its date+time) was chosen
 * @fires range-select     detail: { start: string, end: string } — a range completed (both ends chosen)
 * @fires calendar-cancel  detail: {}                             — the footer Cancel button was pressed
 * @fires calendar-apply   detail: { value: string }             — the footer Apply button confirmed the current value
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// Each grid cell is a composed sherpa-calendar-cell — Figma's own "Calendar
// Cell" component — so it must be defined.
import '../sherpa-calendar-cell/sherpa-calendar-cell.js';
// The month stepper is three composed Buttons (Figma's Calendar header is a
// snapped Button group, not a row of bare arrows), so they must be defined.
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

/** The date part (YYYY-MM-DD) of a value that may carry a `Thh:mm` time tail. */
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

  /** Currently viewed year / 0-indexed month (drives the grids). */
  #viewYear = new Date().getFullYear();
  #viewMonth = new Date().getMonth();

  override onRender(): void {
    const anchor = parseIso(this.dataset['value'] ?? this.dataset['valueStart']);
    if (anchor) { this.#viewYear = anchor[0]; this.#viewMonth = anchor[1]; }
    if (!this.dataset['view']) this.dataset['view'] = 'day';
    // EMBEDDED: the stepper is projected into the host's own `header` slot, so
    // it must exist before its listeners are bound.
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
      const anchor = parseIso(this.dataset['value'] ?? this.dataset['valueStart']);
      if (anchor) { this.#viewYear = anchor[0]; this.#viewMonth = anchor[1]; }
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
   * One header control, wherever it lives.
   *
   * A calendar has ONE header, but `data-embedded` moves it out of this shadow
   * root and into the host's — so every listener and the label sync have to
   * reach either side of the boundary. Returning a list rather than an element
   * keeps both cases on one code path instead of branching at each call.
   */
  #headerEls(sel: string): HTMLElement[] {
    const own = this.$<HTMLElement>(sel);
    // The projected stepper is a sibling in the PARENT, not a descendant here
    // (see #projectHeader for why), so it is looked for there.
    const projected = (this.parentElement ?? this).querySelector<HTMLElement>(
      `:scope > .cal-header-projected ${sel}`,
    );
    return [own, projected].filter((e): e is HTMLElement => !!e);
  }

  /**
   * Put the month stepper in the HOST's header slot.
   *
   * A clone of the light-DOM prototype carries `slot="header"`, so a sherpa-menu
   * renders it in its own header region — the Calendar node's first of three.
   * Idempotent: a re-render must not stack a second stepper.
   */
  #projectHeader(): void {
    const header = this.clone('template.cal-header-tpl');
    if (!header) return;
    // Into the PARENT, not into this element. `slot="header"` only assigns a
    // DIRECT child of the slot's own host — a node one level deeper (inside the
    // calendar, inside the menu) is never assigned, which is exactly what
    // happened: the stepper existed, worked, and rendered nowhere.
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

  /**
   * What the stepper says in day view.
   *
   * A RANGE calendar shows two months, so the label names both — stepping it
   * moves the pair, and a header reading only the left one would say the wrong
   * thing about half of what is on screen. The year is stated once when the two
   * share it, which is eleven months in twelve.
   */
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
    // Five callers treat a cell as guaranteed, so this stays non-nullable — but it
    // now fails HERE with the selector named, rather than handing back `null!` and
    // crashing at whichever property the caller touches first.
    const cell = this.clone('template.cal-cell-tpl');
    if (!cell) throw new Error('sherpa-calendar: template.cal-cell-tpl is missing or empty');
    return cell;
  }

  /**
   * Stamp the day grid.
   *
   * A RANGE calendar draws TWO months side by side — Figma's Type=range
   * (268:13874) is a 15-track grid: seven day columns, a divider, seven more. A
   * range is a span between two dates, and picking one whose ends fall in
   * different months through a single month that has to be stepped is the case
   * the second month exists for.
   *
   * Both months go into ONE grid rather than two, so every cell is a real 1fr of
   * the same track set and the two halves cannot drift apart by a pixel. Each
   * month is stamped into its own columns by `#stampMonth`.
   */
  #renderDays(): void {
    const grid = this.$('.cal-days');
    if (!grid) return;
    grid.replaceChildren();

    const twoUp = this.#type === 'range';
    // `data-two-up` is what CSS reads for the 15-track template. Written on the
    // GRID and the caption row rather than the host, so the month and year
    // views — which share the host — are untouched by it.
    grid.toggleAttribute('data-two-up', twoUp);
    this.$('.cal-weekdays')?.toggleAttribute('data-two-up', twoUp);

    this.#stampMonth(grid, this.#viewYear, this.#viewMonth, 1);
    if (!twoUp) return;

    // The month AFTER the one in view, which is what a range reads forward into.
    // Date normalises December + 1 to January of the next year on its own.
    const next = new Date(this.#viewYear, this.#viewMonth + 1, 1);
    this.#stampMonth(grid, next.getFullYear(), next.getMonth(), 9);
  }

  /**
   * Stamp one month's cells into the grid, starting at `column`.
   *
   * `column` is the 1-based grid column its Mondays sit in: 1 for the left month
   * and 9 for the right, leaving track 8 as the divider Figma draws between them.
   * Only the FIRST cell of each week needs placing — the rest flow after it — but
   * every cell states its column so a month with a blank-led first week cannot
   * slide into its neighbour.
   */
  /**
   * The days that EXIST in the data, when a host has named them.
   *
   * `data-min`/`data-max` describe a SPAN, which is the wrong shape for "only
   * these days have records": a column of order dates is a scatter, not a range,
   * and a span would leave every empty day in between selectable. This is the
   * set, as a comma-separated ISO list.
   *
   * Absent means EVERY day is selectable — a host that does not compute
   * availability gets the behaviour it always had, and `data-available=""`
   * (empty, not missing) genuinely means nothing is selectable.
   */
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

  #stampMonth(grid: HTMLElement, y: number, m: number, column: number): void {
    // Monday-first grid: convert JS getDay() (0=Sun) to a Mon=0…Sun=6 index so
    // the first column is Monday, matching the Figma weekday header.
    const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const min = this.dataset['min'] ?? '';
    const max = this.dataset['max'] ?? '';
    const available = this.#availableDays();
    const todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    // Selection depends on type. In single mode a lone selected day; in range
    // mode a start / end pair (with an optional in-between band).
    const single = this.#type === 'single' ? datePart(this.dataset['value']) : '';
    const start = this.#type === 'range' ? datePart(this.dataset['valueStart']) : '';
    const end = this.#type === 'range' ? datePart(this.dataset['valueEnd']) : '';

    // Where each cell lands. `slot` walks 0..6 and wraps into the next ROW, so a
    // cell is always in its own month's seven tracks — and the two months start
    // on row 1 together rather than the second flowing on after the first. Left
    // to auto-flow they stacked: September's five rows then October's five,
    // nine deep instead of five across.
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
      // `data-state` is the cell component's own API, mirroring the node's State
      // axis. The older data-today / data-selected flags stay alongside it: the
      // calendar's own CSS still reads them for the month and year grids.
      if (iso === todayIso) {
        cell.setAttribute('data-today', '');
        cell.setAttribute('data-state', 'today');
        cell.setAttribute('aria-current', 'date');
      }
      // Out of the allowed SPAN, or not in the available SET. Both disable the
      // cell; the set is checked only when a host supplied one.
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
          // The two ENDS keep their outer corners and square the ones that meet
          // the band — which is why the code's range half is three states where
          // the node draws one. A single-day range is both ends at once, so it
          // stays fully rounded.
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
      // TODAY first, SELECTED second — the same order the day grid uses, so a
      // month that is both reads as selected. `data-state` is the cell
      // component's own API and the only thing it paints from; `data-today` and
      // `data-selected` alone set no state and the cell drew plain, which is why
      // the current month and year looked like every other.
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
      // TODAY first, SELECTED second — see #renderMonths.
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

  /** Push the date part of data-value into the time input (keeps them in step). */
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

  /** Prev/next steps by month (day), year (month), or 12-year block (year). */
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
    this.dataset['view'] = 'day'; // zoom back in to the days of the chosen month
    this.#render();
  };

  #onYearClick = (event: Event): void => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cal-cell');
    const y = cell?.dataset['year'];
    if (y == null) return;
    this.#viewYear = Number(y);
    this.dataset['view'] = 'month'; // zoom in to the months of the chosen year
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

  /** Single mode — set data-value (with the current time tail if hasTime), emit. */
  #pickSingle(iso: string): void {
    const time = this.#hasTime ? this.#currentTime() : '';
    const value = time ? `${iso}T${time}` : iso;
    this.dataset['value'] = value;
    this.#syncTimeInput();
    this.#render();
    this.emit('datetime-change', { value });
  }

  /**
   * Range mode — two-click start→end.
   *   1st click (or a 3rd, restarting): set start, clear end.
   *   2nd click: record the end day (swap if it lands before the start), emit range-select.
   */
  #pickRange(iso: string): void {
    const start = datePart(this.dataset['valueStart']);
    const end = datePart(this.dataset['valueEnd']);
    if (!start || (start && end)) {
      // begin a fresh range
      this.dataset['valueStart'] = iso;
      delete this.dataset['valueEnd'];
      this.#render();
      return;
    }
    // complete the range (order the two ends)
    let s = start, e = iso;
    if (e < s) { [s, e] = [e, s]; }
    this.dataset['valueStart'] = s;
    this.dataset['valueEnd'] = e;
    this.#render();
    this.emit('range-select', { start: s, end: e });
  }

  /** hh:mm currently held in the time input (empty if unset). */
  #currentTime(): string {
    const input = this.$<HTMLInputElement>('.cal-time');
    return input && TIME_RE.test(input.value) ? input.value : '';
  }

  /** Time input changed — fold it into data-value and re-emit datetime-change. */
  #onTimeInput = (): void => {
    const date = datePart(this.dataset['value']);
    if (!date) return; // no day chosen yet — nothing to combine with
    const time = this.#currentTime();
    const value = time ? `${date}T${time}` : date;
    this.dataset['value'] = value;
    this.emit('datetime-change', { value });
  };

  /* ── Footer actions ─────────────────────────────────────────────────── */

  /**
   * Jump to today and select it.
   *
   * PUBLIC, because when this calendar is embedded the Today button is not in
   * this shadow root — it belongs to the host's footer (Figma's Calendar footer
   * puts it in the Container Footer's `left` slot), and the host has to be able
   * to reach the behaviour without reaching into private state.
   */
  today(): void {
    this.#onToday();
  }

  /**
   * Today — jump the view to today's month and select today (single mode) or
   * begin a fresh range at today (range mode). Reuses the normal pick path so
   * datetime-change / range-select still fire.
   */
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

  /** Cancel — let the host tear down / revert. Carries no value. */
  #onCancel = (): void => {
    this.emit('calendar-cancel', {});
  };

  /** Apply — confirm the current value (the single day, or its date+time tail). */
  #onApply = (): void => {
    this.emit('calendar-apply', { value: this.dataset['value'] ?? '' });
  };
}

customElements.define('sherpa-calendar', SherpaCalendar);
