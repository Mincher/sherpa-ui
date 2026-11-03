/**
 * grid-cells.ts — what a grid's cells draw beyond their text: the marks a filter
 * matched, a status's icon and label, a multi-field column's tags, and the one
 * cell chip that adds or takes off the value under the pointer. A module of
 * sherpa-data-grid, not an element. Will, TODOs 373, 490 · plan 683
 *
 * Map:
 * - CellsHost — What the cells ask of their grid.
 * - GridCells — The marks, tags, statuses and the cell chip a grid's cells draw.
 * - .take — The one cell chip, from the template: a draw parks it, and a cell takes it.
 * - .park — The chip goes home before the body is drawn again: it would leave with its row.
 * - .over — The pointer came into a cell: the chip goes there.
 * - .leave — The pointer left the rows.
 * - .placeAgain — The rows were drawn again under a pointer that has not moved: the chip finds its cell.
 * - .fill — Write one cell's text, marking what a TEXT filter matched.
 * - .status — A value's status on its field, where its field's values have looks.
 * - .drawStatus — A status cell: its status icon, then its plain label.
 * - .tags — A multi-field cell's second row: a tag per field with a value.
 * - .tag — A tag pressed: its value is added to its field's answer, or let go.
 */
import { markNeedles } from '../../core/ui/mark-text.js';
import { heldByPreset } from '../../core/ui/shared-constants.js';
import { OP_TAKES, conditionLeaves, groupOf, joinConditions, valueKey, type Condition, type ConditionLeaf, type Row } from '../../core/data/store.js';
import { answeredCondition, modeOf, type FieldReading } from '../../core/data/filter-state.js';
import { readingAnswered } from '../../core/data/query.js';
import { kindOf } from '../../core/ui/filter-kind.js';
import type { SherpaQuickFilter } from '../sherpa-quick-filter/sherpa-quick-filter.js';
import { filterable, type GridFilters } from './grid-filters.js';
import type { GridFind } from './grid-find.js';
import type { GridColumn } from './sherpa-data-grid.js';
import type { GridHost } from './grid-host.js';

/** A cell's value, as its filter chip filters on it. TODO 373 */
interface CellValue { field: string; kind: string; value: unknown; key: string; header: string; text: string; held: boolean }
/** A status value's look and label, as its cell draws them. Plan 683 */
type StatusMark = { status: string; label: string };
/** Each status's icon. */
const STATUS_ICONS: Record<string, string> = {
  success: 'status-ok', warning: 'status-warning', critical: 'status-critical', info: 'status-info', urgent: 'status-urgent',
};

/** What the cells ask of their grid. */
export interface CellsHost extends GridHost {
  /** The columns, as populated. */
  columns(): readonly GridColumn[];
  /** Its column filters, and its Find's needles from outside. */
  readonly filters: GridFilters;
  readonly find: GridFind;
  /** The shadow root, for what is under the pointer. */
  readonly root: ShadowRoot;
  /** What its headings hold moved: draw them, and the body once. */
  drawReadings(): void;
}

/** The marks, tags, statuses and the cell chip a grid's cells draw. */
export class GridCells {
  /** Its grid. */
  readonly #host: CellsHost;
  /** The one cell chip, kept: a draw parks it, and a cell takes it. TRAP T-a-cell-chip-is-one-and-moves */
  #chip: SherpaQuickFilter | null = null;
  /** Where the pointer last entered a cell, while it is over the rows. */
  #pointer: { x: number; y: number } | null = null;

  constructor(host: CellsHost) {
    this.#host = host;
  }

