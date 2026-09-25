/**
 * filter-kind.ts — WHAT A FILTER IS, worked out once.
 *
 * Will, 2026-09-25: "Group is a thing. Sort is a thing. Boolean filters are a
 * thing. Single select value filters are a thing. Multi select value filters
 * are a thing. Compound Conditional filters are a thing. Organise is not. It's
 * just a label on the screen."
 *
 * A heading, a section, a zone, a bar or a panel is PRESENTATION and never
 * names a kind. TRAP T-a-chip-knows-what-kind-it-is
 */

/** Every way a filter can be answered. `number` and `date` were already here,
 *  spelled as the value TYPE; the rest were inferred at fifteen separate sites. */
export const FILTER_KINDS = [
  'boolean', 'single', 'multi', 'conditional', 'number', 'date', 'group', 'sort',
] as const;

export type FilterKind = (typeof FILTER_KINDS)[number];

/** Enough of a filter definition to say what it is. */
export interface KindSource {
  id?: string;
  kind?: string;
  select?: 'single' | 'multiple';
  conditions?: boolean | 'only';
  options?: readonly unknown[];
}

const KNOWN = new Set<string>(FILTER_KINDS);

/**
 * THE ONE DERIVATION. A definition that names its `kind` is believed; one that
 * uses the older spelling has it worked out HERE, and nowhere else.
 */
export function kindOf(def: KindSource): FilterKind {
  if (def.kind && KNOWN.has(def.kind)) return def.kind as FilterKind;
  // `group` and `sort` are named for their job; their id IS the kind.
  if (def.id === 'group' || def.id === 'sort') return def.id;
  // No list to tick and no list behind the rows: the condition IS the answer.
  if (def.conditions === 'only') return 'conditional';
  // Nothing to pick from is a question with a yes/no answer.
  if (!def.options?.length) return 'boolean';
  return def.select === 'single' ? 'single' : 'multi';
}

/** Its menu holds a CONTROL of its own, not a list of values to tick. */
export function hasOwnBody(kind: FilterKind): boolean {
  return kind === 'number' || kind === 'date' || kind === 'conditional';
}

/** It ARRANGES rows rather than choosing them. */
export function arranges(kind: FilterKind): boolean {
  return kind === 'group' || kind === 'sort';
}

/** Exactly one answer, so its rows are radios and it applies as it is picked. */
export function picksOne(kind: FilterKind): boolean {
  return kind === 'single' || kind === 'group' || kind === 'sort';
}
