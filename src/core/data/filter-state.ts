/**
 * filter-state.ts — ONE state per field, for every control that draws it.
 *
 * A field is drawn in several places at once, and each control used to work
 * out what it showed, so one field could read several ways. `fieldState()` is
 * the answer they all read: which field, whether it narrows anything, and
 * every value it has with what that value is doing.
 *
 * NOT ONLY FILTERS — a tab strip, a legend, a select group and a transfer list
 * ask the same question. `stateClause()` is the only part that speaks filters.
 *
 * DOM-free: the rule, not the wiring.
 *
 * TRAP T-one-state-per-filtered-field
 *
 * Map:
 * - FieldState — What a field's selection is doing.
 * - ValueState — What one value is doing inside its field.
 * - ValueEntry — One value, and what it is doing.
 * - FilterState — everything any control needs to draw one field — its answer as a tree, and its type
 * - ConditionType — simple or advanced — which kind of answer a field has, decided once
 * - FieldType — What KIND of field this is.
 * - isRanged — A field whose Simple picks are ENDS, not a list to tick: a date.
 * - FieldFacts — What a caller knows about a field before anything is chosen.
 * - FieldReading — What is true right now, which decides the STATES.
 * - RuledOut — Why the source rules a value out: not offered, or not matched.
 * - ruleOut — A field's limits as one test: what its chain offers first, then what the filters before it leave.
 * - goesFromList — Does a ruled-out value GO from its list: one its chain does not offer, and, hiding unmatched, any ruled out —…
 * - modeOf — which answer a reading puts in force: its `mode`, else Advanced where its tree answers
 * - answeredCondition — A tree with only its answered parts, or undefined when none answers.
 * - answerTree — A reading's answer in force as a tree — Simple's picks as their leaf; none while off, or All.
 * - withPreset — A reading with one preset's tree on it, or, with none, off it.
 * - presetTouches — Does a preset's tree touch this value of a field: a list value it keeps?
 * - fieldState — work out one field's whole state — the only place that decides it
 * - typedValue — A value as its field holds it: a number field's text `70` is 70, a list's each; anything else as given.
 * - typedTree — A tree's values as its field holds them, by `typedValue`.
 * - stateClause — One field's state as a ready `FilterClause`, or `undefined`.
 * - readingClause — a reading as a clause, for a control holding its own field facts
 * - conditionClause — A tree as the filter it says — the ONE place any answer becomes a filter.
 */
import {
  andFilter, groupOf, matchesFilter,
  DEFAULT_OP, END_OF_DAY, OP_TAKES,
  picksClause, valueSet, valueKey,
  type Condition, type ConditionLeaf, type Duration, type Filter, type FilterClause, type FilterOp,
} from './store.js';

/** What a field's selection is doing. */
export type FieldState =
  /** Nothing chosen, or everything — either way it narrows nothing. */
  | 'off'
  /** Narrowing, and the reader can see by what. */
  | 'active'
  /** Remembered but not applied — off is not gone. TRAP T-grid-suspend-is-not-clear */
  | 'suspended';

/** What one value is doing inside its field. */
export type ValueState =
  /** Chosen — ticked, selected, active, whichever word the control uses. */
  | 'picked'
  /** Choosable, and not chosen. */
  | 'unpicked'
  /** Nothing would come back: out of reach right now, but still selectable
   *  and still SHOWN. TRAP T-unavailable-value-sorts-below-a-divider */
  | 'unavailable';

/** One value, and what it is doing. */
export interface ValueEntry {
  /** The value as a STRING — the only form that fits in `input.value`.
   *  TRAP T-a-value-can-be-an-object */
  value: string;
  /** The value as the data holds it — a number stays a number, an object an object. */
  raw: unknown;
  /** What a reader sees. Defaults to `value`. */
  label: string;
  state: ValueState;
  /** A tiered field's child value: its parent's key. TODO 369 */
  parent?: string;
}

