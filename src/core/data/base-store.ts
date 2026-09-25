/**
 * base-store.ts — what every Store shares: the key field, the schema guard in
 * and out, `totalCount`, and announcing a change. Its own module so `IdbStore`
 * can extend it rather than re-implement it. TRAP T-one-class-to-catch
 */
import type { LoadOptions, LoadResult, Row, Store, StoreChangeDetail } from './store.js';
import { validate, ValidationError, type Issue, type StandardSchema } from './validate.js';

/** Options every store shares. */
export interface StoreOptions {
  /** The field holding each row's identity. Default `'id'`. */
  key?: string;
  /** The field holding each row's TIME. No default.
   *  TRAP T-a-record-has-a-time-of-its-own */
  time?: string;
  /** Refuse rows the store WRITES that fail. TRAP T-schema-guard-belongs-at-the-store */
  schema?: StandardSchema;
  /** Cap rows, dropping OLDEST first. TRAP T-max-rows-is-oldest-out-by-insertion */
  maxRows?: number;
  /** On a READ, check only the first N rows; writes check in full. TRAP T-schema-sample-cost */
  sample?: number;
}

/** Shared plumbing. EventTarget so `change` is a real event a DataSource can subscribe to. */
export abstract class BaseStore extends EventTarget implements Store {
  readonly key: string;
  readonly time: string | undefined;
  /** The write guard, if the caller gave one. */
  protected readonly schema: StandardSchema | undefined;
  /** How many rows a READ checks. 0 = all of them. */
  protected readonly sampleSize: number;

  constructor(options: StoreOptions = {}) {
    super();
    this.key = options.key ?? 'id';
    this.time = options.time;
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
    // skip/take dropped: a COUNT is of the matches, not of one page.
    const { skip: _skip, take: _take, ...rest } = options ?? {};
    const result = await this.load(rest);
    return result.total;
  }

  /** Check a row, THROWING if it fails; returns the PARSED value. TRAP T-schema-guard-belongs-at-the-store */
  protected async check(values: Row): Promise<Row> {
    if (!this.schema) return values;
    const result = await validate(this.schema, values);
    if (result.issues) throw new ValidationError(result.issues);
    return (result.value ?? values) as Row;
  }

  /**
   * Drop arriving rows the schema refuses — one bad row must not empty a grid.
   * TRAP T-read-check-drops-where-a-write-throws
   */
  protected async checkRows(result: LoadResult): Promise<LoadResult> {
    if (!this.schema) return result;

    // 0 checks everything: the guard is opt-OUT.
    const limit = this.sampleSize && this.sampleSize > 0
      ? Math.min(this.sampleSize, result.rows.length)
      : result.rows.length;

    const rows: Row[] = [];
    // TRAP T-read-check-drops-where-a-write-throws
    const issues: Issue[] = [];
    for (let i = 0; i < limit; i++) {
      const row = result.rows[i]!;
      const checked = await validate(this.schema, row);
      if (checked.issues) issues.push(...checked.issues);
      else rows.push((checked.value ?? row) as Row);
    }
    // The tail, UNCHECKED and unchanged. TRAP T-schema-sample-cost
    for (let i = limit; i < result.rows.length; i++) rows.push(result.rows[i]!);

    const dropped = result.rows.length - rows.length;
    if (!dropped) return { ...result, rows };

    return {
      ...result,
      rows,
      // The total drops with the rows. TRAP T-dropped-rows-must-be-countable
      total: Math.max(0, result.total - dropped),
      dropped,
      issues: issues.slice(0, 5), // the first few only
    };
  }

  /** Tell every listener the records changed. */
  protected announce(detail: StoreChangeDetail): void {
    this.dispatchEvent(new CustomEvent('change', { detail }));
  }
}

