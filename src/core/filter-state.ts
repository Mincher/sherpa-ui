/**
 * filter-state.ts — ONE state per field, for every control that draws it.
 *
 * A field is drawn in several places at once, and each control used to WORK
 * OUT what it showed, so the same field could read several ways at once.
 *
 * This is the one answer they all read:
 *
 *     field        which field
 *     fieldState   is it narrowing anything, and how
 *     values       every value the field HAS
 *     valueStates  what each value is doing
 *
 * NOT ONLY FILTERS. The same four facts describe any control over a set of
 * values: a tab strip, a nav, a chart legend, a select group, a transfer
 * list, a calendar's days. Nineteen components hold selection state, and the
 * question is the same in all of them — which values exist, which are chosen,
 * and which cannot be chosen right now. `stateClause()` is the only part that
 * speaks filters; the rest is selection.
 *
 * Nothing here touches the DOM. It is the rule, not the wiring.
 *
 * TRAP T-one-state-per-filtered-field
 */
import {
  DEFAULT_OP, OP_LABELS, OP_SYMBOLS, OP_TAKES,
  picksClause, valueSet,
  type FilterClause, type FilterOp,
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
  value: string;
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
  /** EVERY value the field has — never only the reachable ones. */
  values: ValueEntry[];
}

/** What a caller knows about a field before anything is chosen. */
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
  /* The QUERY's comparison, not an exact one — a chip's option values may be
     spelled differently from the data. `valueSet` is that rule, and writing a
     third copy here is how the two drift.
     TRAP T-one-comparison-rule-for-query-and-ui */
  const picked = valueSet(reading.picked ?? []);
  // No `present` given means "everything is reachable", not "nothing is".
  const present = reading.present ? valueSet(reading.present) : null;
  const op = reading.op ?? DEFAULT_OP;
  const text = (reading.text ?? '').trim();

  const values: ValueEntry[] = all.map((value) => ({
    value,
    label: facts.labels?.[value] ?? value,
    state: picked.has(value)
      ? 'picked'
      : present && !present.has(value)
        ? 'unavailable'
        : 'unpicked',
  }));

  /* A TYPED condition filters with nothing ticked, and EVERYTHING ticked
     filters nothing — the same rows as no filter at all, so only one of them
     should look like a filter.
     TRAP T-everything-on-is-no-filter */
  const takesText = (OP_TAKES[op] ?? 'list') === 'text';
  const chosen = values.filter((v) => v.state === 'picked').length;
  const answered = takesText ? text !== '' : chosen > 0 && chosen < all.length;

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

  // ONE rule for picks → a clause, in store.ts beside the grammar it speaks.
  return picksClause(
    state.field,
    state.values.filter((v) => v.state === 'picked').map((v) => v.value),
    state.op,
  );
}

/**
 * What a control SHOWS for a field — the same six facts whatever draws them.
 *
 * A chip puts `badge` in its count and `value` in its caret; a tab strip might
 * use `value` alone; a legend uses `current` per row. None of them works any
 * of it out.
 */
export interface FilterFace {
  /** Is this control ON — narrowing, selected, active. */
  current: boolean;
  /** The condition's SIGN, where a control has room for one. '' for the default. */
  badge: string;
  /** The same condition in WORDS, for a tooltip or an accessible name. */
  condition: string;
  /** The chosen value, short: the first pick with an ellipsis, or what was typed. */
  value: string;
  /** How many values are chosen. */
  count: number;
  /** The whole truth, spelled out: the condition and every value. */
  tip: string;
}

/**
 * How one field's state READS, in one place, for any control that draws it.
 *
 * `eq` never shows a badge: it is the default, and a mark on every ordinary
 * control is noise.
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