/** Everything every control needs to draw one field. */
export interface FilterState {
  field: string;
  /** What a reader calls the field. */
  label: string;
  fieldState: FieldState;
  /** Each preset on's tree, apart from the `answer`. TODO 521 */
  held?: readonly Condition[];
  /** The condition. `eq` unless a reader picked another. */
  op: FilterOp;
  /** What was TYPED, for a condition that takes text rather than a pick. */
  text: string;
  /** The Advanced answer's answered parts, kept whichever answer is in force.
   *  TRAP T-many-conditions-are-one-reading */
  tree?: Condition;
  /** Its KIND. `text` unless declared. TRAP T-the-field-type-decides-the-clause */
  type: FieldType;
  /** A DATE that holds a time of day, so a day alone means all of it. TODO 21d */
  time: boolean;
  /** Which answer is in force — the reading's, or Advanced where only its tree answers. */
  mode: ConditionType;
  /** Its picks are the ENDS of a range. */
  range: boolean;
  /** A TIERED field's child field: a pick may be a path over both. TODO 369 */
  child?: string;
  /** EVERY value the field has — never only the reachable ones. */
  values: ValueEntry[];
  /**
   * WHICH KIND OF ANSWER, or null when it has none — decided here, once. The
   * chip's info-blue and its fx badge both read this; they used to decide it
   * two different ways. TRAP T-one-condition-system
   */
  condition: ConditionType | null;
  /**
   * The WHOLE answer in force as ONE tree — ticked values, a range and a typed
   * condition as their leaf, numbers as numbers. `stateClause` compiles only this.
   * TRAP T-one-condition-system
   */
  answer?: Condition;
  /** Every value ticked, on purpose: it filters nothing. Will, TODO 489 · TRAP T-all-is-an-answer */
  all?: boolean;
}

/**
 * A SIMPLE filter is answered by the field's own body — values ticked, a
 * range dragged, a day picked — with the default op. An ADVANCED filter is
 * answered by a condition: a named op, a typed value, or a tree of them. TRAP T-one-condition-system
 */
export type ConditionType = 'simple' | 'advanced';

/** What KIND of field this is. The same three `OPS_FOR_TYPE` names. */
export type FieldType = 'text' | 'number' | 'date';

/** A field whose Simple picks are ENDS, not a list to tick: a DATE. A number's
 *  range is an Advanced row. Will, TODO 375 */
export function isRanged(type: FieldType | undefined): boolean {
  return type === 'date';
}

/** What a caller knows about a field before anything is chosen. */
export interface FieldFacts {
  /** Every value ticked still filters: a rule says what it says, and a new value does
   *  not slip through. For a reader, all ticked is no filter. TODO 614 */
  literal?: boolean;
  field: string;
  label?: string;
  /** Its KIND, which decides how picks become a clause: two picks on a number
   *  or a date are a RANGE, not two equalities.
   *  TRAP T-the-field-type-decides-the-clause */
  type?: FieldType;
  /** Every value the field has, over the WHOLE data — not the drawn page.
   *  A value can be a string, a number or an object.
   *  TRAP T-a-value-can-be-an-object */
  values?: readonly unknown[];
  /** A reader-facing name per value, where it differs. */
  labels?: Readonly<Record<string, string>>;
  /** A DATE that holds a time of day. TODO 21d */
  time?: boolean;
  /** A DATE whose picks are two ENDS unless a reading says not. TRAP T-a-date-picks-days-unless-it-says-range */
  range?: boolean;
  /** A TIERED field's child field, and each child pick's (path's) parent, by key. TODO 369 */
  child?: string;
  parentOf?: ReadonlyMap<string, string>;
}

