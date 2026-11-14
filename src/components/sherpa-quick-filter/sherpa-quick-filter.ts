/**
 * sherpa-quick-filter — one chip; knows its KIND, so Group toggles and Sort cycles on their own.
 * Its jobs are modules beside it: its field's answer (chip-answer), what it says
 * (chip-says), a section's values (chip-section), Group and Sort (chip-arrange), and
 * its two buttons by face (chip-press). Plan 695 P5
 *
 * @see TRAP T-chip-menu-is-a-boolean-state, TRAP T-one-pick-reads-field-and-value,
 * TRAP T-scope-does-not-stop-inheritance, TRAP T-icon-only-is-purely-css
 */
import { DATA_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { TIP_HTML, watchTipLines } from '../../core/ui/description-tips.js';
import { DEFAULT_OP, type FilterOp, type SortDirection } from '../../core/data/store.js';
import type { FieldReading, FilterState } from '../../core/data/filter-state.js';
import { RULED_OUT, movedTo } from '../../core/ui/shared-constants.js';
import { FILTER_KINDS } from '../../core/ui/filter-kind.js';
import { paintSwatch } from '../../core/ui/chart-parts.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';
import { ChipAnswer } from './chip-answer.js';
import { ChipArrange } from './chip-arrange.js';
import type { ChipHost } from './chip-host.js';
import { ChipPress } from './chip-press.js';
import { ChipSays } from './chip-says.js';
import { ChipSection } from './chip-section.js';

export class SherpaQuickFilter extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-checkbox-look.css', import.meta.url),
    new URL('./sherpa-quick-filter.css', import.meta.url),
  ];
  static override html = [TIP_HTML, new URL('./sherpa-quick-filter.html', import.meta.url)];
  static override props = {
    'data-icon-only': { type: 'boolean', kind: 'style' },
    /* The menu is open. CSS reads it for the pressed look — real focus has
       moved INSIDE the menu, so `:focus-visible` on the chip is false — and
       the caret click reads it to decide open-or-shut, because the popover
       light-dismisses before the click lands.
       TRAP T-a-trigger-click-follows-light-dismiss */
    'data-open': { type: 'boolean', kind: 'style' },
    'data-indicator': { type: 'boolean', kind: 'style' },
    /* A data-viz series, from 1, or a status: the chip leads with its swatch. */
    'data-swatch': { type: 'string', kind: 'style' },
    'data-menu': { type: 'boolean', kind: 'style' },
    /* `key`: a chart legend's row. Its ON is SHOWN, not picked. TODO 149
       TRAP T-a-legend-row-is-a-key-chip */
    'data-type': { type: 'enum', kind: 'style', values: ['default', 'ai', 'jump', 'key'] },
    // No chrome on its caret at rest: a grid heading's filter. TRAP T-icon-only-is-purely-css
    'data-plain': { type: 'boolean', kind: 'style' },
    'data-no-value': { type: 'boolean', kind: 'style' },
    'data-full-value': { type: 'boolean', kind: 'style' },
    'data-unsupported': { type: 'boolean', kind: 'style' },
    /* A VIEW filter now owns this field, so this chip is SUSPENDED, not gone:
       it keeps its value and comes back when the view lets the field go.
       TRAP T-a-superseded-chip-suspends-it-is-never-removed */
    'data-superseded': { type: 'boolean', kind: 'style' },
    /* SOLOED: every other filter in its scope is off while it is. Its body ends the
       solo, never toggles. Written by its host. Will, TODO 690 */
    'data-solo': { type: 'boolean', kind: 'behaviour' },
    /* What its field is, from the field's own declaration: its tip says it, in
       lines, where the page shows them. Will, TODO 691 */
    'data-description': { type: 'string', kind: 'behaviour' },
    /* The presets on that hold this field or value, by name: blue, and it says so. Will, TODO 521 */
    'data-by-preset': { type: 'string', kind: 'behaviour' },
    /* A value a preset on leaves out, in a field it holds: refused, by name. Will, TODO 601 */
    'data-held-out': { type: 'string', kind: 'behaviour' },
    // A section whose every value its host hides says why. Will, TODO 517
    'data-spent': { type: 'boolean', kind: 'style' },
    'data-unused': { type: 'boolean', kind: 'behaviour' },
    // Written BY the chip: on, filtering nothing — the amber warning a state pin draws.
    'data-filters-nothing': { type: 'boolean', kind: 'style' },
    /* The filters before it rule this value out: greyed and refused, on or off —
       inactive is not interactive. Written by its host. Will, TODO 174 and
       2026-10-20. TRAP T-a-ruled-out-value-is-greyed */
    'data-unavailable': { type: 'boolean', kind: 'style' },
    /* Written BY the chip: which condition it holds — `state.condition`.
       TRAP T-a-conditioned-chip-reads-as-active */
    'data-condition': { type: 'enum', kind: 'behaviour', values: ['simple', 'advanced'] },
    /* Changed, not yet applied: the active edge, no fill. Written by the BAR —
       the one writer. TRAP T-a-pending-chip-reads-as-a-warning */
    'data-pending': { type: 'boolean', kind: 'style' },
    // Its data could not be fetched: a system error, not 0 matches. Written by its host. TODO 411
    'data-failed': { type: 'boolean', kind: 'style' },
    /* WHERE this field is filtered instead — "App header", "View". Shown in the
       tooltip of a chip that is off because something else owns its field: an
       inactive chip that says nothing tells a reader their filter vanished.
       The HOST names the place; the chip cannot know it.
       TRAP T-an-inactive-chip-says-where-its-filter-went */
    'data-applied-at': { type: 'string', kind: 'behaviour' },
    'data-count': { type: 'string', kind: 'content' },
    // A field's whole answer in the flow: its menu's rows as value chips. TODO 425
    'data-layout': { type: 'enum', kind: 'behaviour', values: ['chip', 'section', 'values'] },
    'data-label-start': { type: 'boolean', kind: 'style' },
    /* WHICH FIELD this chip filters. The toolbar writes it on every chip and
       selects on it; the chip reads it to name its own state. */
    'data-id': { type: 'string', kind: 'behaviour' },
    'data-locked': DATA_PROPS['data-locked'],
    /* The chip stays on the bar when off, instead of being removed. */
    'data-persistent': { type: 'boolean', kind: 'style' },
    /* WHAT THIS CHIP IS. `group` and `sort` ARRANGE rows; they do not choose
       them, so they have no values to be empty of and they own their own
       gesture — group toggles, sort cycles asc → desc → off.
       "Organise" is NOT a kind: it is a heading a panel draws above the two.
       TRAP T-a-chip-knows-what-kind-it-is */
    'data-kind': { type: 'enum', kind: 'behaviour', values: [...FILTER_KINDS] },
    /* WHICH COLUMN a group or sort chip arranges by, for a host that draws the
       choice without a menu. A menu, where there is one, is the answer.
       TRAP T-a-chip-knows-what-kind-it-is */
    'data-column': { type: 'string', kind: 'behaviour' },
    /* WHICH WAY a sort chip points. It REMEMBERS the direction; `data-current`
       says whether it runs, so a suspended sort resumes the way it was.
       TRAP T-off-is-not-forgotten */
    'data-direction': { type: 'enum', kind: 'behaviour', values: ['asc', 'desc'] },
    'data-label': { type: 'string', kind: 'content' },
    // Its name half says what its menu picked, where one is: an Organise chip in the filter panel. TRAP T-an-organise-chip-names-its-field-in-the-panel
    'data-name-from-pick': { type: 'boolean', kind: 'behaviour' },
    'data-icon-start': { type: 'string', kind: 'content' },
    'data-current': { type: 'boolean', kind: 'style' },
  } as const;

  // data-label is hand-written: an absent attribute must leave the template's
  // own default label alone.
  static override observed = [
    'aria-label', 'disabled', 'data-swatch', 'data-type', 'data-description', 'data-by-preset',
    'data-held-out', 'data-condition', 'data-applied-at', 'data-layout', 'data-id', 'data-kind',
    'data-column', 'data-direction',
  ];


  /** Its own doors, as its modules call them. */
  #doors(): ChipHost {
    return {
      el: this,
      $: (sel) => this.$(sel),
      set: (attr, value) => this.set(attr, value),
      clone: (sel) => this.clone(sel),
      applySelection: (values) => this.#applySelection(values),
    };
  }

  /** Its field's answer, as its menu holds it. */
  readonly #answer = new ChipAnswer(this.#doors());
  /** What it says: its tip, its caret's value, its badge. */
  readonly #says = new ChipSays({ ...this.#doors(), answer: this.#answer });
  /** A section's value chips. TODO 425 */
  readonly #section = new ChipSection({
    ...this.#doors(),
    answer: this.#answer,
    toggleState: (name, on) => this.toggleState(name, on),
    released: () => this.emit('quick-filter-click', { active: false, release: true }),
  });
  /** Group and Sort. TRAP T-a-chip-knows-what-kind-it-is */
  readonly #arrange = new ChipArrange({
    ...this.#doors(),
    says: this.#says,
    word: (key) => this.word(key),
    grouped: (field) => this.emit('group-change', { field }),
    sorted: (field, direction, clear) => this.emit('sort-change', { field, direction, ...(clear ? { clear: true } : {}) }),
  });
  /** Its body and caret, by face. */
  readonly #press = new ChipPress({
    ...this.#doors(),
    answer: this.#answer,
    arrange: this.#arrange,
    cloneItem: (tpl, item) => this.cloneItem(tpl, item),
    clicked: (active) => this.emit('quick-filter-click', { active }),
    dayPicked: () => this.emit('quick-filter-click', { active: true, picked: true }),
    jumpedTo: (value, label) => this.emit('jump-select', { value, label }),
  });

  override onRender(): void {
    this.#syncGrey();
    this.#syncText();
    this.#says.drawLabel();
    this.#drawMoved();
    // A name given before the first render is said now.
    this.#says.tip();
    this.#paintSwatch();
    this.#press.pressed();
    this.$('.body')?.addEventListener('click', this.#press.body);
    this.$('.caret')?.addEventListener('click', this.#press.caret);
    // The menu lives in the light DOM; its events bubble up through the host.
    this.addEventListener('menu-change', this.#onMenuChange as EventListener);
    // A draft in its open menu, and its Apply or Cancel: it says so itself. TODO 415
    for (const type of ['input', 'change', 'condition-change', 'menu-open', 'menu-close', 'menu-change']) {
      this.addEventListener(type, this.#onDraft);
    }
    // A value chip's press, in a section: it picks its row. TODO 425
    this.addEventListener('quick-filter-click', this.#section.valuePress);
    // …and a parent's Sites menu, CAUGHT before its value chip relays it. TODO 425
    this.addEventListener('menu-change', this.#section.kidsChange, { capture: true });
    /* The menu's rows can arrive AFTER this chip connects — a toolbar hands
       them over once the chip is in the page — and pre-ticked rows fire no
       native change. TRAP T-chip-empty-check-waits-for-onconnect */
    this.addEventListener('menu-items', this.#onMenuItems as EventListener);
    // A FILTER menu's condition is part of what this chip reads back.
    this.addEventListener('condition-change', this.#onCondition as EventListener);
    // Its calendar's pick: the face says the day, or the two. TRAP T-a-chip-says-its-own-answer
    this.addEventListener('datetime-change', this.#onDated);
    this.addEventListener('range-select', this.#onDated);
    this.addEventListener('menu-open', this.#press.menuToggled);
    this.addEventListener('menu-close', this.#press.menuToggled);
    this.addEventListener('menu-select', this.#press.jumped);
    this.addEventListener('menu-change', this.#onSelectorPick);
    /* A layout and rows that came BEFORE this render were said to no one: read
       now, whenever they came. TODO 704 · TRAP T-chip-empty-check-waits-for-onconnect */
    this.#section.inline();
    this.#section.sync();
  }

  /** A selector's menu shuts on its pick, as a native select's does: a pick that
   *  redraws the bar shut it, and one that did not left it open. TODO 607 */
  #onSelectorPick = (event: Event): void => {
    const menu = this.menu;
    if (event.target === menu && menu?.open && this.hasAttribute('data-persistent') && menu.dataset['select'] === 'single') menu.hide();
  };

  /**
   * populate([{ value, label }]) — a JUMP chip's places, as action rows in its
   * menu. Any other chip keeps the default: payload keys onto its attributes.
   */
  protected override renderData(data: unknown): Promise<void> | void {
    if (this.dataset['type'] !== 'jump' || !Array.isArray(data)) return super.renderData(data);
    this.#press.places(data as { value: string; label?: string }[]);
  }

  /** Removal shuts a popover and fires no toggle: moved, its menu is shut, so it must
   *  not read open. TRAP T-a-trigger-click-follows-light-dismiss */
  override onDisconnect(): void {
    this.set('data-open', null);
    this.#stopTips?.();
    this.#stopTips = null;
  }

  /** Stops hearing whether the page shows tips in lines. */
  #stopTips: (() => void) | null = null;

  override onConnect(): void {
    this.#stopTips = watchTipLines(() => this.#says.tip());
    this.#syncEmpty();
    /* GROUP and SORT draw their OWN column and glyph, from the state they were
       given. A host that stamped `data-direction` and `data-current` has said
       everything; nothing else needs to paint it.
       TRAP T-a-chip-knows-what-kind-it-is */
    this.#arrange.draw();
    const initial = this.menu?.values ?? [];
    if (initial.length) {
      this.#says.label(initial);
      this.#says.count(initial);
    } else {
      /* …and a TYPED answer, which ticks nothing — asked once its menu has
         rendered; its row remembers its op, so it reads at once. It only ever
         draws an answer, never takes one off.
         TRAP T-a-row-remembers-what-it-was-given */
      void Promise.resolve(this.menu?.rendered).then(() => {
        // …and a DATE's default day. Will, TODO 394
        if (this.isConnected && (this.#answer.hasTypedAnswer() || this.#answer.orDefault([]).length)) this.#drawFace();
      });
    }
  }

  override onChange(name: string): void {
    if (name === 'data-layout') {
      this.#section.inline();
      return this.#section.sync();
    }
    if (['data-current', 'data-type', 'data-persistent', 'aria-label'].includes(name)) this.#press.pressed();
    // A greyed chip says why. Will, TODO 176.
    if (name === 'data-unavailable' || name === 'disabled' || name === 'data-superseded' || name === 'data-current' || name === 'data-held-out') this.#syncGrey();
    if (name === 'data-unavailable' || name === 'disabled' || name === 'data-unused') return this.#says.tip();
    /* THE CHIP DRAWS ITSELF. A host says what the state IS — on, which way,
       which column — and never paints the caret or the glyph for it. Two hosts
       painting it is how Group came to forget its column when switched off
       while Sort remembered: one of the two blanked the caret.
       TRAP T-off-is-not-forgotten */
    this.#arrange.draw();
    if (name === 'aria-label' || name === 'data-current' || name === 'data-description') this.#says.tip();
    if (name === 'data-swatch') return this.#paintSwatch();
    if (name === 'data-current' || name === 'data-pending' || name === 'data-failed') this.#says.badge();
    if (name === 'data-current') this.#syncEmpty();
    /* The tooltip says WHY a chip is off, so it must follow the two attributes
       that decide that — neither touches the values, so nothing else re-syncs
       it. TRAP T-an-inactive-chip-says-where-its-filter-went */
    else if (name === 'data-by-preset' || name === 'data-held-out') this.#says.tip();
    else if (name === 'data-superseded' || name === 'data-applied-at') {
      this.#says.count(this.menu?.values ?? []);
      this.#drawMoved();
    } else if (name === 'data-spent') this.#drawMoved();
    else this.#syncText();
  }

  /** A section held above says where its filter went, in its values' place —
   *  held before its first render too — and one with every value hidden says
   *  why. TODOs 426, 479, 517 */
  #drawMoved(): void {
    const moved = this.$('.moved');
    if (!moved) return;
    moved.textContent = this.hasAttribute('data-superseded') ? movedTo(this.dataset['appliedAt'])
      : this.hasAttribute('data-spent') ? RULED_OUT : '';
  }

  /** A greyed chip's buttons hear no pointer: its box shows its tip. Will, TODO 585 */
  #syncGrey(): void {
    this.$('.chip')?.classList.toggle('sherpa-anchor', this.hasAttribute('data-superseded') || this.hasAttribute('disabled') || this.hasAttribute('data-held-out')
      || (this.hasAttribute('data-unavailable') && !this.hasAttribute('data-current')));
  }

  /** Give the swatch its series' hue and stroke — the legend's own paint. A
   *  STATUS reads its band's pair. TRAP T-legend-status-swatch-shares-the-band-tokens */
  #paintSwatch(): void {
    const given = this.dataset['swatch'] ?? '';
    const swatch = this.$<HTMLElement>('.swatch');
    if (swatch && given) paintSwatch(swatch, given);
  }

  get current(): boolean {
    return this.hasAttribute('data-current');
  }
  set current(v: boolean) {
    this.set('data-current', v);
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
    this.#says.valueLabel = text;
    this.#syncText();
  }
  get valueLabel(): string {
    return this.#says.valueLabel;
  }

  /** The chip's value menu, if it has one — its OWN: a section's ⋮ holds a menu too. TODO 425 */
  get menu(): SherpaMenu | null {
    return this.querySelector<SherpaMenu>(':scope > [slot="menu"]');
  }

  /** The chip's picked values — the same list `quick-filter-change` reports. */
  get values(): string[] {
    return this.menu?.values ?? [];
  }

  /** Set the picks — silent, unlike a pick. */
  set values(next: readonly string[]) {
    this.#answer.setValues(next);
  }

  /** reading — the chip's WHOLE answer as its menu holds it, and `suspended`
   *  while the chip is OFF. Null: it answers no field. SET draws the answer, on
   *  or off, and the face — SILENT, as every steer is. */
  get reading(): FieldReading | null {
    return this.#answer.reading();
  }
  set reading(next: FieldReading) {
    this.presets = next.byPreset;
    this.#answer.take(next);
    // A preset holds it on, whatever the reader's own answer. TRAP T-a-preset-is-its-own-part
    if (this.#answer.presets.length && !next.suspended) this.current = true;
    this.#section.sync();
    this.refresh();
  }

  /** What presets on hold of this field: it says so, in blue. Will, TODO 521 */
  set presets(held: FieldReading['byPreset']) {
    this.#answer.hold(held);
  }

  /** The requests that turn off each preset on that holds this field. Will, TODO 592 */
  get presetsOff(): { scope: string; preset: string; on: false }[] {
    return this.#answer.presetsOff;
  }

  /** clear(op) — EMPTY the chip, whatever answers it, and switch it off: a list's
   *  ticks, typing and rows, a number's two shapes, a date's days. SILENT. `op` is
   *  the condition a list goes back to. */
  clear(op: FilterOp = DEFAULT_OP): void {
    this.#answer.forget();
    if (this.#arrange.on()) this.#arrange.clear();
    else this.#answer.empty(op);
  }

  /** Does the chip hold an answer — a pick, a day, a number, typing or a row?
   *  Whether it is ON after its menu applies: ONE rule for the chip and every
   *  host. Nothing ticked is no answer: Will, TODO 550. TODO 424 */
  get answered(): boolean {
    return this.#answer.answers(this.values);
  }

  /** Does its menu hold a change not yet sent — a draft its Apply would send?
   *  Its host reads it as pending. TODO 424 · TRAP T-a-pending-chip-reads-as-a-warning */
  get drafting(): boolean {
    return !!this.menu?.dirty;
  }

  /** Everything the chip derives from its picks. */
  #applySelection(values: string[]): void {
    this.current = this.#answer.answers(values);
    this.#section.sync();
    this.#says.label(values);
    this.#says.count(values);
    this.#says.badge();
    this.#syncEmpty();
    this.#syncText();
  }

  /** The label and the glyph, each written only where it differs. TRAP T-a-chip-moved-under-a-press-loses-its-click */
  #syncText(): void {
    const label = this.$('.label');
    const picked = this.hasAttribute('data-name-from-pick') ? this.$('.caret-label')?.textContent?.trim() : '';
    const value = picked || this.dataset['label'];
    if (label && value != null && (label.childElementCount || label.textContent !== value)) label.textContent = value;
    // TRAP T-icon-writes-to-both-slots — `.icon` leads the body, `.caret-icon`
    // serves an icon-only chip, and CSS picks which is visible.
    const glyph = this.dataset['iconStart'] ?? '';
    for (const icon of this.$$('.icon, .caret-icon').filter((i) => this.#glyphs.get(i) !== glyph)) {
      this.writeIcon(icon, glyph);
      this.#glyphs.set(icon, glyph);
    }
  }
  /** The glyph each icon box was last given. */
  #glyphs = new WeakMap<Element, string>();

  /** The column a Group or Sort chip arranges by: its menu's pick, else `data-column`. */
  get column(): string {
    return this.#arrange.column();
  }

  /** Which way a SORT chip is pointing, or null when it is off. */
  get direction(): SortDirection | null {
    return this.#arrange.direction();
  }

  /** arrangeBy(field, direction) — steer a GROUP or SORT chip: its column, and for
   *  a sort which way. SILENT, like every steer. No field is OFF, and the chip keeps
   *  the column it had; a sort with `''` for its direction is suspended, and resumes
   *  ascending. The CHIP's own, so a bar and a panel follow the same attributes the
   *  same way. */
  arrangeBy(field: string, direction?: string | null): void {
    this.#arrange.steer(field, direction);
    this.#syncText();
  }

  /**
   * Open or shut this chip's menu — what a HOST calls to drive the chip from
   * outside. It routes through the same light-dismiss-safe path a caret click
   * takes, so an external opener cannot get the stuck-open behaviour back.
   * TRAP T-a-trigger-click-follows-light-dismiss
   */
  toggleMenu(anchor?: HTMLElement): void {
    this.#press.toggleMenu(anchor);
  }

  /** The menu changed: apply the picks — at once for an arrangement. */
  #onMenuChange = (event: Event): void => {
    const values = ((event as CustomEvent).detail?.values ?? []) as string[];
    /* AN ARRANGEMENT, not a filter: picking a column applies it AT ONCE and
       reports by its own name. A filter waits for Apply.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (this.#arrange.on()) { this.#arrange.picked(); return; }
    this.#answer.all = !!(event as CustomEvent).detail?.all;
    // A locked chip's menu rows are not its values: relay, change nothing.
    if (this.hasAttribute('data-locked')) {
      this.emit('quick-filter-change', { scope: 'chip', values });
      return;
    }
    this.#applySelection(values);
    this.emit('quick-filter-change', { scope: 'chip', values });
  };

  /**
   * Flag "on, but filtering nothing" so CSS can warn.
   * TRAP T-empty-flag-needs-rows-to-count — PERSISTENT and ORGANISE are exempt.
   */
  #syncEmpty(): void {
    /* `data-filters-nothing` means ON BUT FILTERING NOTHING. An organise chip never
       filters, so the question does not apply — and its menu picks a COLUMN,
       which reads as zero values the moment nothing is chosen.
       TRAP T-an-organise-chip-has-no-values */
    if (!this.#answersForItself()) {
      this.set('data-filters-nothing', null);
      return;
    }
    const menu = this.menu;
    const state = this.#answer.state(menu?.values ?? []);
    const advanced = state.condition === 'advanced';
    this.#syncCondition(state);
    this.#says.badge();

    /* A TYPED condition is an answer, so a chip holding one is not empty —
       "Contains Ravi" filters, and painting it as "filtering nothing" is a
       lie. TRAP T-an-operator-decides-pick-or-type */
    // A boolean's on IS its answer: never empty, whatever its menu holds. Plan 960 U4.4c
    const empty = !!menu && this.current && !advanced && this.dataset['kind'] !== 'boolean'
      && (menu.values?.length ?? 0) === 0 && !this.#answer.hasTypedAnswer() && !this.#answer.all;

    this.set('data-filters-nothing', empty);
    /* AND CHECK AGAIN. `data-filters-nothing` is the AMBER warning, and a rebuilt menu
       reads ZERO values until it stamps — so a bar that had just added or
       removed one filter could paint an unrelated chip as "on, filtering
       nothing". The recheck may only ever CLEAR a warning the menu has since
       answered; it never raises one.
       TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    if (empty && menu) this.#recheckEmpty(menu);
  }

  /** A chip that answers a filter — not a selector, not an arrangement. Locked
   *  too: its host draws its answer, and it still says what that answer is. */
  #answersForItself(): boolean {
    return !this.hasAttribute('data-persistent') && !this.#arrange.on() && !this.hasAttribute('data-by-preset');
  }

  /**
   * `data-condition` is `state.condition` — ASKED of the state. It paints
   * nothing: an Advanced chip is ON as a Simple one is.
   * TRAP T-a-conditioned-chip-reads-as-active · TRAP T-one-condition-system
   */
  #syncCondition(state: FilterState): void {
    if (!this.#answersForItself()) return;
    const condition = state.condition;
    if (condition) this.set('data-condition', condition);
    else this.set('data-condition', null);
    this.#section.inline();
  }

  /** Drop a warning the menu answers once it has stamped. Never raises one. */
  #recheckEmpty(menu: SherpaMenu): void {
    const token = ++this.#emptyCheck;
    void Promise.resolve(menu.rendered)
      .then(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
      .then(() => {
        // A later check has already answered; this one is stale.
        if (token !== this.#emptyCheck || !this.isConnected) return;
        const answered = (menu.values?.length ?? 0) > 0
          || menu.mode === 'advanced'
          || this.#answer.hasTypedAnswer();
        if (answered) this.set('data-filters-nothing', null);
      });
  }

  /** The pending check for "on, but filtering nothing". */
  #emptyCheck = 0;

  /**
   * A DRAFT in its own menu reads as pending — the warning look, its count
   * held back — until Apply or Cancel. The CHIP knows it has one; its source's
   * `data-pending` is the other half, its host's to write. Next microtask: the
   * menu settles its own `dirty` in the same event. TODO 415.
   * TRAP T-a-pending-chip-reads-as-a-warning
   */
  #onDraft = (): void => {
    queueMicrotask(() => {
      if (this.drafting === this.#drafted) return;
      this.#drafted = this.drafting;
      this.toggleState('drafting', this.#drafted);
      this.#says.badge();
    });
  };
  /** It showed a draft, as last drawn. */
  #drafted = false;

  /**
   * The menu just stamped its rows — read this chip's FACE off them.
   *
   * The LABEL and the badge only. A chip's on/off is the host's to set — a
   * filter added from the Add menu arrives ON with nothing ticked, so deriving
   * it here would switch it straight back off.
   * TRAP T-chip-empty-check-waits-for-onconnect
   */
  #onMenuItems = (): void => {
    // A section's value chips are the rows: drawn as they come. TODO 425
    this.#section.sync();
    /* A TICKED answer is only readable once the rows stamp — and a TYPED one
       has none to tick, so it is asked too: the menu now draws before the
       chip has looked. TRAP T-a-chip-says-its-own-answer */
    if (!(this.menu?.values ?? []).length && !this.#answer.hasTypedAnswer()) return;
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
    if (this.isConnected) this.#drawFace();
  }

  /** Label, tip, badge and condition, from ONE read of the menu. */
  #drawFace(): void {
    const values = this.menu?.values ?? [];
    this.#says.label(values);
    this.#says.count(values);
    const state = this.#answer.state(values);
    this.#says.badge();
    this.#syncCondition(state);
    this.#section.sync();
  }

  /** A SECTION's applied answer while its field waits, null while it does not:
   *  its host says it. TODO 425 */
  get applied(): FieldReading | null {
    return this.#section.applied;
  }
  set applied(reading: FieldReading | null) {
    this.#section.applied = reading;
  }

  /** A SECTION's value chips' own counts, by value: its host says them. TODO 425 */
  get valueResults(): Readonly<Record<string, number>> | null {
    return this.#section.valueResults;
  }
  set valueResults(results: Readonly<Record<string, number>> | null) {
    this.#section.valueResults = results;
  }

  /** A day or a range was picked in the chip's calendar: redraw the face. */
  #onDated = (): void => {
    // A committing menu's pick is a draft until Apply. TODO 405
    if (this.menu?.dataset['body'] === 'date' && !this.menu.hasAttribute('data-commit')) this.#drawFace();
  };

  /** A condition row changed: re-derive the face from it. */
  #onCondition = (): void => {
    // A locked chip's owner hears the row too, and says: only the face redraws. TODO 518
    if (this.hasAttribute('data-locked')) return this.refresh();
    this.#applySelection(this.menu?.values ?? []);
  };

  /** The rows this chip's own answer matches, as its source counted them.
   *  Null: no number. TRAP T-a-chip-counts-within-the-filters-before-it */
  get results(): number | null {
    return this.#says.results;
  }
  set results(n: number | null) {
    this.#says.results = n;
  }
}

define('sherpa-quick-filter', SherpaQuickFilter);
