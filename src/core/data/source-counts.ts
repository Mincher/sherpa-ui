/**
 * source-counts.ts — the pure halves of what a DataSource counts and limits:
 * the one order of a scope's answers, the walk's plan, and the walk asked of a
 * store step by step. Each takes what it reads, so a test needs no source.
 * DOM-free. TRAP T-one-walk-counts-and-limits-in-order
 *
 * Map:
 * - presentUnder — Each field's distinct values, as value keys, among the rows a filter matches.
 * - OrderEntry — One answer in a scope's order: a saved filter, or a field.
 * - answerOrder — A scope's answers in the ONE order: saved filters, then fields, each set together.
 * - WalkFacts — What a walk's plan needs that the Query does not say.
 * - planWalk — Each scope's steps and taps, in order, from the applied Query.
 * - walkStepwise — The same walk asked of a store, step by step, for a set not held.
 */
import { andFilter, readField, valueKey, type Filter, type Store } from './store.js';
import { readingClause, type FieldFacts, type FieldReading } from './filter-state.js';
import {
  appliesIn, heldInView, narrowsOne, presetClauses, scopeClauses, VIEW, withoutDropped,
  type CompileFacts, type Query,
} from './query.js';
import { emptyWalk, holdsKey, type Walk, type WalkPlan, type WalkScope, type WalkStep, type WalkTap } from './walk.js';
import type { FilterSet } from './data-source-types.js';

/** Each field's distinct values, as value keys, among the rows a filter matches. */
export async function presentUnder(
  store: Pick<Store, 'load' | 'distinct'>, fields: readonly string[], filter: Filter | undefined,
): Promise<Record<string, string[]>> {
  const options = filter ? { filter } : {};
  const keys = (values: readonly unknown[]): string[] => [...new Set(values
    .filter((v) => v != null && v !== '').map(valueKey))];
  if (store.distinct) {
    const found = await store.distinct(fields, options);
    return Object.fromEntries(fields.map((f) => [f, keys(found[f] ?? [])]));
  }
  const { rows } = await store.load(options);
  return Object.fromEntries(fields.map((f) => [f, keys(rows.map((r) => readField(r, f)))]));
}

/** One answer in a scope's order: a saved filter, or a field. `above`: the View
 *  holds it; `chain`: its place in a serial set. */
export type OrderEntry =
  | { kind: 'preset'; id: string; on: boolean; known: boolean }
  | { kind: 'field'; id: string; held: boolean; above: boolean; set?: string; chain?: 'top' | 'below' };

/**
 * A scope's answers in the ONE order (Will, D2 A): its saved filters first, in
 * the order it keeps them; then the fields it holds, each set gathered where its
 * first held field stands, in the set's order; then a reading no chip holds.
 * TRAP T-one-walk-counts-and-limits-in-order
 */
export function answerOrder(
  applied: Query, sets: readonly FilterSet[], presets: (id: string) => unknown, scope: string,
): OrderEntry[] {
  const q = applied.scopes[scope];
  if (!q) return [];
  const above = scope === VIEW ? new Set<string>() : heldInView(applied);
  const out: OrderEntry[] = Object.entries(q.presets ?? {})
    .map(([id, on]) => ({ kind: 'preset', id, on: !!on, known: !!presets(id) }));
  const setOf = (f: string): FilterSet | undefined => sets.find((set) => set.fields.includes(f));
  const placed = new Set<string>();
  const place = (f: string, held: boolean): void => {
    if (placed.has(f)) return;
    placed.add(f);
    const set = setOf(f);
    out.push({ kind: 'field', id: f, held, above: above.has(f), ...(set ? { set: set.id } : {}) });
  };
  for (const f of q.holds) {
    const set = setOf(f);
    for (const x of set ? set.fields.filter((x) => q.holds.includes(x)) : [f]) place(x, true);
  }
  for (const f of Object.keys(q.readings)) place(f, false);
  // A serial set's chain: its held fields the View does not hold, in the set's order.
  for (const set of sets) {
    if (set.mode !== 'serial') continue;
    const chain = out.filter((e): e is Extract<OrderEntry, { kind: 'field' }> =>
      e.kind === 'field' && e.held && !e.above && set.fields.includes(e.id));
    if (chain.length < 2) continue;
    chain.forEach((e, i) => { e.chain = i ? 'below' : 'top'; });
  }
  return out;
}

/** What a walk's plan needs that the Query does not say. */
export interface WalkFacts {
  /** A field's facts, as `readingClause` takes them. */
  field: (f: string) => Omit<FieldFacts, 'field'>;
  /** Is its answer a pick of values? */
  isList: (f: string) => boolean;
  /** Is this reading a plain pick — Simple, no range, the default op? */
  plainPicks: (f: string, reading: FieldReading) => boolean;
  /** A saved filter's readings, by id. */
  presets: (id: string) => Readonly<Record<string, FieldReading>> | undefined;
  /** A scope's filter sets. */
  sets: (scope: string) => readonly FilterSet[];
  /** The fields a scope may hold. */
  fields: (scope: string) => readonly string[];
  /** The scopes a bound component answers. */
  components: ReadonlySet<string>;
  /** A component's own scopes (`data-where`). */
  fixed: ReadonlySet<string>;
  /** The filter's named parts (`contribute`). */
  parts: readonly Filter[];
  /** A whole filter set by hand, while no reading is compiled. */
  hand?: Filter;
  /** Each chart part's scope: its legend field, and the component scope it is bound into. */
  narrowing: ReadonlyMap<string, { field: string; host?: string }>;
  /** Limit to matching filters. */
  limit: boolean;
  now: Date;
}

