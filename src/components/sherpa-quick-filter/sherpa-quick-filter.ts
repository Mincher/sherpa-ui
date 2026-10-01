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
  fieldState, readingRows, type FieldCondition, type FieldReading, type FilterState,
} from '../../core/data/filter-state.js';
import { filterFace } from '../../core/data/filter-face.js';
import { NON_VALUE_ROWS, NOT_AVAILABLE, ORGANISE_ICONS, RULED_OUT, SET_ASIDE, movedTo } from '../../core/ui/shared-constants.js';
import { arranges, FILTER_KINDS, type FilterKind } from '../../core/ui/filter-kind.js';
import { nextSort, sortDirectionFrom } from '../../core/data/cycle.js';
// Floating, so the count tooltip escapes the toolbar's clipping chip run.
import '../sherpa-tooltip/sherpa-tooltip.js';
import { paintSeries } from '../../core/ui/chart-parts.js';

/** A results count as the reader's locale writes it. */
const RESULTS = new Intl.NumberFormat();

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
  mode?: string;
}

/** A menu that answers a FIELD — a list, a number or a date. */
interface FieldMenu extends MenuLike {
  reading: FieldReading;
  conditionValue?: string;
  conditions?: readonly FieldCondition[];
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
    /* A data-viz series, from 1: the chip leads with its swatch. */
    'data-swatch': { type: 'string', kind: 'style' },
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
    /* The other filters rule this value out: greyed, and refused while off — on,
       it is set aside and may be let go. Written by its host. Will, TODO 174
       and 180. TRAP T-a-ruled-out-value-is-greyed */
    'data-unavailable': { type: 'boolean', kind: 'style' },
    /* Written BY the chip: which condition it holds — `state.condition`.
       TRAP T-a-conditioned-chip-reads-as-active */
    'data-condition': { type: 'enum', kind: 'style', values: ['simple', 'advanced'] },
    /* Changed, not yet applied: the active edge, no fill. Written by the BAR —
       the one writer. TRAP T-a-pending-chip-has-no-fill */
    'data-pending': { type: 'boolean', kind: 'style' },
    /* A saved filter CHANGED, not saved: the pending look, and it still
       counts. Written by the bar or panel. TRAP T-a-saved-filter-keeps-its-edit */
    'data-edited': { type: 'boolean', kind: 'style' },
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
  static override observed = ['data-label', 'data-icon-start', 'data-current', 'aria-label', 'disabled'];

