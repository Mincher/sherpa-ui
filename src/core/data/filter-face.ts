/**
 * filter-face.ts — WHAT A CONTROL SHOWS for a field.
 *
 * The other half of `filter-state.ts`: that file works out what a field IS
 * doing, this one turns it into the six facts a chip, a legend or a tab strip
 * draws — a badge, a value, a tooltip. None of them works any of it out.
 *
 * DOM-free, like everything in this folder.
 *
 * TRAP T-one-state-per-filtered-field
 *
 * Map:
 * - FilterFace — What a control SHOWS for a field — the same six facts whatever draws them.
 * - ALL — What a list with every value ticked says: the chip's face, and the Query graph's test for it.
 * - filterFace — How one field's state READS, for any control that draws it.
 * - CONDITION_BADGE — The ONE mark a control wears when conditions are applied.
 * - countSaid — A count as a badge shows it and its name says it: `1,204`, and `1,204 results`.
 * - spellConditions — An answer's tree as it reads: `equals(John) AND !(contains(Smith) OR …)`.
 */
import {
  DATE_OP_LABELS, DEFAULT_OP, OP_LABELS, OP_TAKES, conditionLeaves, groupOf, valueKey,
  type Condition, type ConditionLeaf, type Duration, type FilterOp,
} from './store.js';
import { formatDate } from './format-date.js';
import type { FilterState } from './filter-state.js';

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
  /** The tooltip: every value, or for conditions how many apply. */
  tip: string;
}

/** What a list with every value ticked says: the chip's face, and the Query graph's test for it. */
export const ALL = 'All';

/**
 * How one field's state READS, for any control that draws it. `eq` shows no
 * badge — a mark on every ordinary control is noise.
 * TRAP T-one-state-per-filtered-field
 */
export function filterFace(state: FilterState): FilterFace {
  /* The answer IN FORCE: Advanced speaks for its first condition, Simple for its
     picks — the two can differ now both are kept. TRAP T-both-answers-are-kept */
  const first = state.mode === 'advanced' ? conditionLeaves(state.answer)[0] : undefined;
  const lead = first && wordsOf(first);
  const op = lead?.op ?? state.op;
  const text = lead ? (lead.text ?? '') : state.text;
  const labelOf = new Map(state.values.map((v) => [v.value, v.label]));
  const picks = lead
    ? (lead.picked ?? []).map((v) => labelOf.get(valueKey(v)) ?? String(v))
    : state.values.some((v) => v.parent) ? byParent(state.values)
      : state.values.filter((v) => v.state === 'picked').map((v) => v.label);
  const named = op !== DEFAULT_OP;
  const condition = named ? opName(op, state.type === 'date') : '';
  const typed = (OP_TAKES[op] ?? 'list') === 'text';

  /* TWO ENDS read as a range, and a DAY as a day — the one way every control
     says them. TRAP T-a-date-reads-one-way · TRAP T-date-label-reads-in-full
     TRAP T-a-chip-says-its-own-answer */
  // …and so does an Advanced Between or Not between row. TODO 375
  const rangeRow = !!lead && (OP_TAKES[lead.op] ?? 'list') === 'range';
  const dated = state.type === 'date' && (!lead || rangeRow);
  const ends = !typed && (state.range || rangeRow) && picks.length === 2;
  const span = ends ? (dated ? formatDate(picks[0]!, picks[1]) : `${picks[0]} to ${picks[1]}`) : '';
  const said = state.type === 'date' ? picks.map((day) => formatDate(day)) : picks;

  const typedSaid = typed ? sayTyped(lead ?? { op, text }, state.type === 'date') : '';
  // ALL reads as All: every value, on. Will, TODO 489 · TRAP T-all-is-an-answer
  const every = !!state.all;
  const value = typed ? typedSaid : every ? ALL : span || (said.length > 1 ? `${said[0]}…` : (said[0] ?? ''));
  const spelled = typed ? typedSaid : every ? ALL : span || said.join(', ');

  /* AN ADVANCED ANSWER reads as its conditions, on the face and in the tip:
     `equals(John) AND !contains(Smith)`. Will, TODO 409.
     TRAP T-an-advanced-answer-reads-as-its-conditions */
  const advanced = state.condition === 'advanced' ? spellConditions(state) : '';

  return {
    current: state.fieldState === 'active',
    /* `fx` — the mark says an ADVANCED condition is applied, and the tip says
       how many. Read from the state's own type, which the chip's green reads
       too. TRAP T-a-condition-badge-says-that-not-which · TRAP T-one-condition-system */
    badge: state.condition === 'advanced' ? CONDITION_BADGE : '',
    condition: advanced ? '' : condition,
    value: advanced || value,
    count: picks.length,
    tip: advanced || (condition && spelled ? `${condition}: ${spelled}` : (spelled || condition)),
  };
}

/** A tiered field's picks, by parent: a whole one by its name, one with some
 *  children picked as `Northwind: London, Leeds` (Will, 369 Q3). */
