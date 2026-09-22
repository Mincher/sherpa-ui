/**
 * filter-state.ts — ONE state per filtered field.
 *
 * A field is filtered in several places at once: a chip, its menu, a column
 * heading, that heading's menu, the chip's label and badge. Each used to
 * DERIVE what it showed, so the same field could read four ways — a chip on
 * while its menu was empty, a column menu offering three values where the
 * chip offered four, a picked value spelled `gold` in one and `Gold` in the
 * other.
 *
 * This is the one answer they all read:
 *
 *     field        which column
 *     fieldState   is the field filtering, and how
 *     values       every value the field HAS
 *     valueStates  what each value is doing
 *
 * Nothing here touches the DOM. It is the rule, not the wiring.
 *
 * TRAP T-one-state-per-filtered-field
 */
import {
  DEFAULT_OP, OP_LABELS, OP_SYMBOLS, OP_TAKES,
  type Filter, type FilterClause, type FilterOp,
} from './store.js';

/** What a field's filter is doing. */
export type FieldState =
  /** No filter: every value passes. */
  | 'off'
  /** Filtering, and the reader can see by what. */
  | 'active'
  /** Remembered but not applied — off is not gone. TRAP T-grid-suspend-is-not-clear */
  | 'suspended';

/** What one value is doing inside its field. */
export type ValueState =
  /** Picked: this value is part of the filter. */
  | 'picked'
  /** Present in the data, not picked. */
  | 'unpicked'
  /** No row carries it under the OTHER filters — still selectable, dimmed. */
  | 'unavailable';

/** One value, and what it is doing. */
export interface ValueEntry {
  value: string;
  /** What a reader sees. Defaults to `value`. */
  label: string;
  state: ValueState;
}

/** Everything every control needs to draw one field's filter. */
export interface FilterState {
  field: string;
  /** What a reader calls the field. */
  label: string;
  fieldState: FieldState;
  /** The condition. `eq` unless a reader picked another. */
  op: FilterOp;
  /** What was TYPED, for a condition that takes text rather than a pick. */
  text: string;
  /** EVERY value the field has — never only the reachable ones. */
  values: ValueEntry[];
}

/** What a caller knows about a field before any filtering. */
export interface FieldFacts {
  field: string;
  label?: string;
  /** Every value the field has, over the WHOLE data — not the drawn page. */
  values?: readonly string[];
  /** A reader-facing name per value, where it differs. */
  labels?: Readonly<Record<string, string>>;
}

/** What is true right now, which decides the STATES. */
export interface FieldReading {
  /** The values a reader has picked. */
  picked?: readonly string[];
  /** The values some row still carries, under every OTHER filter. */
  present?: readonly string[];
  op?: FilterOp;
  text?: string;
  /** Remembered but not applied. TRAP T-grid-suspend-is-not-clear */
  suspended?: boolean;
}

/** Compare the way the QUERY does. TRAP T-one-comparison-rule-for-query-and-ui */
function key(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Work out one field's whole state.
 *
 * This is the ONLY place that decides whether a field is filtering, which
 * values are picked, and which are out of reach. A control that decides for
 * itself is a second answer, and the two drift.
 *
 * TRAP T-one-state-per-filtered-field
 */
export function fieldState(facts: FieldFacts, reading: FieldReading = {}): FilterState {
  const all = [...(facts.values ?? [])].map(String);
  const picked = new Set((reading.picked ?? []).map(key));
  // No `present` given means "everything is reachable", not "nothing is".
  const present = reading.present ? new Set(reading.present.map(key)) : null;
  const op = reading.op ?? DEFAULT_OP;
  const text = (reading.text ?? '').trim();

  const values: ValueEntry[] = all.map((value) => ({
    value,
    label: facts.labels?.[value] ?? value,
    state: picked.has(key(value))
      ? 'picked'
      : present && !present.has(key(value))
        ? 'unavailable'
        : 'unpicked',
  }));

  /* A TYPED condition filters with nothing ticked, and EVERYTHING ticked
     filters nothing — the same rows as no filter at all, so only one of them
     should look like a filter.
     TRAP T-everything-on-is-no-filter */
  const takesText = (OP_TAKES[op] ?? 'list') === 'text';
  const answered = takesText ? text !== '' : picked.size > 0 && picked.size < all.length;

  return {
    field: facts.field,
    label: facts.label ?? facts.field,
    fieldState: !answered ? 'off' : reading.suspended ? 'suspended' : 'active',
    op,
    text,
    values,
  };
}

/**
 * One field's state as a ready `FilterClause`, or `undefined`.
 *
 * ONE pick is `eq`; SEVERAL become `in`, because `eq` against a list can never
 * match. A suspended field contributes nothing while keeping its values.
 */
export function stateClause(state: FilterState): FilterClause | undefined {
  if (state.fieldState !== 'active') return undefined;

  if ((OP_TAKES[state.op] ?? 'list') === 'text') {
    return state.text ? [state.field, state.op, state.text] : undefined;
  }

  const picks = state.values.filter((v) => v.state === 'picked').map((v) => v.value);
  if (!picks.length) return undefined;
  if (picks.length === 1) return [state.field, state.op, picks[0]];
  return [state.field, state.op === 'ne' ? 'notin' : 'in', picks];
}

/** Several fields, ANDed — the shape a DataSource part takes. */
export function statesFilter(states: readonly FilterState[]): Filter | undefined {
  const clauses = states.map(stateClause).filter((c): c is FilterClause => !!c);
  if (!clauses.length) return undefined;
  return clauses.length === 1 ? clauses[0] : (['and', ...clauses] as Filter);
}

/** What a control shows for a field, in one shape. */
export interface FilterFace {
  /** The chip's own on/off. */
  current: boolean;
  /** The condition's SIGN, for a badge. Empty for the default. */
  badge: string;
  /** The same condition in WORDS, for a tooltip or an accessible name. */
  condition: string;
  /** What the caret reads: the value, or what was typed. */
  value: string;
  /** How many values are picked, for a count badge. */
  count: number;
  /** A tooltip: the condition and the values, spelled out. */
  tip: string;
}

/**
 * How one field's state READS — the chip's face, in one place.
 *
 * `eq` never shows a badge: it is the default, and a mark on every ordinary
 * chip is noise. A count wins over a sign when several values are picked,
 * because the caret already names the first.
 *
 * TRAP T-one-state-per-filtered-field
 */
export function filterFace(state: FilterState): FilterFace {
  const named = state.op !== DEFAULT_OP;
  const condition = named ? OP_LABELS[state.op] : '';
  const picks = state.values.filter((v) => v.state === 'picked');

  const value = (OP_TAKES[state.op] ?? 'list') === 'text'
    ? state.text
    : picks.length > 1 ? `${picks[0]!.label}…` : (picks[0]?.label ?? '');

  const spelled = (OP_TAKES[state.op] ?? 'list') === 'text'
    ? state.text
    : picks.map((p) => p.label).join(', ');

  return {
    current: state.fieldState === 'active',
    badge: named ? OP_SYMBOLS[state.op] : '',
    condition,
    value,
    count: picks.length,
    tip: condition && spelled ? `${condition}: ${spelled}` : (spelled || condition),
  };
}
