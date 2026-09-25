/**
 * sherpa-quick-filter — one chip; knows its KIND, so Group toggles and Sort cycles on their own.
 *
 * @see TRAP T-chip-menu-is-a-boolean-state, TRAP T-one-pick-reads-field-and-value,
 * TRAP T-scope-does-not-stop-inheritance, TRAP T-icon-only-is-purely-css
 */
import { DATA_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import {
  DEFAULT_OP, OP_TAKES, type FilterOp, type SortDirection, valueSet,
} from '../../core/data/store.js';
import {
  fieldState, type FieldCondition, type FilterState,
} from '../../core/data/filter-state.js';
import { filterFace, type FilterFace } from '../../core/data/filter-face.js';
import { NON_VALUE_ROWS, ORGANISE_ICONS } from '../../core/ui/shared-constants.js';
import { arranges, FILTER_KINDS, type FilterKind } from '../../core/ui/filter-kind.js';
import { nextSort, sortDirectionFrom } from '../../core/data/cycle.js';
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
    /* WHAT THIS CHIP IS. `group` and `sort` ARRANGE rows; they do not choose
       them, so they have no values to be empty of and they own their own
       gesture — group toggles, sort cycles asc → desc → off.
       "Organise" is NOT a kind: it is a heading a panel draws above the two.
       TRAP T-a-chip-knows-what-kind-it-is */
    'data-kind': { type: 'enum', kind: 'style', values: [...FILTER_KINDS] },
    /* WHICH COLUMN a group or sort chip arranges by, for a host that draws the
       choice without a menu. A menu, where there is one, is the answer.
       TRAP T-a-chip-knows-what-kind-it-is */
    'data-column': { type: 'string', kind: 'style' },
    /* WHICH WAY a sort chip points. It REMEMBERS the direction; `data-current`
       says whether it runs, so a suspended sort resumes the way it was.
       TRAP T-off-is-not-forgotten */
    'data-direction': { type: 'enum', kind: 'style', values: ['asc', 'desc'] },
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
    /* GROUP and SORT draw their OWN column and glyph, from the state they were
       given. A host that stamped `data-direction` and `data-current` has said
       everything; nothing else needs to paint it.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (this.#arranges()) this.#drawArrangement();
    const initial = this.menu?.values ?? [];
    if (initial.length) {
      this.#syncLabelForSelection(initial);
      this.#syncCountTip(initial);
      if (initial.length > 1) this.dataset['count'] = String(initial.length);
    }
  }

  override onChange(name: string): void {
    /* THE CHIP DRAWS ITSELF. A host says what the state IS — on, which way,
       which column — and never paints the caret or the glyph for it. Two hosts
       painting it is how Group came to forget its column when switched off
       while Sort remembered: one of the two blanked the caret.
       TRAP T-off-is-not-forgotten */
    if (this.#arranges()) this.#drawArrangement();
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

  /** The chip's value menu, if it has one.
   *
   *  A filter PANEL borrows the menu out of the chip — it loses its `slot` and
   *  is appended somewhere else entirely — so the slot query alone found
   *  nothing and the chip read as having no values at all. The menu is
   *  remembered when it is first seen, so a borrowed one is still the chip's.
   *  TRAP T-a-borrowed-menu-is-still-its-chips */
  get menu(): MenuLike | null {
    const slotted = this.querySelector<MenuLike>('[slot="menu"]');
    if (slotted) {
      this.#menu = slotted;
      return slotted;
    }
    // Borrowed, but only while it is still on the page.
    return this.#menu?.isConnected ? this.#menu : null;
  }
  /** The slotted menu, cached once found. */
  #menu: MenuLike | null = null;

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

  /** Write the label and the glyph into the shadow DOM. */
  #syncText(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
    // TRAP T-icon-writes-to-both-slots — `.icon` leads the body, `.caret-icon`
    // serves an icon-only chip, and CSS picks which is visible.
    const glyph = this.dataset['iconStart'];
    for (const icon of this.$$('.icon, .caret-icon')) this.writeIcon(icon, glyph ?? '');
  }

  /** GROUP or SORT: it arranges rows rather than choosing them. */
  #arranges(): boolean {
    return arranges(this.dataset['kind'] as FilterKind);
  }

  /**
   * The column this chip arranges by.
   *
   * Its MENU's own pick, where it has one. A host that draws the choice some
   * other way — a run of options, a saved view — names it in `data-column`
   * instead; the menu wins whenever there is a menu to ask.
   */
  get column(): string {
    /* THE MENU FIRST, the attribute second. A menu stamps its rows on its own
       upgrade, so for one tick it reads unpicked — and a host that seeded the
       column would have had it forgotten. Its rows are RADIOS, so this can
       only ever fall back, never overrule a pick.
       TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
    const ticked = this.menu
      ? this.querySelector<HTMLInputElement>('[slot="menu"] input:checked')?.value
      : undefined;
    return ticked || this.dataset['column'] || '';
  }

  /** Which way a SORT chip is pointing, or null when it is off. */
  get direction(): SortDirection | null {
    if (!this.current) return null;
    return sortDirectionFrom(this.dataset['direction']) ?? 'asc';
  }

  /**
   * The chip's own gesture, for the two kinds that have one.
   *
   * GROUP toggles. SORT cycles asc → desc → suspended → asc, from `nextSort()`
   * in the data layer — the same step the grid's column heading takes. Written
   * separately in the toolbar and the panel, the two drifted every time.
   * TRAP T-a-chip-knows-what-kind-it-is · TRAP T-one-cycle-for-one-value
   * TRAP T-sort-is-tri-state · TRAP T-group-chip-body-toggles-grouping
   * TRAP T-a-chip-body-cycles-its-states
   * TRAP T-an-organise-chip-is-named-for-its-job-not-its-field
   */
  #arrange(): void {
    const field = this.column;
    /* NO COLUMN, NOTHING TO ARRANGE. Turning it on would light a chip that
       sorts by nothing, and a reader who has not chosen has done nothing
       wrong. TRAP T-an-organise-chip-has-no-values */
    if (!field) {
      this.current = false;
      this.#drawArrangement();
      return;
    }
    if (this.dataset['kind'] === 'group') {
      this.current = !this.current;
      this.#drawArrangement();
      this.emit('group-change', { field: this.current ? field : null });
      return;
    }
    const next = nextSort(field, this.current ? field : null, this.direction);
    this.#applySort(next.field, next.direction);
  }

  /** A column was picked from the menu: apply it and say so. */
  #arrangeFromMenu(): void {
    const field = this.column;
    if (this.dataset['kind'] === 'group') {
      this.current = !!field;
      this.#drawArrangement();
      this.emit('group-change', { field: field || null });
      return;
    }
    // The way it is ALREADY pointing — picking a column does not rewind it.
    this.#applySort(field, field ? sortDirectionFrom(this.dataset['direction']) ?? 'asc' : null);
  }

  /**
   * Apply a sort and report it — the ONE place a chip's direction is written.
   *
   * The attribute is the state channel a host reads back, and `asc` used to be
   * stamped at three moments by three owners: this cycle, the container that
   * built the chip, and that container's attribute sync.
   * TRAP T-one-cycle-for-one-value
   */
  #applySort(field: string | null, direction: SortDirection | null): void {
    // A suspended chip rewinds to `asc` — that is where a resume starts.
    this.dataset['direction'] = direction ?? 'asc';
    this.current = direction !== null;
    this.#drawArrangement();
    this.emit('sort-change', {
      field: direction === null ? null : field,
      direction: direction ?? 'asc',
    });
  }

  /** The column in the caret, and the glyph that says which way. */
  #drawArrangement(): void {
    if (!this.#arranges()) return;
    /* OFF IS NOT FORGOTTEN. A suspended arrangement keeps its column, so the
       caret still names it and one more click resumes exactly what was there.
       TRAP T-off-is-not-forgotten · TRAP T-grid-suspend-is-not-clear */
    const field = this.column;
    const row = this.querySelector<HTMLElement>(`[slot="menu"] input[value="${CSS.escape(field)}"]`)
      ?.closest<HTMLElement>('label, .menu-row');
    this.valueLabel = field ? (row?.textContent ?? '').trim() || field : '';
    if (this.dataset['kind'] === 'sort') {
      const dir = this.direction;
      this.setAttribute('data-icon-start', dir === null ? ORGANISE_ICONS.sortNone
        : dir === 'desc' ? ORGANISE_ICONS.sortDesc : ORGANISE_ICONS.sortAsc);
    }
  }

  /** The body was clicked: toggle, or let Group and Sort do their own thing. */
  #onClick = (event: Event): void => {
    if (this.hasAttribute('disabled')) return;

    /* A GROUP or SORT chip owns its own gesture, because what it does is a
       property of WHAT IT IS, not of which container drew it.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (this.#arranges()) {
      event.stopPropagation();
      if (!this.column) { this.#openMenu(); return; }
      this.#arrange();
      return;
    }

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
  /** Open the value menu, or close it if it is open. */
  #openMenu(anchor?: HTMLElement): void {
    const wasOpen = this.hasAttribute('data-open');
    this.removeAttribute('data-open');
    if (wasOpen) this.menu?.hide?.();
    else this.menu?.show?.(anchor ?? this);
  }

  /** The caret opens the menu without toggling the chip. */
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

  /** The menu changed: apply the picks — at once for an arrangement. */
  #onMenuChange = (event: Event): void => {
    const values = ((event as CustomEvent).detail?.values ?? []) as string[];
    /* AN ARRANGEMENT, not a filter: picking a column applies it AT ONCE and
       reports by its own name. A filter waits for Apply.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (this.#arranges()) { this.#arrangeFromMenu(); return; }
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

  /**
   * Flag "on, but filtering by nothing" so CSS can warn.
   * TRAP T-empty-flag-needs-rows-to-count — PERSISTENT, LOCKED and ORGANISE are exempt.
   */
  #syncEmpty(): void {
    /* `data-empty` means ON BUT FILTERING NOTHING. An organise chip never
       filters, so the question does not apply — and its menu picks a COLUMN,
       which reads as zero values the moment nothing is chosen.
       TRAP T-an-organise-chip-has-no-values */
    if (this.hasAttribute('data-persistent') || this.hasAttribute('data-locked')
      || this.#arranges()) {
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
    /* AND CHECK AGAIN. `data-empty` is the AMBER warning, and a rebuilt menu
       reads ZERO values until it stamps — so a bar that had just added or
       removed one filter could paint an unrelated chip as "on, filtering
       nothing". The recheck may only ever CLEAR a warning the menu has since
       answered; it never raises one.
       TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    if (empty && menu) this.#recheckEmpty(menu);
  }

  /** Drop a warning the menu answers once it has stamped. Never raises one. */
  #recheckEmpty(menu: MenuLike): void {
    const token = ++this.#emptyCheck;
    void Promise.resolve((menu as { rendered?: Promise<void> }).rendered)
      .then(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
      .then(() => {
        // A later check has already answered; this one is stale.
        if (token !== this.#emptyCheck || !this.isConnected) return;
        const answered = (menu.values?.length ?? 0) > 0
          || menu.dataset?.['mode'] === 'condition'
          || this.#hasTypedAnswer();
        if (answered) this.removeAttribute('data-empty');
      });
  }

  /** The pending check for "on, but filtering nothing". */
  #emptyCheck = 0;

  /** The tooltip: the values or the condition, in words. */
  #syncCountTip(values: string[]): void {
    /* The CONDITION in words: the badge only says THAT one applies.
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

  /** A condition row changed: re-derive the face from it. */
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

  /** The pending recheck after a condition row rebuilds. */
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
  /** One pick reads "Field: Value"; none or several reads the field alone. */
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
