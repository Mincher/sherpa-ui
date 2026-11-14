/**
 * query-declarations.ts — what a page DECLARES about its Query: each scope's
 * name, sets, own, fixed and always-on fields and starts, each part, preset and
 * default, each slot's presentation and axes. Never in the Query: a reader
 * changes none of it. A QueryContext holds one. DOM-free.
 *
 * Map:
 * - QueryPart — A part: the one field it answers, the component it narrows, its name, and the bar that draws it.
 * - Preset — One preset: its name, and the readings it writes.
 * - DeclaredPreset — A preset as a page declares it: its id, and what a Preset keeps.
 * - QueryDeclarations — What a page declares about its Query, by scope.
 * - .defaults — Each component's own default filter, by its scope.
 * - .starts — Each scope's answers at the start, as its page defines them.
 * - .labels — Each scope's name as a reader sees it.
 * - .arranges — Each scope's own word on whether it arranges.
 * - .sets — Each scope's filter sets.
 * - .offers — What each component scope has: its own fields.
 * - .parts — Each part, by its scope, in the order first declared.
 * - .version — Moves with each declaration a walk reads: a part, a set.
 * - .part — Declare a part, or forget it; says the bar that drew it, if another draws it now.
 * - .setSets — A scope's filter sets, in order: a field in two keeps its first.
 * - .offer — Say which fields a component scope has; true when that moved.
 * - .fields — The fields a scope may hold: a component's own; the View's, every component's.
 * - .canHold — May this scope hold this field? Up is open; down is closed.
 * - .setPresets — A scope's presets.
 * - .presets — A scope's presets, by id, in order.
 * - .presetsOver — The scopes whose presets write this field.
 * - .define — What its page defines a slot shows.
 * - .presented — A slot's presentation in a view: what is kept, over that view's definition, over the slot's.
 * - .setAxes — What each axis's chip offers — the page's, or a scope's over it.
 * - .axesOf — What each axis offers in a scope's view.
 * - .honour — Which of the reader's picks are in force; true when that moved.
 * - .honours — Is that kind of pick in force?
 * - .setOpen — The answer a field opens on where nothing answers it — a fetching list's first value.
 * - .opens — A scope's opening answers, by field.
 * - .setFixed — A scope's fixed fields, a reader cannot let one go, and those always on, a reader cannot switch off.
 * - .fixed — A scope's fixed fields, in order.
 * - .alwaysOn — A scope's fields always on.
 * - .keepFixed — Each scope holds its fixed fields, leading, and each always-on answer is on, in place.
 * - .fillOpens — Each held field with an opening answer and no answer takes it, in place.
 */
import { copyReading, emptyScope, readingAnswered, VIEW, type AxesDefinition, type AxisOffers, type Presentation, type PresentationDefinition, type Query, type ScopeQuery } from './query.js';
import type { FilterSet } from './data-source-types.js';
import type { FieldReading } from './filter-state.js';
import { report } from './report.js';

/** A PART: the one field it answers, the one component it narrows, its name, and
 *  the slot whose bar draws it — a chart's legend, in its card's toolbar (TODO 670).
 *  TRAP T-a-chart-scope-is-its-legend-field */
export interface QueryPart {
  field: string;
  /** The bind id of the component it narrows. */
  only: string;
  label?: string;
  shownIn?: string;
}

/** One preset: its name, and the readings it writes. TODOs 493, 510 */
export interface Preset {
  label: string;
  readings: Record<string, FieldReading>;
  /** On at the start, and again on a Reset. Plan 963 */
  on?: boolean;
  /** The reader's own entity it is, by id: its chip offers Rename and Delete. Plan 960 U4.4c */
  mine?: string;
}

/** A preset as a page declares it: its id, and what a Preset keeps. */
export type DeclaredPreset = { id: string } & Preset;

/** What a page declares about its Query, by scope. */
export class QueryDeclarations {
  /** Each component's OWN default filter, by its scope.
   *  TRAP T-a-component-default-outlives-a-view */
  readonly defaults = new Map<string, ScopeQuery>();
  /** Each scope's answers at the start, as its page defines them. TODO 464 */
  readonly starts = new Map<string, ScopeQuery>();
  /** Each scope's name as a reader sees it. */
  readonly labels = new Map<string, string>();
  /** Each scope's own word on whether it arranges. */
  readonly arranges = new Map<string, boolean>();
  /** Each scope's filter sets. */
  readonly sets = new Map<string, FilterSet[]>();
  /** What each COMPONENT scope has — its own fields. */
  readonly offers = new Map<string, string[]>();
  /** Each part, by its scope, in the order first declared. TRAP T-a-chart-scope-is-its-legend-field */
  readonly parts = new Map<string, QueryPart>();
  /** Each part's scope, in the order first declared. */
  readonly #partOrder: string[] = [];
  /** Declarations a walk reads: a part, a set. */
  #version = 0;

