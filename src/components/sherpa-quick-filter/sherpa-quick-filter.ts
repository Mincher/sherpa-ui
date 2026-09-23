/**
 * sherpa-quick-filter — a filter chip you can toggle, with an optional value menu.
 *
 * @see TRAP T-chip-menu-is-a-boolean-state, TRAP T-one-pick-reads-field-and-value,
 * TRAP T-scope-does-not-stop-inheritance, TRAP T-icon-only-is-purely-css
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { DEFAULT_OP, OP_TAKES, type FilterOp, valueSet } from '../../core/data/store.js';
import {
  fieldState, filterFace, type FilterFace, type FilterState,
} from '../../core/data/filter-state.js';
import { NON_VALUE_ROWS } from '../../core/ui/shared-constants.js';
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
    /* WHICH FIELD this chip filters. The toolbar writes it on every chip and
       selects on it; the chip reads it to name its own state. */
    'data-id': { type: 'string', kind: 'style' },
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
    /* The menu's rows can arrive AFTER this chip connects — a toolbar hands
       them over once the chip is in the page — and pre-ticked rows fire no
       native change. TRAP T-chip-empty-check-waits-for-onconnect */
    this.addEventListener('menu-items', this.#onMenuItems as EventListener);
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
    this.#syncBadge(filterFace(this.#state(values)));
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
    /* The CONDITION in words, never the sign: a tooltip is where a reader goes
       to find out what `!∷` means, so showing it again answers nothing.
       TRAP T-one-state-per-filtered-field */
    const face = filterFace(this.#state(values));

    // `data-text` is sherpa-tooltip's own API — the component writes the bubble.
    const tip = this.$<HTMLElement>('.count-wrap');
    if (tip) tip.dataset['text'] = face.tip;
    const badge = this.$('.count');
    if (!badge) return;
    if (face.count > 1) {
      const labels = values.map((v) => this.#valueLabel(v));
      const count = `${face.count} selected: ${labels.join(', ')}`;
      badge.setAttribute('aria-label', face.condition ? `${face.condition}, ${count}` : count);
    } else badge.removeAttribute('aria-label');
  }

  /**
   * The menu's condition changed — the caret says which, and a TYPED answer
   * switches the chip on by itself.
   *
   * Ticked rows are not the only way a filter chip holds a value: "Starts with
   * Go" narrows just as much, and a chip that stays off while its menu filters
   * is a chip that lies. TRAP T-an-operator-decides-pick-or-type
   */
  /**
   * The menu just stamped its rows — read this chip's FACE off them.
   *
   * The LABEL and the badge only. A chip's on/off is the host's to set — a
   * filter added from the Add menu arrives ON with nothing ticked, so deriving
   * it here would switch it straight back off.
   * TRAP T-chip-empty-check-waits-for-onconnect
   */
  #onMenuItems = (): void => {
    const values = (this.menu?.values ?? []) as string[];
    if (!values.length) return;
    this.#syncLabelForSelection(values);
    this.#syncCountTip(values);
    this.#syncBadge(filterFace(this.#state(values)));
  };

  #onCondition = (): void => {
    this.#applySelection((this.menu?.values ?? []) as string[]);
  };

  /**
   * This chip's state, read off its menu.
   *
   * ONE read, into the shared model — the badge, the caret, the count and the
   * tooltip all come back from `filterFace`, so the chip draws rather than
   * decides. TRAP T-one-state-per-filtered-field
   */
  #state(values: string[]): FilterState {
    const menu = this.menu as (HTMLElement & { conditionValue?: string }) | null;
    const isFilter = menu?.getAttribute('data-type') === 'filter';
    const all = [...this.querySelectorAll<HTMLInputElement>('[slot="menu"] input')]
      .filter((i) => !i.closest(NON_VALUE_ROWS))
      .map((i) => i.value);
    return fieldState(
      {
        field: this.dataset['id'] ?? this.dataset['label'] ?? '',
        label: this.#field ?? this.dataset['label'] ?? '',
        values: all,
        labels: Object.fromEntries(all.map((v) => [v, this.#valueLabel(v)])),
      },
      {
        picked: values,
        op: isFilter ? ((menu?.dataset['op'] ?? DEFAULT_OP) as FilterOp) : DEFAULT_OP,
        text: isFilter ? (menu?.conditionValue ?? '') : '',
      },
    );
  }

  /**
   * TRAP T-caret-carries-the-value-not-the-label — the chip label is ALWAYS the
   * field name; the pick reads in the caret.
   */
  #syncLabelForSelection(values: string[]): void {
    this.#field ??= this.dataset['label'] ?? null;
    const field = this.#field;
    if (field == null) return;
    this.dataset['label'] = field;

    const face = filterFace(this.#state(values));
    this.valueLabel = face.value;
    this.#syncBadge(face);
  }

  /**
   * The badge says how many, or WHICH CONDITION when there is only one value.
   *
   * A count and a condition cannot both fit, and the count is the one a reader
   * can get elsewhere — the caret already shows the value, and the menu shows
   * the ticks. So several picks keep the number.
   */
  #syncBadge(face: FilterFace): void {
    if (face.count > 1) {
      this.dataset['count'] = String(face.count);
      return;
    }
    if (face.badge) {
      this.dataset['count'] = face.badge;
      // A sign announces as nothing; the word is what a reader needs.
      this.$('.count')?.setAttribute('aria-label', face.condition);
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
