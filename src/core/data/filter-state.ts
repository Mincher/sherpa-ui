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
 * - FilterState — everything any control needs to draw one field — its answer as rows, and its type
 * - ConditionType — simple or advanced — which kind of answer a field has, decided once
 * - FieldType — What KIND of field this is.
 * - isRanged — A field whose Simple picks are ENDS, not a list to tick: a date.
 * - FieldFacts — What a caller knows about a field before anything is chosen.
 * - FieldReading — What is true right now, which decides the STATES.
 * - FieldCondition — One row of a multi-condition filter.
 * - rowOffer — What row `index` may offer: the values the rows before it in its AND chain leave.
 * - rowAnswered — Does this condition row have what its op needs to narrow anything?
 * - RuledOut — Why the source rules a value out: not offered, or not matched.
 * - ruleOut — A field's limits as one test: what its chain offers first, then what the filters before it leave.
 * - readingRows — a reading's Advanced answer as rows, old single-condition forms included
 * - modeOf — which answer a reading puts in force: its `mode`, else Advanced where rows answer
 * - rowsFromPicks — Simple's answer as Advanced's rows, for a mode switch to carry over
 * - fieldState — work out one field's whole state — the only place that decides it
 * - stateClause — One field's state as a ready `FilterClause`, or `undefined`.
 * - readingClause — a reading as a clause, for a control holding its own field facts
 * - savedReading — a field's answer as it can be SAVED, and put back as it was
 * - clauseConditions — a one-field chained clause back as its rows — the inverse of the chain
 */
import {
  DEFAULT_OP, END_OF_DAY, OP_TAKES,
  matchesFilter, picksClause, valueSet, valueKey,
  type Duration, type Filter, type FilterClause, type FilterOp,
} from './store.js';
import type { Threshold } from './threshold.js';

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
  /** The condition. `eq` unless a reader picked another. */
  op: FilterOp;
  /** What was TYPED, for a condition that takes text rather than a pick. */
  text: string;
  /**
   * The condition ROWS, when the reader built several. Empty for the ordinary
   * single-condition case, so a control that never asks sees no change.
   * TRAP T-many-conditions-are-one-reading
   */
  conditions: readonly FieldCondition[];
  /** Its KIND. `text` unless declared. TRAP T-the-field-type-decides-the-clause */
  type: FieldType;
  /** A DATE that holds a time of day, so a day alone means all of it. TODO 21d */
  time: boolean;
  /** Which answer is in force — the reading's, or Advanced where only rows answer. */
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
   * The WHOLE answer as condition rows — ticked values, a range and a typed
   * condition included. `stateClause` compiles only these.
   * TRAP T-one-condition-system
   */
  rows: readonly FieldCondition[];
}

/**
 * A SIMPLE filter is answered by the field's own body — values ticked, a
 * range dragged, a day picked — with the default op. An ADVANCED filter is
 * answered by a condition: a named op, a typed value, or a chain of rows. TRAP T-one-condition-system
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
  /** A number's bands, for a condition that names one. TRAP T-a-threshold-is-a-fact-of-the-field */
  thresholds?: readonly Threshold[];
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
   * SEVERAL conditions on one field, chained — the Advanced answer. The first
   * row has no `join`; every row after it carries `and` or `or`, which is how
   * a reader reads it. TRAP T-many-conditions-are-one-reading
   */
  conditions?: readonly FieldCondition[];
  /**
   * Which answer is IN FORCE. Both are kept — the picks (and a typed `op` /
   * `text`) are Simple's, the rows Advanced's — so a reader switches at any
   * time and loses nothing. Left out, the rows win where there are any.
   * TRAP T-both-answers-are-kept
   */
  mode?: ConditionType;
  /** The rows still MIRROR the picks: carried over on the first switch, and
   *  redrawn as the picks change, until the reader edits a row. */
  mirror?: boolean;
  /**
   * A DATE's picks are the ENDS of a range, not a list of days. Left out, a
   * date with no declared value list is read as ends. A number has no Simple
   * range: two numbers are a list, and a range is an Advanced row (TODO 375).
   * TRAP T-the-field-type-decides-the-clause
   */
  range?: boolean;
  /** Remembered but not applied. TRAP T-grid-suspend-is-not-clear */
  suspended?: boolean;
}

/** One row of a multi-condition filter. */
export interface FieldCondition {
  /** How this row joins the one before it. The FIRST row has none. */
  join?: 'and' | 'or';
  op: FilterOp;
  /** For an op that takes typed text. */
  text?: string;
  /** For an op that takes values — `eq` offers the field's own list. */
  picked?: readonly unknown[];
  /** `last` and `next`: what the typed count counts. Default `day`. TODO 21d */
  unit?: Duration['unit'];
}

