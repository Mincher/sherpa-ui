/**
 * SherpaInputChoiceBase — Shared base for checkbox and radio primitives.
 *
 * Handles the lifecycle, attribute syncing, and common public API shared by
 * both SherpaInputCheckbox and SherpaInputRadio, which differ only in how
 * they handle indeterminate state and their default `value`.
 *
 * Subclasses must implement:
 *   _syncNative() — sync attributes → native input (checked, disabled, etc.)
 *   _handleChange() — handle the native input `change` event
 */

import { SherpaElement } from '../sherpa-element/sherpa-element.js';
import { StatusMixin } from '../status-mixin.js';

export abstract class SherpaInputChoiceBase extends StatusMixin(SherpaElement) {

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'name', 'value', 'checked', 'disabled', 'required',
      'data-label', 'data-description',
    ];
  }

  /* ── Private state ─────────────────────────────────────────────── */

  protected _bound = false;

  // Stable bound reference for add/removeEventListener
  protected readonly _onChange = (): void => { this._handleChange(); };

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  override onRender(): void {
    if (!this._bound) {
      const input = this._input;
      if (input) input.addEventListener('change', this._onChange);
      this._bound = true;
    }
    this._syncLabel();
    this._syncDescription();
    this._syncNative();
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case 'data-label':       this._syncLabel(); break;
      case 'data-description': this._syncDescription(); break;
      default:                 this._syncNative(); break;
    }
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get checked(): boolean  { return this.hasAttribute('checked'); }
  set checked(v: boolean) { if (v) { this.setAttribute('checked', ''); } else { this.removeAttribute('checked'); } }

  get disabled(): boolean  { return this.hasAttribute('disabled'); }
  set disabled(v: boolean) { if (v) { this.setAttribute('disabled', ''); } else { this.removeAttribute('disabled'); } }

  get required(): boolean  { return this.hasAttribute('required'); }
  set required(v: boolean) { if (v) { this.setAttribute('required', ''); } else { this.removeAttribute('required'); } }

  override focus(opts?: FocusOptions): void { this._input?.focus(opts); }

  /* ── Protected helpers ─────────────────────────────────────────── */

  protected get _input(): HTMLInputElement | null {
    return this.$<HTMLInputElement>('.check-input');
  }

  protected _syncLabel(): void {
    const el = this.$('.check-text');
    if (el) el.textContent = this.dataset['label'] || '';
  }

  protected _syncDescription(): void {
    const el = this.$('.check-description');
    if (el) el.textContent = this.dataset['description'] || '';
  }

  /** Sync the common native input properties shared by both checkbox and radio. */
  protected _syncNativeBase(): void {
    const input = this._input;
    if (!input) return;
    input.checked = this.checked;
    input.disabled = this.disabled;
    input.required = this.required;
    const name = this.getAttribute('name');
    if (name != null) { input.setAttribute('name', name); } else { input.removeAttribute('name'); }
    input.value = this.value;
  }

  /** Mirror the native checked state back to host attributes. */
  protected _mirrorChecked(): void {
    const input = this._input;
    if (!input) return;
    if (input.checked) { this.setAttribute('checked', ''); } else { this.removeAttribute('checked'); }
  }

  protected abstract get value(): string;
  protected abstract _syncNative(): void;
  protected abstract _handleChange(): void;
}
