/**
 * @element sherpa-scheduler
 * @description Recurrence/schedule picker. Composes sherpa-input-select
 *   (frequency), sherpa-input-date, sherpa-input-time,
 *   sherpa-input-checkbox-group (weekdays template), sherpa-input-number.
 *
 *   CSS owns all conditional row visibility via :host([data-frequency]).
 *   JS only translates between the inner inputs and the host's `value`.
 *
 * @attr {enum}   [data-frequency=weekly] once | hourly | daily | weekly | monthly
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
import '../sherpa-input-date/sherpa-input-date.js';
import '../sherpa-input-time/sherpa-input-time.js';
import '../sherpa-input-number/sherpa-input-number.js';
import '../sherpa-input-checkbox-group/sherpa-input-checkbox-group.js';

export class SherpaScheduler extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-scheduler.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-scheduler.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-frequency'];
  }

  /** @type {SchedulePayload} */
  #value = { frequency: 'weekly' };

  /* ── lifecycle ─────────────────────────────────────────── */

  onRender() {
    if (!this.dataset.frequency) this.dataset.frequency = 'weekly';

    const freq = this.$('.freq-select');
    if (freq) {
      freq.value = this.dataset.frequency;
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

  onAttributeChanged(name) {
    if (name === 'data-frequency') {
      this.#value.frequency = this.dataset.frequency || 'weekly';
      this.#readFromInputs();
    }
  }

  /* ── public api ────────────────────────────────────────── */

  get value() { return { ...this.#value }; }
  set value(v) {
    if (!v || typeof v !== 'object') return;
    this.#value = { ...v };
    if (v.frequency) this.dataset.frequency = v.frequency;
    this.#writeToInputs();
  }

  /* ── handlers ──────────────────────────────────────────── */

  #onFrequencyChange = (e) => {
    const next = e.target?.value || 'weekly';
    this.dataset.frequency = next;
  };

  #onInputChange = () => {
    this.#readFromInputs();
    this.dispatchEvent(new CustomEvent('schedule-change', {
      bubbles: true, composed: true, detail: { value: this.value },
    }));
  };

  /* ── sync helpers ──────────────────────────────────────── */

  #readFromInputs() {
    const freq = this.dataset.frequency || 'weekly';
    const value = { frequency: freq };

    const get = (sel) => this.$(sel)?.value;

    if (freq === 'once') {
      value.date = get('.date-once') || '';
      value.time = get('.time-once') || '';
    } else if (freq === 'hourly') {
      value.interval = Number(get('.hourly-interval')) || 1;
    } else if (freq === 'daily') {
      value.time = get('.time-of-day') || '';
    } else if (freq === 'weekly') {
      value.time = get('.time-of-day') || '';
      const wg = this.$('.weekday-group');
      value.weekdays = Array.isArray(wg?.value) ? wg.value : [];
    } else if (freq === 'monthly') {
      value.time = get('.time-of-day') || '';
      value.dayOfMonth = Number(get('.monthly-day')) || 1;
    }

    this.#value = value;
  }

  #writeToInputs() {
    const v = this.#value;
    const set = (sel, val) => { const el = this.$(sel); if (el && val != null) el.value = val; };
    if (v.date != null)        set('.date-once', v.date);
    if (v.time != null) {
      set('.time-once',   v.time);
      set('.time-of-day', v.time);
    }
    if (v.interval != null)    set('.hourly-interval', v.interval);
    if (v.dayOfMonth != null)  set('.monthly-day', v.dayOfMonth);
    if (Array.isArray(v.weekdays)) {
      const wg = this.$('.weekday-group');
      if (wg) wg.value = v.weekdays;
    }
  }
}

customElements.define('sherpa-scheduler', SherpaScheduler);