/** What is true right now, which decides the STATES. */
export interface FieldReading {
  /** The values a reader has picked — a string, a number or an object.
   *  TRAP T-a-value-can-be-an-object */
  picked?: readonly unknown[];
  /** The values some row still carries, under every OTHER filter. */
  present?: readonly unknown[];
  op?: FilterOp;
  text?: string;
  /**
   * The Advanced answer: ONE tree over this field, its leaves naming no field —
   * nested as deep as it was said. TRAP T-one-condition-tree
   */
  tree?: Condition;
  /**
   * Which answer is IN FORCE. Both are kept — the picks (and a typed `op` /
   * `text`) are Simple's, the tree Advanced's — so a reader switches at any
   * time and loses nothing. Left out, the tree wins where it answers.
   * TRAP T-both-answers-are-kept
   */
  mode?: ConditionType;
  /** The tree still MIRRORS the picks: carried over on the first switch, and
   *  redrawn as the picks change, until the reader edits a row. */
  mirror?: boolean;
  /**
   * A DATE's picks are the ENDS of a range, not a list of days. Left out, the
   * field's own `range` says. A number has no Simple range: two numbers are a
   * list, and a range is an Advanced row (TODO 375).
   * TRAP T-the-field-type-decides-the-clause
   */
  range?: boolean;
  /** Remembered but not applied. TRAP T-grid-suspend-is-not-clear */
  suspended?: boolean;
  /** Picks KEPT and not in force: a tiered parent switched off keeps its
   *  children's picks for when it comes on. TODO 369 · TRAP T-a-parent-pick-is-the-parent */
  off?: readonly unknown[];
  /** EVERY value ticked, on purpose — Select all on, or a list that starts so —
   *  whatever values come: no filter. Will, TODO 489 · TRAP T-all-is-an-answer */
  all?: boolean;
  /** What each PRESET on holds of this field, by its id: its name, its scope and
   *  its tree, ANDed with the answer. The answer and its mode stay the reader's.
   *  Will, TODO 521 · TRAP T-a-preset-is-its-own-part */
  byPreset?: Readonly<Record<string, { label: string; scope: string; tree: Condition }>>;
}

/** Why the source rules a value out: its chain does not offer it, or the filters before it leave none of it. */
export type RuledOut = 'unoffered' | 'unmatched' | null;

/** A field's limits as one test: what its chain OFFERS first, then what the
 *  filters before it LEAVE — compared as a filter compares, case aside, so it
 *  agrees with the source's walk. A null list limits nothing. TRAP T-a-ruled-out-value-is-greyed */
export function ruleOut(present: Iterable<string> | null | undefined, offered?: Iterable<string> | null): (value: string) => RuledOut {
  const left = looseSet(present);
  const offers = looseSet(offered);
  return (value) => (offers && !offers(value) ? 'unoffered' : left && !left(value) ? 'unmatched' : null);
}

/** Does a ruled-out value GO from its list: one its chain does not offer, and,
 *  hiding unmatched, any ruled out — never one still picked. TODO 448 */
export function goesFromList(why: RuledOut, hide: boolean, picked: boolean): boolean {
  return !picked && (why === 'unoffered' || (hide && why !== null));
}

/** A list of value keys as a test, case aside. */
function looseSet(list: Iterable<string> | null | undefined): ((value: string) => boolean) | null {
  if (!list) return null;
  const keys = new Set<string>();
  for (const key of list) keys.add(key.toLowerCase());
  return (value) => keys.has(value.toLowerCase());
}

/** Which answer a reading puts in force: its own `mode`, else Advanced where its
 *  tree answers, else none said. TRAP T-both-answers-are-kept */
export function modeOf(reading: FieldReading): ConditionType | undefined {
  return reading.mode ?? (answeredCondition(reading.tree) ? 'advanced' : undefined);
}

/* ── The tree — TRAP T-one-condition-tree ── */

/** Does a leaf have what its op needs to narrow anything? */
function leafAnswered({ op, value }: ConditionLeaf): boolean {
  // A span of no length has no clause: "in the last 0" answers nothing. TODO 612
  if (op === 'last' || op === 'next') return Number((value as Partial<Duration> | undefined)?.n) > 0;
  const takes = OP_TAKES[op] ?? 'list';
  if (takes === 'text') return value != null && String(value).trim() !== '';
  // A range is BOTH its ends: one alone narrows nothing. TODO 375
  if (takes === 'range') return Array.isArray(value) && value.length >= 2;
  return Array.isArray(value) ? value.length > 0 : value !== undefined;
}

/** Parts under one join, as a group. */
function group(join: 'and' | 'or', parts: readonly Condition[], own: { off?: boolean; id?: string } = {}): Condition {
  return { ...own, ...(join === 'and' ? { and: parts } : { or: parts }) } as Condition;
}

/** A tree with only its answered parts, or undefined when none answers: a
 *  half-built row narrows nothing. TRAP T-many-conditions-are-one-reading */
export function answeredCondition(tree: Condition | undefined): Condition | undefined {
  if (!tree) return undefined;
  const parts = groupOf(tree);
  if (!parts) return leafAnswered(tree as ConditionLeaf) ? tree : undefined;
  const kept = parts[1].map(answeredCondition).filter((p): p is Condition => !!p);
  if (!kept.length) return undefined;
  const own = { ...(tree.off ? { off: true } : {}), ...(tree.id !== undefined ? { id: tree.id } : {}) };
  return kept.length === 1 && !Object.keys(own).length ? kept[0] : group(parts[0], kept, own);
}

