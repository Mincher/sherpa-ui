/**
 * @element sherpa-calendar
 * @category input
 * @description Calendar panel for date, date-range, and date+time selection.
 *   Renders month navigation with day/month/year drill-down. The active
 *   sections are controlled by data-mode.
 *
 * @attr {enum}    [data-mode]      — date-time (default) | date | range | time
 * @attr {string}  [value]          — Date-time value (YYYY-MM-DDTHH:mm) — date/date-time/time modes
 * @attr {string}  [data-value]     — Range start date (YYYY-MM-DD) — range mode
 * @attr {string}  [data-value-end] — Range end date (YYYY-MM-DD) — range mode
 * @attr {boolean} [disabled]       — Disabled state
 * @attr {string}  [min]            — Minimum selectable date-time (YYYY-MM-DDTHH:mm)
 * @attr {string}  [max]            — Maximum selectable date-time (YYYY-MM-DDTHH:mm)
 *
 * @fires datetime-change  — Date or time changed (date/date-time/time modes)
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @fires rangeselect — Complete range selected (range mode)
 *   bubbles: true, composed: true
 *   detail: { start: string, end: string, startAsDate: Temporal.PlainDate|null, endAsDate: Temporal.PlainDate|null }
 *
 * @fires datetime-submit — Apply button clicked
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @fires datetime-close — Cancel button clicked
 *   bubbles: true, composed: true
 *
 * @prop {string} value — Current date-time value (read/write)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { MONTH_NAMES, isoToDate, dateToIso, renderCalendarGrid } from '../utilities/calendar-helper.js';
import '../sherpa-container/sherpa-container.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-input-number/sherpa-input-number.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaCalendar extends SherpaElement {

  /* ── Static ─────────────────────────────────────────────── */

  static override get cssUrl(): string {
    return new URL('./sherpa-calendar.css', import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL('./sherpa-calendar.html', import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'value', 'min', 'max', 'data-mode', 'data-value', 'data-value-end'];
  }

  /* ── Private refs ───────────────────────────────────────── */

  #calDaysEl: HTMLElement | null      = null;
  #calMonthsEl: HTMLElement | null    = null;
  #calYearsEl: HTMLElement | null     = null;
  #modeBtnEl: HTMLElement | null      = null;
  #prevBtnEl: HTMLElement | null      = null;
  #nextBtnEl: HTMLElement | null      = null;
  #weekdaysEl: HTMLElement | null     = null;
  #dayTpl: HTMLTemplateElement | null = null;
  #hourInputEl: HTMLInputElement | null = null;
  #hiddenInput: HTMLInputElement | null = null;

  els = this.cacheElements({
    minuteInput: { selector: '.minute-input', type: HTMLInputElement },
  });

  /* ── Private state ────────────────────────────────────── */

  #viewDate  = Temporal.Now.plainDateISO().with({ day: 1 });
  #viewMode: 'day' | 'month' | 'year' = 'day';
  #selectedDate: Temporal.PlainDate | null = null;
  #hours24   = 0;
  #minutes   = 0;

  /* ── Lifecycle ──────────────────────────────────────────── */

  override onRender(): void {
    this.#calDaysEl   = this.$<HTMLElement>('.cal-days');
    this.#calMonthsEl = this.$<HTMLElement>('.cal-months');
    this.#calYearsEl  = this.$<HTMLElement>('.cal-years');
    this.#weekdaysEl  = this.$<HTMLElement>('.cal-weekdays');
    this.#modeBtnEl   = this.$<HTMLElement>('.cal-mode');
    this.#prevBtnEl   = this.$<HTMLElement>('.cal-prev');
    this.#nextBtnEl   = this.$<HTMLElement>('.cal-next');
    this.#dayTpl      = this.$<HTMLTemplateElement>('.cal-day-tpl');
    this.#hourInputEl = this.$<HTMLInputElement>('.hour-input');
    this.#hiddenInput = this.$<HTMLInputElement>('.hidden-input');

    for (const wrap of [this.#hourInputEl, this.els.minuteInput]) {
      this.#convertToTextInput(wrap);
    }

    const mode = this.dataset['mode'] || 'date-time';
    if (mode === 'range') {
      const startIso = this.dataset['value'];
      const d = startIso ? isoToDate(startIso) : null;
      this.#viewDate = (d || Temporal.Now.plainDateISO()).with({ day: 1 });
    } else {
      const initVal = this.getAttribute('value');
      if (initVal) {
        this.#parseValue(initVal);
      } else {
        this.#viewDate = Temporal.Now.plainDateISO().with({ day: 1 });
      }
    }

    this.#renderCalendar();
    this.#syncSpinners();
    this.#wireEvents();
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    super.onAttributeChanged(name, oldValue, newValue);
    if (oldValue === newValue) return;

    if (name === 'value') {
      this.#parseValue(newValue);
      if (this.#calDaysEl) {
        this.#renderCalendar();
        this.#syncSpinners();
      }
    }
    if ((name === 'min' || name === 'max') && this.#calDaysEl) {
      this.#renderCalendar();
    }
    if ((name === 'data-value' || name === 'data-value-end') && this.#calDaysEl) {
      this.#renderCalendar();
    }
  }

  /* ── Public API ─────────────────────────────────────────── */

  get value() {
    if (!this.#selectedDate) return '';
    const hh = String(this.#hours24).padStart(2, '0');
    const mm = String(this.#minutes).padStart(2, '0');
    return `${this.#selectedDate.toString()}T${hh}:${mm}`;
  }

  set value(v) {
    this.#parseValue(v || '');
    if (this.#calDaysEl) {
      this.#renderCalendar();
      this.#syncSpinners();
    }
  }

  /* ── Private: event wiring ──────────────────────────────── */

  #wireEvents() {
    this.#prevBtnEl?.addEventListener('button-click', () => this.#step(-1));
    this.#nextBtnEl?.addEventListener('button-click', () => this.#step(+1));

    this.#modeBtnEl?.addEventListener('button-click', () => {
      if (this.#viewMode === 'day')        this.#setViewMode('month');
      else if (this.#viewMode === 'month') this.#setViewMode('year');
    });

    this.#hourInputEl?.addEventListener('change', () => {
      const n = parseInt(this.#hourInputEl?.value ?? '', 10);
      if (Number.isFinite(n)) {
        this.#hours24 = Math.min(23, Math.max(0, n));
        this.#syncSpinners();
        this.#emitChange();
      }
    });
    this.els.minuteInput?.addEventListener('change', () => {
      const n = parseInt(this.els.minuteInput?.value ?? '', 10);
      if (Number.isFinite(n)) {
        this.#minutes = Math.min(59, Math.max(0, n));
        this.#syncSpinners();
        this.#emitChange();
      }
    });

    this.$('.btn-today')?.addEventListener('button-click', () => {
      const today = Temporal.Now.plainDateISO();
      const mode = this.dataset['mode'] || 'date-time';
      if (mode === 'range') {
        this.#viewDate = today.with({ day: 1 });
        this.#renderCalendar();
      } else {
        this.#selectedDate = today;
        this.#viewDate = today.with({ day: 1 });
        this.#renderCalendar();
        this.#emitChange();
      }
    });

    this.$('.btn-cancel')?.addEventListener('button-click', () => {
      this.emit('datetime-close');
    });

    this.$('.btn-apply')?.addEventListener('button-click', () => {
      this.emit('datetime-submit', { value: this.value });
    });
  }

  /* ── Private: rendering ─────────────────────────────────── */

  #setViewMode(mode: 'day' | 'month' | 'year') {
    this.#viewMode = mode;
    this.#renderCalendar();
  }

  #step(direction: number) {
    if (this.#viewMode === 'day') {
      this.#viewDate = this.#viewDate.add({ months: direction });
    } else if (this.#viewMode === 'month') {
      this.#viewDate = this.#viewDate.add({ years: direction });
    } else {
      this.#viewDate = this.#viewDate.add({ years: direction * 12 });
    }
    this.#renderCalendar();
  }

  #renderCalendar() {
    const isDay   = this.#viewMode === 'day';
    const isMonth = this.#viewMode === 'month';
    const isYear  = this.#viewMode === 'year';

    if (this.#weekdaysEl)  this.#weekdaysEl.hidden  = !isDay;
    if (this.#calDaysEl)   this.#calDaysEl.hidden   = !isDay;
    if (this.#calMonthsEl) this.#calMonthsEl.hidden = !isMonth;
    if (this.#calYearsEl)  this.#calYearsEl.hidden  = !isYear;

    const modeBtn = this.#modeBtnEl;
    const year = this.#viewDate.year;
    if (isDay) {
      modeBtn?.setAttribute('data-label', `${MONTH_NAMES[this.#viewDate.month - 1]} ${year}`);
      modeBtn?.removeAttribute('disabled');
    } else if (isMonth) {
      modeBtn?.setAttribute('data-label', String(year));
      modeBtn?.removeAttribute('disabled');
    } else {
      const { start, end } = SherpaCalendar.#yearRange(year);
      modeBtn?.setAttribute('data-label', `${start} – ${end}`);
      modeBtn?.setAttribute('disabled', '');
    }

    if (isDay)        this.#renderDayGrid();
    else if (isMonth) this.#renderMonthGrid();
    else              this.#renderYearGrid();
  }

  #renderDayGrid() {
    if (!this.#calDaysEl || !this.#dayTpl) return;
    const minAttr = this.getAttribute('min');
    const maxAttr = this.getAttribute('max');
    const minDate = minAttr ? (minAttr.split('T')[0] ?? null) : null;
    const maxDate = maxAttr ? (maxAttr.split('T')[0] ?? null) : null;

    if ((this.dataset['mode'] || 'date-time') === 'range') {
      renderCalendarGrid(
        this.#calDaysEl,
        this.#dayTpl,
        this.#viewDate,
        this.dataset['value'] || null,
        this.dataset['valueEnd'] || null,
        minDate,
        maxDate,
        (iso: string) => this.#handleRangeClick(iso),
      );
    } else {
      renderCalendarGrid(
        this.#calDaysEl,
        this.#dayTpl,
        this.#viewDate,
        this.#selectedDate ? dateToIso(this.#selectedDate) : null,
        null,
        minDate,
        maxDate,
        (iso: string) => {
          this.#selectedDate = isoToDate(iso);
          this.#renderCalendar();
          this.#emitChange();
        },
      );
    }
  }

  #handleRangeClick(iso: string) {
    const clicked       = isoToDate(iso);
    const existingStart = isoToDate(this.dataset['value'] || null);
    const existingEnd   = isoToDate(this.dataset['valueEnd'] || null);

    // Begin a new range: no start yet, range already complete, or click precedes start
    if (!existingStart || existingEnd ||
        (clicked && existingStart && Temporal.PlainDate.compare(clicked, existingStart) < 0)) {
      this.dataset['value']    = iso;
      this.dataset['valueEnd'] = '';
      this.#renderCalendar();
      return;
    }

    // Second click — complete the range
    const startIso = this.dataset['value']!;
    this.dataset['valueEnd'] = iso;
    this.#renderCalendar();

    this.dispatchEvent(new CustomEvent('rangeselect', {
      bubbles: true,
      composed: true,
      detail: {
        start: startIso,
        end: iso,
        startAsDate: existingStart,
        endAsDate: clicked,
      },
    }));
  }

  #renderMonthGrid() {
    const year     = this.#viewDate.year;
    const today    = Temporal.Now.plainDateISO();
    // month is 1-indexed in Temporal; loop uses 0-indexed m
    const selMonth   = this.#selectedDate?.year === year ? this.#selectedDate.month - 1 : -1;
    const todayMonth = today.year === year ? today.month - 1 : -1;

    this.#calMonthsEl?.replaceChildren();
    for (let m = 0; m < 12; m++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-cell cal-month';
      btn.setAttribute('role', 'gridcell');
      btn.textContent = (MONTH_NAMES[m] ?? '').slice(0, 3);
      if (m === selMonth)   btn.setAttribute('data-selected', '');
      if (m === todayMonth) btn.setAttribute('data-today', '');
      btn.addEventListener('click', () => {
        this.#viewDate = this.#viewDate.with({ month: m + 1, day: 1 });
        this.#setViewMode('day');
      });
      this.#calMonthsEl?.appendChild(btn);
    }
  }

  #renderYearGrid() {
    const year      = this.#viewDate.year;
    const { start } = SherpaCalendar.#yearRange(year);
    const selYear   = this.#selectedDate?.year ?? -1;
    const todayYear = Temporal.Now.plainDateISO().year;

    this.#calYearsEl?.replaceChildren();
    for (let i = 0; i < 12; i++) {
      const y = start + i;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-cell cal-year';
      btn.setAttribute('role', 'gridcell');
      btn.textContent = String(y);
      if (y === selYear)   btn.setAttribute('data-selected', '');
      if (y === todayYear) btn.setAttribute('data-today', '');
      btn.addEventListener('click', () => {
        this.#viewDate = this.#viewDate.with({ year: y, day: 1 });
        this.#setViewMode('month');
      });
      this.#calYearsEl?.appendChild(btn);
    }
  }

  #syncSpinners() {
    if (this.#hourInputEl)    this.#hourInputEl.value    = String(this.#hours24).padStart(2, '0');
    if (this.els.minuteInput) this.els.minuteInput.value = String(this.#minutes).padStart(2, '0');
  }

  /**
   * Swap a sherpa-input-number's inner <input type="number"> to type="text"
   * so leading-zero padded values (e.g. "05") render verbatim. Retries on
   * rAF until the inner input is available.
   */
  #convertToTextInput(
    wrap: (HTMLElement & { getInputElement?: () => HTMLInputElement | null }) | null,
    attempts = 10,
  ) {
    if (!wrap) return;
    const inner = wrap.getInputElement?.();
    if (inner) {
      inner.type = 'text';
      inner.setAttribute('inputmode', 'numeric');
      inner.setAttribute('pattern', '\\d*');
      inner.setAttribute('maxlength', '2');
      this.#syncSpinners();
      return;
    }
    if (attempts > 0) {
      requestAnimationFrame(() => this.#convertToTextInput(wrap, attempts - 1));
    }
  }

  /* ── Private: value helpers ─────────────────────────────── */

  #parseValue(isoString: string | null | undefined) {
    if (!isoString) return;
    const [datePart, timePart = '00:00'] = isoString.split('T');
    const d = isoToDate(datePart);
    if (!d) return;
    this.#selectedDate = d;
    this.#viewDate = d.with({ day: 1 });
    const [hStr = '0', mStr = '0'] = timePart.split(':');
    this.#hours24 = Math.min(23, Math.max(0, parseInt(hStr, 10) || 0));
    this.#minutes = Math.min(59, Math.max(0, parseInt(mStr, 10) || 0));
  }

  #emitChange() {
    const val = this.value;
    if (this.#hiddenInput) this.#hiddenInput.value = val;
    this.emit('datetime-change', { value: val });
  }

  /* ── Static helpers ─────────────────────────────────────── */

  /** 12-year page anchored to a multiple of 12 (e.g. 2016–2027). */
  static #yearRange(year: number) {
    const start = year - (((year % 12) + 12) % 12);
    return { start, end: start + 11 };
  }
}

customElements.define('sherpa-calendar', SherpaCalendar);
