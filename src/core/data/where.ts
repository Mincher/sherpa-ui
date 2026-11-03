/**
 * where.ts — ONE way to write a filter condition in a definition or a View:
 * `{ openTickets: { gt: 0 } }`, numbers as numbers — sugar for the condition
 * tree, parsed ONCE. Readings stay inside. DOM-free.
 * TRAP T-one-way-to-write-a-condition · TRAP T-one-condition-tree
 *
 * Map:
 * - WhereCondition — One field's condition, as a definition or a View writes it.
 * - Where — Each field's condition, by field.
 * - parseWhere — The plain form as ONE tree, each leaf naming its field: every field's condition holds.
 * - treeReading — One field's tree as the reading a control holds: Simple's where a Simple control says it, else Advanced's.
 * - whereOf — Readings in the plain form: what each field filters by, nothing a control keeps for itself.
 * - readingsOf — The plain form as readings, each value typed by its field.
 */
import { fieldState, isRanged, typedTree, type FieldFacts, type FieldReading, type FieldType } from './filter-state.js';
import { OP_TAKES, groupOf, joinConditions, type Condition, type ConditionLeaf, type Duration, type FilterOp } from './store.js';
import { report } from './report.js';

/** One field's condition, as a definition or a View writes it. Several ops
 *  all hold; `and` and `or` take a list, nested as deep as it says. */
export type WhereCondition = { [op in FilterOp]?: unknown } & {
  and?: readonly WhereCondition[];
  or?: readonly WhereCondition[];
  /** What `last` or `next` counts: `{ last: 7, unit: 'day' }`. Default `day`. */
  unit?: Duration['unit'];
  /** Kept, not applied: off is not gone. */
  off?: boolean;
  /** Every value, on purpose — Select all on: `{ region: { all: true } }`. TRAP T-all-is-an-answer */
  all?: boolean;
};

/** Each field's condition, by field. */
export type Where = Record<string, WhereCondition>;

type Facts = (field: string) => Omit<FieldFacts, 'field'>;

/** One leaf, naming its field where one is given. */
function leaf(field: string | undefined, op: FilterOp, value: unknown): ConditionLeaf {
  return field ? { field, op, value } : { op, value };
}

/** One field's plain condition as its tree: several ops join with `and`. */
function fieldTree(given: WhereCondition, field?: string): Condition | undefined {
  const parts: (Condition | undefined)[] = [];
  for (const [key, value] of Object.entries(given)) {
    if (key === 'and' || key === 'or') {
      parts.push(joinConditions(key, (Array.isArray(value) ? value as WhereCondition[] : []).map((c) => fieldTree(c, field))));
    } else if (key === 'last' || key === 'next') {
      parts.push(leaf(field, key, { n: Number(value), unit: given.unit ?? 'day' }));
    } else if (key === 'unit' || key === 'off' || key === 'all') {
      // How it holds, not what: said with its op, or by the reading.
    } else if (key in OP_TAKES) {
      parts.push(leaf(field, key as FilterOp, value));
    } else {
      report({
        code: 'unknown-op',
        message: `where: "${key}"${field ? ` on "${field}"` : ''} is not an op, so it is left out.`,
        at: { ...(field ? { field } : {}), op: key },
      });
    }
  }
  const tree = joinConditions('and', parts);
  return tree && given.off ? { ...tree, off: true } : tree;
}

/** The plain form as ONE tree, each leaf naming its field: every field's
 *  condition holds. Parsed once — a status value's `when`. */
export function parseWhere(where: Readonly<Where>): Condition | undefined {
  return joinConditions('and', Object.entries(where).map(([field, given]) => fieldTree(given, field)));
}

/** A tree whose leaves name no field: one field's own answer. */
function bare(tree: Condition): Condition {
  const parts = groupOf(tree);
  if (parts) return { ...tree, [parts[0]]: parts[1].map(bare) } as Condition;
  const { field: _field, ...own } = tree as ConditionLeaf;
  return own;
}

