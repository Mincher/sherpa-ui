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
 * - ConditionType — default or custom — which kind of answer a field has, decided once
 * - FieldType — What KIND of field this is.
 * - isRanged — A field whose picks are ENDS, not a list to tick.
 * - FieldFacts — What a caller knows about a field before anything is chosen.
 * - FieldReading — What is true right now, which decides the STATES.
 * - FieldCondition — One row of a multi-condition filter.
 * - fieldState — work out one field's whole state — the only place that decides it
 * - stateClause — One field's state as a ready `FilterClause`, or `undefined`.
 * - readingClause — a reading as a clause, for a control holding its own field facts
 * - savedReading — a field's answer as it can be SAVED, and put back as it was
 * - clauseConditions — a one-field chained clause back as its rows — the inverse of the chain
 */
import {
  DEFAULT_OP, OP_TAKES,
  picksClause, valueSet, valueKey,
  type Filter, type FilterClause, type FilterOp,
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
  /** Its picks are the ENDS of a range. */
  range: boolean;
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
 * A DEFAULT Condition Filter is answered by the field's own body — values
 * ticked, a range dragged, a day picked — with the default op. A CUSTOM
 * Condition Filter is answered by a condition: a named op, a typed value, or
 * a chain of rows. TRAP T-one-condition-system
 */
export type ConditionType = 'default' | 'custom';

/** What KIND of field this is. The same three `OPS_FOR_TYPE` names. */
export type FieldType = 'text' | 'number' | 'date';

/** A field whose picks are ENDS, not a list to tick. */
export function isRanged(type: FieldType | undefined): boolean {
  return type === 'number' || type === 'date';
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
   * SEVERAL conditions on one field, chained. The first row has no `join`;
   * every row after it carries `and` or `or`, which is how a reader reads it.
   *
   * `op`/`text` above remain the single-condition form and are what every
   * existing caller writes. A reading may carry EITHER — never both, because
   * two answers to "what is this field filtering by" is the bug this file
   * exists to prevent. TRAP T-many-conditions-are-one-reading
   */
  conditions?: readonly FieldCondition[];
  /**
   * Its picks are the ENDS of a range, not a list of values.
   *
   * A number field answered two ways: a SLIDER gives two ends (`between`), a
   * ticked LIST gives two values (`in`). The type alone cannot tell them
   * apart. Left out, a ranged field with no declared value list is read as
   * ends — there is nothing to tick. TRAP T-the-field-type-decides-the-clause
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
}

/** Does this condition row have what its op needs to narrow anything? An
 *  untouched row is not an answer. TRAP T-an-untouched-select-is-not-an-answer */
function rowAnswered(row: FieldCondition): boolean {
  return (OP_TAKES[row.op] ?? 'list') === 'text'
    ? (row.text ?? '').trim() !== ''
    : (row.picked ?? []).length > 0;
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
  const range = reading.range ?? (isRanged(type) && !facts.values?.length);
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

  const values: ValueEntry[] = all.map((value, i) => ({
    value,
    raw: raws[i],
    label: facts.labels?.[value] ?? value,
    state: picked.has(raws[i])
      ? 'picked'
      : present && !present.has(raws[i])
        ? 'unavailable'
        : 'unpicked',
  }));

  /* A TYPED condition filters with nothing ticked; EVERYTHING ticked filters
     nothing. TRAP T-everything-on-is-no-filter */
  const takesText = (OP_TAKES[op] ?? 'list') === 'text';
  const chosen = values.filter((v) => v.state === 'picked').length;
  const answered = takesText
    ? text !== ''
    : range || !facts.values
      ? chosen > 0
      : chosen > 0 && chosen < all.length;

  /* ROWS answer for themselves. A row is answered when its op has what it
     needs — text typed, or a value picked — so a half-built row narrows
     nothing and an empty list is simply not a filter.
     TRAP T-many-conditions-are-one-reading */
  const conditions = (reading.conditions ?? []).filter(rowAnswered);

  /* ONE ANSWER, AS ROWS. Ticked values are an `eq` row — several picks in one
     field join with OR, so `in` — a range is a `between`, and a typed op is a
     row of its own. Whatever answered it, the compiler below sees rows.
     TRAP T-one-condition-system */
  const ends = values.filter((v) => v.state === 'picked').map((v) => v.raw);
  const rows: FieldCondition[] = conditions.length ? [...conditions]
    : !answered ? []
      : takesText ? [{ op, text }]
        : [{ op: range && ends.length >= 2 ? 'between' : op, picked: ends }];
  const custom = conditions.length > 0 || op !== DEFAULT_OP;

  return {
    field: facts.field,
    label: facts.label ?? facts.field,
    fieldState: !rows.length ? 'off' : reading.suspended ? 'suspended' : 'active',
    op,
    text,
    conditions,
    type,
    range,
    values,
    condition: !rows.length ? null : custom ? 'custom' : 'default',
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
 * is custom, its ticks or ends when it is default. Nothing when it has no answer.
 * TRAP T-a-saved-filter-is-its-readings
 */
export function savedReading(state: FilterState): FieldReading | undefined {
  if (!state.rows.length) return undefined;
  if (state.condition === 'custom') return { conditions: state.rows.map((row) => ({ ...row })) };
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
 * TWO ends are a `between`; one is a plain comparison. A number is compared as
 * a NUMBER — sorting `["1000","9"]` as text puts 1000 first and the range then
 * matches nothing. TRAP T-the-field-type-decides-the-clause
 */
function rangeClause(
  field: string, type: FieldType, picked: readonly unknown[], op: FilterOp,
): Filter | undefined {
  if (!picked.length) return undefined;
  const numeric = type === 'number';
  const ends = numeric ? picked.map(Number) : picked.map(String);
  if (ends.length >= 2) {
    const sorted = numeric
      ? (ends as number[]).slice().sort((a, b) => a - b)
      : (ends as string[]).slice().sort();
    return [field, 'between', [sorted[0], sorted[sorted.length - 1]]];
  }
  /* ONE end is whatever the reader asked — `eq` by default, but a `gt` or an
     `lte` from a condition row means exactly that. */
  return [field, op, ends[0]];
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
  const takes = OP_TAKES[row.op] ?? 'list';
  if (takes === 'text') {
    const text = (row.text ?? '').trim();
    return text ? [state.field, row.op, cast([text], state.type)[0]] as FilterClause : undefined;
  }
  const picked = [...(row.picked ?? [])];
  if (takes === 'range') return rangeClause(state.field, state.type, picked, row.op);
  return picksClause(state.field, cast(picked, state.type), row.op);
}

/** A held CLAUSE op as a reader's ROW op: several `eq` picks are `in`. */
const ROW_OPS: Readonly<Record<string, FilterOp>> = { in: 'eq', notin: 'ne' };

/** One clause leaf as a row, or undefined when it is not one. */
function leafRow(leaf: Filter): FieldCondition | undefined {
  if (!Array.isArray(leaf) || typeof leaf[0] !== 'string' || leaf[0] === 'and' || leaf[0] === 'or') {
    return undefined;
  }
  const [, clauseOp, value] = leaf as FilterClause;
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
