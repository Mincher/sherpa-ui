/**
 * grid-selection.ts — a grid's selection and its current row: the rows ticked,
 * kept BY KEY so a page change keeps them, the header's and each group's box, the
 * scenarios of Select all, and the row last clicked. A module of
 * sherpa-data-grid, not an element. TRAP T-selection-lives-in-the-keys-not-the-objects
 *
 * Map:
 * - SelectionHost — What the selection asks of its grid.
 * - SelectBox — A selection box: a `sherpa-select-checkbox`, or the one-row `sherpa-select-radio`.
 * - GridSelection — The rows ticked and the current row, by key.
 * - .single — `single` draws radios, holds one record, and shows no select-all.
 * - .name — The radio group name in single mode: per grid, stable across draws.
 * - .has — Is this record ticked?
 * - .keyOf — The key a row goes by: its `key` field, else the data layer's.
 * - .records — The selected records, filter-hidden ones included, in row order.
 * - .keys — The selected rows as keys.
 * - .all — The header's box: every visible row ticked, or none.
 * - .row — A row's box, or a group's, toggled.
 * - .scenario — A scenario from the header's advanced box: this page, every row, none.
 * - .select — Select exactly these rows, by key: replaces, and is silent.
 * - .resolve — The kept keys, resolved against the rows held now.
 * - .sync — Each box, the header's and each group's, drawn from what is ticked.
 * - .current — The current row's key, or null.
 * - .setCurrent — The current row, by key: silent.
 * - .clicked — A row was clicked: it is the current one.
 * - .currentRecord — The current record among the rows held now.
 * - .neighbour — The row `by` rows from the current one, in the order drawn.
 * - .syncCurrent — Each drawn row marked current or not; CSS owns the tint.
 */
import { report } from '../../core/data/report.js';
import { isStaleKey, keyRow, rowKey } from '../../core/data/row-key.js';
import type { Row } from '../../core/data/store.js';
import type { GridHost } from './grid-host.js';

/** A selection box — a `sherpa-select-checkbox`, or the one-row `sherpa-select-radio`; NOT `HTMLInputElement`. */
export type SelectBox = HTMLElement & { checked: boolean; indeterminate: boolean };

/** A select-all box says all, some or none of `of` ticked. */
function tickAll(box: SelectBox, on: number, of: number): void {
  box.checked = on > 0 && on === of;
  box.indeterminate = on > 0 && on < of;
}

/** What the selection asks of its grid. */
export interface SelectionHost extends GridHost {
  /** The rows as populated, and every visible row in the order drawn. */
  rows(): readonly Row[];
  visible(): readonly Row[];
  /** The field that names a row, or null. */
  key(): string | null;
  /** Does the grid cut its own pages? How many pages its source says there are. */
  paginates(): boolean;
  pages(): number;
  /** Draw the body again: its boxes are stamped from what is ticked. */
  redraw(): void;
  /** The selection changed: the grid reports it. */
  changed(selected: string[], records: Row[]): void;
  /** Ask the host for every row its source holds; true when one took the ask. */
  askEvery(answer: (rows: readonly Row[]) => void): boolean;
}

/** The rows ticked and the current row, by key. */
export class GridSelection {
  /** Its grid. */
  readonly #host: SelectionHost;
  /** The selected rows. */
  #selected = new Set<Row>();
  /** Keys a caller asked to select, or the reader ticked: the half that survives a page change. */
  #wanted: string[] | null = null;
  /** The CURRENT row's key: the last row clicked, or set. Not DOM focus, which a
   *  click never takes. A key, so a re-populate keeps it. */
  #current: string | null = null;
  /** Each grid's own number, so its radio group name is unique on the page. */
  static #uid = 0;
  /** This grid's number. */
  readonly #id = ++GridSelection.#uid;

  constructor(host: SelectionHost) {
    this.#host = host;
  }

  /** `single` draws radios, holds one record, and shows no select-all. */
  get single(): boolean {
    return this.#host.el.dataset['select'] === 'single';
  }

  /** The radio group name in single mode: per grid, stable across draws. */
  get name(): string {
    return `sherpa-grid-select-${this.#id}`;
  }

  /** Is this record ticked? */
  has(record: Row): boolean {
    return this.#selected.has(record);
  }

  /**
   * The key a row goes by: its `key` field when the grid was given one, else the
   * data layer's — a store's, or one made up beside the row. Never a position.
   * TRAP T-a-made-up-key-never-leaves-the-data-layer
   */
  keyOf(row: Row): string | undefined {
    const key = this.#host.key();
    if (!key) return rowKey(row) ?? keyRow(row);
    const own = row[key];
    return own != null && own !== '' ? String(own) : undefined;
  }