/** Picks under a list op as ONE leaf: one value is `eq`, several `in`; `ne`, `notin`. */
function picksLeaf(op: FilterOp, picks: readonly unknown[]): ConditionLeaf {
  if ((OP_TAKES[op] ?? 'list') !== 'list') return { op, value: [...picks] };
  const not = op === 'ne' || op === 'notin';
  return picks.length === 1 ? { op: not ? 'ne' : 'eq', value: picks[0] } : { op: not ? 'notin' : 'in', value: [...picks] };
}

/* ── A PRESET's tree in a field's answer — Will, TODO 510 · TRAP T-a-preset-is-its-own-part ── */

/** A reading's answer in force as a tree — Simple's picks as their leaf; none
 *  while it is off, or All. */
export function answerTree(reading: FieldReading | undefined, facts: Omit<FieldFacts, 'field'> = {}): Condition | undefined {
  if (!reading || reading.suspended || reading.all) return undefined;
  const { byPreset: _held, ...own } = reading;
  return fieldState({ field: '', ...facts }, own).answer;
}

/** A reading with one preset's tree on it, or, with none, off it. TODOs 521, 526 */
export function withPreset(reading: FieldReading | undefined, id: string, preset: NonNullable<FieldReading['byPreset']>[string] | null): FieldReading {
  const { [id]: _was, ...others } = reading?.byPreset ?? {};
  const byPreset = preset ? { ...others, [id]: preset } : others;
  // A Switch off stops every answer; a preset turned on is in force.
  const { byPreset: _old, suspended, ...base } = reading ?? {};
  return { ...base, ...(suspended && !preset ? { suspended } : {}), ...(Object.keys(byPreset).length ? { byPreset } : {}) };
}

/** Does a preset's tree touch this value of a field: a list value it keeps?
 *  Will, TODO 590 · TRAP T-a-preset-is-its-own-part */
export function presetTouches(tree: Condition, value: string): boolean {
  return matchesFilter({ value }, conditionClause(tree, { field: 'value' }));
}

/**
 * Work out one field's whole state — the ONLY place that decides whether a
 * field is filtering, which values are picked, and which are out of reach.
 * TRAP T-one-state-per-filtered-field
 */
