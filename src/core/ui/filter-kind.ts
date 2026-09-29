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
 *
 * Map:
 * - FILTER_KINDS — Every way a filter can be answered.
 * - FilterKind — boolean, single, multi, advanced, number, date, group or sort
 * - OffersCustom — whether a field offers a Custom Condition Filter: beside its values, or instead
 * - KindSource — Enough of a filter definition to say what it is.
 * - customOf — a field's Custom Condition Filter offer — the new key wins, the old one still counts
 * - kindOf — what a filter IS, from its def — worked out here and nowhere else
 * - hasOwnBody — Its menu holds a CONTROL of its own, not a list of values to tick.
 * - arranges — It ARRANGES rows rather than choosing them.
 * - picksOne — Exactly one answer, so its rows are radios and it applies as it is picked.
 */

/** Every way a filter can be answered. `number` and `date` were already here,
 *  spelled as the value TYPE; the rest were inferred at fifteen separate sites. */
export const FILTER_KINDS = [
  'boolean', 'single', 'multi', 'advanced', 'number', 'date', 'group', 'sort',
] as const;

export type FilterKind = (typeof FILTER_KINDS)[number];

/** Whether a field offers a Custom Condition Filter. OPT-IN: a closed set is
 *  answered by ticking, and a Contains box over it is noise.
 *  TRAP T-conditions-are-opt-in-per-field
 *  TRAP T-a-filter-answers-by-values-conditions-or-both */
export interface OffersCustom {
  /** Beside its values (`true`), or instead of them (`'only'`) — pair it with `op`. */
  custom?: boolean | 'only';
  /** @deprecated The old name of `custom`, still read. */
  conditions?: boolean | 'only';
}

/** Enough of a filter definition to say what it is. */
export interface KindSource extends OffersCustom {
  id?: string;
  kind?: string;
  select?: 'single' | 'multiple';
  options?: readonly unknown[];
  /** A SAVED custom filter's answer, given field by field. TRAP T-a-saved-filter-is-its-readings */
  readings?: Readonly<Record<string, unknown>>;
}

const KNOWN = new Set<string>(FILTER_KINDS);

/** The kinds' spellings before 2026-09-25, still believed.
 *  TRAP T-a-renamed-attribute-keeps-its-old-name */
const OLD_KINDS: Readonly<Record<string, FilterKind>> = { conditional: 'advanced', custom: 'advanced' };

/** A field's Custom Condition Filter offer — the new key wins, the old one still counts. */
export function customOf(def: OffersCustom): boolean | 'only' {
  return def.custom ?? def.conditions ?? false;
}

/**
 * THE ONE DERIVATION. A definition that names its `kind` is believed; one that
 * uses the older spelling has it worked out HERE, and nowhere else.
 */
export function kindOf(def: KindSource): FilterKind {
  const named = def.kind ? (OLD_KINDS[def.kind] ?? def.kind) : undefined;
  if (named && KNOWN.has(named)) return named as FilterKind;
  // `group` and `sort` are named for their job; their id IS the kind.
  if (def.id === 'group' || def.id === 'sort') return def.id;
  // Its answer is GIVEN, over any fields: a saved Custom Condition Filter.
  if (def.readings) return 'advanced';
  // No list to tick and no list behind the rows: the condition IS the answer.
  if (customOf(def) === 'only') return 'advanced';
  // Nothing to pick from is a question with a yes/no answer.
  if (!def.options?.length) return 'boolean';
  return def.select === 'single' ? 'single' : 'multi';
}

/** Its menu holds a CONTROL of its own, not a list of values to tick. */
export function hasOwnBody(kind: FilterKind): boolean {
  return kind === 'number' || kind === 'date' || kind === 'advanced';
}

/** It ARRANGES rows rather than choosing them. */
export function arranges(kind: FilterKind): boolean {
  return kind === 'group' || kind === 'sort';
}

/** Exactly one answer, so its rows are radios and it applies as it is picked. */
export function picksOne(kind: FilterKind): boolean {
  return kind === 'single' || kind === 'group' || kind === 'sort';
}
