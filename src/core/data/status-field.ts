/**
 * status-field.ts — a STATUS field: each value named by conditions on a row's other
 * fields, worked out by the data — the first value that matches is the row's. A
 * store wraps another; every row it gives carries the value, and a filter on it
 * becomes conditions on the fields it reads, so a server never hears of it.
 * DOM-free. Will, plan 683 · TRAP T-a-status-is-worked-out-by-the-data
 *
 * Map:
 * - StatusValue — One value of a status field: its name, its look, and when a row has it.
 * - StatusField — A field whose value each row is given by conditions on its other fields.
 * - statusFields — A store whose rows carry each status field's value, worked out from their other fields.
 */
import { conditionClause } from './filter-state.js';
import {
  absoluteDates, andFilter, applyOptions, filterFields, filterTest, joinConditions, readField,
  type Condition, type Filter, type FilterClause, type FilterOp, type LoadOptions, type LoadResult, type Row,
  type Store, type StoreChangeDetail, type StoreChanges,
} from './store.js';
import type { FieldDomain } from './validate.js';
import { parseWhere, type Where } from './where.js';
import { wrapStore } from './wrap-store.js';

/** One value of a status field: its name, its look, and when a row has it. */
export interface StatusValue {
  value: string;
  /** Its look, a Style mode: `critical`, `warning`, `success`… */
  status?: string;
  /** When a row has it: ANY of these holds — each when ALL its fields do. None: every
   *  row the values before it left. */
  when?: readonly Where[];
}

/** A field whose value each row is given by conditions on its other fields. */
export interface StatusField {
  type: 'status';
  label?: string;
  description?: string;
  values: readonly StatusValue[];
}

/** Each operator's opposite, for "not a value before it". */
const NOT: Partial<Record<FilterOp, FilterOp>> = {
  eq: 'ne', ne: 'eq', lt: 'gte', gte: 'lt', lte: 'gt', gt: 'lte',
  in: 'notin', notin: 'in', contains: 'notcontains', notcontains: 'contains',
  between: 'notbetween', notbetween: 'between',
};
const ALWAYS: Filter = ['and'];
const NEVER: Filter = ['or'];

/** A filter's opposite, by De Morgan: a row that does not hold it. An operator with
 *  no opposite (`startswith`) cannot be said, and throws. */
function negate(filter: Filter): Filter {
  const [head, ...rest] = filter;
  if (head === 'and' || head === 'or') return [head === 'and' ? 'or' : 'and', ...(rest as Filter[]).map(negate)];
  const [field, op, value] = filter as FilterClause;
  const not = NOT[op];
  if (!not) throw new Error(`statusFields: "${op}" on ${field} has no opposite, so a value after it cannot be told apart.`);
  return [field, not, value];
}

/** Each value's `when` as ONE tree — any of its conditions — parsed once; none for
 *  a value whose conditions say nothing, which takes every row the values before it left. */
function treesOf(def: StatusField): (Condition | undefined)[] {
  return def.values.map((v) => {
    const each = (v.when ?? []).map(parseWhere);
    return each.length && each.every(Boolean) ? joinConditions('or', each) : undefined;
  });
}

/** A status field, worked out for one moment: each value's own filter, made apart
 *  from the values before it, and the fields they read. */
interface Compiled {
  field: string;
  def: StatusField;
  /** Each value's filter: its own conditions, and none of the values before it. */
  only: Filter[];
  /** A row no value takes. */
  none: Filter;
  tests: ((row: Row) => boolean)[];
  reads: string[];
}

function compile(field: string, def: StatusField, trees: readonly (Condition | undefined)[], now: Date): Compiled {
  // A value with no condition holds for every row the values before it left.
  const own = trees.map((tree) => (tree ? absoluteDates(conditionClause(tree) ?? ALWAYS, now) : ALWAYS));
  const only = own.map((f, i) => andFilter([f, ...own.slice(0, i).map(negate)]) ?? ALWAYS);
  const none = andFilter(own.map(negate)) ?? ALWAYS;
  const reads = [...new Set(own.flatMap((f) => filterFields(f)))];
  return { field, def, only, none, tests: only.map((f) => filterTest(f, now)), reads };
}

