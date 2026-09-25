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
}

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

/** Does this condition row have what its op needs to narrow anything? */
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

  return {
    field: facts.field,
    label: facts.label ?? facts.field,
    fieldState: !(conditions.length ? true : answered)
      ? 'off'
      : reading.suspended ? 'suspended' : 'active',
    op,
    text,
    conditions,
    type,
    range,
    values,
  };
}

/**
 * One field's state as a ready `FilterClause`, or `undefined`.
 *
 * ONE pick is `eq`; SEVERAL become `in`, because `eq` against a list can never
 * match. A suspended field contributes nothing while keeping its values.
 */
export function stateClause(state: FilterState): Filter | undefined {
  if (state.fieldState !== 'active') return undefined;

  /* SEVERAL rows become a GROUP. A row's `join` says how it meets the one
     BEFORE it, so `[a, or b, and c]` is read left to right and becomes
     `['and', ['or', a, b], c]` — `and` binds tighter, as it does everywhere
     else. TRAP T-many-conditions-are-one-reading */
  if (state.conditions.length) return chainConditions(state);

  if ((OP_TAKES[state.op] ?? 'list') === 'text') {
    /* TYPED, and still cast. "At least 100" on a number column compares as
       TEXT otherwise — "1000" sorts below "9", so `gte "100"` misses every row
       above 99. TRAP T-the-field-type-decides-the-clause */
    return state.text
      ? [state.field, state.op, cast([state.text], state.type)[0]]
      : undefined;
  }

  /* `raw`, not `value`: the clause is tested against real ROWS.
     TRAP T-a-value-can-be-an-object */
  const picked = state.values.filter((v) => v.state === 'picked').map((v) => v.raw);
  if (state.range) return rangeClause(state.field, state.type, picked, state.op);
  /* A LIST on a number column is still typed — `eq "5"` never matches a row
     holding 5. TRAP T-the-field-type-decides-the-clause */
  return picksClause(state.field, cast(picked, state.type), state.op);
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
 * The condition rows as ONE filter, joined left to right with `and` binding
 * tighter than `or` — the precedence every other language uses, so a reader
 * who writes `A or B and C` gets `A or (B and C)`.
 */
function chainConditions(state: FilterState): Filter | undefined {
  const clause = (row: FieldCondition): Filter | undefined =>
    ((OP_TAKES[row.op] ?? 'list') === 'text'
      ? [state.field, row.op,
         cast([(row.text ?? '').trim()], state.type)[0]] as FilterClause
      : picksClause(state.field, cast([...(row.picked ?? [])], state.type), row.op));

  // Group the `and` runs first, then `or` them together.
  const runs: Filter[][] = [];
  for (const row of state.conditions) {
    const one = clause(row);
    if (!one) continue;
    if (!runs.length || row.join === 'or') runs.push([one]);
    else runs[runs.length - 1]!.push(one);
  }
  const anded = runs
    .map((run) => (run.length > 1 ? (['and', ...run] as Filter) : run[0]!))
    .filter(Boolean);
  if (!anded.length) return undefined;
  return anded.length === 1 ? anded[0]! : (['or', ...anded] as Filter);
}
