/**
 * sherpa-quick-filter — a filter chip you can toggle, with an optional value menu.
 *
 * TRAP T-chip-menu-is-a-boolean-state — `data-menu` is Figma's State axis
 * (154:3904) as a BOOLEAN; the caret opens a slotted <sherpa-menu>
 * (TRAP T-anchor-cross-root), and CSS owns the look while JS relays the picks.
 *
 * TRAP T-one-pick-reads-field-and-value — `data-empty` paints a VALUE chip
 * warning when it is on with nothing picked; at exactly one pick the chip reads
 * "Field: Value", and the count badge only ever reads 2 or higher.
 *
 *
 * @see TRAP T-scope-does-not-stop-inheritance, TRAP T-icon-only-is-purely-css, TRAP T-locked-chip-relays-and-nothing-else
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { NON_VALUE_ROWS } from '../../core/icons.js';
// The count badge's value list is a composed tooltip, floating so it escapes
// the toolbar's clipping chip run.
import '../sherpa-tooltip/sherpa-tooltip.js';

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

  // data-label keeps its own handling: the write is SKIPPED when the attribute
  // is absent, so the template's own default label survives. data-icon-start is
  // the Font Awesome case — TRAP T-icon-writes-to-both-slots.
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
   * has to wait for onConnect.
   *
   * TRAP T-chip-empty-check-waits-for-onconnect — an `onRender` read can precede
   * the children being parsed, and pre-ticked values fire no menu event.
   */
  override onConnect(): void {
    this.#syncEmpty();
    // TRAP T-chip-empty-check-waits-for-onconnect — pre-ticked values fire no
    // menu event, so replay them here.
    const initial = this.menu?.values ?? [];
    if (initial.length) {
      this.#syncLabelForSelection(initial);
      this.#syncCountTip(initial);
      if (initial.length > 1) this.dataset['count'] = String(initial.length);
    }
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

  /**
   * The text shown in the caret button — the chip's PICKED VALUE.
   *
   * TRAP T-value-label-is-the-callers-words — public because a DATE chip's ISO
   * pick is the toolbar's to format; empty collapses the button to a bare caret.
   */
  set valueLabel(text: string) {
    const caret = this.$('.caret-label');
    if (caret) caret.textContent = text;
  }
  get valueLabel(): string {
    return this.$('.caret-label')?.textContent ?? '';
  }

  /** The chip's slotted value menu, if it has one. */
  get menu(): MenuLike | null {
    return this.querySelector<MenuLike>('[slot="menu"]');
  }

  /**
   * The chip's picked values — the same list `quick-filter-change` reports.
   *
   * TRAP T-chip-values-round-trip-silently — PARITY (a caller must be able to
   * set what a reader picks), the setter brings the whole face with it through
   * `#applySelection`, it reads BACK, and it is SILENT.
   */
  get values(): string[] {
    return (this.menu?.values ?? []) as string[];
  }

  /**
   * Set the picks, and bring the chip's whole face with them.
   *
   * TRAP T-chip-values-round-trip-silently.
   */
  set values(next: readonly string[]) {
    const menu = this.menu;
    if (!menu) return;
    const want = new Set(next.map(String));
    for (const input of this.querySelectorAll<HTMLInputElement>('[slot="menu"] input')) {
      // The "All" row is a control, not a value; it derives from the rest.
      if (!input.closest(NON_VALUE_ROWS)) input.checked = want.has(input.value);
    }
    // Read BACK, never trust the ask: a value naming no row never landed.
    this.#applySelection((menu.values ?? []) as string[]);
  }

  /**
   * Everything the chip derives from its picks, in one place — shared by the menu
   * event and the `values` setter. TRAP T-chip-values-round-trip-silently.
   */
  #applySelection(values: string[]): void {
    if (values.length > 1) this.dataset['count'] = String(values.length);
    else delete this.dataset['count'];
    this.current = values.length > 0;
    this.#syncLabelForSelection(values);
    this.#syncCountTip(values);
    this.#syncEmpty();
    this.#syncText();
  }

  /**
   * The chip's own field name, remembered before a single pick rewrites the
   * visible label.
   *
   * TRAP T-one-pick-reads-field-and-value — without it, one pick → two has
   * nothing to restore.
   */
  #field: string | null = null;

  #syncText(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
    // TRAP T-icon-writes-to-both-slots — `.icon` leads the body, `.caret-icon`
    // serves an icon-only chip, and CSS picks which is visible.
    const glyph = this.dataset['iconStart'];
    // The base class's writer strips stale `fa-*` classes, so a changed glyph
    // cannot leave two.
    for (const icon of this.$$('.icon, .caret-icon')) this.writeIcon(icon, glyph ?? '');
  }

  #onClick = (event: Event): void => {
    if (this.hasAttribute('disabled')) return;

    /* AN EMPTY CHIP'S BODY OPENS ITS MENU.
     *
     * The body cycles a chip's states (`T-a-chip-body-cycles-its-states`), and
     * with nothing picked there is nothing to cycle: toggling an empty chip
     * on and off again changes no filter, so the click did nothing at all. The
     * reader's next move is always the menu, so the body goes there directly.
     *
     * A chip that HOLDS a value keeps cycling, on or off — that is the whole
     * point of "off is a state, not a delete", and turning a value chip off is
     * a real and useful thing to do.
     *
     * Only when there IS a menu to open: a toggle-only chip (a status segment)
     * has no values and no menu, and must keep toggling.
     * TRAP T-an-empty-chip-opens-its-menu.
     */
    const menu = this.menu;
    if (menu && this.values.length === 0) {
      // Same guard as the caret: opening a menu is not a toggle, and a host
      // listening on the bar has no reason to see this as one.
      event.stopPropagation();
      this.#openMenu();
      return;
    }

    // TRAP T-locked-chip-relays-and-nothing-else — a locked chip reports the
    // click and does not flip itself.
    if (!this.hasAttribute('data-locked')) this.current = !this.current;
    this.emit('quick-filter-click', { active: this.current });
  };

  /** Open (or shut) the menu, anchored to the CHIP — shared by the body and the caret. */
  #openMenu(): void {
    // TRAP T-menu-anchors-to-the-chip — the card lines up with the CHIP's
    // leading edge, not the caret's.
    //
    // Placement is measured, not declared: TRAP T-anchor-cross-root.
    this.menu?.toggle?.(this);
  }

  #onCaret = (event: Event): void => {
    if (this.hasAttribute('disabled')) return;
    event.stopPropagation(); // opening the menu must not toggle the chip
    this.#openMenu();
  };

  /** Mirror the menu's open state onto the caret for assistive tech. */
  #onMenuToggle = (event: Event): void => {
    const open = event.type === 'menu-open';
    this.$('.caret')?.setAttribute('aria-expanded', String(open));
    // A chip with its menu OPEN wears the focus ring — real focus is inside the
    // menu by then, so `:focus-visible` on the chip is false. The flag is the
    // JS→CSS path; the ring is entirely in the stylesheet.
    this.toggleAttribute('data-open', open);
  };

  /** A menu selection sets the label, the count chip and the on-state, then relays outward. */
  #onMenuChange = (event: Event): void => {
    const values = ((event as CustomEvent).detail?.values ?? []) as string[];
    // TRAP T-locked-chip-relays-and-nothing-else — a locked chip's menu rows are
    // not its values, so it relays the event and changes nothing about itself.
    if (this.hasAttribute('data-locked')) {
      this.emit('quick-filter-change', { scope: 'chip', values });
      return;
    }
    // TRAP T-one-pick-reads-field-and-value — the badge needs TWO or more.
    this.#applySelection(values);
    this.emit('quick-filter-change', { scope: 'chip', values });
  };

  /**
   * Flag "on, but filtering by nothing" so CSS can paint it as a warning.
   *
   * TRAP T-empty-flag-needs-rows-to-count — reads the menu's TICKED ROWS, and a
   * PERSISTENT or LOCKED chip is exempt: judging either painted a working filter
   * amber.
   */
  #syncEmpty(): void {
    // TRAP T-empty-flag-needs-rows-to-count
    if (this.hasAttribute('data-persistent') || this.hasAttribute('data-locked')) {
      this.removeAttribute('data-empty');
      return;
    }
    const menu = this.menu;
    const empty = !!menu && this.current && (menu.values?.length ?? 0) === 0;
    this.toggleAttribute('data-empty', empty);
  }

  /**
   * The badge's hover bubble and aria-label list the chosen values — TRAP
   * T-caret-carries-the-value-not-the-label.
   */
  #syncCountTip(values: string[]): void {
    const labels = values.map((v) => this.#valueLabel(v));
    // `data-text` is sherpa-tooltip's own API — the component writes the bubble.
    const tip = this.$<HTMLElement>('.count-wrap');
    if (tip) tip.dataset['text'] = labels.join(', ');
    const badge = this.$('.count');
    if (!badge) return;
    if (labels.length > 1) badge.setAttribute('aria-label', `${labels.length} selected: ${labels.join(', ')}`);
    else badge.removeAttribute('aria-label');
  }

  /**
   * The chip keeps the FIELD name; the picked value reads in the caret button.
   *
   * TRAP T-caret-carries-the-value-not-the-label — nothing / one value / first +
   * ellipsis, the exact list on the badge's tip and aria-label, and always the
   * row's VISIBLE text.
   */
  #syncLabelForSelection(values: string[]): void {
    this.#field ??= this.dataset['label'] ?? null;
    const field = this.#field;
    if (field == null) return;
    // The chip label is now ALWAYS the field name — it no longer moves.
    this.dataset['label'] = field;

    const first = values.length ? this.#valueLabel(values[0]!) : '';
    this.valueLabel = values.length > 1 ? `${first}…` : first;
  }

  /**
   * The VISIBLE text of a menu row, not its raw value — TRAP
   * T-caret-carries-the-value-not-the-label. Falls back to the raw value.
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
