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
  DEFAULT_OP, OP_LABELS, OP_TAKES,
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

/**
 * What a control SHOWS for a field — the same six facts whatever draws them.
 * A chip uses `badge` and `value`; a legend uses `current` per row. None of
 * them works any of it out.
 */
export interface FilterFace {
  /** Is this control ON — narrowing, selected, active. */
  current: boolean;
  /**
   * ONE mark, saying only "conditions are applied" — never WHICH condition.
   *
   * A per-op sign cannot say anything true about a field holding three chained
   * rows, and a badge that reads `=` over `A or B and C` is worse than none.
   * TRAP T-a-condition-badge-says-that-not-which
   */
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
 * How one field's state READS, for any control that draws it. `eq` shows no
 * badge — a mark on every ordinary control is noise.
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

  /* Many rows say their own story; one row falls back to the old wording. */
  const chained = state.conditions.length > 1 ? spellConditions(state) : '';

  return {
    current: state.fieldState === 'active',
    /* `fx` — the mark says conditions are applied, and the tip says which.
       TRAP T-a-condition-badge-says-that-not-which */
    badge: (named || state.conditions.length) ? CONDITION_BADGE : '',
    condition: chained || condition,
    value: chained ? chained : value,
    count: picks.length,
    tip: chained || (condition && spelled ? `${condition}: ${spelled}` : (spelled || condition)),
  };
}

/** The ONE mark a control wears when conditions are applied. */
export const CONDITION_BADGE = 'fx';

/**
 * Chained rows, in words: `Contains "ab" or Equals cd`.
 *
 * The badge cannot carry this, so the tip must. TRAP T-a-condition-badge-says-that-not-which
 */
export function spellConditions(state: FilterState): string {
  const part = (row: FieldCondition): string => {
    const name = OP_LABELS[row.op] ?? row.op;
    const said = (OP_TAKES[row.op] ?? 'list') === 'text'
      ? (row.text ?? '')
      : (row.picked ?? []).map(String).join(', ');
    return said ? `${name}: ${said}` : name;
  };
  return state.conditions
    .map((row, i) => (i ? `${row.join === 'or' ? 'or' : 'and'} ${part(row)}` : part(row)))
    .join(' ');
}

/* ── Binding a control to a field ──────────────────────────────────────── */

/**
 * Enough of a DataSource to own a FIELD's selection. Not `contribute`: keyed
 * by WRITER, two controls over one field both reach the query.
 * TRAP T-one-field-one-filter-menu
 */
export interface Selector extends EventTarget {
  select: (field: string, picked: readonly unknown[]) => void;
  selection: (field: string) => FilterState;
  declareValues: (field: string, values: readonly unknown[]) => void;
  /** A COMPONENT-scope control needs this; a VIEW-scope one does not. */
  contribute?: (key: string, filter: FilterClause | undefined) => void;
}

/** How one control reads and draws a field. */
export interface SelectionBinding<T> {
  /** The field the control is over. */
  field: string;
  /** Every value it offers, in the order it draws them. */
  values: readonly string[];
  /** What the CONTROL currently says is picked. Read it, never the event —
   *  a roll-up row stands for several values and its label is a value of none. */
  read: (control: T) => readonly string[];
  /** Put the source's answer on the control. */
  draw: (control: T, picked: readonly string[]) => void;
  /** The control's own event, when it wants a change. */
  event: string;
  /**
   * How far this control's answer reaches. `view` (the default) writes the
   * FIELD's one selection, which every control over that field then shows.
   * `component` narrows only what this control draws: it is ANDed under the
   * view's answer, so it can never widen past it and never touches the view's
   * own state. A legend, a chart's segment mode and a grid column filter are
   * all `component`. TRAP T-a-filter-applies-down-its-scope
   */
  scope?: 'view' | 'component';
  /**
   * The part name a `component` binding owns. Two components over one field
   * need two names, or the second silently replaces the first. Defaults to
   * `scope:<field>`, which is right only when there is ONE such control.
   */
  key?: string;
  /** Drop the wiring when this aborts. TRAP T-signal-not-a-teardown-list */
  signal?: AbortSignal;
}

/** What a binding hands back. */
export interface BoundSelection {
  /** This field, as every other control reports it. */
  readonly state: FilterState;
  /** Drive it from elsewhere — a saved view, a preset. */
  set: (picked: Iterable<string>) => void;
  destroy: () => void;
}

/**
 * Join a control to a FIELD on a source — the loop every control needs, once:
 * declare the values, draw what the source says, write what the reader does,
 * re-draw when anyone else changes the field. No control hears about another.
 * TRAP T-one-field-one-filter-menu
 */
export function bindSelection<T extends EventTarget>(
  control: T,
  source: Selector,
  options: SelectionBinding<T>,
): BoundSelection {
  const { field, values, read, draw, event, signal } = options;
  const known = new Set(values);
  const scope = options.scope ?? 'view';
  const key = options.key ?? `scope:${field}`;
  source.declareValues(field, values);

  /* A component-scope binding needs a source that can hold a named part. The
     alternative — falling back to select() — is the exact clobber this scope
     exists to prevent, so it fails loudly instead.
     TRAP T-a-filter-applies-down-its-scope */
  if (scope === 'component' && typeof source.contribute !== 'function') {
    throw new TypeError(
      `bindSelection: scope "component" needs a source with contribute(); "${field}" got one without.`,
    );
  }

  /** This binding's OWN answer, for a component scope. Empty is no constraint. */
  let own: string[] = [];

  /**
   * What this control draws. A VIEW binding shows the field's one selection, so
   * every control over it agrees. A COMPONENT binding shows its OWN answer —
   * the view's is a different, wider question and drawing it here would say the
   * reader had picked something they did not.
   */
  const picked = (): string[] => (scope === 'component'
    ? own
    : source.selection(field).values.filter((v) => v.state === 'picked').map((v) => v.value));

  const redraw = (): void => { draw(control, picked()); };

  /** Write what the control now says. One that REFUSES a change never reports
   *  it — its own floors are the component's concern. */
  const write = (next: readonly string[]): void => {
    const want = next.filter((v) => known.has(v));
    // EVERYTHING picked is no constraint. TRAP T-everything-on-is-no-filter
    const answer = want.length === values.length ? [] : want;
    if (scope === 'component') {
      own = [...answer];
      // ANDed under the view's, so it can only narrow further.
      source.contribute!(key, answer.length ? [field, 'in', answer] : undefined);
      /* Draw its OWN answer back. `selection-change` never fires for a part —
         it is not a field selection — so without this a control driven by
         `set()` keeps showing whatever it was last drawn with. */
      redraw();
      return;
    }
    source.select(field, answer);
  };

  const onControlChange = (): void => { write(read(control)); };
  const onSelectionChange = (e: Event): void => {
    if ((e as CustomEvent<{ field: string }>).detail?.field !== field) return;
    redraw();
  };


  control.addEventListener(event, onControlChange);
  source.addEventListener('selection-change', onSelectionChange);
  redraw();

  const destroy = (): void => {
    control.removeEventListener(event, onControlChange);
    source.removeEventListener('selection-change', onSelectionChange);
    // A part outlives its control otherwise, and nothing else can name it.
    if (scope === 'component') source.contribute!(key, undefined);
  };
  signal?.addEventListener('abort', destroy, { once: true });

  return {
    get state(): FilterState { return source.selection(field); },
    set(next: Iterable<string>): void { write([...next]); },
    destroy,
  };
}
