/**
 * sherpa-scheduler — a recurrence / frequency picker.
 *
 * A frequency <select> (the composed sherpa-input-select) drives which sub-fields
 * are shown; CSS owns that conditional visibility off data-frequency. The
 * component reads the visible fields into a schedule payload and emits
 * schedule-change on any change. Sub-fields are native inputs plus the composed
 * sherpa-input-number for interval / day-of-month.
 *
 * The frequency select's `change` is a composed CustomEvent, so its originating
 * element is read off event.composedPath() (event.target is retargeted to the
 * host at the shadow boundary). Native sub-field inputs live in this same shadow
 * tree, so their `change`/`input` targets are read directly.
 *
 * @fires schedule-change — detail: { value: SchedulePayload }
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-input-select/sherpa-input-select.js';
import '../sherpa-input-number/sherpa-input-number.js';

/** The complete schedule the user has configured. */
export interface SchedulePayload {
  frequency: string;
  date?: string;
  time?: string;
  interval?: number;
  weekdays?: string[];
  dayOfMonth?: number;
}

/** A composed child exposing a string value (input-select / input-number). */
type ValueChild = HTMLElement & { value: string };

/** The frequency select: value + the base populate/rendered surface. */
type FreqSelect = ValueChild & { populate: (data: unknown) => void; rendered: Promise<void> };

const FREQUENCIES = [
  { value: 'once', label: 'Once' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export class SherpaScheduler extends SherpaElement {
  static override css = new URL('./sherpa-scheduler.css', import.meta.url);
  static override html = new URL('./sherpa-scheduler.html', import.meta.url);
  static override observed = ['data-frequency'];

  #value: SchedulePayload = { frequency: 'weekly' };

  override onRender(): void {
    if (!this.dataset['frequency']) this.dataset['frequency'] = 'weekly';

    const freq = this.$<FreqSelect>('.freq-select');
    if (freq) {
      // input-select stamps its <option>s from populate(), then honours value.
      freq.populate(FREQUENCIES);
      void freq.rendered.then(() => {
        freq.value = this.dataset['frequency'] ?? 'weekly';
      });
    }

    // Frequency change (composed) → swap fields. Field changes → re-read + emit.
    this.$('.fields')?.addEventListener('change', this.#onChange);
    this.$('.fields')?.addEventListener('input', this.#onChange);

    this.#read();
  }

  override onChange(name: string): void {
    if (name === 'data-frequency') {
      this.#value.frequency = this.dataset['frequency'] ?? 'weekly';
      this.#read();
    }
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  get value(): SchedulePayload {
    return { ...this.#value };
  }
  set value(v: SchedulePayload) {
    if (!v || typeof v !== 'object') return;
    this.#value = { ...v };
    if (v.frequency) this.dataset['frequency'] = v.frequency;
    this.#write();
  }

  /* ── Change handling ───────────────────────────────────────────────── */

  #onChange = (event: Event): void => {
    // The frequency select is a composed custom element — find it on the path,
    // not via event.target (which is retargeted to the host).
    const freq = event
      .composedPath()
      .find(
        (n): n is ValueChild =>
          n instanceof HTMLElement && n.classList.contains('freq-select'),
      );
    if (freq) {
      this.dataset['frequency'] = freq.value || 'weekly';
      // data-frequency change re-reads via onChange; still emit for the switch.
    }
    this.#read();
    this.emit('schedule-change', { value: this.value });
  };

  /* ── Sync helpers ──────────────────────────────────────────────────── */

  #str(sel: string): string {
    const el = this.$<ValueChild | HTMLInputElement>(sel);
    return el?.value ?? '';
  }

  #read(): void {
    const frequency = this.dataset['frequency'] ?? 'weekly';
    const value: SchedulePayload = { frequency };

    if (frequency === 'once') {
      value.date = this.#str('.date-once');
      value.time = this.#str('.time-once');
    } else if (frequency === 'hourly') {
      value.interval = Number(this.#str('.hourly-interval')) || 1;
    } else if (frequency === 'daily') {
      value.time = this.#str('.time-of-day');
    } else if (frequency === 'weekly') {
      value.time = this.#str('.time-of-day');
      value.weekdays = this.$$<HTMLInputElement>('.weekday-input')
        .filter((i) => i.checked)
        .map((i) => i.value);
    } else if (frequency === 'monthly') {
      value.time = this.#str('.time-of-day');
      value.dayOfMonth = Number(this.#str('.monthly-day')) || 1;
    }

    this.#value = value;
  }

  #write(): void {
    const v = this.#value;
    const set = (sel: string, val: string | undefined): void => {
      const el = this.$<ValueChild | HTMLInputElement>(sel);
      if (el && val != null) el.value = val;
    };
    if (v.date != null) set('.date-once', v.date);
    if (v.time != null) {
      set('.time-once', v.time);
      set('.time-of-day', v.time);
    }
    if (v.interval != null) set('.hourly-interval', String(v.interval));
    if (v.dayOfMonth != null) set('.monthly-day', String(v.dayOfMonth));
    if (Array.isArray(v.weekdays)) {
      const wanted = new Set(v.weekdays);
      for (const box of this.$$<HTMLInputElement>('.weekday-input')) {
        box.checked = wanted.has(box.value);
      }
    }
  }
}

customElements.define('sherpa-scheduler', SherpaScheduler);
