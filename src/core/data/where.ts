/**
 * where.ts — ONE way to write a filter condition in a definition or a View:
 * `{ openTickets: { gt: 0 } }`, numbers as numbers. Readings stay inside.
 * DOM-free. TRAP T-one-way-to-write-a-condition
 *
 * Map:
 * - Condition — One field's condition, as a definition or a View writes it.
 * - Where — Each field's condition, by field.
 * - whereOf — Readings in the plain form: what each field filters by, nothing a control keeps for itself.
 * - readingsOf — The plain form as readings; a reading saved before TODO 197 passes as it was.
 */
import {
  clauseConditions, fieldState, isRanged, stateClause,
  type FieldCondition, type FieldFacts, type FieldReading, type FieldType,
} from './filter-state.js';
import { DEFAULT_OP, OP_TAKES, type Filter, type FilterOp } from './store.js';
import { report } from './report.js';

/** One field's condition, as a definition or a View writes it. Several ops
 *  all hold; `and` and `or` take a list. */
export type Condition = { [op in FilterOp]?: unknown } & {
  and?: readonly Condition[];
  or?: readonly Condition[];
  /** Kept, not applied: off is not gone. */
  off?: boolean;
};

/** Each field's condition, by field. */
export type Where = Record<string, Condition>;

type Facts = (field: string) => Omit<FieldFacts, 'field'>;

/** A reading's own keys. None is an op, so one field's two forms never meet. */
const READING_KEYS = new Set([
  'picked', 'present', 'op', 'text', 'conditions', 'mode', 'mirror', 'range', 'kept', 'suspended',
]);

/** Readings in the plain form: what each field filters by, nothing a control keeps for itself. */
export function whereOf(readings: Readonly<Record<string, FieldReading>>, facts?: Facts): Where {
  const where: Where = {};
  for (const [field, reading] of Object.entries(readings)) {
    // The clause the field compiles to IS its condition, so the two cannot disagree.
    const clause = stateClause(fieldState({ field, ...facts?.(field) }, { ...reading, suspended: false }));
    if (clause) where[field] = { ...conditionOf(clause), ...(reading.suspended ? { off: true } : {}) };
  }
  return where;
}

/** The plain form as readings; a reading saved before TODO 197 passes as it was. */
export function readingsOf(
  where: Readonly<Record<string, Condition | FieldReading>>, facts?: Facts,
): Record<string, FieldReading> {
  const readings: Record<string, FieldReading> = {};
  for (const [field, given] of Object.entries(where)) {
    const reading = readingOf(field, given, facts?.(field).type);
    if (reading) readings[field] = reading;
  }
  return readings;
}

function readingOf(field: string, given: Condition | FieldReading, type?: FieldType): FieldReading | undefined {
  if (Object.keys(given).some((key) => READING_KEYS.has(key))) return given as FieldReading;
  const { off, ...condition } = given as Condition;
  const clause = clauseOf(field, condition);
  const rows = clause ? clauseConditions(clause) : [];
  if (!rows) {
    report({
      code: 'unreadable-condition',
      message: `where: the condition on "${field}" has an "or" inside an "and", which condition rows cannot show, so it filters nothing.`,
      at: { field, condition: JSON.stringify(given) },
    });
    return undefined;
  }
  const reading = rows.length === 1 ? rowReading(rows[0]!, type) : rows.length ? { conditions: rows } : {};
  return off ? { ...reading, suspended: true } : reading;
}

/** One row as the reading a Simple control would hold. */
function rowReading(row: FieldCondition, type?: FieldType): FieldReading {
  if (row.op === 'between') return { picked: [...(row.picked ?? [])], range: true };
  if (OP_TAKES[row.op] === 'text') return { op: row.op, text: row.text ?? '' };
  const picked = [...(row.picked ?? [])];
  // Several values on a number or a date are a LIST here, not two ends.
  return {
    ...(row.op === DEFAULT_OP ? {} : { op: row.op }), picked,
    ...(picked.length > 1 && isRanged(type) ? { range: false } : {}),
  };
}

/** A clause, written as a condition. */
function conditionOf(filter: Filter): Condition {
  const [head, ...rest] = filter as unknown[];
  if (head === 'or') return { or: (rest as Filter[]).map(conditionOf) };
  if (head === 'and') {
    const parts = (rest as Filter[]).map(conditionOf);
    const one: Record<string, unknown> = {};
    for (const part of parts) {
      for (const [op, value] of Object.entries(part)) {
        // The same op twice, or a group, cannot share one object.
        if (op in one || !(op in OP_TAKES)) return { and: parts };
        one[op] = value;
      }
    }
    return one as Condition;
  }
  const [, op, value] = filter as [string, FilterOp, unknown];
  return { [op]: value } as Condition;
}

/** A condition, as the clause it says. Several ops join with `and`. */
function clauseOf(field: string, condition: Condition): Filter | undefined {
  const parts: Filter[] = [];
  for (const [key, value] of Object.entries(condition)) {
    if (key === 'and' || key === 'or') {
      const each = (Array.isArray(value) ? value as Condition[] : [])
        .map((c) => clauseOf(field, c)).filter((c): c is Filter => !!c);
      const flat = each.flatMap((c) => (c[0] === key ? (c.slice(1) as Filter[]) : [c]));
      if (flat.length) parts.push(flat.length === 1 ? flat[0]! : ([key, ...flat] as Filter));
    } else if (key in OP_TAKES) {
      parts.push([field, key as FilterOp, value]);
    } else {
      report({
        code: 'unknown-op',
        message: `where: "${key}" on "${field}" is not an op, so it is left out.`,
        at: { field, op: key },
      });
    }
  }
  const flat = parts.flatMap((c) => (c[0] === 'and' ? (c.slice(1) as Filter[]) : [c]));
  return flat.length > 1 ? (['and', ...flat] as Filter) : flat[0];
}
