/**
 * sherpa-button — CSS owns the look; this sets label, icons and badge.
 *
 * A `slot="menu"` child is opened by the click, and `data-open` reports it
 * while it is open. TRAP T-a-trigger-click-follows-light-dismiss
 *
 * @fires button-click — the button is activated. bubbles + composed.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import '../sherpa-badge/sherpa-badge.js';

/** What the button needs of a slotted menu. */
interface MenuLike extends HTMLElement {
  show(trigger?: HTMLElement): void;
  hide(): void;
  readonly open: boolean;
}

export class SherpaButton extends SherpaElement {
  static override css = new URL('./sherpa-button.css', import.meta.url);
  static override html = new URL('./sherpa-button.html', import.meta.url);
  static override props = {
    /* CSS-only, and declared here rather than in `observed`: the base class
       need not watch a value only a selector reads. `2xs`-`xl`, NOT the shared
       three. TRAP T-a-shared-enum-is-not-every-enum */
    'data-size': { type: 'enum', kind: 'style', values: ['2xs', 'xs', 'sm', 'lg', 'xl'] },
    /* Written BY the button while its slotted menu is open. */
    'data-open': { type: 'boolean', kind: 'style' },
  } as const;

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
    // The menu is a LIGHT DOM child, so its events reach the host.
    this.addEventListener('menu-open', this.#onMenuToggle);
    this.addEventListener('menu-close', this.#onMenuToggle);
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

  /** Writes data-badge into the composed sherpa-badge; CSS shows it. */
  #syncBadge(): void {
    const badge = this.$('.badge-value');
    if (badge) badge.textContent = this.dataset['badge'] ?? '';
  }

  /**
   * data-icon-* is an FA class string ("floppy-disk").
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

  /** Carry `disabled` to the inner button, and say it to assistive tech. */
  #syncDisabled(): void {
    const disabled = this.hasAttribute('disabled');
    this.$<HTMLButtonElement>('.trigger')?.toggleAttribute('disabled', disabled);
    this.toggleAttribute('aria-disabled', disabled);
  }

  /** The slotted menu, if this button is a trigger for one. */
  get #menu(): MenuLike | null {
    return this.querySelector<MenuLike>('[slot="menu"]');
  }

  /**
   * `menu.toggle()` cannot do this: the native popover light-dismisses on
   * pointerdown, so by the time the click lands an open menu already reads
   * shut and toggle would RE-OPEN what the user just closed. `data-open` is
   * still set at that moment, so it is what decides.
   *
   * It must still `hide()`, not merely decline to show: a click that did NOT
   * dismiss — a synthetic one, or a trigger outside the menu's dismiss area —
   * leaves the menu open, and only this closes it.
   * TRAP T-a-trigger-click-follows-light-dismiss
   */
  #onClick = (event: Event): void => {
    if (this.hasAttribute('disabled')) return;
    /* A click INSIDE the slotted menu is not a click on this button. The menu
       is a light-DOM child, so every row tick bubbles here — and the button
       read it as a second press and shut the menu with nothing chosen.
       TRAP T-a-click-in-a-slotted-menu-is-not-a-press */
    const menu = this.#menu;
    if (menu && event.composedPath().includes(menu)) return;
    if (menu) {
      const wasOpen = this.hasAttribute('data-open');
      this.removeAttribute('data-open');
      if (wasOpen) menu.hide();
      else menu.show(this);
    }
    this.emit('button-click');
  };

  /** Mirror the menu's open state; focus is inside it, so CSS reads this. */
  #onMenuToggle = (event: Event): void => {
    const open = event.type === 'menu-open';
    this.toggleAttribute('data-open', open);
    this.$('.trigger')?.setAttribute('aria-expanded', String(open));
    /* The REAL button is the inner `.trigger`, so that is where the state
       belongs. A host-level `aria-expanded` cannot be maintained from outside
       and reads FIRST to a screen reader — a stale "false" over an open menu.
       TRAP T-a-host-cannot-hold-aria-expanded */
    if (this.hasAttribute('aria-expanded')) this.removeAttribute('aria-expanded');
  };
}

customElements.define('sherpa-button', SherpaButton);
