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
 * - CompileFacts — What compiling needs to know that the Query does not say.
 * - Compiled — A Query as the source runs it: one shared filter, and each one-component filter.
 * - VIEW — The id of the page's own scope, which every component scope sits under.
 * - compile — Turn a Query into what the source runs — the ONE place a Query becomes a filter.
 */
import { andFilter, type Filter, type SortSpec } from './store.js';
import { readingClause, type FieldFacts, type FieldReading } from './filter-state.js';
import { report } from './report.js';

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
  scopes: Record<string, Partial<ScopeQuery>>;
}

/** What compiling needs to know that the Query does not say. */
export interface CompileFacts {
  /** A field's facts — its type, label and values — as `fieldState` takes them. */
  field?: (field: string) => Omit<FieldFacts, 'field'>;
  /** A saved filter's readings, by its id. */
  preset?: (id: string) => Readonly<Record<string, FieldReading>> | undefined;
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

/**
 * Turn a Query into what the source runs — the ONE place a Query becomes a
 * filter. Pure: the same Query and facts always compile to the same thing.
 *
 * - Every reading applies, held or not — except that a field the VIEW holds
 *   is answered there alone: a component scope's reading of it applies nothing.
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
  const viewHolds = new Set(query.scopes[VIEW]?.holds ?? []);
  let arranged: ScopeQuery | undefined;

  for (const [id, scope] of Object.entries(query.scopes)) {
    const clauses: Filter[] = [];
    for (const [field, reading] of Object.entries(scope.readings)) {
      // One field, one scope: the View's answer wins. TRAP T-a-view-held-heading-shows-and-refuses
      if (id !== VIEW && viewHolds.has(field)) continue;
      if (reading.suspended) continue;
      const clause = readingClause({ field, ...facts.field?.(field) }, reading);
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
      for (const [field, reading] of Object.entries(given)) {
        const clause = readingClause({ field, ...facts.field?.(field) }, reading);
        if (clause) clauses.push(clause);
      }
    }

    if (scope.narrows?.length) {
      for (const el of scope.narrows) (only[el] ??= []).push(...clauses);
    } else {
      shared.push(...clauses);
      if (id === VIEW) view.push(...clauses);
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