  override onRender(): void {
    this.#syncText();
    // A name given before the first render is said now.
    this.#writeTip();
    this.#paintSwatch();
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
    // Its calendar's pick: the face says the day, or the two. TRAP T-a-chip-says-its-own-answer
    this.addEventListener('datetime-change', this.#onDated);
    this.addEventListener('range-select', this.#onDated);
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
    // A greyed chip says why. Will, TODO 176.
    if (name === 'data-unavailable' || name === 'disabled') return this.#writeTip();
    /* THE CHIP DRAWS ITSELF. A host says what the state IS — on, which way,
       which column — and never paints the caret or the glyph for it. Two hosts
       painting it is how Group came to forget its column when switched off
       while Sort remembered: one of the two blanked the caret.
       TRAP T-off-is-not-forgotten */
    if (this.#arranges()) this.#drawArrangement();
    if (name === 'aria-label' || name === 'data-current') this.#writeTip();
    if (name === 'data-swatch') return this.#paintSwatch();
    if (name === 'data-current' || name === 'data-pending') this.#syncBadge();
    if (name === 'data-current') this.#syncEmpty();
    /* The tooltip says WHY a chip is off, so it must follow the two attributes
       that decide that — neither touches the values, so nothing else re-syncs
       it. TRAP T-an-inactive-chip-says-where-its-filter-went */
    else if (name === 'data-superseded' || name === 'data-applied-at') {
      this.#syncCountTip((this.menu?.values ?? []) as string[]);
    } else this.#syncText();
  }

  /** Give the swatch its series' hue and stroke — the legend's own paint. */
  #paintSwatch(): void {
    const n = Number(this.dataset['swatch']);
    const swatch = this.$<HTMLElement>('.swatch');
    if (swatch && Number.isInteger(n) && n > 0) paintSeries(swatch, n - 1, n);
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
   * TRAP T-value-label-is-the-callers-words — public for a host that draws a
   * value the chip cannot derive. The chip writes its own for every answer it
   * holds, a date included.
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
    // A DATE or NUMBER menu sets its own body. TRAP T-a-menu-owns-its-own-bodies
    if (menu.dataset['body']) (menu as HTMLElement & { values: readonly string[] }).values = next;
    else {
      for (const input of this.querySelectorAll<HTMLInputElement>('[slot="menu"] input')) {
        // The "All" row is a control, not a value; it derives from the rest.
        if (!input.closest(NON_VALUE_ROWS)) input.checked = want.has(input.value);
      }
    }
    // Read BACK, never trust the ask: a value naming no row never landed.
    this.#applySelection((menu.values ?? []) as string[]);
  }

  /** The menu that answers a FIELD, or null: a toggle, a selector, Group, Sort. */
  #fieldMenu(): FieldMenu | null {
    const menu = this.menu;
    const body = menu?.dataset['body'];
    return menu && (body === 'number' || body === 'date' || menu.getAttribute('data-type') === 'filter')
      ? menu as FieldMenu : null;
  }

  /**
   * reading — the chip's WHOLE answer as its menu holds it, and `suspended`
   * while the chip is OFF. Null: it answers no field. SET draws the answer,
   * on or off, and the face — SILENT, as every steer is.
   * TRAP T-a-chip-says-its-own-answer · TRAP T-grid-suspend-is-not-clear
   */
  get reading(): FieldReading | null {
    const menu = this.#fieldMenu();
    return menu ? { ...menu.reading, ...(this.current ? {} : { suspended: true }) } : null;
  }
  set reading(next: FieldReading) {
    const menu = this.#fieldMenu();
    if (!menu) return;
    const body = menu.dataset['body'];
    /* A NUMBER takes its WHOLE reading: which shape is in force, and the one
       kept. TRAP T-both-shapes-are-kept · TRAP T-a-menu-owns-its-own-bodies */
    if (body === 'number') {
      menu.reading = next;
      // In Advanced its ROWS answer it. TRAP T-a-number-has-advanced-rows
      const answered = menu.mode === 'advanced' ? readingRows(next).length > 0
        : (next.picked ?? []).length > 0 || (next.text ?? '').trim() !== '';
      this.current = answered && !next.suspended;
      // TRAP T-a-silent-steer-still-redraws-its-chip
      this.refresh();
      return;
    }
    /* A DATE takes its answer as it reports it: one day, or two ends. Through
       the menu's own door, which keeps a reading given before it has drawn. */
    if (body === 'date') {
      menu.reading = next;
      this.#applySelection((menu.values ?? []) as string[]);
      const days = (next.text ?? '').trim() ? 1 : (next.picked ?? []).length;
      this.current = days > 0 && !next.suspended;
      this.refresh();
      return;
    }
    /* BOTH ANSWERS, and the mode the reading names. A steer carrying rows IS
       the opt-in reaching the menu.
       TRAP T-both-answers-are-kept · TRAP T-many-conditions-are-one-reading */
    const rows = readingRows(next);
    if (rows.length) menu.setAttribute('data-advanced', '');
    menu.reading = next;
    if (menu.mode === 'advanced') {
      this.current = rows.length > 0 && !next.suspended;
      this.refresh();
      return;
    }
    this.#setPicks((next.picked ?? []).map(String), next.suspended);
  }

  /** Picks, and OFF where there are none or the answer is suspended.
   *  TRAP T-everything-on-is-no-filter */
  #setPicks(picks: readonly string[], off = false): void {
    this.values = picks;
    if (!picks.length || off) this.current = false;
  }

