/**
 * grid-filters.ts — a grid's column filters: each heading's menu, the chip's own,
 * what it holds and how it says it, a multi-field column's joined menu, and the
 * answer a heading reports. What the headings are told lives in one
 * FilterHostController. A module of sherpa-data-grid, not an element. Plan 695 P2, P4
 * TRAP T-a-heading-opens-the-chips-menu · TRAP T-grid-reports-never-combines
 *
 * Map:
 * - filterable — Does a column's heading and cells offer a filter: text, number or date, and not turned off?
 * - FiltersHost — What the column filters ask of their grid.
 * - GridFilters — Each heading's filter: its menu, what it holds, and what it reports.
 * - .filter — What its headings are told and hold, by field.
 * - .given — Each heading's filter as its source defines it, as the last populate gave them.
 * - .take — The filters a populate gave.
 * - .begin — A heading row is drawn: its joined menus are joined again.
 * - .made — A heading cell was made again: its menu holds nothing, and has no values yet.
 * - .def — A heading's filter: the source's def of its field, else one made from the column.
 * - .cellKey — What makes a heading cell: its type, and its menu's shape.
 * - .build — Give a new heading its filter chip's menu.
 * - .draw — Draw a heading's filter, its menu kept: each write only where it changed.
 * - .light — Turn one column's filter chip on or off, and say its kind.
 * - .lightHeading — A heading is ACTIVE while its column sorts or filters.
 * - .syncStatus — Every heading lit again, the header row not rebuilt.
 * - .shown — What a heading SHOWS: a scope above's answer when it holds the field, else its own.
 * - .parentOf — The tiered field a field is the CHILD of.
 * - .inForce — One column's answer IN FORCE, as the data layer reads it.
 * - .report — Report one column's answer.
 * - .commit — Apply or clear one column's filter, from its menu's footer.
 * - .remove — REMOVE FILTER: ends a column's filter, reported as a clear.
 * - .stop — A heading chip's own events stop here: it is reused for its menu.
 * - .set — Set one column's filter from a clause.
 * - .clauseOf — One column's filter as a ready clause, or null.
 * - .readingOf — One column's filter as a reading, or null.
 * - .labelOf — One column filter as a reader sees it, or null.
 * - .suspend — Suspend or resume one column's filter, never lose it.
 * - .clear — Drop one column's filter, or every one.
 * - .tagsOf — The fields a column draws as tags, while multi-field columns are on.
 * - .join — A multi-field column's heading menu: its own list, then each tag field's.
 * - .optionsOf — A field's values, in the order a chart colours them.
 * - .fieldLabel — A field's name, as its heading says it.
 * - .picksOf — A field's ticked values in force.
 */
import { advancedOf, kindOf } from '../../core/ui/filter-kind.js';
import { menuFor, type FilterMenuDef, type FilterMenuItem } from '../../core/ui/filter-menu.js';
import { FilterHostController, type FieldPlace } from '../../core/ui/filter-host-controller.js';
import { MOST_LISTED } from '../../core/data/field-catalogue.js';
import { filterCondition, valueKey, type Filter } from '../../core/data/store.js';
import { answeredCondition, fieldState, modeOf, readingClause, type FieldFacts, type FieldReading, type FieldType, type FilterState } from '../../core/data/filter-state.js';
import { filterFace } from '../../core/data/filter-face.js';
import { readingAnswered, sameReading } from '../../core/data/query.js';
import { treeReading } from '../../core/data/where.js';
import type { ColumnFacts } from '../../core/data/column-facts.js';
import type { FieldFilter } from '../../core/data/data-source.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';
import type { SherpaQuickFilter } from '../sherpa-quick-filter/sherpa-quick-filter.js';
import type { GridColumn } from './sherpa-data-grid.js';
import type { GridHost } from './grid-host.js';

/** The `fx` glyph a CONDITION wears, wherever one is drawn. */
const CONDITION_ICON = 'function';

/** A joined menu's row: its field, then its value. TODO 490 */
const JOIN = '\u001f';
const joinKey = (field: string, value: string): string => `${field}${JOIN}${value}`;
const keyField = (key: string): string => key.slice(0, key.indexOf(JOIN));
const keyValue = (key: string): string => key.slice(key.indexOf(JOIN) + 1);

