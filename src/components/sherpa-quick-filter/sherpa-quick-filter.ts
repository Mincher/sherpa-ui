/**
 * sherpa-quick-filter — a filter chip you can toggle, with an optional value menu.
 *
 * Clicking the chip body flips it on or off and fires quick-filter-click.
 *
 * `data-menu` is the code form of Figma's `State` variant axis on "Filter Chip
 * (atom)" (154:3904): absent = State=simple (one box), present = State=menu (the
 * chip and a caret button SNAPPED into one 24-tall unit via the Structure
 * snap-right-edge / snap-left-edge extensions). It stays a boolean rather than a
 * `data-state` enum because the second value is the only difference and a boolean
 * reads better at the call site.
 *
 * The caret opens a slotted <sherpa-menu> of values for the field — checkbox rows
 * for a multi-select field, radio rows for a single-select one. The menu is a
 * native popover; it measures its own placement off the caret we hand it, because
 * a CSS anchor name cannot cross the shadow boundary between them.
 *
 * CSS owns the look: the neutral count chip that LEADS the label, the accent, the
 * on-state tint, the snapped corners and the disabled treatment. JS writes the
 * label, the count and the icon, and relays the menu's selection.
 *
 * @element sherpa-quick-filter
 * @attr {enum}    data-type       default | ai | populated
 * @attr {boolean} data-current    the chip is on
 * @attr {string}  data-label      chip text (or use the default slot)
 * @attr {string}  data-icon-start leading icon — an FA class list
 * @attr {boolean} data-indicator  show the leading status dot
 * @attr {string}  data-count      leading count chip
 * @attr {boolean} data-menu       Figma State=menu — snap on the caret button
 *
 * @slot (default) — the chip label
 * @slot menu      — a <sherpa-menu> of values for this field
 *
 * @fires quick-filter-click  — the chip body is toggled. detail: { active: boolean }
 * @fires quick-filter-change — the menu selection changed. detail: { values: string[] }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

interface MenuLike extends HTMLElement {
  toggle?: (trigger?: HTMLElement) => void;
  values?: string[];
}

export class SherpaQuickFilter extends SherpaElement {
  static override css = new URL('./sherpa-quick-filter.css', import.meta.url);
  static override html = new URL('./sherpa-quick-filter.html', import.meta.url);
  static override observed = ['data-label', 'data-count', 'data-icon-start'];

  override onRender(): void {
    this.#syncText();
    this.$('.body')?.addEventListener('click', this.#onClick);
    this.$('.caret')?.addEventListener('click', this.#onCaret);
    // The menu lives in the light DOM; its events bubble up through the host.
    this.addEventListener('menu-change', this.#onMenuChange as EventListener);
    this.addEventListener('menu-open', this.#onMenuToggle as EventListener);
    this.addEventListener('menu-close', this.#onMenuToggle as EventListener);
  }

  override onChange(): void {
    this.#syncText();
  }

  get current(): boolean {
    return this.hasAttribute('data-current');
  }
  set current(v: boolean) {
    this.toggleAttribute('data-current', v);
  }

  /** The chip's slotted value menu, if it has one. */
  get menu(): MenuLike | null {
    return this.querySelector<MenuLike>('[slot="menu"]');
  }

  #syncText(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
    const count = this.$('.count');
    if (count) count.textContent = this.dataset['count'] ?? '';
    // The leading icon is a Font Awesome class list; render it as an <i>, not text.
    const icon = this.$('.icon');
    const glyph = this.dataset['iconStart'];
    if (icon) {
      if (glyph && /\bfa-/.test(glyph)) {
        const i = document.createElement('i');
        i.className = glyph;
        i.setAttribute('aria-hidden', 'true');
        icon.replaceChildren(i);
      } else {
        icon.textContent = glyph ?? '';
      }
    }
  }

  #onClick = (): void => {
    if (this.hasAttribute('disabled')) return;
    this.current = !this.current;
    this.emit('quick-filter-click', { active: this.current });
  };

  #onCaret = (event: Event): void => {
    if (this.hasAttribute('disabled')) return;
    event.stopPropagation(); // opening the menu must not toggle the chip
    this.menu?.toggle?.(this.$<HTMLElement>('.caret') ?? undefined);
  };

  /** Mirror the menu's open state onto the caret for assistive tech. */
  #onMenuToggle = (event: Event): void => {
    const open = event.type === 'menu-open';
    this.$('.caret')?.setAttribute('aria-expanded', String(open));
  };

  /** A menu selection sets the count chip and the on-state, then relays outward. */
  #onMenuChange = (event: Event): void => {
    const values = ((event as CustomEvent).detail?.values ?? []) as string[];
    // The count says "how many values are picked", so it only means anything on a
    // MULTI-select chip. A single-select one can only ever read "1", which tells
    // the user nothing and just adds a badge to every Group / Sort chip.
    const single = this.menu?.getAttribute('data-select') === 'single';
    if (values.length && !single) this.dataset['count'] = String(values.length);
    else delete this.dataset['count'];
    this.current = values.length > 0;
    this.#syncText();
    this.emit('quick-filter-change', { values });
  };
}

customElements.define('sherpa-quick-filter', SherpaQuickFilter);
