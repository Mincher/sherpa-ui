/**
 * sherpa-calendar — a date picker.
 *
 * It has three views: days, months, and years. Clicking the header label zooms
 * out (day → month → year); picking a month or year zooms back in. The prev/next
 * arrows move by a month in the day view, a year in the month view, and a decade
 * in the year view. data-min / data-max set the range of days you can pick.
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
    'data-min', 'data-max', 'data-view', 'data-type', 'data-has-time',
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
        this.#view === 'day' ? `${MONTHS[this.#viewMonth]} ${this.#viewYear}`
        : this.#view === 'month' ? String(this.#viewYear)
        : `${this.#decadeStart()}–${this.#decadeStart() + 11}`;
    }
    if (this.#view === 'day') this.#renderDays();
    else if (this.#view === 'month') this.#renderMonths();
    else this.#renderYears();
  }

  #cell(): HTMLElement {
    // Five callers treat a cell as guaranteed, so this stays non-nullable — but it
    // now fails HERE with the selector named, rather than handing back `null!` and
    // crashing at whichever property the caller touches first.
    const cell = this.clone('template.cal-cell-tpl');
    if (!cell) throw new Error('sherpa-calendar: template.cal-cell-tpl is missing or empty');
    return cell;
  }

  #renderDays(): void {
    const grid = this.$('.cal-days');
    if (!grid) return;
    const y = this.#viewYear, m = this.#viewMonth;
    // Monday-first grid: convert JS getDay() (0=Sun) to a Mon=0…Sun=6 index so
    // the first column is Monday, matching the Figma weekday header.
    const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const min = this.dataset['min'] ?? '';
    const max = this.dataset['max'] ?? '';
    const todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    // Selection depends on type. In single mode a lone selected day; in range
    // mode a start / end pair (with an optional in-between band).
    const single = this.#type === 'single' ? datePart(this.dataset['value']) : '';
    const start = this.#type === 'range' ? datePart(this.dataset['valueStart']) : '';
    const end = this.#type === 'range' ? datePart(this.dataset['valueEnd']) : '';

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
      if ((min && iso < min) || (max && iso > max)) cell.setAttribute('disabled', '');

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
      if (sel && sel[0] === this.#viewYear && sel[1] === i) { cell.setAttribute('data-selected', ''); cell.setAttribute('aria-selected', 'true'); }
      if (now.getFullYear() === this.#viewYear && now.getMonth() === i) { cell.setAttribute('data-today', ''); cell.setAttribute('aria-current', 'date'); }
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
      if (sel && sel[0] === year) { cell.setAttribute('data-selected', ''); cell.setAttribute('aria-selected', 'true'); }
      if (year === nowY) { cell.setAttribute('data-today', ''); cell.setAttribute('aria-current', 'date'); }
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
