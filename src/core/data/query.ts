/**
 * query.ts — the ONE state a page's data is under, in the reader's own terms.
 *
 * Scopes that hold fields, each field's reading, the saved filters that are
 * on, and a scope's sort, group, search and page. It is DATA: saved, restored
 * and shared as it is, and compiled into a filter only on demand — a clause is
 * output, never state. See docs/QUERY-DESIGN.md.
 *
 * DOM-free, like everything in this folder. TRAP T-one-query-one-owner
 *
 * Map:
 * - Query — Every scope's setup, as plain data — what a page's data is under.
 * - ScopeQuery — One scope: the fields it holds, each one's reading, and how it arranges rows.
 * - QueryDefaults — A Query as a DEFINITION states it — a saved View, in JSON.
 * - ViewScope — One scope as a View writes it: each field's condition in the plain form.
 * - CompileFacts — What compiling needs to know that the Query does not say.
 * - withoutDropped — A reading without the picks set aside.
 * - Compiled — A Query as the source runs it: one shared filter, and each one-component filter.
 * - VIEW — The id of the page's own scope, which every component scope sits under.
 * - emptyScope — A scope that holds and answers nothing yet, for a caller to fill.
 * - narrowsOne — Does this scope narrow only the components it names?
 * - eachScope — Each scope that answers for the page, by id, as a copy.
 * - heldInView — The fields the View holds, which are answered there alone.
 * - heldAbove — The fields held above a scope: the View's, or none for the View itself.
 * - presetClauses — A saved filter's readings as clauses.
 * - answerOf — The ANSWER keys of a reading only, not its label or the values it offers.
 * - readingAnswered — Does a reading answer anything? An empty condition row does not.
 * - sameReading — Do two readings give the same answer? Only the answer keys count.
 * - filterKey — A filter as one string, its AND and OR children in one order.
 * - compile — Turn a Query into what the source runs — the ONE place a Query becomes a filter.
 */
import { andFilter, valueKey, type Filter, type SortSpec } from './store.js';
import { readingClause, type FieldFacts, type FieldReading } from './filter-state.js';
import { report } from './report.js';
import type { Where } from './where.js';

/** Every scope's setup, as plain data — what a page's data is under. */
export interface Query {
  /** The version of the SHAPE, not of the data. */
  v: 1;
  /** One entry per scope, by id. `VIEW` is the page's own. */
  scopes: Record<string, ScopeQuery>;
}

/** One scope: the fields it holds, each one's reading, and how it arranges rows. */
export interface ScopeQuery {
  /** The fields this scope holds, in order — the chips on its bar. */
  holds: string[];
  /** Each field's answer — the shape every filter control reports. The View's
   *  may answer a field no bar holds: a legend, or a column heading. */
  readings: Record<string, FieldReading>;
  /** Saved filters on this scope, on or off. Their readings live in the library. */
  presets?: Record<string, boolean>;
  /** The ONLY bound components this scope narrows — a legend's own chart.
   *  Absent, it narrows every one. TRAP T-a-component-part-narrows-one-component */
  narrows?: string[];
  /** The View's only: the scope each field it holds came UP from, so "Return to"
   *  outlives a reload. TODO 235 · TRAP T-send-to-view-filters */
  from?: Record<string, string>;
  /** How this scope arranges its rows. One scope on a source says it. */
  sort?: SortSpec[];
  group?: string | null;
  search?: string;
}

/**
 * A Query as a DEFINITION states it — a saved View, in JSON. Each scope names
 * only what it sets: a scope with no `holds` keeps what it holds now, and a
 * field it answers is held there. Its `sort`, `group` and `search` arrange the
 * rows. TRAP T-a-view-is-json
 */
export interface QueryDefaults {
  v: 1;
  scopes: Record<string, ViewScope>;
}

/** One scope as a View writes it: each field's condition in the plain form.
 *  TRAP T-one-way-to-write-a-condition */
export interface ViewScope extends Partial<Omit<ScopeQuery, 'readings'>> {
  /** `{ openTickets: { gt: 0 } }` — numbers as numbers. */
  where?: Where;
}