/** The column types a heading can filter. Every body is the menu's own.
    TRAP T-a-menu-owns-its-own-bodies */
const FILTERABLE: ReadonlySet<string> = new Set(['text', 'number', 'date']);

/** Does a column's heading and cells offer a filter: text, number or date, and not
 *  turned off — a count is not a field. TODO 571 · TRAP T-grid-untyped-column-gets-no-filter-button */
export function filterable(col: GridColumn): boolean {
  return col.filterable !== false && FILTERABLE.has(col.type ?? 'text');
}

/** What the column filters ask of their grid. */
export interface FiltersHost extends GridHost {
  /** Its shadow root: a heading's menu is made in it. */
  readonly root: ShadowRoot;
  /** The columns, as populated. */
  columns(): readonly GridColumn[];
  /** What the data layer says of its rows. */
  facts(): ColumnFacts;
  /** What its headings hold moved: draw them, and the body once. `head`, the whole row. */
  drawReadings(head?: boolean): void;
  /** One column's answer: the grid reports it. */
  reported(detail: { field: string; header: string; clause: unknown[] | null; reading: FieldReading | null; label: string | null }): void;
}

/** Each heading's filter: its menu, what it holds, and what it reports. */
export class GridFilters {
  /** Its grid. */
  readonly #host: FiltersHost;
  /** What its headings are told and hold, by field: limits, what the View holds, each
   *  column's answer — held, never applied. Plan 695 P2 */
  readonly filter: FilterHostController;
  /** Each heading's filter as its source defines it, as the last populate gave them. */
  #given: Readonly<Record<string, FieldFilter>> = {};
  /** Each field's label as its source names it: a heading with no filter reads it. */
  #headings: Readonly<Record<string, string>> = {};
  /** What each heading menu was last told it holds, by field — or what its reader applied. */
  #drawn = new Map<string, FieldReading | null>();
  /** Each heading menu's values, as it was last told them, by field. */
  #itemsFor = new Map<string, string>();
  /** Each joined heading's fields, by its column, as last drawn. */
  #joined = new Map<string, string[]>();

  constructor(host: FiltersHost) {
    this.#host = host;
    this.filter = new FilterHostController({
      el: host.el,
      places: () => this.#places(),
      parentOf: (field) => this.parentOf(field),
      limitsOf: ({ field }, { present, offered }) => {
        const joined = this.#joined.get(field);
        return joined && { present: this.#joinedLimit(joined, present), offered: this.#joinedLimit(joined, offered) };
      },
      paint: () => host.drawReadings(),
    });
  }

  /** Each heading's filter chip, by its field. */
  *#places(): Iterable<FieldPlace> {
    for (const cell of this.#host.$$<HTMLElement>('.head-cell[data-field]')) {
      const chip = cell.querySelector<SherpaQuickFilter>('.head-filter');
      if (chip) yield { field: cell.dataset['field']!, chip };
    }
  }

  /** Each heading's filter as its source defines it, as the last populate gave them. */
  get given(): Readonly<Record<string, FieldFilter>> {
    return this.#given;
  }

  /** The filters a populate gave, and each field's label. */
  take(filters: Readonly<Record<string, FieldFilter>> | undefined, headings?: Readonly<Record<string, string>>): void {
    this.#given = filters ?? {};
    this.#headings = headings ?? {};
  }

  /** A heading row is drawn: its joined menus are joined again. */
  begin(): void {
    this.#joined.clear();
  }

  /** A heading cell was made again: its menu holds nothing, and has no values yet. */
  made(field: string): void {
    this.#drawn.delete(field);
    this.#itemsFor.delete(field);
  }

