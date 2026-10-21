/**
 * query-edits.ts — the edits a DataSource makes to its own Query, as plain
 * data. Each takes the Query first, so a test needs no source. Helpers other
 * modules share stay in query.ts. DOM-free.
 *
 * Map:
 * - Arrange — What a definition says of the rows beside its scopes: its search.
 * - scopeEntry — One scope's entry, made when first written.
 * - prune — Forget a scope that holds nothing and answers nothing.
 * - keepOff — A scope switched OFF applies nothing: what comes into force there is switched off and listed.
 * - holdsField — Is this field held in this scope?
 * - holderOf — Which scope holds this field, or null — the View first, when it does.
 * - homeOf — Where a field's reading lives: its holder, else the View.
 * - readingOf — One field's reading, or undefined.
 * - setReading — Write one field's reading at its home, or remove it.
 * - clearReadings — Forget every reading but a carry-over field's; the holds stay.
 * - rehome — Move each reading to its home after a hold moved fields.
 * - homes — Which scope each answered field's reading sits in.
 * - moveHold — Move a field's hold between scopes; returns every scope touched, `to` first.
 * - copyField — One field's answer, from one copy onto the other, in the scope that holds it.
 * - copyScope — One scope's slice, from one copy onto the other.
 * - cameFrom — Where a field the View holds came UP from.
 * - setCameFrom — Remember, or forget, where a View field came up from, in one copy.
 * - viewHeldReadings — Each field the View holds, with its answer unless suspended.
 * - DefinitionFacts — What turning a definition into a Query needs from its source.
 * - definitionOf — A definition as a whole Query, and its search.
 * - takeSet — A saved filter TAKEN: the screen then matches it exactly; every other scope's filters go.
 * - dropSet — A saved filter TAKEN OFF: the scopes it names lose their filters.
 * - answerIn — One field's answer in one copy of the Query, wherever it lives, or null.
 * - answersOf — A scope's answers, as one comparable value.
 */
import { answerOf, arrangementOf, arranging, eachScope, emptyScope, readingAnswered, VIEW, type Query, type QueryDefaults, type ScopeQuery, type ViewScope } from './query.js';
import type { FieldReading } from './filter-state.js';
import type { Where } from './where.js';
import { report } from './report.js';

/** What a definition says of the rows beside its scopes — only what it names. */
export type Arrange = { search?: string };

/** One scope's entry, made when first written. */
export function scopeEntry(query: Query, id: string): ScopeQuery {
  return (query.scopes[id] ??= emptyScope());
}

/** Forget a scope that holds nothing and answers nothing. */
export function prune(query: Query): void {
  for (const [id, scope] of Object.entries(query.scopes)) {
    // A scope switched off is kept: its Switch is still OFF. TRAP T-the-filter-switch-keeps-what-it-turned-off
    // …and one that arranges the rows keeps its sort. 366 step 8
    if (!scope.holds.length && !Object.keys(scope.readings).length && !scope.suspended
      && !arranging(scope)) {
      Reflect.deleteProperty(query.scopes, id);
    }
  }
}

/** A scope switched OFF applies nothing: an answer in force there is switched
 *  off and listed, and a listed one that left is forgotten.
 *  The scopes it changed. TRAP T-the-filter-switch-keeps-what-it-turned-off */
export function keepOff(query: Query): string[] {
  const touched: string[] = [];
  for (const [id, scope] of Object.entries(query.scopes)) {
    const off = scope.suspended;
    if (!off) continue;
    const before = JSON.stringify([off, scope.readings]);
    /* A listed field that LEFT — raised, lowered, moved — leaves the Switch:
       it is on again where it went, or listed there if that scope is off too. */
    for (const f of off.fields) {
      if (f in scope.readings) continue;
      const home = homeOf(query, f);
      const there = query.scopes[home];
      const reading = there?.readings[f];
      if (!there || !reading?.suspended) continue;
      if (there.suspended) {
        if (!there.suspended.fields.includes(f)) there.suspended.fields.push(f);
      } else {
        const { suspended: _off, ...on } = reading;
        there.readings[f] = on;
      }
      if (!touched.includes(home)) touched.push(home);
    }
    off.fields = off.fields.filter((f) => f in scope.readings);
    for (const [field, reading] of Object.entries(scope.readings)) {
      if (reading.suspended || !readingAnswered(reading)) continue;
      scope.readings[field] = { ...reading, suspended: true };
      if (!off.fields.includes(field)) off.fields.push(field);
    }
    if (JSON.stringify([off, scope.readings]) !== before) touched.push(id);
  }
  return touched;
}

