/**
 * sherpa-quick-filter — a filter chip you can toggle, with an optional value menu.
 *
 * @see TRAP T-chip-menu-is-a-boolean-state, TRAP T-one-pick-reads-field-and-value,
 * TRAP T-scope-does-not-stop-inheritance, TRAP T-icon-only-is-purely-css
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import {
  DEFAULT_OP, OP_LABELS, OP_SYMBOLS, OP_TAKES, type FilterOp, valueSet,
} from '../../core/store.js';
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
    /* A VIEW filter now owns this field, so this chip is SUSPENDED, not gone:
       it keeps its value and comes back when the view lets the field go.
       TRAP T-a-superseded-chip-suspends-it-is-never-removed */
    'data-superseded': { type: 'boolean', kind: 'style' },
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
    // A FILTER menu's condition is part of what this chip reads back.
    this.addEventListener('condition-change', this.#onCondition as EventListener);
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
    /* The QUERY's comparison, not an exact one. A menu row's value may be
       spelled differently from the data it filters — the Records example
       lower-cases them — and the query has always matched loosely, so an exact
       test here made a value set from elsewhere tick nothing.
       TRAP T-one-comparison-rule-for-query-and-ui */
    const want = valueSet(next);
    for (const input of this.querySelectorAll<HTMLInputElement>('[slot="menu"] input')) {
      // The "All" row is a control, not a value; it derives from the rest.
      if (!input.closest(NON_VALUE_ROWS)) input.checked = want.has(input.value);
    }
    // Read BACK, never trust the ask: a value naming no row never landed.
    this.#applySelection((menu.values ?? []) as string[]);
  }

  /** Everything the chip derives from its picks. */
  #applySelection(values: string[]): void {
    // A TYPING condition answers with text, so the chip is on without a tick.
    this.current = values.length > 0 || this.#hasTypedAnswer();
    // The badge is written by #syncLabelForSelection, which knows the condition.
    this.#syncLabelForSelection(values);
    // BEFORE the badge: this writes the count's own aria-label and would wipe
    // the condition's. TRAP T-an-operator-decides-pick-or-type
    this.#syncCountTip(values);
    this.#syncBadge(values.length);
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
    /* A TYPED condition is an answer, so a chip holding one is not empty —
       "Contains Ravi" filters, and painting it as "filtering nothing" is a
       lie. TRAP T-an-operator-decides-pick-or-type */
    const empty = !!menu && this.current
      && (menu.values?.length ?? 0) === 0 && !this.#hasTypedAnswer();
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
   * The menu's condition changed — the caret says which, and a TYPED answer
   * switches the chip on by itself.
   *
   * Ticked rows are not the only way a filter chip holds a value: "Starts with
   * Go" narrows just as much, and a chip that stays off while its menu filters
   * is a chip that lies. TRAP T-an-operator-decides-pick-or-type
   */
  #onCondition = (): void => {
    this.#applySelection((this.menu?.values ?? []) as string[]);
  };

  /**
   * TRAP T-caret-carries-the-value-not-the-label — the chip label is ALWAYS the
   * field name; the pick reads in the caret, as first + ellipsis beyond one.
   *
   * A FILTER menu prepends its CONDITION, so a chip reading "Tier: Gold" and
   * one reading "Tier: Starts with Go" cannot be mistaken for each other.
   * `Equals` is left off — it is the default, and saying it on every chip is
   * noise. TRAP T-an-operator-decides-pick-or-type
   */
  #syncLabelForSelection(values: string[]): void {
    this.#field ??= this.dataset['label'] ?? null;
    const field = this.#field;
    if (field == null) return;
    this.dataset['label'] = field;

    const menu = this.menu as (HTMLElement & { op?: string; conditionValue?: string }) | null;
    const op = (menu?.dataset?.['op'] ?? DEFAULT_OP) as FilterOp;
    const isFilter = menu?.getAttribute('data-type') === 'filter';

    /* The BADGE wears the condition as a sign, so the caret keeps the whole
       width for the VALUE. `eq` is the default and gets none.
       TRAP T-an-operator-decides-pick-or-type */
    // `eq` HAS a sign, but a badge on every default chip is noise.
    const named = isFilter && op !== DEFAULT_OP;
    this.#condition = named ? OP_SYMBOLS[op] : '';
    // A screen reader hears the WORD; only the badge wears the sign.
    this.#conditionName = named ? OP_LABELS[op] : '';

    // A TYPING condition answers with what was typed, not with ticked rows.
    if (isFilter && (OP_TAKES[op] ?? 'list') === 'text') {
      this.valueLabel = (menu?.conditionValue ?? '').trim();
      this.#syncBadge(0);
      return;
    }

    const first = values.length ? this.#valueLabel(values[0]!) : '';
    this.valueLabel = values.length > 1 ? `${first}…` : first;
    this.#syncBadge(values.length);
  }

  /** The condition's sign, or '' for the default. */
  #condition = '';

  /** The same condition in words, for the badge's accessible name. */
  #conditionName = '';

  /**
   * The badge says how many, or WHICH CONDITION when there is only one value.
   *
   * A count and a condition cannot both fit, and the count is the one a reader
   * can get elsewhere — the caret already shows the value, and the menu shows
   * the ticks. So several picks keep the number.
   */
  #syncBadge(count: number): void {
    if (count > 1) {
      this.dataset['count'] = String(count);
      return;
    }
    if (this.#condition) {
      this.dataset['count'] = this.#condition;
      // A sign announces as nothing; the word is what a reader needs.
      this.$('.count')?.setAttribute('aria-label', this.#conditionName);
      return;
    }
    this.$('.count')?.removeAttribute('aria-label');
    delete this.dataset['count'];
  }

  /** Is this chip's menu on a typing condition with something typed? */
  #hasTypedAnswer(): boolean {
    const menu = this.menu as (HTMLElement & { conditionValue?: string }) | null;
    if (menu?.getAttribute('data-type') !== 'filter') return false;
    const op = (menu.dataset?.['op'] ?? DEFAULT_OP) as FilterOp;
    if ((OP_TAKES[op] ?? 'list') !== 'text') return false;
    return (menu.conditionValue ?? '').trim() !== '';
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