/** A store whose rows carry each status field's value, worked out from their other
 *  fields. The fields are read-only: a write that names one is refused. */
export function statusFields(store: Store, fields: Readonly<Record<string, StatusField>>): Store {
  const trees = new Map(Object.entries(fields).map(([field, def]) => [field, treesOf(def)]));
  // Checked now: a condition that cannot be negated is found before a read needs it.
  for (const [field, def] of Object.entries(fields)) compile(field, def, trees.get(field)!, new Date());
  const all = (): Compiled[] => Object.entries(fields).map(([f, def]) => compile(f, def, trees.get(f)!, new Date()));
  const named = new Set(Object.keys(fields));

  /** Each row's value, written onto the rows a read gave — copies, never the store's own. */
  const give = (rows: Row[], compiled: readonly Compiled[]): Row[] => {
    for (const row of rows) {
      for (const c of compiled) {
        const at = c.tests.findIndex((t) => t(row));
        row[c.field] = at < 0 ? null : c.def.values[at]!.value;
      }
    }
    return rows;
  };

  /** A filter with every clause on a status field said as conditions on the fields it
   *  reads: the values the clause takes, each its own filter. */
  const rewrite = (filter: Filter | undefined, compiled: readonly Compiled[]): Filter | undefined => {
    if (!filter) return filter;
    const [head, ...rest] = filter;
    if (head === 'and' || head === 'or') return [head, ...(rest as Filter[]).map((f) => rewrite(f, compiled)!)];
    const c = compiled.find((x) => x.field === head);
    if (!c) return filter;
    const takes = filterTest(filter);
    const values = c.def.values.flatMap((v, i) => (takes({ [c.field]: v.value }) ? [c.only[i]!] : []));
    if (takes({ [c.field]: null })) values.push(c.none);
    return values.length ? ['or', ...values] : NEVER;
  };

  /** The fields a read must ask for to work its status fields out. */
  const asked = (wanted: readonly string[] | undefined, compiled: readonly Compiled[]): string[] | undefined => {
    if (!wanted) return undefined;
    const reads = compiled.filter((c) => wanted.includes(c.field)).flatMap((c) => c.reads);
    return [...new Set([...wanted.filter((f) => !named.has(f)), ...reads])];
  };

  const mentions = (options: LoadOptions): boolean =>
    [...(options.sort ?? []).map((s) => s.field), options.group].some((f) => f != null && named.has(f));

  /** A change, as its rows now read: the row with its status values, and a change
   *  to a field one reads a change to it too. */
  const said = (detail: StoreChangeDetail | undefined): StoreChangeDetail | undefined => {
    if (!detail) return detail;
    const compiled = all();
    const row = detail.row ? give([{ ...detail.row }], compiled)[0] : undefined;
    const moved = detail.fields
      ? [...detail.fields, ...compiled.filter((c) => c.reads.some((r) => detail.fields!.includes(r))).map((c) => c.field)]
      : undefined;
    return { ...detail, ...(row ? { row } : {}), ...(moved ? { fields: moved } : {}) };
  };

  const refuse = (values: Row): void => {
    const field = Object.keys(values).find((f) => named.has(f));
    if (field) throw Object.assign(new Error(`${field} is worked out from other fields, so it is never written.`), { name: 'ValidationError' });
  };

  const domains: Record<string, FieldDomain> = { ...store.domains };
  for (const [field, def] of Object.entries(fields)) {
    domains[field] = {
      // Its name and line, said once with it: a page that reads the store need not say them again (plan 960 U2).
      ...(def.label ? { label: def.label } : {}), ...(def.description ? { description: def.description } : {}),
      values: def.values.map((v) => v.value),
      statuses: Object.fromEntries(def.values.flatMap((v) => (v.status ? [[v.value, v.status]] : []))),
      when: Object.fromEntries(def.values.flatMap((v, i) => (trees.get(field)![i] ? [[v.value, trees.get(field)![i]!]] : []))),
    };
  }

  /* Everything else is the store's — its capabilities, its holding — but two things
     a status field moves: a row read in place has none, and its History never names one. */
  return wrapStore(store, {
    domains,
    change: said,
    scan: undefined,
    history: undefined,
    async load(options: LoadOptions = {}): Promise<LoadResult> {
      const compiled = all();
      const filter = rewrite(options.filter, compiled);
      const fields = asked(options.fields, compiled);
      const read = { ...options, ...(filter ? { filter } : {}), ...(fields ? { fields } : {}) };
      // Its order is its own: the store cannot sort by a value it does not hold.
      if (!mentions(options)) {
        const result = await store.load(read);
        return { ...result, rows: give(result.rows, compiled) };
      }
      const { sort: _s, group: _g, skip: _k, take: _t, ...matches } = read;
      const result = await store.load(matches);
      const ordered = applyOptions(give(result.rows, compiled), { ...(options.sort ? { sort: options.sort } : {}), ...(options.group ? { group: options.group } : {}), ...(options.skip !== undefined ? { skip: options.skip } : {}), ...(options.take !== undefined ? { take: options.take } : {}) });
      return { ...result, rows: ordered.rows, total: ordered.total };
    },
    totalCount(options: LoadOptions = {}): Promise<number> {
      const filter = rewrite(options.filter, all());
      return store.totalCount({ ...options, ...(filter ? { filter } : {}) });
    },
    async distinct(wanted: readonly string[], options: LoadOptions = {}): Promise<Record<string, unknown[]>> {
      const compiled = all();
      const own = wanted.filter((f) => !named.has(f));
      const filter = rewrite(options.filter, compiled);
      const found: Record<string, unknown[]> = own.length && store.distinct
        ? await store.distinct(own, { ...options, ...(filter ? { filter } : {}) }) : {};
      const theirs = compiled.filter((c) => wanted.includes(c.field));
      const needed = [...new Set([...theirs.flatMap((c) => c.reads), ...(store.distinct ? [] : own)])];
      if (theirs.length || (own.length && !store.distinct)) {
        const { rows } = await store.load({ ...(filter ? { filter } : {}), fields: needed, ...(options.search ? { search: options.search } : {}) });
        give(rows, theirs);
        for (const f of wanted) {
          if (f in found) continue;
          const seen = new Set(rows.map((r) => readField(r, f)));
          // A status field's values in its own order.
          const c = theirs.find((x) => x.field === f);
          found[f] = c ? c.def.values.map((v) => v.value).filter((v) => seen.has(v)) : [...seen].filter((v) => v != null);
        }
      }
      return found;
    },
    async byKey(key: unknown): Promise<Row | undefined> {
      const row = await store.byKey(key);
      return row ? give([{ ...row }], all())[0] : undefined;
    },
    async insert(values: Row): Promise<Row> {
      refuse(values);
      return give([{ ...(await store.insert(values)) }], all())[0]!;
    },
    async update(key: unknown, values: Row, write?: Parameters<Store['update']>[2]): Promise<Row> {
      refuse(values);
      return give([{ ...(await store.update(key, values, write)) }], all())[0]!;
    },
    changes: store.changes ? async (since?: unknown): Promise<StoreChanges> => {
      const moved = await store.changes!(since);
      if (!Array.isArray(moved.fields)) return moved;
      const compiled = all();
      const more = compiled.filter((c) => c.reads.some((r) => (moved.fields as readonly string[]).includes(r))).map((c) => c.field);
      return { ...moved, fields: [...moved.fields, ...more] };
    } : undefined,
  });
}

