/**
 * sherpa-input-checkbox.js
 * SherpaInputCheckbox — Atomic checkbox primitive.
 *
 * Single checkbox with label-on-the-right. Designed for both standalone
 * use (e.g. "I accept the terms") and as a child of `sherpa-input-checkbox-group`.
 *
 * @element sherpa-input-checkbox
 * @category input
 *
 * @attr {string}  [name]             — Form field name
 * @attr {string}  [value]            — Submitted value when checked (default "on")
 * @attr {boolean} [checked]          — Initial / current checked state
 * @attr {boolean} [indeterminate]    — Mixed state (overrides checked visually)
 * @attr {boolean} [disabled]         — Disabled state
 * @attr {boolean} [required]         — Required constraint
 * @attr {string}  [data-label]       — Inline label text
 * @attr {string}  [data-description] — Helper line below the label
 * @attr {enum}    [data-status]      — critical | warning | success | info | urgent
 *
 * @fires change — User toggled the checkbox.
 *   bubbles: true, composed: true
 *   detail: { checked: boolean, value: string, indeterminate: boolean }
 *
 * @prop {boolean} checked       — Read/write checked state
 * @prop {boolean} indeterminate — Read/write indeterminate state
 * @prop {string}  value         — Submitted value
 *
 * @method focus() — Move focus to the underlying native input.
 */

import { SherpaInputChoiceBase } from '../utilities/sherpa-input-choice/sherpa-input-choice-base.js';

export class SherpaInputCheckbox extends SherpaInputChoiceBase {

  static override get cssUrl(): string  { return new URL('./sherpa-input-checkbox.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-input-checkbox.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'indeterminate'];
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get indeterminate()  { return this.hasAttribute('indeterminate'); }
  set indeterminate(v) {
    v ? this.setAttribute('indeterminate', '') : this.removeAttribute('indeterminate');
  }

  get value()  { return this.getAttribute('value') ?? 'on'; }
  set value(v) { v == null ? this.removeAttribute('value') : this.setAttribute('value', String(v)); }

  /* ── Protected ─────────────────────────────────────────────────── */

  protected override _syncNative() {
    this._syncNativeBase();
    const input = this._input;
    if (input) input.indeterminate = this.indeterminate;
  }

  protected override _handleChange() {
    const input = this._input;
    if (!input) return;
    this._mirrorChecked();
    // Native toggling clears indeterminate
    if (this.hasAttribute('indeterminate')) this.removeAttribute('indeterminate');
    this.emit('change', { checked: input.checked, value: this.value, indeterminate: input.indeterminate });
  }
}

customElements.define('sherpa-input-checkbox', SherpaInputCheckbox);
