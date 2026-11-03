/**
 * sherpa-quick-filter — one chip; knows its KIND, so Group toggles and Sort cycles on their own.
 *
 * @see TRAP T-chip-menu-is-a-boolean-state, TRAP T-one-pick-reads-field-and-value,
 * TRAP T-scope-does-not-stop-inheritance, TRAP T-icon-only-is-purely-css
 */
import { DATA_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import {
  DEFAULT_OP, OP_TAKES, valueKey, type FilterOp, type SortDirection,
} from '../../core/data/store.js';
import {
  fieldState, presetTouches, readingRows, rowAnswered, type FieldCondition, type FieldReading, type FilterState,
} from '../../core/data/filter-state.js';
import { countSaid, filterFace, spellConditions } from '../../core/data/filter-face.js';
import { NON_VALUE_ROWS, NOT_AVAILABLE, ORGANISE_ICONS, RULED_OUT, SET_ASIDE, UNAPPLIED, UNFETCHED, heldByPreset, movedTo, onByPreset, unusedHere } from '../../core/ui/shared-constants.js';
import { arranges, FILTER_KINDS, type FilterKind } from '../../core/ui/filter-kind.js';
import { nextSort, sortDirectionFrom } from '../../core/data/cycle.js';
import { paintSwatch } from '../../core/ui/chart-parts.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';
import { today } from '../../core/ui/temporal.js';

/** One place a jump chip can scroll to — `value` is the target element's id. */
interface JumpItem {
  value: string;
  label?: string;
}

export class SherpaQuickFilter extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-checkbox-look.css', import.meta.url),
    new URL('./sherpa-quick-filter.css', import.meta.url),
  ];
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
    /* A data-viz series, from 1, or a status: the chip leads with its swatch. */
    'data-swatch': { type: 'string', kind: 'style' },
    'data-menu': { type: 'boolean', kind: 'style' },
    /* `key`: a chart legend's row. Its ON is SHOWN, not picked. TODO 149 */
    'data-type': { type: 'enum', kind: 'style', values: ['default', 'ai', 'jump', 'key'] },
    /* A KEY, not a control: no toggle, no button semantics.
       TRAP T-readonly-legend-is-a-key-not-a-filter */
    'data-readonly': { type: 'boolean', kind: 'style' },
    /* Its right button DISMISSES, not a menu — the Saved chip. Will, TODO 105 */
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
    'data-count': { type: 'string', kind: 'content', to: '.count' },
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
    'data-icon-start': { type: 'string', kind: 'content' },
    'data-current': { type: 'boolean', kind: 'style' },
  } as const;

  // data-label is hand-written: an absent attribute must leave the template's
  // own default label alone.
  static override observed = ['aria-label', 'disabled'];

  override onRender(): void {
    this.#syncGrey();
    this.#syncText();
    this.#drawLabel();
    this.#drawMoved();
    // A name given before the first render is said now.
    this.#writeTip();
    this.#paintSwatch();
    this.#syncPressed();
    this.$('.body')?.addEventListener('click', this.#onClick);
    this.$('.caret')?.addEventListener('click', this.#onCaret);
    // The menu lives in the light DOM; its events bubble up through the host.
    this.addEventListener('menu-change', this.#onMenuChange as EventListener);
    // A draft in its open menu, and its Apply or Cancel: it says so itself. TODO 415
    for (const type of ['input', 'change', 'condition-change', 'menu-open', 'menu-close', 'menu-change']) {
      this.addEventListener(type, this.#onDraft);
    }
    // A value chip's press, in a section: it picks its row. TODO 425
    this.addEventListener('quick-filter-click', this.#onValuePress);
    // …and a parent's Sites menu, CAUGHT before its value chip relays it. TODO 425
    this.addEventListener('menu-change', this.#onKidsChange, { capture: true });
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
    this.addEventListener('menu-change', this.#onSelectorPick);
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
    const menu = this.menu;
    const tpl = this.$<HTMLTemplateElement>('template.jump-item-tpl');
    if (!menu || !tpl) return;
    // The menu is slotted, outside this shadow root. TRAP T-clone-item-is-for-two-destinations
    menu.replaceChildren(...(data as JumpItem[]).flatMap((item) => this.cloneItem(tpl, item) ?? []));
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
  /** Removal shuts a popover and fires no toggle: moved, its menu is shut, so it must
   *  not read open. TRAP T-a-trigger-click-follows-light-dismiss */
  override onDisconnect(): void {
    this.set('data-open', null);
  }

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
    } else {
      /* …and a TYPED answer, which ticks nothing — asked once its menu has
         rendered; its row remembers its op, so it reads at once. It only ever
         draws an answer, never takes one off.
         TRAP T-a-row-remembers-what-it-was-given */
      void Promise.resolve(this.menu?.rendered).then(() => {
        // …and a DATE's default day. Will, TODO 394
        if (this.isConnected && (this.#hasTypedAnswer() || this.#orDefault([]).length)) this.#drawFace();
      });
    }
  }

  override onChange(name: string): void {
    if (name === 'data-layout') {
      this.#syncInline();
      return this.#syncValues();
    }
    if (['data-current', 'data-readonly', 'data-type', 'data-persistent', 'aria-label'].includes(name)) this.#syncPressed();
    // A greyed chip says why. Will, TODO 176.
    if (name === 'data-unavailable' || name === 'disabled' || name === 'data-superseded' || name === 'data-current' || name === 'data-held-out') this.#syncGrey();
    if (name === 'data-unavailable' || name === 'disabled' || name === 'data-unused') return this.#writeTip();
    /* THE CHIP DRAWS ITSELF. A host says what the state IS — on, which way,
       which column — and never paints the caret or the glyph for it. Two hosts
       painting it is how Group came to forget its column when switched off
       while Sort remembered: one of the two blanked the caret.
       TRAP T-off-is-not-forgotten */
    if (this.#arranges()) this.#drawArrangement();
    if (name === 'aria-label' || name === 'data-current') this.#writeTip();
    if (name === 'data-swatch') return this.#paintSwatch();
    if (name === 'data-current' || name === 'data-pending' || name === 'data-failed') this.#syncBadge();
    if (name === 'data-current') this.#syncEmpty();
    /* The tooltip says WHY a chip is off, so it must follow the two attributes
       that decide that — neither touches the values, so nothing else re-syncs
       it. TRAP T-an-inactive-chip-says-where-its-filter-went */
    else if (name === 'data-by-preset' || name === 'data-held-out') this.#writeTip();
    else if (name === 'data-superseded' || name === 'data-applied-at') {
      this.#syncCountTip(this.menu?.values ?? []);
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

  /** A toggle says whether it is on. A jump, a selector and a key are no toggle.
   *  TRAP T-readonly-legend-is-a-key-not-a-filter */
  #syncPressed(): void {
    const body = this.$('.body');
    if (!body) return;
    const readonly = this.hasAttribute('data-readonly');
    if (readonly || this.dataset['type'] === 'jump' || this.hasAttribute('data-persistent')) {
      body.removeAttribute('aria-pressed');
    } else body.setAttribute('aria-pressed', String(this.current));
    if (readonly) {
      body.setAttribute('role', 'presentation');
      body.setAttribute('tabindex', '-1');
    } else {
      body.removeAttribute('role');
      body.removeAttribute('tabindex');
    }
    // An icon-only TOGGLE is its caret: the caret takes the chip's name and on-state.
    const caret = this.$('.caret');
    if (!caret || !this.#togglesOnly()) return;
    caret.setAttribute('aria-pressed', String(this.current));
    caret.removeAttribute('aria-haspopup');
    caret.removeAttribute('aria-expanded');
    const name = this.getAttribute('aria-label');
    if (name) caret.setAttribute('aria-label', name);
  }

  /** Icon-only with no menu: a toggle whose whole face is the caret. */
  #togglesOnly(): boolean {
    return this.hasAttribute('data-icon-only') && !this.hasAttribute('data-menu');
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
    this.#caretText = text;
    this.#drawLabel();
  }
  get valueLabel(): string {
    return this.#caretText;
  }
  /** What the caret says: kept as data, drawn once there is a caret.
   *  TRAP T-a-value-before-the-first-render-is-held */
  #caretText = '';

  /** Draw the caret text, if there is a caret. */
  #drawLabel(): void {
    const caret = this.$('.caret-label');
    if (caret) caret.textContent = this.#caretText;
  }

  /** The chip's value menu, if it has one — its OWN: a section's ⋮ holds a menu too. TODO 425 */
  get menu(): SherpaMenu | null {
    return this.querySelector<SherpaMenu>(':scope > [slot="menu"]');
  }

  /** The chip's picked values — the same list `quick-filter-change` reports. */
  get values(): string[] {
    return this.menu?.values ?? [];
  }

  /** Set the picks. TRAP T-chip-values-round-trip-silently — silent, unlike a pick. */
  set values(next: readonly string[]) {
    const menu = this.menu;
    if (!menu) return;
    /* THE MENU ticks its rows — rows not drawn yet too,
       which it holds. Upgraded first: a property set on a plain element hides
       the setter for good. TRAP T-a-menu-owns-its-own-bodies
       TRAP T-a-value-before-the-first-render-is-held · TRAP T-custom-element-upgrade */
    customElements.upgrade(menu);
    if (!((menu as Element) instanceof SherpaElement)) return;
    // A list given is a list, not ALL. TRAP T-all-is-an-answer
    this.#all = false;
    menu.values = next;
    // Read BACK, never trust the ask: a value naming no row never landed.
    this.#applySelection(menu.values ?? []);
  }

  /** The menu that answers a FIELD, or null: a toggle, a selector, Group, Sort. */
  #fieldMenu(): SherpaMenu | null {
    const menu = this.menu;
    const body = menu?.dataset['body'];
    return menu && (body === 'number' || body === 'date' || menu.getAttribute('data-type') === 'filter')
      ? menu : null;
  }

  /**
   * reading — the chip's WHOLE answer as its menu holds it, and `suspended`
   * while the chip is OFF. Null: it answers no field. SET draws the answer,
   * on or off, and the face — SILENT, as every steer is.
   * TRAP T-a-chip-says-its-own-answer · TRAP T-grid-suspend-is-not-clear
   */
  get reading(): FieldReading | null {
    const menu = this.#fieldMenu();
    if (!menu) return null;
    const own = menu.reading;
    // ALL: every value, whichever come — no filter; OFF keeps it, as it keeps picks. TRAP T-all-is-an-answer
    const all = this.#all && own.mode !== 'advanced' && !(own.text ?? '').trim();
    // A tiered parent switched OFF keeps its picks. TODO 369, 425 · TRAP T-a-parent-pick-is-the-parent
    const off = this.#off.size ? { off: [...this.#off] } : {};
    return { ...own, ...off, ...(all ? { picked: [], all: true } : {}), ...(this.current ? {} : { suspended: true }) };
  }

  /** Picks a tiered parent switched OFF keeps for when it comes back on, by key. */
  #off = new Set<string>();
  /** ALL was asked — Select all on, or drawn so: ON with every value ticked. Will, TODO 489 */
  #all = false;

  set reading(next: FieldReading) {
    this.presets = next.byPreset;
    this.#takeReading(next);
    // A preset holds it on, whatever the reader's own answer. TRAP T-a-preset-is-its-own-part
    if (this.#presets.length && !next.suspended) this.current = true;
    this.#syncValues();
    this.refresh();
  }

  /** What presets on hold of this field: it says so, in blue. A host that paints
   *  its menu itself, a grid heading, says it here. Will, TODO 521 */
  set presets(held: FieldReading['byPreset']) {
    const was = this.#presets.length > 0;
    this.#held = held ?? {};
    this.#presets = Object.values(this.#held);
    const names = this.#presets.map((p) => p.label).join(', ');
    this.set('data-by-preset', names || null);
    const menu = this.#fieldMenu();
    if (!menu) return;
    menu.heldByPreset = names ? this.#heldBy : null;
    // Its values are the preset's while it is on: shown, refused, and the menu says why. Will, TODO 601
    if (names) {
      menu.setAttribute('data-readonly', '');
      menu.setAttribute('title', heldByPreset(names));
    } else if (was) {
      menu.removeAttribute('title');
      if (!this.hasAttribute('data-superseded')) menu.removeAttribute('data-readonly');
    }
  }
  /** What each preset on holds of this field, by its id. */
  #held: NonNullable<FieldReading['byPreset']> = {};
  /** …and as a list: its name, its scope and its rows. */
  #presets: NonNullable<FieldReading['byPreset']>[string][] = [];

  /** The requests that turn off each preset on that holds this field. Will, TODO 592 */
  get presetsOff(): { scope: string; preset: string; on: false }[] {
    return Object.entries(this.#held).map(([preset, { scope }]) => ({ scope, preset, on: false }));
  }

  /** The presets on whose rows touch a value, by name; none, ''. Will, TODOs 521, 590 */
  #heldBy = (value: string): string => this.#presets
    .filter((p) => presetTouches(p.rows, value)).map((p) => p.label).join(', ');

  /** What the presets on hold, in words: their picks, or their conditions. */
  #presetSaid(): string {
    const rows = this.#presets.flatMap((p) => p.rows);
    return rows.every((r) => r.op === DEFAULT_OP) ? rows.flatMap((r) => r.picked ?? []).map(valueKey).join(', ') : this.#spell(rows);
  }

  /** Rows as an Advanced answer reads, for a field of this chip's kind. */
  #spell(rows: readonly FieldCondition[]): string {
    const body = this.#fieldMenu()?.dataset['body'];
    const type = body === 'number' || body === 'date' ? { type: body as 'number' | 'date' } : {};
    return spellConditions(fieldState({ field: this.dataset['id'] ?? '', ...type }, { conditions: rows, mode: 'advanced' }));
  }

  /** The reader's own answer, into the menu: both modes, each body by its own door. */
  #takeReading(next: FieldReading): void {
    const menu = this.#fieldMenu();
    if (!menu) return;
    const body = menu.dataset['body'];
    /* Its own mode, else rows say Advanced, else the menu's — read once the menu
       has it: a menu not yet drawn still says Simple. Will, TODO 464; every body, 518 */
    const advanced = (): boolean => (next.mode ?? (readingRows(next).length ? 'advanced' : menu.mode)) === 'advanced';
    /* A NUMBER takes its WHOLE reading: its one value, and its rows.
       TRAP T-a-menu-owns-its-own-bodies */
    if (body === 'number') {
      menu.reading = next;
      // In Advanced its ROWS answer it. TRAP T-a-number-has-advanced-rows
      const answered = advanced() ? readingRows(next).length > 0
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
      this.#applySelection(menu.values ?? []);
      // In Advanced its ROWS answer it — "In the last 12 months" is ON.
      const answered = advanced() ? readingRows(next).length > 0
        : (next.text ?? '').trim() !== '' || (next.picked ?? []).length > 0;
      this.current = answered && !next.suspended;
      this.refresh();
      return;
    }
    /* BOTH ANSWERS, and the mode the reading names. A steer carrying rows IS
       the opt-in reaching the menu.
       TRAP T-both-answers-are-kept · TRAP T-many-conditions-are-one-reading */
    const rows = readingRows(next);
    if (rows.length) menu.setAttribute('data-advanced', '');
    menu.reading = next;
    if (advanced()) {
      this.current = rows.length > 0 && !next.suspended;
      this.refresh();
      return;
    }
    // By KEY: a site pick is an object, and String() makes it "[object Object]". TODO 422
    this.#off = new Set((next.off ?? []).map(valueKey));
    this.#setPicks((next.picked ?? []).map(valueKey), next.suspended, next.all);
  }

  /** Picks, and OFF where there are none or the answer is suspended. Nothing
   *  ticked filters nothing: Will, TODO 550. TRAP T-everything-on-is-no-filter */
  #setPicks(picks: readonly string[], off = false, all = false): void {
    this.values = picks;
    // ALL ticks every value its menu has, and every one that comes. TRAP T-all-is-an-answer
    this.#all = all;
    const menu = all ? this.#fieldMenu() : null;
    if (menu) {
      menu.all = true;
      this.#applySelection(menu.values ?? []);
    }
    if (all && !off) this.current = true;
    else if (!picks.length || off) this.current = false;
  }

  /**
   * clear(op) — EMPTY the chip, whatever answers it, and switch it off: a
   * list's ticks, typing and rows, a number's two shapes, a date's days.
   * SILENT. `op` is the condition a list goes back to.
   * TRAP T-empty-is-every-kind-of-answer
   */
  clear(op: FilterOp = DEFAULT_OP): void {
    this.#off.clear();
    this.#all = false;
    this.presets = undefined;
    /* GROUP or SORT: no column, and no way — FORGOTTEN, not written: the chip
       answers `asc` for one with none. TODO 424 · TRAP T-one-cycle-for-one-value */
    if (this.#arranges()) {
      this.set('data-current', null);
      this.set('data-direction', null);
      this.set('data-column', null);
      for (const input of this.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
      return;
    }
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
    this.set('data-current', null);
    for (const input of this.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
  }

  /** Does the chip hold an answer — a pick, a day, a number, typing or a row?
   *  Whether it is ON after its menu applies: ONE rule for the chip and every
   *  host. Nothing ticked is no answer: Will, TODO 550. TODO 424 */
  get answered(): boolean {
    return this.#answers(this.values);
  }

  /** The rule, over the picks as given. */
  #answers(values: readonly string[]): boolean {
    // A TYPING condition answers with text. TODO 480
    return values.length > 0 || this.#hasTypedAnswer() || this.#all;
  }

  /** Does its menu hold a change not yet sent — a draft its Apply would send?
   *  Its host reads it as pending. TODO 424 · TRAP T-a-pending-chip-reads-as-a-warning */
  get drafting(): boolean {
    return !!this.menu?.dirty;
  }

  /** Everything the chip derives from its picks. */
  #applySelection(values: string[]): void {
    this.current = this.#answers(values);
    this.#syncValues();
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
    const box = this.menu ? this.querySelector<HTMLInputElement>('[slot="menu"] input:checked') : null;
    // NONE picks no column, not the one it remembers. TODO 407
    if (box?.closest('.qf-none')) return '';
    return box?.value || this.dataset['column'] || '';
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
      if (this.#drawn()) return;
      this.current = false;
      this.#drawArrangement();
      return;
    }
    if (this.dataset['kind'] === 'group') {
      const on = !this.current;
      if (!this.#drawn()) {
        this.current = on;
        this.#drawArrangement();
      }
      this.emit('group-change', { field: on ? field : null });
      return;
    }
    const next = nextSort(field, this.current ? field : null, this.direction);
    this.#applySort(next.field, next.direction);
  }

  /** LOCKED, the chip reports and its host draws it: it writes no state of its
   *  own. 366 step 22 · TRAP T-locked-chip-relays-and-nothing-else */
  #drawn(): boolean {
    return this.hasAttribute('data-locked');
  }

  /** A column was picked from the menu: apply it and say so. */
  #arrangeFromMenu(): void {
    const field = this.column;
    // NONE clears: the column is forgotten, and a sort is not kept to resume. TODO 407
    const none = !field;
    if (none) this.set('data-column', null);
    if (this.dataset['kind'] === 'group') {
      if (!this.#drawn()) {
        this.current = !!field;
        this.#drawArrangement();
      }
      this.emit('group-change', { field: field || null });
      return;
    }
    // The way it is ALREADY pointing — picking a column does not rewind it.
    this.#applySort(field, field ? sortDirectionFrom(this.dataset['direction']) ?? 'asc' : null, none);
  }

  /**
   * Apply a sort and report it — the ONE place a chip's direction is written.
   *
   * The attribute is the state channel a host reads back, and `asc` used to be
   * stamped at three moments by three owners: this cycle, the container that
   * built the chip, and that container's attribute sync.
   * TRAP T-one-cycle-for-one-value
   */
  #applySort(field: string | null, direction: SortDirection | null, clear = false): void {
    if (!this.#drawn()) {
      // A suspended chip rewinds to `asc` — that is where a resume starts.
      this.set('data-direction', direction ?? 'asc');
      this.current = direction !== null;
      this.#drawArrangement();
    }
    this.emit('sort-change', {
      field: direction === null ? null : field,
      direction: direction ?? 'asc',
      ...(clear ? { clear: true } : {}),
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
      this.set('data-current', null);
      this.#drawArrangement();
      return;
    }
    /* NAME THE COLUMN, then tick it. A rebuilt menu has no rows for a frame, so
       the tick can miss — `data-column` is what the chip reads until it lands.
       TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
    this.set('data-column', field);
    for (const radio of this.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.checked = radio.value === field;
    }
    const suspended = this.dataset['kind'] === 'sort' && direction === '';
    if (this.dataset['kind'] === 'sort') {
      this.set('data-direction', suspended ? 'asc' : sortDirectionFrom(direction ?? undefined) ?? 'asc');
    }
    this.set('data-current', !suspended);
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
    /* With no menu, nothing was picked: the tip says only the way. TODO 548. Its
       name is its item's, never a word its row adds — "(Default)". Will, TODO 684 */
    const named = field ? this.menu?.itemData?.find((i) => i.value === field)?.label : undefined;
    this.valueLabel = field && this.menu ? named || (row?.textContent ?? '').trim() || field : '';
    const dir = this.dataset['kind'] === 'sort' ? this.direction : null;
    if (this.dataset['kind'] === 'sort') {
      this.set('data-icon-start', dir === null ? ORGANISE_ICONS.sortNone
        : dir === 'desc' ? ORGANISE_ICONS.sortDesc : ORGANISE_ICONS.sortAsc);
    }
    // The tip says the column, and for a sort which WAY. Will, TODO 125.
    // Its words are in its template: before the stamp, the draw on connect says the way.
    const way = dir && this.hasRendered ? this.word(dir) : '';
    // …led by its own name: a narrow bar shows only its icon. Will, TODO 680
    const answer = this.current ? [this.valueLabel, way].filter(Boolean).join(', ') : '';
    this.#said = [this.dataset['label'] ?? '', answer].filter(Boolean).join(': ');
    this.#writeTip();
  }

  /** The body was clicked: toggle, or let Group and Sort do their own thing. */
  #onClick = (event: Event): void => {
    if (this.hasAttribute('disabled') || this.hasAttribute('data-readonly') || this.#refused()) return;

    /* A GROUP or SORT chip owns its own gesture, because what it does is a
       property of WHAT IT IS, not of which container drew it.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (this.#arranges()) {
      event.stopPropagation();
      // No column yet, or one it may never let go — a chart's Primary: it opens its menu. Will, TODO 667
      if (!this.column || this.hasAttribute('data-persistent')) { this.#openMenu(); return; }
      this.#arrange();
      return;
    }

    const menu = this.menu;
    /* AN OPEN DRAFT IS APPLIED. A reader who typed a condition or ticked a
       value, then pressed the chip, meant "filter by that" — and closing the
       menu threw it away. TRAP T-a-chip-press-applies-its-menus-draft */
    if (menu?.dirty && this.hasAttribute('data-open')) {
      event.stopPropagation();
      menu.apply?.();
      return;
    }

    /* AN EMPTY DATE switches ON at its default day, Today — a day with no rows
       too: the view's empty state says so. Will, TODO 394 */
    const day = menu && !this.values.length ? this.#orDefault([]) : [];
    if (menu && day.length) {
      menu.reading = { picked: day };
      if (this.hasAttribute('data-locked')) this.refresh();
      else this.#applySelection(menu.values ?? []);
      this.emit('quick-filter-click', { active: true, picked: true });
      return;
    }

    /* TRAP T-an-empty-chip-opens-its-menu — the body cycles a chip's states
     * (TRAP T-a-chip-body-cycles-its-states), and an empty chip has none to cycle.
     * Only when there IS a menu: a toggle-only chip keeps toggling.
     */
    /* A CONDITIONED chip has no ticks and is NOT empty — its rows are its
       answer. Its body toggles, like any other answered chip.
       TRAP T-toggling-a-conditioned-chip-suspends-its-condition */
    // A section's value chip's body is its toggle, its caret its Sites (TODO 425).
    // …unless a preset holds it on: then a press is a toggle off. An icon-only chip has no toggle. TODO 592
    const held = this.hasAttribute('data-by-preset') && !this.hasAttribute('data-icon-only');
    if (menu && !held && this.values.length === 0 && this.dataset['condition'] !== 'advanced' && this.slot !== 'values') {
      // Opening a menu is not a toggle — the bar must not see one.
      event.stopPropagation();
      this.#openMenu();
      return;
    }

    // TRAP T-locked-chip-relays-and-nothing-else — report the click, do not flip.
    // A soloed chip's body ends the solo: its host asks, and it stays on. TODO 690
    if (!this.hasAttribute('data-locked') && !this.hasAttribute('data-solo')) this.current = !this.current;
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
    this.set('data-open', null);
    if (wasOpen) this.menu?.hide?.();
    else this.menu?.show?.(anchor ?? this);
  }

  /** The caret opens the menu without toggling the chip. */
  #onCaret = (event: Event): void => {
    if (this.#togglesOnly()) return this.#onClick(event);
    // A chip with a MENU always opens it: its rows say what is left.
    if (this.hasAttribute('disabled') || (this.#refused() && !this.hasAttribute('data-menu'))) return;
    event.stopPropagation(); // opening the menu must not toggle the chip
    this.#openMenu();
  };

  /** Ruled out and OFF: nothing to press — inactive is not interactive (Will,
   *  2026-10-20). Ruled out and ON, a press lets it go, once (Will, TODO 462).
   *  A chip with a menu still opens it. */
  #refused(): boolean {
    return this.hasAttribute('data-unavailable') && !this.hasAttribute('data-current');
  }

  /** A chart legend's row. TRAP T-a-legend-row-is-a-key-chip */
  #isKey(): boolean {
    return this.dataset['type'] === 'key';
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
    // Its OWN menu: not a value chip's Sites, nor its section's ⋮. TODO 425
    if (event.target !== this.menu) return;
    const open = event.type === 'menu-open';
    this.$('.caret')?.setAttribute('aria-expanded', String(open));
    // Focus is inside the menu, so `:focus-visible` is false — CSS rings on this.
    this.set('data-open', open);
  };

  /** The menu changed: apply the picks — at once for an arrangement. */
  #onMenuChange = (event: Event): void => {
    const values = ((event as CustomEvent).detail?.values ?? []) as string[];
    /* AN ARRANGEMENT, not a filter: picking a column applies it AT ONCE and
       reports by its own name. A filter waits for Apply.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (this.#arranges()) { this.#arrangeFromMenu(); return; }
    this.#all = !!(event as CustomEvent).detail?.all;
    // A locked chip's menu rows are not its values: relay, change nothing.
    if (this.hasAttribute('data-locked')) {
      this.emit('quick-filter-change', { scope: 'chip', values });
      return;
    }
    this.#applySelection(values);
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
    /* A section's value on and ruled out is every pick ruled out — one beside a
       pick that stands is let go (512) — so in force: "no matches", as its row says. TODO 518 */
    if (this.hasAttribute('data-unavailable')) return this.current && !this.#isKey() && this.slot !== 'values' ? SET_ASIDE : RULED_OUT;
    if (this.hasAttribute('data-unused')) return unusedHere(this.dataset['label']);
    if (this.hasAttribute('disabled')) return NOT_AVAILABLE;
    const by = this.dataset['byPreset'];
    if (this.hasAttribute('data-superseded') && !by) {
      // The VALUES too where there are any: they come back when the field is free.
      const moved = movedTo(this.dataset['appliedAt']);
      return values ? `${moved} This chip holds ${values}.` : moved;
    }
    if (this.dataset['heldOut']) return heldByPreset(this.dataset['heldOut']);
    // Why it is on, then what the reader's own answer adds. Will, TODO 521
    if (by) return [onByPreset(by), this.#presets.length ? this.#presetSaid() : '', values].filter(Boolean).join(' ');
    return values;
  }

  /**
   * Flag "on, but filtering by nothing" so CSS can warn.
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
    const state = this.#state(menu?.values ?? []);
    const advanced = state.condition === 'advanced';
    this.#syncCondition(state);
    this.#syncBadge();

    /* A TYPED condition is an answer, so a chip holding one is not empty —
       "Contains Ravi" filters, and painting it as "filtering nothing" is a
       lie. TRAP T-an-operator-decides-pick-or-type */
    const empty = !!menu && this.current && !advanced
      && (menu.values?.length ?? 0) === 0 && !this.#hasTypedAnswer() && !this.#all;

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
    return !this.hasAttribute('data-persistent') && !this.#arranges() && !this.hasAttribute('data-by-preset');
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
    this.#syncInline();
  }

  /** A SECTION in Advanced draws its rows: its menu inline, not a card, answered
   *  or not. Will, TODO 455. TRAP T-an-inline-menu-is-the-same-menu */
  #syncInline(): void {
    const menu = this.menu;
    const inline = this.dataset['layout'] === 'section' && menu?.mode === 'advanced';
    menu?.toggleAttribute('data-inline', inline);
    this.toggleState('inline-rows', inline);
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
          || this.#hasTypedAnswer();
        if (answered) this.set('data-filters-nothing', null);
      });
  }

  /** The pending check for "on, but filtering nothing". */
  #emptyCheck = 0;

  /** The tooltip: the values or the condition, in words — and the same words on
   *  the button for a screen reader, as the tooltip describes only itself.
   *  TRAP T-one-state-per-filtered-field */
  #syncCountTip(values: string[]): void {
    this.#said = filterFace(this.#state(this.#orDefault(values))).tip;
    this.#writeTip();
  }

  /** What the chip's answer says, in words — the tip before its matches. */
  #said = '';

  /**
   * WRITE THE TIP: the answer in words, then ` - X matches` while the chip
   * shows its results — on or off. The CHIP's own, whatever draws it — a bar, a panel, a
   * grid heading. Will, TODO 130. TRAP T-a-chip-says-its-own-answer
   */
  #writeTip(): void {
    // ON OR OFF it says the same — its answer and its matches, as its badge keeps its number. Will, 363.
    const n = this.#shownResults();
    const matches = n == null ? '' : countSaid(n, ['match', 'matches']).label;
    // A failed fetch says so first, then changed-not-applied. Will, TODO 406 and 411
    const lead = [this.hasAttribute('data-failed') ? UNFETCHED : '', this.#unapplied() ? UNAPPLIED : ''];
    const said = [...lead, this.#tipText(this.#said), matches].filter(Boolean).join(' - ');
    /* A chip with NO WORDS on it — a grid heading's sort button — says its
       name in the tip, as an icon button does: "Sorted by Name, descending". */
    const name = this.hasAttribute('data-icon-only') ? this.getAttribute('aria-label') ?? '' : '';
    const tip = this.$('.tip');
    if (tip) tip.textContent = said || name;
    // For a screen reader the name is said already; only the answer describes.
    const body = this.$('.body');
    if (said) body?.setAttribute('aria-description', said);
    else body?.removeAttribute('aria-description');
  }

  /** The results the chip shows now: once applied, ON OR OFF — the source gives
   *  a number only to a chip that holds an answer. Will, TODO 123. */
  #shownResults(): number | null {
    return this.#unapplied() ? null : this.#results ?? null;
  }

  /** Changed and not applied: its source says it waits, or its open menu holds a draft. */
  #unapplied(): boolean {
    return this.hasAttribute('data-pending') || this.drafting;
  }

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
      this.#syncBadge();
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
    this.#syncValues();
    /* A TICKED answer is only readable once the rows stamp — and a TYPED one
       has none to tick, so it is asked too: the menu now draws before the
       chip has looked. TRAP T-a-chip-says-its-own-answer */
    if (!(this.menu?.values ?? []).length && !this.#hasTypedAnswer()) return;
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
    this.#syncLabelForSelection(values);
    this.#syncCountTip(values);
    const state = this.#state(values);
    this.#syncBadge();
    this.#syncCondition(state);
    this.#syncValues();
  }

  /**
   * A SECTION's value chips: one per menu row — a tiered field's parents —
   * ticked as the menu is, a parent while it or a child is. The answer stays
   * the menu's; these only show it. TODO 425
   */
  #syncValues(): void {
    const menu = this.#fieldMenu();
    // Its menu's rows lead with the swatches its value chips carry. Will, TODO 677
    menu?.toggleAttribute('data-swatches', this.#laysValues());
    // A section's values, or its values alone — a chart's legend in a bar. Will, TODO 670
    const items = this.#laysValues() && menu && !menu.dataset['body'] ? menu.itemData ?? [] : [];
    const tops = items.filter((i) => i.parent === undefined);
    const mine = new Map([...this.querySelectorAll<HTMLElement>(':scope > .value')].map((c) => [c.dataset['value'] ?? '', c]));
    const picked = new Set(menu?.values ?? []);
    // What is APPLIED, told while the field waits: only a value its draft changed reads as pending. TODO 425
    const waiting = this.#applied != null;
    const was = new Set((this.#applied && !this.#applied.suspended ? this.#applied.picked ?? [] : []).map(valueKey));
    for (const item of tops) {
      const one = mine.get(item.value) ?? this.clone('template.value-chip-tpl');
      if (!one) return;
      mine.delete(item.value);
      one.dataset['value'] = item.value;
      one.dataset['id'] = this.dataset['id'] ?? '';
      one.setAttribute('data-label', item.label);
      // A chart's value leads with its series' swatch, as its legend does.
      if (item.swatch) one.dataset['swatch'] = String(item.swatch);
      const kids = [item.value, ...items.filter((k) => k.parent === item.value).map((k) => k.value)];
      // Blue where a preset on touches it. Will, TODOs 521, 590
      const by = this.#heldBy(item.value);
      one.toggleAttribute('data-current', !!by || kids.some((k) => picked.has(k)));
      one.toggleAttribute('data-by-preset', !!by);
      if (by) one.dataset['byPreset'] = by;
      // The rest of a field a preset holds are refused too. Will, TODO 601
      if (this.#presets.length && !by) one.dataset['heldOut'] = this.#presets.map((p) => p.label).join(', ');
      else delete one.dataset['heldOut'];
      one.toggleAttribute('data-pending', waiting && kids.some((k) => picked.has(k) !== was.has(k)));
      (one as SherpaQuickFilter).results = this.#valueResults?.[item.value] ?? null;
      this.#syncKids(one, item.value, items, picked);
      // In the menu's order: appending one already here moves it.
      this.append(one);
    }
    for (const gone of mine.values()) gone.remove();
    // A value of it waits: said on the section itself. TRAP T-each-field-can-apply-on-its-own
    this.toggleState('values-pending', !!this.querySelector(':scope > .value[data-pending]'));
  }

  /** Its values are laid out as value chips: a section's, or its values alone. */
  #laysValues(): boolean {
    return this.dataset['layout'] === 'section' || this.dataset['layout'] === 'values';
  }

  /** A SECTION's applied answer while its field waits, null while it does not:
   *  its host says it. TODO 425 */
  get applied(): FieldReading | null {
    return this.#applied;
  }
  set applied(reading: FieldReading | null) {
    this.#applied = reading;
    this.#syncValues();
  }
  /** What is applied of this field, as its host last said. */
  #applied: FieldReading | null = null;

  /** A SECTION's value chips' own counts, by value: its host says them. TODO 425 */
  get valueResults(): Readonly<Record<string, number>> | null {
    return this.#valueResults;
  }
  set valueResults(results: Readonly<Record<string, number>> | null) {
    this.#valueResults = results;
    /* A chip's own menu draws them on its rows; a section's are its value chips. Its
       values alone draw both: folded, its menu stands for its value chips. TODOs 466, 677 */
    this.menu?.setMatches?.(this.dataset['layout'] === 'section' ? null : results);
    this.#syncValues();
  }
  /** Each value's count, as its host last said. */
  #valueResults: Readonly<Record<string, number>> | null = null;

  /** A TIERED value's chip is a field chip of its own: its menu is the parent's
   *  children, ticked from the field's picks — all of them while the parent is
   *  picked whole. TODO 425 · TRAP T-a-parent-pick-is-the-parent */
  #syncKids(one: HTMLElement, parent: string, items: ReadonlyArray<{ value: string; label: string; parent?: string }>, picked: ReadonlySet<string>): void {
    const kids = items.filter((k) => k.parent === parent);
    let menu = one.querySelector<SherpaMenu>(':scope > sherpa-menu.kids');
    if (!kids.length) {
      menu?.remove();
      one.removeAttribute('data-menu');
      return;
    }
    if (!menu) {
      menu = this.clone<SherpaMenu>('template.kids-menu-tpl');
      if (!menu) return;
      menu.setAttribute('data-heading', items.find((i) => i.value === parent)?.label ?? parent);
      one.append(menu);
      one.setAttribute('data-menu', '');
    }
    menu.toggleAttribute('data-readonly', this.#presets.length > 0);
    const whole = picked.has(parent);
    const given = kids.map((k) => ({ value: k.value, label: k.label, selected: whole || picked.has(k.value) }));
    // The same list does nothing: a new one would close what the reader has open.
    const key = JSON.stringify(given);
    if (menu.dataset['given'] === key) return;
    menu.dataset['given'] = key;
    menu.items(given);
  }

  /** A parent's Sites menu changed: those sites are its picks — the parent
   *  itself while every one is ticked — picked through the field's menu. TODO 425 */
  #onKidsChange = (event: Event): void => {
    const kidsMenu = event.target as HTMLElement;
    const one = kidsMenu.parentElement;
    if (!kidsMenu.classList?.contains('kids') || one?.parentElement !== this) return;
    event.stopPropagation();
    const menu = this.#fieldMenu();
    if (!menu) return;
    const parent = one.dataset['value'] ?? '';
    const kids = (menu.itemData ?? []).filter((i) => i.parent === parent).map((i) => i.value);
    const want = new Set(((event as CustomEvent).detail?.values ?? []) as string[]);
    const mine = new Set([parent, ...kids]);
    const rest = menu.values.filter((v) => !mine.has(v));
    menu.values = kids.length && kids.every((k) => want.has(k)) ? [...rest, parent] : [...rest, ...kids.filter((k) => want.has(k))];
    menu.apply();
  };

  /** A value chip was pressed: pick its row — a parent with its children — as a
   *  reader would, through the menu, Apply too. TODO 425 */
  #onValuePress = (event: Event): void => {
    const one = event.target as HTMLElement;
    if (one === this || one.parentElement !== this || !one.classList.contains('value')) return;
    event.stopPropagation();
    // A preset holds it: toggled off, its conditions no longer stand, so the preset goes. Will, TODO 592
    if (one.hasAttribute('data-by-preset')) {
      this.emit('quick-filter-click', { active: false, release: true });
      return;
    }
    // …and the rest of its field refuse. Will, TODO 601
    if (one.hasAttribute('data-held-out')) return;
    // Inactive is not interactive. TRAP T-a-ruled-out-value-is-greyed
    const menu = this.#fieldMenu();
    // …but one still ON may be let go. TODO 462
    if (!menu || (one.hasAttribute('data-unavailable') && !one.hasAttribute('data-current'))) return;
    const value = one.dataset['value'] ?? '';
    const kids = (menu.itemData ?? []).filter((i) => i.parent === value).map((i) => i.value);
    const mine = new Set([value, ...kids]);
    const rest = menu.values.filter((v) => !mine.has(v));
    const held = menu.values.filter((v) => mine.has(v));
    if (kids.length && held.length) {
      // A PARENT on goes OFF, and keeps its picks. Will, TODO 369 · TRAP T-a-parent-pick-is-the-parent
      for (const v of held) this.#off.add(v);
      menu.values = rest;
    } else if (kids.length && [...mine].some((k) => this.#off.has(k))) {
      // …and off comes back on, with them.
      const back = [...mine].filter((k) => this.#off.delete(k));
      menu.values = [...rest, ...back];
    } else {
      const on = !held.length;
      menu.values = menu.dataset['select'] === 'single' ? (on ? [value] : []) : on ? [...rest, value] : rest;
    }
    menu.apply();
  };

  /** A DATE with no day reads its default, Today: OFF, one press from on. Will, TODO 394 */
  #orDefault(values: string[]): string[] {
    const menu = this.menu;
    if (values.length || menu?.dataset['body'] !== 'date' || menu.mode === 'advanced') return values;
    const day = today().toString();
    return menu.hasAttribute('data-range') ? [day, day] : [day];
  }

  /** A day or a range was picked in the chip's calendar: redraw the face. */
  #onDated = (): void => {
    // A committing menu's pick is a draft until Apply. TODO 405
    if (this.menu?.dataset['body'] === 'date' && !this.menu.hasAttribute('data-commit')) this.#drawFace();
  };

  /** A condition row changed: re-derive the face from it. */
  #onCondition = (): void => {
    // A locked chip's owner hears the row too, and says: only the face redraws. TODO 518
    if (this.#drawn()) return this.refresh();
    this.#applySelection(this.menu?.values ?? []);
  };


  /**
   * This chip's state, read off its menu.
   *
   * ONE read, into the shared model — the badge, the caret, the count and the
   * tooltip all come back from `filterFace`, so the chip draws rather than
   * decides. TRAP T-one-state-per-filtered-field
   */
  #state(values: string[]): FilterState {
    const menu = this.menu;
    const isFilter = menu?.getAttribute('data-type') === 'filter';
    /* The menu's whole answer — both modes, and which is in force — so the
       badge and the tip read the answer that filters. A number's "> 2" is
       typed text there, not a tick.
       TRAP T-a-condition-badge-says-that-not-which · TRAP T-both-answers-are-kept */
    const body = menu?.dataset['body'];
    // A DATE that offers Advanced is a filter menu too: its rows are in its reading. TODO 21d
    const list = body === 'number' || isFilter ? menu?.reading : undefined;
    // A menu nested in the chip's answers for itself. TRAP T-a-nested-menu-answers-for-itself
    /* A TREE's children are not drawn until their parent opens: its items say
       them, with their parents. TODO 369 */
    const tree = menu?.itemData?.some((i) => i.parent !== undefined) ? menu.itemData : null;
    const all = tree ? tree.map((i) => i.value) : [...this.querySelectorAll<HTMLInputElement>('[slot="menu"] input')]
      .filter((i) => i.closest('sherpa-menu') === menu && !i.closest(NON_VALUE_ROWS))
      .map((i) => i.value);
    return fieldState(
      {
        field: this.dataset['id'] ?? this.dataset['label'] ?? '',
        label: this.#field ?? this.dataset['label'] ?? '',
        /* A NUMBER or a DATE has no list: its picks ARE its values. An empty
           list said "nothing to pick", and the chip said nothing at all.
           TRAP T-a-chip-says-its-own-answer */
        ...(body === 'number' || body === 'date' ? { type: body } : { values: all }),
        labels: tree ? Object.fromEntries(tree.map((i) => [i.value, i.label]))
          : this.#valueLabels(all),
        ...(tree ? { parentOf: new Map(tree.flatMap((i) => (i.parent !== undefined ? [[i.value, i.parent] as const] : []))) } : {}),
      },
      list ? { ...list, picked: values, ...(this.#all ? { all: true } : {}) } : {
        picked: values,
        ...(this.#all ? { all: true } : {}),
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
    this.set('data-label', field);

    const face = filterFace(this.#state(this.#orDefault(values)));
    this.valueLabel = face.value || (this.#presets.length ? this.#presetSaid() : '');
    this.#syncBadge();
  }

  /** The rows this chip's own answer matches, as its source counted them.
   *  Null: no number. TRAP T-a-chip-counts-within-the-filters-before-it */
  get results(): number | null {
    return this.#results ?? null;
  }
  set results(n: number | null) {
    if (n === this.#results) return;
    this.#results = n;
    this.#syncBadge();
  }
  /** Undefined: never told — a chip with no menu then leaves `data-count` to its host. */
  #results: number | null | undefined;

  /**
   * The badge is the chip's RESULTS once applied, on or off — not a count of
   * picks, nor `fx`: the tip says those. Will, TODO 60 and 123.
   * TRAP T-a-chip-counts-within-the-filters-before-it
   */
  #syncBadge(): void {
    // The tip names the matches too, and follows the same rule.
    this.#writeTip();
    if (this.#results === undefined && !this.menu) return;
    const n = this.#shownResults();
    const badge = this.$('.count');
    if (n == null) {
      badge?.removeAttribute('aria-label');
      this.set('data-count', null);
      return;
    }
    const { said, label } = countSaid(n);
    this.set('data-count', said);
    badge?.setAttribute('aria-label', label);
  }

  /** Is this chip's menu on a typing condition with something typed? */
  #hasTypedAnswer(): boolean {
    const menu = this.menu;
    if (menu?.getAttribute('data-type') !== 'filter') return false;

    /* ADVANCED mode answers with ROWS, and ANY answered row is an answer. A
       chip reading row one only stayed off while three rows filtered.
       TRAP T-a-filter-menu-has-two-modes */
    if (menu.mode === 'advanced') {
      return (menu.conditions ?? []).some(rowAnswered);
    }

    // A LIST in Simple mode answers by its picks; row one's text is Advanced's.
    if (!menu.dataset?.['body']) return false;
    const op = (menu.dataset?.['op'] ?? DEFAULT_OP) as FilterOp;
    if ((OP_TAKES[op] ?? 'list') !== 'text') return false;
    return (menu.conditionValue ?? '').trim() !== '';
  }

  /** Each value's VISIBLE text, falling back to the raw value — in ONE pass: a
   *  lookup per value was rows × rows, 4.4 s of a load at 20k rows. Plan 652 S9 */
  #valueLabels(values: readonly string[]): Record<string, string> {
    const menu = this.menu;
    // Its item's own label: a word its row adds — "(Default)" — is the menu's. Will, TODO 684
    const named = new Map(menu?.itemData?.map((i) => [i.value, i.label]) ?? []);
    const shown = new Map<string, string>();
    if (values.some((v) => !named.get(v))) {
      for (const input of menu?.querySelectorAll<HTMLInputElement>('input') ?? []) {
        if (input.closest('sherpa-menu') !== menu || shown.has(input.value)) continue;
        shown.set(input.value, input.closest('label')?.textContent?.trim() ?? '');
      }
    }
    return Object.fromEntries(values.map((v) => [v, named.get(v) || shown.get(v) || v]));
  }
}

define('sherpa-quick-filter', SherpaQuickFilter);
