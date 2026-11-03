/**
 * grid-groups.ts — a grid's groups and its visual page: each group's heading row,
 * which ones the reader shut, and the page the data layer cuts from the rows in
 * hand with them. A module of sherpa-data-grid, not an element.
 * TRAP T-a-group-is-a-data-layer-concept · TRAP T-grid-collapsed-group-is-one-slot
 *
 * Map:
 * - GroupsHost — What the groups ask of their grid.
 * - GridGroups — The groups shut, their heading rows, and the page they leave.
 * - .paginates — Whether the grid — not the store — is deciding where a page ends.
 * - .page — The rows in the order drawn, and the page of them: the data layer's answer.
 * - .report — How many pages the fold makes, reported.
 * - .heading — One group's heading row, spanning every drawn column.
 * - .fold — Fold a group, or open it.
 * - .syncShut — Each row of a shut group marked; CSS hides it.
 */
import { coerceNum } from '../../core/ui/sherpa-element.js';
import { sortDirectionFrom } from '../../core/data/cycle.js';
import type { ColumnFacts, PageAsk, RowPage } from '../../core/data/column-facts.js';
import type { GridHost } from './grid-host.js';

/** What the groups ask of their grid. */
export interface GroupsHost extends GridHost {
  /** The field it groups by, or none. */
  group(): string | undefined;
  /** What the data layer says of its rows. */
  facts(): ColumnFacts;
  /** Did its rows come ordered — bound, its source's; open on sub-grids, theirs? */
  ordered(): boolean;
  /** Its row actions, which add a trailing column. */
  actions(): number;
  /** Draw its body again, and what is marked on it. */
  redraw(): void;
  /** The fold made this many pages: the grid reports it. */
  paged(pages: number, page: number): void;
  /** A group was folded or opened: the grid reports it. */
  toggled(value: string, collapsed: boolean): void;
}

/** The groups shut, their heading rows, and the page they leave. */
export class GridGroups {
  /** Its grid. */
  readonly #host: GroupsHost;
  /** Collapsed group values. Off the DOM, which a draw replaces. */
  #shut = new Set<string>();

  constructor(host: GroupsHost) {
    this.#host = host;
  }

  /** The page size the host asked for, or 0 when it wants no visual paging. */
  get #size(): number {
    return coerceNum(this.#host.el.dataset['pageSize'], 0, { min: 0, int: true });
  }

  /** The 1-based page the host asked for. */
  get #page(): number {
    return coerceNum(this.#host.el.dataset['page'], 1, { min: 1, int: true });
  }

  /** Whether the grid — not the store — is deciding where a page ends: grouped, a
   *  store's window cannot know what is shut. Ungrouped, its window IS the page. */
  get paginates(): boolean {
    return Boolean(this.#host.group()) && this.#size > 0;
  }

  /** The rows in the order drawn, and the page of them: the data layer's answer. */
  page(): RowPage {
    return this.#host.facts().page(this.#ask());
  }

  /** What it asks of its rows. Bound, its source ordered them; its rows OPEN, its
   *  order is its sub-grids'. Alone, they are ordered by its own sort and group.
   *  TODOs 523, 574 · TRAP T-bind-locks-what-it-owns */
  #ask(): PageAsk {
    const group = this.#host.group();
    const paged = group ? { group, page: this.#page, size: this.#size, shut: this.#shut } : {};
    if (this.#host.ordered()) return paged;
    /* SUSPENDED: the column is remembered, the sort not applied — an empty
       direction says so. `?? 'asc'` is a column with no direction yet.
       TRAP T-a-suspended-sort-is-one-owners-job · TRAP T-one-cycle-for-one-value */
    const direction = this.#host.el.dataset['sortDirection'];
    const field = direction === '' ? undefined : this.#host.el.dataset['sortField'];
    return { ...paged, order: true, ...(field ? { sort: { field, direction: sortDirectionFrom(direction) ?? 'asc' } } : {}) };
  }

  /** How many pages the CURRENT fold makes, reported on every draw — folding adds and
   *  removes pages. TRAP T-grid-reports-never-combines — a REPORT; the grid never
   *  writes its own data-page. */
  report(pages: number): void {
    if (!this.paginates) return;
    const page = Math.min(Math.max(this.#page, 1), pages);
    if (String(pages) === this.#host.el.dataset['totalPages'] && page === this.#page) return;
    this.#host.paged(pages, page);
  }

  /** One group's heading row, spanning every drawn column — the selection's, which
   *  exists whether or not it shows, and the actions'. A short span leaves the
   *  pinned cell floating over a gap. */
  heading(key: string, size: number, columnCount: number): HTMLElement {
    const tr = this.#host.clone('template.group-row-tpl');
    if (!tr) throw new Error('sherpa-data-grid: template.group-row-tpl is missing or empty');
    tr.dataset['groupKey'] = key;
    const collapsed = this.#shut.has(key);
    // CSS draws the chevron rotation and hides the group's rows off this flag.
    tr.toggleAttribute('data-collapsed', collapsed);
    tr.querySelector<HTMLTableCellElement>('.group-cell')!.colSpan = columnCount + 1 + (this.#host.actions() ? 1 : 0);
    tr.querySelector('.group-label')!.textContent = key === '' ? this.#host.word('no-group') : key;
    tr.querySelector('.group-count')!.textContent = String(size);
    this.#say(tr.querySelector('.group-toggle'), key, collapsed);
    return tr;
  }

  /** A group's toggle says whether it is open, and what pressing it does. */
  #say(toggle: Element | null, key: string, collapsed: boolean): void {
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    toggle?.setAttribute('aria-label', `${this.#host.word(collapsed ? 'expand' : 'collapse')} ${key || this.#host.word('ungrouped')}`);
  }

  /** Fold a group, or open it — kept across the next draw. WHEN THE GRID PAGES,
   *  FOLDING CHANGES WHAT IS ON THE PAGE: shutting a group frees slots and rows move
   *  up, so the body is drawn again; a visibility sync alone leaves a hole. */
  fold(groupRow: HTMLElement): void {
    const key = groupRow.dataset['groupKey'] ?? '';
    const collapsed = !groupRow.hasAttribute('data-collapsed');
    groupRow.toggleAttribute('data-collapsed', collapsed);
    if (collapsed) this.#shut.add(key);
    else this.#shut.delete(key);
    this.#say(groupRow.querySelector('.group-toggle'), key, collapsed);
    this.syncShut();
    if (this.paginates) this.#host.redraw();
    this.#host.toggled(key, collapsed);
  }

  /** Each row of a shut group marked; CSS hides it. A sibling selector cannot reach
   *  past a group row, so each row carries its own flag. */
  syncShut(): void {
    for (const row of this.#host.$$<HTMLElement>('.row')) {
      const key = row.dataset['groupKey'];
      row.toggleAttribute('data-hidden', key != null && this.#shut.has(key));
    }
  }
}
