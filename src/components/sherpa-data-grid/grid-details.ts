/**
 * grid-details.ts — the rows a grid's row OPENS on: its toggle, the sub-grid under
 * it — this grid's part, filled from here, told what this grid holds — and its
 * headings kept under this grid's as it scrolls. A module of sherpa-data-grid, not
 * an element. Will, TODOs 570, 571, 574 · TRAP T-an-inner-event-stops-at-its-host
 *
 * Map:
 * - GridDetail — What a row opens on: the sub-grid's columns and key, and each row's rows and groups, by its key.
 * - DetailsHost — What the sub-grids ask of their grid.
 * - GridDetails — The rows open on their sub-grids, and what each is told.
 * - .draw — A row that opens: its toggle in its first cell, and, open, its sub-grid under it.
 * - .toggle — Open a row on its rows, or shut it.
 * - .stick — Each open sub-grid's headings stay under this grid's as it scrolls.
 * - .tellAll — Each open sub-grid told what this grid holds, as it changes.
 */
import { valueKey, type GroupSummary, type Row } from '../../core/data/store.js';
import type { AxisOffer } from '../../core/data/query.js';
import type { FieldFilter } from '../../core/data/data-source.js';
import type { FilterHostController } from '../../core/ui/filter-host-controller.js';
import type { GridColumn, SherpaDataGrid } from './sherpa-data-grid.js';
import type { GridHost } from './grid-host.js';

/** What a row opens on: the sub-grid's columns and key, and each row's rows — and
 *  their groups, where its grid groups — by its key. TODOs 570, 574 */
export interface GridDetail {
  columns: GridColumn[];
  key?: string;
  rows: Record<string, Row[]>;
  groups?: Record<string, GroupSummary[]>;
}

/** What a row's sub-grid is told of its grid: its filters' look and limits, its
 *  Group and Sort, which arrange the sub-grid's rows, and its tags. TODOs 571, 574, 580 */
const DETAIL_ATTRS = ['data-column-filters', 'data-filter-fields', 'data-pending', 'data-failed', 'data-needles', 'data-limit-options',
  'data-hide-unmatched', 'data-remote', 'data-apply-on', 'data-group-field', 'data-sort-field', 'data-sort-direction',
  'data-multi-field'];

/** What the sub-grids ask of their grid. */
export interface DetailsHost extends GridHost {
  /** What its rows open on; none, null. */
  detail(): GridDetail | null;
  /** The field that names a row, or null. */
  key(): string | null;
  /** Its row actions, which add a trailing column. */
  actions(): number;
  /** Its headings' filters, as its source defines them, and what its Group offers. */
  filters(): Readonly<Record<string, FieldFilter>>;
  groupOffer(): AxisOffer | undefined;
  /** What its headings are told and hold. */
  readonly filter: FilterHostController;
  /** The highlight's test, as last drawn. */
  highlight(): ((row: Row) => boolean) | null;
  /** Draw its body again. */
  redraw(): void;
  /** A sub-grid's heading and the box of its table, read inside it. */
  partsOf(sub: SherpaDataGrid): { head: HTMLElement | null; table: DOMRect | undefined };
}

/** The rows open on their sub-grids, and what each is told. */
export class GridDetails {
  /** Its grid. */
  readonly #host: DetailsHost;
  /** The rows open on their sub-grids, by key: kept across draws. */
  #opened = new Set<string>();

  constructor(host: DetailsHost) {
    this.#host = host;
  }

  /** A row's key, as its sub-grid's rows are kept by it. */
  #keyOf(record: Row): string {
    const key = this.#host.key();
    return valueKey(key ? record[key] : '');
  }

  /** A row that opens: its toggle in its first cell, and, open, the sub-grid of its
   *  own rows under it, filled from here. Will, TODO 570 */
  draw(tr: HTMLElement, record: Row, body: Element, columnCount: number): void {
    const detail = this.#host.detail();
    if (!detail) return;
    const key = this.#keyOf(record);
    const toggle = this.#host.clone('template.row-open-tpl');
    tr.querySelector('td[data-field]')?.prepend(...(toggle ? [toggle] : []));
    const open = this.#opened.has(key);
    tr.toggleAttribute('data-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (!open) return;
    const row = this.#host.clone('template.detail-tpl');
    const cell = row?.querySelector<HTMLTableCellElement>('.detail-cell');
    if (!row || !cell) return;
    // Every column, the selection's and the actions' too, as a group row spans them.
    cell.colSpan = columnCount + 1 + (this.#host.actions() ? 1 : 0);
    const sub = row.querySelector<SherpaDataGrid>('.detail-grid');
    body.appendChild(row);
    if (!sub) return;
    this.#tell(sub);
    const offer = this.#host.groupOffer();
    void sub.populate({ columns: detail.columns, key: detail.key ?? null, rows: detail.rows[key] ?? [],
      groups: detail.groups?.[key] ?? null, filters: this.#host.filters(), ...(offer ? { groupOffer: offer } : {}) })
      .then(() => {
        this.#tell(sub);
        this.stick();
      });
  }

  /** Open a row on its rows, or shut it, and draw again. */
  toggle(tr: HTMLElement | null): void {
    const record = tr ? this.#host.recordFor(tr) : undefined;
    if (!record) return;
    const key = this.#keyOf(record);
    if (!this.#opened.delete(key)) this.#opened.add(key);
    this.#host.redraw();
  }

  /** Each open sub-grid's headings stay under this grid's as it scrolls. `sticky`
   *  cannot: a scroll box on one axis is one on both, and it scrolls sideways for
   *  itself. Will, TODOs 626, 627. TRAP T-a-sub-grid-sticks-under-its-parent */
  stick = (): void => {
    const foot = this.#host.$('.head')?.getBoundingClientRect().bottom;
    if (foot === undefined) return;
    for (const sub of this.#subGrids()) {
      const { head, table } = this.#host.partsOf(sub);
      if (!head || !table) continue;
      const by = Math.min(foot - table.top, table.height - head.offsetHeight);
      if (by > 0) sub.style.setProperty('--_head-stuck', `${by}px`);
      else sub.style.removeProperty('--_head-stuck');
    }
  };

  /** The open rows' sub-grids. */
  #subGrids(): SherpaDataGrid[] {
    return this.#host.$$<SherpaDataGrid>('.detail-grid');
  }

  /** Each open sub-grid told what this grid holds, as it changes. */
  tellAll(): void {
    for (const sub of this.#subGrids()) if (sub.hasRendered) this.#tell(sub);
  }

  /** A sub-grid is told what this grid holds, so its headings and cells filter the
   *  same rows: each field's answer, what the View holds, and what the filters before
   *  each field leave. TODO 571 */
  #tell(sub: SherpaDataGrid): void {
    for (const name of DETAIL_ATTRS) {
      const value = this.#host.el.getAttribute(name);
      if (value == null) sub.removeAttribute(name);
      else sub.setAttribute(name, value);
    }
    if (!sub.hasRendered) return;
    const { filter } = this.#host;
    sub.supersede(filter.held, filter.heldAt);
    for (const field of filter.fields()) sub.drawReading(field, filter.reading(field)!);
    const { present, offered } = filter.limits;
    sub.drawPresent(present);
    sub.drawOffered(offered);
    sub.drawHighlight(this.#host.highlight());
  }
}
