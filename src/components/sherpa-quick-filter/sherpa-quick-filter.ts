/**
 * sherpa-quick-filter — a filter chip you can toggle, with an optional value menu.
 *
 * @see TRAP T-chip-menu-is-a-boolean-state, TRAP T-one-pick-reads-field-and-value,
 * TRAP T-scope-does-not-stop-inheritance, TRAP T-icon-only-is-purely-css
 */
import { DATA_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import { DEFAULT_OP, OP_TAKES, type FilterOp, valueSet } from '../../core/data/store.js';
import {
  fieldState, filterFace, type FieldCondition, type FilterFace, type FilterState,
} from '../../core/data/filter-state.js';
import { NON_VALUE_ROWS } from '../../core/ui/shared-constants.js';
// Floating, so the count tooltip escapes the toolbar's clipping chip run.
import '../sherpa-tooltip/sherpa-tooltip.js';

/** One place a jump chip can scroll to — `value` is the target element's id. */
interface JumpItem {
  value: string;
  label?: string;
}

interface MenuLike extends HTMLElement {
  // show/hide, not toggle — see #openMenu for why the click cannot ask the menu.
  show?: (trigger?: HTMLElement) => void;
  hide?: () => void;
  values?: string[];
}

export class SherpaQuickFilter extends SherpaElement {
  static override css = new URL('./sherpa-quick-filter.css', import.meta.url);
  static override html = new URL('./sherpa-quick-filter.html', import.meta.url);
  static override props = {
    'data-icon-only': { type: 'boolean', kind: 'style' },
    /* The menu is open. CSS reads it for the pressed look — real focus has
       moved INSIDE the menu, so `:focus-visible` on the chip is false — and
       the caret click reads it to decide open-or-shut, because the popover
       light-dismisses before the click lands.
       TRAP T-a-trigger-click-follows-light-dismiss */
    'data-open': { type: 'boolean', kind: 'style' },
    'data-indicator': { type: 'boolean', kind: 'style' },
    'data-menu': { type: 'boolean', kind: 'style' },
    'data-type': { type: 'enum', kind: 'style', values: ['ai', 'jump'] },
    'data-plain': { type: 'boolean', kind: 'style' },
    'data-no-value': { type: 'boolean', kind: 'style' },
    'data-full-value': { type: 'boolean', kind: 'style' },
    'data-unsupported': { type: 'boolean', kind: 'style' },
    /* A VIEW filter now owns this field, so this chip is SUSPENDED, not gone:
       it keeps its value and comes back when the view lets the field go.
       TRAP T-a-superseded-chip-suspends-it-is-never-removed */
    'data-superseded': { type: 'boolean', kind: 'style' },
    /* Written BY the chip: its menu is answering with CONDITIONS, not ticks.
       TRAP T-a-conditioned-chip-reads-as-info */
    'data-conditioned': { type: 'boolean', kind: 'style' },
    /* A filter PANEL is drawing this field instead, so the bar hides the chip.
       Written by the HOST. TRAP T-the-view-chip-stays-on-the-header */
    'data-panelled': { type: 'boolean', kind: 'style' },
    /* WHERE this field is filtered instead — "App header", "View". Shown in the
       tooltip of a chip that is off because something else owns its field: an
       inactive chip that says nothing tells a reader their filter vanished.
       The HOST names the place; the chip cannot know it.
       TRAP T-an-inactive-chip-says-where-its-filter-went */
    'data-applied-at': { type: 'string', kind: 'style' },
    'data-count': { type: 'string', kind: 'content', to: '.count' },
    /* WHICH FIELD this chip filters. The toolbar writes it on every chip and
       selects on it; the chip reads it to name its own state. */
    'data-id': { type: 'string', kind: 'style' },
    'data-locked': DATA_PROPS['data-locked'],
    /* The chip stays on the bar when off, instead of being removed. */
    'data-persistent': { type: 'boolean', kind: 'style' },
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
    this.addEventListener('menu-select', this.#onJump as EventListener);
  }

  /**
   * populate([{ value, label }]) — a JUMP chip's places, as action rows in its
   * menu. Any other chip keeps the default: payload keys onto its attributes.
   */
  protected override renderData(data: unknown): Promise<void> | void {
    if (this.dataset['type'] !== 'jump' || !Array.isArray(data)) return super.renderData(data);
    const menu = this.menu;
    const row = this.$<HTMLTemplateElement>('template.jump-item-tpl')?.content.firstElementChild;
    if (!menu || !row) return;
    menu.replaceChildren(...(data as JumpItem[]).map(({ value, label }) => {
      const button = row.cloneNode(true) as HTMLButtonElement;
      button.value = value;
      button.textContent = label ?? value;
      return button;
    }));
  }

  /** A jump row: scroll to its target, then report it. */
  #onJump = (event: CustomEvent<{ value: string; label: string }>): void => {
    if (this.dataset['type'] !== 'jump') return;
    // Reported as a jump, not as a raw menu row a toolbar might read as its own.
    event.stopPropagation();
    const { value, label } = event.detail;
    // No `behavior`: the scroller's own CSS decides, so the motion gate still holds.
    (this.getRootNode() as Document | ShadowRoot).getElementById(value)?.scrollIntoView({ block: 'start' });
    this.emit('jump-select', { value, label });
  };

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
    /* The tooltip says WHY a chip is off, so it must follow the two attributes
       that decide that — neither touches the values, so nothing else re-syncs
       it. TRAP T-an-inactive-chip-says-where-its-filter-went */
    else if (name === 'data-superseded' || name === 'data-applied-at') {
      this.#syncCountTip((this.menu?.values ?? []) as string[]);
    } else this.#syncText();
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
    /* A CONDITIONED chip has no ticks and is NOT empty — its rows are its
       answer. Its body toggles, like any other answered chip.
       TRAP T-toggling-a-conditioned-chip-suspends-its-condition */
    if (menu && this.values.length === 0 && !this.hasAttribute('data-conditioned')) {
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
   *
   * `data-open` decides, NOT `menu.open`: the native popover light-dismisses on
   * pointerdown, so by the time the click lands an open menu already reads shut
   * and `toggle()` re-opens what the reader just closed. Measured before this:
   * open, open, open. TRAP T-a-trigger-click-follows-light-dismiss
   */
  #openMenu(anchor?: HTMLElement): void {
    const wasOpen = this.hasAttribute('data-open');
    this.removeAttribute('data-open');
    if (wasOpen) this.menu?.hide?.();
    else this.menu?.show?.(anchor ?? this);
  }

  #onCaret = (event: Event): void => {
    if (this.hasAttribute('disabled')) return;
    event.stopPropagation(); // opening the menu must not toggle the chip
    this.#openMenu();
  };

  /**
   * Open or shut this chip's menu — what a HOST calls to drive the chip from
   * outside. It routes through the same light-dismiss-safe path a caret click
   * takes, so an external opener cannot get the stuck-open behaviour back.
   * TRAP T-a-trigger-click-follows-light-dismiss
   */
  toggleMenu(anchor?: HTMLElement): void {
    this.#openMenu(anchor);
  }

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
    this.#recheckConditions();
    this.emit('quick-filter-change', { scope: 'chip', values });
  };

  /**
   * Flag "on, but filtering by nothing" so CSS can warn.
   * TRAP T-empty-flag-needs-rows-to-count — a PERSISTENT or LOCKED chip is exempt.
   */
  /**
   * What the tooltip says. A chip with values describes them; one that is OFF
   * because another control owns its field says SO, because "no tooltip" reads
   * as "nothing here" — and the reader's own filter has not gone anywhere.
   * TRAP T-an-inactive-chip-says-where-its-filter-went
   */
  #tipText(values: string): string {
    const where = this.dataset['appliedAt'];
    if (this.hasAttribute('data-superseded')) {
      const place = where ? `the ${where}` : 'another filter';
      // The VALUES too where there are any: they come back when the field is free.
      return values
        ? `Filtered by ${place}. This chip holds ${values}.`
        : `Filtered by ${place}.`;
    }
    return values;
  }

  #syncEmpty(): void {
    if (this.hasAttribute('data-persistent') || this.hasAttribute('data-locked')) {
      this.removeAttribute('data-empty');
      return;
    }
    const menu = this.menu;
    /* A CONDITION is an answer of a different kind, and it reads differently:
       info, never the plain on-tint. TRAP T-a-conditioned-chip-reads-as-info */
    /* ANSWERED rows, not merely present ones: a menu in condition mode always
       holds one row, and an unanswered row is not a condition.
       TRAP T-an-untouched-select-is-not-an-answer */
    const conditioned = menu?.dataset?.['mode'] === 'condition' && this.#hasTypedAnswer();
    this.toggleAttribute('data-conditioned', conditioned);

    /* A TYPED condition is an answer, so a chip holding one is not empty —
       "Contains Ravi" filters, and painting it as "filtering nothing" is a
       lie. TRAP T-an-operator-decides-pick-or-type */
    const empty = !!menu && this.current && !conditioned
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
    if (tip) tip.dataset['text'] = this.#tipText(face.tip);
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
    this.#recheckConditions();
  };

  /**
   * Read the rows AGAIN once the menu has settled.
   *
   * A rebuilt row's value select is filled asynchronously — `populate()` on a
   * composed field settles later — so a single read right after a rebuild sees
   * an unanswered row and switches this chip OFF while it is filtering.
   * TRAP T-a-rebuilt-row-reads-empty-for-a-tick
   */
  #recheckConditions(): void {
    const menu = this.menu as (HTMLElement & { dataset: DOMStringMap }) | null;
    if (menu?.dataset['mode'] !== 'condition') return;
    if (this.#recheck != null) return;
    this.#recheck = requestAnimationFrame(() => {
      this.#recheck = null;
      /* ONLY UP. This exists to catch a row whose answer arrived a tick late —
         never to overrule a reader who just switched the chip off.
         TRAP T-toggling-a-conditioned-chip-suspends-its-condition */
      if (this.current || !this.#hasTypedAnswer()) return;
      this.#applySelection((this.menu?.values ?? []) as string[]);
    });
  }

  #recheck: number | null = null;

  override onDisconnect(): void {
    if (this.#recheck != null) cancelAnimationFrame(this.#recheck);
    this.#recheck = null;
  }

  /**
   * This chip's state, read off its menu.
   *
   * ONE read, into the shared model — the badge, the caret, the count and the
   * tooltip all come back from `filterFace`, so the chip draws rather than
   * decides. TRAP T-one-state-per-filtered-field
   */
  #state(values: string[]): FilterState {
    const menu = this.menu as (HTMLElement & {
      conditionValue?: string; conditions?: FieldCondition[];
    }) | null;
    const isFilter = menu?.getAttribute('data-type') === 'filter';
    /* CONDITION mode answers with ROWS, so the whole chain goes in. The badge
       and the tip both come back from it. TRAP T-a-condition-badge-says-that-not-which */
    const rows = isFilter && menu?.dataset['mode'] === 'condition'
      ? (menu.conditions ?? []) : [];
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
        conditions: rows,
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
    const menu = this.menu as (HTMLElement & {
      conditionValue?: string;
      conditions?: { op: FilterOp; text?: string; picked?: unknown[] }[];
    }) | null;
    if (menu?.getAttribute('data-type') !== 'filter') return false;

    /* CONDITION mode answers with ROWS, and ANY answered row is an answer. A
       chip reading row one only stayed off while three rows filtered.
       TRAP T-a-filter-menu-has-two-modes */
    if (menu.dataset?.['mode'] === 'condition') {
      return (menu.conditions ?? []).some((row) =>
        (OP_TAKES[row.op] ?? 'list') === 'text'
          ? (row.text ?? '').trim() !== ''
          : (row.picked ?? []).length > 0);
    }

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