  /** Moves with each declaration a walk reads — a part, a set. */
  get version(): number {
    return this.#version;
  }

  /** Declare a part — `undefined` forgets it. Says the bar that drew it, if another
   *  draws it now or none. TODO 670 */
  part(scope: string, part: QueryPart | undefined): string | undefined {
    this.#version++;
    const parts = this.parts;
    const was = parts.get(scope)?.shownIn;
    const left = was && was !== part?.shownIn ? was : undefined;
    if (part) parts.set(scope, part);
    else parts.delete(scope);
    /* A part keeps the place it was first given: a chart swapped by Show as binds
       its legend again, and its panel section must not move. Will, TODO 548 */
    if (!this.#partOrder.includes(scope)) this.#partOrder.push(scope);
    const placed = [...parts].sort(([a], [b]) => this.#partOrder.indexOf(a) - this.#partOrder.indexOf(b));
    parts.clear();
    for (const [key, value] of placed) parts.set(key, value);
    return left;
  }

  /** A scope's filter sets, in order. A field is in one set at most; a second
   *  is left out, and said. TRAP T-a-filter-set-groups-or-chains */
  setSets(scope: string, sets: readonly FilterSet[]): void {
    this.#version++;
    const taken = new Set<string>();
    this.sets.set(scope, sets.map((set) => ({
      ...structuredClone(set),
      fields: set.fields.filter((field) => {
        if (!taken.has(field)) {
          taken.add(field);
          return true;
        }
        report({
          code: 'field-in-two-sets',
          message: `declareSets: "${field}" is in two of scope "${scope}"'s sets; it stays in the first.`,
          at: { scope, set: set.id, field },
        });
        return false;
      }),
    })));
  }

  /** Say which fields a component scope HAS; true when that moved. The view needs none: up is open. */
  offer(name: string, fields: readonly string[]): boolean {
    const next = [...new Set(fields)];
    const before = this.offers.get(name);
    if (before && before.length === next.length && before.every((f, i) => f === next[i])) return false;
    if (next.length) this.offers.set(name, next);
    else this.offers.delete(name);
    return true;
  }

  /**
   * The fields a scope may hold. A COMPONENT's are its own; the VIEW's are
   * every component's, because any field may be raised to narrow everything.
   */
  fields(name: string): string[] {
    if (name === VIEW) return [...new Set([...this.offers.values()].flat())];
    return [...(this.offers.get(name) ?? [])];
  }

  /** May this scope hold this field? Up is open; down is closed. */
  canHold(name: string, field: string): boolean {
    return name === VIEW || (this.offers.get(name) ?? []).includes(field);
  }

  /** Each scope's presets, by id. */
  readonly #presets = new Map<string, Map<string, Preset>>();

  /** A scope's presets: the app's own named conditions, each a boolean chip. TODOs 493, 510 */
  setPresets(scope: string, presets: readonly DeclaredPreset[]): void {
    this.#presets.set(scope, new Map(presets.map((p) => [p.id, {
      label: p.label, readings: structuredClone(p.readings), ...(p.on ? { on: true } : {}), ...(p.mine ? { mine: p.mine } : {}),
    }])));
  }

  /** A scope's presets, by id, in order. Live. */
  presets(scope: string): ReadonlyMap<string, Preset> {
    return this.#presets.get(scope) ?? new Map();
  }

  /** The scopes whose presets write this field: its answer moving moves their on. */
  presetsOver(field: string): string[] {
    return [...this.#presets].filter(([, ps]) => [...ps.values()].some((p) => field in p.readings)).map(([scope]) => scope);
  }

  /** Each slot's definition. */
  readonly #defined = new Map<string, PresentationDefinition>();

  /** What its page DEFINES a slot shows — and a default per view, its grid's and
   *  its charts' — under what is kept. Will, TODO 548 */
  define(scope: string, presentation: PresentationDefinition): void {
    this.#defined.set(scope, structuredClone(presentation));
  }

  /** A slot's presentation as shown in a view: `kept`, the reader's, over that
   *  view's definition, over the slot's; none kept, the definition alone. Will, TODOs 548, 572 */
  presented(scope: string, view: 'grid' | 'chart' | undefined, kept: Presentation | null): Presentation {
    const { grid, chart, ...base } = this.#defined.get(scope) ?? {};
    const own = view === 'grid' ? grid : view === 'chart' ? chart : undefined;
    const shown: Presentation = { ...base, ...own, ...(kept ? this.#inForce(kept) : {}) };
    // Its Secondary off: no Secondary, the definition's neither. Off is not gone. Will, TODO 666
    if (kept?.off === 'secondary') delete shown.secondary;
    return shown;
  }

  /** The page's axes, at '', and each scope's. */
  readonly #axes = new Map<string, AxesDefinition>();

  /** What each axis's chip offers — the page's, or a scope's over it. Will, TODO 660 */
  setAxes(axes: AxesDefinition, scope?: string): void {
    this.#axes.set(scope ?? '', structuredClone(axes));
  }

  /** What each axis offers in a scope's view: the page's, its view's, the scope's,
   *  then the scope's view's — the last to name an axis wins it whole. Will, TODO 660 */
  axesOf(scope: string, view: 'grid' | 'chart'): AxisOffers {
    return Object.assign({}, ...['', scope].flatMap((at) => {
      const { grid, chart, ...base } = this.#axes.get(at) ?? {};
      return [base, view === 'grid' ? grid : chart];
    })) as AxisOffers;
  }

  /** The app's settings: which picks are in force. */
  readonly #honoured = { kind: true, axes: true };

  /** Which of the reader's picks are in force — off, one is KEPT and not shown:
   *  `kind` Show as's, `axes` the Primary and Secondary chips'. True when that moved. Will, TODOs 582, 583 */
  honour(picks: 'kind' | 'axes', on: boolean): boolean {
    if (this.#honoured[picks] === on) return false;
    this.#honoured[picks] = on;
    return true;
  }

  /** Is that kind of pick in force? */
  honours(picks: 'kind' | 'axes'): boolean {
    return this.#honoured[picks];
  }

  /** A kept presentation, less the picks not in force. */
  #inForce(kept: Presentation): Presentation {
    const { kind, primary, secondary, off: _off, ...rest } = kept;
    const axes = this.#honoured.axes;
    return { ...rest, ...(this.#honoured.kind && kind ? { kind } : {}),
      ...(axes && primary ? { primary } : {}), ...(axes && secondary ? { secondary } : {}) };
  }

  /** Each scope's opening answers, by field. */
  readonly #opens = new Map<string, Map<string, FieldReading>>();

  /** The answer a field OPENS on where nothing answers it — a fetching list's
   *  first value. TRAP T-a-fetching-list-opens-on-its-first-value */
  setOpen(scope: string, field: string, reading: FieldReading): void {
    let fields = this.#opens.get(scope);
    if (!fields) this.#opens.set(scope, (fields = new Map()));
    fields.set(field, copyReading(reading));
  }

  /** A scope's opening answers, by field. */
  opens(scope: string): ReadonlyMap<string, FieldReading> | undefined {
    return this.#opens.get(scope);
  }

  /** Each scope's fixed fields, in order, and those always on. */
  readonly #fixed = new Map<string, { fixed: readonly string[]; alwaysOn: readonly string[] }>();

  /** A scope's FIXED fields — a reader cannot let one go — and those ALWAYS ON —
   *  a reader cannot switch one off. Will, TODO 703 · TRAP T-a-fixed-field-stays-held */
  setFixed(scope: string, facts: { fixed?: readonly string[]; alwaysOn?: readonly string[] }): void {
    this.#fixed.set(scope, { fixed: [...new Set(facts.fixed ?? [])], alwaysOn: [...new Set(facts.alwaysOn ?? [])] });
  }

  /** A scope's fixed fields, in order. */
  fixed(scope: string): readonly string[] {
    return this.#fixed.get(scope)?.fixed ?? [];
  }

  /** A scope's fields always on. */
  alwaysOn(scope: string): readonly string[] {
    return this.#fixed.get(scope)?.alwaysOn ?? [];
  }

  /** Each scope holds its fixed fields — a restore that left one out puts them
   *  back, leading — and each always-on answer is on, in place. */
  keepFixed(query: Query): void {
    for (const [id, { fixed, alwaysOn }] of this.#fixed) {
      if (fixed.some((f) => !query.scopes[id]?.holds.includes(f))) {
        const entry = (query.scopes[id] ??= emptyScope());
        entry.holds = [...fixed, ...entry.holds.filter((f) => !fixed.includes(f))];
      }
      for (const field of alwaysOn) {
        const reading = query.scopes[id]?.readings[field];
        if (!reading?.suspended) continue;
        const { suspended: _off, ...on } = reading;
        query.scopes[id]!.readings[field] = on;
      }
    }
  }

  /** Each held field with an opening answer and no answer — not one turned off — takes it, in place. */
  fillOpens(query: Query): void {
    for (const [id, fields] of this.#opens) {
      const scope = query.scopes[id];
      if (!scope) continue;
      for (const [field, start] of fields) {
        const had = scope.readings[field];
        if (!scope.holds.includes(field) || (had && (readingAnswered(had) || had.suspended))) continue;
        scope.readings[field] = copyReading(start);
      }
    }
  }
}