  /**
   * clear(op) — EMPTY the chip, whatever answers it, and switch it off: a
   * list's ticks, typing and rows, a number's two shapes, a date's days.
   * SILENT. `op` is the condition a list goes back to.
   * TRAP T-empty-is-every-kind-of-answer
   */
  clear(op: FilterOp = DEFAULT_OP): void {
    const menu = this.#fieldMenu();
    if (menu?.dataset['body'] === 'number') {
      // BOTH shapes: `values = []` empties only the one in force.
      menu.reading = { picked: [] };
      this.current = false;
      this.refresh();
      return;
    }
    if (menu && !menu.dataset['body']) {
      menu.dataset['op'] = op;
      menu.conditionValue = '';
      if ((menu.conditions ?? []).length) menu.conditions = [];
      menu.mode = 'simple';
    }
    if (this.hasAttribute('data-menu')) return this.#setPicks([]);
    this.removeAttribute('data-current');
    for (const input of this.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
  }

  /** Does the chip hold an answer — a pick, a day, a number, typing or a row? */
  get answered(): boolean {
    return this.values.length > 0 || this.#hasTypedAnswer();
  }

  /** Everything the chip derives from its picks. */
  #applySelection(values: string[]): void {
    // A TYPING condition answers with text, so the chip is on without a tick.
    this.current = values.length > 0 || this.#hasTypedAnswer();
    this.#syncLabelForSelection(values);
    this.#syncCountTip(values);
    this.#syncBadge();
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

  /**
   * arrangeBy(field, direction) — steer a GROUP or SORT chip: its column, and
   * for a sort which way. SILENT, like every steer. No field is OFF, and the
   * chip keeps the column it had; a sort with `''` for its direction is
   * suspended, and resumes ascending. The CHIP's own, so a bar and a panel
   * follow the same attributes the same way.
   * TRAP T-a-chip-body-cycles-its-states · TRAP T-off-is-not-forgotten
   * TRAP T-a-suspended-sort-is-one-owners-job · TRAP T-one-cycle-for-one-value
   */
  arrangeBy(field: string, direction?: string | null): void {
    if (!this.#arranges()) return;
    if (!field) {
      this.removeAttribute('data-current');
      this.#drawArrangement();
      return;
    }
    /* NAME THE COLUMN, then tick it. A rebuilt menu has no rows for a frame, so
       the tick can miss — `data-column` is what the chip reads until it lands.
       TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
    this.dataset['column'] = field;
    for (const radio of this.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.checked = radio.value === field;
    }
    const suspended = this.dataset['kind'] === 'sort' && direction === '';
    if (this.dataset['kind'] === 'sort') {
      this.dataset['direction'] = suspended ? 'asc' : sortDirectionFrom(direction ?? undefined) ?? 'asc';
    }
    this.toggleAttribute('data-current', !suspended);
    this.#drawArrangement();
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
    const dir = this.dataset['kind'] === 'sort' ? this.direction : null;
    if (this.dataset['kind'] === 'sort') {
      this.setAttribute('data-icon-start', dir === null ? ORGANISE_ICONS.sortNone
        : dir === 'desc' ? ORGANISE_ICONS.sortDesc : ORGANISE_ICONS.sortAsc);
    }
    // The tip says the column, and for a sort which WAY. Will, TODO 125.
    const way = dir === 'desc' ? 'descending' : dir === 'asc' ? 'ascending' : '';
    this.#said = this.current && this.valueLabel ? [this.valueLabel, way].filter(Boolean).join(', ') : '';
    this.#writeTip();
  }

  /** The body was clicked: toggle, or let Group and Sort do their own thing. */
  #onClick = (event: Event): void => {
    if (this.hasAttribute('disabled') || this.#refused()) return;

    /* A GROUP or SORT chip owns its own gesture, because what it does is a
       property of WHAT IT IS, not of which container drew it.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (this.#arranges()) {
      event.stopPropagation();
      if (!this.column) { this.#openMenu(); return; }
      this.#arrange();
      return;
    }

    const menu = this.menu as (HTMLElement & { dirty?: boolean; apply?: () => void }) | null;
    /* AN OPEN DRAFT IS APPLIED. A reader who typed a condition or ticked a
       value, then pressed the chip, meant "filter by that" — and closing the
       menu threw it away. TRAP T-a-chip-press-applies-its-menus-draft */
    if (menu?.dirty && this.hasAttribute('data-open')) {
      event.stopPropagation();
      menu.apply?.();
      return;
    }

    /* TRAP T-an-empty-chip-opens-its-menu — the body cycles a chip's states
     * (TRAP T-a-chip-body-cycles-its-states), and an empty chip has none to cycle.
     * Only when there IS a menu: a toggle-only chip keeps toggling.
     */
    /* A CONDITIONED chip has no ticks and is NOT empty — its rows are its
       answer. Its body toggles, like any other answered chip.
       TRAP T-toggling-a-conditioned-chip-suspends-its-condition */
    if (menu && this.values.length === 0 && this.dataset['condition'] !== 'advanced') {
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
    // A chip with a MENU always opens it: its rows say what is left.
    if (this.hasAttribute('disabled') || (this.#refused() && !this.hasAttribute('data-menu'))) return;
    event.stopPropagation(); // opening the menu must not toggle the chip
    this.#openMenu();
  };

  /** Ruled out and OFF: nothing to press. On, it is set aside and may be let go. */
  #refused(): boolean {
    return this.hasAttribute('data-unavailable') && !this.current;
  }

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
    // A greyed chip says WHY, in a few words. Will, TODO 176.
    if (this.hasAttribute('data-unavailable')) return this.current ? SET_ASIDE : RULED_OUT;
    if (this.hasAttribute('disabled')) return NOT_AVAILABLE;
    if (this.hasAttribute('data-superseded')) {
      // The VALUES too where there are any: they come back when the field is free.
      const moved = movedTo(this.dataset['appliedAt']);
      return values ? `${moved} This chip holds ${values}.` : moved;
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
    if (!this.#answersForItself()) {
      this.removeAttribute('data-empty');
      return;
    }
    const menu = this.menu;
    const state = this.#state((menu?.values ?? []) as string[]);
    const advanced = this.#given() || state.condition === 'advanced';
    this.#syncCondition(state);
    this.#syncBadge();

    /* A TYPED condition is an answer, so a chip holding one is not empty —
       "Contains Ravi" filters, and painting it as "filtering nothing" is a
       lie. TRAP T-an-operator-decides-pick-or-type */
    const empty = !!menu && this.current && !advanced
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

  /** A chip whose state is its own — not a selector, not the host's, not an arrangement. */
  #answersForItself(): boolean {
    return !this.hasAttribute('data-persistent') && !this.hasAttribute('data-locked')
      && !this.#arranges();
  }

  /**
   * `data-condition` is `state.condition` — ASKED of the state. It paints
   * nothing: an Advanced chip is ON as a Simple one is.
   * TRAP T-a-conditioned-chip-reads-as-active · TRAP T-one-condition-system
   */
  #syncCondition(state: FilterState): void {
    if (!this.#answersForItself()) return;
    const condition = this.#given() ? 'advanced' : state.condition;
    if (condition) this.dataset['condition'] = condition;
    else this.removeAttribute('data-condition');
  }

  /** An ADVANCED chip with no filter menu holds a GIVEN answer — a saved filter.
   *  TRAP T-a-saved-filter-is-its-readings */
  #given(): boolean {
    // The old word still heard. TRAP T-a-renamed-attribute-keeps-its-old-name
    const kind = this.dataset['kind'];
    return (kind === 'advanced' || kind === 'custom') && this.menu?.getAttribute('data-type') !== 'filter';
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
          || menu.mode === 'advanced'
          || this.#hasTypedAnswer();
        if (answered) this.removeAttribute('data-empty');
      });
  }

  /** The pending check for "on, but filtering nothing". */
  #emptyCheck = 0;

  /** The tooltip: the values or the condition, in words — and the same words on
   *  the button for a screen reader, as the tooltip describes only itself.
   *  TRAP T-one-state-per-filtered-field */
  #syncCountTip(values: string[]): void {
    this.#said = filterFace(this.#state(values)).tip;
    this.#writeTip();
  }

  /** What the chip's answer says, in words — the tip before its matches. */
  #said = '';

  /**
   * WRITE THE TIP: the answer in words, then ` - X matches` while the chip
   * shows its results. The CHIP's own, whatever draws it — a bar, a panel, a
   * grid heading. Will, TODO 130. TRAP T-a-chip-says-its-own-answer
   */
  #writeTip(): void {
    // OFF, the badge keeps its number and the tip says nothing.
    const n = this.current ? this.#shownResults() : null;
    const matches = n == null ? '' : `${RESULTS.format(n)} ${n === 1 ? 'match' : 'matches'}`;
    // OFF filters nothing, so it says nothing — but one held ABOVE says where it went.
    const says = this.current || ['data-superseded', 'data-unavailable', 'disabled'].some((a) => this.hasAttribute(a));
    const said = [says ? this.#tipText(this.#said) : '', matches].filter(Boolean).join(' - ');
    /* A chip with NO WORDS on it — a grid heading's sort button — says its
       name in the tip, as an icon button does: "Sorted by Name, descending". */
    const name = this.hasAttribute('data-icon-only') ? this.getAttribute('aria-label') ?? '' : '';
    // `data-text` is sherpa-tooltip's own API — the component writes the bubble.
    const tip = this.$<HTMLElement>('.count-wrap');
    if (tip) tip.dataset['text'] = said || name;
    // For a screen reader the name is said already; only the answer describes.
    const body = this.$('.body');
    if (said) body?.setAttribute('aria-description', said);
    else body?.removeAttribute('aria-description');
  }

  /** The results the chip shows now: once applied, ON OR OFF — the source gives
   *  a number only to a chip that holds an answer. Will, TODO 123. */
  #shownResults(): number | null {
    return this.hasAttribute('data-pending') ? null : this.#results ?? null;
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
    // A TICKED answer is only readable once the rows stamp.
    if (!((this.menu?.values ?? []) as string[]).length) return;
    this.#drawFace();
  };

