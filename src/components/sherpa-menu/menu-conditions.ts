/**
 * menu-conditions.ts — the menu's Advanced rows: [And|Or] [condition] [value] [x],
 * each a field's own question, stamped from a prototype. A module of sherpa-menu,
 * not an element. TRAP T-a-filter-menu-has-two-modes · TRAP T-many-conditions-are-one-reading
 *
 * Map:
 * - ConditionsHost — What the rows ask of their menu.
 * - ConditionRows — One menu's condition rows.
 * - .held — Rows set before the menu drew.
 * - .listed — The values its Equals rows list where the menu has no value rows.
 * - .rows — Every condition row, in order.
 * - .add — Stamp one row from the prototype, and fill it.
 * - .drop — A row's own Remove: true when it dropped one.
 * - .opList — The ops this menu offers, from `data-conditions` or the text set.
 * - .get — Every row, as data.
 * - .set — Replace every row from data.
 * - .edit — A row's control changed: what the row remembers follows; true for a row.
 * - .followRowOne — Row one's op, its takes and its text, onto the menu's attributes.
 * - .firstValue — Row one's typed box.
 * - .sync — At least one row, holding what `data-op` and `data-value` say.
 * - .refill — Every row asks again whether it picks or types, and gets the values again.
 * - .sliders — Every range row's slider, from the menu's ends.
 * - .readonly — A read-only row's fields are read-only too.
 */
import {
  DATE_OP_LABELS, DEFAULT_OP, OPS_FOR_TYPE, OP_LABELS, OP_TAKES, type FilterOp,
} from '../../core/data/store.js';
import { rowsTree, type FieldCondition } from '../../core/data/filter-state.js';
import type { SherpaInputText } from '../sherpa-input-text/sherpa-input-text.js';
import type { SherpaSlider } from '../sherpa-slider/sherpa-slider.js';

/** What a date's In the last and In the next count. */
const DATE_UNITS = ['day', 'week', 'month', 'year'] as const;
type DateUnit = (typeof DATE_UNITS)[number];

/** What the rows ask of their menu. */
export interface ConditionsHost {
  /** The menu element: its attributes say the field's kind and ends. */
  readonly el: HTMLElement;
  /** A shadow query. */
  $<T extends Element = HTMLElement>(sel: string): T | null;
  /** Clone a prototype from the menu's template. */
  clone<T extends Element = HTMLElement>(from: string): T | null;
  /** A word from the menu's markup. */
  word(key: string): string;
  /** Write one of the menu's own attributes. */
  set(attr: string, value: string | null): void;
  /** The menu's operator: row one's, or its body's. */
  op(): FilterOp;
  /** Row one's typed text, as the menu holds it. */
  conditionValue(): string;
  /** Write row one's typed text, through the menu. */
  setConditionValue(text: string): void;
  /** Its own value rows, as values. */
  values(): { value: string; label: string }[];
  /** Answered by Advanced conditions alone. */
  advancedOnly(): boolean;
}

/** One menu's condition rows. */
export class ConditionRows {
  /** The menu it is part of. */
  readonly #host: ConditionsHost;
  /** Rows set before the menu drew. */
  held: FieldCondition[] | null = null;
  /** What `listed` was given. */
  #listed: { value: string; label: string }[] = [];

  constructor(host: ConditionsHost) {
    this.#host = host;
  }

