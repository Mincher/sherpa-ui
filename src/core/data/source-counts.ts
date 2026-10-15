/**
 * source-counts.ts — the pure halves of what a DataSource counts and limits:
 * what limits a field, the values the rows hold under a filter, and each
 * serial set's chain. Each takes what it reads, so a test needs no source.
 * DOM-free.
 *
 * Map:
 * - limitFor — What limits one field: the applied Query compiled without that field's own answer.
 * - presentUnder — Each field's distinct values, as value keys, among the rows a filter matches.
 * - serialChains — Each serial set's chain, by scope: the fields it holds, in the set's order.
 * - belowIn — The fields below each chained field, by `scope:field`.
 * - clauseOf — One field's answer as a clause, less the picks set aside.
 */
import { andFilter, readField, valueKey, type Filter, type Store } from './store.js';
import { readingClause } from './filter-state.js';
import { compile, heldInView, VIEW, withoutDropped, type CompileFacts, type Query } from './query.js';
import type { FieldCatalogue } from './field-catalogue.js';
import type { FilterSet } from './data-source-types.js';

/** What limits one field: the applied Query compiled WITHOUT that field's own answer in its scope. */
export function limitFor(applied: Query, facts: CompileFacts, scope: string, field: string): Filter | undefined {
  // Never edit `own`: on a local source the applied Query IS the draft.
  const own = applied.scopes[scope];
  const { [field]: _own, ...readings } = own?.readings ?? {};
  const query: Query = own ? { ...applied, scopes: { ...applied.scopes, [scope]: { ...own, readings } } } : applied;
  const { view, scoped } = compile(query, facts);
  return andFilter([view, scope === VIEW ? undefined : scoped[scope]].filter((f): f is Filter => !!f));
}

/** Each field's distinct values, as value keys, among the rows a filter matches. */
export async function presentUnder(
  store: Store, fields: readonly string[], filter: Filter | undefined,
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

/** Each SERIAL set's chain, by scope: the fields it holds, in the set's order.
 *  A field the View holds is answered there, so it is out of a component's chain. */
export function serialChains(
  applied: Query, setsByScope: ReadonlyMap<string, readonly FilterSet[]>,
): Array<[scope: string, chain: string[]]> {
  const viewHolds = heldInView(applied);
  const out: Array<[string, string[]]> = [];
  for (const [scope, sets] of setsByScope) {
    const holds = new Set(applied.scopes[scope]?.holds ?? []);
    for (const set of sets) {
      if (set.mode !== 'serial') continue;
      const chain = set.fields.filter((f) => holds.has(f) && (scope === VIEW || !viewHolds.has(f)));
      if (chain.length > 1) out.push([scope, chain]);
    }
  }
  return out;
}

/** The fields BELOW each chained field, by `scope:field`. */
export function belowIn(chains: ReadonlyArray<readonly [string, readonly string[]]>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [scope, chain] of chains) {
    chain.forEach((f, i) => out.set(`${scope}:${f}`, new Set(chain.slice(i + 1))));
  }
  return out;
}

/** One field's answer as a clause, less the picks set aside. */
export function clauseOf(
  applied: Query, catalogue: FieldCatalogue, scope: string, field: string, aside: readonly string[] | undefined,
): Filter | undefined {
  const reading = applied.scopes[scope]?.readings[field];
  if (!reading || reading.suspended) return undefined;
  return readingClause({ field, ...catalogue.facts(field) }, withoutDropped(reading, aside));
}