  /** The one cell chip, from the template, and what pressing it does. */
  take(chip: SherpaQuickFilter | null): void {
    this.#chip = chip;
    chip?.addEventListener('quick-filter-click', this.#pressed);
  }

  /** The chip goes home before the body is drawn again: it would leave with its row. */
  park(): void {
    if (this.#chip) this.#host.$('.cell-filter-home')?.appendChild(this.#chip);
  }

  /** The pointer came into a cell: the chip goes there. */
  over = (event: Event): void => {
    const { clientX: x, clientY: y } = event as PointerEvent;
    this.#pointer = { x, y };
    this.#place(event.target as Element);
  };

  /** The pointer left the rows. */
  leave = (): void => {
    this.#pointer = null;
  };

  /** The rows were drawn again under a pointer that has not moved: the chip finds its
   *  cell, placed after layout rather than forcing it. */
  placeAgain(): void {
    if (this.#pointer) requestAnimationFrame(() => {
      if (this.#pointer) this.#place(this.#host.root.elementFromPoint(this.#pointer.x, this.#pointer.y));
    });
  }

  /** Put the chip in the cell at `el`, on when its value is in force. */
  #place(el: Element | null): void {
    const td = el?.closest?.<HTMLElement>('td.cell[data-field]');
    const at = td ? this.#value(td) : null;
    const chip = this.#chip;
    if (!td || !at || !chip) return;
    if (chip.parentElement !== td) td.appendChild(chip);
    const on = this.#on(at);
    chip.toggleAttribute('data-current', on);
    // ON, it takes the value off: a cross, in critical (its pin). Will, TODO 416
    if (on) chip.setAttribute('data-icon-start', 'cross');
    else chip.removeAttribute('data-icon-start');
    // HELD HIGHER: shown inactive, as its heading is. Will, 374. TRAP T-a-view-held-heading-shows-and-refuses
    this.#host.filters.filter.hold(chip, at.held);
    chip.setAttribute('aria-label', `Filter ${at.header}: ${at.text}`);
  }

  /** The value a cell offers its field, or null where none can be filtered on: no
   *  filter for its type, or empty. */
  #value(td: HTMLElement): CellValue | null {
    const { filters } = this.#host;
    const field = td.dataset['field']!;
    const col = this.#host.columns().find((c) => c.field === field);
    const kind = col?.type ?? 'text';
    if (!col || !filterable(col)) return null;
    const row = this.#host.recordFor(td);
    const raw = row?.[field];
    if (raw == null || raw === '') return null;
    /* A CHILD's cell picks its PATH on the parent field: this site of this
       customer. TODO 369 · TRAP T-a-parent-pick-is-the-parent */
    const parent = filters.parentOf(field);
    // A preset holds its values: no cell changes them. Will, TODO 601
    if (filters.shown(parent ?? field)?.byPreset) return null;
    if (parent) {
      const value = { [parent]: row?.[parent], [field]: raw };
      return { field: parent, kind, value, key: valueKey(value), header: filters.given[parent]?.label ?? parent,
        text: td.textContent?.trim() || String(raw), held: filters.filter.holds(parent) };
    }
    // A date is filtered by its DAY: one day is "On", two would be "Between".
    const day = kind === 'date' ? /^\d{4}-\d{2}-\d{2}/.exec(raw instanceof Date ? raw.toISOString() : String(raw))?.[0] : undefined;
    if (kind === 'date' && !day) return null;
    const value = day ?? raw;
    // A multi-field cell's text is its own: its tags are not.
    const text = td.hasAttribute('data-tags') ? String(value) : td.textContent?.trim() || String(value);
    return { field, kind, value, key: valueKey(value), header: col.header ?? field, text, held: filters.filter.holds(field) };
  }