/** What compiling needs to know that the Query does not say. */
export interface CompileFacts {
  /** A field's facts — its type, label and values — as `fieldState` takes them. */
  field?: (field: string) => Omit<FieldFacts, 'field'>;
  /** A saved filter's readings, by its id. */
  preset?: (id: string) => Readonly<Record<string, FieldReading>> | undefined;
  /** The scopes a COMPONENT answers. One no component answers is the page's,
   *  and trickles down with the View. Absent: every scope but the View is a
   *  component's. TRAP T-only-the-view-trickles-down */
  components?: ReadonlySet<string>;
  /** A component's OWN scopes — its `data-where` — which are what it IS, not a
   *  chip: a field the View holds never sets them aside. TRAP T-a-component-default-outlives-a-view */
  fixed?: ReadonlySet<string>;
  /** The picked values a LATER answer rules out, as value keys: they stay in the
   *  reading and leave the filter. TRAP T-a-later-answer-sets-an-earlier-pick-aside */
  drop?: (scope: string, field: string) => readonly string[] | undefined;
}

/** A reading without the picks set aside. */
export function withoutDropped(reading: FieldReading, dropped: readonly string[] | undefined): FieldReading {
  if (!dropped?.length || !reading.picked) return reading;
  const out = new Set(dropped);
  return { ...reading, picked: reading.picked.filter((v) => !out.has(valueKey(v))) };
}

/** A Query as the source runs it: one shared filter, and each one-component filter. */
export interface Compiled {
  /** What a PAGE of rows is under: the View, and every component scope. */
  filter?: Filter;
  /** The View's answer alone — what every OTHER component is under. Only the
   *  View trickles down. TRAP T-only-the-view-trickles-down */
  view?: Filter;
  /** Each component scope's own answer, by scope id. */
  scoped: Record<string, Filter>;
  /** Per bound component id, what narrows it alone. */
  only: Record<string, Filter>;
  sort: SortSpec[];
  group: string | null;
  search: string;
}

/** The id of the page's own scope, which every component scope sits under. */
export const VIEW = 'view';

/** A scope that holds and answers nothing yet, for a caller to fill. */
export function emptyScope(holds: readonly string[] = []): ScopeQuery {
  return { holds: [...holds], readings: {} };
}

/** Does this scope narrow only the components it names? TRAP T-a-component-part-narrows-one-component */
export function narrowsOne(scope: ScopeQuery): boolean {
  return !!scope.narrows?.length;
}

/** Each scope that answers for the page, by id. A copy, so a caller may edit the Query as it goes. */
export function eachScope(query: Query): Array<[string, ScopeQuery]> {
  return Object.entries(query.scopes).filter(([, s]) => !narrowsOne(s));
}

/** The fields the View holds, which are answered there alone. TRAP T-a-view-held-heading-shows-and-refuses */
export function heldInView(query: Query): ReadonlySet<string> {
  return new Set(query.scopes[VIEW]?.holds ?? []);
}

/** The fields held above a scope: the View's, or none for the View itself. */
export function heldAbove(query: Query, scope: string): ReadonlySet<string> {
  return scope === VIEW ? new Set<string>() : heldInView(query);
}

/** A saved filter's readings as clauses. A reading that answers nothing gives none. */
export function presetClauses(
  readings: Readonly<Record<string, FieldReading>>,
  field?: CompileFacts['field'],
): Filter[] {
  const out: Filter[] = [];
  for (const [f, reading] of Object.entries(readings)) {
    const clause = readingClause({ field: f, ...field?.(f) }, reading);
    if (clause) out.push(clause);
  }
  return out;
}

// Every key of FieldReading, once: one added there and not here is a type error. TRAP T-both-answers-are-kept
const READING_KEYS = Object.keys({
  picked: 0, present: 0, op: 0, text: 0, conditions: 0, mode: 0, mirror: 0, range: 0, kept: 0, suspended: 0,
} satisfies Record<keyof FieldReading, 0>) as (keyof FieldReading)[];

/** The ANSWER keys of a reading only — a bar's reading also carries its label
 *  and every value it offers, which are facts, not what the reader chose. */
export function answerOf(reading: FieldReading): FieldReading {
  const out: Record<string, unknown> = {};
  for (const key of READING_KEYS) if (reading[key] !== undefined) out[key] = reading[key];
  return out as FieldReading;
}

/** Does a reading answer anything? CONDITIONS count — a field answered only by
 *  rows has no picks and no text — but an EMPTY row does not: a cleared menu
 *  keeps one. TRAP T-many-conditions-are-one-reading */
