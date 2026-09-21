/**
 * base-store.ts — the half every Store implementation shares.
 *
 * `StoreOptions` and `BaseStore`: the key field, the schema guard on the way in
 * and on the way out, `totalCount`, and announcing a change.
 *
 * ITS OWN MODULE so `IdbStore` can extend it. It lived inside `stores.ts` and
 * was not exported, so IndexedDB could not reach it and re-implemented all four
 * — including a private copy of the validation error that was a DIFFERENT
 * CLASS with the same name, so `instanceof ValidationError` was false for every
 * IndexedDB refusal. TRAP T-one-class-to-catch.
 *
 * Extends EventTarget so `change` is a real DOM event — no emitter to write,
 * and a DataSource subscribes with its usual addEventListener.
 */
import type { LoadOptions, LoadResult, Row, Store, StoreChangeDetail } from './store.js';
import { validate, ValidationError, type Issue, type StandardSchema } from './validate.js';

/** Options every store shares. */
export interface StoreOptions {
  /** The field holding each row's identity. Default `'id'`. */
  key?: string;
  /**
   * Check every row the store WRITES, and refuse the ones that fail.
   *
   * TRAP T-schema-guard-belongs-at-the-store — a rule enforced in one screen is
   * not a rule.
   */
  schema?: StandardSchema;
  /**
   * Keep at most this many rows, dropping the OLDEST first.
   *
   * TRAP T-max-rows-is-oldest-out-by-insertion — insertion order, not a field,
   * and every write honours it.
   */
  maxRows?: number;
  /**
   * On a READ, check only the first N rows rather than every one.
   *
   * TRAP T-schema-sample-cost — what a sample is for, and when it must NOT be
   * used. Writes are always checked in full.
   */
  sample?: number;
}

/**
 * Shared plumbing: the key field, and announcing a change.
 *
 * Extends EventTarget so `change` is a real DOM event — no emitter to write, and
 * a DataSource subscribes with its usual addEventListener.
 */
export abstract class BaseStore extends EventTarget implements Store {
  readonly key: string;
  /** The write guard, if the caller gave one — see StoreOptions.schema. */
  protected readonly schema: StandardSchema | undefined;
  /** How many rows a READ checks. 0 or absent = all of them — see StoreOptions.sample. */
  protected readonly sampleSize: number;

  constructor(options: StoreOptions = {}) {
    super();
    this.key = options.key ?? 'id';
    this.schema = options.schema;
    this.sampleSize = options.sample ?? 0;
  }

  abstract load(options?: LoadOptions): Promise<LoadResult>;
  abstract byKey(key: unknown): Promise<Row | undefined>;
  abstract insert(values: Row): Promise<Row>;
  abstract update(key: unknown, values: Row): Promise<Row>;
  abstract remove(key: unknown): Promise<void>;

  /** Matching rows before paging — what a pager counts pages from. */
  async totalCount(options?: LoadOptions): Promise<number> {
    // skip/take are dropped: a COUNT is of the matches, not of one page.
    const { skip: _skip, take: _take, ...rest } = options ?? {};
    const result = await this.load(rest);
    return result.total;
  }

  /**
   * Check a row against the schema, THROWING if it fails.
   *
   * TRAP T-schema-guard-belongs-at-the-store — a throw not a `false`, the PARSED
   * value back, and no schema means no check.
   */
  protected async check(values: Row): Promise<Row> {
    if (!this.schema) return values;
    const result = await validate(this.schema, values);
    if (result.issues) throw new ValidationError(result.issues);
    return (result.value ?? values) as Row;
  }

  /**
   * Check ROWS ARRIVING, dropping the ones the schema refuses.
   *
   * TRAP T-read-check-drops-where-a-write-throws — one bad row in a thousand
   * must not empty a grid, so it is dropped and counted. No schema, no check.
   */
  protected async checkRows(result: LoadResult): Promise<LoadResult> {
    if (!this.schema) return result;

    /* THE SAMPLE. `undefined` or 0 means check everything, which stays the
       default: a guard you have to opt out of is a guard people keep. */
    const limit = this.sampleSize && this.sampleSize > 0
      ? Math.min(this.sampleSize, result.rows.length)
      : result.rows.length;

    const rows: Row[] = [];
    // The first few issues only — TRAP T-read-check-drops-where-a-write-throws.
    const issues: Issue[] = [];
    for (let i = 0; i < limit; i++) {
      const row = result.rows[i]!;
      const checked = await validate(this.schema, row);
      if (checked.issues) issues.push(...checked.issues);
      else rows.push((checked.value ?? row) as Row);
    }
    // The tail, UNCHECKED and unchanged — TRAP T-schema-sample-cost.
    for (let i = limit; i < result.rows.length; i++) rows.push(result.rows[i]!);

    const dropped = result.rows.length - rows.length;
    if (!dropped) return { ...result, rows };

    return {
      ...result,
      rows,
      // TRAP T-dropped-rows-must-be-countable — the total drops with the rows,
      // and only the first few issues travel.
      total: Math.max(0, result.total - dropped),
      dropped,
      issues: issues.slice(0, 5),
    };
  }

  /** Tell every listener the records changed. */
  protected announce(detail: StoreChangeDetail): void {
    this.dispatchEvent(new CustomEvent('change', { detail }));
  }
}

