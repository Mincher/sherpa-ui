/**
 * menu-conditions.ts — the menu's Advanced answer: ONE condition tree, drawn as
 * rows — [And|Or] [condition] [value] [x] — and GROUPS of rows, each the same
 * rows indented one step with its own And or Or, applied only inside its parent.
 * It reads and writes `Condition` itself: no flat rows between. Will, TODO 692.
 * A module of sherpa-menu, not an element.
 * TRAP T-a-filter-menu-has-two-modes · TRAP T-many-conditions-are-one-reading
 *
 * Map:
 * - spread — A leaf of several picks as rows a select can say: one value each.
 * - ConditionsHost — What the editor asks of its menu.
 * - ConditionEditor — One menu's condition rows and groups.
 * - .held — A tree set before the menu drew.
 * - .listed — The values its Equals rows list where the menu has no value rows.
 * - .rows — Every condition row, in order, at any depth.
 * - .addRow — Stamp one row at the end of a group, and fill it.
 * - .addGroup — Stamp one group at the end of a group: its parts, or one blank row.
 * - .drop — A row's or a group's own Remove: the part that takes its place, or null.
 * - .opList — The ops this menu offers.
 * - .read — The rows as ONE tree, whole: a row not answered yet as a leaf with no value.
 * - .get — The rows' answer: the tree of their answered parts.
 * - .draw — Draw a tree as rows and groups, unless the rows say it already.
 * - .edit — A row's control changed: what the row or its group remembers follows; true for one.
 * - .followRowOne — Row one's op, its takes and its text, onto the menu's attributes.
 * - .firstValue — Row one's typed box.
 * - .sync — At least one row, holding what `data-op` and `data-value` say.
 * - .refill — Every row asks again whether it picks or types, and gets the values again.
 * - .sliders — Every range row's slider, from the menu's ends.
 * - .readonly — A read-only editor's fields are read-only too.
 */
import {
  DATE_OP_LABELS, DEFAULT_OP, OPS_FOR_TYPE, OP_LABELS, OP_TAKES, groupOf,
  type Condition, type ConditionLeaf, type Duration, type FilterOp,
} from '../../core/data/store.js';
import { answeredCondition, typedValue } from '../../core/data/filter-state.js';
import type { SherpaInputText } from '../sherpa-input-text/sherpa-input-text.js';
import type { SherpaSlider } from '../sherpa-slider/sherpa-slider.js';

/** What a date's In the last and In the next count. */
const DATE_UNITS = ['day', 'week', 'month', 'year'] as const;
type DateUnit = (typeof DATE_UNITS)[number];

/** A row or a group: one part of a group. */
const PART = '.condition-row, .condition-group';

/** A part's own: kept off, and the name an editor knows it by. */
function own(tree: Condition): { off?: true; id?: string } {
  return { ...(tree.off ? { off: true } : {}), ...(tree.id !== undefined ? { id: tree.id } : {}) };
}

/** A leaf of several picks — `in`, `notin`, or a list under `eq` — as rows a
 *  select can say: one value each, ORed (or, not, ANDed); a group of the same
 *  join flattens into its parent. TRAP T-a-condition-tree-draws-whole
 *  TRAP T-a-held-clause-op-is-not-a-reading-op */
export function spread(tree: Condition): Condition {
  const parts = groupOf(tree);
  if (parts) {
    const [join, each] = parts;
    const kids = each.flatMap((part) => {
      const out = spread(part);
      const flat = !groupOf(part) && groupOf(out)?.[0] === join && !part.off && part.id === undefined;
      return flat ? groupOf(out)![1] : [out];
    });
    return { ...own(tree), [join]: kids } as Condition;
  }
  const leaf = tree as ConditionLeaf;
  if ((OP_TAKES[leaf.op] ?? 'list') !== 'list' || !Array.isArray(leaf.value)) return tree;
  const not = leaf.op === 'ne' || leaf.op === 'notin';
  const op: FilterOp = not ? 'ne' : 'eq';
  const values = leaf.value as unknown[];
  if (values.length < 2) {
    const { value: _list, ...rest } = leaf;
    return { ...rest, op, ...(values.length ? { value: values[0] } : {}) };
  }
  return { ...own(leaf), [not ? 'and' : 'or']: values.map((value) => ({ op, value })) } as Condition;
}

