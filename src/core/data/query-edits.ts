/**
 * query-edits.ts — the edits made to a Query, as plain data. Each takes the
 * Query first, so a test needs no source, and gives the Query after: the one
 * given is untouched. Helpers other modules share stay in query.ts. DOM-free.
 *
 * Map:
 * - scopeEntry — One scope's entry, made when first written.
 * - prune — Forget a scope that holds nothing and answers nothing.
 * - keepOff — A scope switched OFF applies nothing: what comes into force there is switched off and listed.
 * - holdsField — Is this field held in this scope?
 * - holderOf — Which scope holds this field, or null — the View first, when it does.
 * - homeOf — Where a field's reading lives: its holder, else a preset's scope, else the View.
 * - presetHeld — Is a preset ON in this copy: its rows held on every field it names, in force?
 * - readingOf — One field's reading, or undefined.
 * - ownIn — Does this scope hold a field the View holds fixed too, and answer it again, under the View's?
 * - setReading — Write one field's reading at its home, or remove it.
 * - rehome — Move each reading to its home after a hold moved fields.
 * - homes — Which scope each answered field's reading sits in.
 * - moveHold — Move a field's hold between scopes; returns every scope touched, `to` first.
 * - copyField — One field's answer, from one copy onto the other, in the scope that holds it.
 * - copyHolds — What each scope holds, from one copy onto the other: an Apply carries it.
 * - sameField — Does one field read the same in both copies, scope by scope?
 * - sameScope — Is one scope's slice the same in both copies?
 * - copyScope — One scope's slice, from one copy onto the other.
 * - cameFrom — Where a field the View holds came UP from.
 * - setCameFrom — Remember, or forget, where a View field came up from, in one copy.
 * - SharedView — The App Context's answer: the View's fields and their answers, one for every page — each with its face, for a…
 * - layShared — Lay the App answer over a Query's View: the fields this page has, in the answer's order, then the page's own…
 * - sharedOf — The App answer after a reader's act on this page: its View's fields and answers, then what the answer held th…
 * - viewHeldReadings — Each field the View holds, with its answer unless suspended.
 * - DefinitionFacts — What turning a definition into a Query needs from its source.
 * - definitionOf — A definition as a whole Query.
 * - answerIn — One field's answer in one copy of the Query, wherever it lives, or null.
 * - EditFacts — What a pure edit needs to know that the copy it edits does not say.
 * - PureEdit — The edits `editQuery` makes: each writes one copy as plain data, and tells no one.
 * - isPureEdit — Is this request one `editQuery` makes?
 * - editQuery — A pure edit: the Query after a Sort, Group, Search, presentation, order or move; the one given untouched.
 * - slotted — A Sort or a Group in a SLOT is its chart's: its presentation's sort or parts.
 * - Solo — A filter soloed in this tab, and every answer the solo switched off.
 * - Copies — The two copies an edit reads — one object while nothing waits — and this tab's solo.
 * - Edited — Both copies after an edit, and what each member must hear, in the order it happened.
 * - CopyFacts — What an answering edit needs that the copies do not say: the context's members and declarations.
 * - presetIn — Is this preset ON in a copy: its rows held on every field it names, in force.
 * - editCopies — A request as a pure edit: both copies after it, and what each member must hear, in order.
 * - writeScope — A scope's own readings, written as its page declares them, each told as written.
 * - commitScope — An Apply of one scope, as `wait(scope, false)` sends what waits.
 */
import {
  ARRANGE_KEYS, answerOf, arrangementOf, arranging, copyQuery, copyReading, eachScope, emptyScope, ownBelow, readingAnswered,
  sameReading, stripArrangement, VIEW, type Presentation, type Query, type QueryDefaults, type QueryRequest, type ScopeQuery, type ViewScope,
} from './query.js';
import { valueKey, type SortSpec } from './store.js';
import { answerTree, modeOf, withPreset, type FieldReading } from './filter-state.js';
import { compiles, type MemberBind, type QueryChange, type QueryMember } from './query-members.js';
import type { Preset, QueryPart } from './query-declarations.js';
import type { Where, WhereCondition } from './where.js';
import { report } from './report.js';

/** One scope's entry, made when first written. */
export function scopeEntry(query: Query, id: string): ScopeQuery {
  return (query.scopes[id] ??= emptyScope());
}

/** Forget a scope that holds nothing and answers nothing. */
export function prune(query: Query): void {
  for (const [id, scope] of Object.entries(query.scopes)) {
    // A scope switched off is kept: its Switch is still OFF. TRAP T-the-filter-switch-keeps-what-it-turned-off
    // …and one that arranges the rows keeps its sort. 366 step 8
    // …and one that keeps an answer the View holds over it. D2 A
    // …and a slot's presentation. TODO 548
    if (!scope.holds.length && !Object.keys(scope.readings).length && !scope.suspended
      && !arranging(scope) && !scope.superseded && !scope.presentation) {
      Reflect.deleteProperty(query.scopes, id);
    }
  }
}

/** A scope switched OFF applies nothing: an answer in force there is switched
 *  off and listed — not one its page keeps always on — and a listed one that left
 *  is forgotten. The scopes it changed. TRAP T-the-filter-switch-keeps-what-it-turned-off */
export function keepOff(query: Query, alwaysOn: (scope: string) => readonly string[] = () => []): string[] {
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
      if (reading.suspended || !readingAnswered(reading) || alwaysOn(id).includes(field)) continue;
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
 *  one component scope that does, else where a preset put it, else the View —
 *  which narrows everyone. TRAP T-a-preset-is-its-own-part */
export function homeOf(query: Query, field: string): string {
  const holder = holderOf(query, field);
  if (holder) return holder;
  for (const [name, scope] of eachScope(query)) if (scope.readings[field]?.byPreset) return name;
  return VIEW;
}

/** Is a preset ON in this copy: its rows held on every field it names, in force?
 *  TODOs 510, 521 · TRAP T-a-preset-is-its-own-part */
export function presetHeld(query: Query, scope: string, id: string, readings: Readonly<Record<string, FieldReading>>): boolean {
  const entries = Object.entries(readings).filter(([, given]) => answerTree(given));
  // Each at its field's home, where a preset is written.
  return entries.length > 0 && entries.every(([field]) => {
    const held = query.scopes[holderOf(query, field) ?? scope]?.readings[field];
    return !!held?.byPreset?.[id] && !held.suspended;
  });
}

/** One field's reading, or undefined. */
export function readingOf(query: Query, field: string): FieldReading | undefined {
  return query.scopes[homeOf(query, field)]?.readings[field];
}

/** Does this scope hold a field the View holds FIXED too, and answer it again, ANDed under the View's? Will, TODO 554
 *  TRAP T-a-scope-below-narrows-within-a-fixed-field */
export function ownIn(query: Query, scope: string, field: string, viewFixed: readonly string[] = []): boolean {
  return ownBelow(scope, query.scopes[scope], field, viewFixed) && holdsField(query, VIEW, field);
}

/** Write one field's reading at its home, or remove it — leaving each scope's own answer of a fixed View field. */
export function setReading(query: Query, field: string, reading: FieldReading | undefined, viewFixed: readonly string[] = []): void {
  const home = homeOf(query, field);
  for (const [id, scope] of eachScope(query)) if (!ownIn(query, id, field, viewFixed)) Reflect.deleteProperty(scope.readings, field);
  if (reading) scopeEntry(query, home).readings[field] = reading;
  prune(query);
}

/** A hold MOVED fields, so move each reading to its new home. Every reading
 *  still applies once, so the filter does not change. A scope's own answer of a fixed View field stays. */
export function rehome(query: Query, viewFixed: readonly string[] = []): void {
  for (const [id, scope] of eachScope(query)) {
    for (const [field, reading] of Object.entries(scope.readings)) {
      const home = homeOf(query, field);
      if (home === id || ownIn(query, id, field, viewFixed)) continue;
      // A preset's rows on a field no scope holds stay in its scope: no chip. Will, TODO 590
      if (reading.byPreset && !holderOf(query, field)) continue;
      Reflect.deleteProperty(scope.readings, field);
      scopeEntry(query, home).readings[field] = reading;
    }
  }
  prune(query);
}

/** Which scope each answered field's reading sits in: its home's, not a scope's own answer of a fixed View field. */
export function homes(query: Query, viewFixed: readonly string[] = []): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, scope] of eachScope(query)) {
    for (const field of Object.keys(scope.readings)) if (!ownIn(query, id, field, viewFixed)) out.set(field, id);
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
    (to.scopes[id] ??= emptyScope(scope.holds)).readings[field] = copyReading(held);
  }
}