/**
 * Each scope's steps and taps, in order, from the applied Query: the View first,
 * from every row, its base the parts and the page's own scopes; then each other
 * scope from the View's end; then each chart part from its host's. With Limit, a
 * list field is ruled by the rows at its place; without, a component scope's by
 * the View's end (347), and the View's by nothing (D5 A).
 * TRAP T-one-walk-counts-and-limits-in-order
 */
export function planWalk(applied: Query, facts: WalkFacts): WalkPlan {
  const viewHolds = heldInView(applied);
  // An unknown saved filter is compile's to report; here it applies nothing.
  const compiling: CompileFacts = { field: facts.field, preset: (id) => facts.presets(id) ?? {}, components: facts.components, fixed: facts.fixed };
  const page: Filter[] = [];
  const others: string[] = [];
  for (const [id, scope] of Object.entries(applied.scopes)) {
    if (id === VIEW || narrowsOne(scope)) continue;
    if (!facts.components.has(id)) page.push(...scopeClauses(id, scope, viewHolds, compiling));
    others.push(id);
  }
  for (const id of facts.components) if (!others.includes(id) && !facts.narrowing.has(id)) others.push(id);
  const base = andFilter([...facts.parts, ...page]) ?? facts.hand;
  const ruleOf = (scope: string): 'here' | 'start' | undefined => (facts.limit ? 'here' : scope !== VIEW ? 'start' : undefined);

  const stepsOf = (scope: string): WalkStep[] => {
    const q = applied.scopes[scope];
    const steps: WalkStep[] = [];
    for (const e of answerOrder(applied, facts.sets(scope), facts.presets, scope)) {
      if (e.kind === 'preset') {
        const given = e.known ? facts.presets(e.id) : undefined;
        const clause = given ? andFilter(presetClauses(given, facts.field)) : undefined;
        // A saved filter counts only while it is on (166).
        steps.push({ id: e.id, ...(clause ? { clause } : {}), on: e.on && !!clause, counts: e.on && !!clause });
        continue;
      }
      const f = e.id;
      if (!appliesIn(viewHolds, scope, f, facts.fixed)) continue;
      const reading = q?.readings[f];
      const { suspended, ...answer } = reading ?? {};
      const fieldFacts = facts.field(f);
      const clause = reading ? readingClause({ field: f, ...fieldFacts }, answer) : undefined;
      const list = facts.isList(f);
      const rule = list ? ruleOf(scope) : undefined;
      const step: WalkStep = {
        id: f, field: f, ...(clause ? { clause } : {}),
        // OFF counts what it would match, and narrows nothing (D3 A, 123).
        on: !!clause && !suspended, counts: !!clause,
        ...(rule ? { ruler: rule } : {}), ...(list && e.chain === 'below' ? { offers: true } : {}),
      };
      if (reading && !suspended && reading.picked?.length && facts.plainPicks(f, reading)) {
        const type = fieldFacts.type;
        step.each = reading.picked.flatMap((value) => {
          // ONE value, with no list beside it. TRAP T-everything-on-is-no-filter
          const own = readingClause({ field: f, ...(type ? { type } : {}) }, { picked: [value], range: false });
          return own ? [[valueKey(value), own] as const] : [];
        });
        if (list) {
          step.picks = [...new Set(reading.picked.map(valueKey))];
          step.less = (aside) => readingClause({ field: f, ...fieldFacts }, withoutDropped(answer, aside));
        }
      }
      steps.push(step);
    }
    return steps;
  };

  const tapsOf = (scope: string, steps: readonly WalkStep[], extra: readonly string[] = []): WalkTap[] => {
    const rule = ruleOf(scope);
    if (!rule) return [];
    const stepped = new Set(steps.flatMap((s) => (s.field ? [s.field] : [])));
    const sets = facts.sets(scope);
    const taps: WalkTap[] = [];
    for (const f of new Set([...facts.fields(scope), ...extra])) {
      if (stepped.has(f) || !facts.isList(f) || (scope !== VIEW && viewHolds.has(f))) continue;
      // Where it would stand: after its set's last step here, else at the end.
      const set = sets.find((x) => x.fields.includes(f));
      const last = set ? steps.findLastIndex((s) => !!s.field && set.fields.includes(s.field)) : -1;
      taps.push({ at: last >= 0 ? last + 1 : steps.length, field: f, ruler: rule });
    }
    return taps;
  };

  const scopes: WalkScope[] = [];
  const viewSteps = [...(base ? [{ id: '', clause: base, on: true, counts: false }] : []), ...stepsOf(VIEW)];
  scopes.push({ scope: VIEW, after: null, steps: viewSteps, taps: tapsOf(VIEW, viewSteps), setsAside: true });
  for (const id of others) {
    const steps = stepsOf(id);
    // A page's own scope is in the View's base already: counted, never set aside.
    scopes.push({ scope: id, after: VIEW, steps, taps: tapsOf(id, steps), setsAside: facts.components.has(id) });
  }
  for (const [id, part] of facts.narrowing) {
    const steps = stepsOf(id);
    const after = part.host && others.includes(part.host) ? part.host : VIEW;
    scopes.push({ scope: id, after, steps, taps: tapsOf(id, steps, [part.field]), setsAside: false });
  }
  return { scopes, now: facts.now };
}

