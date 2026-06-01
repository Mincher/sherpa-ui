/**
 * sherpa-date-time-picker.js
 * SherpaDateTimePicker — Combined date + time picker popup panel.
 *
 * @element sherpa-date-time-picker
 * @category input
 *
 * @attr {string}  value    — Current date-time value (YYYY-MM-DDTHH:mm)
 * @attr {boolean} disabled — Disabled state
 * @attr {string}  min      — Minimum selectable date-time (YYYY-MM-DDTHH:mm)
 * @attr {string}  max      — Maximum selectable date-time (YYYY-MM-DDTHH:mm)
 * @attr {enum}    data-mode — 'date-time' (default) | 'date' | 'time'
 *                            Controls which sections of the picker are visible.
 *
 * @fires datetime-change   — User changed date or time
 *   bubbles: true, composed: true
 *   detail: { value: string }   ISO datetime (YYYY-MM-DDTHH:mm)
 *
 * @fires datetime-submit   — Apply button clicked
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @fires datetime-close    — Close button clicked
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
import '../sherpa-icon/sherpa-icon.js';

export class SherpaDateTimePicker extends SherpaElement {

  /* ── Static ─────────────────────────────────────────────── */

  static override get cssUrl(): string {
    return new URL('./sherpa-date-time-picker.css', import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL('./sherpa-date-time-picker.html', import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'value', 'min', 'max', 'data-mode'];
  }

  /* ── Private refs ───────────────────────────────────────── */

  #calDaysEl: HTMLElement | null     = null;
  #calMonthsEl: HTMLElement | null   = null;
  #calYearsEl: HTMLElement | null    = null;
  #modeBtnEl: HTMLElement | null     = null;
  #prevBtnEl: HTMLElement | null     = null;
  #nextBtnEl: HTMLElement | null     = null;
  #weekdaysEl: HTMLElement | null    = null;
  #dayTpl: HTMLTemplateElement | null = null;
  #hourInputEl: HTMLInputElement | null = null;
  #hiddenInput: HTMLInputElement | null = null;

  els = this.cacheElements({
    minuteInput: { selector: '.minute-input', type: HTMLInputElement }
  });

  /* ── Private state ────────────────────────────────────── */

  #viewDate     = new Date();   // anchor for current view
  #viewMode: 'day' | 'month' | 'year' = 'day';
  #selectedDate: Date | null = null;  // Date (date only, no time)
  #hours24      = 0;            // 0–23 (24-hour clock)
  #minutes      = 0;            // 0–59

  /* ── Lifecycle ──────────────────────────────────────────── */

  override onRender(): void {
    this.#calDaysEl     = this.$<HTMLElement>('.cal-days');
    this.#calMonthsEl   = this.$<HTMLElement>('.cal-months');
    this.#calYearsEl    = this.$<HTMLElement>('.cal-years');
    this.#weekdaysEl    = this.$<HTMLElement>('.cal-weekdays');
    this.#modeBtnEl     = this.$<HTMLElement>('.cal-mode');
    this.#prevBtnEl     = this.$<HTMLElement>('.cal-prev');
    this.#nextBtnEl     = this.$<HTMLElement>('.cal-next');
    this.#dayTpl        = this.$<HTMLTemplateElement>('.cal-day-tpl');
    this.#hourInputEl   = this.$<HTMLInputElement>('.hour-input');
    this.#hiddenInput   = this.$<HTMLInputElement>('.hidden-input');

    // Reach into each sherpa-input-number and switch its inner <input>
    // from type="number" to type="text" so leading zeros (e.g. "05") are
    // preserved visually. Each sherpa-input-number bootstraps its own
    // shadow DOM asynchronously, so wait until the inner input exists.
    for (const wrap of [this.#hourInputEl, this.els.minuteInput]) {
      this.#convertToTextInput(wrap);
    }

    const initVal = this.getAttribute('value');
    if (initVal) {
      this.#parseValue(initVal);
    } else {
      this.#viewDate = new Date();
      this.#viewDate.setDate(1);
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
  }

  /* ── Public API ─────────────────────────────────────────── */

  get value() {
    if (!this.#selectedDate) return '';
    const y  = this.#selectedDate.getFullYear();
    const mo = String(this.#selectedDate.getMonth() + 1).padStart(2, '0');
    const d  = String(this.#selectedDate.getDate()).padStart(2, '0');
    const hh = String(this.#hours24).padStart(2, '0');
    const mm = String(this.#minutes).padStart(2, '0');
    return `${y}-${mo}-${d}T${hh}:${mm}`;
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
    // Calendar navigation — prev/next step depends on current view mode
    this.#prevBtnEl?.addEventListener('button-click', () => this.#step(-1));
    this.#nextBtnEl?.addEventListener('button-click', () => this.#step(+1));

    // Mode toggle: day → month → year (year is the terminal step)
    this.#modeBtnEl?.addEventListener('button-click', () => {
      if (this.#viewMode === 'day')        this.#setViewMode('month');
      else if (this.#viewMode === 'month') this.#setViewMode('year');
    });

    // Hour / minute — sherpa-input-number fires native input/change events
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

    // Footer — nested sherpa-button elements dispatch 'button-click'
    this.$('.btn-today')?.addEventListener('button-click', () => {
      const today = new Date();
      this.#selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      this.#viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
      this.#renderCalendar();
      this.#emitChange();
    });

    this.$('.btn-close')?.addEventListener('button-click', () => {
      this.dispatchEvent(new CustomEvent('datetime-close', { bubbles: true, composed: true }));
    });

    this.$('.btn-apply')?.addEventListener('button-click', () => {
      this.dispatchEvent(new CustomEvent('datetime-submit', {
        bubbles: true,
        composed: true,
        detail: { value: this.value },
      }));
    });
  }

  /* ── Private: rendering ─────────────────────────────────── */

  #setViewMode(mode: 'day' | 'month' | 'year') {
    this.#viewMode = mode;
    this.#renderCalendar();
  }

  /** Prev/Next behaviour depends on the active view. */
  #step(direction: number) {
    if (this.#viewMode === 'day') {
      this.#viewDate = new Date(this.#viewDate.getFullYear(), this.#viewDate.getMonth() + direction, 1);
    } else if (this.#viewMode === 'month') {
      this.#viewDate = new Date(this.#viewDate.getFullYear() + direction, this.#viewDate.getMonth(), 1);
    } else {
      // year mode: jump a full 12-year page
      this.#viewDate = new Date(this.#viewDate.getFullYear() + (direction * 12), this.#viewDate.getMonth(), 1);
    }
    this.#renderCalendar();
  }

  #renderCalendar() {
    const isDay   = this.#viewMode === 'day';
    const isMonth = this.#viewMode === 'month';
    const isYear  = this.#viewMode === 'year';

    // Toggle visibility of the three grids and the weekday header
    if (this.#weekdaysEl)  this.#weekdaysEl.hidden  = !isDay;
    if (this.#calDaysEl)   this.#calDaysEl.hidden   = !isDay;
    if (this.#calMonthsEl) this.#calMonthsEl.hidden = !isMonth;
    if (this.#calYearsEl)  this.#calYearsEl.hidden  = !isYear;

    // Update the mode-toggle label + interactivity
    const modeBtn = this.#modeBtnEl;
    const year = this.#viewDate.getFullYear();
    if (isDay) {
      modeBtn?.setAttribute('data-label', `${MONTH_NAMES[this.#viewDate.getMonth()]} ${year}`);
      modeBtn?.removeAttribute('disabled');
    } else if (isMonth) {
      modeBtn?.setAttribute('data-label', String(year));
      modeBtn?.removeAttribute('disabled');
    } else {
      const { start, end } = SherpaDateTimePicker.#yearRange(year);
      modeBtn?.setAttribute('data-label', `${start} – ${end}`);
      // Year is the terminal step — disable the toggle here.
      modeBtn?.setAttribute('disabled', '');
    }

    if (isDay)        this.#renderDayGrid();
    else if (isMonth) this.#renderMonthGrid();
    else              this.#renderYearGrid();
  }

  #renderDayGrid() {
    const minAttr = this.getAttribute('min');
    const maxAttr = this.getAttribute('max');
    const minDate = minAttr ? minAttr.split('T')[0] : null;
    const maxDate = maxAttr ? maxAttr.split('T')[0] : null;
    const selIso  = this.#selectedDate ? dateToIso(this.#selectedDate) : null;

    renderCalendarGrid(
      this.#calDaysEl,
      this.#dayTpl,
      this.#viewDate,
      selIso,
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

  #renderMonthGrid() {
    const year = this.#viewDate.getFullYear();
    const selMonth = this.#selectedDate && this.#selectedDate.getFullYear() === year
      ? this.#selectedDate.getMonth() : -1;
    const todayMonth = (new Date().getFullYear() === year) ? new Date().getMonth() : -1;

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
        this.#viewDate = new Date(year, m, 1);
        this.#setViewMode('day');
      });
      this.#calMonthsEl?.appendChild(btn);
    }
  }

  #renderYearGrid() {
    const year = this.#viewDate.getFullYear();
    const { start } = SherpaDateTimePicker.#yearRange(year);
    const selYear = this.#selectedDate ? this.#selectedDate.getFullYear() : -1;
    const todayYear = new Date().getFullYear();

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
        this.#viewDate = new Date(y, this.#viewDate.getMonth(), 1);
        this.#setViewMode('month');
      });
      this.#calYearsEl?.appendChild(btn);
    }
  }

  #syncSpinners() {
    // Always show two digits so the field reads as a time component
    // (e.g. "01", "09") regardless of the underlying numeric value.
    if (this.#hourInputEl)   this.#hourInputEl.value   = String(this.#hours24).padStart(2, '0');
    if (this.els.minuteInput) this.els.minuteInput.value = String(this.#minutes).padStart(2, '0');
  }

  /**
   * Swap a sherpa-input-number's inner <input type="number"> over to
   * type="text" so leading-zero padded values render verbatim. Retries
   * on rAF until the inner input is available, since sherpa-input-number
   * bootstraps its own shadow DOM asynchronously.
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
      // Re-apply the padded value now that the field can hold it.
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
    this.#viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
    const [hStr = '0', mStr = '0'] = timePart.split(':');
    this.#hours24 = Math.min(23, Math.max(0, parseInt(hStr, 10) || 0));
    this.#minutes = Math.min(59, Math.max(0, parseInt(mStr, 10) || 0));
  }

  #emitChange() {
    const val = this.value;
    if (this.#hiddenInput) this.#hiddenInput.value = val;
    this.dispatchEvent(new CustomEvent('datetime-change', {
      bubbles: true,
      composed: true,
      detail: { value: val },
    }));
  }

  /* ── Static helpers ─────────────────────────────────────── */

  /** 12-year page for the year grid, anchored so each page starts on a
   *  multiple of 12 (e.g. 2016–2027, 2028–2039). */
  static #yearRange(year: number) {
    const start = year - (((year % 12) + 12) % 12);
    return { start, end: start + 11 };
  }
}

customElements.define('sherpa-date-time-picker', SherpaDateTimePicker);