/** What each scope holds — and where a View field came up from — from one
 *  copy onto the other. A hold is never pending, so an Apply of one field
 *  carries every scope's. 366 step 21 */
export function copyHolds(from: Query, to: Query): void {
  for (const [id, scope] of Object.entries(from.scopes)) {
    const into = (to.scopes[id] ??= emptyScope());
    into.holds = [...scope.holds];
    if (scope.from) into.from = { ...scope.from };
    else delete into.from;
  }
}

/** Does one field read the same in both copies, scope by scope? */
export function sameField(a: Query, b: Query, field: string): boolean {
  const of = (q: Query): string => JSON.stringify(eachScope(q).flatMap(([id, s]) => (s.readings[field] ? [[id, s.readings[field]]] : [])));
  return of(a) === of(b);
}

/** Is one scope's slice the same in both copies? */
export function sameScope(a: Query, b: Query, scope: string): boolean {
  return JSON.stringify(a.scopes[scope] ?? null) === JSON.stringify(b.scopes[scope] ?? null);
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

/** The App Context's answer: the View's fields and their answers, one for every
 *  page — each with its face, for a page that has no such field. Will, TODO 453 */
export interface SharedView {
  holds: string[];
  readings: Record<string, FieldReading>;
  faces: Record<string, { label: string; icon?: string }>;
}

/** Lay the App answer over a Query's View: the fields this page has, in the
 *  answer's order, then the page's own it does not hold; each answered as the
 *  answer says. TRAP T-the-app-context-is-one-answer */
export function layShared(query: Query, shared: SharedView, has: (field: string) => boolean): void {
  const view = scopeEntry(query, VIEW);
  const taken = new Set(shared.holds);
  const mine = shared.holds.filter(has);
  view.holds = [...mine, ...view.holds.filter((f) => !taken.has(f))];
  for (const f of taken) Reflect.deleteProperty(view.readings, f);
  for (const f of mine) if (shared.readings[f]) view.readings[f] = structuredClone(shared.readings[f]);
}

/** The App answer after a reader's act on this page: its View's fields and
 *  answers, then what the answer held that this page has not, as it was. */
export function sharedOf(
  query: Query, was: SharedView | null, has: (field: string) => boolean,
  face: (field: string) => { label: string; icon?: string },
): SharedView {
  const view = query.scopes[VIEW] ?? emptyScope();
  const here = new Set(view.holds);
  const holds = [...view.holds, ...(was?.holds ?? []).filter((f) => !here.has(f) && !has(f))];
  const answer = (f: string): FieldReading | undefined => (here.has(f) ? view.readings[f] : was?.readings[f]);
  return {
    holds,
    readings: Object.fromEntries(holds.flatMap((f) => {
      const r = answer(f);
      return r ? [[f, structuredClone(r)]] : [];
    })),
    faces: Object.fromEntries(holds.map((f) => [f, here.has(f) ? face(f) : was?.faces[f] ?? { label: f }])),
  };
}

/** Each field the View holds now, with its answer in force unless suspended. */
export function viewHeldReadings(draft: Query, applied: Query): Record<string, FieldReading> {
  const view = applied.scopes[VIEW];
  return Object.fromEntries((draft.scopes[VIEW]?.holds ?? []).map((f) => {
    const r = view?.readings[f];
    return [f, r && !r.suspended ? r : {}];
  }));
}

/** What turning a definition into a Query needs from its source. */
export interface DefinitionFacts {
  /** Each component's own default, by its scope. */
  defaults: ReadonlyMap<string, ScopeQuery>;
  /** Each scope's answers at the start, as its page defines them. TODO 464 */
  starts?: ReadonlyMap<string, ScopeQuery>;
  /** A View's plain conditions as readings, by the source's field types. */
  readingsOf: (where: Where) => Record<string, FieldReading>;
  /** Does this field keep its answer across Views? */
  carriesOver: (field: string) => boolean;
  /** The fields the View holds fixed: a scope below that holds one answers it again, never superseded. TODO 554 */
  viewFixed?: readonly string[];
}

/** The keys a scope keeps, beside its readings. */
const SCOPE_KEYS = new Set<string>(['holds', 'narrows', 'from', 'suspended', ...ARRANGE_KEYS, 'superseded', 'presentation']);

/**
 * A definition as a whole Query; its sort, group and search stay in it, in
 * ONE scope. A VIEW
 * (`keep`) keeps the chips a scope it does not name holds, and a field it
 * answers is held, so its chip shows it. `copy: false` for a caller that only reads it.
 * A key a scope does not have is left out, said once (D4).
 */
export function definitionOf(
  given: Query | QueryDefaults, keep: boolean, base: Query, facts: DefinitionFacts, copy = true,
): Query {
  const next: Query = { v: 1, scopes: {} };
  const strays = new Set<string>();
  for (const [id, scope] of Object.entries(copy ? structuredClone(given.scopes) : given.scopes)) {
    // A View says `where`; a whole Query, `readings`. TRAP T-one-way-to-write-a-condition
    const { where, readings, superseded, ...all } = scope as ViewScope & Partial<Pick<ScopeQuery, 'readings'>>;
    const rest = Object.fromEntries(Object.entries(all).filter(([key]) => SCOPE_KEYS.has(key) || !strays.add(key))) as typeof all;
    if (rest.suspended) rest.suspended = { fields: [...(rest.suspended.fields ?? [])] };
    // Kept answers: a whole Query's as they are; a View's in the plain form. `{}` is none.
    const kept = superseded && Object.fromEntries(Object.entries(superseded).map(([f, said]) => [f,
      readings || !Object.keys(said).length ? { ...said as FieldReading } : facts.readingsOf({ [f]: said as WhereCondition })[f] ?? {}]));
    next.scopes[id] = {
      ...rest, holds: rest.holds ?? [], readings: { ...readings, ...(where ? facts.readingsOf(where) : {}) },
      ...(kept && Object.keys(kept).length ? { superseded: kept } : {}),
    };
  }
  /* A VIEW that names NO arrangement keeps the one on screen; one that names
     it — `sort: []` too — sets it. ONE scope arranges.
     TRAP T-group-and-sort-are-component-scope */
  const names = Object.values(given.scopes).some((s) => ARRANGE_KEYS.some((key) => key in s));
  const kept = keep && !names ? arrangementOf(base) : undefined;
  if (kept?.scope) {
    const to = (next.scopes[kept.scope] ??= emptyScope());
    to.sort = [...kept.sort];
    if (kept.group != null) to.group = kept.group;
    if (kept.sortSuspended) to.sortSuspended = { ...kept.sortSuspended };
    if (kept.search) to.search = kept.search;
  }
  let first = true;
  for (const s of Object.values(next.scopes)) {
    if (first && arranging(s)) first = false;
    else stripArrangement(s);
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
  /* …and so does a PAGE's start for a scope: a View or a restore that does not
     name it starts it there. TRAP T-a-page-scope-starts-with-its-answers */
  for (const [id, scope] of facts.starts ?? []) next.scopes[id] ??= structuredClone(scope);
  // A RESTORE is exact; only a View keeps chips and shows its answers on them.
  if (!keep) return next;
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
  /* A View that holds a field a kept scope holds TAKES it: that scope keeps its
     own answer, as a raise does; one that lets it go gives the kept one back.
     Will, D2 A. TRAP T-a-superseded-chip-suspends-it-is-never-removed */
  const viewHolds = next.scopes[VIEW]?.holds ?? [];
  for (const [id, scope] of eachScope(next)) {
    if (id === VIEW || given.scopes[id]?.superseded) continue;
    const was = base.scopes[id];
    for (const field of scope.holds) {
      const kept = was?.superseded?.[field];
      if (viewHolds.includes(field) && !facts.viewFixed?.includes(field)) {
        (scope.superseded ??= {})[field] = { ...(kept ?? was?.readings[field] ?? {}) };
      } else if (kept && Object.keys(kept).length && !scope.readings[field]) {
        scope.readings[field] = { ...kept };
      }
    }
  }
  return next;
}

/** One field's answer in one copy of the Query, wherever it lives, or null. */
export function answerIn(query: Query, field: string): FieldReading | null {
  for (const [, scope] of eachScope(query)) {
    const held = scope.readings[field];
    if (held) return answerOf(held);
  }
  return null;
}

/** What a pure edit needs to know that the copy it edits does not say. */
export interface EditFacts {
  /** Is this scope a SLOT — a chart's? Its Sort and Group are its presentation's. Will, TODO 548 */
  presents?: (scope: string) => boolean;
  /** Is this scope ANOTHER source's? It keeps its own arrangement. 366 step 25 */
  theirs?: (scope: string) => boolean;
  /** The applied copy, whose arrangement both copies follow; absent, the copy edited. */
  applied?: Query;
  /** The draft, whose holds an order places; absent, the copy edited. */
  draft?: Query;
  /** The fields the View holds fixed, each a scope below may answer again. TODO 554 */
  viewFixed?: readonly string[];
}

/** The edits `editQuery` makes: each writes one copy as plain data, and tells no one. */
export type PureEdit = Extract<Exclude<QueryRequest, readonly QueryRequest[]>,
  { sort: unknown } | { group: unknown } | { search: unknown } | { presentation: unknown } | { order: unknown } | { move: unknown }>;

/** Is this request one `editQuery` makes? */
export function isPureEdit(request: QueryRequest): request is PureEdit {
  return !Array.isArray(request) && ['sort', 'group', 'search', 'presentation', 'order', 'move'].some((key) => key in request);
}

/**
 * editQuery(query, edit, facts) — a pure edit: the Query after it, the one given
 * untouched. A slot's Sort and Group become its presentation's. A move another
 * scope may not hold changes nothing. TRAP T-one-command-one-door
 */
export function editQuery(query: Query, given: PureEdit, facts: EditFacts = {}): Query {
  const out = copyQuery(query);
  const edit = slotted(given, facts.presents);
  const scope = edit.scope;
  if ('presentation' in edit) {
    const entry = scopeEntry(out, scope ?? VIEW);
    const merged: Record<string, unknown> = { ...entry.presentation, ...edit.presentation };
    const next = Object.fromEntries(Object.entries(merged).filter(([, value]) => value != null && value !== ''));
    if (Object.keys(next).length) entry.presentation = next as Presentation;
    else delete entry.presentation;
    prune(out);
    return out;
  }
  if ('order' in edit) {
    const name = scope ?? VIEW;
    const holds = (facts.draft ?? query).scopes[name]?.holds ?? [];
    const named = new Set(edit.order.filter((f) => holds.includes(f)));
    const next = [...named];
    const ordered = holds.map((f) => (named.has(f) ? next.shift()! : f));
    const entry = out.scopes[name];
    if (entry) entry.holds = ordered.filter((f) => entry.holds.includes(f));
    return out;
  }
  if ('move' in edit) {
    moveHold(out, edit.move, edit.from, scope ?? VIEW);
    rehome(out, facts.viewFixed);
    return out;
  }
  // Both copies follow the applied arrangement. TRAP T-group-and-sort-are-component-scope
  const applied = facts.applied ?? query;
  return arranged(out, arrangeEdit(edit, applied, facts), scope, applied, facts);
}

/** A Sort or a Group in a SLOT is its chart's: its presentation's sort or parts. Will, TODO 548 */
export function slotted(edit: PureEdit, presents?: (scope: string) => boolean): PureEdit {
  const scope = edit.scope;
  if (!scope || !presents?.(scope) || !('sort' in edit || 'group' in edit)) return edit;
  return {
    scope,
    presentation: 'sort' in edit
      ? { sort: edit.sort && !edit.clear ? (edit.direction === 'desc' ? 'desc' : 'asc') : undefined }
      : { group: edit.group ?? undefined },
  };
}

/** A change to the arrangement: what it names, and nothing else. */
type ArrangeEdit = { sort?: SortSpec[]; group?: string | null; sortSuspended?: SortSpec | undefined; search?: string };

/** A Sort, a Group or a Search as the arrangement it changes. A second suspend in a
 *  row keeps the column it remembers. TRAP T-a-suspended-sort-is-one-owners-job */
function arrangeEdit(edit: Extract<PureEdit, { sort: unknown } | { group: unknown } | { search: unknown }>, applied: Query, facts: EditFacts): ArrangeEdit {
  if ('group' in edit) return { group: edit.group };
  if ('search' in edit) return { search: edit.search };
  if (edit.clear) return { sort: [], sortSuspended: undefined };
  if (edit.sort) return { sort: [{ field: edit.sort, direction: edit.direction ?? 'asc' }], sortSuspended: undefined };
  const theirs = facts.theirs ?? ((): boolean => false);
  const live = arrangementOf(applied, (id) => !theirs(id)).sort[0];
  return { sort: [], ...(live ? { sortSuspended: live } : {}) };
}

/** The arrangement written into ONE scope — the one named, else the one that
 *  arranges now, else the View — and every other of this source's loses its own.
 *  TRAP T-group-and-sort-are-component-scope */
function arranged(out: Query, next: ArrangeEdit, scope: string | undefined, applied: Query, facts: EditFacts): Query {
  const theirs = facts.theirs ?? ((): boolean => false);
  // What a Switch keeps off is kept through this write too. TODO 612
  const now = arrangementOf(applied, (id) => !theirs(id), true);
  const at = scope ?? now.scope ?? VIEW;
  const sort = next.sort ?? now.sort;
  const group = 'group' in next ? next.group ?? null : now.group;
  const sortSuspended = 'sortSuspended' in next ? next.sortSuspended : now.sortSuspended;
  const search = next.search ?? now.search;
  for (const [id, s] of Object.entries(out.scopes)) if (!theirs(id)) stripArrangement(s);
  if (!sort.length && group == null && !sortSuspended && !search) return out;
  const s = scopeEntry(out, at);
  s.sort = sort.map((by) => ({ ...by }));
  if (group != null) s.group = group;
  if (sortSuspended) s.sortSuspended = { ...sortSuspended };
  if (search) s.search = search;
  return out;
}

/* ── The edits that ANSWER: each pure — both copies in, both copies out — and
   what each member must hear said as the result, in the order it happened.
   `ask()` applies the new copies and tells the members once. TRAP T-one-command-one-door */

/** A filter soloed in this tab, and every answer the solo switched off. Never
 *  saved, never exported. Will, TODO 690 · TRAP T-a-solo-is-a-draft-of-one-tab */
export interface Solo {
  scope: string;
  field: string;
  off: { scope: string; field: string }[];
}

/** The two copies an edit reads — one object while nothing waits — and this tab's solo. */
export interface Copies {
  applied: Query;
  draft: Query;
  solo: Solo | null;
}

/** Both copies after an edit, and what each member must hear, in the order it happened. */
export interface Edited extends Copies {
  said: QueryChange[];
}

/** What an answering edit needs that the copies do not say: the context's members and declarations. */
export interface CopyFacts {
  /** Does a member's store wait for Apply? Which scopes did `wait()` name? */
  remote: boolean;
  named: ReadonlySet<string>;
  parts: ReadonlyMap<string, QueryPart>;
  offers: ReadonlyMap<string, readonly string[]>;
  presets: (scope: string) => ReadonlyMap<string, Preset>;
  /** The answers each held field opens on. TODO 403 */
  opens: (scope: string) => ReadonlyMap<string, FieldReading> | undefined;
  /** A scope's fixed fields, and those always on. Will, TODO 703 */
  fixed: (scope: string) => readonly string[];
  alwaysOn: (scope: string) => readonly string[];
  /** The member that knows a field. */
  knows: (field: string) => Pick<QueryMember, 'raws' | 'ruledOut' | 'carriesOver'> | undefined;
  /** How a member bound the control with this bind id. */
  bound: (id: string) => MemberBind | undefined;
  presents: (scope: string) => boolean;
  theirs: (scope?: string) => (id: string) => boolean;
}

/** Where an Apply or a Discard reaches: one field, one scope, or every scope. */
type At = { scope?: string; field?: string };

/** Where an Apply or a Discard reaches, as a request names it. */
function applyAt(at: At): At {
  return at.field ? { field: at.field } : at.scope ? { scope: at.scope } : {};
}

/** A scope keeps no answer for this field now. */
function forget(scope: ScopeQuery, field: string): void {
  if (!scope.superseded?.[field]) return;
  Reflect.deleteProperty(scope.superseded, field);
  if (!Object.keys(scope.superseded).length) delete scope.superseded;
}

/** An edit at work: its own copies, what it has said, and the Applies a batch waits to send. */
class Work {
  applied: Query;
  draft: Query;
  solo: Solo | null;
  readonly facts: CopyFacts;
  readonly said: QueryChange[] = [];
  /** How deep in a batch it is: an Apply in one is sent at its end. */
  #depth = 0;
  /** The Applies a batch asked for: sent at its end, after every edit in it. 366 step 21 */
  #applies: At[] = [];

  constructor(copies: Copies, facts: CopyFacts) {
    this.applied = copyQuery(copies.applied);
    this.draft = copies.draft === copies.applied ? this.applied : copyQuery(copies.draft);
    this.solo = copies.solo && { ...copies.solo, off: copies.solo.off.map((o) => ({ ...o })) };
    this.facts = facts;
  }

  /** Does any scope wait for Apply? */
  get waits(): boolean {
    return this.facts.remote || this.facts.named.size > 0;
  }

  /** Say what changed. A local draft settles first; what a compile reads keeps a
   *  scope switched off OFF, as the compile once wrote it. TRAP T-the-filter-switch-keeps-what-it-turned-off */
  say(change: QueryChange): void {
    this.#settle();
    if (compiles(change)) {
      const off = keepOff(this.draft, this.facts.alwaysOn);
      if (this.applied !== this.draft) keepOff(this.applied, this.facts.alwaysOn);
      if (off.length) this.said.push({ kind: 'off', scopes: off });
    }
    this.said.push(change);
  }

  /** A LOCAL draft: a scope that does not wait is in force at once, and so is
   *  what each scope holds. A remote one keeps its own rule. TODO 406 */
  #settle(): void {
    if (this.facts.remote || this.draft === this.applied) return;
    for (const id of new Set([...Object.keys(this.draft.scopes), ...Object.keys(this.applied.scopes)])) {
      if (!this.facts.named.has(id)) copyScope(this.draft, this.applied, id);
    }
    copyHolds(this.draft, this.applied);
  }

  /** The edits one act makes are ONE change: one Apply, after every edit in it. */
  batch(fn: () => void): void {
    this.#depth++;
    try {
      fn();
    } finally {
      this.#depth--;
      if (!this.#depth) {
        const applies = this.#applies;
        this.#applies = [];
        if (applies.map((at) => this.#send(at)).some(Boolean)) this.say({ kind: 'commit' });
      }
    }
  }

  /** SEND the draft — Apply, where a scope waits. One field, one scope, or all. */
  commit(at: At = {}): void {
    if (!this.waits) return;
    if (this.#depth) this.#applies.push(at);
    else if (this.#send(at)) this.say({ kind: 'commit' });
  }

  /** Copy what an Apply sends onto `applied`. Nothing waiting: false. 366 step 21 */
  #send(at: At): boolean {
    const { draft, applied } = this;
    if (at.field ? sameField(draft, applied, at.field) : at.scope ? sameScope(draft, applied, at.scope) : false) return false;
    if (at.field) copyField(draft, applied, at.field);
    else if (at.scope) copyScope(draft, applied, at.scope);
    else this.applied = structuredClone(draft);
    if (at.field || at.scope) copyHolds(draft, this.applied);
    return true;
  }

  /** Fields that MOVED scope carry their answer at once, waiting or not.
   *  TRAP T-up-is-open-down-is-closed */
  carry(fields: readonly string[]): void {
    if (this.facts.remote || this.draft === this.applied) return;
    for (const field of fields) copyField(this.draft, this.applied, field);
  }

  /** The fields the View holds fixed. Will, TODO 703 */
  get viewFixed(): readonly string[] {
    return this.facts.fixed(VIEW);
  }

  /** Does this scope answer a fixed View field again, its own, under the View's? TODO 554 */
  own(scope: string | undefined, field: string): boolean {
    return !!scope && ownIn(this.draft, scope, field, this.viewFixed);
  }

  /** Where a scope's answer of a field lives: that scope, for its own; else the field's home. */
  at(field: string, scope?: string): string {
    return this.own(scope, field) ? scope! : homeOf(this.draft, field);
  }

  /** A scope's answer of a field in the draft: its own, else the one at the field's home. */
  reading(field: string, scope?: string): FieldReading | undefined {
    return this.draft.scopes[this.at(field, scope)]?.readings[field];
  }

  /** May this scope hold this field? Up is open; down is closed. */
  canHold(scope: string, field: string): boolean {
    return scope === VIEW || (this.facts.offers.get(scope) ?? []).includes(field);
  }

  /** The fields a scope holds, in the draft. A copy. */
  scope(name: string): string[] {
    return [...(this.draft.scopes[name]?.holds ?? [])];
  }

  /** Every field the draft answers. */
  answered(): string[] {
    return Object.values(this.draft.scopes).flatMap((s) => Object.keys(s.readings));
  }

  /** The result: both copies, the solo, and what was said. */
  done(): Edited {
    return { applied: this.applied, draft: this.draft, solo: this.solo, said: this.said };
  }
}

/**
 * Write ONE scope's reading of ONE field — a component's own answer, which no
 * other control shares. `only` makes the scope NARROW that one bound
 * component. Its rows must be EVERY matching row — one page would lie about the
 * total. `undefined` removes the reading.
 * TRAP T-a-component-part-narrows-one-component · TRAP T-one-query-one-owner
 */
function write(w: Work, scope: string, field: string, reading: FieldReading | undefined, at: { only?: string } = {}): void {
  // A declared part narrows its own component, whoever writes it — a panel too.
  const only = at.only ?? w.facts.parts.get(scope)?.only;
  const bind = only ? w.facts.bound(only) : undefined;
  if (reading && only && bind?.rows !== 'all') {
    report({
      code: 'component-part-on-a-page',
      message: 'write: a scope that narrows one component needs a bound `rows: "all"` component.',
      at: { scope, field },
    });
    return;
  }
  const entry = scopeEntry(w.draft, scope);
  if (bind) entry.narrows = [bind.id];
  if (reading && readingAnswered(reading)) {
    entry.readings[field] = copyReading(answerOf(reading));
    if (!entry.holds.includes(field)) entry.holds = [...entry.holds, field];
  } else {
    Reflect.deleteProperty(entry.readings, field);
    entry.holds = entry.holds.filter((f) => f !== field);
  }
  const narrows = entry.narrows ?? [];
  prune(w.draft);
  /* A scope that narrows ONE component filters rows already here — no fetch,
     so no Apply, even with a remote member. */
  if (w.facts.remote && narrows.length) copyScope(w.draft, w.applied, scope);
  w.say({ kind: 'write', scope, field, narrows });
}

/** A reader's answer replaces the answer, never what presets hold of the field. TODO 521 */
function keepPresets(w: Work, field: string, next: FieldReading): FieldReading {
  const byPreset = readingOf(w.draft, field)?.byPreset;
  if (!byPreset) return next;
  // An answer emptied leaves the presets', in force.
  return { ...(readingAnswered(next) ? next : {}), byPreset };
}

/** A reading's answer, its picks as the values the rows hold: a control hands
 *  back the KEY it was given. Picks kept off too. TRAP T-a-value-can-be-an-object */
function raw(w: Work, field: string, picked: readonly unknown[], reading: FieldReading): FieldReading {
  const raws = (keys: readonly unknown[]): unknown[] => w.facts.knows(field)?.raws(field, keys) ?? [...keys];
  return { ...answerOf(reading), picked: raws(picked), ...(reading.off ? { off: raws(reading.off) } : {}) };
}

/** Write a field's answer at its home — or, a scope's own answer of a fixed View field, in that scope — telling no one. */
function put(w: Work, field: string, picked: readonly unknown[], reading: FieldReading = {}, scope?: string): void {
  if (w.own(scope, field)) {
    // Its own: what presets hold of the field is the View's. TODO 554
    const next = copyReading(raw(w, field, picked, reading));
    const entry = scopeEntry(w.draft, scope!);
    if (readingAnswered(next)) entry.readings[field] = next;
    else Reflect.deleteProperty(entry.readings, field);
    return;
  }
  // Its OWN copy: a caller that edits its object after changes nothing here.
  const next: FieldReading = copyReading(keepPresets(w, field, raw(w, field, picked, reading)));
  /* CONDITIONS count. A field answered only by rows has no picked values and
     no typed text. TRAP T-many-conditions-are-one-reading */
  setReading(w.draft, field, readingAnswered(next) ? next : undefined, w.viewFixed);
}

/**
 * Select values for a FIELD, at its home scope. Every control over that
 * field reads the same answer back; an empty list clears it. It is drawn at the
 * home it has as it is said. TRAP T-a-filter-applies-down-its-scope
 */
function select(w: Work, field: string, picked: readonly unknown[], reading: FieldReading = {}, scope?: string): void {
  put(w, field, picked, reading, scope);
  w.say({ kind: 'select', field, at: w.at(field, scope) });
}

/** A field's picks less those the filters before it rule out: going OFF, they go —
 *  they could never come back on (TODO 462). Conditions stay. Will, TODOs 465, 523 F3 */
function standing(w: Work, scope: string, field: string, reading: FieldReading): unknown[] {
  const picked = reading.picked ?? [];
  const out = modeOf(reading) === 'advanced' ? undefined : w.facts.knows(field)?.ruledOut?.(scope, field);
  return out ? picked.filter((v) => out(valueKey(v)) === null) : [...picked];
}

/** Is this field ALWAYS ON where it lives — where this scope answers it? Will, TODO 703 · TRAP T-a-fixed-field-stays-held */
function alwaysOn(w: Work, field: string, scope?: string): boolean {
  return w.facts.alwaysOn(w.at(field, scope)).includes(field);
}

/** Refuse what would let a FIXED field go, or switch one ALWAYS ON off, and say so. */
function refuse(code: 'field-fixed' | 'field-always-on', door: string, at: { scope: string; field: string }): void {
  const kept = code === 'field-fixed' ? 'held' : 'on';
  report({ code, message: `${door}: "${at.field}" stays ${kept}: its page says so in scope "${at.scope}".`, at });
}

/**
 * A bar's filter Switch. OFF stops every answer in force in this scope,
 * keeping each; ON brings back exactly those. While it is off,
 * nothing comes into force there. TRAP T-the-filter-switch-keeps-what-it-turned-off
 */
function suspendScope(w: Work, scope: string, suspended = true): void {
  if (suspended === !!w.draft.scopes[scope]?.suspended) return;
  const entry = scopeEntry(w.draft, scope);
  let fields: string[];
  if (suspended) {
    // Each answer drops what the filters before it rule out, as one field's OFF does. TODO 523 F3
    const dropped: string[] = [];
    for (const [field, reading] of Object.entries(entry.readings)) {
      const kept = reading.suspended || w.facts.alwaysOn(scope).includes(field) ? null : standing(w, scope, field, reading);
      if (!kept || kept.length >= (reading.picked?.length ?? 0)) continue;
      put(w, field, kept, kept.length ? reading : {}, scope);
      dropped.push(field);
    }
    entry.suspended = { fields: [] };
    // What the Switch turned off is listed as it is said.
    w.say({ kind: 'recompose' });
    fields = [...new Set([...entry.suspended.fields, ...dropped])];
  } else {
    const off = entry.suspended!;
    delete entry.suspended;
    fields = off.fields.filter((f) => f in entry.readings);
    for (const f of fields) {
      const { suspended: _off, ...on } = entry.readings[f]!;
      entry.readings[f] = on;
    }
    prune(w.draft);
    w.say({ kind: 'recompose' });
  }
  // The Switch is its scope's Apply, remote too.
  w.commit({ scope });
  w.say({ kind: 'drawn', fields, bars: scope });
  // Its sort and group go off and on with it: the rows are arranged again. Will, TODO 398
  if (entry.sort?.length || entry.group) w.say({ kind: 'arranged', group: !!entry.group });
}

/**
 * Switch answers OFF and on, keeping each: one field's, at its home, or —
 * `null` — every answer in a scope, its bar's Switch. On gives the same
 * reading back; a field already so changes nothing.
 * TRAP T-the-filter-switch-keeps-what-it-turned-off · TRAP T-grid-suspend-is-not-clear
 */
function suspend(w: Work, scope: string, field: string | null, off: boolean): void {
  if (field === null) {
    suspendScope(w, scope, off);
    return;
  }
  const held = w.reading(field, scope);
  if (!held || !!held.suspended === off) return;
  if (off && alwaysOn(w, field, scope)) return refuse('field-always-on', 'suspend', { scope: w.at(field, scope), field });
  const { suspended: _was, ...on } = held;
  if (!off) return select(w, field, held.picked ?? [], on, scope);
  const kept = standing(w, w.own(scope, field) ? scope : homes(w.draft, w.viewFixed).get(field) ?? scope, field, held);
  // None left, the field clears.
  if (held.picked?.length && !kept.length) select(w, field, [], {}, scope);
  else select(w, field, kept, { ...on, suspended: true }, scope);
}

/**
 * SOLO one filter: every other answer in force in its scope — every scope,
 * `across` — goes off, its value whole, and this one is on. Applied at once,
 * as the Switch is. A second solo moves it. Will, TODO 690
 * TRAP T-a-solo-is-a-draft-of-one-tab
 */
function solo(w: Work, scope: string, field: string, options: { across?: boolean } = {}): void {
  w.batch(() => {
    unsolo(w);
    const draft = w.draft;
    const off: { scope: string; field: string }[] = [];
    const scopes = options.across ? eachScope(draft).map(([id]) => id) : [scope];
    for (const id of scopes) {
      const entry = draft.scopes[id];
      // A scope its Switch turned off is off already.
      if (!entry || entry.suspended) continue;
      for (const [other, reading] of Object.entries(entry.readings)) {
        // …but one always on. Will, TODO 703
        if (other === field || reading.suspended || !readingAnswered(reading) || w.facts.alwaysOn(id).includes(other)) continue;
        // Raw: going off here prunes nothing, so it comes back as it was.
        select(w, other, reading.picked ?? [], { ...reading, suspended: true }, id);
        off.push({ scope: id, field: other });
      }
    }
    const own = w.reading(field, scope);
    if (own?.suspended) {
      const { suspended: _off, ...on } = own;
      select(w, field, own.picked ?? [], on, scope);
    }
    w.solo = { scope, field, off };
    soloSaid(w, w.solo);
  });
}

/** End the solo: ONLY what it switched off comes back on — less any the reader
 *  turned on meanwhile. Inside a batch. Will, TODO 690 */
function unsolo(w: Work): void {
  const was = w.solo;
  if (!was) return;
  w.solo = null;
  for (const { scope, field } of was.off) {
    const held = w.reading(field, scope);
    if (!held?.suspended) continue;
    const { suspended: _off, ...on } = held;
    select(w, field, held.picked ?? [], on, scope);
  }
  soloSaid(w, was);
}

/** A solo applied, and every bar it reaches drawn again: each its own scope. */
function soloSaid(w: Work, said: Solo): void {
  const scopes = new Set([said.scope, ...said.off.map((o) => o.scope)]);
  for (const id of scopes) w.commit({ scope: id });
  w.say({ kind: 'drawn', fields: [said.field, ...said.off.map((o) => o.field)] });
  for (const id of scopes) w.say({ kind: 'bars', scope: id });
}

/** Say what a scope holds now. An empty list forgets the scope. */
function hold(w: Work, name: string, fields: readonly string[]): void {
  const next = [...fields];
  const before = w.draft.scopes[name]?.holds ?? [];
  // A no-op must not wake every listener — a bar re-renders on this.
  if (before.length === next.length && before.every((f, i) => f === next[i])) return;
  // A FIXED field it holds is never let go. Will, TODO 703
  const fixed = w.facts.fixed(name).find((f) => before.includes(f) && !next.includes(f));
  if (fixed) return refuse('field-fixed', 'hold', { scope: name, field: fixed });
  /* LET GO, and held nowhere else: its answer goes with it. Removing a chip
     is a clear. Cleared FIRST, while this scope still holds it, so the
     controls over this scope are drawn the clear. TRAP T-one-query-one-owner */
  const elsewhere = (field: string): boolean => eachScope(w.draft)
    .some(([id, s]) => id !== name && s.holds.includes(field));
  for (const field of before) {
    if (next.includes(field)) continue;
    if (!elsewhere(field) && readingOf(w.draft, field)) select(w, field, []);
    // Its own answer of a fixed View field goes with its chip; the View's stays. TODO 554
    else if (w.own(name, field) && w.reading(field, name)) select(w, field, [], {}, name);
  }
  const draft = w.draft;
  const entry = scopeEntry(draft, name);
  const added = next.filter((f) => !before.includes(f));
  const dropped = before.filter((f) => !next.includes(f));
  /* THE VIEW TAKES a field a component scope holds: that scope keeps its own
     answer, not in force — `{}` for none. One that lets a field go keeps none.
     Will, D2 A. TRAP T-a-superseded-chip-suspends-it-is-never-removed */
  if (name === VIEW) {
    for (const [id, s] of eachScope(draft)) {
      if (id === VIEW) continue;
      for (const f of added) if (s.holds.includes(f)) (s.superseded ??= {})[f] = copyReading(s.readings[f] ?? {});
    }
  } else for (const f of dropped) forget(entry, f);
  const was = homes(draft, w.viewFixed);
  entry.holds = next;
  rehome(draft, w.viewFixed);
  // …and LETS GO: its home below gets back the answer it kept, or clears.
  if (name === VIEW) for (const f of dropped) giveBack(w, f);
  /* RAISING CARRIES THE ANSWER, and lowering brings it back: an answer that
     moved scope narrows from where it lives now, at once, and is drawn there.
     TRAP T-up-is-open-down-is-closed */
  const now = homes(draft, w.viewFixed);
  const moved = [...now].filter(([field, home]) => was.get(field) !== home).map(([field]) => field);
  w.carry(moved);
  w.say({ kind: 'hold', scope: name, moved, added });
}

/** The View let go of a field: its home below gets back the answer it kept
 *  — or clears, for `{}` — and no scope keeps one for it now. */
function giveBack(w: Work, field: string): void {
  const draft = w.draft;
  const home = holderOf(draft, field);
  for (const [id, s] of eachScope(draft)) {
    const kept = s.superseded?.[field];
    if (!kept) continue;
    forget(s, field);
    if (id !== home) continue;
    if (Object.keys(kept).length) s.readings[field] = kept;
    else Reflect.deleteProperty(s.readings, field);
  }
}

/** A scope lets ONE field go. */
function release(w: Work, scope: string, id: string): void {
  hold(w, scope, w.scope(scope).filter((f) => f !== id));
  w.say({ kind: 'bars', scope });
}

/** A scope TAKES fields — sent DOWN from the View to the one scope named,
 *  or UP from a chart with its answer. TRAP T-send-to-view-filters */
function take(w: Work, scope: string, ids: readonly string[], from?: string): void {
  if (from === VIEW && scope !== VIEW) {
    for (const id of ids) lower(w, id, scope);
    return;
  }
  if (scope === VIEW && from) for (const id of ids) cameFromBoth(w, id, from);
  const part = from ? w.facts.parts.get(from) : undefined;
  const answer = part && from ? w.draft.scopes[from]?.readings[part.field] : undefined;
  holdEach(w, scope, [...ids]);
  // The chart lets go of it: the View narrows every component now.
  if (part && answer && from && ids.includes(part.field)) {
    write(w, from, part.field, undefined);
    select(w, part.field, answer.picked ?? [], answer);
    w.commit();
    w.say({ kind: 'bars', scope });
  }
}

/** A scope holds each of these fields. */
function holdEach(w: Work, scope: string, ids: readonly string[]): void {
  const fields = ids.filter((id) => !holdsField(w.draft, scope, id));
  if (fields.length) hold(w, scope, [...w.scope(scope), ...fields]);
  w.say({ kind: 'bars', scope });
}

/** Remember, or forget, where a View field came up from, in both copies. */
function cameFromBoth(w: Work, field: string, from: string | undefined): void {
  for (const query of new Set([w.draft, w.applied])) setCameFrom(query, field, from);
}

/** SEND a View field DOWN: the View lets go of it, and its answer goes to
 *  the one scope named. TRAP T-send-to-view-filters */
function lower(w: Work, field: string, to: string): void {
  if (!holdsField(w.draft, VIEW, field)) return;
  if (w.facts.fixed(VIEW).includes(field)) return refuse('field-fixed', 'take', { scope: VIEW, field });
  const answer = w.draft.scopes[VIEW]?.readings[field];
  const part = w.facts.parts.get(to);
  if (!part && !w.canHold(to, field)) return;
  /* ONE SCOPE AT A TIME. A scope the field came up from still holds its
     place: each lets go first, while the View still holds the answer.
     Will, TODO 168. TRAP T-send-to-view-filters */
  for (const [id, scope] of eachScope(w.draft)) {
    if (id === VIEW || id === to || !scope.holds.includes(field)) continue;
    hold(w, id, scope.holds.filter((f) => f !== field));
    w.say({ kind: 'bars', scope: id });
  }
  // Held BELOW first, so the answer moves there and is not cleared.
  if (!part && !holdsField(w.draft, to, field)) hold(w, to, [...w.scope(to), field]);
  /* THE VIEW'S ANSWER WINS, whole — its mode and its rows: what a scope kept
     from before the field went up is dropped. TRAP T-send-to-view-filters */
  for (const [, s] of eachScope(w.draft)) forget(s, field);
  hold(w, VIEW, w.scope(VIEW).filter((f) => f !== field));
  // A chart's own scope takes the picks; the View's answer went with its hold.
  if (part) write(w, to, field, answer?.picked?.length ? { picked: [...answer.picked] } : undefined);
  cameFromBoth(w, field, undefined);
  w.commit();
  w.say({ kind: 'bars', scope: VIEW });
  if (!part) w.say({ kind: 'bars', scope: to });
}

/**
 * ONE FIELD'S ANSWER — what a control asks when the reader changes it. It
 * lands at the field's home. In a PART's scope, or with `only`, it is that
 * component's own answer, which narrows it alone. A field no scope holds is
 * first held in a component scope that may hold it; the View holds nothing
 * it is not given. The answer already in force changes nothing and tells no
 * one. `null` clears it. 366 step 18 · TRAP T-one-query-one-owner
 */
function answer(w: Work, scope: string, field: string, reading: FieldReading | null, at: { only?: string } = {}): void {
  if (at.only || w.facts.parts.has(scope) || w.draft.scopes[scope]?.narrows?.length) {
    const next = reading && readingAnswered(reading) ? reading : undefined;
    if (sameReading(w.draft.scopes[scope]?.readings[field], next)) return;
    write(w, scope, field, next, at);
    return;
  }
  // ALWAYS ON: its answer comes in on. Will, TODO 703
  if (reading?.suspended && alwaysOn(w, field, scope)) {
    refuse('field-always-on', 'answer', { scope: w.at(field, scope), field });
    const { suspended: _off, ...on } = reading;
    return answer(w, scope, field, on, at);
  }
  // A heading's answer to a field no scope holds is held in its grid's scope, and its bar draws the chip. TRAP T-a-heading-asks-through-the-source
  const fresh = !!reading && scope !== VIEW && !holderOf(w.draft, field) && w.canHold(scope, field);
  if (fresh) hold(w, scope, [...w.scope(scope), field]);
  const picked = reading?.picked ?? [];
  // A scope's own answer of a fixed View field is ITS, in it, under the View's. TODO 554 · TRAP T-a-scope-below-narrows-within-a-fixed-field
  const raws = raw(w, field, picked, reading ?? {});
  const next = w.own(scope, field) ? raws : keepPresets(w, field, raws);
  if (!sameReading(w.reading(field, scope), readingAnswered(next) ? next : undefined)) select(w, field, picked, reading ?? {}, scope);
  if (fresh) w.say({ kind: 'bars', scope });
}

/**
 * letGo(scope, field, keys) — the filters before a field rule these picks out:
 * they leave its APPLIED answer, and no Apply is asked — the rows had them out
 * already. A draft follows only while it is still the applied answer: one the
 * reader changed is theirs. Will, TODO 512 (A); 518 · TRAP T-a-ruled-out-value-is-greyed
 */
function letGo(w: Work, scope: string, field: string, keys: readonly string[]): void {
  const { applied, draft } = w;
  const was = applied.scopes[scope]?.readings[field];
  const kept = was?.picked?.filter((v) => !keys.includes(valueKey(v)));
  if (!was || !kept || kept.length === was.picked!.length) return;
  if (draft !== applied && sameReading(draft.scopes[scope]?.readings[field], was)) {
    draft.scopes[scope]!.readings[field] = { ...was, picked: kept };
  }
  applied.scopes[scope]!.readings[field] = { ...was, picked: kept };
  // ONE compile: what is applied moved; then the field is drawn its answer.
  w.say({ kind: 'commit' });
  w.say({ kind: 'drawn', fields: [field] });
}

/** Is this preset ON in a copy: its rows held on every field it names, in force. TODOs 510, 521 */
export function presetIn(query: Query, scope: string, id: string, preset: Preset | undefined): boolean {
  return !!preset && presetHeld(query, scope, id, preset.readings);
}

/**
 * A preset ON puts its conditions on each field, ANDed with what it holds,
 * where the field is held; where no scope holds it, in this scope, and it adds
 * no chip. The field's answer and mode stay the reader's. OFF takes them off.
 * Its on is read from the fields. With `commit`, the fields it moved are
 * applied at once. Will, TODOs 510 (A), 521, 526, 590 · TRAP T-a-preset-is-its-own-part
 */
function preset(w: Work, scope: string, id: string, on: boolean, commit = false): void {
  const given = w.facts.presets(scope).get(id);
  // Off goes on: a field suspended reads it off, and still holds its rows.
  if (!given || (on && presetIn(w.draft, scope, id, given))) return;
  w.batch(() => {
    const moved: string[] = [];
    for (const [field, reading] of Object.entries(given.readings)) {
      const tree = answerTree(reading);
      if (!tree) continue;
      const entry = scopeEntry(w.draft, holderOf(w.draft, field) ?? scope);
      const now = entry.readings[field];
      if (!on && !now?.byPreset?.[id]) continue;
      const next = withPreset(now, id, on ? { label: given.label, scope, tree } : null);
      if (readingAnswered(next)) entry.readings[field] = copyReading(next);
      else Reflect.deleteProperty(entry.readings, field);
      prune(w.draft);
      w.say({ kind: 'select', field, at: homeOf(w.draft, field) });
      moved.push(field);
    }
    if (commit) for (const field of moved) w.commit({ field });
  });
  w.say({ kind: 'preset', scope });
}

/** Clear all, Reset all: every answer homed in these scopes goes — a
 *  carry-over field's stays, with `carry` — and what a Switch turned off is
 *  forgotten; `organise` clears their sort and group too. The one door that
 *  clears what it does not name. TRAP T-a-field-can-carry-over-views */
function reset(w: Work, scopes: readonly string[], options: { carry?: boolean; organise?: boolean } = {}): void {
  w.batch(() => {
    // A Reset ends a solo: what it switched off is cleared with the rest.
    w.solo = null;
    for (const id of scopes) {
      const s = w.draft.scopes[id];
      if (!s) continue;
      if (s.suspended) s.suspended = { fields: [] };
      // A preset goes with the rest. TODO 526
      for (const [field, reading] of Object.entries(s.readings)) {
        if (!reading.byPreset) continue;
        const { byPreset: _held, ...own } = reading;
        s.readings[field] = own;
      }
      for (const field of Object.keys(s.readings)) {
        if (options.carry && w.facts.knows(field)?.carriesOver(field)) continue;
        const start = w.facts.opens(id)?.get(field);
        if (s.narrows?.length || w.facts.parts.has(id)) write(w, id, field, undefined);
        // A field with a start goes back to it, never to every row. TODO 403
        else if (start) select(w, field, [...start.picked ?? []], start, id);
        else select(w, field, [], {}, id);
      }
      // A preset that starts on goes back on, as a start does. Plan 963
      for (const [pid, given] of w.facts.presets(id)) if (given.on) preset(w, id, pid, true);
    }
    // The arrangement in a scope it resets, never another source's. TODO 523 S3
    const { scope } = arrangementOf(w.applied, (id) => scopes.includes(id));
    if (options.organise && scope) {
      // The rows' own, a slot's too: its chart's are below.
      edit(w, { scope, sort: null, clear: true }, false);
      edit(w, { scope, group: null }, false);
    }
    // …and a SLOT's own Group and Sort, its chart's. TODO 548
    for (const id of options.organise ? scopes : []) {
      const shown = { ...w.applied.scopes[id]?.presentation };
      if (shown.group || shown.sort) edit(w, { scope: id, presentation: { group: undefined, sort: undefined } });
    }
  });
}

/** Put the applied answers back over the draft — Discard, where a scope waits.
 *  One field, one scope, or all. Every control over them is drawn the applied answer. */
function discard(w: Work, at: At = {}): void {
  if (!w.waits) return;
  const before = new Set(w.answered());
  if (at.field) copyField(w.applied, w.draft, at.field);
  else if (at.scope) copyScope(w.applied, w.draft, at.scope);
  else w.draft = structuredClone(w.applied);
  w.say({ kind: 'drawn', fields: [...new Set([...before, ...w.answered()])], pending: true });
}

/**
 * A PURE edit — a Sort, Group or Search, a presentation, an order, a move —
 * written over the copies it reaches: the arrangement, a presentation and an
 * order in BOTH, since no Apply waits on them; a move in the draft. Every
 * re-arranging returns to page 1. TRAP T-one-command-one-door
 */
function edit(w: Work, given: PureEdit, slots = true): void {
  const { applied, draft } = w;
  const facts: EditFacts = {
    ...(slots ? { presents: w.facts.presents } : {}), theirs: w.facts.theirs(given.scope), applied, draft, viewFixed: w.viewFixed,
  };
  const routed = slotted(given, facts.presents);
  if ('move' in routed) return move(w, routed, facts);
  const next = editQuery(draft, routed, facts);
  const was = 'order' in routed ? draft.scopes[routed.scope ?? VIEW]?.holds ?? [] : null;
  const now = next.scopes[routed.scope ?? VIEW]?.holds ?? [];
  // An order that moves nothing must not wake every listener.
  if (was && was.length === now.length && was.every((f, i) => f === now[i])) return;
  w.applied = draft === applied ? next : editQuery(applied, routed, facts);
  w.draft = next;
  const scope = routed.scope ?? VIEW;
  w.say('presentation' in routed ? { kind: 'presented', scope }
    : 'order' in routed ? { kind: 'order', scope } : { kind: 'arranged', group: 'group' in routed });
}

/**
 * MOVE a filter between scopes — ONE edit, because the removal is not
 * optional. RAISED to the view, it leaves EVERY component; LOWERED, it leaves
 * the view and lands in one. A component that does not have the field refuses,
 * and says so. An answer that moved narrows from where it lives now, at once.
 * TRAP T-up-is-open-down-is-closed
 */
function move(w: Work, given: Extract<PureEdit, { move: unknown }>, facts: EditFacts): void {
  const to = given.scope ?? VIEW;
  const field = given.move;
  if (to !== given.from && w.facts.fixed(given.from).includes(field)) return refuse('field-fixed', 'move', { scope: given.from, field });
  if (!w.canHold(to, field)) {
    report({
      code: 'scope-refused',
      message: 'move: a component scope may hold only its own fields.',
      at: { field, from: given.from, to, offers: (w.facts.offers.get(to) ?? []).join(',') },
    });
    return;
  }
  const { draft, applied } = w;
  const was = homes(draft, w.viewFixed);
  const next = editQuery(draft, given, facts);
  const scopes = [...new Set([to, ...Object.keys({ ...draft.scopes, ...next.scopes }).filter((id) =>
    (draft.scopes[id]?.holds ?? []).join() !== (next.scopes[id]?.holds ?? []).join())])];
  w.draft = next;
  if (draft === applied) w.applied = next;
  const now = homes(next, w.viewFixed);
  const moved = [...now].filter(([f, home]) => was.get(f) !== home).map(([f]) => f);
  w.carry(moved);
  w.say({ kind: 'move', scopes, moved: moved.length > 0 });
}

/** A request that names no edit — `{ foo: 1 }`, or no object at all — is said, and changes nothing. TODO 718 */
function unknownRequest(given: unknown): void {
  const keys = given !== null && typeof given === 'object' ? Object.keys(given) : [];
  const said = keys.length ? `{ ${keys.join(', ')} }` : JSON.stringify(given) ?? String(given);
  report({ code: 'unknown-request', message: `ask: ${said} names no edit the Query knows, so nothing changed.`, at: { keys: keys.join(',') } });
}

/** One request, at work: a list is ONE change — one batch, one Apply. A page and a
 *  hover are no edit. */
function run(w: Work, request: QueryRequest): void {
  if (Array.isArray(request)) {
    w.batch(() => { for (const one of request as readonly QueryRequest[]) run(w, one); });
    return;
  }
  // A command read from JSON may be no object at all.
  if (!request || typeof request !== 'object') return unknownRequest(request);
  const one = request as Exclude<QueryRequest, readonly QueryRequest[]>;
  const at = one.scope ?? VIEW;
  if ('preview' in one || 'page' in one || 'pageSize' in one) return;
  if (isPureEdit(one)) edit(w, one);
  else if ('reset' in one) reset(w, [at], one.reset);
  else if ('preset' in one) preset(w, at, one.preset, one.on, !!one.commit);
  else if ('reading' in one) answer(w, at, one.field, one.reading, one.only ? { only: one.only } : {});
  else if ('solo' in one) solo(w, at, one.solo, { across: !!one.across });
  else if ('unsolo' in one) w.batch(() => unsolo(w));
  else if ('hold' in one) hold(w, at, one.hold);
  else if ('take' in one) take(w, at, one.take, one.from);
  else if ('release' in one) release(w, at, one.release);
  else if ('letGo' in one) letGo(w, at, one.field, one.letGo);
  else if ('discard' in one) discard(w, applyAt(one));
  else if ('suspended' in one) suspend(w, at, 'field' in one ? one.field : null, one.suspended);
  // Alone, `commit` is an Apply: one field, one scope, or every scope.
  else if ('commit' in one && one.commit) {
    w.commit(applyAt(one));
    return;
  } else return unknownRequest(one);
  // A preset's own commit applies the fields it moved, and no more.
  if ('commit' in one && one.commit && !('preset' in one)) w.commit('field' in one ? { field: one.field } : { scope: at });
}

/**
 * editCopies(copies, request, facts) — a request as a pure edit: both copies
 * after it, the copies given untouched, and what each member must hear, in the
 * order it happened. The edits `editQuery` makes are among them. A page and a
 * hover are no edit. TRAP T-one-command-one-door
 */
export function editCopies(copies: Copies, request: QueryRequest, facts: CopyFacts): Edited {
  const w = new Work(copies, facts);
  run(w, request);
  return w.done();
}

/** A scope's own readings, written as its page declares them — its start, or a
 *  component's own default (`only`) — each told as written. `undefined` removes one. */
export function writeScope(
  copies: Copies, scope: string, readings: Readonly<Record<string, FieldReading | undefined>>, facts: CopyFacts, at: { only?: string } = {},
): Edited {
  const w = new Work(copies, facts);
  for (const [field, reading] of Object.entries(readings)) write(w, scope, field, reading, reading ? at : {});
  return w.done();
}

/** An Apply of one scope, as `wait(scope, false)` sends what waits. */
export function commitScope(copies: Copies, scope: string, facts: CopyFacts): Edited {
  const w = new Work(copies, facts);
  w.commit({ scope });
  return w.done();
}