export function readingAnswered(reading: FieldReading): boolean {
  return (reading.picked ?? []).length > 0
    || (reading.text ?? '').trim() !== ''
    || (reading.conditions ?? []).some((r) => (r.text ?? '').trim() !== '' || (r.picked ?? []).length > 0)
    // The other shape's answer is worth keeping too. TRAP T-both-shapes-are-kept
    || (!!reading.kept && readingAnswered(reading.kept));
}

/** Do two readings give the same answer? Only the answer keys count. */
export function sameReading(a: FieldReading | null | undefined, b: FieldReading | null | undefined): boolean {
  return JSON.stringify(a ? answerOf(a) : null) === JSON.stringify(b ? answerOf(b) : null);
}

/** A filter as one string, its AND and OR children in one order: the same filter
 *  always reads the same. */
export function filterKey(filter: Filter | undefined): string {
  const walk = (f: Filter): unknown => (Array.isArray(f) && (f[0] === 'and' || f[0] === 'or')
    ? [f[0], ...(f.slice(1) as Filter[]).map((c) => JSON.stringify(walk(c))).sort()]
    : f);
  return filter ? JSON.stringify(walk(filter)) : '';
}

/**
 * Turn a Query into what the source runs — the ONE place a Query becomes a
 * filter. Pure: the same Query and facts always compile to the same thing.
 *
 * - Every reading applies, held or not — except that a field the VIEW holds
 *   is answered there alone: a component scope's reading of it applies nothing,
 *   unless the scope is a component's own (`fixed`).
 * - A SUSPENDED reading keeps its answer and applies none of it.
 * - A scope with `narrows` reaches only those components.
 *
 * TRAP T-one-query-one-owner
 */
export function compile(query: Query, facts: CompileFacts = {}): Compiled {
  const shared: Filter[] = [];
  const view: Filter[] = [];
  const scoped: Record<string, Filter> = {};
  const only: Record<string, Filter[]> = {};
  const viewHolds = heldInView(query);
  let arranged: ScopeQuery | undefined;

  for (const [id, scope] of Object.entries(query.scopes)) {
    const clauses: Filter[] = [];
    for (const [field, reading] of Object.entries(scope.readings)) {
      // One field, one scope: the View's answer wins. TRAP T-a-view-held-heading-shows-and-refuses
      if (id !== VIEW && viewHolds.has(field) && !facts.fixed?.has(id)) continue;
      if (reading.suspended) continue;
      const clause = readingClause({ field, ...facts.field?.(field) }, withoutDropped(reading, facts.drop?.(id, field)));
      if (clause) clauses.push(clause);
    }
    for (const [preset, on] of Object.entries(scope.presets ?? {})) {
      if (!on) continue;
      const given = facts.preset?.(preset);
      if (!given) {
        report({
          code: 'unknown-preset',
          message: 'compile: a preset is on, but no readings were found for it.',
          at: { scope: id, preset },
        });
        continue;
      }
      clauses.push(...presetClauses(given, facts.field));
    }

    if (scope.narrows?.length) {
      for (const el of scope.narrows) (only[el] ??= []).push(...clauses);
    } else {
      shared.push(...clauses);
      if (id === VIEW || (facts.components && !facts.components.has(id))) view.push(...clauses);
      else {
        const own = andFilter(clauses);
        if (own) scoped[id] = own;
      }
    }

    if (scope.sort || scope.group !== undefined || scope.search !== undefined) {
      if (arranged) {
        report({
          code: 'two-arranging-scopes',
          message: 'compile: two scopes on one source arrange its rows; the first is used.',
          at: { scope: id },
        });
      } else {
        arranged = scope;
      }
    }
  }

  const out: Compiled = {
    scoped,
    only: Object.fromEntries(Object.entries(only)
      .map(([el, clauses]) => [el, andFilter(clauses)] as const)
      .filter((e): e is readonly [string, Filter] => !!e[1])),
    sort: arranged?.sort ?? [],
    group: arranged?.group ?? null,
    search: arranged?.search ?? '',
  };
  const filter = andFilter(shared);
  if (filter) out.filter = filter;
  const viewed = andFilter(view);
  if (viewed) out.view = viewed;
  return out;
}
