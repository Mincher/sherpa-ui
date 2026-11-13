/**
 * base-store.ts — what every Store shares: the key field, the schema guard in
 * and out, `totalCount`, and announcing a change. Its own module so `IdbStore`
 * can extend it rather than re-implement it. TRAP T-one-class-to-catch
 *
 * Map:
 * - StoreOptions — Options every store shares.
 * - BaseStore — what every store shares: key, time, schema guard, change events
 */
import { applyOptions, matchesOnly, orderKey, pageOf, projectRow, readField, withoutPage, type LoadOptions, type LoadResult, type Row, type Store, type StoreCapabilities, type StoreChangeDetail, type WriteOptions } from './store.js';
import { carryKey, keyRow } from './row-key.js';
import { StoreHistory } from './store-history.js';
import { Journal } from './journal.js';
import {
  domainsOf, rulesOf, validate, validateField, ValidationError, type FieldDomain, type Issue, type RuleMap, type StandardSchema,
} from './validate.js';

/** Options every store shares. */
export interface StoreOptions {
  /** The field holding each row's identity. Default `'id'`. */
  key?: string;
  /** The field holding each row's TIME. No default.
   *  TRAP T-a-record-has-a-time-of-its-own */
  time?: string;
  /** The id of the type whose rows it holds: `typeStoreOptions` gives it. */
  type?: string;
  /** Refuse rows the store WRITES that fail. TRAP T-schema-guard-belongs-at-the-store */
  schema?: StandardSchema;
  /** Cap rows, dropping OLDEST first. TRAP T-max-rows-is-oldest-out-by-insertion */
  maxRows?: number;
  /** On a READ, check only the first N rows; writes check in full. TRAP T-schema-sample-cost */
  sample?: number;
  /** Keep the last N UPDATES, each as the row before and after, so `undo()` and `redo()` step
   *  through them. Off unless given. An insert, a remove or a whole reload forgets them.
   *  TRAP T-a-store-keeps-its-history */
  journal?: number;
}

/** Shared plumbing. EventTarget so `change` is a real event a DataSource can subscribe to. */
/** One question's matches in their order, and what they were worked out from. */
interface KeptOrder extends Pick<LoadResult, 'dropped' | 'issues'> {
  key: string;
  of: readonly Row[];
  age: number;
  rows: readonly Row[];
}

export abstract class BaseStore extends EventTarget implements Store {
  readonly key: string;
  readonly time: string | undefined;
  readonly type: string | undefined;
  /** The write guard, if the caller gave one. */
  protected readonly schema: StandardSchema | undefined;
  /** How many rows a READ checks. 0 = all of them. */
  protected readonly sampleSize: number;
  /** What changed this session, by field — none where it could not vouch for one. TRAP T-a-store-keeps-its-history */
  readonly history: StoreHistory | undefined;
  /** What it can do: its own say, over what its schema allows. TRAP T-a-store-says-what-it-can-do-once */
  readonly capabilities: StoreCapabilities;

  /** The updates it can step back and forward; undefined unless `journal` was given. TRAP T-a-store-keeps-its-history */
  protected readonly journal: Journal<Row> | undefined;

  constructor(options: StoreOptions = {}, can: StoreCapabilities = {}, history = true) {
    super();
    this.journal = options.journal && options.journal > 0 ? new Journal<Row>(options.journal) : undefined;
    this.history = history ? new StoreHistory() : undefined;
    this.key = options.key ?? 'id';
    this.time = options.time;
    this.type = options.type;
    this.schema = options.schema;
    this.sampleSize = options.sample ?? 0;
    this.capabilities = {
      // A load's total counts every match: these stores page in memory.
      reportsTotal: true,
      /* It sends only the fields a load names where its rows are checked field by
         field (a `rules()` schema), or not at all: another library's schema checks a
         whole row. TRAP T-a-projected-row-is-checked-on-what-it-was-sent */
      projects: !this.schema || !!rulesOf(this.schema),
      // A read checks only its first rows. TRAP T-schema-sample-cost
      sampled: !!this.schema && this.sampleSize > 0,
      ...can,
    };
  }

  /** One row as a projection sends it: its key and the named fields — a path's whole top field. */
  protected project(row: Row, fields: readonly string[]): Row {
    return projectRow(row, this.key, fields);
  }

  /** What each field MAY hold, as its schema says. TRAP T-the-data-says-what-a-field-may-hold */
  get domains(): Readonly<Record<string, FieldDomain>> {
    return domainsOf(this.schema);
  }

  abstract load(options?: LoadOptions): Promise<LoadResult>;
  abstract byKey(key: unknown): Promise<Row | undefined>;
  abstract insert(values: Row): Promise<Row>;
  abstract update(key: unknown, values: Row, options?: WriteOptions): Promise<Row>;
  abstract remove(key: unknown, options?: WriteOptions): Promise<void>;

  /** Matching rows before paging — what a pager counts pages from. */
  async totalCount(options?: LoadOptions): Promise<number> {
    // A COUNT is of the matches, not of one page, in no order. Its rows are only counted:
    // their keys, where it can send just them. TRAP T-a-page-turn-is-a-slice
    return (await this.load({ ...matchesOnly(options), ...(this.capabilities.projects ? { fields: [this.key] } : {}) })).total;
  }

