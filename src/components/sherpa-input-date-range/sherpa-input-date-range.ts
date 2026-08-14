/**
 * sherpa-input-date-range — a start/end date range field.
 *
 * Two native date inputs in the field chrome. JS mirrors label/description/error
 * text, cross-binds the two controls (start.max = end, end.min = start) so the
 * pickers can't select an inverted range, exposes value as { start, end }, and
 * re-dispatches change. All presentation is CSS.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface DateRange {
  start: string;
  end: string;
}

export class SherpaInputDateRange extends SherpaElement {
  static override css = new URL('./sherpa-input-date-range.css', import.meta.url);
  static override html = new URL('./sherpa-input-date-range.html', import.meta.url);
  static override observed = [
    'data-label',
    'data-description',
    'data-error',
    'data-start',
    'data-end',
    'data-min',
    'data-max',
    'disabled',
    'required',
  ];

  #start: HTMLInputElement | null = null;
  #end: HTMLInputElement | null = null;

  override onRender(): void {
    this.#start = this.$<HTMLInputElement>('.control.start');
    this.#end = this.$<HTMLInputElement>('.control.end');
    this.#syncText();
    this.#syncAttrs();
    this.#start?.addEventListener('change', this.#onChange);
    this.#end?.addEventListener('change', this.#onChange);
  }

  override onChange(name: string): void {
    if (name.startsWith('data-') && !name.startsWith('data-start') && !name.startsWith('data-end') &&
        name !== 'data-min' && name !== 'data-max') {
      this.#syncText();
    } else {
      this.#syncAttrs();
    }
  }

  #syncText(): void {
    const set = (sel: string, v: string | undefined): void => {
      const el = this.$(sel);
      if (el) el.textContent = v ?? '';
    };
    set('.label', this.dataset['label']);
    set('.description', this.dataset['description']);
    set('.message', this.dataset['error']);
  }

  #syncAttrs(): void {
    const s = this.#start;
    const e = this.#end;
    if (!s || !e) return;
    if (this.dataset['start'] != null) s.value = this.dataset['start'] ?? '';
    if (this.dataset['end'] != null) e.value = this.dataset['end'] ?? '';
    const min = this.dataset['min'];
    const max = this.dataset['max'];
    for (const c of [s, e]) {
      c.toggleAttribute('disabled', this.hasAttribute('disabled'));
      c.toggleAttribute('required', this.hasAttribute('required'));
      if (min) c.min = min; else c.removeAttribute('min');
      if (max) c.max = max; else c.removeAttribute('max');
    }
    this.#crossBind();
  }

  /** Keep the two controls from crossing: start ≤ end. */
  #crossBind(): void {
    const s = this.#start;
    const e = this.#end;
    if (!s || !e) return;
    if (e.value) s.max = e.value;
    else if (this.dataset['max']) s.max = this.dataset['max'] ?? '';
    if (s.value) e.min = s.value;
    else if (this.dataset['min']) e.min = this.dataset['min'] ?? '';
  }

  get value(): DateRange {
    return { start: this.#start?.value ?? '', end: this.#end?.value ?? '' };
  }
  set value(range: DateRange) {
    if (this.#start) this.#start.value = range.start ?? '';
    if (this.#end) this.#end.value = range.end ?? '';
    this.#crossBind();
  }

  #onChange = (): void => {
    this.#crossBind();
    this.emit('change', this.value);
  };
}

customElements.define('sherpa-input-date-range', SherpaInputDateRange);