  /**
   * refresh() — redraw the FACE (value, tip, badge, condition) off the menu,
   * once its rows have filled. For a host that set the rows SILENTLY: a steer
   * fires no menu event, so the chip never heard it and kept a stale face.
   * Never on or off — that stays the host's.
   * TRAP T-a-silent-steer-still-redraws-its-chip
   */
  refresh(): void {
    // A rebuilt row fills a frame late. TRAP T-a-rebuilt-row-reads-empty-for-a-tick
    const token = ++this.#refreshing;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token === this.#refreshing && this.isConnected) this.#drawFace();
    }));
  }

  /** The pending `refresh()`; a later one takes over. */
  #refreshing = 0;

  /** Label, tip, badge and condition, from ONE read of the menu. */
  #drawFace(): void {
    const values = (this.menu?.values ?? []) as string[];
    this.#syncLabelForSelection(values);
    this.#syncCountTip(values);
    const state = this.#state(values);
    this.#syncBadge();
    this.#syncCondition(state);
  }

  /** A day or a range was picked in the chip's calendar: redraw the face. */
  #onDated = (): void => {
    if (this.menu?.dataset['body'] === 'date') this.#drawFace();
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
    if (this.menu?.mode !== 'advanced') return;
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
      conditionValue?: string; reading?: FieldReading;
    }) | null;
    const isFilter = menu?.getAttribute('data-type') === 'filter';
    /* The menu's whole answer — both modes, and which is in force — so the
       badge and the tip read the answer that filters. A number's "> 2" is
       typed text there, not a tick.
       TRAP T-a-condition-badge-says-that-not-which · TRAP T-both-answers-are-kept */
    const body = menu?.dataset['body'];
    const list = body === 'number' || (isFilter && body !== 'date') ? menu?.reading : undefined;
    const all = [...this.querySelectorAll<HTMLInputElement>('[slot="menu"] input')]
      .filter((i) => !i.closest(NON_VALUE_ROWS))
      .map((i) => i.value);
    return fieldState(
      {
        field: this.dataset['id'] ?? this.dataset['label'] ?? '',
        label: this.#field ?? this.dataset['label'] ?? '',
        /* A NUMBER or a DATE has no list: its picks ARE its values. An empty
           list said "nothing to pick", and the chip said nothing at all.
           TRAP T-a-chip-says-its-own-answer */
        ...(body === 'number' || body === 'date' ? { type: body } : { values: all }),
        labels: Object.fromEntries(all.map((v) => [v, this.#valueLabel(v)])),
      },
      list ? { ...list, picked: values } : {
        picked: values,
        op: isFilter ? ((menu?.dataset['op'] ?? DEFAULT_OP) as FilterOp) : DEFAULT_OP,
        text: isFilter ? (menu?.conditionValue ?? '') : '',
        // A DATE's two days are a span, as its calendar has it.
        ...(body === 'date' ? { range: !!menu?.hasAttribute('data-range') } : {}),
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
    this.#syncBadge();
  }

  /** The rows this chip's own answer matches, as its source counted them.
   *  Null: no number. TRAP T-a-chip-counts-its-own-results */
  get results(): number | null {
    return this.#results ?? null;
  }
  set results(n: number | null) {
    this.#results = n;
    this.#syncBadge();
  }
  /** Undefined: never told — a chip with no menu then leaves `data-count` to its host. */
  #results: number | null | undefined;

  /**
   * The badge is the chip's RESULTS once applied, on or off — not a count of
   * picks, nor `fx`: the tip says those. Will, TODO 60 and 123.
   * TRAP T-a-chip-counts-its-own-results
   */
  #syncBadge(): void {
    // The tip names the matches too, and follows the same rule.
    this.#writeTip();
    if (this.#results === undefined && !this.menu) return;
    const n = this.#shownResults();
    const badge = this.$('.count');
    if (n == null) {
      badge?.removeAttribute('aria-label');
      delete this.dataset['count'];
      return;
    }
    const said = RESULTS.format(n);
    this.dataset['count'] = said;
    badge?.setAttribute('aria-label', `${said} ${n === 1 ? 'result' : 'results'}`);
  }

  /** Is this chip's menu on a typing condition with something typed? */
  #hasTypedAnswer(): boolean {
    const menu = this.menu as (HTMLElement & {
      conditionValue?: string; mode?: string;
      conditions?: { op: FilterOp; text?: string; picked?: unknown[] }[];
    }) | null;
    if (menu?.getAttribute('data-type') !== 'filter') return false;

    /* ADVANCED mode answers with ROWS, and ANY answered row is an answer. A
       chip reading row one only stayed off while three rows filtered.
       TRAP T-a-filter-menu-has-two-modes */
    if (menu.mode === 'advanced') {
      return (menu.conditions ?? []).some((row) =>
        (OP_TAKES[row.op] ?? 'list') === 'text'
          ? (row.text ?? '').trim() !== ''
          : (row.picked ?? []).length > 0);
    }

    // A LIST in Simple mode answers by its picks; row one's text is Advanced's.
    if (!menu.dataset?.['body']) return false;
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
