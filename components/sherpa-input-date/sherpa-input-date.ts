/**
 * @element sherpa-input-date
 * @category input
 * @extends SherpaInputBase
 * @description Date field with a typeable text input and a calendar picker popup. Use for
 *   single-date form fields; the value format is always YYYY-MM-DD. The calendar popup opens
 *   via the trailing icon button and validates against optional min/max constraints. For date
 *   ranges use sherpa-input-date-range. For a standalone calendar panel not embedded in a
 *   form field, use sherpa-calendar.
 *
 * @attr {string}  min — Minimum selectable date (YYYY-MM-DD)
 * @attr {string}  max — Maximum selectable date (YYYY-MM-DD)
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @prop {string}                  min         — Getter/setter for min attribute
 * @prop {string}                  max         — Getter/setter for max attribute
 * @prop {Temporal.PlainDate|null} valueAsDate — Current value as PlainDate (getter-only)
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';
import {
  MONTH_NAMES,
  isoToDate,
  renderCalendarGrid,
} from '../utilities/calendar-helper.js';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns true when `iso` is a real calendar date in YYYY-MM-DD form. */
function isValidIso(iso: string): boolean {
  if (!ISO_RE.test(iso)) return false;
  return isoToDate(iso) !== null;
}

export class SherpaInputDate extends SherpaInputBase {

  static override get cssUrl(): string  { return new URL('./sherpa-input-date.css',  import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-input-date.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'min', 'max'];
  }

  /* ── Private state ──────────────────────────────────────────── */

  els = this.cacheElements({
    trigger: { selector: '.picker-trigger', type: HTMLButtonElement },
    popup: '.picker-popup',
    monthYear: '.cal-month-year',
    daysGrid: { selector: '.cal-days', type: HTMLElement },
    dayTpl: { selector: '.day-tpl', type: HTMLTemplateElement }
  });

  /** Month / year currently displayed in the calendar. */
  #viewDate = Temporal.Now.plainDateISO().with({ day: 1 });

  protected override _popupClose() { this.#close(); }
  protected override _popupOpen()  { this.#open(); }

  /* ── Lifecycle ──────────────────────────────────────────────── */

  override onInputRender(): void {
    // Initialise view month from current value (or today)
    const inputEl = this.getInputElement();
    const val = inputEl?.value || '';
    const d = isoToDate(val);
    this.#viewDate = (d || Temporal.Now.plainDateISO()).with({ day: 1 });

    this.#syncHasValue();
    this.#applyCustomValidity();
    this.#renderCalendar();

    // Validate (& re-snap calendar view) when the user types
    if (inputEl) {
      inputEl.addEventListener('input', () => {
        this.#syncHasValue();
        this.#applyCustomValidity();
        const typed = inputEl.value;
        if (isValidIso(typed)) {
          const td = isoToDate(typed);
          if (td) {
            this.#viewDate = td.with({ day: 1 });
            if (this.hasAttribute('data-open')) this.#renderCalendar();
          }
        }
      });
    }

    // Month navigation
    this.$('.cal-prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#viewDate = this.#viewDate.subtract({ months: 1 });
      this.#renderCalendar();
    });

    this.$('.cal-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#viewDate = this.#viewDate.add({ months: 1 });
      this.#renderCalendar();
    });

    this._wireTriggerToggle(this.els.trigger ?? null);
  }

  override onInputConnect(): void    { this._attachPopupListeners(); }
  override onInputDisconnect(): void { this._detachPopupListeners(); }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    super.onAttributeChanged(name, oldValue, newValue);

    if (name === 'min' || name === 'max') {
      this.#applyCustomValidity();
      if (this.els.daysGrid) this.#renderCalendar();
    }

    // Sync calendar view whenever the value attribute is changed externally
    if (name === 'value') {
      this.#syncHasValue();
      this.#applyCustomValidity();
      const d = isoToDate(newValue);
      if (d) this.#viewDate = d.with({ day: 1 });
      if (this.els.daysGrid) this.#renderCalendar();
    }
  }

  /* ── Open / Close ───────────────────────────────────────────── */

  #open() {
    // Snap view to selected date's month before opening
    const val = this.getInputElement()?.value;
    if (val) {
      const d = isoToDate(val);
      if (d) this.#viewDate = d.with({ day: 1 });
    }
    this.#renderCalendar();
    this.setAttribute('data-open', '');
    this.els.trigger?.setAttribute('aria-expanded', 'true');
  }

  #close() {
    this.removeAttribute('data-open');
    this.els.trigger?.setAttribute('aria-expanded', 'false');
  }

  /* ── Calendar rendering ─────────────────────────────────────── */

  #renderCalendar() {
    if (!this.els.monthYear || !this.els.daysGrid || !this.els.dayTpl) return;

    this.els.monthYear.textContent =
      `${MONTH_NAMES[this.#viewDate.month - 1]} ${this.#viewDate.year}`;

    const current = this.getInputElement()?.value || '';
    const selected = isValidIso(current) ? current : null;

    renderCalendarGrid(
      this.els.daysGrid,
      this.els.dayTpl,
      this.#viewDate,
      selected,
      null,
      this.getAttribute('min'),
      this.getAttribute('max'),
      (iso) => this.#selectDate(iso),
    );
  }

  /* ── Date selection ─────────────────────────────────────────── */

  #selectDate(iso: string) {
    const inputEl = this.getInputElement();
    if (!inputEl) return;

    inputEl.value = iso;
    this.#syncHasValue();
    this.#applyCustomValidity();
    // Notify base class (wired on the input in onConnect)
    inputEl.dispatchEvent(new Event('input', { bubbles: false }));
    inputEl.dispatchEvent(new Event('change', { bubbles: false }));
    this.#close();
  }

  /* ── Helpers ────────────────────────────────────────────────── */

  #syncHasValue() {
    const v = this.getInputElement()?.value || '';
    if (v) this.dataset["hasValue"] = '';
    else   delete this.dataset["hasValue"];
  }

  /** Validates typed value against ISO format + min / max, via setCustomValidity. */
  #applyCustomValidity() {
    const el = this.getInputElement();
    if (!el || typeof el.setCustomValidity !== 'function') return;

    const v = el.value || '';
    if (!v) { el.setCustomValidity(''); return; }

    if (!isValidIso(v)) {
      el.setCustomValidity('Please enter a date in YYYY-MM-DD format.');
      return;
    }

    const min = this.getAttribute('min');
    const max = this.getAttribute('max');
    if (min && isValidIso(min) && v < min) {
      el.setCustomValidity(`Date must be on or after ${min}.`);
      return;
    }
    if (max && isValidIso(max) && v > max) {
      el.setCustomValidity(`Date must be on or before ${max}.`);
      return;
    }
    el.setCustomValidity('');
  }

  /* ── Public API ─────────────────────────────────────────────── */

  get min() { return this.getAttribute('min'); }
  set min(v) { v != null ? this.setAttribute('min', v) : this.removeAttribute('min'); }

  get max() { return this.getAttribute('max'); }
  set max(v) { v != null ? this.setAttribute('max', v) : this.removeAttribute('max'); }

  /** Returns the current value as a Temporal.PlainDate, or null. */
  get valueAsDate(): Temporal.PlainDate | null {
    const v = this.value;
    if (!v || !isValidIso(v)) return null;
    return isoToDate(v);
  }
}

customElements.define('sherpa-input-date', SherpaInputDate);
