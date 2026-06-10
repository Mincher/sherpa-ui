/**
 * @element sherpa-scheduler
 * @category data
 * @description Recurrence and schedule configuration picker. Use in forms where the user defines
 *   when and how often something runs (report delivery, task execution, notification timing).
 *   Composes frequency, date, time, weekday, and interval inputs; CSS owns all conditional row
 *   visibility so only the relevant inputs appear for the selected frequency. Read the complete
 *   schedule via the value property as a SchedulePayload object.
 *
 * @attr {enum}   data-frequency=weekly once | hourly | daily | weekly | monthly
 *
 * @fires schedule-change
 *   bubbles: true, composed: true
 *   detail: { value: SchedulePayload }
 *
 * @prop {object} value   — Current schedule object (getter/setter)
 *
 * @typedef {Object} SchedulePayload
 * @property {string}   frequency
 * @property {string}  [date]      ISO date when frequency=once
 * @property {string}  [time]      HH:mm when frequency in {once,daily,weekly,monthly}
 * @property {number}  [interval]  Hour interval when frequency=hourly
 * @property {string[]}[weekdays]  Selected weekday values (1-7) when frequency=weekly
 * @property {number}  [dayOfMonth]Day-of-month (1-31) when frequency=monthly
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-input-select/sherpa-input-select.js';

/** Current schedule payload exposed via the host `value` property. */
interface SchedulePayload {
  frequency: string;
  date?: string;
  time?: string;
  interval?: number;
  weekdays?: string[];
  dayOfMonth?: number;
}

/** A nested input element exposing a value (string for most, string[] for groups). */
type ValueEl = Element & { value?: string | string[] };
import '../sherpa-input-date/sherpa-input-date.js';
import '../sherpa-input-time/sherpa-input-time.js';
import '../sherpa-input-number/sherpa-input-number.js';
import '../sherpa-select-group/sherpa-select-group.js';

export class SherpaScheduler extends SherpaElement {
  static override get cssUrl(): string  { return new URL('./sherpa-scheduler.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-scheduler.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-frequency'];
  }

  #value: SchedulePayload = { frequency: 'weekly' };

  /* ── lifecycle ─────────────────────────────────────────── */

  override onRender(): void {
    if (!this.dataset["frequency"]) this.dataset["frequency"] = 'weekly';

    const freq = this.$('.freq-select') as (Element & { value?: string }) | null;
    if (freq) {
      freq.value = this.dataset["frequency"];
      freq.addEventListener('change', this.#onFrequencyChange);
    }

    const inputs = [
      '.date-once', '.time-once', '.hourly-interval',
      '.time-of-day', '.weekday-group', '.monthly-day',
    ];
    for (const sel of inputs) {
      this.$(sel)?.addEventListener('change', this.#onInputChange);
    }

    this.#readFromInputs();
  }

  override onAttributeChanged(name: string) {
    if (name === 'data-frequency') {
      this.#value.frequency = this.dataset["frequency"] || 'weekly';
      this.#readFromInputs();
    }
  }

  /* ── public api ────────────────────────────────────────── */

  get value() { return { ...this.#value }; }
  set value(v: SchedulePayload) {
    if (!v || typeof v !== 'object') return;
    this.#value = { ...v };
    if (v.frequency) this.dataset["frequency"] = v.frequency;
    this.#writeToInputs();
  }

  /* ── handlers ──────────────────────────────────────────── */

  #onFrequencyChange = (e: Event) => {
    const next = (e.target as HTMLSelectElement | null)?.value || 'weekly';
    this.dataset["frequency"] = next;
  };

  #onInputChange = () => {
    this.#readFromInputs();
    this.emit('schedule-change', { value: this.value });
  };

  /* ── sync helpers ──────────────────────────────────────── */

  #readFromInputs() {
    const freq = this.dataset["frequency"] || 'weekly';
    const value: SchedulePayload = { frequency: freq };

    const getStr = (sel: string): string => {
      const v = (this.$(sel) as ValueEl | null)?.value;
      return typeof v === 'string' ? v : '';
    };

    if (freq === 'once') {
      value.date = getStr('.date-once');
      value.time = getStr('.time-once');
    } else if (freq === 'hourly') {
      value.interval = Number(getStr('.hourly-interval')) || 1;
    } else if (freq === 'daily') {
      value.time = getStr('.time-of-day');
    } else if (freq === 'weekly') {
      value.time = getStr('.time-of-day');
      const wgVal = (this.$('.weekday-group') as ValueEl | null)?.value;
      value.weekdays = Array.isArray(wgVal) ? wgVal : [];
    } else if (freq === 'monthly') {
      value.time = getStr('.time-of-day');
      value.dayOfMonth = Number(getStr('.monthly-day')) || 1;
    }

    this.#value = value;
  }

  #writeToInputs() {
    const v = this.#value;
    const set = (sel: string, val: string | string[]) => {
      const el = this.$(sel) as ValueEl | null;
      if (el && val != null) el.value = val;
    };
    if (v.date != null)        set('.date-once', v.date);
    if (v.time != null) {
      set('.time-once',   v.time);
      set('.time-of-day', v.time);
    }
    if (v.interval != null)    set('.hourly-interval', String(v.interval));
    if (v.dayOfMonth != null)  set('.monthly-day', String(v.dayOfMonth));
    if (Array.isArray(v.weekdays)) {
      const wg = this.$('.weekday-group') as ValueEl | null;
      if (wg) wg.value = v.weekdays;
    }
  }
}

customElements.define('sherpa-scheduler', SherpaScheduler);
