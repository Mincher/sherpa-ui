/**
 * column-facts.ts — what a grid draws from the rows it was given: their order, its
 * visual page while grouped, each group's count, a column's values and a number's
 * ends. The data layer's one answer over them; the grid only draws it. DOM-free.
 * Plan 695 P4 · TRAP T-a-group-is-a-data-layer-concept
 *
 * Map:
 * - PageAsk — What a grid asks of its rows: their order, and its page of them.
 * - RowPage — The rows in the order drawn, and the page of them a grid shows.
 * - ColumnFacts — The facts over one set of rows, each worked out once, when asked.
 * - .rows — The rows, as given.
 * - .told — The groups its source counted, as told; none, null.
 * - .page — The rows in the order drawn, and its page of them.
 * - .count — How many rows carry one group value: the count told, else these rows'.
 * - .values — One field's distinct values, as value keys, in the library's order.
 * - .range — A number field's ends, over its finite values; none, undefined.
 */
import { reduceRows } from './aggregate.js';
import { cellValues, compareValues, distinctOf, readField, sortRows, valueKey, type GroupSummary, type Row, type SortSpec } from './store.js';

/** What a grid asks of its rows: their order, and its page of them. */
export interface PageAsk {
  /** Order them here, its group first: rows given by hand. A source's come ordered. */
  order?: boolean;
  /** The sort in force; none while it is suspended. */
  sort?: SortSpec;
  /** The field it groups by. */
  group?: string;
  /** Grouped, the 1-based page it shows, and the rows a page holds; 0, it does not page. */
  page?: number;
  size?: number;
  /** The groups folded shut, by key: each costs one slot. */
  shut?: ReadonlySet<string>;
}

/** The rows in the order drawn, and the page of them a grid shows. */
export interface RowPage {
  /** Every row, in the order drawn: a row's `data-index` is its place here. */
  all: readonly Row[];
  /** The page's rows: all of them, unless grouped and paged. */
  rows: readonly Row[];
  /** Where the page starts in `all`. */
  offset: number;
  /** How many pages the fold makes: 1, unless grouped and paged. */
  pages: number;
}

/** The facts over one set of rows, each worked out once, when asked. */
export class ColumnFacts {
  /** The rows, as given. */
  readonly rows: readonly Row[];
  /** The groups its source counted, as told; none, null. */
  readonly told: readonly GroupSummary[] | null;
  /** The last order asked, and what it was asked by. */
  #ordered: { key: string; rows: readonly Row[] } | null = null;
  /** The last page asked, and what it was asked by. */
  #paged: { key: string; page: RowPage } | null = null;
  /** Each field's tally of its group values, by key. */
  #tallies = new Map<string, Map<string, number>>();
  /** Each field's values, once asked. */
  #values = new Map<string, string[]>();
  /** Each number field's ends, once asked. */
  #ranges = new Map<string, { min: number; max: number } | undefined>();

  constructor(rows: readonly Row[], told: readonly GroupSummary[] | null = null) {
    this.rows = rows;
    this.told = told;
  }

  /**
   * The rows in the order drawn, and its page of them. GROUP leads, so a group's
   * rows sit together; by the grouped field itself, its own direction. A page is
   * `size` ROWS: an open group's heading is free, a SHUT group is one slot, and an
   * open group longer than a page is split. The page is clamped, never empty.
   * TRAP T-one-collator-for-the-library · TRAP T-grid-collapsed-group-is-one-slot
   */
  page(ask: PageAsk): RowPage {
    const all = this.#order(ask);
    const { group, size = 0 } = ask;
    if (!group || size <= 0) return { all, rows: all, offset: 0, pages: 1 };
    const shut = ask.shut ?? new Set<string>();
    const key = JSON.stringify([group, size, ask.page ?? 1, [...shut]]);
    if (this.#paged?.key === key && this.#paged.page.all === all) return this.#paged.page;
    const starts = [0];
    let slots = 0;
    let last: string | null = null;
    for (let i = 0; i < all.length; i += 1) {
      const at = valueKey(readField(all[i]!, group));
      // A shut group's rows are drawn hidden: its first pays for the heading.
      const cost = shut.has(at) ? (at !== last ? 1 : 0) : 1;
      if (cost > 0 && slots + cost > size && slots > 0) {
        starts.push(i);
        slots = 0;
      }
      slots += cost;
      last = at;
    }
    const index = Math.min(Math.max(ask.page ?? 1, 1), starts.length) - 1;
    const from = starts[index]!;
    const page = { all, rows: all.slice(from, starts[index + 1] ?? all.length), offset: from, pages: starts.length };
    this.#paged = { key, page };
    return page;
  }

  /** The rows as asked to be ordered: as given, unless `order` asks. */
  #order({ order, sort, group }: PageAsk): readonly Row[] {
    const specs: SortSpec[] = !order ? [] : [
      ...(group ? [{ field: group, direction: group === sort?.field ? sort.direction ?? 'asc' : 'asc' } as const] : []),
      ...(sort && sort.field !== group ? [sort] : []),
    ];
    if (!specs.length) return this.rows;
    const key = JSON.stringify(specs);
    if (this.#ordered?.key !== key) this.#ordered = { key, rows: sortRows(this.rows, specs) };
    return this.#ordered.rows;
  }

  /** How many rows carry one group value: the data layer's count where it told one,
   *  as these may be one page; else these rows' own. TRAP T-a-group-is-a-data-layer-concept */
  count(field: string, key: string): number {
    const told = this.told?.find((g) => g.key === key);
    if (told) return told.count;
    let tally = this.#tallies.get(field);
    if (!tally) {
      tally = new Map();
      for (const row of this.rows) {
        for (const v of cellValues(readField(row, field))) {
          const at = valueKey(v);
          tally.set(at, (tally.get(at) ?? 0) + 1);
        }
      }
      this.#tallies.set(field, tally);
    }
    return tally.get(key) ?? 0;
  }

  /** One field's distinct values among these rows, as value keys, none empty, in the
   *  library's one order. TRAP T-one-collator-for-the-library */
  values(field: string): string[] {
    let values = this.#values.get(field);
    if (!values) {
      values = (distinctOf(this.rows, [field])[field] ?? []).filter((v) => v != null && v !== '').sort(compareValues).map(valueKey);
      this.#values.set(field, values);
    }
    return values;
  }

  /** A number field's ends, the floor of its least and the ceiling of its most finite
   *  value; none finite, undefined. TRAP T-grid-slider-spans-real-values · TRAP T-number-of-null-is-zero */
  range(field: string): { min: number; max: number } | undefined {
    if (this.#ranges.has(field)) return this.#ranges.get(field);
    const finite = this.rows.some((row) => {
      const raw = readField(row, field);
      return raw != null && raw !== '' && Number.isFinite(Number(raw));
    });
    const range = finite ? { min: Math.floor(reduceRows(this.rows, 'min', field)), max: Math.ceil(reduceRows(this.rows, 'max', field)) } : undefined;
    this.#ranges.set(field, range);
    return range;
  }
}