/**
 * What row `index` may offer: the values the rows before it in its AND chain
 * leave. AND is serial and OR starts again, and AND binds tighter, so a row
 * looks back only as far as the last OR. Will, TODO 110 (B).
 * TRAP T-an-and-row-offers-what-the-rows-before-it-leave
 */
export function rowOffer(rows: readonly FieldCondition[], index: number, values: readonly string[]): Set<string> {
  let start = index;
  while (start > 0 && rows[start]?.join === 'and') start--;
  const before = rows.slice(start, index).filter(rowAnswered)
    .map(({ join: _join, ...row }, i): FieldCondition => (i ? { ...row, join: 'and' } : row));
  const clause = before.length ? readingClause({ field: 'v' }, { conditions: before, mode: 'advanced' }) : undefined;
  return new Set(clause ? values.filter((v) => matchesFilter({ v }, clause)) : values);
}

/** Does this condition row have what its op needs to narrow anything? An
 *  untouched row is not an answer. TRAP T-an-untouched-select-is-not-an-answer */
export function rowAnswered(row: FieldCondition): boolean {
  const takes = OP_TAKES[row.op] ?? 'list';
  if (takes === 'text') return (row.text ?? '').trim() !== '';
  // A range is BOTH its ends: one alone narrows nothing. TODO 375
  return (row.picked ?? []).length >= (takes === 'range' ? 2 : 1);
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

/** A list of value keys as a test, case aside. */
function looseSet(list: Iterable<string> | null | undefined): ((value: string) => boolean) | null {
  if (!list) return null;
  const keys = new Set<string>();
  for (const key of list) keys.add(key.toLowerCase());
  return (value) => keys.has(value.toLowerCase());
}

/**
 * A reading's ADVANCED answer, as rows: its own answered rows — or, from a
 * reading written before rows were a list, its one typed condition, or its
 * non-default op over its picks ("is not A and is not B").
 * TRAP T-both-answers-are-kept
 */
export function readingRows(reading: FieldReading): FieldCondition[] {
  const given = (reading.conditions ?? []).filter(rowAnswered);
  if (given.length) return [...given];
  const op = reading.op ?? DEFAULT_OP;
  const text = (reading.text ?? '').trim();
  if ((OP_TAKES[op] ?? 'list') === 'text') return text ? [{ op, text }] : [];
  if (op === DEFAULT_OP || (OP_TAKES[op] ?? 'list') !== 'list') return [];
  // Several picks under a NEGATIVE op all have to hold; any other op, any one.
  const join = op === 'ne' ? 'and' : 'or';
  return (reading.picked ?? []).map((value, i) => (i ? { op, join, picked: [value] } : { op, picked: [value] }));
}

/** Which answer a reading puts in force: its own `mode`, else Advanced where `rows`
 *  answer, else none said. TRAP T-both-answers-are-kept */
export function modeOf(reading: FieldReading, rows: readonly FieldCondition[] = readingRows(reading)): ConditionType | undefined {
  return reading.mode ?? (rows.length ? 'advanced' : undefined);
}

/** Simple's answer as Advanced's rows, for a mode switch to carry over; undefined
 *  when a body has nothing to carry. TRAP T-a-mode-switch-carries-the-answer-over */
export function rowsFromPicks(body: 'number' | 'date' | undefined, simple: FieldReading): FieldCondition[] | undefined {
  const [a, b] = (simple.picked ?? []).map(String);
  // A date: one day is On it, two are Between them. TODO 21d
  if (body === 'date') {
    if (a != null && b != null) return [{ op: 'between', picked: [a, b] }];
    return a != null ? [{ op: DEFAULT_OP, picked: [a] }] : undefined;
  }
  // A number: its one value under its op.
  if (body === 'number') {
    const typed = (simple.text ?? '').trim();
    if (typed) return [{ op: simple.op ?? DEFAULT_OP, text: typed }];
    return a != null ? [{ op: simple.op ?? DEFAULT_OP, picked: [a] }] : undefined;
  }
  return (simple.picked ?? []).map((value, i) => (
    i ? { op: DEFAULT_OP, join: 'or' as const, picked: [value] } : { op: DEFAULT_OP, picked: [value] }
  ));
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
  /* ENDS or a LIST. Said plainly when a control knows; otherwise a ranged
     field with nothing to tick can only be answering with ends. */
  const range = isRanged(type) && (reading.range ?? !facts.values?.length);
  /* NO DECLARED LIST means the picks ARE the values. "Everything ticked is no
     filter" can only be judged against a list someone named — a column menu
     that set `plan in [Pro, Free]` is filtering, whatever else exists.
     TRAP T-the-field-type-decides-the-clause */
  const declared = facts.values ?? (reading.picked ?? []);
  /* The string form is what a control puts in an attribute; `raw` is what the
     row holds. TRAP T-a-value-can-be-an-object */
  const raws = [...declared];
  const all = raws.map(valueKey);
  /* The QUERY's comparison — a chip's option values may be spelled differently
     from the data. TRAP T-one-comparison-rule-for-query-and-ui */
  const picked = valueSet(reading.picked ?? []);
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
  const answered = takesText
    ? text !== ''
    : range || !facts.values
      ? chosen + paths > 0
      : (chosen > 0 && chosen < tops.length) || paths > 0;

  /* ROWS answer for themselves. A row is answered when its op has what it
     needs — text typed, or a value picked — so a half-built row narrows
     nothing and an empty list is simply not a filter.
     TRAP T-many-conditions-are-one-reading */
  const conditions = (reading.conditions ?? []).filter(rowAnswered);

  /* ONE ANSWER, AS ROWS. Ticked values are an `eq` row — several picks in one
     field join with OR, so `in` — a range is a `between`, and a typed op is a
     row of its own. Whatever answered it, the compiler below sees rows.
     TRAP T-one-condition-system */
  const ends = values.filter(own).map((v) => v.raw);
  // Only the answer IN FORCE compiles; the other is kept. TRAP T-both-answers-are-kept
  const mode: ConditionType = modeOf(reading, conditions) ?? 'simple';
  const rows: FieldCondition[] = mode === 'advanced' ? [...conditions]
    : !answered ? []
      : takesText ? [{ op, text }]
        : [{ op: range && ends.length >= 2 ? 'between' : op, picked: ends }];
  const advanced = mode === 'advanced' || op !== DEFAULT_OP;

  return {
    field: facts.field,
    label: facts.label ?? facts.field,
    fieldState: !rows.length ? 'off' : reading.suspended ? 'suspended' : 'active',
    op,
    text,
    conditions,
    type,
    time: type === 'date' && !!facts.time,
    mode,
    range,
    ...(parentOf && facts.child ? { child: facts.child } : {}),
    values,
    condition: !rows.length ? null : advanced ? 'advanced' : 'simple',
    rows,
  };
}

/**
 * One field's state as a ready `FilterClause`, or `undefined`.
 *
 * It compiles `state.rows` and nothing else — ticked values, a range and a
 * typed condition all arrive as rows. ONE pick is `eq`; SEVERAL become `in`,
 * because `eq` against a list can never match. A suspended field contributes
 * nothing while keeping its values. TRAP T-one-condition-system
 */
export function stateClause(state: FilterState): Filter | undefined {
  if (state.fieldState !== 'active') return undefined;
  return chainRows(state);
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
 * A field's answer as it can be SAVED, and put back as it was: its rows when it
 * is Advanced, its ticks or ends when it is Simple. Nothing when it has no answer.
 * TRAP T-saved-filters-are-every-scope
 */
export function savedReading(state: FilterState): FieldReading | undefined {
  if (!state.rows.length) return undefined;
  if (state.condition === 'advanced') return { conditions: state.rows.map((row) => ({ ...row })) };
  const picked = [...(state.rows[0]?.picked ?? [])];
  return state.range ? { picked, range: true } : { picked };
}

/** Picks as the data holds them — a number column's values are numbers. */
function cast(picked: readonly unknown[], type: FieldType): unknown[] {
  if (type !== 'number') return [...picked];
  return picked.map((v) => {
    const n = Number(v);
    return v !== '' && Number.isFinite(n) ? n : v;
  });
}

/**
 * A NUMBER or DATE field's picks as a clause.
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
  const numeric = type === 'number';
  const ends = numeric ? picked.map(Number) : picked.map(String);
  const sorted = numeric
    ? (ends as number[]).slice().sort((a, b) => a - b)
    : (ends as string[]).slice().sort();
  return [field, op === 'notbetween' ? 'notbetween' : 'between', [sorted[0], sorted[sorted.length - 1]]];
}

/**
 * One condition row as a clause — the ONE place any answer becomes a filter.
 *
 * TYPED, and still cast: "at least 100" on a number column compares as text
 * otherwise, and "1000" sorts below "9". A RANGE is two ends, sorted by the
 * field's type. A LIST is `eq`, or `in` for several — and `raw`, because the
 * clause is tested against real rows. TRAP T-the-field-type-decides-the-clause
 * TRAP T-a-value-can-be-an-object
 */
function rowClause(state: FilterState, row: FieldCondition): Filter | undefined {
  // A DATE from today stays RELATIVE in the clause. TRAP T-a-relative-date-stays-relative
  if (row.op === 'last' || row.op === 'next') {
    const n = Number((row.text ?? '').trim());
    return n > 0 ? [state.field, row.op, { n, unit: row.unit ?? 'day' }] : undefined;
  }
  /* On a field with times, a day alone is ALL of that day, and a minute all of
     that minute: "On", "After" and the end of "Between" reach its last moment.
     Will, TODO 112. TRAP T-a-relative-date-stays-relative */
  if (state.time) {
    const one = row.op === 'gt' ? row.text : row.op === 'eq' && row.picked?.length === 1 ? row.picked[0] : undefined;
    const end = endOf(one);
    if (end) return row.op === 'gt' ? [state.field, 'gt', end] : [state.field, 'between', [one, end]];
    const [from, to] = [...(row.picked ?? [])].map(String).sort();
    if ((row.op === 'between' || row.op === 'notbetween') && from && to) return [state.field, row.op, [from, endOf(to) ?? to]];
  }
  const takes = OP_TAKES[row.op] ?? 'list';
  if (takes === 'text') {
    const text = (row.text ?? '').trim();
    return text ? [state.field, row.op, cast([text], state.type)[0]] as FilterClause : undefined;
  }
  const picked = [...(row.picked ?? [])];
  if (takes === 'range') return rangeClause(state.field, state.type, picked, row.op);
  // A tiered field's picks: parents, and paths over both fields. TODO 369
  if (state.child) return tierClause(state.field, state.child, picked, ROW_OPS[row.op] ?? row.op);
  /* A row's `in` / `notin` is its `eq` / `ne` over several picks: as given, `notin`
     with two picks compiled to `in`, and with one matched every row. TODO 386 */
  return picksClause(state.field, cast(picked, state.type), ROW_OPS[row.op] ?? row.op);
}

/**
 * A TIERED field's picks as one clause over two fields, in the four ops any
 * server runs: parents `in`, and each parent's child picks as `and(eq parent,
 * in children)`, all OR'd — `Contoso, or Northwind at London or Leeds`. `ne`
 * is its opposite. A path is split by its OWN fields, never by a key string.
 * TODO 369
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

/** A held CLAUSE op as a reader's ROW op: several `eq` picks are `in`. */
const ROW_OPS: Readonly<Record<string, FilterOp>> = { in: 'eq', notin: 'ne' };

/** One clause leaf as a row, or undefined when it is not one. */
function leafRow(leaf: Filter): FieldCondition | undefined {
  if (!Array.isArray(leaf) || typeof leaf[0] !== 'string' || leaf[0] === 'and' || leaf[0] === 'or') {
    return undefined;
  }
  const [, clauseOp, value] = leaf as FilterClause;
  if (clauseOp === 'last' || clauseOp === 'next') {
    const { n, unit } = value as Duration;
    return { op: clauseOp, text: String(n), unit };
  }
  const op = ROW_OPS[clauseOp] ?? clauseOp;
  if ((OP_TAKES[op] ?? 'list') === 'text') return { op, text: String(value ?? '') };
  return { op, picked: Array.isArray(value) ? [...value] : [value] };
}

/**
 * clauseConditions(filter) — a ONE-FIELD chained clause back as its rows: the
 * inverse of the chain, `A or (B and C)` to three rows joined `or`, `and`.
 * For a control that is handed a clause and draws rows — a grid heading.
 * `undefined` for a shape the rows cannot say, never a guess.
 * TRAP T-a-heading-holds-a-whole-reading
 */
export function clauseConditions(filter: Filter): FieldCondition[] | undefined {
  const groups = Array.isArray(filter) && filter[0] === 'or'
    ? (filter.slice(1) as Filter[]) : [filter];
  const rows: FieldCondition[] = [];
  for (const [g, group] of groups.entries()) {
    const leaves = Array.isArray(group) && group[0] === 'and' ? (group.slice(1) as Filter[]) : [group];
    for (const [l, leaf] of leaves.entries()) {
      const row = leafRow(leaf);
      if (!row) return undefined;
      if (g > 0 && l === 0) row.join = 'or';
      else if (l > 0) row.join = 'and';
      rows.push(row);
    }
  }
  return rows.length ? rows : undefined;
}

/**
 * The rows as ONE filter, joined left to right with `and` binding tighter than
 * `or` — the precedence every other language uses, so a reader who writes
 * `A or B and C` gets `A or (B and C)`. TRAP T-many-conditions-are-one-reading
 */
function chainRows(state: FilterState): Filter | undefined {
  const runs: Filter[][] = [];
  for (const row of state.rows) {
    const one = rowClause(state, row);
    if (!one) continue;
    if (!runs.length || row.join === 'or') runs.push([one]);
    else runs[runs.length - 1]!.push(one);
  }
  const anded = runs.map((run) => (run.length > 1 ? (['and', ...run] as Filter) : run[0]!));
  if (!anded.length) return undefined;
  return anded.length === 1 ? anded[0]! : (['or', ...anded] as Filter);
}