/** Is this field held in this scope? */
export function holdsField(query: Query, scope: string, field: string): boolean {
  return (query.scopes[scope]?.holds ?? []).includes(field);
}

/** Which scope holds this field, or null — the View first, when it does. */
export function holderOf(query: Query, field: string): string | null {
  if (holdsField(query, VIEW, field)) return VIEW;
  // A scope that narrows ONE component is that component's alone.
  for (const [name, scope] of eachScope(query)) {
    if (scope.holds.includes(field)) return name;
  }
  return null;
}

/** Where a field's reading lives: the View when it holds the field, else the
 *  one component scope that does, else the View — which narrows everyone. */
export function homeOf(query: Query, field: string): string {
  return holderOf(query, field) ?? VIEW;
}

/** One field's reading, or undefined. */
export function readingOf(query: Query, field: string): FieldReading | undefined {
  return query.scopes[homeOf(query, field)]?.readings[field];
}

/** Write one field's reading at its home, or remove it. */
export function setReading(query: Query, field: string, reading: FieldReading | undefined): void {
  for (const [, scope] of eachScope(query)) Reflect.deleteProperty(scope.readings, field);
  if (reading) scopeEntry(query, homeOf(query, field)).readings[field] = reading;
  prune(query);
}

/** Forget every reading but a carry-over field's; the holds stay. */
export function clearReadings(query: Query, carriesOver: (field: string) => boolean): void {
  for (const [, scope] of eachScope(query)) {
    // A carry-over field keeps its answer. TRAP T-a-field-can-carry-over-views
    scope.readings = Object.fromEntries(Object.entries(scope.readings)
      .filter(([field]) => carriesOver(field)));
  }
  prune(query);
}

/** A hold MOVED fields, so move each reading to its new home. Every reading
 *  still applies once, so the filter does not change. */
export function rehome(query: Query): void {
  for (const [id, scope] of eachScope(query)) {
    for (const [field, reading] of Object.entries(scope.readings)) {
      const home = homeOf(query, field);
      if (home === id) continue;
      Reflect.deleteProperty(scope.readings, field);
      scopeEntry(query, home).readings[field] = reading;
    }
  }
  prune(query);
}

/** Which scope each answered field's reading sits in. */
export function homes(query: Query): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, scope] of eachScope(query)) {
    for (const field of Object.keys(scope.readings)) out.set(field, id);
  }
  return out;
}

/** Move a field's hold between scopes: RAISED to the View, it leaves every
 *  component; LOWERED, it leaves the View for one. Returns every scope touched, `to` first. */
export function moveHold(query: Query, field: string, from: string, to: string): string[] {
  const touched = new Set<string>([to]);
  const drop = (name: string): void => {
    const scope = query.scopes[name];
    if (!scope?.holds.includes(field)) return;
    scope.holds = scope.holds.filter((f) => f !== field);
    touched.add(name);
  };
  if (to === VIEW) {
    for (const name of Object.keys(query.scopes)) if (name !== VIEW) drop(name);
  } else {
    drop(VIEW);
    if (from !== VIEW && from !== to) drop(from);
  }
  const into = scopeEntry(query, to);
  if (!into.holds.includes(field)) into.holds = [...into.holds, field];
  return [...touched];
}

/** One field's answer, from one copy onto the other, in the scope that holds it. */
export function copyField(from: Query, to: Query, field: string): void {
  for (const [, scope] of eachScope(to)) Reflect.deleteProperty(scope.readings, field);
  for (const [id, scope] of eachScope(from)) {
    const held = scope.readings[field];
    if (!held) continue;
    (to.scopes[id] ??= emptyScope(scope.holds)).readings[field] = structuredClone(held);
  }
}

/** One scope's slice, from one copy onto the other. */
export function copyScope(from: Query, to: Query, scope: string): void {
  const slice = from.scopes[scope];
  if (slice) to.scopes[scope] = structuredClone(slice);
  else Reflect.deleteProperty(to.scopes, scope);
}

