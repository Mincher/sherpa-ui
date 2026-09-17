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
    'data-badge',
    'disabled',
  ];

  /** `data-type` picks the tree, so a change to it has to re-stamp. */
  static override variantAttrs = ['data-type'];

  /** Icon-only buttons stamp the `icon` template; everything else the default. */
  protected override get templateId(): string | null {
    return this.dataset['type'] === 'icon' ? 'icon' : 'default';
  }

  override onRender(): void {
    // No appearance default: a bare <sherpa-button> is the DEFAULT ("secondary")
    // look — white surface, grey border, dark ink. Emphasis is opt-in via
    // data-look="saturated" (primary) / "transparent" (tertiary), the shared
    // look-tier system (matches Figma — the Button has no variant axis).
    // No size default either: a bare button uses the base :host {} token block;
    // sizes come from the Structure collection (2xs | xs | sm | lg | xl).
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

  /** A data-label value overrides slotted content; otherwise the slot shows. */
  #syncLabel(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
  }

  /** Mirror a data-badge value into the badge slot's fallback; CSS shows it. */
  #syncBadge(): void {
    const slot = this.$('.badge slot');
    const value = this.dataset['badge'];
    if (slot) slot.textContent = value ?? '';
  }

  /**
   * data-icon-* is an FA class string ("fa-solid fa-floppy-disk"), set as CSS
   * classes on the `<i>`; CSS `:host([data-icon-*])` controls visibility. A
   * legacy single-glyph value (no "fa-" token) falls back to text.
   *
   * `writeIcon` is the shared writer. This used to rebuild `className` from a
   * hard-coded `base` string — which works only while nothing else touches
   * those classes, and silently drops anything that does. `writeIcon` removes
   * the `fa-*` classes and leaves the rest, so the structural
   * `icon icon-start|end` survive because they were never removed.
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
