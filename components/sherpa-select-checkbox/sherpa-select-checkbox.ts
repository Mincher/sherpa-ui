/**
 * sherpa-select-checkbox.js
 * SherpaSelectCheckbox — Atomic checkbox primitive.
 *
 * Single checkbox with label-on-the-right. Designed for both standalone
 * use (e.g. "I accept the terms") and as a child of `sherpa-select-group`.
 *
 * @element sherpa-select-checkbox
 * @category input
 * @description Atomic single checkbox with a right-aligned label. Use standalone for consent
 *   acknowledgements ("I accept the terms") or as a child of sherpa-select-group for
 *   coordinated multi-select lists. Supports indeterminate state for "select all" header
 *   checkboxes. In groups, sherpa-select-group manages the name, value aggregation, and
 *   validation — prefer it over composing individual checkboxes manually.
 *
 * @attr {string}  name             — Form field name
 * @attr {string}  value            — Submitted value when checked (default "on")
 * @attr {boolean} checked          — Initial / current checked state
 * @attr {boolean} indeterminate    — Mixed state (overrides checked visually)
 * @attr {boolean} disabled         — Disabled state
 * @attr {boolean} required         — Required constraint
 * @attr {string}  data-label       — Inline label text
 * @attr {string}  data-description — Helper line below the label
 * @attr {enum}    data-status      — critical | warning | success | info | urgent
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

export class SherpaSelectCheckbox extends SherpaInputChoiceBase {

  static override get cssUrl(): string  { return new URL('./sherpa-select-checkbox.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-select-checkbox.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'indeterminate'];
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get indeterminate(): boolean  { return this.hasAttribute('indeterminate'); }
  set indeterminate(v: boolean) {
    if (v) { this.setAttribute('indeterminate', ''); } else { this.removeAttribute('indeterminate'); }
  }

  get value(): string  { return this.getAttribute('value') ?? 'on'; }
  set value(v: string) { if (v == null) { this.removeAttribute('value'); } else { this.setAttribute('value', String(v)); } }

  /* ── Protected ─────────────────────────────────────────────────── */

  protected override _syncNative(): void {
    this._syncNativeBase();
    const input = this._input;
    if (input) input.indeterminate = this.indeterminate;
  }

  protected override _handleChange(): void {
    const input = this._input;
    if (!input) return;
    this._mirrorChecked();
    // Native toggling clears indeterminate
    if (this.hasAttribute('indeterminate')) this.removeAttribute('indeterminate');
    this.emit('change', { checked: input.checked, value: this.value, indeterminate: input.indeterminate });
  }
}

customElements.define('sherpa-select-checkbox', SherpaSelectCheckbox);