/** Where a field the View holds came UP from — kept IN the Query, so a reload
 *  and a View's draft keep it. TODO 235 · TRAP T-send-to-view-filters */
export function cameFrom(query: Query, field: string): string | undefined {
  return query.scopes[VIEW]?.from?.[field];
}

/** Remember, or forget, where a View field came up from, in one copy. */
export function setCameFrom(query: Query, field: string, from: string | undefined): void {
  const view = query.scopes[VIEW];
  if (!view) return;
  const next = Object.entries({ ...view.from, ...(from ? { [field]: from } : {}) })
    .filter(([id]) => from || id !== field);
  if (next.length) view.from = Object.fromEntries(next);
  else delete view.from;
}

/** Each field the View holds, with its answer unless suspended. */
export function viewHeldReadings(query: Query): Record<string, FieldReading> {
  const view = query.scopes[VIEW] ?? emptyScope();
  return Object.fromEntries(view.holds.map((f) => {
    const r = view.readings[f];
    return [f, r && !r.suspended ? r : {}];
  }));
}

/** What turning a definition into a Query needs from its source. */
export interface DefinitionFacts {
  /** Each component's own default, by its scope. */
  defaults: ReadonlyMap<string, ScopeQuery>;
  /** A View's plain conditions as readings, by the source's field types. */
  readingsOf: (where: Where) => Record<string, FieldReading>;
  /** Does this field keep its answer across Views? */
  carriesOver: (field: string) => boolean;
}

/** The keys a scope keeps, beside its readings. */
const SCOPE_KEYS = new Set(['holds', 'narrows', 'from', 'suspended', 'sort', 'group', 'sortSuspended']);

/**
 * A definition as a whole Query. Its search sets the source's own, and leaves
 * the Query; its sort and group stay in it, in ONE scope. A VIEW
 * (`keep`) keeps the chips a scope it does not name holds, and a field it
 * answers is held, so its chip shows it. `copy: false` for a caller that only reads it.
 * A key a scope does not have — a stored `presets` — is left out, said once (D4).
 */
export function definitionOf(
  given: Query | QueryDefaults, keep: boolean, base: Query, facts: DefinitionFacts, copy = true,
): { query: Query; arrange: Arrange | null } {
  const next: Query = { v: 1, scopes: {} };
  let arrange: Arrange | null = null;
  const strays = new Set<string>();
  for (const [id, scope] of Object.entries(copy ? structuredClone(given.scopes) : given.scopes)) {
    // A View says `where`; a whole Query, `readings`. TRAP T-one-way-to-write-a-condition
    const { search, where, readings, ...all } = scope as ViewScope
      & Partial<Pick<ScopeQuery, 'readings'>>;
    const rest = Object.fromEntries(Object.entries(all).filter(([key]) => SCOPE_KEYS.has(key) || !strays.add(key))) as typeof all;
    if (rest.suspended) rest.suspended = { fields: [...(rest.suspended.fields ?? [])] };
    next.scopes[id] = {
      ...rest, holds: rest.holds ?? [], readings: { ...readings, ...(where ? facts.readingsOf(where) : {}) },
    };
    if (search !== undefined) (arrange ??= {}).search = search;
  }
  /* A VIEW that names NO arrangement keeps the one on screen; one that names
     it — `sort: []` too — sets it. ONE scope arranges.
     TRAP T-group-and-sort-are-component-scope */
  const names = Object.values(given.scopes).some((s) => 'sort' in s || 'group' in s || 'sortSuspended' in s);
  const kept = keep && !names ? arrangementOf(base) : undefined;
  if (kept?.scope) {
    const to = (next.scopes[kept.scope] ??= emptyScope());
    to.sort = [...kept.sort];
    if (kept.group != null) to.group = kept.group;
    if (kept.sortSuspended) to.sortSuspended = { ...kept.sortSuspended };
  }
  let first = true;
  for (const s of Object.values(next.scopes)) {
    if (first && arranging(s)) first = false;
    else { delete s.sort; delete s.group; delete s.sortSuspended; }
  }
  if (strays.size) {
    report({
      code: 'unknown-scope-key',
      message: `definitionOf: a scope has keys it does not keep, so they are left out: ${[...strays].join(', ')}.`,
      at: { keys: [...strays].join(', ') },
    });
  }
  /* A component's OWN default filter outlives a View that does not name it,
     and a restore from before it joined. A View may name it to change it.
     TRAP T-a-component-default-outlives-a-view */
  for (const [id, scope] of facts.defaults) next.scopes[id] ??= structuredClone(scope);
  // A RESTORE is exact; only a View keeps chips and shows its answers on them.
  if (!keep) return { query: next, arrange };
  /* A carry-over field keeps its answer where the View gives none.
     TRAP T-a-field-can-carry-over-views */
  for (const [id, scope] of eachScope(base)) {
    for (const [field, reading] of Object.entries(scope.readings)) {
      if (!facts.carriesOver(field)) continue;
      if (Object.values(next.scopes).some((s) => field in s.readings)) continue;
      const copy = structuredClone(reading);
      // The new View's Switch is on: what the old one turned off comes back on.
      if (scope.suspended?.fields.includes(field)) delete copy.suspended;
      (next.scopes[id] ??= emptyScope()).readings[field] = copy;
    }
  }
  for (const [id, scope] of eachScope(base)) {
    if (given.scopes[id]?.holds) continue;
    (next.scopes[id] ??= emptyScope()).holds = [...scope.holds];
  }
  for (const [, scope] of eachScope(next)) {
    for (const field of Object.keys(scope.readings)) {
      if (!scope.holds.includes(field)) scope.holds = [...scope.holds, field];
    }
  }
  return { query: next, arrange };
}

