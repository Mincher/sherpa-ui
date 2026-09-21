/**
 * sherpa-button — CSS owns the look; this sets label, icons and badge.
 *
 * @fires button-click — the button is activated. bubbles + composed.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaButton extends SherpaElement {
  static override css = new URL('./sherpa-button.css', import.meta.url);
  static override html = new URL('./sherpa-button.html', import.meta.url);
  static override observed = [
    'data-label',
    'data-icon-start',
    'data-icon-end',
    'data-badge',
    'disabled',
  ];

  /** `data-type` picks the tree, so a change to it must re-stamp. */
  static override variantAttrs = ['data-type'];

  protected override get templateId(): string | null {
    return this.dataset['type'] === 'icon' ? 'icon' : 'default';
  }

  override onRender(): void {
    // No look or size default: a bare button is the secondary look at base size.
    this.#syncLabel();
    this.#syncIcons();
    this.#syncBadge();
    this.#syncDisabled();

    this.$('.trigger')?.addEventListener('click', this.#onClick);
  }

  override onChange(name: string): void {
    if (name === 'data-label') this.#syncLabel();
    else if (name === 'data-icon-start' || name === 'data-icon-end') this.#syncIcons();
    else if (name === 'data-badge') this.#syncBadge();
    else if (name === 'disabled') this.#syncDisabled();
  }

  /** A data-label value overrides slotted content. */
  #syncLabel(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
  }

  /** Mirrors data-badge into the badge slot fallback; CSS shows it. */
  #syncBadge(): void {
    const slot = this.$('.badge slot');
    const value = this.dataset['badge'];
    if (slot) slot.textContent = value ?? '';
  }

  /**
   * data-icon-* is an FA class string ("fa-solid fa-floppy-disk").
   *
   * `writeIcon` strips only the `fa-*` classes — rebuilding className from a
   * base string silently drops the structural `icon icon-start|end`.
   */
  #syncIcons(): void {
    const start = this.$('.icon-start');
    const end = this.$('.icon-end');
    if (start) this.writeIcon(start, this.dataset['iconStart'] ?? '');
    if (end) this.writeIcon(end, this.dataset['iconEnd'] ?? '');
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