export function fieldState(facts: FieldFacts, reading: FieldReading = {}): FilterState {
  const type = facts.type ?? 'text';
  /* A RANGE field has no value LIST to tick — a reader types an end, or drags
     one. So its own picks ARE its values, and every rule below then works
     unchanged. TRAP T-the-field-type-decides-the-clause */
  // ENDS or a LIST: a date's picks are DAYS unless the reading or its field says range. TRAP T-a-date-picks-days-unless-it-says-range
  const range = isRanged(type) && (reading.range ?? !!facts.range);
  /* NO DECLARED LIST means the picks ARE the values. "Everything ticked is no
     filter" can only be judged against a list someone named — a column menu
     that set `plan in [Pro, Free]` is filtering, whatever else exists.
     TRAP T-the-field-type-decides-the-clause */
  /* A RANGE's ends are its values, and a DATE's day is one whatever the rows
     hold: a day with no rows is a real answer — 0 matches, still on. Will,
     2026-10-22. TRAP T-no-rows-is-still-an-answer */
  /* …and a pick outside a declared list is still a pick, whatever the type: the
     counts count it, so the query asks it. An EMPTY list is nothing to pick. TODO 518 */
  const picks = reading.picked ?? [];
  const declared = range ? picks
    : facts.values?.length ? [...facts.values, ...picks.filter((p) => !facts.values!.some((v) => valueKey(v) === valueKey(p)))]
      : facts.values ?? picks;
  /* The string form is what a control puts in an attribute; `raw` is what the
     row holds. TRAP T-a-value-can-be-an-object */
  const raws = [...declared];
  const all = raws.map(valueKey);
  // ALL ticks every value it has, whichever come. TRAP T-all-is-an-answer
  const every = !!reading.all && type !== 'date' && reading.mode !== 'advanced' && (OP_TAKES[reading.op ?? DEFAULT_OP] ?? 'list') === 'list';
  /* The QUERY's comparison — a chip's option values may be spelled differently
     from the data. TRAP T-one-comparison-rule-for-query-and-ui */
  const picked = valueSet(every ? raws : reading.picked ?? []);
  // No `present` given means "everything is reachable", not "nothing is".
  const present = reading.present ? valueSet(reading.present) : null;
  const op = reading.op ?? DEFAULT_OP;
  const text = (reading.text ?? '').trim();

  /* A TIERED field's child picks are PATHS: a path whose parent is picked shows
     picked, and the parent says it already. A control that draws the tree knows
     its parents, and not the child's field. TODO 369 */
  const parentOf = facts.parentOf?.size ? facts.parentOf : undefined;
  const pickedKeys = new Set(all.filter((_, i) => picked.has(raws[i])));
  const values: ValueEntry[] = all.map((value, i) => {
    const parent = parentOf?.get(value);
    return {
      value,
      raw: raws[i],
      label: facts.labels?.[value] ?? value,
      ...(parent ? { parent } : {}),
      state: pickedKeys.has(value) || (parent != null && pickedKeys.has(parent))
        ? 'picked'
        : present && !present.has(raws[i])
          ? 'unavailable'
          : 'unpicked',
    };
  });
  /** A pick the parent does not already say. */
  const own = (v: ValueEntry): boolean => v.state === 'picked' && !(v.parent && pickedKeys.has(v.parent));

  /* A TYPED condition filters with nothing ticked; EVERYTHING ticked filters
     nothing — counted over PARENTS on a tiered field. TRAP T-everything-on-is-no-filter */
  const takesText = (OP_TAKES[op] ?? 'list') === 'text';
  const tops = parentOf ? values.filter((v) => !v.parent) : values;
  const chosen = tops.filter((v) => v.state === 'picked').length;
  const paths = parentOf ? values.filter((v) => v.parent && own(v)).length : 0;
  // Nothing ticked filters nothing. Will, TODO 550
  const answered = takesText
    ? text !== ''
    : !facts.values || type === 'date'
      ? chosen + paths > 0
      : (chosen > 0 && (facts.literal || chosen < tops.length)) || paths > 0;

  /* The TREE answers for itself: a leaf is answered when its op has what it
     needs — text typed, or a value picked — so a half-built row narrows
     nothing and an empty list is simply not a filter.
     TRAP T-many-conditions-are-one-reading */
  const tree = answeredCondition(reading.tree);

  /* ONE ANSWER, AS ONE TREE. Ticked values are an `eq` leaf — several picks in
     one field join with OR, so `in` — a range is a `between`, and a typed op is
     a leaf of its own. Whatever answered it, the compiler below sees a tree.
     TRAP T-one-condition-system */
  const ends = values.filter(own).map((v) => v.raw);
  // Only the answer IN FORCE compiles; the other is kept. TRAP T-both-answers-are-kept
  const mode: ConditionType = reading.mode ?? (tree ? 'advanced' : 'simple');
  const said: Condition | undefined = mode === 'advanced' ? tree
    : !answered ? undefined
      : takesText ? { op, value: text }
        : picksLeaf(range && ends.length >= 2 ? 'between' : op, ends);
  // Typed here, whatever it came from: a Simple text, or a tree kept before. TRAP T-a-value-is-typed-once
  const answer = said && typedTree(said, type);
  const advanced = mode === 'advanced' || op !== DEFAULT_OP;
  const held = Object.values(reading.byPreset ?? {}).map((p) => typedTree(p.tree, type));

  return {
    field: facts.field,
    label: facts.label ?? facts.field,
    fieldState: !answer && !held.length ? 'off' : reading.suspended ? 'suspended' : 'active',
    op,
    text,
    ...(tree ? { tree } : {}),
    type,
    time: type === 'date' && !!facts.time,
    mode,
    range,
    ...(parentOf && facts.child ? { child: facts.child } : {}),
    values,
    condition: !answer ? null : advanced ? 'advanced' : 'simple',
    ...(answer ? { answer } : {}),
    ...(held.length ? { held } : {}),
    ...(every ? { all: true } : {}),
  };
}

/** A value as its field holds it: a number field's text `70` is 70, a list's each;
 *  anything else as given. The one cast, called where a value comes in.
 *  TRAP T-a-value-is-typed-once */
