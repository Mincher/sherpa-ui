/**
 * sherpa-quick-filter — a filter chip you can toggle, with an optional value menu.
 *
 * @see TRAP T-chip-menu-is-a-boolean-state, TRAP T-one-pick-reads-field-and-value,
 * TRAP T-scope-does-not-stop-inheritance, TRAP T-icon-only-is-purely-css
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { NON_VALUE_ROWS } from '../../core/icons.js';
// Floating, so the count tooltip escapes the toolbar's clipping chip run.
import '../sherpa-tooltip/sherpa-tooltip.js';

interface MenuLike extends HTMLElement {
  toggle?: (trigger?: HTMLElement) => void;
  values?: string[];
}

export class SherpaQuickFilter extends SherpaElement {
  static override css = new URL('./sherpa-quick-filter.css', import.meta.url);
  static override html = new URL('./sherpa-quick-filter.html', import.meta.url);
  static override props = {
    'data-icon-only': { type: 'boolean', kind: 'style' },
    'data-indicator': { type: 'boolean', kind: 'style' },
    'data-menu': { type: 'boolean', kind: 'style' },
    'data-type': { type: 'enum', kind: 'style', values: ['ai'] },
    'data-plain': { type: 'boolean', kind: 'style' },
    'data-no-value': { type: 'boolean', kind: 'style' },
    'data-full-value': { type: 'boolean', kind: 'style' },
    'data-unsupported': { type: 'boolean', kind: 'style' },
    'data-count': { type: 'string', kind: 'content', to: '.count' },
  } as const;

  // data-label is hand-written: an absent attribute must leave the template's
  // own default label alone.
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
   * TRAP T-chip-empty-check-waits-for-onconnect — the slotted menu may not exist
   * yet at `onRender`, and pre-ticked values fire no event. Replay them here.
   */
  override onConnect(): void {
    this.#syncEmpty();
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
   * The text in the caret button — the chip's PICKED VALUE.
   *
   * TRAP T-value-label-is-the-callers-words — public because a DATE chip's ISO
   * pick is the toolbar's to format.
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

  /** The chip's picked values — the same list `quick-filter-change` reports. */
  get values(): string[] {
    return (this.menu?.values ?? []) as string[];
  }

  /** Set the picks. TRAP T-chip-values-round-trip-silently — silent, unlike a pick. */
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

  /** Everything the chip derives from its picks. */
  #applySelection(values: string[]): void {
    if (values.length > 1) this.dataset['count'] = String(values.length);
    else delete this.dataset['count'];
    this.current = values.length > 0;
    this.#syncLabelForSelection(values);
    this.#syncCountTip(values);
    this.#syncEmpty();
    this.#syncText();
  }

  /** The field name, remembered before a pick rewrites the visible label. */
  #field: string | null = null;

  #syncText(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
    // TRAP T-icon-writes-to-both-slots — `.icon` leads the body, `.caret-icon`
    // serves an icon-only chip, and CSS picks which is visible.
    const glyph = this.dataset['iconStart'];
    for (const icon of this.$$('.icon, .caret-icon')) this.writeIcon(icon, glyph ?? '');
  }

  #onClick = (event: Event): void => {
    if (this.hasAttribute('disabled')) return;

    /* TRAP T-an-empty-chip-opens-its-menu — the body cycles a chip's states
     * (TRAP T-a-chip-body-cycles-its-states), and an empty chip has none to cycle.
     * Only when there IS a menu: a toggle-only chip keeps toggling.
     */
    const menu = this.menu;
    if (menu && this.values.length === 0) {
      // Opening a menu is not a toggle — the bar must not see one.
      event.stopPropagation();
      this.#openMenu();
      return;
    }

    // TRAP T-locked-chip-relays-and-nothing-else — report the click, do not flip.
    if (!this.hasAttribute('data-locked')) this.current = !this.current;
    this.emit('quick-filter-click', { active: this.current });
  };

  /**
   * TRAP T-menu-anchors-to-the-chip — anchored to the CHIP's leading edge, not
   * the caret's. Placement is measured: TRAP T-anchor-cross-root.
   */
  #openMenu(): void {
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
    // Focus is inside the menu, so `:focus-visible` is false — CSS rings on this.
    this.toggleAttribute('data-open', open);
  };

  #onMenuChange = (event: Event): void => {
    const values = ((event as CustomEvent).detail?.values ?? []) as string[];
    // A locked chip's menu rows are not its values: relay, change nothing.
    if (this.hasAttribute('data-locked')) {
      this.emit('quick-filter-change', { scope: 'chip', values });
      return;
    }
    this.#applySelection(values);
    this.emit('quick-filter-change', { scope: 'chip', values });
  };

  /**
   * Flag "on, but filtering by nothing" so CSS can warn.
   * TRAP T-empty-flag-needs-rows-to-count — a PERSISTENT or LOCKED chip is exempt.
   */
  #syncEmpty(): void {
    if (this.hasAttribute('data-persistent') || this.hasAttribute('data-locked')) {
      this.removeAttribute('data-empty');
      return;
    }
    const menu = this.menu;
    const empty = !!menu && this.current && (menu.values?.length ?? 0) === 0;
    this.toggleAttribute('data-empty', empty);
  }

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
   * TRAP T-caret-carries-the-value-not-the-label — the chip label is ALWAYS the
   * field name; the pick reads in the caret, as first + ellipsis beyond one.
   */
  #syncLabelForSelection(values: string[]): void {
    this.#field ??= this.dataset['label'] ?? null;
    const field = this.#field;
    if (field == null) return;
    this.dataset['label'] = field;

    const first = values.length ? this.#valueLabel(values[0]!) : '';
    this.valueLabel = values.length > 1 ? `${first}…` : first;
  }

  /** The VISIBLE text of a menu row, falling back to the raw value. */
  #valueLabel(value: string): string {
    const input = this.menu?.querySelector<HTMLInputElement>(
      `input[value="${CSS.escape(value)}"]`,
    );
    const row = input?.closest('label');
    return row?.textContent?.trim() || value;
  }
}

customElements.define('sherpa-quick-filter', SherpaQuickFilter);
