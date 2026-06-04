/**
 * sherpa-input-radio.js
 * SherpaInputRadio — Atomic radio primitive.
 *
 * Single radio with label-on-the-right. Use multiple instances sharing a
 * `name` to form a logical group, or wrap in `sherpa-input-radio-group`
 * which manages the shared name + value coordination.
 *
 * @element sherpa-input-radio
 * @category input
 *
 * @attr {string}  [name]             — Form field name (radios sharing a name group together)
 * @attr {string}  [value]            — Value submitted when selected
 * @attr {boolean} [checked]          — Initial / current selected state
 * @attr {boolean} [disabled]         — Disabled state
 * @attr {boolean} [required]         — Required constraint
 * @attr {string}  [data-label]       — Inline label text
 * @attr {string}  [data-description] — Helper line below the label
 * @attr {enum}    [data-status]      — critical | warning | success | info | urgent
 *
 * @fires change — User selected this radio.
 *   bubbles: true, composed: true
 *   detail: { checked: boolean, value: string }
 *
 * @prop {boolean} checked — Read/write checked state
 * @prop {string}  value   — Submitted value
 *
 * @method focus() — Move focus to the underlying native input.
 */

import { SherpaInputChoiceBase } from '../utilities/sherpa-input-choice/sherpa-input-choice-base.js';

/* ── Dataset Interface ─────────────────────────────────────────── */

interface SherpaInputRadioDataset extends DOMStringMap {
  label?: string;
  description?: string;
  status?: string;
}

export class SherpaInputRadio extends SherpaInputChoiceBase {

  override get dataset(): SherpaInputRadioDataset {
    return super.dataset as SherpaInputRadioDataset;
  }

  static override get cssUrl(): string  { return new URL('./sherpa-input-radio.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-input-radio.html', import.meta.url).href; }

  /* ── Public API ────────────────────────────────────────────────── */

  get value()  { return this.getAttribute('value') ?? ''; }
  set value(v) { v == null ? this.removeAttribute('value') : this.setAttribute('value', String(v)); }

  /* ── Protected ─────────────────────────────────────────────────── */

  protected override _syncNative() {
    this._syncNativeBase();
  }

  protected override _handleChange() {
    const input = this._input;
    if (!input) return;
    this._mirrorChecked();
    this.emit('change', { checked: input.checked, value: this.value });
  }
}

customElements.define('sherpa-input-radio', SherpaInputRadio);
