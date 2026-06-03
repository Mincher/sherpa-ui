/**
 * @element sherpa-calendar
 * @category utility
 * @description Standalone calendar component for date selection. Supports single
 *   date and date range selection modes. Used by sherpa-input-date,
 *   sherpa-input-date-range, and sherpa-date-time-picker.
 *
 * @attr {string}  [data-value]      — Selected date (ISO format: YYYY-MM-DD)
 * @attr {string}  [data-value-end]  — End date for range selection (ISO format)
 * @attr {string}  [data-min]        — Minimum selectable date (ISO format)
 * @attr {string}  [data-max]        — Maximum selectable date (ISO format)
 * @attr {enum}    [data-mode]       — single | range (default: single)
 * @attr {enum}    [data-view]       — day | month | year (default: day)
 * @attr {string}  [data-view-date]  — Currently displayed month (ISO format, defaults to today)
 *
 * @fires dateselect — Dispatched when a single date is selected
 *   detail: { value: string (ISO), valueAsDate: Date }
 *
 * @fires rangeselect — Dispatched when a date range is selected
 *   detail: { start: string (ISO), end: string (ISO), startAsDate: Date, endAsDate: Date }
 *
 * @fires viewchange — Dispatched when month/year view changes
 *   detail: { viewDate: string (ISO), view: 'day'|'month'|'year' }
 *
 * @slot header — Custom header content (replaces default month/year navigation)
 * @slot footer — Footer content (e.g., action buttons, shortcuts)
 *
 * @csspart header — Calendar header container
 * @csspart month-label — Month/year label
 * @csspart prev-button — Previous month button
 * @csspart next-button — Next month button
 * @csspart weekdays — Weekday header row
 * @csspart days-grid — Calendar days grid
 * @csspart footer — Footer container
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import {
  renderCalendarGrid,
  isoToDate,
  dateToIso,
  MONTH_NAMES,
} from '../utilities/calendar-helper.js';

export class SherpaCalendar extends SherpaElement {
  static override get cssUrl(): string {
    return new URL('./sherpa-calendar.css', import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL('./sherpa-calendar.html', import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-value',
      'data-value-end',
      'data-min',
      'data-max',
      'data-mode',
      'data-view',
      'data-view-date',
    ];
  }

  // ── Private state ──────────────────────────────────────────────────

  #viewDate = new Date(); // Currently displayed month
  #dayTpl: HTMLTemplateElement | null = null;
  #rangeStart: Date | null = null; // For range mode: first selected date

  els = this.cacheElements({
    daysGrid: { selector: '.cal-days', type: HTMLElement }
  });

  // ── Lifecycle ──────────────────────────────────────────────────────

  override onRender(): void {
    this.#dayTpl = this.$<HTMLTemplateElement>('.cal-day-tpl');

    // Initialize view date
    const viewDateIso = this.dataset["viewDate"];
    if (viewDateIso) {
      const parsed = isoToDate(viewDateIso);
      if (parsed) this.#viewDate = parsed;
    } else if (this.dataset["value"]) {
      const parsed = isoToDate(this.dataset["value"]);
      if (parsed) this.#viewDate = parsed;
    }

    // Wire up navigation
    this.$('.cal-prev')?.addEventListener('click', () => this.#prevMonth());
    this.$('.cal-next')?.addEventListener('click', () => this.#nextMonth());
    this.$('.cal-month-label')?.addEventListener('click', () => this.#toggleView());

    this.#render();
  }

  override onAttributeChanged(name: string, _oldValue: string | null, newValue: string | null) {
    if (!this.els.daysGrid) return;

    if (name === 'data-value' || name === 'data-value-end' || name === 'data-mode') {
      this.#render();
    }

    if (name === 'data-view-date') {
      const parsed = isoToDate(newValue);
      if (parsed) {
        this.#viewDate = parsed;
        this.#render();
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Get the selected date as a Date object.
   * @returns {Date|null}
   */
  get valueAsDate() {
    return isoToDate(this.dataset["value"]);
  }

  /**
   * Set the selected date.
   * @param {Date|null} date
   */
  set valueAsDate(date) {
    this.dataset["value"] = dateToIso(date);
  }

  /**
   * Get the selected range as Date objects.
   * @returns {{start: Date|null, end: Date|null}}
   */
  get selectedRange() {
    return {
      start: isoToDate(this.dataset["value"]),
      end: isoToDate(this.dataset["valueEnd"]),
    };
  }

  /**
   * Set the selected range.
   * @param {{start: Date|null, end: Date|null}} range
   */
  set selectedRange(range) {
    this.dataset["value"] = dateToIso(range.start);
    this.dataset["valueEnd"] = dateToIso(range.end);
  }

  /**
   * Navigate to a specific month.
   * @param {Date} date
   */
  goToMonth(date: Date) {
    this.#viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
    this.dataset["viewDate"] = dateToIso(this.#viewDate);
    this.#render();
    this.#dispatchViewChange();
  }

  /**
   * Navigate to today's month.
   */
  goToToday() {
    this.goToMonth(new Date());
  }

  // ── Internal rendering ─────────────────────────────────────────────

  #render() {
    this.#updateMonthLabel();
    this.#renderDays();
  }

  #updateMonthLabel() {
    const label = this.$('.cal-month-label');
    if (!label) return;

    const monthName = MONTH_NAMES[this.#viewDate.getMonth()];
    const year = this.#viewDate.getFullYear();
    label.textContent = `${monthName} ${year}`;
  }

  #renderDays() {
    if (!this.els.daysGrid || !this.#dayTpl) return;

    const mode = this.dataset["mode"] || 'single';
    const selectedIso = this.dataset["value"] || null;
    const selectedEndIso = mode === 'range' ? this.dataset["valueEnd"] || null : null;
    const minIso = this.dataset["min"] || null;
    const maxIso = this.dataset["max"] || null;

    renderCalendarGrid(
      this.els.daysGrid,
      this.#dayTpl,
      this.#viewDate,
      selectedIso,
      selectedEndIso,
      minIso,
      maxIso,
      (iso: string) => this.#handleDayClick(iso),
    );
  }

  #handleDayClick(iso: string) {
    const mode = this.dataset["mode"] || 'single';

    if (mode === 'range') {
      this.#handleRangeSelection(iso);
    } else {
      this.#handleSingleSelection(iso);
    }
  }

  #handleSingleSelection(iso: string) {
    this.dataset["value"] = iso;

    this.dispatchEvent(
      new CustomEvent('dateselect', {
        bubbles: true,
        composed: true,
        detail: {
          value: iso,
          valueAsDate: isoToDate(iso),
        },
      }),
    );
  }

  #handleRangeSelection(iso: string) {
    const clickedDate = isoToDate(iso);

    // If no range start, or clicking before range start, set new start
    if (!this.#rangeStart || (clickedDate && clickedDate < this.#rangeStart)) {
      this.#rangeStart = clickedDate;
      this.dataset["value"] = iso;
      this.dataset["valueEnd"] = '';
      this.#render();
      return;
    }

    // If clicking after range start, complete the range
    const startIso = dateToIso(this.#rangeStart);
    const endIso = iso;

    this.dataset["value"] = startIso;
    this.dataset["valueEnd"] = endIso;
    this.#rangeStart = null;

    this.dispatchEvent(
      new CustomEvent('rangeselect', {
        bubbles: true,
        composed: true,
        detail: {
          start: startIso,
          end: endIso,
          startAsDate: isoToDate(startIso),
          endAsDate: isoToDate(endIso),
        },
      }),
    );
  }

  #prevMonth() {
    this.#viewDate.setMonth(this.#viewDate.getMonth() - 1);
    this.dataset["viewDate"] = dateToIso(this.#viewDate);
    this.#render();
    this.#dispatchViewChange();
  }

  #nextMonth() {
    this.#viewDate.setMonth(this.#viewDate.getMonth() + 1);
    this.dataset["viewDate"] = dateToIso(this.#viewDate);
    this.#render();
    this.#dispatchViewChange();
  }

  #toggleView() {
    // Future: toggle between day/month/year views
    // For now, just a placeholder
    const currentView = this.dataset["view"] || 'day';
    this.dispatchEvent(
      new CustomEvent('viewchange', {
        bubbles: true,
        composed: true,
        detail: {
          viewDate: dateToIso(this.#viewDate),
          view: currentView,
        },
      }),
    );
  }

  #dispatchViewChange() {
    this.dispatchEvent(
      new CustomEvent('viewchange', {
        bubbles: true,
        composed: true,
        detail: {
          viewDate: dateToIso(this.#viewDate),
          view: this.dataset["view"] || 'day',
        },
      }),
    );
  }
}

customElements.define('sherpa-calendar', SherpaCalendar);