function byParent(values: FilterState['values']): string[] {
  const whole = new Set(values.filter((v) => !v.parent && v.state === 'picked').map((v) => v.value));
  const some = Map.groupBy(values.filter((v) => v.parent && v.state === 'picked' && !whole.has(v.parent)), (v) => v.parent!);
  return values.filter((v) => !v.parent && (whole.has(v.value) || some.has(v.value)))
    .map((v) => (whole.has(v.value) ? v.label : `${v.label}: ${some.get(v.value)!.map((k) => k.label).join(', ')}`));
}

/** The ONE mark a control wears when conditions are applied. */
export const CONDITION_BADGE = 'fx';

/** A count in the reader's own digits. */
const COUNT = new Intl.NumberFormat();

/** A count as a badge shows it and its name says it: `1,204`, and `1,204 results`.
 *  `n === 1`, not plural rules: those follow the locale and would change the English. */
export function countSaid(n: number, noun: readonly [one: string, many: string] = ['result', 'results']): { said: string; label: string } {
  const said = COUNT.format(n);
  return { said, label: `${said} ${n === 1 ? noun[0] : noun[1]}` };
}

/** An op's name in its field's words: a date is On, Before or After. TODO 21d */
function opName(op: FilterOp, dated: boolean): string {
  return (dated ? DATE_OP_LABELS[op] : undefined) ?? OP_LABELS[op] ?? op;
}

/** One condition as a face reads it: its op as a reader picks it — several picks
 *  are Equals — and what was typed, or picked. */
interface Words {
  op: FilterOp;
  text?: string;
  unit?: Duration['unit'];
  picked?: readonly unknown[];
}

/** A leaf in a face's words. */
function wordsOf({ op, value }: ConditionLeaf): Words {
  if (op === 'last' || op === 'next') {
    const { n, unit } = (value ?? {}) as Partial<Duration>;
    return { op, text: String(n ?? ''), ...(unit ? { unit } : {}) };
  }
  if ((OP_TAKES[op] ?? 'list') === 'text') return { op, text: String(value ?? '') };
  const picked = Array.isArray(value) ? value : [value];
  return { op: op === 'in' ? 'eq' : op === 'notin' ? 'ne' : op, picked };
}

/** A TYPED answer as it reads: a day as a day, a count with what it counts. */
function sayTyped(row: Pick<Words, 'op' | 'text' | 'unit'>, dated: boolean): string {
  const text = (row.text ?? '').trim();
  if (!text) return '';
  if (row.op === 'last' || row.op === 'next') {
    const unit = row.unit ?? 'day';
    return `${text} ${unit}${Number(text) === 1 ? '' : 's'}`;
  }
  return dated ? formatDate(text) : text;
}

/** Each condition's word, as it reads before its value: `equals(John)`. Will, TODO 409 */
const OP_WORDS: Record<FilterOp, string> = {
  eq: 'equals', ne: 'equals', in: 'equals', notin: 'equals',
  lt: 'lessThan', lte: 'atMost', gt: 'greaterThan', gte: 'atLeast',
  contains: 'contains', notcontains: 'contains', startswith: 'startsWith', endswith: 'endsWith',
  between: 'between', notbetween: 'between', last: 'last', next: 'next',
};
/** …and a date's: a day is on, before or after. */
const DATE_OP_WORDS: Partial<Record<FilterOp, string>> = { eq: 'on', lt: 'before', gt: 'after' };
/** The NEGATIVE conditions: `!` and the positive word. */
const NEGATIVE = new Set<FilterOp>(['ne', 'notin', 'notcontains', 'notbetween']);

/**
 * An answer's TREE as it reads — each condition's word, its value in brackets,
 * the join between, `!` before a negative one: `equals(John) AND !contains(Smith)`.
 * It reads left to right, as rows do; a group after the first is bracketed:
 * `equals(A) OR (greaterThan(5) AND lessThan(9))`. The chip's value, its tip and
 * a grid heading's. Will, TODO 409. TRAP T-a-condition-badge-says-that-not-which
 */
export function spellConditions(state: Pick<FilterState, 'type' | 'values' | 'answer'>): string {
  const dated = state.type === 'date';
  const labelOf = new Map(state.values.map((v) => [v.value, v.label]));
  const part = (leaf: ConditionLeaf): string => {
    const row = wordsOf(leaf);
    const word = `${NEGATIVE.has(leaf.op) ? '!' : ''}${(dated ? DATE_OP_WORDS[row.op] : undefined) ?? OP_WORDS[row.op] ?? row.op}`;
    const said = (OP_TAKES[row.op] ?? 'list') === 'text'
      ? sayTyped(row, dated)
      : (row.picked ?? []).map((v) => (dated ? formatDate(String(v)) : labelOf.get(valueKey(v)) ?? String(v))).join(', ');
    return `${word}(${said})`;
  };
  const spell = (tree: Condition): string => {
    const parts = groupOf(tree);
    if (!parts) return part(tree as ConditionLeaf);
    // A part kept off says nothing, as it filters nothing.
    const [join, each] = [parts[0], parts[1].filter((p) => !p.off)];
    return each.map((p, i) => (i && groupOf(p) ? `(${spell(p)})` : spell(p))).join(` ${join.toUpperCase()} `);
  };
  return state.answer && !state.answer.off ? spell(state.answer) : '';
}