/** A saved filter TAKEN: the screen then matches it exactly (Will, 366). Each
 *  scope it names takes its filters, and keeps what it held plus what it answers
 *  unless the set says its holds; every OTHER scope's filters go, its chips and
 *  arrangement kept. A component's `own` scope is what it IS, and stays.
 *  TRAP T-saved-filters-are-every-scope */
export function takeSet(now: Query, set: QueryDefaults, own: ReadonlySet<string> = new Set()): QueryDefaults {
  const scopes: QueryDefaults['scopes'] = {};
  for (const [id, scope] of Object.entries(now.scopes)) scopes[id] = own.has(id) ? scope : unfiltered(scope);
  for (const [id, scope] of Object.entries(structuredClone(set.scopes))) {
    if (own.has(id)) continue;
    const named = Object.keys(scope.where ?? {});
    // The arrangement of the scope it replaces stays, unless the set names one.
    scopes[id] = { ...arrangementIn(now.scopes[id]), ...scope, holds: scope.holds ?? [...new Set([...(now.scopes[id]?.holds ?? []), ...named])] };
  }
  return { v: 1, scopes };
}

/** A saved filter TAKEN OFF — its row unticked: the scopes it names lose their
 *  filters, and keep their chips. Will, 366. TRAP T-saved-filters-are-every-scope */
export function dropSet(now: Query, set: QueryDefaults, own: ReadonlySet<string> = new Set()): QueryDefaults {
  const scopes: QueryDefaults['scopes'] = { ...now.scopes };
  for (const id of Object.keys(set.scopes)) {
    const scope = now.scopes[id];
    if (scope && !own.has(id)) scopes[id] = unfiltered(scope);
  }
  return { v: 1, scopes };
}

/** A scope's sort, group and suspended sort — those it has. */
function arrangementIn(scope: ScopeQuery | undefined): Pick<ScopeQuery, 'sort' | 'group' | 'sortSuspended'> {
  if (!scope || !arranging(scope)) return {};
  return {
    ...(scope.sort ? { sort: scope.sort } : {}), ...(scope.group != null ? { group: scope.group } : {}),
    ...(scope.sortSuspended ? { sortSuspended: scope.sortSuspended } : {}),
  };
}

/** One scope with no filters on: its chips and arrangement stay. */
function unfiltered(scope: ScopeQuery): ScopeQuery {
  const { suspended: _off, ...rest } = scope;
  return { ...rest, readings: {} };
}

/** One field's answer in one copy of the Query, wherever it lives, or null. */
export function answerIn(query: Query, field: string): FieldReading | null {
  for (const [, scope] of eachScope(query)) {
    const held = scope.readings[field];
    if (held) return answerOf(held);
  }
  return null;
}

/** A scope's answers, as one comparable value. */
export function answersOf(scope: ScopeQuery | undefined): unknown {
  if (!scope) return null;
  return Object.fromEntries(Object.entries(scope.readings).map(([f, r]) => [f, answerOf(r)]));
}