  /** A NUMBER menu's rows are TYPED, whatever the op. TRAP T-a-number-has-advanced-rows */
  #numeric(): boolean {
    return this.#host.el.dataset['body'] === 'number';
  }

  /** A DATE menu's rows answer with days, a count, or two ends. TODO 21d */
  #dated(): boolean {
    return this.#host.el.dataset['body'] === 'date';
  }

  /** A menu whose own BODY answers Simple — a number or a date. */
  #typedBody(): boolean {
    return this.#numeric() || this.#dated();
  }

  /** The values its Equals rows list where the menu has no value rows: a
   *  number's, from its field. Will, TODO 668 */
  get listed(): { value: string; label: string }[] {
    return [...this.#listed];
  }
  set listed(values: readonly { value: string; label: string }[]) {
    this.#listed = [...values];
    // Before it draws there are no rows, nor the words they read: each row reads them as it is made.
    if (this.rows().length) this.refill();
  }

  /** Every condition row, in order. */
  rows(): HTMLElement[] {
    return [...(this.#host.$('.condition-rows')?.querySelectorAll<HTMLElement>('.condition-row') ?? [])];
  }

  /** Stamp one row from the prototype, populate its three selects, append it. */
  add(seed?: FieldCondition): HTMLElement | null {
    const region = this.#host.$('.condition-rows');
    const row = this.#host.clone('.condition-row-tpl');
    if (!region || !row) return null;
    region.append(row);
    this.#fill(row, seed);
    this.readonly([row]);
    this.#numberRows();
    return row;
  }

  /** A row's own Remove. The LAST row is never dropped — an empty condition
   *  mode reads as broken, and Clear is the way to mean "no filter". */
  drop(event: Event): boolean {
    const hit = (event.target as HTMLElement | null)?.closest?.('.drop-condition');
    if (!hit || this.rows().length <= 1) return false;
    hit.closest('.condition-row')?.remove();
    this.#numberRows();
    // Row one is ALSO data-op and data-value: a dropped first row, left there,
    // came back at the next sync. TRAP T-row-one-is-data-op
    this.set(this.get());
    return true;
  }

  /** Send the three option sets into one row and set its values. */
  #fill(row: HTMLElement, seed?: FieldCondition): void {
    const join = row.querySelector<SherpaInputText>('.join');
    const cond = row.querySelector<SherpaInputText>('.condition');
    const pick = row.querySelector<SherpaInputText>('.condition-pick');
    const text = row.querySelector<SherpaInputText>('.condition-value');

    /* OR, not AND. Two rows over ONE field are alternatives — `eq Dana` AND
       `eq Ravi` matches nobody, every time, and that is what a second row
       produced. A carried pick joins with `or`; a row the reader adds agrees.
       TRAP T-two-conditions-over-one-field-are-alternatives */
    if (join) join.value = seed?.join ?? 'or';
    // The row REMEMBERS its join, as it does its op and its pick: the select has no options yet.
    row.dataset['join'] = seed?.join ?? 'or';

    const ops = this.opList();
    // A date's ops in a date's words: On, Before, After. TODO 21d
    const dated = this.#dated();
    void cond?.populate?.(ops.map((op) => ({
      value: op, label: (dated ? DATE_OP_LABELS[op] : undefined) ?? OP_LABELS[op],
    })));
    const op = seed?.op && ops.includes(seed.op) ? seed.op : (ops[0] ?? DEFAULT_OP);
    if (cond) cond.value = op;
    /* The row REMEMBERS its op, as it does its pick (`want`): a select with no
       options yet reads '' until it has them. TRAP T-a-row-remembers-what-it-was-given */
    row.dataset['op'] = op;
    row.dataset['takes'] = this.#takes(op);

    /* `Equals` answers with a LIST of the field's own values, never a text box.
       The values are the menu's own rows, so there is one vocabulary.
       TRAP T-equals-answers-with-the-fields-own-values */
    const options = this.#valueOptions();
    const want = seed?.picked?.length ? String(seed.picked[0]) : '';
    /* The row REMEMBERS what it wants. `populate()` settles later and
       `refill` runs on every slotchange, so the live `.value` is not a
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
    /* A NUMBER's `=` is typed too, and kept as its one pick — and so is one with no list.
       Written whether or not a list is here NOW: a list that goes later reads the box. */
    const ends = !dated && (OP_TAKES[op] ?? 'list') === 'range' ? (seed?.picked ?? []).map(String) : null;
    if (text) {
      text.value = ends ? ends[0] ?? ''
        : seed?.text ?? (seed?.picked?.length && (OP_TAKES[seed.op] ?? 'list') === 'list' ? String(seed.picked[0]) : '');
    }
    // A number's Between: its To end, and the slider under the row. Will, TODO 375
    const to = row.querySelector<SherpaInputText>('.condition-value-to');
    if (to) to.value = ends?.[1] ?? '';
    this.#rangeSlider(row);
    if (dated) this.#fillDateRow(row, seed);
  }

  /** A range row's slider: the menu's bounds, and the two ends typed, or the
   *  whole span while they are not. Will, TODO 375 */
  #rangeSlider(row: HTMLElement, from: 'boxes' | 'slider' = 'boxes'): void {
    const slider = row.querySelector<SherpaSlider>('.condition-slider');
    const boxes = [...row.querySelectorAll<SherpaInputText>('.condition-value, .condition-value-to')];
    if (!slider || boxes.length < 2) return;
    const el = this.#host.el;
    const min = el.dataset['min'] ?? '0';
    const max = el.dataset['max'] ?? '100';
    slider.setAttribute('min', min);
    slider.setAttribute('max', max);
    if (el.dataset['step']) slider.setAttribute('step', el.dataset['step']);
    if (from === 'slider') {
      const [lo, hi] = slider.range;
      boxes[0]!.value = String(lo);
      boxes[1]!.value = String(hi);
      return;
    }
    const ends = boxes.map((box) => Number((box.value ?? '').trim() || NaN));
    slider.range = ends.every(Number.isFinite) ? [ends[0]!, ends[1]!] : [Number(min), Number(max)];
  }

  /** A date row's own boxes: a day (and a time), two for Between, a count and a unit. TODO 21d */
  #fillDateRow(row: HTMLElement, seed?: FieldCondition): void {
    const box = (name: string): SherpaInputText | null => row.querySelector<SherpaInputText>(`.condition-${name}`);
    const set = (name: string, value: string): void => { const el = box(name); if (el) el.value = value; };
    const unit = box('unit');
    // The row REMEMBERS its unit, as its op: the select has no options yet. TODO 464
    row.dataset['unit'] = seed?.unit ?? 'day';
    // Its value written AFTER its options exist. TRAP T-custom-element-upgrade
    void Promise.resolve(unit?.populate?.(DATE_UNITS.map((u) => ({ value: u, label: `${u}s` }))))
      .then(() => { if (unit) unit.value = seed?.unit ?? 'day'; });
    if (seed?.op === 'last' || seed?.op === 'next') return set('count', seed.text ?? '');
    const ends = seed?.op === 'eq' || seed?.op === 'between' ? [...(seed.picked ?? [])] : [seed?.text ?? ''];
    ends.slice(0, 2).forEach((value, i) => {
      const [day, time] = String(value ?? '').split('T');
      set(i ? 'date-to' : 'date', day ?? '');
      set(i ? 'time-to' : 'time', (time ?? '').slice(0, 5));
    });
  }

  /** A DATE row's answer, as the row's own op needs it. */
  #dateRowAnswer(row: HTMLElement, op: FilterOp): Omit<FieldCondition, 'op' | 'join'> {
    const value = (name: string): string => (row.querySelector<SherpaInputText>(`.condition-${name}`)?.value ?? '').trim();
    const at = (day: string, time: string): string => (value(day) && value(time) && this.#host.el.hasAttribute('data-time')
      ? `${value(day)}T${value(time)}` : value(day));
    if (op === 'last' || op === 'next') return { text: value('count'), unit: (row.dataset['unit'] || value('unit') || 'day') as DateUnit };
    if (op === 'between') {
      const ends = [at('date', 'time'), at('date-to', 'time-to')];
      return ends.every(Boolean) ? { picked: ends } : {};
    }
    const day = at('date', 'time');
    if (op === 'eq') return day ? { picked: [day] } : {};
    return { text: day };
  }

  /** What a row answers with: a pick, typing — or, on a date, a day, two, or a count. */
  #takes(op: FilterOp): 'list' | 'text' | 'range' | 'date' | 'dates' | 'duration' {
    if (this.#dated()) return op === 'last' || op === 'next' ? 'duration' : op === 'between' ? 'dates' : 'date';
    const takes = OP_TAKES[op] ?? 'list';
    // A number's Between and Not between: two typed ends. Will, TODO 375
    if (takes === 'range') return 'range';
    return this.#typesItsPicks() ? 'text' : takes;
  }

  /** A row with NO list to pick from types its Equals — a field whose values
   *  are not listed (Advanced only), or a number not yet given its own. It answers
   *  as the one value it picks. Will, TODOs 112, 668. TRAP T-one-number-is-a-pick-under-equals */
  #typesItsPicks(): boolean {
    return !this.#fieldValues().length;
  }

  /** The ops this menu offers, from `data-conditions` or the text set. */
  opList(): FilterOp[] {
    const declared = this.#host.el.dataset['conditions'] ?? '';
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
    return values.length ? [{ value: '', label: this.#host.word('select') }, ...values] : [];
  }

  /** The field's own values: its value rows, else — a number — its field's own. TODO 668 */
  #fieldValues(): { value: string; label: string }[] {
    const own = this.#host.values();
    return own.length ? own : [...this.#listed];
  }

  /** Row ONE has no join. A flag, so CSS hides it and nothing is removed —
   *  a row moved to the front gets its select back. */
  #numberRows(): void {
    const rows = this.rows();
    rows.forEach((row, i) => {
      row.toggleAttribute('data-first', i === 0);
      row.toggleAttribute('data-only', rows.length === 1);
    });
  }

  /** A row's op: what it remembers, else what its control shows. */
  #opOf(row: HTMLElement): FilterOp {
    return (row.dataset['op'] || row.querySelector<SherpaInputText>('.condition')?.value || DEFAULT_OP) as FilterOp;
  }

  /** Every row, as data. TRAP T-many-conditions-are-one-reading */
  get(): FieldCondition[] {
    if (this.held) return this.held.map((row) => ({ ...row }));
    const rows = this.rows();
    const el = this.#host.el;
    /* No row yet: row ONE is `data-op` and `data-value` until it is drawn, so
       a host that set them is answered at once. TRAP T-row-one-is-data-op */
    const op = el.dataset['op'] as FilterOp | undefined;
    if (!rows.length && el.dataset['mode'] === 'advanced' && op && !this.#typedBody()) {
      const text = el.dataset['value'] ?? '';
      return [(OP_TAKES[op] ?? 'list') === 'text' ? { op, text } : { op }];
    }
    return rows.map((row, i) => {
      const op = this.#opOf(row);
      const takes = OP_TAKES[op] ?? 'list';
      const out: FieldCondition = { op };
      if (i > 0) out.join = (row.dataset['join'] ?? 'or') as 'and' | 'or';
      if (this.#dated()) return { ...out, ...this.#dateRowAnswer(row, op) };
      // A range is BOTH ends typed. Will, TODO 375
      if (takes === 'range') {
        const ends = [...row.querySelectorAll<SherpaInputText>('.condition-value, .condition-value-to')]
          .map((box) => (box.value ?? '').trim());
        if (ends.length === 2 && ends.every(Boolean)) out.picked = ends;
        return out;
      }
      /* A NUMBER's `=` is typed, and answers as the one number it picks —
         as the body's one value does. TRAP T-one-number-is-a-pick-under-equals */
      if (this.#typesItsPicks() && takes === 'list') {
        // The box, else what the row was given: a box not drawn yet reads ''. TRAP T-a-rebuilt-row-reads-empty-for-a-tick
        const typed = (row.querySelector<SherpaInputText>('.condition-value')?.value ?? '').trim() || row.dataset['want'];
        if (typed) out.picked = [typed];
      } else if (takes === 'list') {
        /* `row.dataset.want` is what the READER chose. A `<select>` shows its
           first option whether or not anyone touched it, so reading `.value`
           made every untouched row report a pick — and a mode switch then
           believed the rows were already answered.
           TRAP T-an-untouched-select-is-not-an-answer */
        const picked = row.dataset['want'] ?? '';
        if (picked) out.picked = [picked];
      } else {
        out.text = row.querySelector<SherpaInputText>('.condition-value')?.value ?? '';
      }
      return out;
    });
  }

  /** Replace the rows. */
  set(rows: readonly FieldCondition[]): void {
    const region = this.#host.$('.condition-rows');
    if (!region) return;
    /* NOTHING NEW is not a rebuild. Between `replaceChildren()` and the async
       fill of each new row's value select, this menu reports NO conditions.
       TRAP T-a-rebuilt-row-reads-empty-for-a-tick
       And a row the reader has not answered yet is their WORK IN PROGRESS: an
       answer drawn back that says the tree the rows they HAVE answered say keeps
       every row, blank ones too. TRAP T-an-unanswered-row-survives-a-redraw */
    const answered = (list: readonly FieldCondition[]): string => JSON.stringify(rowsTree(list, this.#numeric() ? 'number' : undefined) ?? null);
    const keep = answered(this.get()) === answered(rows);
    if (!keep) {
      region.replaceChildren();
      for (const row of rows.length ? rows : [{ op: DEFAULT_OP } as FieldCondition]) this.add(row);
    }
    // A NUMBER's `data-op` is its BODY's, and a date's. TRAP T-a-number-has-advanced-rows
    if (this.#typedBody()) return;
    // Every sync rebuilds row one from these two — from the row SHOWN, when the
    // rows were kept. TRAP T-row-one-is-data-op
    const first = keep ? this.get()[0] : rows[0];
    const el = this.#host.el;
    if (!first) {
      // No rows, so nothing typed — or a re-stamp puts the old text back.
      if (!keep && el.dataset['value']) this.#host.setConditionValue('');
      return;
    }
    if (el.dataset['op'] !== first.op) this.#host.set('data-op', first.op);
    /* …and a pick that is TYPED, where no list shows it (Advanced only): the box
       holds it, so a later sync must not put back an empty one. TODO 373 */
    const typesIt = this.#typesItsPicks() || this.#host.advancedOnly();
    const text = (OP_TAKES[first.op] ?? 'list') === 'text' ? (first.text ?? '')
      : typesIt ? String(first.picked?.[0] ?? '') : '';
    /* `data-value` TOO. A rebuilt row already holds the text, so comparing the
       box alone skipped the write — and the next re-sync put back the empty
       attribute over what a host had set. TRAP T-row-one-is-data-op */
    if (this.#host.conditionValue() !== text || (el.dataset['value'] ?? '') !== text) {
      this.#host.setConditionValue(text);
    }
  }

  /**
   * A row's control changed: what the row remembers follows it. Nothing is
   * rebuilt — `data-takes` is what CSS reads, so the ticked rows and the typed
   * box both survive a flip. True when the change came from a row.
   * TRAP T-an-operator-decides-pick-or-type
   */
  edit(event?: Event): boolean {
    /* The row the change came from — its OWN op decides its OWN body, so two
       rows can ask different questions at once. */
    const target = event?.target as HTMLElement | null;
    const row = target?.closest?.('.condition-row');
    if (!(row instanceof HTMLElement)) return false;
    // A range's slider moves its two boxes, and its boxes move the slider. TODO 375
    if (row.dataset['takes'] === 'range') {
      this.#rangeSlider(row, target?.closest?.('.condition-slider') ? 'slider' : 'boxes');
    }
    // The reader just answered, so THAT is what the row remembers now.
    const live = row.querySelector<SherpaInputText>('.condition')?.value;
    if (live) row.dataset['op'] = live;
    const joined = row.querySelector<SherpaInputText>('.join')?.value;
    if (joined) row.dataset['join'] = joined;
    // …and its unit, from the unit's own select only.
    const unit = target?.closest?.<SherpaInputText>('.condition-unit')?.value;
    if (unit) row.dataset['unit'] = unit;
    const op = this.#opOf(row);
    row.dataset['takes'] = this.#takes(op);
    const picked = row.querySelector<SherpaInputText>('.condition-pick')?.value ?? '';
    if (picked) row.dataset['want'] = picked;
    // A TYPED pick is what the row wants now, emptied too — from the box itself only.
    const fromBox = !!target?.closest?.('.condition-value');
    if (fromBox && this.#typesItsPicks() && (OP_TAKES[op] ?? 'list') === 'list') {
      const typed = (row.querySelector<SherpaInputText>('.condition-value')?.value ?? '').trim();
      if (typed) row.dataset['want'] = typed;
      else delete row.dataset['want'];
    }
    return true;
  }

  /** Row one still mirrors to the host attributes: the one-row view. */
  followRowOne(): void {
    const first = this.rows()[0];
    const op = first ? this.#opOf(first) : DEFAULT_OP;
    const el = this.#host.el;
    if (el.dataset['op'] !== op) this.#host.set('data-op', op);
    this.#host.set('data-takes', this.#takes(op));
    this.#host.set('data-value', this.firstValue()?.value ?? '');
  }

  /** ROW ONE's typed box. */
  firstValue(): SherpaInputText | null {
    return this.rows()[0]?.querySelector<SherpaInputText>('.condition-value') ?? null;
  }

  /**
   * Make sure the region has at least ONE row, and that row holds what the host
   * asked for through `data-op` / `data-value`. A re-stamp replaces the whole
   * shadow tree, so the rows are rebuilt from the attributes rather than
   * remembered. TRAP T-restamp-does-not-abort
   */
  sync(): void {
    if (!this.#host.$('.condition-rows')) return;
    if (!this.rows().length) this.add();
    // A NUMBER's `data-op` is its body's, not row one's, and a date's. TRAP T-a-number-has-advanced-rows
    if (this.#typedBody()) return this.#numberRows();

    const el = this.#host.el;
    const ops = this.opList();
    const current = this.#host.op();
    const op = ops.includes(current) ? current : (ops[0] ?? DEFAULT_OP);
    const select = this.rows()[0]?.querySelector<SherpaInputText>('.condition') ?? null;
    if (select && select.value !== op) select.value = op;
    const first = this.rows()[0];
    if (first) first.dataset['op'] = op;
    if (el.dataset['op'] !== op) this.#host.set('data-op', op);
    this.#host.set('data-takes', this.#takes(op));
    this.rows()[0]?.setAttribute('data-takes', this.#takes(op));

    // Put back what was typed — a re-stamp blanked the box, not the state.
    const box = this.firstValue();
    const held = el.dataset['value'] ?? '';
    if (box && box.value !== held) box.value = held;
    this.#numberRows();
  }

  /** Values came or went: each row asks again whether it picks or types, and
   *  each row's value select gets them again, keeping its own pick. */
  refill(): void {
    // …and so does the host's mirror of row one, where its body is not a number's or a date's.
    for (const row of this.rows()) {
      row.dataset['takes'] = this.#takes(this.#opOf(row));
    }
    if (!this.#typedBody() && this.#host.el.hasAttribute('data-takes')) this.#host.set('data-takes', this.#takes(this.#host.op()));
    const options = this.#valueOptions();
    if (!options.length) return;
    // Every value, in every row: an Advanced row rules out none. Will, TODO 469.
    // TRAP T-an-advanced-row-rules-out-nothing
    for (const row of this.rows()) {
      const pick = row.querySelector<SherpaInputText>('.condition-pick');
      if (!pick) continue;
      // What the row WANTS beats what the select happens to show.
      const held = row.dataset['want'] || pick.value;
      void Promise.resolve(pick.populate?.(options)).then(() => {
        if (held && options.some((o) => o.value === held)) pick.value = held;
      });
    }
  }

  /** Every range row's slider, from the menu's ends. TODO 375 */
  sliders(): void {
    for (const row of this.rows()) if (row.dataset['takes'] === 'range') this.#rangeSlider(row);
  }

  /** A read-only row's fields are `readonly` too, so a value offers no clear button. */
  readonly(rows: readonly HTMLElement[] = this.rows()): void {
    const readonly = this.#host.el.hasAttribute('data-readonly');
    for (const row of rows) {
      for (const field of row.querySelectorAll('sherpa-input-text')) field.toggleAttribute('readonly', readonly);
    }
  }
}
