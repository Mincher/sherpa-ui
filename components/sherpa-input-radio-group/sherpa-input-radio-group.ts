/**
 * sherpa-input-radio-group.js
 * SherpaInputRadioGroup — Group of radios with shared label, description,
 * helper and a single selected value.
 *
 * @element sherpa-input-radio-group
 * @category input
 *
 * @attr {string}  [name]              — Field name; cascaded to children
 * @attr {string}  [data-label]        — Group legend
 * @attr {string}  [data-description]  — Sub-label below the legend
 * @attr {string}  [data-helper]       — Helper text below the options
 * @attr {enum}    [data-orientation]  — vertical (default) | horizontal
 * @attr {json}    [data-options]      — [{value,label,description?,disabled?}]
 * @attr {string}  [data-value]        — Currently selected value
 * @attr {enum}    [data-status]       — critical | warning | success | info | urgent
 * @attr {boolean} [disabled]
 * @attr {boolean} [required]
 *
 * @fires change — Selection changed.
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @prop {string} value — Currently selected value
 *
 * @method getValue()    — Returns current value or null.
 * @method setValue(v)   — Replace current value.
 * @method clear()       — Deselect all.
 */

import { SherpaInputGroupBase } from '../utilities/sherpa-input-group/sherpa-input-group-base.js';
import { SherpaInputDataset } from '../utilities/sherpa-input-base/sherpa-input-base.js';
import '../sherpa-input-radio/sherpa-input-radio.js';

/** Structural type for the slotted <sherpa-input-radio> children. */
interface RadioChild extends HTMLElement {
  checked: boolean;
  value: string;
}

/* ── Dataset Interface ─────────────────────────────────────────── */

interface SherpaInputRadioGroupDataset extends SherpaInputDataset {
  orientation?: 'horizontal' | 'vertical';
  options?: string;
  value?: string;
  status?: string;
}

let _gid = 0;

export class SherpaInputRadioGroup extends SherpaInputGroupBase {

  override get dataset(): SherpaInputRadioGroupDataset {
    return super.dataset as SherpaInputRadioGroupDataset;
  }

  static override get cssUrl(): string  { return new URL('./sherpa-input-radio-group.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-input-radio-group.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'name', 'data-label', 'data-description', 'data-helper',
      'data-options', 'data-value', 'disabled', 'required',
    ];
  }

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  override onRender(): void {
    if (!this._bound) {
      this.addEventListener('change', this.#onChildChange);
      this._bound = true;
    }

    if (!this.getAttribute('name')) {
      this.setAttribute('name', `sherpa-radio-group-${++_gid}`);
    }
    this._syncLegend();
    this._syncDescription();
    this._syncHelper();
    this._stampOptions();
    this._syncValue();
    this._syncDisabled();
  }

  protected override _onExtraAttributeChanged(name: string) {
    if (name === 'name') this.#cascadeName();
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get value() { return this.getValue(); }
  set value(v) { this.setValue(v); }

  getValue() {
    const checked = [...this.querySelectorAll<RadioChild>('sherpa-input-radio')]
      .find((el) => el.checked);
    return checked?.value ?? null;
  }

  setValue(v: string | null) {
    if (v == null) this.removeAttribute('data-value');
    else this.dataset["value"] = String(v);
  }

  clear() { this.setValue(null); }

  /* ── Private ───────────────────────────────────────────────────── */

  protected override _stampOptions() {
    const raw = this.dataset["options"];
    if (!raw) return;
    let opts;
    try { opts = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(opts)) return;

    [...this.querySelectorAll('sherpa-input-radio[data-stamped]')]
      .forEach((n) => n.remove());

    const name = this.getAttribute('name');
    const frag = document.createDocumentFragment();
    for (const opt of opts) {
      const el = document.createElement('sherpa-input-radio');
      el.dataset["stamped"] = '';
      el.setAttribute('value', opt.value);
      if (opt.label) el.dataset["label"] = opt.label;
      if (opt.description) el.dataset["description"] = opt.description;
      if (opt.disabled) el.setAttribute('disabled', '');
      if (name) el.setAttribute('name', name);
      frag.appendChild(el);
    }
    this.appendChild(frag);
  }

  #cascadeName() {
    const name = this.getAttribute('name');
    for (const el of this.querySelectorAll('sherpa-input-radio')) {
      if (name) el.setAttribute('name', name);
      else el.removeAttribute('name');
    }
  }

  protected override _syncValue() {
    const target = this.dataset["value"];
    for (const el of this.querySelectorAll<RadioChild>('sherpa-input-radio')) {
      const should = target != null && String(el.value) === String(target);
      if (el.checked !== should) {
        should ? el.setAttribute('checked', '') : el.removeAttribute('checked');
      }
    }
  }

  protected override _syncDisabled() {
    const disable = this.hasAttribute('disabled');
    for (const el of this.querySelectorAll('sherpa-input-radio')) {
      disable ? el.setAttribute('disabled', '') : el.removeAttribute('disabled');
    }
  }

  #onChildChange = (e: Event) => {
    if (e.target === this) return;
    if ((e.target as HTMLElement | null)?.tagName !== 'SHERPA-INPUT-RADIO') return;
    const v = this.getValue();
    if (v != null && this.dataset["value"] !== String(v)) this.dataset["value"] = String(v);
    this.emit('change', { value: v });
  };
}

customElements.define('sherpa-input-radio-group', SherpaInputRadioGroup);