  /** The selected RECORDS, filter-hidden ones included, in original row order. */
  records(): Row[] {
    return this.#host.rows().filter((r) => this.#selected.has(r));
  }

  /** The selected rows as KEYS: the kept keys ARE the answer — derived from the
   *  records, a page none of them are on reads empty. TRAP T-grid-key-or-position-lies */
  keys(): string[] {
    return [...(this.#wanted ?? [])];
  }

  /** The header's box: every VISIBLE row ticked, or none — a select-all neither
   *  reaches nor lets go of what a filter hides. Unticked, a CLEAR: off-page keys go too. */
  all = (event: Event): void => {
    const checked = (event.target as SelectBox).checked;
    for (const record of this.#host.visible()) {
      if (checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    if (!checked) this.#wanted = null;
    // BOTH boxes on purpose — a write, not a count. CSS decides which shows.
    for (const box of this.#host.$$<SelectBox>('.row-select')) box.checked = checked;
    this.sync();
    this.#changed();
  };

  /** A row's box, or a group's — the select-all of the rows it heads — toggled. The
   *  choice is kept against the RECORD, so it survives the next draw. */
  row = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('group-select')) return this.#group(target as SelectBox);
    if (!target.classList.contains('row-select')) return;
    const record = this.#host.recordFor(target);
    if (record) {
      // SINGLE mode holds one record; the radio unticks its own group.
      if (this.single) {
        this.#selected.clear();
        this.#wanted = null;
      }
      if ((target as SelectBox).checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    this.sync();
    this.#changed();
  };

  /** The row's selection box — the checkbox, or the radio in single mode.
   *  TRAP T-a-row-holds-two-selection-boxes */
  #box(row: Element): SelectBox | null {
    return row.querySelector<SelectBox>(this.single ? '.row-one' : '.row-multi');
  }

  /** Every row in one group set as its group's box says. */
  #group(box: SelectBox): void {
    const key = box.closest<HTMLElement>('.group-row')?.dataset['groupKey'];
    if (key == null) return;
    for (const row of this.#host.$$<HTMLElement>('.row')) {
      if (row.dataset['groupKey'] !== key) continue;
      const rowBox = this.#box(row);
      if (rowBox) rowBox.checked = box.checked;
      const record = this.#host.recordFor(row);
      if (!record) continue;
      if (box.checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    this.#syncRows();
    this.#changed();
  }

  /**
   * A scenario from the header's advanced box. `page` and `all` differ only while
   * paging. TRAP T-select-all-is-the-visible-rows — neither reaches a record a
   * filter hides, which the reader could not undo.
   */
  scenario = (event: Event): void => {
    const value = (event as CustomEvent).detail?.['value'] as string | undefined;
    if (!value) return;
    if (value === 'none') {
      this.#selected.clear();
      // EVERYTHING, other pages included — else the merge hands every off-page key back.
      this.#wanted = null;
    } else if (value === 'all' && this.#askEvery()) {
      return;
    } else if (value === 'page') {
      // THIS page, and only it: a row chosen on another page is let go (Will, 365).
      const rows = this.#host.$$<HTMLElement>('.row').map((tr) => this.#host.recordFor(tr)).filter((r): r is Row => r !== undefined);
      this.#selected.clear();
      this.#wanted = null;
      for (const record of rows) this.#selected.add(record);
    } else {
      for (const record of this.#host.visible()) this.#selected.add(record);
    }
    this.#redraw();
    this.#changed();
  };

  /** "Select all rows" on a grid its SOURCE pages: it holds one page, so it asks for
   *  the rest. True when a host took the ask. TODO 238 */
  #askEvery(): boolean {
    if (this.#host.paginates() || this.#host.pages() <= 1) return false;
    return this.#host.askEvery((rows) => {
      const keys = rows.map((r) => this.keyOf(r)).filter((k): k is string => !!k);
      this.#wanted = [...new Set([...(this.#wanted ?? []), ...keys])];
      this.resolve();
      this.#redraw();
      this.#changed();
    });
  }

  /**
   * Select exactly these rows, by key. TRAP T-grid-select-remembers-wanted-keys —
   * REPLACES, ignores unmatched keys, and is SILENT. A made-up key from another page
   * load names no row now — it would pick the wrong ones if its number were reused —
   * so it is dropped, and said. TRAP T-a-made-up-key-never-leaves-the-data-layer
   */
  select(keys: readonly string[]): void {
    const stale = keys.filter(isStaleKey);
    if (stale.length) {
      report({
        code: 'stale-made-up-key',
        message: 'select: a made-up row key from an earlier page load names no row; it was not kept.',
        at: { keys: stale.slice(0, 5).join(', ') },
      });
    }
    const fresh = keys.map(String).filter((k) => !isStaleKey(k));
    this.#wanted = fresh.length ? fresh : null;
    this.resolve();
    // UNMATCHED keys drop here, never by the merge — and only with rows to check: a
    // saved view selects before its populate, and an empty grid would lose them all.
    if (this.#host.rows().length) {
      const resolved = [...this.#selected].map((r) => this.keyOf(r)).filter((k): k is string => !!k);
      this.#wanted = resolved.length ? resolved : null;
    }
    // The boxes are stamped from what is ticked on every draw: one path, not two.
    this.#redraw();
  }

  /** The kept keys, resolved against the rows the grid holds NOW — on every populate.
   *  TRAP T-grid-select-remembers-wanted-keys */
  resolve(): void {
    this.#selected.clear();
    if (!this.#wanted) return;
    const wanted = new Set(this.#wanted);
    for (const row of this.#host.rows()) {
      const key = this.keyOf(row);
      if (key && wanted.has(key)) this.#selected.add(row);
    }
  }

  /** The body drawn again, and every box from what is ticked. */
  #redraw(): void {
    this.#host.redraw();
    this.sync();
  }

  /** Each box, the header's and each group's, drawn from what is ticked. */
  sync(): void {
    this.#syncRows();
    for (const groupRow of this.#host.$$<HTMLElement>('.group-row')) {
      const key = groupRow.dataset['groupKey'];
      const box = groupRow.querySelector<SelectBox>('.group-select');
      if (!box || key == null) continue;
      const rows = this.#host.$$<HTMLElement>('.row').filter((r) => r.dataset['groupKey'] === key);
      tickAll(box, rows.filter((r) => this.#box(r)?.checked).length, rows.length);
    }
  }

  /** Each ticked ROW marked, which CSS paints, and all / some / none on the header's
   *  box. TRAP T-firefox-never-rereads-a-has-after-host */
  #syncRows(): void {
    const all = this.#host.$$<SelectBox>(this.single ? '.row-one' : '.row-multi');
    for (const box of all) box.closest('.row')?.toggleAttribute('data-selected', box.checked);
    const selectAll = this.#host.$<SelectBox>('.select-all');
    if (selectAll) tickAll(selectAll, all.filter((b) => b.checked).length, all.length);
  }

  /** The keys kept, then said — BEFORE the event, as a listener reads `selectedKeys`.
   *  MERGED: a record chosen on page 1 is not among the rows while page 2 is up. */
  #changed(): void {
    const onPage = new Set(this.#host.rows().map((r) => this.keyOf(r)).filter((k): k is string => !!k));
    const chosen = new Set(this.records().map((r) => this.keyOf(r)).filter((k): k is string => !!k));
    for (const k of this.#wanted ?? []) if (!onPage.has(k)) chosen.add(k);
    this.#wanted = chosen.size ? [...chosen] : null;
    this.#host.changed(this.keys(), this.records());
  }

  /** The current row's key, or null. */
  get current(): string | null {
    return this.#current;
  }

  /** The current row, by key: silent, as `select()` is. */
  setCurrent(key: string | null): void {
    this.#current = key == null || key === '' ? null : String(key);
    this.syncCurrent();
  }

  /** A row was clicked: it is the current one. */
  clicked(record: Row | undefined): void {
    this.setCurrent(record ? this.keyOf(record) ?? null : null);
  }

  /** The current RECORD among the rows held now — null when it is not one of them. */
  currentRecord(): Row | null {
    return this.#host.rows().find((r) => this.keyOf(r) === this.#current) ?? null;
  }

  /** The row `by` rows from the current one, in the order drawn — or null. */
  neighbour(by: number): Row | null {
    const rows = this.#host.visible();
    const at = rows.findIndex((r) => this.keyOf(r) === this.#current);
    return at < 0 ? null : rows[at + by] ?? null;
  }

  /** Each drawn row marked current or not — one of many, the house word; CSS owns the tint. */
  syncCurrent(): void {
    for (const tr of this.#host.$$<HTMLElement>('.row')) {
      const row = this.#host.recordFor(tr);
      tr.toggleAttribute('data-current', !!row && this.#current !== null && this.keyOf(row) === this.#current);
    }
  }
}