/** The same walk asked of a store, step by step — counts, values and tallies as
 *  requests, sent together; only a set-aside waits for the tally it reads. A
 *  relative date is the store's to read, as its loads are.
 *  TRAP T-one-walk-counts-and-limits-in-order */
export async function walkStepwise(reads: Pick<Store, 'load' | 'distinct' | 'totalCount'>, plan: WalkPlan): Promise<Walk> {
  const out = emptyWalk();
  const pending: Array<Promise<unknown>> = [];
  const ends = new Map<string, { filter: Filter | undefined; narrowed: boolean }>();
  // Each scope's taps, filled once every tally has landed.
  const taps: Array<() => void> = [];
  const count = (filters: readonly Filter[]): Promise<number> => reads.totalCount({ filter: andFilter(filters)! });
  for (const sc of plan.scopes) {
    const from = sc.after !== null ? ends.get(sc.after) : undefined;
    const before: Filter[] = from?.filter ? [from.filter] : [];
    let narrowed = from?.narrowed ?? false;
    const startFields = [...new Set([
      ...sc.steps.filter((s) => s.field && s.ruler === 'start').map((s) => s.field!),
      ...sc.taps.filter((t) => t.ruler === 'start').map((t) => t.field),
    ])];
    const start = startFields.length ? await presentUnder(reads, startFields, from?.filter) : {};
    const results: Record<string, number> = {};
    const values: Record<string, Record<string, number>> = {};
    const present: Record<string, string[]> = {};
    const offered: Record<string, string[]> = {};
    const aside: Record<string, string[]> = {};
    const tapped: Record<string, string[]> = {};
    const tap = (at: number): void => {
      const fields = sc.taps.filter((t) => t.at === at && t.ruler === 'here').map((t) => t.field);
      if (fields.length) pending.push(presentUnder(reads, fields, andFilter(before)).then((r) => Object.assign(tapped, r)));
    };
    for (let i = 0; i < sc.steps.length; i++) {
      const step = sc.steps[i]!;
      const field = step.field;
      const here = [...before];
      tap(i);
      const tallied = !!field && (step.ruler === 'here' || !!step.offers);
      const tally = tallied ? presentUnder(reads, [field!], andFilter(here)).then((r) => r[field!] ?? []) : Promise.resolve([]);
      if (field && step.each?.length) {
        const counts: Record<string, number> = {};
        values[field] = counts;
        for (const [key, clause] of step.each) pending.push(count([...here, clause]).then((n) => { counts[key] = n; }));
      }
      let test = step.clause;
      const offers = !!step.offers && narrowed;
      if (sc.setsAside && step.on && test && step.picks?.length && step.less && field) {
        const keys = await tally;
        const ruled = step.ruler === 'here' ? keys : step.ruler === 'start' ? start[field] ?? [] : null;
        const ruledOut = step.picks.filter((k) => (ruled && !holdsKey(ruled, k)) || (offers && !holdsKey(keys, k)));
        if (ruledOut.length) {
          aside[field] = ruledOut;
          test = step.less(ruledOut);
        }
      }
      const final = test;
      if (step.counts && final) pending.push(count([...here, final]).then((n) => { results[step.id] = n; }));
      if (field && step.ruler) {
        const ruler = step.ruler;
        pending.push(tally.then((keys) => { present[field] = ruler === 'here' ? keys : start[field] ?? []; }));
      }
      if (field && offers) pending.push(tally.then((keys) => { offered[field] = keys; }));
      if (step.on && final) {
        before.push(final);
        narrowed = true;
      }
    }
    tap(sc.steps.length);
    const spent: string[] = [];
    out.results[sc.scope] = results;
    out.values[sc.scope] = values;
    out.present[sc.scope] = present;
    out.offered[sc.scope] = offered;
    out.aside[sc.scope] = aside;
    out.spent[sc.scope] = spent;
    ends.set(sc.scope, { filter: andFilter(before), narrowed });
    taps.push(() => {
      for (const t of sc.taps) {
        const keys = t.ruler === 'here' ? tapped[t.field] ?? [] : start[t.field] ?? [];
        present[t.field] = keys;
        if (!keys.length) spent.push(t.field);
      }
    });
  }
  await Promise.all(pending);
  for (const fill of taps) fill();
  return out;
}
