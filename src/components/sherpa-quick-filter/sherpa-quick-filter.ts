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
 * A VALUE chip that is on but holds no values is a contradiction — it filters by
 * nothing, so it is filtering nothing out. CSS paints that as the WARNING status
 * rather than the active one, off `data-empty`. A plain toggle chip (no menu)
 * never gets it: on/off is its whole meaning, so "on with no values" is normal.
 *
 * With EXACTLY ONE value picked the chip rewrites its own label to
 * "Field: Value" — one pick fits, and it says what the chip filters TO rather
 * than only what it filters ON, so no count badge is needed. Two or more picks
 * will not fit, so those revert to the bare field name and the count badge
 * carries the number. The badge therefore only ever reads 2 or higher.
 *
 * @element sherpa-quick-filter
 * @attr {enum}    data-type       default | ai | populated
 * @attr {boolean} data-current    the chip is on
 * @attr {string}  data-label      chip text (or use the default slot). The chip
 *                                 rewrites this to "Field: Value" while exactly
 *                                 one menu value is picked.
 * @attr {string}  data-icon-start leading icon — an FA class list
 * @attr {boolean} data-indicator  show the leading status dot
 * @attr {string}  data-count      leading count chip — set only at 2+ picked values.
 *                                 Hovering it lists the chosen values in a bubble
 *                                 above the badge (pure CSS; see the .count-tip part).
 * @attr {boolean} data-menu       Figma State=menu — snap on the caret button
 * @attr {boolean} data-empty      set by the chip: it is ON but holds no values
 * @attr {boolean} data-persistent  a SELECTOR, not a toggle — always on, never
 *                                  empty. Set by the toolbar.
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
  static override props = {
    'data-count': { type: 'string', kind: 'content', to: '.count' },
  } as const;

  // data-label keeps its own handling: the write is SKIPPED when the attribute is
  // absent, so the template's own default label survives. data-icon-start is the
  // Font Awesome case and belongs to icon().
  static override observed = ['data-label', 'data-icon-start', 'data-current'];

  override onRender(): void {
    this.#syncText();
    this.$('.body')?.addEventListener('click', this.#onClick);
    this.$('.caret')?.addEventListener('click', this.#onCaret);
    // The menu lives in the light DOM; its events bubble up through the host.
    this.addEventListener('menu-change', this.#onMenuChange as EventListener);
    this.addEventListener('menu-open', this.#onMenuToggle as EventListener);
    this.addEventListener('menu-close', this.#onMenuToggle as EventListener);
  }

  /**
   * The empty check reads the SLOTTED menu, which is a light-DOM child — so it
   * has to wait for onConnect. At onRender time a chip written as markup may not
   * have had its children parsed yet, and an empty read there would flag a chip
   * that does in fact hold values.
   */
  override onConnect(): void {
    this.#syncEmpty();
  }

  override onChange(name: string): void {
    if (name === 'data-current') this.#syncEmpty();
    else this.#syncText();
  }

  get current(): boolean {
    return this.hasAttribute('data-current');
  }
  set current(v: boolean) {
    this.toggleAttribute('data-current', v);
    this.#syncEmpty();
  }

  /** The chip's slotted value menu, if it has one. */
  get menu(): MenuLike | null {
    return this.querySelector<MenuLike>('[slot="menu"]');
  }

  /**
   * The chip's own field name, remembered before a single pick rewrites the
   * visible label to "Field: Value". Without it, going from one pick to two (or
   * back to none) would have nothing to restore — the field name would already
   * have been overwritten in data-label.
   */
  #field: string | null = null;

  #syncText(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
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

  /** A menu selection sets the label, the count chip and the on-state, then relays outward. */
  #onMenuChange = (event: Event): void => {
    const values = ((event as CustomEvent).detail?.values ?? []) as string[];
    // The badge needs TWO or more picks to say anything. At one pick the label
    // already names the value ("Region: EMEA"), so a "1" beside it is pure noise
    // — and on a single-select chip the badge could never read anything else.
    if (values.length > 1) this.dataset['count'] = String(values.length);
    else delete this.dataset['count'];
    this.current = values.length > 0;
    this.#syncLabelForSelection(values);
    this.#syncCountTip(values);
    this.#syncEmpty();
    this.#syncText();
    this.emit('quick-filter-change', { values });
  };

  /**
   * Flag "on, but filtering by nothing" so CSS can paint it as a warning.
   *
   * Only a VALUE chip can be in that state: it has a menu, so holding no values
   * means it excludes nothing while still claiming to be on. A plain toggle chip
   * has no values to hold, so on/off is its whole meaning and it is never empty.
   *
   * Reads the menu's checked rows rather than the last event's detail, because a
   * chip can be switched on from OUTSIDE (the toolbar's `active: true`) with no
   * menu event ever having fired.
   *
   * A PERSISTENT chip is exempt. It is a selector, not a filter: it is on
   * because you are always in some state it names (a view), so "on with nothing
   * picked" is a chip still waiting for its rows, not a contradiction. Painting
   * it amber was the intermittent warning on the view chip — the flag was read
   * before the menu's rows were there to be counted.
   */
  #syncEmpty(): void {
    if (this.hasAttribute('data-persistent')) {
      this.removeAttribute('data-empty');
      return;
    }
    const menu = this.menu;
    const empty = !!menu && this.current && (menu.values?.length ?? 0) === 0;
    this.toggleAttribute('data-empty', empty);
  }

  /**
   * A count says HOW MANY but never WHICH, so the badge's hover bubble lists the
   * chosen values. The same list goes on the badge's aria-label, because the
   * bubble is aria-hidden — a CSS-only tooltip is invisible to a screen reader,
   * so the text has to reach AT by a second route.
   */
  #syncCountTip(values: string[]): void {
    const labels = values.map((v) => this.#valueLabel(v));
    const tip = this.$('.count-tip');
    if (tip) tip.textContent = labels.join(', ');
    const badge = this.$('.count');
    if (!badge) return;
    if (labels.length > 1) badge.setAttribute('aria-label', `${labels.length} selected: ${labels.join(', ')}`);
    else badge.removeAttribute('aria-label');
  }

  /**
   * Exactly ONE picked value reads better as "Field: Value" than as a bare field
   * name — the chip can say what it filters TO, not just what it filters ON, and
   * the count badge is redundant at one anyway. Two or more values will not fit,
   * so those fall back to the field name plus the count badge.
   */
  #syncLabelForSelection(values: string[]): void {
    this.#field ??= this.dataset['label'] ?? null;
    const field = this.#field;
    if (field == null) return;
    const text = values.length === 1 ? this.#valueLabel(values[0]!) : null;
    this.dataset['label'] = text ? `${field}: ${text}` : field;
  }

  /**
   * The VISIBLE text of a menu row, not its raw value — a chip must read
   * "Region: EMEA", never "Region: emea". Falls back to the raw value when the
   * row carries no text of its own.
   */
  #valueLabel(value: string): string {
    const input = this.menu?.querySelector<HTMLInputElement>(
      `input[value="${CSS.escape(value)}"]`,
    );
    const row = input?.closest('label');
    return row?.textContent?.trim() || value;
  }
}

customElements.define('sherpa-quick-filter', SherpaQuickFilter);
