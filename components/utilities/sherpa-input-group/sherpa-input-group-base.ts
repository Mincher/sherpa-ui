/**
 * SherpaInputGroupBase — Shared base for checkbox-group and radio-group.
 *
 * Handles legend/description/helper syncing and the common onAttributeChanged
 * dispatch pattern shared by SherpaInputCheckboxGroup and SherpaInputRadioGroup.
 *
 * Subclasses implement:
 *   _stampOptions() — stamp child elements from JSON options
 *   _syncValue()    — reflect data-value to child checked states
 *   _syncDisabled() — cascade disabled to children
 *   _onExtraAttributeChanged() — handle any subclass-specific attributes
 */

import { SherpaElement } from '../sherpa-element/sherpa-element.js';
import { StatusMixin } from '../status-mixin.js';

export abstract class SherpaInputGroupBase extends StatusMixin(SherpaElement) {

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'name', 'data-label', 'data-description', 'data-helper',
      'data-options', 'data-value', 'disabled', 'required',
    ];
  }

  protected _bound = false;

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case 'data-label':       this._syncLegend(); break;
      case 'data-description': this._syncDescription(); break;
      case 'data-helper':      this._syncHelper(); break;
      case 'data-options':     this._stampOptions(); this._syncValue(); break;
      case 'data-value':       this._syncValue(); break;
      case 'disabled':         this._syncDisabled(); break;
      default:                 this._onExtraAttributeChanged(name, oldValue, newValue); break;
    }
  }

  protected _syncLegend(): void {
    const el = this.$('.group-label');
    if (el) el.textContent = this.dataset['label'] || '';
  }

  protected _syncDescription(): void {
    const el = this.$('.group-description');
    if (el) el.textContent = this.dataset['description'] || '';
  }

  protected _syncHelper(): void {
    const el = this.$('.group-helper');
    if (el) el.textContent = this.dataset['helper'] || '';
  }

  protected _onExtraAttributeChanged(_name: string, _old: string | null, _new: string | null): void {}

  protected abstract _stampOptions(): void;
  protected abstract _syncValue(): void;
  protected abstract _syncDisabled(): void;
}
