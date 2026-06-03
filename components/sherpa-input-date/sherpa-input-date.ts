/**
 * @element sherpa-input-date
 * @category input
 * @extends SherpaInputBase
 * @description Typeable date input with an accessible calendar picker popup.
 *   The visible <input type="text"> owns the form value (YYYY-MM-DD) and
 *   inherits all label/description/helper/validation chrome from
 *   SherpaInputBase. A trailing calendar-icon button opens a custom popup
 *   for visual date selection. Typed values are validated against optional
 *   min / max via setCustomValidity().
 *
 * @attr {string}  [min] — Minimum selectable date (YYYY-MM-DD)
 * @attr {string}  [max] — Maximum selectable date (YYYY-MM-DD)
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @prop {string}    min         — Getter/setter for min attribute
 * @prop {string}    max         — Getter/setter for max attribute
 * @prop {Date|null} valueAsDate — Current value as Date object (getter-only)
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';
import {
  MONTH_NAMES,
  isoToDate,
  renderCalendarGrid,
} from '../utilities/calendar-helper.js';

/* ── Dataset Interface ─────────────────────────────────────────── */

interface SherpaInputDateDataset extends DOMStringMap {
  label?: string;
  description?: string;
  helper?: string;
  layout?: 'horizontal' | 'vertical';
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns true when `iso` is a real calendar date in YYYY-MM-DD form. */
// @ts-expect-error - TODO: Fix type
function isValidIso(iso) {
  if (!ISO_RE.test(iso)) return false;
  const d = isoToDate(iso);
  if (!d) return false;
  const [y, m, day] = iso.split('-').map(Number);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
}

export class SherpaInputDate extends SherpaInputBase {

  override get dataset(): SherpaInputDateDataset {
    return super.dataset as SherpaInputDateDataset;
  }

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
  #viewDate = new Date();

  /** Bound handler stored for removeEventListener. */
  #onDocClick = (e: Event) => {
    if (!e.composedPath().includes(this)) this.#close();
  };

  #onDocKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.#close();
  };

  /* ── Lifecycle ──────────────────────────────────────────────── */

  override onInputRender(): void {
    // @ts-expect-error - TODO: Fix type
    this.els.trigger   = this.$('.picker-trigger');
    // @ts-expect-error - TODO: Fix type
    this.els.popup     = this.$('.picker-popup');
    // @ts-expect-error - TODO: Fix type
    this.els.monthYear = this.$('.cal-month-year');
    // @ts-expect-error - TODO: Fix type
    this.els.daysGrid  = this.$('.cal-days');
    // @ts-expect-error - TODO: Fix type
    this.els.dayTpl      = this.$('.cal-day-tpl');

    // Initialise view month from current value (or today)
    const inputEl = this.getInputElement();
    const val = inputEl?.value || '';
    const d   = isoToDate(val) || new Date();
    this.#viewDate = new Date(d.getFullYear(), d.getMonth(), 1);

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
            this.#viewDate = new Date(td.getFullYear(), td.getMonth(), 1);
            if (this.hasAttribute('data-open')) this.#renderCalendar();
          }
        }
      });
    }

    // Month navigation
    // @ts-expect-error - TODO: Fix type
    this.$('.cal-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      this.#viewDate = new Date(
        this.#viewDate.getFullYear(),
        this.#viewDate.getMonth() - 1,
        1,
      );
      this.#renderCalendar();
    });

    // @ts-expect-error - TODO: Fix type
    this.$('.cal-next').addEventListener('click', (e) => {
      e.stopPropagation();
      this.#viewDate = new Date(
        this.#viewDate.getFullYear(),
        this.#viewDate.getMonth() + 1,
        1,
      );
      this.#renderCalendar();
    });

    // Calendar-icon button toggles the popup
    // @ts-expect-error - TODO: Fix type
    this.els.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.hasAttribute('disabled') || this.hasAttribute('readonly')) return;
      this.hasAttribute('data-open') ? this.#close() : this.#open();
    });
  }

  override onInputConnect(): void {
    document.addEventListener('click',   this.#onDocClick);
    document.addEventListener('keydown', this.#onDocKey);
  }

  override onInputDisconnect(): void {
    document.removeEventListener('click',   this.#onDocClick);
    document.removeEventListener('keydown', this.#onDocKey);
  }

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
      if (d) this.#viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
      if (this.els.daysGrid) this.#renderCalendar();
    }
  }

  /* ── Open / Close ───────────────────────────────────────────── */

  #open() {
    // Snap view to selected date's month before opening
    const val = this.getInputElement()?.value;
    if (val) {
      const d = isoToDate(val);
      if (d) this.#viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
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
      `${MONTH_NAMES[this.#viewDate.getMonth()]} ${this.#viewDate.getFullYear()}`;

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

  // @ts-expect-error - TODO: Fix type
  #selectDate(iso) {
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

  /** Returns the current value as a Date object, or null. */
  get valueAsDate() {
    const v = this.value;
    if (!v || !isValidIso(v)) return null;
    const d = new Date(v + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
}

customElements.define('sherpa-input-date', SherpaInputDate);
