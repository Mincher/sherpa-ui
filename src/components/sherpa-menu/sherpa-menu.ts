/**
 * sherpa-menu — the dropdown card: value rows, condition rows, number and date bodies.
 *
 * On the native popover API.
 *
 * The browser owns the top layer, Escape, outside-click and focus. `#place()`
 * measures the trigger: CSS anchoring cannot cross a shadow root.
 * TRAP T-anchor-cross-root
 * TRAP T-menu-rows-stay-native-controls
 *
 * @prop {string[]} values — the checked row values (read/write)
 *
 * @see TRAP T-footer-row-raises-on-any-flag
 *
 * Map:
 * - MenuItem — One item a menu draws for itself.
 */
import { SHARED_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import {
  DEFAULT_OP, OPS_FOR_TYPE, OP_LABELS, OP_TAKES, type FilterOp, valueSet,
} from '../../core/data/store.js';
import type { ConditionType, FieldCondition } from '../../core/data/filter-state.js';
import { NON_VALUE_ROWS } from '../../core/ui/shared-constants.js';
// TRAP T-menu-composes-real-components — the page may not have imported these.
import '../sherpa-breadcrumbs/sherpa-breadcrumbs.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-badge/sherpa-badge.js';

/** One item a menu draws for itself. */
export interface MenuItem {
  value: string;
  /** What a reader sees. Defaults to `value`. */
  label?: string;
  selected?: boolean;
  /** Whether a remaining row carries it. Recorded, never drawn: every item is
   *  listed the same way and the checkbox is the only signal. */
  available?: boolean;
  /** A SECOND fact, drawn muted after the label — where a filter lives now. */
  note?: string;
  /** The section it is in. A heading is drawn where the section changes.
   *  TRAP T-saved-filters-are-the-custom-section */
  section?: string;
  /** It opens a CHILD MENU: a caret at its end, which reports `menu-drill`.
   *  TRAP T-a-row-opens-its-child-menu */
  drill?: boolean;
  /** `false`: no tick box — a row naming what it cannot pick. */
  pickable?: boolean;
  /** How many picks its child menu holds, as a badge. */
  count?: number;
}

/** The mode's spellings before 2026-09-25, still heard.
 *  TRAP T-a-renamed-attribute-keeps-its-old-name */
const OLD_MODES: Readonly<Record<string, ConditionType>> = { select: 'default', condition: 'custom' };

/** A mode in either spelling, as the one it means. */
const modeOf = (raw: string | undefined): ConditionType =>
  (OLD_MODES[raw ?? ''] ?? raw) === 'custom' ? 'custom' : 'default';

/** A composed `sherpa-input-text`: it carries a value, and a select variant
 *  takes its options through `populate()`. */
type FieldEl = HTMLElement & { value: string; populate?: (d: unknown) => unknown };

export class SherpaMenu extends SherpaElement {
  static override css = new URL('./sherpa-menu.css', import.meta.url);
  static override html = new URL('./sherpa-menu.html', import.meta.url);
  static override props = {
    'data-bounds': SHARED_PROPS['data-bounds'],
    'data-select': { type: 'enum', kind: 'style', values: ['single', 'multiple'] },
    'data-drill': { type: 'boolean', kind: 'style' },
    // A list of filters: no Select all. Read when the items stamp.
    'data-no-select-all': { type: 'boolean', kind: 'style' },
    /* FILTER type only — which ops its condition dropdown offers, and which
       body answers it. TRAP T-an-operator-decides-pick-or-type */
    'data-conditions': { type: 'string', kind: 'style' },
    'data-takes': { type: 'enum', kind: 'style', values: ['list', 'text'] },
    /* Which of the two modes is showing: a Default or a Custom Condition
       Filter. TRAP T-a-filter-menu-has-two-modes */
    'data-mode': { type: 'enum', kind: 'style', values: ['default', 'custom'] },
    /* Whether this field offers a Custom Condition Filter AT ALL.
       TRAP T-conditions-are-opt-in-per-field */
    'data-custom': { type: 'boolean', kind: 'style', fallbackAttr: 'data-conditional' },
    /* CUSTOM AND NOTHING ELSE. A field whose values are a wall — an email
       column of 240 — has no list worth ticking, so there is no second mode to
       switch to and the switch is hidden. It IMPLIES `data-custom`.
       TRAP T-a-filter-answers-by-values-conditions-or-both */
    'data-custom-only': { type: 'boolean', kind: 'style', fallbackAttr: 'data-conditions-only' },
    /* WHICH BODY this menu draws. A body lives in THIS component's shadow root,
       so one spelling and one set of rules serve every host.
       TRAP T-a-menu-owns-its-own-bodies */
    'data-body': { type: 'enum', kind: 'style', values: ['number', 'date'] },
    /* A number body's ends and step. They CLAMP the field as well as the
       slider — typing 500 into a 0..100 filter asks for a row that cannot
       exist. TRAP T-grid-slider-spans-real-values */
    'data-min': { type: 'string', kind: 'style' },
    'data-max': { type: 'string', kind: 'style' },
    'data-step': { type: 'string', kind: 'style' },
    /* A HELD range's two ends, so a rebuilt heading does not forget itself.
       TRAP T-range-switch-swaps-not-rebuilds */
    'data-from': { type: 'string', kind: 'style' },
    'data-to': { type: 'string', kind: 'style' },
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
    /* A RANGE body offers two ends; `data-commit` holds its Apply until asked. */
    'data-range': { type: 'boolean', kind: 'style' },
    'data-commit': { type: 'boolean', kind: 'style' },
    // A "Save filter" action. TRAP T-save-packs-the-fields-into-one-chip
    'data-saveable': { type: 'boolean', kind: 'style' },
  } as const;

  static override observed = [
    'data-heading',
    'data-align',
    'data-search',
    'data-clearable',
    'data-removable',
    'data-type',
    // The crumb text is written from this, so a change must reach #syncCrumb.
    'data-drill-from',
    // Which condition is picked — a host may set it, and #sync follows.
    'data-op',
    'data-mode',
    'data-inline',
    // What was typed under it. An ATTRIBUTE, so a re-stamp cannot lose it.
    'data-value',
    'open',
  ];

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

  /** Gap between trigger and card. */
  static readonly OFFSET = 4;

  /** The open menu's trigger — re-measured on scroll / resize. */
  #trigger: HTMLElement | null = null;
  /** What Cancel restores. TRAP T-cancel-baseline-captured-on-open */
  #baseline: string[] = [];

  /** The popover card. */
  #card(): HTMLElement | null {
    return this.$('.menu');
  }

  /** The nearest drawn box to hang an untriggered card on: the element this
   * menu is slotted into, else its own parent.
   * TRAP T-a-menu-with-no-trigger-lands-at-the-origin */
  #fallbackTrigger(): HTMLElement | null {
    const slotted = this.assignedSlot?.getRootNode();
    const host = slotted instanceof ShadowRoot ? slotted.host : null;
    const near = host ?? this.parentElement;
    return near instanceof HTMLElement ? near : null;
  }

  override onRender(): void {
    this.#syncInline();
    this.#sync();
    /* Items given BEFORE this element had a shadow tree. A caller building a
       chip clones an UNUPGRADED <sherpa-menu>, so there is no template to
       stamp from until it enters the page.
       TRAP T-custom-element-upgrade */
    this.#stampItems();
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
    this.addEventListener('click', this.#onClick);
    this.$('.apply')?.addEventListener('click', this.#onApply);
    this.$('.cancel')?.addEventListener('click', this.#onCancel);
    this.$('.clear')?.addEventListener('click', this.#onClear);
    this.$('.today')?.addEventListener('click', this.#onToday);
    this.$('.remove')?.addEventListener('click', this.#onRemove);
    this.$('.save')?.addEventListener('click', this.#onSave);
    this.$('.search')?.addEventListener('input', this.#onSearch);
    /* Composed sherpa-input-texts, which re-dispatch `change` and `input`
       from the HOST — so ONE listener on the region covers every stamped row.
       A row added later needs no wiring of its own. */
    const region = this.$('.condition-rows');
    region?.addEventListener('change', this.#onCondition);
    region?.addEventListener('input', this.#onCondition);
    this.$('.use-condition')?.addEventListener('click', this.#onModeSwitch);
    region?.addEventListener('click', this.#onRowButton);
  }

  /* ── The two modes ──────────────────────────────────────────────── */

  /** default | custom — a Default or a Custom Condition Filter.
   *  TRAP T-a-filter-menu-has-two-modes */
  get mode(): ConditionType {
    return modeOf(this.dataset['mode']);
  }

  /** A host writing `data-mode="custom"` on a field that did not opt in is
   *  refused, the same as a click. The attribute is not a second door.
   *  TRAP T-conditions-are-opt-in-per-field */
  #enforceMode(): void {
    // An OLD spelling is heard, and written back in the new words.
    const old = OLD_MODES[this.dataset['mode'] ?? ''];
    if (old) this.dataset['mode'] = old;
    /* CUSTOM ONLY has no other mode to be in, so it opens in one and
       cannot leave. TRAP T-a-filter-answers-by-values-conditions-or-both */
    if (this.#customOnly()) {
      if (this.dataset['mode'] !== 'custom') this.dataset['mode'] = 'custom';
      return;
    }
    if (this.dataset['mode'] === 'custom' && !this.#offersCustom()) {
      this.removeAttribute('data-mode');
    }
  }

  /** This field offers a Custom Condition Filter. `only` implies it.
   *  The old name still counts. TRAP T-a-renamed-attribute-keeps-its-old-name */
  #offersCustom(): boolean {
    return this.hasAttribute('data-custom') || this.hasAttribute('data-conditional')
      || this.#customOnly();
  }

  /** Answered by a Custom Condition Filter alone — no value list behind it. */
  #customOnly(): boolean {
    return this.hasAttribute('data-custom-only') || this.hasAttribute('data-conditions-only');
  }

  /** The button says where it GOES, not where you are: fx into the condition
   *  rows, a list icon back to the ticked values. */
  #syncModeButton(): void {
    const btn = this.$('.use-condition');
    if (!btn) return;
    const inCustom = this.mode === 'custom';
    btn.setAttribute('data-icon-start', inCustom ? 'list' : 'function');
    btn.setAttribute('aria-pressed', String(inCustom));
    // Will's two names for the two modes of ONE system. TRAP T-one-condition-system
    btn.setAttribute('aria-label', inCustom ? 'Default condition' : 'Custom condition');
  }

  set mode(next: ConditionType | 'select' | 'condition') {
    const to = modeOf(next);
    /* A field that did not opt in has no custom mode to be in — the button
       is hidden, and a host writing the attribute must not get one either.
       TRAP T-conditions-are-opt-in-per-field */
    if (to === 'custom' && !this.#offersCustom()) return;
    // There is nowhere else to go. TRAP T-a-filter-answers-by-values-conditions-or-both
    if (to === 'default' && this.#customOnly()) return;
    this.dataset['mode'] = to;
    this.#syncModeButton();
  }

  /** Drawn once — a re-populate would lose what the reader picked. */
  #opsDrawn = false;

  /** The body's operator changed. */
  #onBodyOp = (event: Event): void => {
    const value = (event.target as HTMLElement & { value?: string }).value;
    if (!value) return;
    this.dataset['op'] = value;
    this.#emitConditions(true);
  };

  /** Range ON is two ends, OFF is one value; both shapes keep what they hold.
   *
   *  THE MENU LISTENS, not its host. A host that bound this listener lost it
   *  the moment a filter panel borrowed the menu away.
   *  TRAP T-a-borrowed-menu-leaves-its-toolbars-listeners-behind */
  #onRangeSwitch = (event: Event): void => {
    event.stopPropagation();
    const on = !!(event.target as HTMLElement & { checked?: boolean }).checked;
    this.toggleAttribute('data-range', on);
    // A RANGE defers: the pick is not finished on its first end.
    if (!this.hasAttribute('data-commit-fixed')) this.toggleAttribute('data-commit', on);
    /* A FLIP names both sides. Any previous single pick is left alone —
       re-picking starts a range anyway. */
    this.querySelector('sherpa-calendar')?.setAttribute('data-type', on ? 'range' : 'single');
    this.#syncBody();
    this.emit('menu-range-change', { range: on });
  };

  /** Switch between the value list and the condition rows. */
  #onModeSwitch = (): void => {
    if (!this.#offersCustom() || this.#customOnly()) return;
    const next: ConditionType = this.mode === 'custom' ? 'default' : 'custom';
    this.mode = next;
    // A custom mode with no rows has nothing to answer with.
    if (next === 'custom' && !this.#rowEls().length) this.#addRow();
    /* CARRY THE PICKS OVER. Ticking three values and pressing the mode button
       is a reader saying "now let me refine THAT" — opening on a blank
       `Equals <first option>` throws their answer away without saying so.
       TRAP T-a-mode-switch-carries-the-answer-over */
    if (next === 'custom') this.#seedFromPicks();
    this.emit('filter-mode-change', { mode: next });
    this.#emitConditions();
  };

  /**
   * Put what is TICKED into the condition rows, when they have nothing of
   * their own. One row per picked value, ORed — which is what a ticked list
   * means. TRAP T-a-mode-switch-carries-the-answer-over
   */
  #seedFromPicks(): void {
    const answered = this.conditions.some((row) =>
      (row.text ?? '').trim() !== '' || (row.picked ?? []).length > 0);
    if (answered) return;
    const picks = this.values;
    if (!picks.length) return;
    this.conditions = picks.map((value, i) => (
      i ? { op: DEFAULT_OP, join: 'or' as const, picked: [value] }
        : { op: DEFAULT_OP, picked: [value] }
    ));
  }

  /**
   * A row's own button: Add on the last row, Remove on every row before it.
   * The LAST row is never dropped — an empty condition mode reads as broken,
   * and Clear is the way to mean "no filter".
   * TRAP T-add-condition-ends-the-last-row
   */
  #onRowButton = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('.add-condition')) {
      const row = this.#addRow();
      this.#emitConditions();
      /* Focus goes WITH the button: the one pressed is hidden now. The new
         field draws on its own clock, so it takes focus once it has. */
      const field = row?.querySelector<HTMLElement & { rendered?: Promise<void> }>('.condition');
      void Promise.resolve(field?.rendered).then(() => field?.focus());
      return;
    }
    const hit = target?.closest?.('.drop-condition');
    if (!hit || this.#rowEls().length <= 1) return;
    hit.closest('.condition-row')?.remove();
    this.#numberRows();
    this.#emitConditions();
  };

  /* ── The condition rows ─────────────────────────────────────────── */

  /** Every condition row, in order. */
  #rowEls(): HTMLElement[] {
    return [...(this.$('.condition-rows')?.querySelectorAll<HTMLElement>('.condition-row') ?? [])];
  }

  /** Stamp one row from the prototype, populate its three selects, append it. */
  #addRow(seed?: FieldCondition): HTMLElement | null {
    const region = this.$('.condition-rows');
    const tpl = this.$<HTMLTemplateElement>('.condition-row-tpl');
    if (!region || !tpl) return null;
    const row = tpl.content.firstElementChild?.cloneNode(true) as HTMLElement | null;
    if (!row) return null;
    region.append(row);
    this.#fillRow(row, seed);
    this.#numberRows();
    return row;
  }

  /** Send the three option sets into one row and set its values. */
  #fillRow(row: HTMLElement, seed?: FieldCondition): void {
    const join = row.querySelector<FieldEl>('.join');
    const cond = row.querySelector<FieldEl>('.condition');
    const pick = row.querySelector<FieldEl>('.condition-pick');
    const text = row.querySelector<FieldEl>('.condition-value');

    void join?.populate?.([
      { value: 'and', label: 'And' },
      { value: 'or', label: 'Or' },
    ]);
    /* OR, not AND. Two rows over ONE field are alternatives — `eq Dana` AND
       `eq Ravi` matches nobody, every time, and that is what a second row
       produced. `#seedFromPicks` already joins carried picks with `or`; a row
       the reader adds now agrees with it.
       TRAP T-two-conditions-over-one-field-are-alternatives */
    if (join) join.value = seed?.join ?? 'or';

    const ops = this.#opList();
    void cond?.populate?.(ops.map((op) => ({
      value: op, label: OP_LABELS[op],
    })));
    const op = seed?.op && ops.includes(seed.op) ? seed.op : (ops[0] ?? DEFAULT_OP);
    if (cond) cond.value = op;
    row.dataset['takes'] = OP_TAKES[op] ?? 'list';

    /* `Equals` answers with a LIST of the field's own values, never a text box.
       The values are the menu's own rows, so there is one vocabulary.
       TRAP T-equals-answers-with-the-fields-own-values */
    const options = this.#valueOptions();
    const want = seed?.picked?.length ? String(seed.picked[0]) : '';
    /* The row REMEMBERS what it wants. `populate()` settles later and
       `#refillPicks` runs on every slotchange, so the live `.value` is not a
       safe record of the reader's answer until the options exist.
       TRAP T-custom-element-upgrade */
    if (want) row.dataset['want'] = want;
    if (pick) {
      /* `populate()` on a composed field that has not upgraded settles LATER,
         so a value written straight after it lands before the <option> it
         names exists — and the select silently keeps its first row. Write it
         AFTER. TRAP T-custom-element-upgrade */
      void Promise.resolve(pick.populate?.(options)).then(() => {
        if (want) pick.value = want;
      });
    }
    if (text) text.value = seed?.text ?? '';
  }

  /** The ops this menu offers, from `data-conditions` or the text set. */
  #opList(): FilterOp[] {
    const declared = this.dataset['conditions'] ?? '';
    const wanted = declared.trim()
      ? declared.split(',').map((op) => op.trim()).filter(Boolean)
      : [...(OPS_FOR_TYPE['text'] ?? [])];
    const ops = wanted.filter((op): op is FilterOp => op in OP_LABELS);
    return ops.length ? ops : [DEFAULT_OP];
  }

  /**
   * The field's own values, led by a `Select…` placeholder.
   *
   * A `<select>` has no placeholder attribute, so an EMPTY first option is the
   * only way to show one — and it doubles as the proof a row is unanswered.
   * TRAP T-an-untouched-select-is-not-an-answer
   */
  #valueOptions(): { value: string; label: string }[] {
    const values = this.#fieldValues();
    return values.length ? [{ value: '', label: 'Select…' }, ...values] : [];
  }

  /** The field's own values, read from the menu's rows. */
  #fieldValues(): { value: string; label: string }[] {
    return this.#rows()
      .filter((row) => !row.matches(NON_VALUE_ROWS))
      .map((row) => ({
        value: row.querySelector<HTMLInputElement>('input')?.value ?? '',
        label: (row.textContent ?? '').trim(),
      }))
      .filter((o) => o.value !== '');
  }

  /** Row ONE has no join. A flag, so CSS hides it and nothing is removed —
   *  a row moved to the front gets its select back. */
  #numberRows(): void {
    const rows = this.#rowEls();
    rows.forEach((row, i) => {
      row.toggleAttribute('data-first', i === 0);
      row.toggleAttribute('data-last', i === rows.length - 1);
    });
  }

  /** Every row, as data. TRAP T-many-conditions-are-one-reading */
  get conditions(): FieldCondition[] {
    return this.#rowEls().map((row, i) => {
      const op = (row.querySelector<FieldEl>('.condition')?.value ?? DEFAULT_OP) as FilterOp;
      const takes = OP_TAKES[op] ?? 'list';
      const out: FieldCondition = { op };
      if (i > 0) out.join = (row.querySelector<FieldEl>('.join')?.value ?? 'or') as 'and' | 'or';
      if (takes === 'list') {
        /* `row.dataset.want` is what the READER chose. A `<select>` shows its
           first option whether or not anyone touched it, so reading `.value`
           made every untouched row report a pick — and a mode switch then
           believed the rows were already answered.
           TRAP T-an-untouched-select-is-not-an-answer */
        const picked = row.dataset['want'] ?? '';
        if (picked) out.picked = [picked];
      } else {
        out.text = row.querySelector<FieldEl>('.condition-value')?.value ?? '';
      }
      return out;
    });
  }

  /** Replace every row from data — a host restoring a saved filter. */
  set conditions(rows: readonly FieldCondition[]) {
    const region = this.$('.condition-rows');
    if (!region) return;
    /* NOTHING TO DO is not a rebuild. Between `replaceChildren()` and the
       async fill of each new row's value select, this menu reports NO
       conditions — and anything reading it in that gap is told the filter is
       gone. TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
    if (JSON.stringify(this.conditions) !== JSON.stringify(rows)) {
      region.replaceChildren();
      for (const row of rows.length ? rows : [{ op: DEFAULT_OP } as FieldCondition]) this.#addRow(row);
    }
    // Every sync rebuilds row one from these two. TRAP T-row-one-is-data-op
    const first = rows[0];
    if (!first) return;
    if (this.dataset['op'] !== first.op) this.dataset['op'] = first.op;
    const text = (OP_TAKES[first.op] ?? 'list') === 'text' ? (first.text ?? '') : '';
    /* `data-value` TOO. A rebuilt row already holds the text, so comparing the
       box alone skipped the write — and the next re-sync put back the empty
       attribute over what a host had set. TRAP T-row-one-is-data-op */
    if (this.conditionValue !== text || (this.dataset['value'] ?? '') !== text) {
      this.conditionValue = text;
    }
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

  /** What Cancel restores, captured on open beside `#baseline`. */
  #conditionBaseline: FieldCondition[] = [];

  /**
   * The condition, or what was typed under it, changed.
   *
   * Nothing is rebuilt — `data-takes` is what CSS reads, so the ticked rows and
   * the typed box both survive a flip.
   * TRAP T-an-operator-decides-pick-or-type
   */
  #onCondition = (event?: Event): void => {
    /* The row the change came from — its OWN op decides its OWN body, so two
       rows can ask different questions at once. */
    const row = (event?.target as HTMLElement | null)?.closest?.('.condition-row');
    if (row instanceof HTMLElement) {
      const op = (row.querySelector<FieldEl>('.condition')?.value ?? DEFAULT_OP) as FilterOp;
      row.dataset['takes'] = OP_TAKES[op] ?? 'list';
      // The reader just answered, so THAT is what the row wants now.
      const picked = row.querySelector<FieldEl>('.condition-pick')?.value ?? '';
      if (picked) row.dataset['want'] = picked;
    }

    // Row one still mirrors to the host attributes: the one-row view.
    const op = (this.#conditionField()?.value ?? DEFAULT_OP) as FilterOp;
    if (this.dataset['op'] !== op) this.dataset['op'] = op;
    this.setAttribute('data-takes', OP_TAKES[op] ?? 'list');
    this.dataset['value'] = this.#valueField()?.value ?? '';

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
      const picked = this.$<HTMLElement & { value?: string }>('.body-op')?.value;
      if (picked && picked in OP_LABELS) return picked as FilterOp;
    }
    return (this.dataset['op'] as FilterOp | undefined) ?? DEFAULT_OP;
  }

  set op(next: FilterOp) {
    this.dataset['op'] = next;
  }

  /**
   * What was TYPED, for a condition that takes text rather than a pick.
   *
   * Mirrored to `data-value`, because a variant RE-STAMP replaces the whole
   * shadow tree and the box with it — a value living only in the input is lost
   * the moment `data-type` changes. TRAP T-restamp-does-not-abort
   */
  get conditionValue(): string {
    return this.#valueField()?.value ?? this.dataset['value'] ?? '';
  }

  set conditionValue(next: string) {
    if (this.dataset['value'] !== next) this.dataset['value'] = next;
    const box = this.#valueField();
    if (box) box.value = next;
  }

  /** ROW ONE's condition field. `menu.op` and `menu.conditionValue` are the
   *  one-row view of the same state, so a caller that knows nothing about
   *  rows still works. TRAP T-a-filter-menu-has-two-modes */
  #conditionField(): FieldEl | null {
    return this.#rowEls()[0]?.querySelector<FieldEl>('.condition') ?? null;
  }

  /** ROW ONE's typed box. */
  #valueField(): FieldEl | null {
    return this.#rowEls()[0]?.querySelector<FieldEl>('.condition-value') ?? null;
  }

  /**
   * Make sure the condition region has at least ONE row, and that row holds
   * what the host asked for through `data-op` / `data-value`.
   *
   * A re-stamp replaces the whole shadow tree, so the rows are rebuilt from
   * the attributes rather than remembered. TRAP T-restamp-does-not-abort
   */
  #syncConditions(): void {
    /* A field that did not opt in has no rows at all — not a hidden one. A
       control nothing can reach should not exist.
       TRAP T-conditions-are-opt-in-per-field */
    if (!this.$('.condition-rows') || !this.#offersCustom()) return;
    if (!this.#rowEls().length) this.#addRow();

    const ops = this.#opList();
    const op = ops.includes(this.op) ? this.op : (ops[0] ?? DEFAULT_OP);
    const select = this.#conditionField();
    if (select && select.value !== op) select.value = op;
    if (this.dataset['op'] !== op) this.dataset['op'] = op;
    this.setAttribute('data-takes', OP_TAKES[op] ?? 'list');
    this.#rowEls()[0]?.setAttribute('data-takes', OP_TAKES[op] ?? 'list');

    // Put back what was typed — a re-stamp blanked the box, not the state.
    const box = this.#valueField();
    const held = this.dataset['value'] ?? '';
    if (box && box.value !== held) box.value = held;
    this.#numberRows();
  }


  /** Narrow rows to a typed substring; a hidden row keeps its tick.
   * TRAP T-menu-search-is-a-substring-find */
  #onSearch = (): void => {
    const field = this.$<HTMLElement & { value?: string }>('.search');
    const q = (field?.value ?? '').trim().toLowerCase();
    let shown = 0;
    // A SECTION heading shows while a row under it does — never on its own name.
    let heading: HTMLElement | null = null;
    let under = false;
    const close = (): void => { heading?.toggleAttribute('data-filtered-out', !under); };
    for (const row of this.#rows()) {
      if (row.classList.contains('menu-section')) {
        close();
        heading = row;
        under = false;
        continue;
      }
      // A composed row draws its name in its own shadow root, so say it here.
      const text = row.getAttribute('data-label') ?? row.textContent ?? '';
      const hit = !q || text.toLowerCase().includes(q);
      // JS writes the flag; CSS owns the hiding.
      row.toggleAttribute('data-filtered-out', !hit);
      if (hit) {
        shown += 1;
        under = true;
      }
    }
    close();
    this.toggleAttribute('data-no-matches', !!q && shown === 0);
  };

  /** A CHILD MENU's door on a row: its pick count, then its caret.
   *  TRAP T-a-row-opens-its-child-menu */
  #addDrill(row: HTMLElement, value: string, label: string, count: number): void {
    row.dataset['drill'] = '';
    row.dataset['value'] = value;
    // The SEARCH reads this: the badge's number is not part of the name.
    row.dataset['label'] = label;
    const badge = this.clone('template.menu-count-tpl');
    const caret = this.clone('template.menu-drill-tpl');
    if (badge) {
      badge.textContent = count > 0 ? String(count) : '';
      row.append(badge);
    }
    if (caret) {
      caret.setAttribute('aria-label', `Open ${label}`);
      row.append(caret);
    }
  }

  /** Write a child menu's pick count on its row. An empty badge draws nothing. */
  setCount(value: string, count: number): void {
    for (const row of this.querySelectorAll<HTMLElement>('.menu-row[data-drill]')) {
      if (row.dataset['value'] !== value) continue;
      const badge = row.querySelector('.menu-row-count');
      if (badge) badge.textContent = count > 0 ? String(count) : '';
    }
  }

  /** Every slotted row — label rows and action buttons alike. */
  #rows(): HTMLElement[] {
    return [...this.children].filter((n): n is HTMLElement => n instanceof HTMLElement);
  }

  override onChange(): void {
    this.#sync();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /** Open the menu under `trigger`, which is also what it measures against. */
  show(trigger?: HTMLElement): void {
    if (trigger) this.#trigger = trigger;
    // No trigger — `open` was set, or a caller forgot one. Without this the
    // card has nothing to measure and sits at 0,0.
    // TRAP T-a-menu-with-no-trigger-lands-at-the-origin
    this.#trigger ??= this.#fallbackTrigger();
    // Inline, it is already showing and has nothing to place.
    if (this.hasAttribute('data-inline')) return;
    // A closed popover measures 0, so show first. TRAP T-show-then-measure
    this.#syncSelectAll();
    this.#card()?.showPopover();
    this.#place();
  }

  hide(): void {
    if (this.hasAttribute('data-inline')) return;
    this.#card()?.hidePopover();
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
    const card = this.#card();
    return !!card?.matches(':popover-open');
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
    return this.mode === 'custom'
      && JSON.stringify(this.conditions) !== JSON.stringify(this.#conditionBaseline);
  }

  /** What the menu holds. A NUMBER or CALENDAR menu has no rows.
   * TRAP T-menu-value-is-not-always-rows */
  get values(): string[] {
    const numeric = this.#numericValues();
    if (numeric) return numeric;
    const dates = this.#calendarValues();
    if (dates) return dates;
    return this.#inputs()
      .filter((i) => i.checked)
      .map((i) => i.value);
  }

  /** A NUMBER menu's value, or null. TRAP T-a-full-range-is-still-a-range */
  #numericValues(): string[] | null {
    if (this.dataset['body'] !== 'number') return null;
    const field = this.$<HTMLInputElement>('.body-number-one');
    const slider = this.$<HTMLElement & { range: [number, number] }>('.body-number-range');
    if (!field && !slider) return null;
    if (this.hasAttribute('data-range')) {
      if (!slider || !slider.hasAttribute('data-touched')) return [];
      const [lo, hi] = slider.range;
      return [String(lo), String(hi)];
    }
    const raw = field?.value.trim() ?? '';
    return raw === '' ? [] : [raw];
  }
  /** A CALENDAR menu's value, or null when this is not one. */
  #calendarValues(): string[] | null {
    const cal = this.querySelector<HTMLElement>('sherpa-calendar');
    if (!cal) return null;
    // A RANGE reports both ends, and only once BOTH are picked.
    const start = cal.dataset['valueStart'];
    const end = cal.dataset['valueEnd'];
    if (start && end) return [start, end];
    const single = cal.dataset['value'];
    return single ? [single] : [];
  }

  set values(next: string[]) {
    // The query's comparison — TRAP T-one-comparison-rule-for-query-and-ui.
    const wanted = valueSet(next);
    for (const input of this.#inputs()) input.checked = wanted.has(input.value);
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
    this.#items = Array.isArray(data) ? (data as MenuItem[]) : [];
    this.#stampItems();
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
    this.#items = [...next];
    this.#stampItems();
  }

  /** The items last given. Kept, so a late render can still stamp them. */
  #items: MenuItem[] = [];

  /**
   * Stamp `#items` into the rows slot. Needs the shadow template, so it is
   * safe to call before this element has one — it simply waits for onRender.
   */
  #stampItems(): void {
    if (!this.#items.length) return;
    const single = this.dataset['select'] === 'single';
    const tpl = this.$<HTMLTemplateElement>(
      single ? 'template.menu-radio-tpl' : 'template.menu-check-tpl',
    );
    if (!tpl?.content.firstElementChild) return;

    const name = `sherpa-menu-${this.dataset['heading'] ?? 'group'}`;
    const stamp = (item: MenuItem): HTMLElement => {
      const bare = item.pickable === false ? this.clone('template.menu-bare-tpl') : null;
      const row = bare ?? tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const box = row.querySelector('input');
      if (box) {
        box.value = item.value;
        box.checked = !!item.selected;
        if (single) box.name = name;
      }
      const label = item.label ?? item.value;
      row.querySelector('.menu-row-label')!.textContent = label;
      /* AN ATTRIBUTE, drawn by CSS: the row is light DOM, and `::slotted` cannot
         reach its children — only the row itself and its pseudo-elements.
         Said to assistive tech too, since generated content is not reliably. */
      if (item.note) {
        row.dataset['note'] = item.note;
        box?.setAttribute('aria-description', item.note);
      }
      if (item.drill) this.#addDrill(row, item.value, label, item.count ?? 0);
      return row;
    };

    /* SELECT ALL is the MENU's row, not the caller's — one of the two used to
       add its own and the other did not, so the same field read two ways. A
       list of FILTERS asks for none. TRAP T-select-all-is-not-a-value */
    const all = !single && this.#items.length && !this.hasAttribute('data-no-select-all')
      ? this.clone('template.menu-all-tpl') : null;

    /* ONE list, in the order the caller gave. A value no remaining row carries
       is still listed and still ticks — that is what `available` is for. It
       does not re-sort or dim: the checkbox already says what is picked, and a
       divider plus a grey row said it a second, noisier way.
       TRAP T-unavailable-value-sorts-below-a-divider */
    const rows: Element[] = [];
    let section: string | undefined;
    for (const item of this.#items) {
      if (item.section && item.section !== section) {
        const head = this.clone('template.menu-section-tpl');
        if (head) {
          head.textContent = item.section;
          rows.push(head);
        }
      }
      section = item.section;
      rows.push(stamp(item));
    }
    // SELECT ALL belongs to the section it heads, so it follows a leading heading.
    const head = rows[0]?.classList.contains('menu-section') ? [rows.shift()!] : [];
    const out: Element[] = all ? [...head, all, ...rows] : [...head, ...rows];
    /* KEEP what the menu does not own. A caller's own rows — a Select-all, a
       Remove action — live here too, and a blanket replace ate them the moment
       this stamped late. Only the menu's own items are replaced. */
    for (const node of [...this.children]) {
      if (node.classList.contains('menu-row')) {
        node.remove();
      }
    }
    /* FIRST, keeping whatever the caller put below — in practice a Remove
       action, which a chip appends after this. */
    this.prepend(...out);

    /* SAY SO. A host reads its own face off the menu's values, and pre-ticked
       rows fire no native change — so a chip built before its items arrived
       would sit with an empty caret over a ticked row.
       TRAP T-chip-empty-check-waits-for-onconnect */
    this.emit('menu-items', { values: this.values });
  }

  /* ── Private ─────────────────────────────────────────────────────── */

  /** Every value row's control; the select-all row is excluded.
   * TRAP T-select-all-is-not-a-value */
  #inputs(): HTMLInputElement[] {
    return Array.from(
      this.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'),
    ).filter((i) => !i.closest(NON_VALUE_ROWS));
  }

  /** The drill trail. An `href` would dismiss the popover.
   * TRAP T-drill-crumbs-carry-no-href */
  #syncCrumb(): void {
    const crumbs = this.$<HTMLElement & { populate(d: unknown): void }>('.drill-crumbs');
    if (!crumbs) return;
    const from = this.dataset['drillFrom'];
    if (!from) {
      crumbs.populate([]);
      return;
    }
    crumbs.populate([{ label: from }, { label: this.dataset['heading'] ?? '' }]);
  }

  /**
   * An INLINE menu is not a popover.
   *
   * The attribute is in the TEMPLATE, so it is removed rather than never
   * written — and putting it back restores the floating card, which is how one
   * element serves a chip and a panel. TRAP T-an-inline-menu-is-the-same-menu
   */
  #syncInline(): void {
    const card = this.#card();
    if (!card) return;
    const inline = this.hasAttribute('data-inline');
    if (inline && card.hasAttribute('popover')) card.removeAttribute('popover');
    else if (!inline && !card.hasAttribute('popover')) card.setAttribute('popover', 'manual');
  }

  /**
   * The chosen body's own numbers, its available days, and the Range switch.
   * TRAP T-a-menu-owns-its-own-bodies
   */
  #syncBody(): void {
    const body = this.dataset['body'];
    if (!body) return;
    this.$('.body-range-switch')?.toggleAttribute('checked', this.hasAttribute('data-range'));

    if (body === 'date') {
      // SLOTTED, not in this shadow root — see the template.
      const cal = this.querySelector<HTMLElement>('sherpa-calendar');
      if (!cal) return;
      /* ONLY when RANGED. A fresh calendar has no `data-type` at all, and
         writing `single` onto it would be this menu answering a question
         nobody asked. The FLIP says `single`, because that is a change. */
      if (this.hasAttribute('data-range')) cal.setAttribute('data-type', 'range');
      const days = this.dataset['available'];
      if (days) cal.setAttribute('data-available', days);
      return;
    }
    if (body !== 'number') return;
    /* THE OPERATOR, from the ONE vocabulary — the same list the condition rows
       read. A host names the set; the menu draws it.
       TRAP T-ops-follow-the-column-type */
    const picker = this.$<HTMLElement & { populate?: (i: unknown[]) => void; value?: string }>('.body-op');
    if (picker && this.hasAttribute('data-conditions')) {
      const ops = this.#opList();
      if (!this.#opsDrawn) {
        this.#opsDrawn = true;
        void picker.populate?.(ops.map((op) => ({ value: op, label: OP_LABELS[op] })));
      }
      const op = ops.includes(this.op) ? this.op : (ops[0] ?? DEFAULT_OP);
      if (this.dataset['op'] !== op) this.dataset['op'] = op;
      if (picker.value !== op) picker.value = op;
    }
    const field = this.$<HTMLElement>('.body-number-one');
    const slider = this.$<HTMLElement>('.body-number-range');
    const min = this.dataset['min'] ?? '0';
    const max = this.dataset['max'] ?? '100';
    for (const el of [field, slider]) {
      if (!el) continue;
      el.setAttribute('min', min);
      el.setAttribute('max', max);
      if (this.dataset['step']) el.setAttribute('step', this.dataset['step']);
    }
    /* A HELD range wins; otherwise a fresh one opens at both ends and excludes
       nothing. `data-touched` says the reader has moved it since.
       TRAP T-a-full-range-is-still-a-range */
    const from = this.dataset['from'];
    const to = this.dataset['to'];
    if (slider && from && to && !slider.hasAttribute('data-touched')) {
      slider.setAttribute('value-start', from);
      slider.setAttribute('value-end', to);
      slider.setAttribute('data-touched', '');
    } else if (slider && !slider.hasAttribute('data-touched')) {
      slider.setAttribute('value-start', min);
      slider.setAttribute('value-end', max);
    }
    // A single held value goes in the field.
    const one = this.dataset['value'];
    if (one && field instanceof HTMLInputElement && field.value === '') field.value = one;
  }

  /** Bring the body, the inline state, the mode and the drill trail into line. */
  #sync(): void {
    this.#syncBody();
    this.#syncInline();
    this.#enforceMode();
    this.#syncCrumb();
    this.#syncConditions();
    this.#syncModeButton();
    // The name must reach a screen reader even when no heading is drawn.
    // TRAP T-calendar-header-has-no-heading
    const card = this.#card();
    const name = this.dataset['heading'] ?? '';
    if (card && name) card.setAttribute('aria-label', name);
    else card?.removeAttribute('aria-label');

    // A shared name makes the browser enforce "one at a time".
    if (this.dataset['select'] === 'single') {
      const name = `sherpa-menu-${this.dataset['heading'] ?? 'group'}`;
      for (const input of this.#inputs()) {
        if (input.type === 'radio' && !input.name) input.name = name;
      }
    }

  }

  /** The box the card stays inside — viewport, or a host's `data-bounds`.
   * A missing or zero-sized box falls back to the viewport.
   * TRAP T-bounds-clamp-to-the-viewport */
  #bounds(): { left: number; top: number; right: number; bottom: number } {
    const viewport = {
      left: 0,
      top: 0,
      right: document.documentElement.clientWidth,
      bottom: document.documentElement.clientHeight,
    };
    const sel = this.dataset['bounds'];
    if (!sel) return viewport;
    const box = document.querySelector(sel)?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return viewport;
    // Never wider than the viewport, or the card follows a scrolled-away box off-screen.
    return {
      left: Math.max(viewport.left, box.left),
      top: Math.max(viewport.top, box.top),
      right: Math.min(viewport.right, box.right),
      bottom: Math.min(viewport.bottom, box.bottom),
    };
  }

  /** Place the card against its trigger, inside the bounds. */
  #place(): void {
    const card = this.#card();
    const trigger = this.#trigger;
    if (!card || !trigger?.isConnected) return;

    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const gap = SherpaMenu.OFFSET;
    // `--_max-h` is the room on the side the card landed on.
    // TRAP T-card-max-height-follows-the-side
    const bounds = this.#bounds();
    const vw = bounds.right;
    const vh = bounds.bottom;

    // Below the trigger, unless there is no room and there IS room above.
    const below = vh - t.bottom - gap * 2;
    const above = t.top - gap * 2;
    let y = t.bottom + gap;
    if (y + c.height > vh && t.top - gap - c.height >= 0) y = t.top - gap - c.height;

    const room = Math.max(below, above);
    if (c.height > below && above > below) y = Math.max(gap, t.top - gap - Math.min(c.height, above));
    card.style.setProperty('--_max-h', `${Math.max(120, Math.round(room))}px`);

    // The trigger's start edge (end edge on data-align="end"), clamped inside.
    let x = this.dataset['align'] === 'end' ? t.right - c.width : t.left;
    if (x + c.width > vw) x = vw - c.width - gap;
    if (x < bounds.left + gap) x = bounds.left + gap;

    if (y < bounds.top + gap) y = bounds.top + gap;

    card.style.setProperty('--_x', `${Math.round(x)}px`);
    card.style.setProperty('--_y', `${Math.round(y)}px`);
  }

  /** A pointerdown anywhere this menu does not own closes it. */
  #onOutsidePointer = (event: Event): void => {
    const path = event.composedPath();
    // Its own card, its own rows, and the trigger that opened it.
    if (path.includes(this)) return;
    const card = this.#card();
    if (card && path.includes(card)) return;
    if (this.#trigger && path.includes(this.#trigger)) return;
    this.hide();
  };

  /** Escape closes this menu, not whatever is under it. */
  #onEscape = (event: Event): void => {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    event.stopPropagation();
    this.hide();
  };

  /** Opened: remember the picks Cancel restores. Closed: settle them. */
  #onToggle = (event: Event): void => {
    const open = (event as ToggleEvent).newState === 'open';
    this.toggleAttribute('open', open);
    if (open) {
      this.#baseline = this.values;
      this.#conditionBaseline = this.conditions;
      /* These live while the menu is OPEN, which is shorter than the element's
         life — `while` is that shorter lifetime, and the base class ANDs it
         with its own disconnect signal.

         `onFrame`, not `on`: #place() reads two boxes, and a scroll listener
         runs per EVENT. Measured before this, 50 scroll events produced 100
         getBoundingClientRect() calls.
         capture: an ancestor's scroll does not bubble.
         TRAP T-a-layout-read-belongs-in-a-frame
         TRAP T-open-menu-resize-closes */
      this.#openAc = new AbortController();
      const whileOpen = { while: this.#openAc.signal, passive: true } as const;
      this.onFrame(window, 'scroll', this.#reposition, { ...whileOpen, capture: true });
      this.on(window, 'resize', this.#onViewportResize, whileOpen);
      this.#cardResize ??= new ResizeObserver(() => this.#place());
      const card = this.#card();
      if (card) this.#cardResize.observe(card);

      /* THE MENU OWNS ITS OWN DISMISS. `popover="manual"` because the rows are
         SLOTTED: the browser reads the DOM tree for light-dismiss, where they
         are children of THIS element and outside the card, so ticking one shut
         the menu with nothing chosen. The composed path says what is really
         inside. TRAP T-a-slotted-row-is-outside-its-own-popover */
      this.on(document, 'pointerdown', this.#onOutsidePointer, {
        ...whileOpen, capture: true,
      });
      this.on(document, 'keydown', this.#onEscape, whileOpen);
    } else {
      /* A COMMITTING menu holds ticks as a DRAFT until Apply. Closing any other
         way — clicking away, Escape — discards them, exactly as Cancel does.
         Without this the draft survived: the chip read ["Northwind"] while
         `current` stayed false, so it LOOKED set and filtered nothing.
         TRAP T-a-draft-dies-with-its-menu */
      if (this.#commits && !this.#applying && !this.#settledByAction) {
        this.values = this.#baseline;
        /* The ROWS are a draft too — but only when they actually DIFFER.
           `conditions =` REBUILDS every row, and a rebuilt row's value select
           is filled asynchronously, so restoring identical rows still blanked
           the answer for a tick — long enough for the chip to read it as empty
           and switch itself off. TRAP T-a-condition-is-a-draft-too */
        if (this.mode === 'custom'
          && JSON.stringify(this.conditions) !== JSON.stringify(this.#conditionBaseline)) {
          this.conditions = this.#conditionBaseline;
        }
      }
      this.#settledByAction = false;
      this.#openAc?.abort();
      this.#openAc = null;
      this.#cardResize?.disconnect();
      this.#trigger = null;
    }
    this.emit(open ? 'menu-open' : 'menu-close', {});
  };

  /** Watches the card's box, so a body that grows re-places. */
  #cardResize: ResizeObserver | null = null;
  /** Aborts when the menu SHUTS — the viewport listeners' own lifetime. */
  #openAc: AbortController | null = null;

  /** Scrolled or resized while open: place the card again. */
  #reposition = (): void => {
    this.#place();
  };

  /** The window resized: close rather than float somewhere wrong. */
  #onViewportResize = (): void => {
    this.hide();
  };

  override onDisconnect(): void {
    // The viewport listeners carry their own signals; only the observer is manual.
    this.#openAc?.abort();
    this.#cardResize?.disconnect();
  }

  static readonly ALL_LABEL = 'Select all';

  /** The select-all control (class `qf-all`). */
  #allRow(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>('.qf-all input');
  }

  /** Tick or clear every value row — writes the BOXES, so a committing menu's
   * draft still works. TRAP T-select-all-ticks-boxes-not-values */
  #onSelectAll(input: HTMLInputElement): void {
    // Read the SET, not the box. TRAP T-indeterminate-reports-false
    const boxes = this.#inputs();
    const on = boxes.some((b) => !b.checked);
    for (const box of boxes) box.checked = on;
    input.indeterminate = false;
    this.#syncSelectAll();
    if (!this.#commits) this.emit('menu-change', { values: this.values });
  }

  /** Point select-all at the set: all, some (indeterminate) or none. Rewritten
   * every time the set moves. TRAP T-indeterminate-is-a-property */
  #syncSelectAll(): void {
    const all = this.#allRow();
    if (!all) return;
    const boxes = this.#inputs();
    const on = boxes.filter((b) => b.checked).length;
    all.checked = boxes.length > 0 && on === boxes.length;
    all.indeterminate = on > 0 && on < boxes.length;
    const label = all.parentElement?.querySelector('.qf-row-label');
    if (label) label.textContent = SherpaMenu.ALL_LABEL;
  }

  /** Rows changed — re-read select-all, re-place next frame. */
  #onRowsChanged = (): void => {
    this.#syncSelectAll();
    /* A condition row's value select is BUILT from these rows, and row one is
       built before they arrive — so it opened empty while row two, added
       later, was full. TRAP T-a-value-select-waits-for-the-rows */
    this.#refillPicks();
    if (this.open) requestAnimationFrame(() => this.#place());
  };

  /** Re-send the field's values to every row's value select, keeping each
   *  row's own pick where it still names a value. */
  #refillPicks(): void {
    const options = this.#valueOptions();
    if (!options.length) return;
    for (const row of this.#rowEls()) {
      const pick = row.querySelector<FieldEl>('.condition-pick');
      if (!pick) continue;
      // What the row WANTS beats what the select happens to show.
      const held = row.dataset['want'] || pick.value;
      void Promise.resolve(pick.populate?.(options)).then(() => {
        if (held && options.some((o) => o.value === held)) pick.value = held;
      });
    }
  }

  /** Report the back arrow; the menu cannot know what it drilled into.
   * TRAP T-menu-back-is-a-report */
  #onBack = (event: Event): void => {
    event.stopPropagation();
    this.emit('menu-back', {});
  };

  /** A row or a body control changed: report it, or hold it for Apply. */
  #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    // A NUMBER menu's field and slider are value shapes too.
    // TRAP T-native-change-stops-at-the-host
    const numeric = input.type === 'number' || input.tagName === 'SHERPA-SLIDER';
    if (!numeric && input.type !== 'checkbox' && input.type !== 'radio') return;
    // The SELECT-ALL row drives the others, so it reports for itself.
    if (input.closest('.qf-all')) {
      this.#onSelectAll(input);
      return;
    }
    this.#syncSelectAll();
    // A COMMITTING menu holds the change as a DRAFT until Apply.
    if (this.#commits) return;
    this.emit('menu-change', { values: this.values });
  };

  /** Whether changes wait for Apply. */
  get #commits(): boolean {
    return this.hasAttribute('data-commit');
  }

  /** True while Apply or Cancel is closing the card — they own the values. */
  #applying = false;

  /** Apply or Cancel has already settled this draft, so the CLOSE must not
   *  restore anything. `hidePopover()` fires `toggle` asynchronously, so
   *  `#applying` is false again by then. TRAP T-a-condition-is-a-draft-too */
  #settledByAction = false;

  /** Apply: commit the picks and close. */
  #onApply = (): void => {
    // Apply rewrites the baseline Cancel would restore.
    this.#applying = true;
    this.#settledByAction = true;
    this.#baseline = this.values;
    this.#conditionBaseline = this.conditions;
    this.emit('menu-apply', { values: this.values });
    /* The ROWS are part of what Apply applies. Without this a committing menu
       held its conditions for ever. TRAP T-a-condition-is-a-draft-too */
    if (this.mode === 'custom') this.#emitConditions(true);
    this.emit('menu-change', { values: this.values });
    this.hide();
    this.#applying = false;
  };

  /** Cancel: put the picks back as they were, then close. */
  #onCancel = (): void => {
    // Restore, THEN report.
    this.#applying = true;
    this.#settledByAction = true;
    this.values = this.#baseline;
    if (this.mode === 'custom') this.conditions = this.#conditionBaseline;
    this.emit('menu-cancel', {});
    this.hide();
    this.#applying = false;
  };

  /** Empty the selection and report it — the checkboxes AND a slotted
   * calendar's date attributes. TRAP T-clear-empties-both-body-shapes */
  #onClear = (): void => {
    for (const input of this.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
    // A FILTER menu's typed value is part of what Clear empties.
    if (this.dataset['type'] === 'filter') this.conditionValue = '';
    /* BOTH HALVES. Clear means "no filter", and a menu with two modes holds
       its answer in two places — leaving the rows behind gave a cleared chip
       that was still filtering. TRAP T-clear-empties-both-modes */
    if (this.#rowEls().length) this.conditions = [];
    for (const cal of this.querySelectorAll<HTMLElement>('sherpa-calendar')) {
      for (const a of ['data-value', 'data-value-start', 'data-value-end']) cal.removeAttribute(a);
    }
    // A cleared range is untouched again. The reset writes both ends, which
    // re-flags it, so the flag comes off LAST.
    // TRAP T-a-full-range-is-still-a-range
    for (const s of this.querySelectorAll<HTMLElement & { range: [number, number] }>('sherpa-slider')) {
      s.range = [Number(s.getAttribute('min') ?? 0), Number(s.getAttribute('max') ?? 100)];
      s.removeAttribute('data-touched');
    }
    this.emit('menu-clear', {});
    /* ALWAYS, even on a COMMITTING menu. Clear is an action ON THE FILTER, not
       an edit to a draft: without this the menu emptied itself and the query
       kept every value, so the card and the rows disagreed until the reader
       found Apply. Apply and Cancel still own the row TICKS.
       TRAP T-every-chip-menu-gets-clear-and-search */
    this.emit('menu-change', { values: this.values });
    // The rows went too, so whoever holds their clause must hear about it.
    if (this.mode === 'custom') this.#emitConditions(true);
  };

  /** Drive the slotted calendar to today; stays OPEN.
   * TRAP T-today-and-remove-are-menu-chrome */
  #onToday = (): void => {
    for (const cal of this.querySelectorAll<HTMLElement & { today?: () => void }>('sherpa-calendar')) {
      cal.today?.();
    }
  };

  /** Save — asks for this filter to be kept, as `menu-select` with value="save". */
  #onSave = (): void => {
    this.emit('menu-select', { value: 'save', label: 'Save filter' });
    this.hide();
  };

  /** Remove — the footer-button form of a `<button value="remove">` row. */
  #onRemove = (): void => {
    this.emit('menu-select', { value: 'remove', label: 'Remove' });
    this.hide();
  };

  /** An ACTION row was clicked: report it and close; value rows stay open. */
  #onClick = (event: Event): void => {
    /* A CHILD MENU's caret — or the whole of a row with no tick box — opens
       it. preventDefault, or the label ticks its box as well.
       TRAP T-a-row-opens-its-child-menu */
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('.menu-row[data-drill]');
    if (row && (target.closest('.menu-row-drill') || row.classList.contains('menu-row-bare'))) {
      event.preventDefault();
      event.stopPropagation();
      this.emit('menu-drill', { value: row.dataset['value'] ?? '' });
      return;
    }
    // Only plain ACTION rows close the menu; value rows stay open.
    const button = target.closest('button');
    if (!button || button.disabled) return;
    this.emit('menu-select', { value: button.value, label: button.textContent?.trim() ?? '' });
    this.hide();
  };
}

customElements.define('sherpa-menu', SherpaMenu);