/** What the editor asks of its menu. */
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

/** One menu's condition rows and groups. */
export class ConditionEditor {
  /** The menu it is part of. */
  readonly #host: ConditionsHost;
  /** A tree set before the menu drew. */
  held: { tree: Condition | undefined } | null = null;
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

  /** Its field's kind, for `typedValue`: a number's `70` comes in as 70. TRAP T-a-value-is-typed-once */
  #type(): 'number' | undefined {
    return this.#numeric() ? 'number' : undefined;
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

  /** The root group: the region itself. */
  #root(): HTMLElement | null {
    return this.#host.$('.condition-rows');
  }

  /** Every condition row, in order, at any depth. */
  rows(): HTMLElement[] {
    return [...(this.#root()?.querySelectorAll<HTMLElement>('.condition-row') ?? [])];
  }

  /** Where a group's parts are: the region for the root, else its own box. */
  #box(group: HTMLElement): HTMLElement | null {
    return group.matches('.condition-rows') ? group : group.querySelector<HTMLElement>(':scope > .condition-parts');
  }

  /** A group's own parts, in order. */
  #parts(group: HTMLElement): HTMLElement[] {
    return [...(this.#box(group)?.children ?? [])].filter((n): n is HTMLElement => n instanceof HTMLElement && n.matches(PART));
  }

  /** The group a part sits in. */
  #groupOf(part: HTMLElement): HTMLElement | null {
    const box = part.parentElement;
    if (!box) return null;
    return box.matches('.condition-rows') ? box : box.closest<HTMLElement>('.condition-group');
  }

  /** Every group, the root first. */
  #groups(): HTMLElement[] {
    const root = this.#root();
    return root ? [root, ...root.querySelectorAll<HTMLElement>('.condition-group')] : [];
  }

  /** A group's join: And or Or. */
  #join(group: HTMLElement): 'and' | 'or' {
    return group.dataset['join'] === 'and' ? 'and' : 'or';
  }

  /** The join select a part shows its group's join in. */
  #joinOf(part: HTMLElement): SherpaInputText | null {
    return part.querySelector<SherpaInputText>(':scope > .join');
  }

  /** Every part of a group shows the group's join: change one, and they all say it. */
  #showJoin(group: HTMLElement): void {
    const join = this.#join(group);
    for (const part of this.#parts(group)) {
      const select = this.#joinOf(part);
      if (select && select.value !== join) select.value = join;
    }
  }

  /** A part's own `off` and `id`, from what it was given. */
  #keep(part: HTMLElement, given?: Condition): void {
    part.toggleAttribute('data-off', !!given?.off);
    if (given?.id !== undefined) part.dataset['id'] = given.id;
    else delete part.dataset['id'];
  }

  /** What a part was given of its own. */
  #ownOf(part: HTMLElement): { off?: true; id?: string } {
    const id = part.dataset['id'];
    return { ...(part.hasAttribute('data-off') ? { off: true } : {}), ...(id !== undefined ? { id } : {}) };
  }

  /** Stamp one row at the end of a group — the root by default — and fill it. */
  addRow(group: HTMLElement | null = this.#root(), leaf?: ConditionLeaf): HTMLElement | null {
    const box = group && this.#box(group);
    const row = this.#host.clone('.condition-row-tpl');
    if (!group || !box || !row) return null;
    box.append(row);
    this.#fill(row, leaf);
    const join = this.#joinOf(row);
    if (join) join.value = this.#join(group);
    this.#mark();
    this.readonly();
    return row;
  }

  /**
   * Stamp one group at the end of a group: the parts of `tree`, or one blank row.
   * A NEW group joins the other way from its parent — `A or (B and C)` — for a
   * group that says its parent's join says nothing more.
   */
  addGroup(group: HTMLElement | null = this.#root(), tree?: Condition): HTMLElement | null {
    const box = group && this.#box(group);
    const sub = this.#host.clone('.condition-group-tpl');
    if (!group || !box || !sub) return null;
    box.append(sub);
    const parts = tree && groupOf(tree);
    sub.dataset['join'] = parts ? parts[0] : this.#join(group) === 'or' ? 'and' : 'or';
    this.#keep(sub, tree);
    const join = this.#joinOf(sub);
    if (join) join.value = this.#join(group);
    if (parts?.[1].length) for (const part of parts[1]) this.#drawPart(sub, part);
    else this.addRow(sub);
    this.#mark();
    return sub;
  }

  /** Draw one part of a tree into a group: a leaf as a row, a group as a group. */
  #drawPart(group: HTMLElement, part: Condition): void {
    if (groupOf(part)) this.addGroup(group, part);
    else this.addRow(group, part as ConditionLeaf);
  }

  /**
   * A row's or a group's own Remove: the part that takes its place, or null. A
   * group's LAST part is never dropped — an empty group, or an empty Advanced
   * mode, reads as broken; Clear is the way to mean "no filter", and a group's
   * own Remove the way to drop it.
   */
  drop(event: Event): HTMLElement | null {
    const target = event.target as HTMLElement | null;
    const hit = target?.closest?.('.drop-condition, .drop-group');
    const part = hit?.closest<HTMLElement>(hit.matches('.drop-group') ? '.condition-group' : '.condition-row');
    const group = part && this.#groupOf(part);
    if (!part || !group || this.#parts(group).length <= 1) return null;
    const parts = this.#parts(group);
    const next = parts[parts.indexOf(part) + 1] ?? parts[parts.indexOf(part) - 1] ?? null;
    part.remove();
    this.#mark();
    // Row one is ALSO data-op and data-value: a dropped first row, left there,
    // came back at the next sync. TRAP T-row-one-is-data-op
    this.#rowOne(this.read(), false);
    return next;
  }

  /** Send the option sets into one row and set its values from a leaf. */
  #fill(row: HTMLElement, leaf?: ConditionLeaf): void {
    const cond = row.querySelector<SherpaInputText>('.condition');
    const pick = row.querySelector<SherpaInputText>('.condition-pick');
    const text = row.querySelector<SherpaInputText>('.condition-value');
    this.#keep(row, leaf);

    /* WHOLE: an op the menu does not offer is still the row's, offered on its row.
       A tree from a page definition draws as it was said. TRAP T-a-condition-tree-draws-whole */
    const offered = this.opList();
    const ops = leaf?.op && leaf.op in OP_LABELS && !offered.includes(leaf.op) ? [...offered, leaf.op] : offered;
    // A date's ops in a date's words: On, Before, After. TODO 21d
    const dated = this.#dated();
    void cond?.populate?.(ops.map((op) => ({
      value: op, label: (dated ? DATE_OP_LABELS[op] : undefined) ?? OP_LABELS[op],
    })));
    const op = leaf?.op && ops.includes(leaf.op) ? leaf.op : (ops[0] ?? DEFAULT_OP);
    if (cond) cond.value = op;
    /* The row REMEMBERS its op, as it does its pick (`want`): a select with no
       options yet reads '' until it has them. TRAP T-a-row-remembers-what-it-was-given */
    row.dataset['op'] = op;
    row.dataset['takes'] = this.#takes(op);

    const value = leaf?.value;
    const takes = OP_TAKES[op] ?? 'list';
    /* `Equals` answers with a LIST of the field's own values, never a text box.
       The values are the menu's own rows, so there is one vocabulary.
       TRAP T-equals-answers-with-the-fields-own-values */
    const options = this.#valueOptions();
    const want = !dated && takes === 'list' && value != null && value !== '' ? String(value) : '';
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
    const ends = !dated && takes === 'range' && Array.isArray(value) ? value.map(String) : null;
    if (text) text.value = ends ? ends[0] ?? '' : !dated && (takes === 'text' || takes === 'list') ? String(value ?? '') : '';
    // A number's Between: its To end, and the slider under the row. Will, TODO 375
    const to = row.querySelector<SherpaInputText>('.condition-value-to');
    if (to) to.value = ends?.[1] ?? '';
    this.#rangeSlider(row);
    if (dated) this.#fillDateRow(row, op, value);
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
  #fillDateRow(row: HTMLElement, op: FilterOp, value: unknown): void {
    const box = (name: string): SherpaInputText | null => row.querySelector<SherpaInputText>(`.condition-${name}`);
    const set = (name: string, text: string): void => { const el = box(name); if (el) el.value = text; };
    const span = op === 'last' || op === 'next' ? value as Partial<Duration> | undefined : undefined;
    const unit = box('unit');
    // The row REMEMBERS its unit, as its op: the select has no options yet. TODO 464
    row.dataset['unit'] = span?.unit ?? 'day';
    // Its value written AFTER its options exist. TRAP T-custom-element-upgrade
    void Promise.resolve(unit?.populate?.(DATE_UNITS.map((u) => ({ value: u, label: `${u}s` }))))
      .then(() => { if (unit) unit.value = span?.unit ?? 'day'; });
    if (op === 'last' || op === 'next') return set('count', span?.n != null ? String(span.n) : '');
    const ends = Array.isArray(value) ? value : [value ?? ''];
    ends.slice(0, 2).forEach((end, i) => {
      const [day, time] = String(end ?? '').split('T');
      set(i ? 'date-to' : 'date', day ?? '');
      set(i ? 'time-to' : 'time', (time ?? '').slice(0, 5));
    });
  }

  /** A DATE row's value, as its own op needs it; undefined while it has none. */
  #dateValue(row: HTMLElement, op: FilterOp): unknown {
    const value = (name: string): string => (row.querySelector<SherpaInputText>(`.condition-${name}`)?.value ?? '').trim();
    const at = (day: string, time: string): string => (value(day) && value(time) && this.#host.el.hasAttribute('data-time')
      ? `${value(day)}T${value(time)}` : value(day));
    if (op === 'last' || op === 'next') {
      const count = value('count');
      return count ? { n: Number(count), unit: (row.dataset['unit'] || value('unit') || 'day') as DateUnit } : undefined;
    }
    if (op === 'between') {
      const ends = [at('date', 'time'), at('date-to', 'time-to')];
      return ends.every(Boolean) ? ends : undefined;
    }
    return at('date', 'time') || undefined;
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

  /** Each group's FIRST part has no join, and a LONE part has nothing to drop.
   *  Flags, so CSS hides them and nothing is removed — a part moved to the front
   *  gets its select back. */
  #mark(): void {
    for (const group of this.#groups()) {
      const parts = this.#parts(group);
      parts.forEach((part, i) => {
        part.toggleAttribute('data-first', i === 0);
        part.toggleAttribute('data-only', parts.length === 1);
      });
    }
  }

  /** A row's op: what it remembers, else what its control shows. */
  #opOf(row: HTMLElement): FilterOp {
    return (row.dataset['op'] || row.querySelector<SherpaInputText>('.condition')?.value || DEFAULT_OP) as FilterOp;
  }

  /** One row as its leaf: its value typed by the field, none while it has none. */
  #leaf(row: HTMLElement): ConditionLeaf {
    const op = this.#opOf(row);
    const takes = OP_TAKES[op] ?? 'list';
    const of = (value: unknown, typed = true): ConditionLeaf => (value === undefined || value === ''
      ? { op, ...this.#ownOf(row) }
      : { op, value: typed ? typedValue(this.#type(), value) : value, ...this.#ownOf(row) });
    if (this.#dated()) return of(this.#dateValue(row, op), false);
    // A range is BOTH ends typed. Will, TODO 375
    if (takes === 'range') {
      const ends = [...row.querySelectorAll<SherpaInputText>('.condition-value, .condition-value-to')]
        .map((box) => (box.value ?? '').trim());
      return of(ends.length === 2 && ends.every(Boolean) ? ends : undefined);
    }
    /* A NUMBER's `=` is typed, and answers as the one number it picks —
       as the body's one value does. TRAP T-one-number-is-a-pick-under-equals */
    if (this.#typesItsPicks() && takes === 'list') {
      // The box, else what the row was given: a box not drawn yet reads ''. TRAP T-a-rebuilt-row-reads-empty-for-a-tick
      return of((row.querySelector<SherpaInputText>('.condition-value')?.value ?? '').trim() || row.dataset['want']);
    }
    /* `row.dataset.want` is what the READER chose. A `<select>` shows its
       first option whether or not anyone touched it, so reading `.value`
       made every untouched row report a pick. TRAP T-an-untouched-select-is-not-an-answer */
    if (takes === 'list') return of(row.dataset['want']);
    // Typed text is kept as typed, so a menu reads it back.
    return of(row.querySelector<SherpaInputText>('.condition-value')?.value ?? '');
  }

  /** One group as its tree, whole. */
  #readGroup(group: HTMLElement): Condition {
    const parts = this.#parts(group).map((part) => (part.matches('.condition-group') ? this.#readGroup(part) : this.#leaf(part)));
    return { ...this.#ownOf(group), [this.#join(group)]: parts } as Condition;
  }

  /** The rows as ONE tree, WHOLE — a row not answered yet is a leaf with no value
   *  — what Discard restores and what tells the footer the draft moved.
   *  Undefined where there are no rows to read. */
  read(): Condition | undefined {
    if (this.held) return this.held.tree;
    const root = this.#root();
    if (!root || !this.rows().length) return this.#rowOneTree();
    return this.#readGroup(root);
  }

  /** No row yet: row ONE is `data-op` and `data-value` until it is drawn, so
   *  a host that set them is answered at once. TRAP T-row-one-is-data-op */
  #rowOneTree(): Condition | undefined {
    const el = this.#host.el;
    const op = el.dataset['op'] as FilterOp | undefined;
    if (el.dataset['mode'] !== 'advanced' || !op || this.#typedBody()) return undefined;
    const text = el.dataset['value'] ?? '';
    return (OP_TAKES[op] ?? 'list') === 'text' && text ? { op, value: typedValue(this.#type(), text) } : { op };
  }

  /** The rows' answer: the tree of their answered parts — a half-built row says
   *  nothing. TRAP T-many-conditions-are-one-reading */
  get(): Condition | undefined {
    return answeredCondition(this.read());
  }

  /**
   * Draw a tree as rows and groups — nested as deep as it was said — unless the
   * rows say it already: NOTHING NEW is not a rebuild. Between `replaceChildren()`
   * and the async fill of each new row's value select, this menu reports NO
   * condition. TRAP T-a-rebuilt-row-reads-empty-for-a-tick
   * And a row the reader has not answered yet is their WORK IN PROGRESS: a tree
   * drawn back that says what the rows they HAVE answered say keeps every row,
   * blank ones too. TRAP T-an-unanswered-row-survives-a-redraw
   */
  draw(tree: Condition | undefined): void {
    const root = this.#root();
    if (!root) return;
    const said = (t: Condition | undefined): string => JSON.stringify((t && answeredCondition(spread(t))) ?? null);
    const keep = this.rows().length > 0 && said(this.read()) === said(tree);
    if (!keep) {
      const whole = tree && spread(tree);
      const parts = whole && groupOf(whole);
      root.replaceChildren();
      // OR: two rows over one field are alternatives. TRAP T-two-conditions-over-one-field-are-alternatives
      root.dataset['join'] = parts ? parts[0] : 'or';
      this.#keep(root, parts ? whole : undefined);
      if (parts?.[1].length) for (const part of parts[1]) this.#drawPart(root, part);
      else this.addRow(root, whole && !parts ? whole as ConditionLeaf : undefined);
    }
    this.#rowOne(keep ? this.read() : tree && spread(tree), !keep);
  }

  /** Row one is ALSO `data-op` and `data-value`: every sync rebuilds it from
   *  these two, from the row SHOWN. TRAP T-row-one-is-data-op */
  #rowOne(tree: Condition | undefined, rebuilt: boolean): void {
    // A NUMBER's `data-op` is its BODY's, and a date's. TRAP T-a-number-has-advanced-rows
    if (this.#typedBody()) return;
    let first = tree;
    for (let parts = first && groupOf(first); parts; parts = first && groupOf(first)) first = parts[1][0];
    const el = this.#host.el;
    const leaf = first as ConditionLeaf | undefined;
    if (!leaf) {
      // No rows, so nothing typed — or a re-stamp puts the old text back.
      if (rebuilt && el.dataset['value']) this.#host.setConditionValue('');
      return;
    }
    if (el.dataset['op'] !== leaf.op) this.#host.set('data-op', leaf.op);
    /* …and a pick that is TYPED, where no list shows it (Advanced only): the box
       holds it, so a later sync must not put back an empty one. TODO 373 */
    const typesIt = this.#typesItsPicks() || this.#host.advancedOnly();
    const takes = OP_TAKES[leaf.op] ?? 'list';
    const text = takes === 'text' || (typesIt && takes === 'list') ? String(leaf.value ?? '') : '';
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
   * box both survive a flip. A JOIN is its group's: every part of the group
   * says it. True when the change came from a row or a join.
   * TRAP T-an-operator-decides-pick-or-type
   */
  edit(event?: Event): boolean {
    const target = event?.target as HTMLElement | null;
    const joined = target?.closest?.<SherpaInputText>('.join');
    const part = joined?.parentElement?.closest<HTMLElement>(PART);
    const group = part && this.#groupOf(part);
    if (joined && group) {
      if (joined.value === 'and' || joined.value === 'or') group.dataset['join'] = joined.value;
      this.#showJoin(group);
      return true;
    }
    /* The row the change came from — its OWN op decides its OWN body, so two
       rows can ask different questions at once. */
    const row = target?.closest?.('.condition-row');
    if (!(row instanceof HTMLElement)) return false;
    // A range's slider moves its two boxes, and its boxes move the slider. TODO 375
    if (row.dataset['takes'] === 'range') {
      this.#rangeSlider(row, target?.closest?.('.condition-slider') ? 'slider' : 'boxes');
    }
    // The reader just answered, so THAT is what the row remembers now.
    const live = row.querySelector<SherpaInputText>('.condition')?.value;
    if (live) row.dataset['op'] = live;
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
    if (!this.#root()) return;
    if (!this.rows().length) this.addRow();
    // A NUMBER's `data-op` is its body's, not row one's, and a date's. TRAP T-a-number-has-advanced-rows
    if (this.#typedBody()) return this.#mark();

    const el = this.#host.el;
    const ops = this.opList();
    const current = this.#host.op();
    const op = ops.includes(current) ? current : (ops[0] ?? DEFAULT_OP);
    const first = this.rows()[0];
    const select = first?.querySelector<SherpaInputText>('.condition') ?? null;
    if (select && select.value !== op) select.value = op;
    if (first) first.dataset['op'] = op;
    if (el.dataset['op'] !== op) this.#host.set('data-op', op);
    this.#host.set('data-takes', this.#takes(op));
    first?.setAttribute('data-takes', this.#takes(op));

    // Put back what was typed — a re-stamp blanked the box, not the state.
    const box = this.firstValue();
    const held = el.dataset['value'] ?? '';
    if (box && box.value !== held) box.value = held;
    this.#mark();
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

  /** A read-only editor's fields are `readonly` too, so a value offers no clear button. */
  readonly(): void {
    const readonly = this.#host.el.hasAttribute('data-readonly');
    for (const field of this.#root()?.querySelectorAll('sherpa-input-text') ?? []) field.toggleAttribute('readonly', readonly);
  }
}
