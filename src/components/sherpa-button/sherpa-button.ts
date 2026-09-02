/**
 * sherpa-button — the thing you click.
 *
 * CSS handles how it looks — the styles, sizes, states, and the disabled look.
 * This file only sets sensible defaults, copies the label and icon into place,
 * and fires button-click when someone clicks it.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaButton extends SherpaElement {
  static override css = new URL('./sherpa-button.css', import.meta.url);
  static override html = new URL('./sherpa-button.html', import.meta.url);
  static override observed = [
    'data-label',
    'data-icon-start',
    'data-icon-end',
    'disabled',
  ];

  /** Icon-only buttons stamp the `icon` template; everything else the default. */
  protected override get templateId(): string | null {
    return this.dataset['type'] === 'icon' ? 'icon' : 'default';
  }

  override onRender(): void {
    // Defaults — a bare <sherpa-button> is a primary, base-size button.
    if (this.dataset['type'] !== 'icon' && !this.dataset['variant']) {
      this.dataset['variant'] = 'primary';
    }
    if (!this.dataset['size']) this.dataset['size'] = 'md';

    this.#syncLabel();
    this.#syncIcons();
    this.#syncDisabled();

    this.$('.trigger')?.addEventListener('click', this.#onClick);
  }

  override onChange(name: string): void {
    if (name === 'data-label') this.#syncLabel();
    else if (name === 'data-icon-start' || name === 'data-icon-end') this.#syncIcons();
    else if (name === 'disabled') this.#syncDisabled();
  }

  /** A data-label value overrides slotted content; otherwise the slot shows. */
  #syncLabel(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
  }

  #syncIcons(): void {
    this.#applyIcon('.icon-start', this.dataset['iconStart']);
    this.#applyIcon('.icon-end', this.dataset['iconEnd']);
  }

  /** Set the glyph value; CSS `:host([data-icon-*])` controls visibility. */
  #applyIcon(sel: string, value: string | undefined): void {
    const el = this.$(sel);
    if (el) el.textContent = value ?? '';
  }

  #syncDisabled(): void {
    const disabled = this.hasAttribute('disabled');
    this.$<HTMLButtonElement>('.trigger')?.toggleAttribute('disabled', disabled);
    this.toggleAttribute('aria-disabled', disabled);
  }

  #onClick = (): void => {
    if (this.hasAttribute('disabled')) return;
    this.emit('button-click');
  };
}

customElements.define('sherpa-button', SherpaButton);