  /** Is this cell's value in force on its field: picked in Simple, or an "Is" row in Advanced? */
  #on(at: CellValue): boolean {
    const held = this.#host.filters.shown(at.field);
    if (!held || held.suspended) return false;
    const values = modeOf(held) === 'advanced' ? isValues(held) : held.picked ?? [];
    return values.some((v) => valueKey(v) === at.key);
  }

  /** The cell chip was pressed: its value is added to its field, or taken off. A field
   *  the View holds is changed there. */
  #pressed = (event: Event): void => {
    event.stopPropagation();
    const td = this.#chip?.parentElement;
    const at = td?.matches('td.cell') ? this.#value(td) : null;
    if (at && !at.held) this.#toggle(at, this.#on(at));
  };

  /** Add a value to its field's answer, or take it off. The last let go of a list
   *  filters nothing (Will, TODO 550). */
  #toggle(at: CellValue, on: boolean): void {
    const { filters } = this.#host;
    // All ends here: a value is picked or let go. TODO 489
    const { all: _all, ...held } = filters.filter.reading(at.field) ?? {};
    const col = this.#host.columns().find((c) => c.field === at.field);
    // A field with no list to tick answers by conditions only: its value is an "Is" row.
    const byConditions = !!col && kindOf(filters.def(col, filters.filter.reading(at.field))) === 'advanced';
    let next: FieldReading;
    if (byConditions) {
      // Its value is an "Is" condition, OR'd with the others: the shape its chip holds.
      const kept = withoutValue(answeredCondition(held.tree), at.key);
      const tree = on ? kept : joinConditions('or', [kept, { op: 'eq', value: at.value }]);
      const { tree: _was, ...rest } = held;
      next = { ...rest, ...(tree ? { tree } : {}), mode: 'advanced' };
    } else {
      const rest = (held.picked ?? []).filter((v) => valueKey(v) !== at.key);
      /* One value only where a second would change the question: a day, a number
         (Simple holds one, Will, 375), a single pick. */
      const one = at.kind === 'date' || at.kind === 'number' || filters.given[at.field]?.select === 'single';
      const picked = on ? rest : one ? [at.value] : [...rest, at.value];
      // The last value let go of a list filters nothing. Will, TODO 550
      next = { ...held, picked, mode: 'simple', ...(at.kind === 'number' ? { range: false } : {}) };
    }
    delete next.suspended;
    const reading = readingAnswered(next) ? next : null;
    if (reading) filters.filter.keep(at.field, reading);
    else filters.filter.forget(at.field);
    // Reported FIRST: a bound grid's source asks for its rows, and the body waits for them.
    filters.report(at.field, reading);
    // The heading's menu is told by the redraw: what it holds no longer matches.
    this.#host.drawReadings();
  }

  /**
   * Write one cell's text, marking what a TEXT filter matched. TRAP
   * T-grid-mark-is-substring-only — substring ops only, and the CELL's casing wins.
   */
  fill(td: HTMLElement, text: string, col: GridColumn): void {
    if ((col.type ?? 'text') !== 'text') {
      td.textContent = text;
      return;
    }
    const { filters, find } = this.#host;
    // What FILTERS here: the View's answer while it holds the field, else the heading's own.
    // TRAP T-a-view-held-heading-shows-and-refuses
    const held = filters.shown(col.field);
    // EVERY row's string, not the first. TRAP T-a-condition-marks-every-match
    const own = conditionLeaves(held && !held.suspended ? filters.inForce(col.field, held).answer : undefined)
      .flatMap(({ op, value }) => (OP_TAKES[op] === 'text' && op !== 'last' && op !== 'next' ? [{ op, text: String(value) }] : []));
    /* A toolbar chip's condition reaches here through `data-needles`, because
       the grid cannot see the bar that holds it. Without this a chip filtering
       "Contains Ravi" narrowed the rows and marked nothing.
       TRAP T-a-needle-comes-from-either-direction */
    markNeedles(td, text, [...(own.length ? own : find.needles(col.field)), ...find.needles('*')]);
  }

  /** A value's status on its field — its look and its label — where its field's values
   *  have looks: a status field's. Asked once per field per draw. */
  status(field: string, key: string, marks: Map<string, Map<string, StatusMark>>): StatusMark | undefined {
    let mark = marks.get(field);
    if (!mark) {
      mark = new Map(this.#host.filters.optionsOf(field).flatMap((o) =>
        (typeof o.swatch === 'string' ? [[o.value, { status: o.swatch, label: o.label ?? o.value }] as const] : [])));
      marks.set(field, mark);
    }
    return mark.get(key);
  }

  /** A status cell: its status icon, then its plain label. TRAP T-a-status-is-worked-out-by-the-data */
  drawStatus(td: HTMLElement, mark: StatusMark): void {
    const cell = this.#host.clone('template.cell-status-tpl');
    if (!cell) return;
    this.#host.writeIcon(cell.querySelector('.status-icon')!, STATUS_ICONS[mark.status] ?? 'status-neutral');
    cell.querySelector('.status-label')!.textContent = mark.label;
    td.dataset['status'] = mark.status;
    td.appendChild(cell);
  }

  /** A multi-field cell's second row: a tag per field with a value — on where it is
   *  picked, greyed where the View holds its field. TRAP T-a-joined-menu-answers-each-field */
  tags(td: HTMLElement, record: Row, fields: readonly string[], looks: Map<string, Map<string, string>>): void {
    const { filters } = this.#host;
    const row = this.#host.clone('template.cell-tags-tpl');
    if (!row) return;
    for (const field of fields) {
      const raw = record[field];
      if (raw == null || raw === '') continue;
      const tag = this.#host.clone('template.cell-tag-tpl');
      if (!tag) return;
      let look = looks.get(field);
      if (!look) {
        look = new Map(filters.optionsOf(field).map((o) => [o.value, o.label ?? o.value]));
        looks.set(field, look);
      }
      const key = valueKey(raw);
      const label = look.get(key) ?? String(raw);
      tag.dataset['field'] = field;
      tag.dataset['value'] = key;
      const text = tag.querySelector('.tag-label');
      if (text) text.textContent = label;
      const on = this.#tagOn(field, key);
      const held = filters.filter.holds(field);
      tag.toggleAttribute('data-current', on);
      filters.filter.hold(tag, held, false);
      tag.setAttribute('aria-pressed', String(on));
      tag.setAttribute('aria-label', `${filters.fieldLabel(field)}: ${label}`);
      // Held: it says where its filter went, in the one tag tip. TODO 490
      if (held) tag.setAttribute('aria-disabled', 'true');
      if (held) tag.setAttribute('aria-describedby', 'tag-tip');
      // A preset holds it: refused, and it says why. Will, TODO 601
      const by = Object.values(filters.shown(field)?.byPreset ?? {}).map((p) => p.label).join(', ');
      tag.toggleAttribute('data-held-out', !!by);
      if (by) {
        tag.setAttribute('aria-disabled', 'true');
        tag.setAttribute('title', heldByPreset(by));
      }
      row.appendChild(tag);
    }
    td.toggleAttribute('data-tags', true);
    td.appendChild(row);
  }

  /** Is this value picked on its field — by its reader, not by All? */
  #tagOn(field: string, key: string): boolean {
    return this.#host.filters.picksOf(field, false).some((v) => valueKey(v) === key);
  }

  /** A tag pressed: its value is added to its field's answer, or let go — the last let
   *  go, no filter. One the View holds is refused: its tip says why. */
  tag(tag: HTMLElement): void {
    const { filters } = this.#host;
    const field = tag.dataset['field'];
    const key = tag.dataset['value'];
    const row = tag.closest('.row');
    if (!field || key == null || !row || filters.filter.holds(field) || filters.shown(field)?.byPreset) return;
    const at: CellValue = { field, kind: 'text', value: this.#host.recordFor(row)?.[field], key, header: filters.fieldLabel(field),
      text: tag.textContent?.trim() ?? '', held: false };
    this.#toggle(at, this.#tagOn(field, key));
  }
}

/** A reading's "Is" values: what a condition-only field holds. */
function isValues(reading: FieldReading): unknown[] {
  return conditionLeaves(answeredCondition(reading.tree))
    .flatMap((l) => (l.op === 'eq' ? [l.value] : l.op === 'in' && Array.isArray(l.value) ? l.value : []));
}

/** A tree without its "Is" conditions on one value, by key. */
function withoutValue(tree: Condition | undefined, key: string): Condition | undefined {
  if (!tree) return undefined;
  const parts = groupOf(tree);
  if (parts) return joinConditions(parts[0], parts[1].map((p) => withoutValue(p, key)));
  const { op, value } = tree as ConditionLeaf;
  if (op === 'eq') return valueKey(value) === key ? undefined : tree;
  if (op !== 'in' || !Array.isArray(value)) return tree;
  const left = value.filter((v) => valueKey(v) !== key);
  return !left.length ? undefined : left.length === 1 ? { ...tree, op: 'eq', value: left[0] } : { ...tree, value: left };
}