/**
 * One field's tree as the reading a control holds: Simple's where a Simple
 * control says it — a list's picks, a date's two ends, a number's or a date's
 * one value under its op — else Advanced's, whole. TODO 523
 * TRAP T-a-heading-holds-a-whole-reading
 */
export function treeReading(given: Condition, type?: FieldType): FieldReading {
  const tree = bare(given);
  const advanced: FieldReading = { tree, mode: 'advanced' };
  if (groupOf(tree) || tree.off) return advanced;
  const { op, value } = tree as ConditionLeaf;
  const list = Array.isArray(value) ? [...value] : [value];
  // A date from today, and Not between, have no Simple answer. TRAP T-a-relative-date-stays-relative
  if (op === 'last' || op === 'next' || op === 'notbetween') return advanced;
  // A date's range is its Simple answer; a number's is an Advanced row. TODO 375
  if (op === 'between') return type === 'date' ? { picked: list, range: true } : advanced;
  // Several values on a number or a date are a LIST here, not two ends.
  if (op === 'eq' || op === 'in') return { picked: list, ...(list.length > 1 && isRanged(type) ? { range: false } : {}) };
  // A list's other ops are conditions; a number's body, or a date's, holds one under its op.
  if (type !== 'number' && type !== 'date') return advanced;
  if (OP_TAKES[op] === 'text') return { op, text: String(value ?? '') };
  return { op: op === 'notin' ? 'ne' : op, picked: list };
}

/** A field's tree in the plain form: distinct ops share one object. */
function sugarOf(tree: Condition): WhereCondition {
  const off = tree.off ? { off: true } : {};
  const parts = groupOf(tree);
  if (!parts) {
    const { op, value } = tree as ConditionLeaf;
    if (op !== 'last' && op !== 'next') return { [op]: value, ...off };
    const { n, unit } = value as Duration;
    return { [op]: n, ...(unit === 'day' ? {} : { unit }), ...off };
  }
  const [join, each] = parts;
  const said = each.map(sugarOf);
  if (join === 'or' || tree.off) return { [join]: said, ...off };
  const one: Record<string, unknown> = {};
  for (const part of said) {
    for (const [op, value] of Object.entries(part)) {
      // The same op twice, or a group, cannot share one object.
      if (op in one || !(op in OP_TAKES)) return { and: said };
      one[op] = value;
    }
  }
  return one as WhereCondition;
}

/** Readings in the plain form: what each field filters by, nothing a control keeps for itself. */
export function whereOf(readings: Readonly<Record<string, FieldReading>>, facts?: Facts): Where {
  const where: Where = {};
  for (const [field, reading] of Object.entries(readings)) {
    // The answer the field compiles from IS its condition, so the two cannot disagree.
    const state = fieldState({ field, ...facts?.(field) }, { ...reading, suspended: false });
    // ALL filters nothing, so it says nothing: a start puts it back. TRAP T-all-is-an-answer
    if (state.fieldState !== 'active') continue;
    const tree = joinConditions('and', [state.answer, ...state.held ?? []]);
    if (tree) where[field] = { ...sugarOf(tree), ...(reading.suspended ? { off: true } : {}) };
  }
  return where;
}

/** The plain form as readings, each value typed by its field. */
export function readingsOf(
  where: Readonly<Record<string, WhereCondition>>, facts?: Facts,
): Record<string, FieldReading> {
  const readings: Record<string, FieldReading> = {};
  for (const [field, given] of Object.entries(where)) {
    const { off, all, ...condition } = given;
    const kept = off ? { suspended: true } : {};
    if (all) {
      readings[field] = { picked: [], all: true, ...kept };
      continue;
    }
    // `in: []` is nothing picked: it filters nothing. Will, TODO 550
    if (Array.isArray(condition.in) && !condition.in.length && Object.keys(condition).length === 1) {
      readings[field] = { picked: [], ...kept };
      continue;
    }
    // Typed once, by its field, as it comes in. TRAP T-a-value-is-typed-once
    const type = facts?.(field).type;
    const tree = fieldTree(condition);
    readings[field] = { ...(tree ? treeReading(typedTree(tree, type), type) : {}), ...kept };
  }
  return readings;
}
