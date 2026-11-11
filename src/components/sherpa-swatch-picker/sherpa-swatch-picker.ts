/**
 * sherpa-swatch-picker — a colour picked from a palette, the data-viz series: a button wearing the colour now, opening a
 * grid of swatches. Native radios in a native popover do the keys and the roles. Will, TODO 904
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { DATA_VIZ_SWATCHES, type Swatch } from '../../core/ui/swatches.js';

export class SherpaSwatchPicker extends SherpaElement {
  static override css = new URL('./sherpa-swatch-picker.css', import.meta.url);
  static override html = new URL('./sherpa-swatch-picker.html', import.meta.url);
  static override delegatesFocus = true;
  static override props = {
    'data-label': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
  } as const;
  /** A form cannot see a control through a shadow root. TRAP T-shadow-input-needs-element-internals */
  static readonly formAssociated = true;
  static override observed = ['value', 'disabled'];

  /** The colours it offers. */
  #swatches: readonly Swatch[] = DATA_VIZ_SWATCHES;

  override onRender(): void {
    this.renderItems('.swatches', 'template.swatch-tpl', this.#swatches, {
      after: (node, swatch) => {
        node.style.setProperty('--_fill', swatch.fill);
        node.style.setProperty('--_ink', swatch.value);
      },
    });
    this.$('.swatches')?.addEventListener('change', this.#onPick);
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** The colour picked: a CSS colour, as a token. */
  get value(): string {
    return this.getAttribute('value') ?? '';
  }
  set value(value: string) {
    this.set('value', value || null);
  }

  /** The button wears the colour and says its name; the swatch of it is ticked; a form submits it. */
  #sync(): void {
    const value = this.value;
    const swatch = this.#swatches.find((s) => s.value === value);
    const trigger = this.$<HTMLButtonElement>('.trigger');
    this.$('.current')?.style.setProperty('--_ink', value || 'transparent');
    const name = this.$('.name');
    if (name) name.textContent = swatch?.label ?? (value ? 'Custom' : 'None');
    if (trigger) {
      trigger.disabled = this.hasAttribute('disabled');
      trigger.setAttribute('aria-label', `${this.dataset['label'] ?? 'Colour'}: ${swatch?.label ?? (value ? 'Custom' : 'None')}`);
    }
    for (const radio of this.$$<HTMLInputElement>('.swatches input')) radio.checked = radio.value === value;
    this.formLink.value(value || null);
  }

  /** A swatch picked: the value, the change, and the grid shuts. */
  #onPick = (event: Event): void => {
    const radio = event.target as HTMLInputElement;
    if (!radio.checked) return;
    this.value = radio.value;
    this.$('.swatches')?.hidePopover();
    this.$<HTMLButtonElement>('.trigger')?.focus();
    this.emit('change', { value: this.value });
  };
}

define('sherpa-swatch-picker', SherpaSwatchPicker);