export function typedValue(type: FieldType | undefined, value: unknown): unknown {
  if (type !== 'number') return value;
  if (Array.isArray(value)) return value.map((v) => typedValue(type, v));
  if (typeof value !== 'string') return value;
  const text = value.trim();
  const n = Number(text);
  return text !== '' && Number.isFinite(n) ? n : text;
}

/** A tree's values as its field holds them, by `typedValue`. */
export function typedTree(tree: Condition, type: FieldType | undefined): Condition {
  if (type !== 'number') return tree;
  const parts = groupOf(tree);
  if (parts) return group(parts[0], parts[1].map((p) => typedTree(p, type)), tree);
  const leaf = tree as ConditionLeaf;
  if (leaf.op === 'last' || leaf.op === 'next') return leaf;
  return { ...leaf, value: typedValue(type, leaf.value) };
}

/**
 * One field's state as a ready `FilterClause`, or `undefined`.
 *
 * It compiles `state.answer` and nothing else — ticked values, a range and a
 * typed condition all arrive as its leaves. ONE pick is `eq`; SEVERAL become
 * `in`, because `eq` against a list can never match. A suspended field
 * contributes nothing while keeping its values. TRAP T-one-condition-system
 */
export function stateClause(state: FilterState): Filter | undefined {
  if (state.fieldState !== 'active') return undefined;
  const facts: FieldFacts = { field: state.field, type: state.type, time: state.time, ...(state.child ? { child: state.child } : {}) };
  // Each preset's tree ANDs with the answer: `(A or B) and P`. TRAP T-a-preset-is-its-own-part
  return andFilter([state.answer, ...state.held ?? []].map((tree) => conditionClause(tree, facts)).filter((f): f is Filter => !!f));
}

/**
 * A reading as a clause, for a control that holds a field's facts itself — a
 * grid column heading, say, whose menu is not the source's own selection.
 * ONE rule, wherever the reading came from.
 * TRAP T-the-field-type-decides-the-clause
 */
export function readingClause(facts: FieldFacts, reading: FieldReading): Filter | undefined {
  return stateClause(fieldState(facts, reading));
}

/**
 * A NUMBER or DATE field's ends as a clause.
 *
 * TWO ends are a `between` — or a `notbetween`; one end alone is no range, and
 * narrows nothing. A number is compared as a NUMBER — sorting `["1000","9"]` as
 * text puts 1000 first and the range then matches nothing.
 * TRAP T-the-field-type-decides-the-clause
 */
function rangeClause(
  field: string, type: FieldType, picked: readonly unknown[], op: FilterOp,
): Filter | undefined {
  if (picked.length < 2) return undefined;
  // Numbers as written stay numbers, whatever the field says. TRAP T-one-condition-tree
  const numeric = type === 'number' || picked.every((v) => typeof v === 'number');
  const ends = numeric ? picked.map(Number) : picked.map(String);
  const sorted = numeric
    ? (ends as number[]).slice().sort((a, b) => a - b)
    : (ends as string[]).slice().sort();
  return [field, op === 'notbetween' ? 'notbetween' : 'between', [sorted[0], sorted[sorted.length - 1]]];
}

/**
 * A condition tree as the filter it says — the ONE place any answer becomes a
 * filter. A leaf takes its field's facts: one naming no field is `facts`'s, one
 * naming another asks `factsOf`. A part kept off says nothing.
 * TRAP T-one-condition-tree · TRAP T-the-field-type-decides-the-clause
 */
export function conditionClause(
  tree: Condition | undefined, facts?: FieldFacts, factsOf?: (field: string) => Omit<FieldFacts, 'field'> | undefined,
): Filter | undefined {
  if (!tree || tree.off) return undefined;
  const parts = groupOf(tree);
  if (parts) {
    const [join, each] = parts;
    const said = each.map((p) => conditionClause(p, facts, factsOf)).filter((f): f is Filter => !!f)
      .flatMap((f) => (f[0] === join ? (f.slice(1) as Filter[]) : [f]));
    return said.length > 1 ? ([join, ...said] as Filter) : said[0];
  }
  const leaf = tree as ConditionLeaf;
  const field = leaf.field ?? facts?.field;
  if (!field) return undefined;
  return leafClause(field === facts?.field ? facts : { field, ...factsOf?.(field) }, leaf);
}

