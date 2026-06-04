/**
 * @element sherpa-input-time
 * @category input
 * @extends SherpaInputBase
 * @description Time input with hour / minute spinner popup.
 *   Inherits label, description, helper, layout, validation from SherpaInputBase.
 *   The native <input type="time"> remains in the DOM (hidden) so that form
 *   value, constraint validation (min / max / required / step), and focus
 *   management all delegate to the browser.
 *
 * @attr {string}  [min]  — Minimum selectable time (HH:MM)
 * @attr {string}  [max]  — Maximum selectable time (HH:MM)
 * @attr {number}  [step] — Step increment in seconds (default 60)
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @prop {string} min  — Getter/setter for min attribute
 * @prop {string} max  — Getter/setter for max attribute
 * @prop {string} step — Getter/setter for step attribute
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';

export class SherpaInputTime extends SherpaInputBase {

  static override get cssUrl(): string  { return new URL('./sherpa-input-time.css',  import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-input-time.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'min', 'max', 'step'];
  }

  /* ── Private state ──────────────────────────────────────────── */

  els = this.cacheElements({
    trigger: { selector: '.picker-trigger', type: HTMLButtonElement },
    popup: '.picker-popup',
    hourVal: '.hour-val',
    minuteVal: '.minute-val'
  });

  /** Current hours value (0–23). -1 means no selection. */
  #hours   = -1;
  /** Current minutes value (0–59). -1 means no selection. */
  #minutes = -1;

  protected override _popupClose() { this.#close(); }
  protected override _popupOpen()  { this.#open(); }

  /* ── Lifecycle ──────────────────────────────────────────────── */

  override onInputRender(): void {

    // Parse initial value
    this.#parseNativeValue();
    this.#syncTrigger();
    this.#syncSpinners();

    this._wireTriggerToggle(this.els.trigger ?? null);

    // Hour spinner buttons
    this.$('.hour-up')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#adjustHour(+1);
    });
    this.$('.hour-down')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#adjustHour(-1);
    });

    // Minute spinner buttons
    this.$('.minute-up')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#adjustMinute(+1);
    });
    this.$('.minute-down')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#adjustMinute(-1);
    });
  }

  override onInputConnect(): void    { this._attachPopupListeners(); }
  override onInputDisconnect(): void { this._detachPopupListeners(); }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    super.onAttributeChanged(name, oldValue, newValue);

    if (['min', 'max', 'step'].includes(name)) {
      const el = this.getInputElement();
      if (el) {
        newValue !== null
          ? el.setAttribute(name, newValue)
          : el.removeAttribute(name);
      }
    }

    if (name === 'value') {
      this.#parseNativeValue();
      this.#syncTrigger();
      this.#syncSpinners();
    }
  }

  /* ── Open / Close ───────────────────────────────────────────── */

  #open() {
    this.#parseNativeValue();
    this.#syncSpinners();
    this.setAttribute('data-open', '');
    this.els.trigger?.setAttribute('aria-expanded', 'true');
  }

  #close() {
    this.removeAttribute('data-open');
    this.els.trigger?.setAttribute('aria-expanded', 'false');
  }

  /* ── Spinner adjustments ────────────────────────────────────── */

  #adjustHour(delta: number) {
    const current = this.#hours < 0 ? 0 : this.#hours;
    this.#hours   = ((current + delta) + 24) % 24;
    if (this.#minutes < 0) this.#minutes = 0;
    this.#commitTime();
  }

  #adjustMinute(delta: number) {
    const step    = this.#minuteStepSize;
    const current = this.#minutes < 0 ? 0 : this.#minutes;
    this.#minutes = ((current + delta * step) + 60) % 60;
    if (this.#hours < 0) this.#hours = 0;
    this.#commitTime();
  }

  /** Minute increment derived from the step attribute (seconds → minutes, min 1). */
  get #minuteStepSize() {
    const stepSec = parseInt(this.getAttribute('step') || '60', 10);
    return Math.max(1, Math.floor(stepSec / 60));
  }

  /* ── Value sync ─────────────────────────────────────────────── */

  /** Parse current native input value into #hours / #minutes. */
  #parseNativeValue() {
    const val = this.getInputElement()?.value || '';
    if (!val) {
      this.#hours   = -1;
      this.#minutes = -1;
      return;
    }
    const parts = val.split(':');
    this.#hours   = parseInt(parts[0] || '0', 10);
    this.#minutes = parseInt(parts[1] || '0', 10);
  }

  /** Write #hours / #minutes to the native input and fire events. */
  #commitTime() {
    const h = String(this.#hours  ).padStart(2, '0');
    const m = String(this.#minutes).padStart(2, '0');
    const timeStr = `${h}:${m}`;

    const nativeInput = this.getInputElement();
    if (!nativeInput) return;

    nativeInput.value = timeStr;
    nativeInput.dispatchEvent(new Event('change', { bubbles: false }));

    this.#syncSpinners();
    this.#syncTrigger();
  }

  /** Update the spinner display spans from #hours / #minutes. */
  #syncSpinners() {
    if (this.els.hourVal) {
      this.els.hourVal.textContent =
        this.#hours >= 0 ? String(this.#hours).padStart(2, '0') : '--';
    }
    if (this.els.minuteVal) {
      this.els.minuteVal.textContent =
        this.#minutes >= 0 ? String(this.#minutes).padStart(2, '0') : '--';
    }
  }

  /** Update trigger display text and data-has-value attribute. */
  #syncTrigger() {
    const val    = this.getInputElement()?.value || '';
    const textEl = this.$('.trigger-text');
    if (textEl) textEl.textContent = SherpaInputTime.#formatTime(val);

    if (val) {
      this.dataset["hasValue"] = '';
    } else {
      delete this.dataset["hasValue"];
    }
  }

  /**
   * Format a "HH:MM" or "HH:MM:SS" string for display.
   * Returns zero-padded "HH:MM", or '' for empty input.
   * @param {string} timeStr
   * @returns {string}
   */
  static #formatTime(timeStr: string | null | undefined) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    return `${parts[0]!.padStart(2, '0')}:${parts[1]!.padStart(2, '0')}`;
  }

  /* ── Public API ─────────────────────────────────────────────── */

  get min()  { return this.getAttribute('min');  }
  set min(v) { v != null ? this.setAttribute('min',  v) : this.removeAttribute('min');  }

  get max()  { return this.getAttribute('max');  }
  set max(v) { v != null ? this.setAttribute('max',  v) : this.removeAttribute('max');  }

  get step() { return this.getAttribute('step'); }
  set step(v) { v != null ? this.setAttribute('step', v) : this.removeAttribute('step'); }
}

customElements.define('sherpa-input-time', SherpaInputTime);

