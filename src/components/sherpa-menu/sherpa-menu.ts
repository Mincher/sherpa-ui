/**
 * sherpa-menu — the dropdown card: value rows, condition rows, number and date bodies.
 *
 * On the native popover API. Its parts are modules beside it: the card
 * (`menu-shell`), the value list (`menu-list`), the condition rows
 * (`menu-conditions`), the number body (`menu-number`) and the date body
 * (`menu-date`). This file holds its attributes, its doors, its events, its two
 * modes and its draft.
 * TRAP T-menu-rows-stay-native-controls
 *
 * @prop {string[]} values — the checked row values (read/write)
 *
 * @see TRAP T-footer-row-raises-on-any-flag
 *
 * Map:
 * - MenuItem — One item a menu draws for itself.
 */
import { DATA_PROPS, SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { DEFAULT_OP, OP_TAKES, type Condition, type FilterOp, valueKey } from '../../core/data/store.js';
import {
  answeredCondition, modeOf, rowAnswered, rowsFromPicks, rowsTree, treeRows,
  type ConditionType, type FieldCondition, type FieldReading,
} from '../../core/data/filter-state.js';
import { sameAnswer } from '../../core/data/query.js';
import { MenuShell } from './menu-shell.js';
import { MenuList } from './menu-list.js';
import { ConditionRows } from './menu-conditions.js';
import { NumberBody } from './menu-number.js';
import { DateBody } from './menu-date.js';
// TRAP T-menu-composes-real-components — the page may not have imported these.
import '../sherpa-breadcrumbs/sherpa-breadcrumbs.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-badge/sherpa-badge.js';
import type { SherpaBreadcrumbs } from '../sherpa-breadcrumbs/sherpa-breadcrumbs.js';
import type { SherpaInputText } from '../sherpa-input-text/sherpa-input-text.js';
import type { SherpaSlider } from '../sherpa-slider/sherpa-slider.js';
import type { SherpaSwitch } from '../sherpa-switch/sherpa-switch.js';

/** One item a menu draws for itself. */
export interface MenuItem {
  value: string;
  /** What a reader sees. Defaults to `value`. */
  label?: string;
  selected?: boolean;
  /** `false`: the filters before it rule it out — greyed and refused unless picked.
   *  TRAP T-a-ruled-out-value-is-greyed */
  available?: boolean;
  /** A SECOND fact, drawn muted after the label — where a filter lives now. */
  note?: string;
  /** A word after its label, in this row only — a chart chip's "(Default)". Will, TODO 684 */
  suffix?: string;
  /** The data-viz series a chart draws it in, from 1, or a status value's status: a value chip's swatch. TODO 425, plan 683 */
  swatch?: number | string;
  /** The section it is in. A heading is drawn where the section changes.
   *  TRAP T-saved-filters-are-the-last-section */
  section?: string;
  /** It opens a CHILD MENU: a caret at its end, which reports `menu-drill`.
   *  TRAP T-a-row-opens-its-child-menu */
  drill?: boolean;
  /** `false`: no tick box — a row naming what it cannot pick. */
  pickable?: boolean;
  /** Its count, as a badge: a folded chip's own. */
  count?: number;
  /** The icon its chip carries, leading its label. Will, TODO 677 */
  icon?: string;
  /** A tiered field's child value: its parent value's key. TODO 369 */
  parent?: string;
  /** A row that DOES something — no tick box: a button, reported as `menu-select`. TODO 427 */
  action?: boolean;
  /** An action row: the place the reader is on now. */
  current?: boolean;
}

/** What does its own job with a click. Anything else in the card is a gap. */
const CONTROL = 'a[href], button, input, select, textarea, label, summary, [contenteditable]';

/** A mode as written, as the one it means: anything but `advanced` is `simple`. */
const modeAttr = (raw: string | undefined): ConditionType => (raw === 'advanced' ? 'advanced' : 'simple');

export class SherpaMenu extends SherpaElement {
  static override css = new URL('./sherpa-menu.css', import.meta.url);
  static override html = new URL('./sherpa-menu.html', import.meta.url);
  static override props = {
    'data-scroll-shadow': SHARED_PROPS['data-scroll-shadow'],
    'data-bounds': SHARED_PROPS['data-bounds'],
    'data-select': { type: 'enum', kind: 'style', values: ['single', 'multiple'] },
    'data-drill': { type: 'boolean', kind: 'style' },
    // Its value rows lead with their swatch, as its chip's value chips do. Will, TODO 677
    'data-swatches': { type: 'boolean', kind: 'behaviour' },
    // A list of filters: no Select all. Read when the items stamp.
    'data-no-select-all': { type: 'boolean', kind: 'style' },
    'data-none': { type: 'boolean', kind: 'behaviour' },
    // Its rows are still being read. TODO 345
    'data-loading': { type: 'boolean', kind: 'visibility' },
    /* FILTER type only — which ops its condition dropdown offers, and which
       body answers it. TRAP T-an-operator-decides-pick-or-type */
    'data-conditions': { type: 'string', kind: 'style' },
    'data-takes': { type: 'enum', kind: 'style', values: ['list', 'text'] },
    /* Which of the two modes is showing: Simple or Advanced.
       TRAP T-a-filter-menu-has-two-modes */
    'data-mode': { type: 'enum', kind: 'style', values: ['simple', 'advanced'] },
    /* Whether this field offers Advanced conditions AT ALL.
       TRAP T-conditions-are-opt-in-per-field */
    'data-advanced': { type: 'boolean', kind: 'style' },
    /* ADVANCED AND NOTHING ELSE. A field whose values are a wall — an email
       column of 240 — has no list worth ticking, so there is no second mode to
       switch to and the switch is hidden. It IMPLIES `data-advanced`.
       TRAP T-a-filter-answers-by-values-conditions-or-both */
    'data-advanced-only': { type: 'boolean', kind: 'style' },
    /* SOLO in the header, icon only, before the mode button: its host offers it, and
       says when its filter is soloed. Will, TODO 690 */
    'data-soloable': { type: 'boolean', kind: 'style' },
    'data-soloed': { type: 'boolean', kind: 'behaviour' },
    /* WHICH BODY this menu draws. A body lives in THIS component's shadow root,
       so one spelling and one set of rules serve every host.
       TRAP T-a-menu-owns-its-own-bodies */
    'data-body': { type: 'enum', kind: 'style', values: ['number', 'date'] },
    /* A DATE that holds times: its Advanced rows offer a time box. TODO 21d */
    'data-time': { type: 'boolean', kind: 'style' },
    /* A row the filters before it rule out GOES, unless ticked — Hide unmatching
       filters. Will, TODO 205. TRAP T-a-ruled-out-value-is-greyed */
    'data-hide-unavailable': { type: 'boolean', kind: 'behaviour' },
    'data-apply-on': DATA_PROPS['data-apply-on'],
    /* A number's ends and step. They CLAMP its box and a range row's slider —
       typing 500 into a 0..100 filter asks for a row that cannot exist.
       TRAP T-grid-slider-spans-real-values */
    'data-min': { type: 'string', kind: 'style' },
    'data-max': { type: 'string', kind: 'style' },
    'data-step': { type: 'string', kind: 'style' },
    /* The days a DATE body may pick. A set, not a span. */
    'data-available': { type: 'string', kind: 'style' },
    /* The HOST pinned `data-commit`, so flipping Range must not move it. A
       number or date body defers by default — the pick is not finished on its
       first end — but a def that named `commit` outranks that.
       TRAP T-commit-follows-select-mode */
    'data-commit-fixed': { type: 'boolean', kind: 'style' },
    /* Draw in the FLOW, not the top layer. TRAP T-an-inline-menu-is-the-same-menu */
    'data-inline': { type: 'boolean', kind: 'style' },
    'data-heading': { type: 'string', kind: 'content', to: '.heading' },
    /* What the action that opened it does, under its heading — its button's.
       Will, TODO 691 · TRAP T-an-action-says-what-it-does */
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    /* A DATE body offers two days; `data-commit` holds its Apply until asked. */
    'data-range': { type: 'boolean', kind: 'style' },
    // A "Highlight matches" switch, where the host offers it; on while its field drives. TODO 441
    'data-commit': { type: 'boolean', kind: 'style' },
    // Discard without Apply: the scope waits for its bar's ONE Apply. TODO 406
    'data-discard': { type: 'boolean', kind: 'style' },
    // …with an Apply of its own: each field applies on its own. TODO 451
    'data-apply': { type: 'boolean', kind: 'style' },
    'data-pending': { type: 'boolean', kind: 'behaviour' },
    // Shows an answer held ELSEWHERE, unchangeable here. TRAP T-a-view-held-heading-shows-and-refuses
    'data-readonly': { type: 'boolean', kind: 'style' },
    'data-align': { type: 'enum', kind: 'behaviour', values: ['start', 'end'] },
    'data-placement': { type: 'enum', kind: 'behaviour', values: ['right'] },
    'data-search': { type: 'boolean', kind: 'style' },
    'data-clearable': { type: 'boolean', kind: 'style' },
    'data-removable': { type: 'boolean', kind: 'style' },
    'data-type': { type: 'enum', kind: 'template', values: ['list', 'calendar', 'filter'] },
    // The crumb text is written from this, so a change must reach #syncCrumb.
    'data-drill-from': { type: 'string', kind: 'content' },
    // Which condition is picked — a host may set it, and #sync follows.
    'data-op': { type: 'string', kind: 'behaviour' },
    // What was typed under it. An ATTRIBUTE, so a re-stamp cannot lose it.
    'data-value': { type: 'string', kind: 'behaviour' },
  } as const;

  static override observed = ['open'];

  /* `data-type` picks the TEMPLATE, so a change must re-stamp the shadow DOM.
     Without this the attribute is read once, at birth, and a menu that becomes
     a filter never grows its condition row. TRAP T-variant-attrs-or-one-way-door */
  static override variantAttrs = ['data-type'];

  /** The FILTER menu is its own tree: only it carries the condition row.
   *  One field gets ONE menu, whether a chip or a column heading opens it.
   *  TRAP T-one-field-one-filter-menu */
  protected override get templateId(): string {
    return this.dataset['type'] === 'filter' ? 'filter' : 'default';
  }

  /** The card: on the native popover. */
  readonly #shell = new MenuShell({
    el: this,
    card: () => this.#card(),
    on: (target, type, handler, options) => this.on(target, type, handler, options),
    onFrame: (target, type, handler, options) => this.onFrame(target, type, handler, options),
    hide: () => this.hide(),
  });

  /** The value rows. */
  readonly #list = new MenuList({
    el: this,
    $: (sel) => this.$(sel),
    clone: (from) => this.clone(from),
    own: (sel) => this.#own(sel),
    toggleState: (name, on) => this.toggleState(name, on),
    open: () => this.open,
    /* SAY SO. A host reads its own face off the menu's values, and pre-ticked
       rows fire no native change. TRAP T-chip-empty-check-waits-for-onconnect */
    stamped: () => this.emit('menu-items', { values: this.values }),
    drill: (value) => this.emit('menu-drill', { value }),
    back: () => this.emit('menu-back'),
    commits: () => this.#commits,
  });

  /** The Advanced rows. */
  readonly #rows = new ConditionRows({
    el: this,
    $: (sel) => this.$(sel),
    clone: (from) => this.clone(from),
    word: (key) => this.word(key),
    set: (attr, value) => this.set(attr, value),
    op: () => this.op,
    conditionValue: () => this.conditionValue,
    setConditionValue: (text) => { this.conditionValue = text; },
    values: () => this.#list.fieldValues(),
    advancedOnly: () => this.#advancedOnly(),
  });

  /** A number's Simple body. */
  readonly #number = new NumberBody({
    el: this,
    $: (sel) => this.$(sel),
    set: (attr, value) => this.set(attr, value),
    ops: () => this.#rows.opList(),
    op: () => this.op,
  });

  /** A date's Simple body. */
  readonly #date = new DateBody({
    el: this,
    clone: (from) => this.clone(from),
    own: (sel) => this.#own(sel),
    set: (attr, value) => this.set(attr, value),
    op: () => this.op,
  });

  /** What Discard restores. TRAP T-cancel-baseline-captured-on-open */
  #baseline: string[] = [];

  /** The popover card. */
  #card(): HTMLElement | null {
    return this.$('.menu');
  }

  override onRender(): void {
    this.#date.stamp();
    this.#shell.syncInline();
    this.#sync();
    /* Items given BEFORE this element had a shadow tree. A caller building a
       chip clones an UNUPGRADED <sherpa-menu>, so there is no template to
       stamp from until it enters the page.
       TRAP T-custom-element-upgrade */
    this.#list.stamp();
    const card = this.#card();
    if (!card) return;
    card.addEventListener('toggle', this.#onToggle as EventListener);
    // Rows are LIGHT DOM, so the host is the listener.
    this.addEventListener('change', this.#onChange);
    this.$('.drill-back')?.addEventListener('click', this.#onBack);
    this.$('.drill-crumbs')?.addEventListener('breadcrumb-select', this.#onBack);
    // slotchange is the only hook a drill has; show() happens before it.
    // TRAP T-rows-changed-re-places-next-frame
    this.$('.rows slot')?.addEventListener('slotchange', this.#onRowsChanged);
    /* THE MENU OWNS ITS RANGE SWITCH. Both hosts had one, spelled differently,
       listened for separately. TRAP T-a-menu-owns-its-own-bodies */
    this.$('.body-range-switch')?.addEventListener('change', this.#onRangeSwitch);
    this.$('.body-op')?.addEventListener('change', this.#onBodyOp);
    this.$('.body-number')?.addEventListener('change', this.#onBodyChange);
    this.$('.body-number')?.addEventListener('input', this.#onBodyChange);
    this.addEventListener('click', this.#onClick);
    this.addEventListener('click', this.#onGapClick);
    // A row with a child menu opens it on a rest, or ArrowRight. TRAP T-a-row-opens-its-child-menu
    this.addEventListener('pointerover', this.#list.hover);
    this.addEventListener('pointerleave', this.#list.hover);
    this.addEventListener('keydown', this.#onRowKey);
    this.$('.apply')?.addEventListener('click', this.#onApply);
    this.$('.discard')?.addEventListener('click', this.#onDiscard);
    /* The FOOTER owns "nothing to apply"; this menu only reports whether its
       draft changed — a calendar's pick included, which is neither `input` nor
       `change`. TRAP T-the-footer-owns-nothing-to-save */
    for (const type of ['input', 'change', 'datetime-change', 'range-select']) {
      this.addEventListener(type, this.#onDraft);
      this.shadowRoot?.addEventListener(type, this.#onDraft);
    }
    // A number's Reset is its Clear, by another name.
    this.$('.reset')?.addEventListener('click', this.#onClear);
    this.$('.today')?.addEventListener('click', this.#onToday);
    this.$('.remove')?.addEventListener('click', this.#onRemove);
    this.$('.search')?.addEventListener('input', this.#onSearch);
    /* Composed sherpa-input-texts, which re-dispatch `change` and `input`
       from the HOST — so ONE listener on the region covers every stamped row.
       A row added later needs no wiring of its own. */
    const region = this.$('.condition-rows');
    region?.addEventListener('change', this.#onCondition);
    region?.addEventListener('input', this.#onCondition);
    region?.addEventListener('change', this.#passOn);
    region?.addEventListener('input', this.#passOn);
    this.$('.use-advanced')?.addEventListener('button-click', this.#onModeSwitch);
    this.$('.solo-toggle')?.addEventListener('button-click', this.#onSoloToggle);
    this.$('.add-condition')?.addEventListener('click', this.#onAddCondition);
    region?.addEventListener('click', this.#onDropCondition);
    // Held writes, then a reading set before this menu drew — it has rows and ticks now.
    const held = this.#list.held;
    this.#list.held = null;
    if (held) this.values = held;
    const rows = this.#rows.held;
    this.#rows.held = null;
    if (rows) this.conditions = rows;
    const early = this.#early;
    this.#early = undefined;
    if (early) this.reading = early;
  }

  /** A reading set before this menu drew. TRAP T-custom-element-upgrade */
  #early: FieldReading | undefined;

  /* ── The two modes ──────────────────────────────────────────────── */

  /** simple | advanced — values to pick, or condition rows (Will's words).
   *  TRAP T-a-filter-menu-has-two-modes */
  get mode(): ConditionType {
    return modeAttr(this.dataset['mode']);
  }

  /** A host writing `data-mode="advanced"` on a field that did not opt in is
   *  refused, the same as a click. The attribute is not a second door.
   *  TRAP T-conditions-are-opt-in-per-field */
  #enforceMode(): void {
    /* ADVANCED ONLY has no other mode to be in, so it opens in one and
       cannot leave. TRAP T-a-filter-answers-by-values-conditions-or-both */
    if (this.#advancedOnly()) {
      if (this.dataset['mode'] !== 'advanced') this.set('data-mode', 'advanced');
      return;
    }
    if (this.dataset['mode'] === 'advanced' && !this.#offersAdvanced()) {
      this.set('data-mode', null);
    }
  }

  /** This field offers Advanced conditions. `only` implies it. */
  #offersAdvanced(): boolean {
    return this.hasAttribute('data-advanced') || this.#advancedOnly();
  }

  /** Answered by Advanced conditions alone — no value list behind it. */
  #advancedOnly(): boolean {
    return this.hasAttribute('data-advanced-only');
  }

  set mode(next: ConditionType) {
    const to = modeAttr(next);
    /* A field that did not opt in has no Advanced mode to be in — the button
       is hidden, and a host writing the attribute must not get one either.
       TRAP T-conditions-are-opt-in-per-field */
    if (to === 'advanced' && !this.#offersAdvanced()) return;
    // There is nowhere else to go. TRAP T-a-filter-answers-by-values-conditions-or-both
    if (to === 'simple' && this.#advancedOnly()) return;
    const was = this.mode;
    this.set('data-mode', to);
    /* A NUMBER going Advanced carries its body into the rows, whoever flipped
       it — the menu's own button, a panel's f(x). TRAP T-a-number-has-advanced-rows */
    if (this.#typedBody() && was !== 'advanced' && to === 'advanced' && this.$('.condition-rows')) {
      if (!this.#rows.rows().length) this.#rows.add();
      this.#seedFromPicks();
    }
    this.#syncDirty();
  }

  /** The body's operator changed. */
  #onBodyOp = (event: Event): void => {
    const value = (event.target as SherpaInputText).value;
    if (!value) return;
    this.set('data-op', value);
    this.#emitConditions(true);
  };

  /** Range ON is two ends, OFF is one value; both shapes keep what they hold.
   *
   *  THE MENU LISTENS, not its host. A host that bound this listener lost it
   *  the moment a filter panel borrowed the menu away.
   *  TRAP T-a-borrowed-menu-leaves-its-toolbars-listeners-behind */
  #onRangeSwitch = (event: Event): void => {
    event.stopPropagation();
    const on = !!(event.target as SherpaSwitch).checked;
    this.set('data-range', on);
    // A RANGE defers: the pick is not finished on its first end.
    if (!this.hasAttribute('data-commit-fixed')) this.set('data-commit', on);
    this.#date.flip(on);
    this.#syncBody();
    this.emit('menu-range-change', { range: on });
    /* THE SHAPE CHANGED, so what the filter means changed: said as a value
       change is — a plain `change` for an inline host, and the values.
       TRAP T-range-switch-swaps-not-rebuilds */
    this.dispatchEvent(new Event('change', { bubbles: true }));
    this.#syncDirty();
    this.#report();
  };

  /** The header's Solo: its host solos this filter, or ends the solo; the menu
   *  stays open, the toggle pressed while it is soloed. TODO 690
   *  TRAP T-a-solo-is-a-draft-of-one-tab */
  #onSoloToggle = (event: Event): void => {
    event.stopPropagation();
    this.emit('menu-select', { value: this.hasAttribute('data-soloed') ? 'unsolo' : 'solo', header: true });
  };

  /** Switch between the value list and the condition rows. */
  #onModeSwitch = (event: Event): void => {
    // The menu's own control, not a value change. As Range.
    event.stopPropagation();
    this.switchMode();
  };

  /**
   * switchMode(next?) — what the menu's own Advanced button does: the other
   * mode, or `next`, carrying the picks into the rows, and reported. A host's
   * door to it — a section's ⋮. TODO 425
   */
  switchMode(next: ConditionType = this.mode === 'advanced' ? 'simple' : 'advanced'): void {
    if (!this.#offersAdvanced() || this.#advancedOnly() || next === this.mode) return;
    this.mode = next;
    // An Advanced mode with no rows has nothing to answer with.
    if (next === 'advanced' && !this.#rows.rows().length) this.#rows.add();
    /* CARRY THE PICKS OVER. Ticking three values and pressing the mode button
       is a reader saying "now let me refine THAT" — opening on a blank
       `Equals <first option>` throws their answer away without saying so.
       TRAP T-a-mode-switch-carries-the-answer-over */
    if (next === 'advanced') this.#seedFromPicks();
    // Will's two words for the two modes of ONE system. TRAP T-one-condition-system
    this.emit('condition-mode-change', { mode: next });
    this.#emitConditions();
    // Its own `change` stops here, so the footer is told directly.
    this.#syncDirty();
  }

  /**
   * Put what is TICKED into the condition rows, when they have nothing of
   * their own. One row per picked value, ORed — which is what a ticked list
   * means. TRAP T-a-mode-switch-carries-the-answer-over
   */
  #seedFromPicks(): void {
    // Rows the reader wrote are theirs. TRAP T-both-answers-are-kept
    if (!this.#mirror && this.conditions.some(rowAnswered)) return;
    // A number or a date carries its BODY over. TRAP T-a-number-has-advanced-rows
    const body = this.#dated() ? 'date' : this.#numeric() ? 'number' : undefined;
    const rows = rowsFromPicks(body, body ? this.#bodyReading() : { picked: this.values });
    if (rows) this.conditions = rows;
    if (!body) this.#mirror = true;
  }

  /** The rows still copy the picks — until the reader edits a row.
   *  TRAP T-both-answers-are-kept */
  #mirror = false;

  /** listed — the values its Equals rows list where it has no value rows of its
   *  own: a number's, from its field. Will, TODO 668 */
  get listed(): { value: string; label: string }[] {
    return this.#rows.listed;
  }
  set listed(values: readonly { value: string; label: string }[]) {
    this.#rows.listed = values;
  }

  /** A pick moved: rows that still MIRROR the picks follow it. */
  #followPicks(): void {
    if (this.#mirror && this.#offersAdvanced()) this.#seedFromPicks();
  }

  /**
   * The whole answer: Simple's picks and Advanced's rows, which one is in
   * force, and whether the rows still mirror the picks. SET draws it, silent.
   * TRAP T-both-answers-are-kept
   */
  get reading(): FieldReading {
    if (this.#early) return { ...this.#early };
    const body = this.dataset['body'];
    /* A NUMBER that offers Advanced keeps BOTH answers, as a list does: its
       body is Simple's, its rows Advanced's. TRAP T-a-number-has-advanced-rows */
    if ((body === 'number' || body === 'date') && this.#offersAdvanced()) {
      const tree = this.#treeOf(this.#rows.rows().length ? this.conditions : []);
      return { ...this.#bodyReading(), ...(tree ? { tree } : {}), mode: this.mode };
    }
    if (body === 'number' || body === 'date') return this.#bodyReading();
    const out: FieldReading = { picked: this.values };
    if (!this.#offersAdvanced()) return out;
    /* Not drawn yet: row one is still its attributes, as the rows will draw it.
       A chip asks before then. TRAP T-restamp-does-not-abort */
    const one: FieldCondition = { op: this.op, text: this.dataset['value'] ?? '' };
    const tree = this.#treeOf(this.#rows.rows().length ? this.conditions : OP_TAKES[one.op] === 'text' ? [one] : []);
    if (tree) out.tree = tree;
    out.mode = this.mode;
    out.mirror = this.#mirror;
    return out;
  }

  /** The rows as ONE tree — the menu's boundary in — or, while the reader has not
   *  touched them, the tree it was given that rows cannot say. TODO 692 */
  #treeOf(rows: readonly FieldCondition[]): Condition | undefined {
    return this.#unsaid ?? rowsTree(rows, this.#valueType());
  }

  /** A tree this menu was given that its flat rows cannot say AS GIVEN — nested, or
   *  in another order: kept whole, so an Apply of the picks does not change it,
   *  until the reader edits a row. TODO 692 */
  #unsaid: Condition | null = null;

  /** Draw a reading's tree as rows; one they cannot say as given is kept. */
  #drawTree(tree: Condition | undefined): FieldCondition[] {
    const rows = treeRows(tree);
    const exact = !!rows && JSON.stringify(rowsTree(rows, this.#valueType()) ?? null) === JSON.stringify(answeredCondition(tree) ?? null);
    this.#unsaid = exact ? null : tree ?? null;
    return rows ?? [];
  }

  /**
   * A number or date body's answer. Two ends are a range; ONE number is a pick
   * under `=`, and typed text only under an op that takes text ("> 2").
   * TRAP T-a-menu-owns-its-own-bodies · TRAP T-one-number-is-a-pick-under-equals
   */
  #bodyReading(): FieldReading {
    return this.dataset['body'] === 'number' ? this.#number.reading() : this.#date.reading(this.values);
  }

  set reading(next: FieldReading) {
    // Nothing drawn yet to hold it: it waits for the first render.
    if (!this.#card()) {
      this.#early = { ...next };
      return;
    }
    const typed = (next.text ?? '').trim();
    const body = this.dataset['body'];
    if (body === 'number') {
      // ONE value in Simple; a range is an Advanced row. Will, TODO 375
      if (next.op) this.#number.setOp(next.op);
      this.#setNumberBody(typed || valueKey(next.picked?.[0] ?? ''));
      /* …and its ROWS, where it offers them: only the reading's own rows — a
         Simple `> 2` is the body's, not a row. TRAP T-a-number-has-advanced-rows */
      if (this.#offersAdvanced()) {
        this.#rows.set(this.#drawTree(next.tree));
        // No `mode` — a saved answer: its tree decides, as a list's does.
        this.mode = modeOf(next) ?? 'simple';
      }
      this.#syncDirty();
      return;
    }
    if (body === 'date') {
      if (next.op) this.#number.setOp(next.op);
      this.values = typed ? [typed] : (next.picked ?? []).map(valueKey);
      // …and its ROWS, where it offers them, as a number's. TODO 21d
      if (this.#offersAdvanced()) {
        this.#rows.set(this.#drawTree(next.tree));
        this.mode = modeOf(next) ?? 'simple';
      }
      return;
    }
    this.values = (next.picked ?? []).map(valueKey);
    if (!this.#offersAdvanced()) return;
    this.#mirror = next.mirror ?? false;
    // A MIRROR is the picks, so its rows are drawn from them.
    if (this.#mirror) this.#seedFromPicks();
    else {
      const rows = this.#drawTree(next.tree);
      // Its own setter forgets a tree kept whole: it is set back after.
      const unsaid = this.#unsaid;
      this.conditions = rows;
      this.#unsaid = unsaid;
    }
    // No `mode`: its tree decides.
    const mode = modeOf(next);
    if (mode) this.mode = mode;
  }

  /** Add a condition row, and report the chain. Focus goes to its condition
   *  field once that has drawn — it renders on its own clock.
   *  TRAP T-add-condition-sits-below-the-rows */
  #onAddCondition = (): void => {
    this.#mirror = false;
    this.#unsaid = null;
    const row = this.#rows.add();
    this.#emitConditions();
    // A click is no input or change: say the draft moved. TODO 396
    this.#syncDirty();
    const field = row?.querySelector<SherpaInputText>('.condition');
    void Promise.resolve(field?.rendered).then(() => field?.focus());
  };

  /** A row's own Remove. The LAST row is never dropped. */
  #onDropCondition = (event: Event): void => {
    if (!this.#rows.drop(event)) return;
    this.#mirror = false;
    this.#unsaid = null;
    this.#emitConditions();
    this.#syncDirty();
  };

  /** A NUMBER menu's rows are TYPED, whatever the op. TRAP T-a-number-has-advanced-rows */
  #numeric(): boolean {
    return this.dataset['body'] === 'number';
  }

  /** A DATE menu's rows answer with days, a count, or two ends. TODO 21d */
  #dated(): boolean {
    return this.dataset['body'] === 'date';
  }

  /** What its typed values are, so a number's `70` comes in as 70. */
  #valueType(): 'number' | undefined {
    return this.#numeric() ? 'number' : undefined;
  }

  /** A menu whose own BODY answers Simple — a number or a date — so its host
   *  attributes are the body's, never row one's. TRAP T-a-number-has-advanced-rows */
  #typedBody(): boolean {
    return this.#numeric() || this.#dated();
  }

  /** Every row, as data. TRAP T-many-conditions-are-one-reading */
  get conditions(): FieldCondition[] {
    return this.#rows.get();
  }

  /** Replace every row from data — a host restoring a saved filter. */
  set conditions(rows: readonly FieldCondition[]) {
    this.#unsaid = null;
    if (!this.#card()) {
      this.#rows.held = rows.map((row) => ({ ...row }));
      return;
    }
    this.#rows.set(rows);
    // A set is a change to the DRAFT too. TRAP T-the-footer-owns-nothing-to-save
    this.#syncDirty();
  }

  /**
   * Report the rows — unless this menu COMMITS, in which case they are a DRAFT
   * until Apply, exactly as ticked rows are.
   *
   * A condition applied on every keystroke re-queries the whole view per letter
   * and, worse, cannot be cancelled. TRAP T-a-condition-is-a-draft-too
   */
  #emitConditions(force = false): void {
    if (this.#commits && !force && !this.#applying) return;
    this.emit('condition-change', {
      op: this.op, value: this.conditionValue, conditions: this.conditions,
    });
  }

  /** What Discard restores, captured on open beside `#baseline`. */
  #conditionBaseline: FieldCondition[] = [];
  /** …and the tree it kept whole then. */
  #unsaidBaseline: Condition | null = null;
  /** What it held when the menu opened, whole: what a mode switch is judged against. */
  #readingBaseline: FieldReading = {};
  /** Whether the rows mirrored the picks when the menu opened. */
  #mirrorBaseline = false;
  /** The mode the menu opened in. */
  #modeBaseline: ConditionType = 'simple';
  /** The baseline is taken for this opening. */
  #baselineHeld = false;

  /** A NUMBER body's whole answer at open — both shapes, and which was in force. */
  #numberBaseline: FieldReading | null = null;

  /** Put the values back as they were at open. A number's SHAPE goes back too. */
  #restoreValues(): void {
    if (this.#numberBaseline) this.reading = this.#numberBaseline;
    else this.values = this.#baseline;
  }

  /** What Discard restores becomes what it holds NOW — for a host that wrote an
   *  answer while it is open. TRAP T-the-baseline-is-taken-at-show */
  takeBaseline(): void {
    this.#takeBaseline();
  }

  /** Remember what Discard restores. TRAP T-the-baseline-is-taken-at-show */
  #takeBaseline(): void {
    this.#baseline = this.values;
    this.#numberBaseline = this.dataset['body'] === 'number' ? this.reading : null;
    this.#conditionBaseline = this.conditions;
    this.#unsaidBaseline = this.#unsaid;
    this.#mirrorBaseline = this.#mirror;
    this.#modeBaseline = this.mode;
    this.#readingBaseline = this.reading;
    this.#baselineHeld = true;
  }

  /**
   * The condition, or what was typed under it, changed.
   *
   * Nothing is rebuilt — `data-takes` is what CSS reads, so the ticked rows and
   * the typed box both survive a flip.
   * TRAP T-an-operator-decides-pick-or-type
   */
  #onCondition = (event?: Event): void => {
    if (this.#rows.edit(event)) {
      this.#mirror = false;
      this.#unsaid = null;
    }
    // A NUMBER's host attributes are its BODY's, and a date's. TRAP T-a-number-has-advanced-rows
    if (!this.#typedBody()) this.#rows.followRowOne();
    this.#emitConditions();
  };

  /**
   * The picked condition. `eq` unless a host says otherwise.
   * TRAP T-an-operator-decides-pick-or-type
   */
  get op(): FilterOp {
    /* A NUMBER body's select is the LIVE answer. Reading `data-op` alone meant
       a value set without a `change` event — a restore, a test, an agent —
       reported the old operator. Read the control, not the echo of it.
       TRAP T-a-menu-owns-its-own-bodies */
    if (this.dataset['body'] === 'number') {
      const picked = this.#number.op();
      if (picked) return picked;
    }
    return (this.dataset['op'] as FilterOp | undefined) ?? DEFAULT_OP;
  }

  set op(next: FilterOp) {
    this.set('data-op', next);
  }

  /**
   * What was TYPED, for a condition that takes text rather than a pick.
   *
   * Mirrored to `data-value`, because a variant RE-STAMP replaces the whole
   * shadow tree and the box with it — a value living only in the input is lost
   * the moment `data-type` changes. TRAP T-restamp-does-not-abort
   */
  get conditionValue(): string {
    return this.#rows.firstValue()?.value ?? this.dataset['value'] ?? '';
  }

  set conditionValue(next: string) {
    if (this.dataset['value'] !== next) this.set('data-value', next);
    const box = this.#rows.firstValue();
    if (box) box.value = next;
    /* ROW ONE, through the one-row door: a typed condition IS an Advanced
       answer, so a caller who knows nothing of rows still gets one.
       TRAP T-both-answers-are-kept */
    if (next.trim() && this.#offersAdvanced() && this.mode !== 'advanced') this.mode = 'advanced';
    this.#syncDirty();
  }

  /** Narrow rows to a typed substring; a hidden row keeps its tick.
   * TRAP T-menu-search-is-a-substring-find */
  #onSearch = (): void => {
    this.#list.search(this.$<SherpaInputText>('.search')?.value ?? '');
  };

  /** setMatches(counts) — each value row's match count at its end, by value: the
   *  rows that reach this field and hold it. `null` takes them off. Will, TODO 466 */
  setMatches(counts: Readonly<Record<string, number>> | null): void {
    this.#list.setMatches(counts);
  }

  /** Write a child menu's pick count on its row. An empty badge draws nothing. */
  setCount(value: string, count: number): void {
    this.#list.setCount(value, count);
  }

  override onChange(name?: string): void {
    if (name === 'data-body') this.#date.stamp();
    if (name === 'data-swatches') this.#list.drawSwatches();
    if (name === 'data-pending') this.#syncDirty();
    this.#sync();
    if (name === 'data-hide-unavailable') this.#list.markPresent();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /** Open the menu under `trigger`, which is also what it measures against. */
  show(trigger?: HTMLElement): void {
    // Inline, it is already showing and has nothing to place.
    if (this.hasAttribute('data-inline')) return;
    // Before the card shows: its rows are slotted, so opening is when the set is known. TRAP T-show-then-measure
    this.#list.syncSelectAll();
    // Now, not in `toggle`: that fires a task later. TRAP T-the-baseline-is-taken-at-show
    if (this.#shell.show(trigger)) {
      this.#takeBaseline();
      this.#syncDirty();
    }
  }

  hide(): void {
    if (this.hasAttribute('data-inline')) return;
    this.#shell.hide();
  }

  /**
   * @see hide — accepted so one verb closes every Sherpa component.
   * TRAP T-one-verb-proxies-to-the-native-one
   */
  close(): void {
    this.hide();
  }

  toggle(trigger?: HTMLElement): void {
    if (this.open) this.hide();
    else this.show(trigger);
  }

  get open(): boolean {
    return this.#shell.open;
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  /** Commit the draft and close, as the Apply button does. */
  apply(): void {
    this.#onApply();
  }

  /**
   * An OPEN committing menu holding a change Apply has not taken — ticks, or
   * condition rows. TRAP T-a-chip-press-applies-its-menus-draft
   */
  get dirty(): boolean {
    if (!this.#commits || !this.open) return false;
    const key = (values: readonly string[]): string => [...values].sort().join('\u0000');
    if (key(this.values) !== key(this.#baseline)) return true;
    // A switch between Simple and Advanced changes what filters only if its rows differ. Will, TODO 593
    if (this.mode !== this.#modeBaseline) return !sameAnswer(this.#readingBaseline, this.reading);
    return this.mode === 'advanced'
      && JSON.stringify(this.conditions) !== JSON.stringify(this.#conditionBaseline);
  }

  /** What the menu holds. A NUMBER or CALENDAR menu has no rows.
   * TRAP T-menu-value-is-not-always-rows */
  get values(): string[] {
    if (this.dataset['body'] === 'number') {
      const one = this.#number.values();
      if (one) return one;
    }
    return this.#date.values() ?? this.#list.values();
  }

  set values(next: readonly string[]) {
    // A list given is a list, not ALL: its host says all after, where it is.
    this.#list.all = false;
    /* Nothing to show them yet: HELD until it is drawn — a date's calendar is
       light DOM, so it takes them now. A drill moves the rows themselves, so
       once drawn they stay the live answer.
       TRAP T-a-value-before-the-first-render-is-held */
    if (!this.#card() && this.dataset['body'] !== 'date') {
      this.#list.held = [...next];
      return;
    }
    if (this.#list.tree || !this.#setBodyValues(next)) this.#list.setValues(next);
    // A set is a change to the DRAFT too. TRAP T-the-footer-owns-nothing-to-save
    this.#syncDirty();
  }

  /**
   * A DATE or NUMBER body takes its values as it reports them — a number ONE,
   * a date one day or two ends — or the getter reads what no caller could ever
   * set. False for a list. TRAP T-a-menu-owns-its-own-bodies
   */
  #setBodyValues(next: readonly string[]): boolean {
    const body = this.dataset['body'];
    // A number holds ONE value; its range is an Advanced row. Will, TODO 375
    if (body === 'number') {
      this.#setNumberBody(next[0] ?? '');
      return true;
    }
    if (body !== 'date') return false;
    // Not stamped yet: HELD, and the shape is said NOW. TRAP T-a-value-before-the-first-render-is-held
    if (!this.#date.set(next)) {
      this.#list.held = [...next];
      return true;
    }
    this.#syncBody();
    return true;
  }

  /** Write a number's one value. */
  #setNumberBody(one: string): void {
    this.#number.set(one);
    this.#syncBody();
  }

  /**
   * populate([{ value, label, selected?, available? }]) — the menu's items.
   *
   * THE MENU chooses the markup, from `data-select` and from what each value
   * is. A caller hands over DATA; handing over markup is what let a chip menu
   * and a column heading menu drift into different controls over the same
   * field. TRAP T-one-field-one-filter-menu
   */
  protected override renderData(data: unknown): void {
    this.items(Array.isArray(data) ? (data as MenuItem[]) : []);
  }

  /**
   * items([...]) — the SYNCHRONOUS door, for a caller building a detached tree.
   *
   * `populate()` awaits `rendered`, and a cloned `<sherpa-menu>` does not
   * upgrade until it enters the page — so the await never settles and the menu
   * stays empty. This records the items NOW and stamps what it can; `onRender`
   * stamps the rest. TRAP T-custom-element-upgrade
   */
  items(next: readonly MenuItem[]): void {
    this.#list.items(next);
  }

  /** Each item's value, label and parent, from the items — a row not drawn yet
   *  too, as a shut parent's children are. TRAP T-a-tree-menu-keeps-its-ticks-as-data */
  get itemData(): Array<{ value: string; label: string; parent?: string; swatch?: number | string }> {
    return this.#list.itemData;
  }

  /**
   * The values the filters before it LEAVE, as value keys — its host's, from the
   * source. A row they rule out is greyed and refused, a TICKED one too: it stays
   * ticked, and Clear lets it go. `null` limits nothing. Silent: no event.
   * TRAP T-a-ruled-out-value-is-greyed
   */
  set present(values: readonly string[] | null) {
    this.#list.setPresent(values);
  }
  get present(): readonly string[] | null {
    return this.#list.present;
  }

  /** Who among the presets on holds a value: its row is ticked, refused and says
   *  why; no answer of the reader's, so its values leave it out. Will, TODOs 521, 590 */
  set heldByPreset(held: ((value: string) => string) | null) {
    this.#list.heldBy = held;
  }

  /** What a serial set's chain OFFERS; a row it does not is removed, unless
   *  ticked. `null` is everything. TRAP T-a-filter-set-groups-or-chains */
  set offered(values: readonly string[] | null) {
    this.#list.setOffered(values);
  }
  get offered(): readonly string[] | null {
    return this.#list.offered;
  }

  /* ── Private ─────────────────────────────────────────────────────── */

  /** This menu's OWN light-DOM nodes: a menu nested in it answers for itself.
   *  TRAP T-a-nested-menu-answers-for-itself */
  #own<T extends Element>(selector: string): T[] {
    return [...this.querySelectorAll<T>(selector)].filter((n) => n.closest('sherpa-menu') === this);
  }

  /** The drill trail. An `href` would dismiss the popover.
   * TRAP T-drill-crumbs-carry-no-href */
  #syncCrumb(): void {
    const crumbs = this.$<SherpaBreadcrumbs>('.drill-crumbs');
    if (!crumbs) return;
    const from = this.dataset['drillFrom'];
    if (!from) {
      crumbs.populate([]);
      return;
    }
    crumbs.populate([{ label: from }, { label: this.dataset['heading'] ?? '' }]);
  }

  /**
   * The chosen body's own numbers, its available days, and the Range switch.
   * TRAP T-a-menu-owns-its-own-bodies
   */
  #syncBody(): void {
    const body = this.dataset['body'];
    if (!body) return;
    this.$('.body-range-switch')?.toggleAttribute('checked', this.hasAttribute('data-range'));
    if (body === 'date') return this.#date.sync();
    if (body !== 'number') return;
    this.#number.sync();
    // …and every range row's slider. TODO 375
    this.#rows.sliders();
    this.#number.fill();
  }

  /** Bring the body, the inline state, the mode and the drill trail into line. */
  #sync(): void {
    this.#syncReadonly();
    this.#syncBody();
    this.#shell.syncInline();
    this.#enforceMode();
    this.#syncCrumb();
    /* A field that did not opt in has no rows at all — not a hidden one. A
       control nothing can reach should not exist.
       TRAP T-conditions-are-opt-in-per-field */
    if (this.#offersAdvanced()) this.#rows.sync();
    // The name must reach a screen reader even when no heading is drawn.
    // TRAP T-calendar-header-has-no-heading
    // ALWAYS named: the card is a dialog, and a dialog with no name is a failure.
    // TRAP T-a-menu-is-a-dialog-of-native-controls
    this.#card()?.setAttribute('aria-label', this.dataset['heading'] || this.getAttribute('aria-label') || this.word('menu'));
    // A shared name makes the browser enforce "one at a time".
    this.#list.nameRadios();
  }

  /** READ-ONLY: every answer region is `inert` — shown, never changed. */
  #syncReadonly(): void {
    const readonly = this.hasAttribute('data-readonly');
    for (const region of this.$$('.rows, .condition-rows, .search, .body-range, .body-number')) {
      region.toggleAttribute('inert', readonly);
    }
    this.#rows.readonly();
  }

  /** Opened: remember the picks Discard restores. Closed: settle them. */
  #onToggle = (event: Event): void => {
    const open = (event as ToggleEvent).newState === 'open';
    this.toggleAttribute('open', open);
    if (open) {
      // An open that did not come through show().
      if (!this.#baselineHeld) this.#takeBaseline();
      this.#syncDirty();
      this.#shell.listen();
    } else {
      /* A COMMITTING menu holds ticks as a DRAFT until Apply. Closing any other
         way — clicking away, Escape — discards them, as Discard does.
         Without this the draft survived: the chip read ["Northwind"] while
         `current` stayed false, so it LOOKED set and filtered nothing.
         TRAP T-a-draft-dies-with-its-menu */
      if (this.#commits && !this.#applying && !this.#settledByAction) {
        this.#restoreValues();
        /* The ROWS are a draft too — but only when they actually DIFFER.
           `conditions =` REBUILDS every row, and a rebuilt row's value select
           is filled asynchronously, so restoring identical rows still blanked
           the answer for a tick — long enough for the chip to read it as empty
           and switch itself off. TRAP T-a-condition-is-a-draft-too */
        if (this.mode === 'advanced'
          && JSON.stringify(this.conditions) !== JSON.stringify(this.#conditionBaseline)) {
          this.conditions = this.#conditionBaseline;
          this.#unsaid = this.#unsaidBaseline;
        }
      }
      this.#settledByAction = false;
      this.#baselineHeld = false;
      this.#shell.closed();
    }
    this.emit(open ? 'menu-open' : 'menu-close');
  };

  override onDisconnect(): void {
    this.#shell.stop();
    this.#list.stop();
  }

  /** What a reader's act says beyond its ticks. ALL: Select all on. A list left
   *  empty says nothing: it filters nothing (Will, TODO 550). TRAP T-all-is-an-answer */
  #said(): { all?: true } {
    if (this.mode === 'advanced') return {};
    return this.#list.said();
  }

  /** EVERY value ticked, on purpose — Select all on, or its host's answer: a row
   *  that comes later is ticked too. Will, TODO 489 · TRAP T-all-is-an-answer */
  get all(): boolean {
    return this.#list.all;
  }
  set all(on: boolean) {
    this.#list.all = on;
  }

  /** Rows changed — re-read select-all, re-place next frame. */
  #onRowsChanged = (): void => {
    const held = this.#list.held;
    if (held && this.#list.inputs().length) this.values = held;
    this.#list.syncSelectAll();
    /* A condition row's value select is BUILT from these rows, and row one is
       built before they arrive — so it opened empty while row two, added
       later, was full. TRAP T-a-value-select-waits-for-the-rows */
    this.#rows.refill();
    this.#shell.rowsChanged();
  };

  /** Report the back arrow; the menu cannot know what it drilled into.
   * TRAP T-menu-back-is-a-report */
  #onBack = (event: Event): void => {
    event.stopPropagation();
    this.emit('menu-back');
  };

  /** ArrowRight opens a row's child menu, and ArrowLeft goes back, as in an OS menu. */
  #onRowKey = (event: KeyboardEvent): void => {
    // An inner set moved on this key already. TRAP T-one-tab-stop-per-set
    if (event.defaultPrevented) return;
    // In a text field or a slider an arrow moves the caret or the value. TODO 317
    const at = event.composedPath()[0];
    if ((at instanceof HTMLInputElement && at.type !== 'checkbox' && at.type !== 'radio')
      || at instanceof HTMLTextAreaElement || (at instanceof HTMLElement && at.isContentEditable)) return;
    this.#list.key(event);
  };

  /** A row changed: report it, or hold it for Apply. */
  #onChange = (event: Event): void => {
    const what = this.#list.change(event);
    if (!what) return;
    if (what === 'all') {
      this.#followPicks();
      if (!this.#commits) this.emit('menu-change', { values: this.values, ...this.#said() });
      return;
    }
    if (what === 'value') {
      this.#followPicks();
      // A row let go that is ruled out is refused now — and goes, hiding them. TODO 462
      this.#list.settle();
    }
    this.#report();
  };

  /** The number field changed. */
  #onBodyChange = (event: Event): void => {
    const from = event.target as Element;
    if (!from.matches('.body-number-one')) return;
    this.#passOn(event);
    // LIVE, it reports while it moves; its source waits for the moves to stop. TODO 107
    if (event.type === 'change' || this.dataset['applyOn'] === 'input') this.#report();
  };

  /** A PART's `input` or `change` stops at this host, so the menu passes a
   *  plain one on — as a row's reaches it. A committing menu's host reads its
   *  draft from it. TRAP T-native-change-stops-at-the-host */
  #passOn = (event: Event): void => {
    event.stopPropagation();
    this.dispatchEvent(new Event(event.type, { bubbles: true }));
  };

  /** Report the values — or, in a COMMITTING menu, hold them as a DRAFT until Apply. */
  #report(): void {
    if (this.#commits) return;
    this.emit('menu-change', { values: this.values, ...this.#said() });
  }

  /** Whether changes wait for Apply. */
  get #commits(): boolean {
    return this.hasAttribute('data-commit');
  }

  /** Tell the footer whether Apply has anything to take — a committing menu only. */
  #syncDirty(): void {
    const footer = this.$<HTMLElement>('.footer');
    if (!footer) return;
    if (this.#commits) footer.dataset['dirty'] = String(this.dirty);
    // Its bar's scope waits: Discard is on while the answer is not applied. TODO 406
    else if (this.hasAttribute('data-discard')) footer.dataset['dirty'] = String(this.hasAttribute('data-pending'));
    else delete footer.dataset['dirty'];
  }

  /** A tick or a keystroke: the event carries the new state, so read it NOW —
   *  an Apply pressed in the same moment must already be on. */
  #onDraft = (): void => {
    this.#syncDirty();
  };

  /** True while Apply or Discard settles the card — they own the values. */
  #applying = false;

  /** Apply has already settled this draft, so the CLOSE must not
   *  restore anything. `hidePopover()` fires `toggle` asynchronously, so
   *  `#applying` is false again by then. TRAP T-a-condition-is-a-draft-too */
  #settledByAction = false;

  /** Apply: commit the picks and close. */
  #onApply = (): void => {
    // Apply rewrites the baseline Discard would restore.
    this.#applying = true;
    this.#settledByAction = true;
    this.#takeBaseline();
    this.emit('menu-apply', { values: this.values, ...this.#said() });
    /* The ROWS are part of what Apply applies. Without this a committing menu
       held its conditions for ever. TRAP T-a-condition-is-a-draft-too */
    if (this.mode === 'advanced') this.#emitConditions(true);
    this.emit('menu-change', { values: this.values, ...this.#said() });
    this.hide();
    this.#applying = false;
  };

  /** Discard: every change since the menu opened goes, and it STAYS OPEN. Will, TODO 395 */
  #onDiscard = (): void => {
    // Restore, THEN report.
    this.#applying = true;
    this.#restoreValues();
    this.mode = this.#modeBaseline;
    // Rows only when they differ: a rebuilt row reads empty for a tick. TRAP T-a-condition-is-a-draft-too
    if (this.mode === 'advanced' && JSON.stringify(this.conditions) !== JSON.stringify(this.#conditionBaseline)) {
      this.conditions = this.#conditionBaseline;
      this.#unsaid = this.#unsaidBaseline;
    }
    this.#mirror = this.#mirrorBaseline;
    this.#applying = false;
    this.#syncDirty();
    this.emit('menu-discard');
  };

  /** Empty the selection and report it — the checkboxes AND a slotted
   * calendar's date attributes. TRAP T-clear-empties-both-body-shapes */
  #onClear = (): void => {
    this.#list.clear();
    // A FILTER menu's typed value is part of what Clear empties.
    if (this.dataset['type'] === 'filter') this.conditionValue = '';
    /* BOTH HALVES. Clear means "no filter", and a menu with two modes holds
       its answer in two places — leaving the rows behind gave a cleared chip
       that was still filtering. TRAP T-clear-empties-both-modes */
    if (this.#rows.rows().length) this.conditions = [];
    this.#date.clear();
    // A cleared range is untouched again. The reset writes both ends, which
    // re-flags it, so the flag comes off LAST.
    // TRAP T-a-full-range-is-still-a-range
    for (const s of this.#own<SherpaSlider>('sherpa-slider')) {
      s.range = [Number(s.getAttribute('min') ?? 0), Number(s.getAttribute('max') ?? 100)];
      s.removeAttribute('data-touched');
    }
    /* A NUMBER BODY is the menu's own, in its shadow root — the sweeps above
       reach slotted children only, so Clear left its field as it was.
       TRAP T-a-number-is-reset-not-cleared */
    if (this.dataset['body'] === 'number') {
      this.#setNumberBody('');
      this.#syncDirty();
    }
    this.emit('menu-clear');
    /* ALWAYS, even on a COMMITTING menu. Clear is an action ON THE FILTER, not
       an edit to a draft: without this the menu emptied itself and the query
       kept every value, so the card and the rows disagreed until the reader
       found Apply. Apply and Cancel still own the row TICKS.
       TRAP T-every-chip-menu-gets-clear-and-search */
    this.emit('menu-change', { values: this.values });
    // The rows went too, so whoever holds their clause must hear about it.
    if (this.mode === 'advanced') this.#emitConditions(true);
  };

  /** Drive the slotted calendar to today; stays OPEN.
   * TRAP T-today-and-remove-are-menu-chrome */
  #onToday = (): void => {
    this.#date.today();
  };

  /** Remove — the footer-button form of a `<button value="remove">` row. */
  #onRemove = (): void => {
    this.emit('menu-select', { value: 'remove', label: this.$('.remove')?.textContent?.trim() ?? '' });
    this.hide();
  };

  /** An ACTION row was clicked: report it and close; value rows stay open. */
  #onClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    // A nested menu's click is its own. TRAP T-a-nested-menu-answers-for-itself
    if (target.closest('sherpa-menu') !== this) return;
    // A tree's twisty, or a child menu's row. TODO 369 · TRAP T-a-row-opens-its-child-menu
    if (this.#list.click(event)) return;
    // Only plain ACTION rows close the menu; value rows stay open.
    const button = target.closest('button');
    if (!button || button.disabled) return;
    this.emit('menu-select', { value: button.value, label: button.textContent?.trim() ?? '' });
    // An action that changes the MENU, not the page, keeps it open. TRAP T-an-action-row-can-keep-its-menu-open
    if (!button.hasAttribute('data-stay-open')) this.hide();
  };

  /** A click on no control is the menu's own: the card is drawn over the page,
   *  but in the DOM it is inside its host. TRAP T-a-gap-click-is-the-menus-own */
  #onGapClick = (event: Event): void => {
    if (this.hasAttribute('data-inline')) return;
    const path = event.composedPath();
    const inside = path.slice(0, path.indexOf(this));
    if (inside.some((n) => n instanceof Element && n.matches(CONTROL))) return;
    event.preventDefault();
    event.stopPropagation();
  };
}

define('sherpa-menu', SherpaMenu);