/**
 * One leaf as a clause.
 *
 * TYPED, and still cast: "at least 100" on a number column compares as text
 * otherwise, and "1000" sorts below "9". A RANGE is two ends, sorted by the
 * field's type. A LIST is `eq`, or `in` for several — and `raw`, because the
 * clause is tested against real rows. TRAP T-the-field-type-decides-the-clause
 * TRAP T-a-value-can-be-an-object
 */
function leafClause(facts: FieldFacts, { op, value }: ConditionLeaf): Filter | undefined {
  const { field } = facts;
  const type = facts.type ?? 'text';
  // A DATE from today stays RELATIVE in the clause. TRAP T-a-relative-date-stays-relative
  if (op === 'last' || op === 'next') {
    const { n, unit = 'day' } = (value ?? {}) as Partial<Duration>;
    return Number(n) > 0 ? [field, op, { n: Number(n), unit }] : undefined;
  }
  const list = Array.isArray(value) ? [...value] : [value];
  /* On a field with times, a day alone is ALL of that day, and a minute all of
     that minute: "On", "After" and the end of "Between" reach its last moment.
     Will, TODO 112. TRAP T-a-relative-date-stays-relative */
  if (type === 'date' && facts.time) {
    const one = op === 'gt' ? (typeof value === 'string' ? value.trim() : value)
      : (op === 'eq' || op === 'in') && list.length === 1 ? list[0] : undefined;
    const end = endOf(one);
    if (end) return op === 'gt' ? [field, 'gt', end] : [field, 'between', [one, end]];
    const [from, to] = list.map(String).sort();
    if ((op === 'between' || op === 'notbetween') && from && to) return [field, op, [from, endOf(to) ?? to]];
  }
  const takes = OP_TAKES[op] ?? 'list';
  // Typed where it came in, so nothing is cast here. TRAP T-a-value-is-typed-once
  if (takes === 'text') {
    const text = typeof value === 'string' ? value.trim() : value;
    return text != null && text !== '' ? [field, op, text] as FilterClause : undefined;
  }
  if (value === undefined) return undefined;
  if (takes === 'range') return rangeClause(field, type, list, op);
  /* A list op over several picks: `eq` is `in`, `ne` is `notin` — as given, `notin`
     with two picks compiled to `in`, and with one matched every row. TODO 386 */
  const base = op === 'in' ? 'eq' : op === 'notin' ? 'ne' : op;
  // A tiered field's picks: parents, and paths over both fields. TODO 369
  if (facts.child) return tierClause(field, facts.child, list, base);
  return picksClause(field, list, base);
}

/**
 * A TIERED field's picks as one clause over two fields, in the four ops any
 * server runs: parents `in`, and each parent's child picks as `and(eq parent,
 * in children)`, all OR'd — `Contoso, or Northwind at London or Leeds`. `ne`
 * is its opposite. A path is split by its OWN fields, never by a key string.
 * TRAP T-a-value-holds-child-values
 */
function tierClause(field: string, child: string, picked: readonly unknown[], op: FilterOp): Filter | undefined {
  const isPath = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v) && field in v && child in v;
  const tops = picked.filter((v) => !isPath(v));
  const under = new Map<string, { parent: unknown; kids: unknown[] }>();
  for (const path of picked.filter(isPath)) {
    const at = under.get(valueKey(path[field])) ?? { parent: path[field], kids: [] };
    at.kids.push(path[child]);
    under.set(valueKey(path[field]), at);
  }
  const not = op === 'ne';
  const parts: Filter[] = [];
  const top = picksClause(field, tops, not ? 'ne' : 'eq');
  if (top) parts.push(top);
  for (const { parent, kids } of under.values()) {
    const sites = picksClause(child, kids, not ? 'ne' : 'eq')!;
    parts.push(not ? ['or', [field, 'ne', parent], sites] : ['and', [field, 'eq', parent], sites]);
  }
  if (parts.length < 2) return parts[0];
  return [not ? 'and' : 'or', ...parts];
}

/** The last moment of a day (`2026-09-03`) or a minute (`2026-09-03T14:00`);
 *  `undefined` for a value that names its seconds, which is exact. */
function endOf(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}${END_OF_DAY}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:59.999`;
  return undefined;
}