  /** The column a field heads. */
  #column(field: string): GridColumn | undefined {
    return this.#host.columns().find((c) => c.field === field);
  }

  /**
   * A heading's filter: the SOURCE's def of its field — its Advanced offer, its
   * whole value list and their names, a date's days — else one made from the
   * column, where a text column offers conditions as it always has.
   */
  def(col: GridColumn, held: FieldReading | undefined): FilterMenuDef {
    const kind = col.type ?? 'text';
    const given = this.#given[col.field];
    const facts = this.#host.facts();
    // Its values only where a list shows them: the work is not done to be thrown away. TODO 355
    const asked = !given && kind === 'text' && kindOf(col) !== 'advanced';
    const offered = asked ? facts.values(col.field) : [];
    // More than a list shows, and it is Advanced alone. Will, D10 · TRAP T-a-list-has-a-limit
    const many = offered.length > MOST_LISTED;
    const listed = asked && !many;
    const values = listed ? offered : [];
    const own: FilterMenuDef = given ? { ...given } : {
      // No offer is Advanced too, for a text column.
      ...(kind === 'text'
        ? { advanced: many ? 'only' as const : col.advanced ?? true, ...(col.op || many ? { op: col.op ?? 'contains' } : {}) }
        : { kind: kind as 'number' | 'date', ...(col.advanced != null ? { advanced: col.advanced } : {}) }),
      ...(listed ? { options: values.map((v) => ({ value: v, label: v })) } : {}),
    };
    // A NUMBER's slider spans the values it HAS: the 0..100 default crushes a spend column.
    const ends = kind === 'number' && own.min == null ? facts.range(col.field) : undefined;
    return {
      ...own, ...ends, id: col.field, label: this.fieldLabel(col.field), commit: true,
      ...(kind === 'text' && !own.select ? { select: 'multiple' as const } : {}),
      // A HELD shape wins. TRAP T-a-default-is-not-an-override
      // A date's range is its own shape; a number's is an Advanced row. TODO 375
      ...(kind === 'date' && held ? { range: !!held.range } : {}),
    };
  }

  /** What makes a heading cell: its type, and its filter menu's SHAPE — not its
   *  values, its ends or its days, which a kept menu is told. */
  cellKey(col: GridColumn, def: FilterMenuDef | null): string {
    if (!def) return JSON.stringify([col.type ?? 'text', false]);
    const { options: _options, min: _min, max: _max, availableDates: _days, ...shape } = def;
    const { dataset } = this.#host.el;
    // TRAP T-a-default-is-not-an-override
    // …and the flags its menu is made under. TODO 523 U20
    return JSON.stringify([col.type ?? 'text', true, { ...shape, range: !!def.range }, dataset['bounds'] ?? '', dataset['applyOn'] ?? '']);
  }

  /**
   * Give a new heading its filter chip's menu — the CHIP's own menu, made by
   * `menuFor()` from the source's def of its field, so one field opens one menu
   * wherever it is asked. Will, TODO 86
   */
  build(th: HTMLElement, def: FilterMenuDef): void {
    const chip = th.querySelector<HTMLElement>('.head-filter');
    if (!chip) return;
    const { dataset } = this.#host.el;
    // A top-layer popover escapes the scroller, inside the HOST's named region.
    const { menu } = menuFor(this.#host.root, def, { bounds: dataset['bounds'], live: dataset['applyOn'] === 'input' });
    // Clear empties the controls and keeps the menu open; Remove drops the clause.
    menu.setAttribute('data-removable', '');
    chip.appendChild(menu);
    /* Upgraded FIRST: a property set on a plain element hides the setter for good.
       TRAP T-custom-element-upgrade */
    customElements.upgrade(menu);
  }

  /** Draw a heading's filter — its menu kept, so an open one stays open, with its
   *  search, focus and an unapplied draft. Each write only where it changed.
   *  TRAP T-a-heading-menu-opens-on-what-it-holds · TRAP T-both-answers-are-kept */
  draw(th: HTMLElement, col: GridColumn, def: FilterMenuDef, held: FieldReading | undefined): void {
    const chip = th.querySelector<SherpaQuickFilter>('.head-filter');
    const menu = chip?.querySelector<SherpaMenu>('sherpa-menu');
    if (!chip || !menu) return;
    /* HELD HIGHER: shown, greyed, and refused here — the reader changes it where
       it is held. TRAP T-a-view-held-heading-shows-and-refuses */
    // A joined menu leaves out what the View holds. TODO 490
    const superseded = !this.#joined.has(col.field) && this.filter.heldAbove(col.field);
    const was = chip.hasAttribute('data-superseded');
    this.filter.hold(chip, superseded);
    menu.toggleAttribute('data-readonly', superseded);
    chip.setAttribute('aria-label', `Filter ${def.label}`);
    // A preset holds it: it says so, as a bar's chip does. Will, TODO 521
    chip.presets = held?.byPreset;
    // Its values, its ends, its days — told only when they moved, so the search text stays.
    const on = new Set((held?.picked ?? []).map(valueKey));
    const items: FilterMenuItem[] = (def.options ?? []).map((item) => ({ ...item, selected: on.has(item.value) }));
    const itemsKey = JSON.stringify(items.map((it) => [it.value, it.label]));
    if (items.length && this.#itemsFor.get(col.field) !== itemsKey) {
      this.#itemsFor.set(col.field, itemsKey);
      // An OPEN menu keeps its reader's draft through new values (Will, G1).
      const draft = menu.open ? menu.values ?? [] : null;
      menu.items(items);
      if (draft) menu.values = draft.filter((v) => items.some((it) => it.value === v));
    }
    if (menu.dataset['body'] === 'number') {
      menu.setAttribute('data-min', String(def.min ?? 0));
      menu.setAttribute('data-max', String(def.max ?? 100));
    }
    if (def.availableDates?.length) menu.setAttribute('data-available', def.availableDates.join(','));
    /* THE MENU HOLDS ITS OWN — both answers and the mode, a date's days too —
       told only when what it holds CHANGED, so a reader's draft survives a push. */
    const drawn = this.#drawn.get(col.field);
    const wrote = !this.#drawn.has(col.field) || !sameReading(drawn, held ?? null);
    if (wrote) {
      this.#drawn.set(col.field, held ?? null);
      // A tree IS the opt-in reaching the menu. TRAP T-many-conditions-are-one-reading
      if (held && answeredCondition(held.tree)) menu.setAttribute('data-advanced', '');
      else if (!advancedOf(def)) menu.removeAttribute('data-advanced');
      if (held) menu.reading = held;
      else if (drawn) {
        // Released from outside: emptied, as Clear empties it.
        if (menu.getAttribute('data-type') === 'filter') menu.setAttribute('data-value', '');
        menu.reading = {};
      }
      // Written while open (Will, G1 A): Cancel now restores THIS. TRAP T-the-baseline-is-taken-at-show
      if (menu.open) menu.takeBaseline();
    }
    // A kept chip draws its face again from what its menu now holds: its tip says so.
    if (wrote || was !== superseded) chip.refresh();
    if (superseded) menu.present = null;
    else this.filter.limit({ field: col.field, chip });
  }

  /**
   * Turn one column's FILTER CHIP on or off. THE CHIP IS THE SIGNAL — the heading
   * is deliberately not tinted, and `#isFiltered` knows the whole answer, a filter
   * arriving through the QUERY included. The chip is `data-locked`, so the GRID
   * owns its on-state. TRAP T-the-column-chip-is-the-only-signal
   */
  light(th: HTMLElement, field: string): void {
    const chip = th.querySelector<HTMLElement>('.head-filter');
    if (!chip) return;
    // A joined menu is on while it ticks anything. TODO 490
    const joined = this.#joined.get(field);
    chip.toggleAttribute('data-current', joined ? joined.some((f) => this.picksOf(f, true).length > 0) : this.#isFiltered(field));
    // Waiting for Apply, or unread: it says so, as a toolbar's chip does. TODO 613
    this.filter.pend({ field, chip: chip as SherpaQuickFilter }, false);
    /* THE GLYPH SAYS WHICH KIND. A column answered by a CONDITION — "contains",
       "starts with" — wears the `fx` glyph, so a reader can tell a typed rule from a ticked list without opening it.
       An icon-only chip falls back to its funnel when no icon is named.
       TRAP T-a-condition-badge-says-that-not-which */
    const held = joined ? undefined : this.shown(field);
    /* THE SAME ANSWER a toolbar chip reads — `state.condition`, from this
       column's reading. TRAP T-one-condition-system */
    const condition = held ? this.inForce(field, held).condition : null;
    if (condition === 'advanced') chip.setAttribute('data-icon-start', CONDITION_ICON);
    else chip.removeAttribute('data-icon-start');
    /* The chip is TOLD its condition too, from the SAME answer as the glyph.
       TRAP T-a-conditioned-chip-reads-as-active
       TRAP T-an-external-chip-caret-must-open-its-condition */
    if (condition) chip.dataset['condition'] = condition;
    else chip.removeAttribute('data-condition');
  }

  /** A heading is ACTIVE while its column sorts or filters. The grid's CSS paints
   *  nothing from it; a host may style it. */
  lightHeading(th: HTMLElement, field: string): void {
    if (th.hasAttribute('data-sort') || this.#isFiltered(field)) th.dataset['status'] = 'active';
    else delete th.dataset['status'];
  }

  /** Every heading lit again, the header row not rebuilt. */
  syncStatus(): void {
    for (const th of this.#host.$$<HTMLElement>('.head-cell')) {
      const field = th.dataset['field'];
      if (!field) continue;
      this.lightHeading(th, field);
      this.light(th, field);
    }
  }

  /**
   * Is this column narrowed, from EITHER direction? Its own box, its heading's
   * menu (unless SUSPENDED), or `data-filter-fields` from a toolbar it cannot see.
   */
  #isFiltered(field: string): boolean {
    const held = this.filter.reading(field);
    if (held && !held.suspended && this.inForce(field, held).answer) return true;
    // A tiered child, while a higher scope holds its parent: on as its parent is. TODOs 577, 640
    const parent = this.parentOf(field);
    if (parent && this.filter.holds(parent) && this.#isFiltered(parent)) return true;
    const external = this.#host.el.dataset['filterFields'];
    // TRAP T-grid-filter-fields-match-whole — `includes` lights `status` for `substatus`.
    return !!external && external.split(/\s+/).includes(field);
  }

  /** What a heading SHOWS: a higher scope's answer when it holds the field — a
   *  tiered child, what its parent's holds of it — else its own. */
  shown(field: string): FieldReading | undefined {
    const parent = this.parentOf(field);
    const above = parent ? this.filter.heldReading(parent) : undefined;
    if (parent && above) return { picked: this.#childPicks(parent, field, above), ...(above.suspended ? { suspended: true } : {}) };
    return this.filter.heldReading(field) ?? this.filter.reading(field);
  }

  /** What a tiered parent's answer holds of its child: each path's child, by name. TODO 577 */
  #childPicks(parent: string, field: string, reading: FieldReading): string[] {
    const { labels, parentOf } = this.#facts(parent);
    return [...new Set((reading.picked ?? []).flatMap((pick) => {
      const own = (pick as Record<string, unknown> | null)?.[field];
      if (own != null) return [String(own)];
      const key = valueKey(pick);
      return parentOf?.has(key) ? [labels?.[key] ?? key] : [];
    }))];
  }

  /** The tiered field a field is the CHILD of, in the filters it was given. TODO 369 */
  parentOf(field: string): string | undefined {
    return Object.entries(this.#given).find(([, f]) => f.child === field)?.[0];
  }

  /** What the grid knows of a field: its column type and the filter it was given,
   *  whole — its bands, time, range and names, as the data layer reads them; for a
   *  tiered field, each child pick's parent and name too. TODOs 369, 523 F7 */
  #facts(field: string): FieldFacts {
    const type = this.#column(field)?.type;
    const { label, time, range, labels, child, options } = this.#given[field] ?? {};
    const kids = child ? (options ?? []).filter((o) => o.parent) : [];
    const named = { ...labels, ...Object.fromEntries(kids.map((o) => [o.value, o.label])) };
    return {
      field, ...(type ? { type: type as FieldType } : {}),
      ...(child && kids.length ? { child, parentOf: new Map(kids.map((o) => [o.value, o.parent!])) } : {}),
      ...(Object.keys(named).length ? { labels: named } : {}),
      ...(time ? { time: true } : {}),
      ...(range ? { range: true } : {}),
      ...(label ? { label } : {}),
    };
  }

  /** One column's answer IN FORCE, as the data layer reads it — what it WOULD filter
   *  by; whether it is suspended is asked on its own. */
  inForce(field: string, held: FieldReading): FilterState {
    return fieldState(this.#facts(field), { ...held, suspended: false });
  }

  /** One column filter as a store FilterClause, or null. THE DATA LAYER BUILDS IT —
   *  the casting, the range and the picks-to-`in` rule live once. A SUSPENDED clause
   *  is returned too. TRAP T-the-field-type-decides-the-clause · TRAP T-grid-suspend-is-not-clear */
  #clause(field: string, held: FieldReading): unknown[] | null {
    return (readingClause(this.#facts(field), { ...held, suspended: false }) as unknown[] | undefined) ?? null;
  }

  /** One column filter as a chip says it: the chip's own words, `filterFace`. TODO 523 */
  #label(field: string, held: FieldReading): string {
    return filterFace(this.inForce(field, held)).tip;
  }

  /** Report one column's answer: the heading's menu or a cell's chip set it. */
  report(field: string, held: FieldReading | null): void {
    this.#host.reported({
      field,
      header: this.fieldLabel(field),
      // TRAP T-grid-number-clause-must-coerce — the clause is the data layer's.
      clause: held ? this.#clause(field, held) : null,
      // …and as a READING, which the data layer keeps. TRAP T-one-query-one-owner
      reading: held ? { ...held } : null,
      // What a toolbar chip says of it. The field half is `header`.
      label: held ? this.#label(field, held) : null,
    });
  }

  /** Read one column's menu into what it holds — both answers and the mode.
   *  TRAP T-grid-empty-clause-is-null — nothing typed or ticked holds nothing, and a
   *  range of days needs both ends: one is unfinished, not wrong. */
  #read(chip: HTMLElement): FieldReading | null {
    const menu = chip.querySelector<SherpaMenu>('sherpa-menu');
    if (!menu) return null;
    const reading = menu.reading;
    if (menu.dataset['body'] === 'date' && reading.range && (reading.picked ?? []).length < 2) return null;
    return readingAnswered(reading) ? reading : null;
  }

  /** A heading's menu emptied: its typed value, its answer and Cancel's. The shared
   *  filter menu keeps its typed value in an ATTRIBUTE — why it survives a re-stamp —
   *  so clearing reaches that. TRAP T-one-field-one-filter-menu */
  #empty(chip: HTMLElement): void {
    const fm = chip.querySelector<SherpaMenu>('sherpa-menu');
    if (fm?.getAttribute('data-type') === 'filter') fm.setAttribute('data-value', '');
    // The MENU empties its own answer, whatever its body: ticks, rows, a number, a day.
    if (fm) fm.reading = {};
    // And Cancel's answer with it: a kept menu that closes must not tick the old answer back. TRAP T-a-heading-cell-is-kept
    fm?.takeBaseline();
  }

  /** Apply or clear one column's filter, from its menu's footer. It records and
   *  reports, never filters. `explicit`: Remove's, whose synthetic event has no target. */
  commit = (event: Event, explicit?: HTMLElement): void => {
    const chip = explicit ?? (event.target as HTMLElement).closest<HTMLElement>('.head-filter');
    const field = chip?.closest<HTMLElement>('.head-cell')?.dataset['field'];
    if (!chip || !field) return;
    const cleared = event.type === 'menu-clear';
    const joined = this.#joined.get(field);
    if (joined) return this.#commitJoined(chip, field, joined, cleared);
    const held = cleared ? null : this.#read(chip);
    // Only an explicit CLEAR empties the controls: Apply lands here on a half-built
    // range, which is unfinished, not wrong.
    if (cleared) this.#empty(chip);
    // BOUND, it asks: it reports, and its source draws the answer back. 366 step 23
    if (this.#host.el.hasAttribute('data-locked')) return this.report(field, held);
    if (held) this.filter.keep(field, held);
    else {
      this.filter.forget(field);
      chip.removeAttribute('data-current');
    }
    // What the menu holds now is what it was drawn: a push of the same answer writes nothing.
    this.#drawn.set(field, held ? { ...held } : null);
    this.#host.drawReadings(false);
    this.report(field, held);
  };

  /** REMOVE FILTER — ends a column's filter. Reported as a clear, so a host has one path. */
  remove = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== 'remove') return;
    const chip = (event.target as HTMLElement).closest<HTMLElement>('.head-filter');
    if (!chip) return;
    event.stopPropagation();
    chip.querySelector<SherpaMenu>('sherpa-menu')?.close?.();
    this.commit(new CustomEvent('menu-clear', { detail: {}, bubbles: false }), chip);
  };

  /** A heading chip's own events stop here — it is reused for its menu, not its vocabulary. */
  stop = (event: Event): void => {
    if ((event.target as HTMLElement)?.closest?.('.head-filter')) event.stopPropagation();
  };

  /** Set one column's filter from a clause: SILENT unbound; BOUND, it asks as a reader
   *  would. TRAP T-grid-read-without-write-is-half-an-api */
  set(field: string, clause: unknown[] | null): void {
    const held = clause ? this.#fromClause(field, clause) : null;
    if (this.#host.el.hasAttribute('data-locked')) return this.report(field, held);
    if (!held) return this.#forget(field);
    this.filter.keep(field, held);
    // The HEADER is rebuilt, not reached into: one path writes a menu.
    this.#host.drawReadings();
  }

  /** A clause as what a heading HOLDS, or null when it filters by nothing — the data
   *  layer's one reading of a clause. TODO 523 · TRAP T-a-heading-holds-a-whole-reading */
  #fromClause(field: string, clause: unknown[]): FieldReading | null {
    const [, clauseOp, value] = clause as [string, string, unknown];
    // A range with an end missing filters by nothing here.
    if ((clauseOp === 'between' || clauseOp === 'notbetween') && Array.isArray(value) && value.some((v) => v == null || v === '')) return null;
    const held = treeReading(filterCondition(clause as Filter), this.#column(field)?.type as FieldType | undefined);
    // Its picks as the menu's values: text, none empty.
    const picked = held.picked?.map((v) => String(v ?? '')).filter(Boolean);
    const out = picked ? { ...held, picked } : held;
    return readingAnswered(out) ? out : null;
  }

  /** One column's filter as a ready FilterClause, or null — a SUSPENDED one too. */
  clauseOf(field: string): unknown[] | null {
    const held = this.filter.reading(field);
    return held ? this.#clause(field, held) : null;
  }

  /** One column's filter as a READING, or null — what a saved view set on it. */
  readingOf(field: string): FieldReading | null {
    const held = this.filter.reading(field);
    return held ? { ...held } : null;
  }

  /** One column filter as a reader sees it — "Contains: ana" — or null. */
  labelOf(field: string): string | null {
    const held = this.filter.reading(field);
    return held ? this.#label(field, held) : null;
  }

  /** Suspend or resume, never lose; bound, it asks. The MATCH MARKS go too: a suspended
   *  filter hides no rows. TRAP T-grid-suspend-is-not-clear */
  suspend(field: string, suspended: boolean): void {
    const held = this.filter.reading(field);
    if (!held || !!held.suspended === suspended) return;
    if (this.#host.el.hasAttribute('data-locked')) return this.report(field, { ...held, suspended });
    this.filter.keep(field, { ...held, suspended });
    this.#host.drawReadings(false);
  }

  /** Drop one column's filter, or every one: unbound SILENT, bound it asks for each it
   *  holds. TRAP T-grid-clear-from-outside-is-silent */
  clear(field?: string): void {
    if (!this.#host.el.hasAttribute('data-locked')) return this.#forget(field);
    for (const f of field ? [field] : this.filter.fields()) if (this.filter.reading(f)) this.report(f, null);
  }

  /** Drop one column's filter, or every one, and draw the headings — each kept menu
   *  told what it now holds. SILENT. */
  #forget(field?: string): void {
    if (this.filter.forget(field)) this.#host.drawReadings();
  }

  /* ── MULTI-FIELD columns — Will, TODO 490 · TRAP T-a-joined-menu-answers-each-field ── */

  /** The fields a column draws as tags, while multi-field columns are on. */
  tagsOf(col: GridColumn): string[] {
    return this.#host.el.hasAttribute('data-multi-field') ? (col.tags ?? []).filter((f) => f !== col.field) : [];
  }

  /**
   * A multi-field column's heading menu: its own list, then each tag field's — a
   * section each, a row keyed by its field. Simple only: Advanced is the bar's and
   * the panel's. A field the View holds is left out: it is changed there.
   */
  join(col: GridColumn): { def: FilterMenuDef; held: FieldReading | undefined } | null {
    const tags = this.tagsOf(col);
    if (!tags.length) return null;
    const own = filterable(col) && !this.parentOf(col.field) ? this.def(col, undefined) : null;
    const fields = [...(own && kindOf(own) === 'multi' ? [col.field] : []), ...tags].filter((f) => !this.filter.holds(f) && !this.shown(f)?.byPreset);
    if (!fields.length) return null;
    this.#joined.set(col.field, fields);
    const options = fields.flatMap((f) => this.optionsOf(f)
      .map((o) => ({ value: joinKey(f, o.value), label: o.label ?? o.value, section: this.fieldLabel(f) })));
    const picked = fields.flatMap((f) => this.picksOf(f, true).map((v) => joinKey(f, valueKey(v))));
    return {
      // Every value of every field is no answer: no Select all.
      def: { id: col.field, label: this.fieldLabel(col.field), options, select: 'multiple', advanced: false, selectAll: false, commit: true },
      held: picked.length ? { picked } : undefined,
    };
  }

  /** A field's values, in the order a chart colours them: its source's list, else its column's. */
  optionsOf(field: string): readonly FilterMenuItem[] {
    const given = this.#given[field]?.options;
    if (given?.length) return given;
    return this.#host.facts().values(field).map((v) => ({ value: v, label: v }));
  }

  /** A field's name, as its heading says it: its column's, else its source's. */
  fieldLabel(field: string): string {
    return this.#column(field)?.header ?? this.#given[field]?.label ?? this.#headings[field] ?? field;
  }

  /** A field's ticked values in force — none while it is suspended or answered by
   *  conditions; under All, every one when `every` asks. */
  picksOf(field: string, every: boolean): readonly unknown[] {
    const held = this.shown(field);
    if (!held || held.suspended || modeOf(held) === 'advanced') return [];
    if (held.all) return every ? this.optionsOf(field).map((o) => o.value) : [];
    return held.picked ?? [];
  }

  /** A joined menu's limit, keyed: each field's list, or all of a field it does not
   *  limit; null while it limits none. */
  #joinedLimit(fields: readonly string[], by: Readonly<Record<string, readonly string[]>>): string[] | null {
    if (!fields.some((f) => by[f])) return null;
    return fields.flatMap((f) => (by[f] ?? this.optionsOf(f).map((o) => o.value)).map((v) => joinKey(f, v)));
  }

  /** A joined menu's Apply or Clear: each field whose ticks CHANGED is reported as its
   *  own answer; one it does not show, as conditions, is left alone. */
  #commitJoined(chip: HTMLElement, field: string, fields: readonly string[], cleared: boolean): void {
    const menu = chip.querySelector<SherpaMenu>('sherpa-menu');
    const picks = cleared ? [] : (menu?.reading.picked ?? []).map(String);
    if (cleared) this.#empty(chip);
    const was = (this.#drawn.get(field)?.picked ?? []).map(String);
    const changed: Array<[string, FieldReading | null]> = [];
    for (const f of fields) {
      const mine = picks.filter((k) => keyField(k) === f);
      const before = new Set(was.filter((k) => keyField(k) === f));
      if (mine.length === before.size && mine.every((k) => before.has(k))) continue;
      const { all: _all, suspended: _off, ...base } = this.filter.reading(f) ?? {};
      changed.push([f, mine.length ? { ...base, picked: mine.map(keyValue), mode: 'simple' } : null]);
    }
    this.#drawn.set(field, picks.length ? { picked: picks } : null);
    if (!this.#host.el.hasAttribute('data-locked')) {
      for (const [f, reading] of changed) {
        if (reading) this.filter.keep(f, reading);
        else this.filter.forget(f);
      }
      this.#host.drawReadings();
    }
    for (const [f, reading] of changed) this.report(f, reading);
  }
}