  /** What the schema said of each row it has read. */
  #checked = new WeakMap<object, Awaited<ReturnType<typeof validate>>>();

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
  protected async checkRows(result: LoadResult, fields?: readonly string[]): Promise<LoadResult> {
    for (const row of result.rows) this.keyed(row);
    if (!this.schema) return result;
    // A PROJECTED row is checked on the fields it was sent, and no other.
    const map = fields && rulesOf(this.schema);
    if (fields && map) return this.#checkFields(result, fields, map);

    // 0 checks everything: the guard is opt-OUT.
    const limit = this.sampleSize && this.sampleSize > 0
      ? Math.min(this.sampleSize, result.rows.length)
      : result.rows.length;

    const rows: Row[] = [];
    // TRAP T-read-check-drops-where-a-write-throws
    const issues: Issue[] = [];
    for (let i = 0; i < limit; i++) {
      const row = result.rows[i]!;
      // A row is read far oftener than it changes. TRAP T-a-page-turn-is-a-slice
      let checked = this.#checked.get(row);
      if (!checked) {
        checked = await validate(this.schema, row);
        this.#checked.set(row, checked);
      }
      if (checked.issues) issues.push(...checked.issues);
      else rows.push(this.keyed((checked.value ?? row) as Row, row));
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

  /** Rows sent some fields, each checked on those fields' rules alone. */
  async #checkFields(result: LoadResult, fields: readonly string[], map: RuleMap): Promise<LoadResult> {
    const rows: Row[] = [];
    const issues: Issue[] = [];
    for (const row of result.rows) {
      let bad: Issue | undefined;
      for (const f of fields) {
        const fieldRules = map[f];
        const message = fieldRules ? await validateField(fieldRules, row[f]) : undefined;
        if (message) {
          bad = { message, path: [f] };
          break;
        }
      }
      if (bad) issues.push(bad);
      else rows.push(row);
    }
    const dropped = result.rows.length - rows.length;
    return dropped ? { ...result, rows, total: Math.max(0, result.total - dropped), dropped, issues: issues.slice(0, 5) } : { ...result, rows };
  }

  /**
   * A PAGE of the rows the schema accepts: checked FIRST, then searched,
   * sorted and cut. Cut first, a refused row left its page short, and the
   * total changed from page to page. TRAP T-a-refused-row-never-shortens-a-page
   */
  protected async page(rows: readonly Row[], options: LoadOptions = {}): Promise<LoadResult> {
    const key = orderKey(options);
    const kept = this.#order;
    // The same question over the same rows: a page turn is a slice. TRAP T-a-page-turn-is-a-slice
    const order = kept?.key === key && kept.of === rows && kept.age === this.#age ? kept : await this.#ordered(rows, options, key);
    const { dropped, issues } = order;
    const paged = pageOf(order.rows, options);
    // A projection sends the fields it names, each row by its original's key.
    const fields = options.fields;
    const result = fields ? { ...paged, rows: paged.rows.map((r) => this.keyed(this.project(r, fields), r)) } : paged;
    return dropped ? { ...result, dropped, ...(issues ? { issues } : {}) } : result;
  }

  /** A question's matches, checked and in order, kept for its next page. */
  async #ordered(rows: readonly Row[], options: LoadOptions, key: string): Promise<KeptOrder> {
    const age = this.#age;
    const { rows: accepted, dropped, issues } = await this.checkRows({ rows: [...rows], total: rows.length });
    const order: KeptOrder = {
      key, of: rows, age, rows: applyOptions(accepted, withoutPage(options)).rows,
      ...(dropped ? { dropped } : {}), ...(issues ? { issues } : {}),
    };
    this.#order = order;
    return order;
  }
  /** The last question's matches, in order, and what they were worked out from. */
  #order: KeptOrder | undefined;
  /** Moved by each change this store announces. */
  #age = 0;

  /**
   * A row goes out KEYED — by its own key field, or by a key made up BESIDE it,
   * carried from the row it was copied from. Never a field on the row.
   * TRAP T-a-made-up-key-never-leaves-the-data-layer
   */
  protected keyed<T extends object>(row: T, from?: object): T {
    if (from) carryKey(from, row);
    keyRow(row, readField(row as Row, this.key));
    return row;
  }

  /** Note an update in the journal, BEFORE it is announced: the row it was, and the row it is. */
  protected journaled(before: Row, after: Row): void {
    if (!this.journal) return;
    if (!this.#stepping) this.journal.push({ before: { ...before }, after: { ...after } });
    this.#noted = true;
  }
  /** An undo or redo is in flight: its own update is not a new change. */
  #stepping = false;
  /** The update being announced was noted. */
  #noted = false;

  /** Is there an update to undo? */
  get canUndo(): boolean {
    return !!this.journal?.canBack;
  }

  /** Is there an update to redo? */
  get canRedo(): boolean {
    return !!this.journal?.canForward;
  }

  /** Put the last update's row back, as an ordinary update; false when there is none. */
  async undo(): Promise<boolean> {
    const step = this.journal?.peekBack();
    if (!step) return false;
    await this.#step(step.after, step.before);
    this.journal!.back();
    return true;
  }

  /** Put back the update the last undo took away; false when there is none. */
  async redo(): Promise<boolean> {
    const step = this.journal?.peekForward();
    if (!step) return false;
    await this.#step(step.before, step.after);
    this.journal!.forward();
    return true;
  }

  /** Make the row `from` the row `to`: a field `to` lacks is unset. */
  async #step(from: Row, to: Row): Promise<void> {
    const values: Row = { ...to };
    for (const f of Object.keys(from)) if (!(f in to)) values[f] = undefined;
    this.#stepping = true;
    try {
      await this.update(readField(from, this.key), values);
    } finally {
      this.#stepping = false;
    }
  }

  /** Tell every listener the records changed — noted in the History first. */
  protected announce(detail: StoreChangeDetail): void {
    // The journal vouches only for updates it saw: any other change, or an update it missed, ends it.
    if (this.journal && (detail.type !== 'update' || detail.key === undefined || !this.#noted)) this.journal.clear();
    this.#noted = false;
    this.#age++;
    this.history?.record(detail, this.key);
    this.dispatchEvent(new CustomEvent('change', { detail }));
  }
}

