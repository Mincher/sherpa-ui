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
 * - OffersAdvanced — whether a field offers Advanced conditions: beside its values, or instead
 * - KindSource — Enough of a filter definition to say what it is.
 * - advancedOf — a field's Advanced offer: beside its values, instead of them, or none
 * - kindOf — what a filter IS, from its def — worked out here and nowhere else
 * - hasOwnBody — Its menu holds a CONTROL of its own, not a list of values to tick.
 * - arranges — It ARRANGES rows rather than choosing them.
 * - picksOne — Exactly one answer, so its rows are radios and it applies as it is picked.
 * - oneChipList — A list too long for a run: ONE chip, its values in its menu.
 */

/** Every way a filter can be answered. `number` and `date` were already here,
 *  spelled as the value TYPE; the rest were inferred at fifteen separate sites. */
export const FILTER_KINDS = [
  'boolean', 'single', 'multi', 'advanced', 'number', 'date', 'group', 'sort',
] as const;

export type FilterKind = (typeof FILTER_KINDS)[number];

/** Whether a field offers Advanced conditions. OPT-IN: a closed set is
 *  answered by ticking, and a Contains box over it is noise.
 *  TRAP T-conditions-are-opt-in-per-field
 *  TRAP T-a-filter-answers-by-values-conditions-or-both */
export interface OffersAdvanced {
  /** Beside its values (`true`), or instead of them (`'only'`) — pair it with `op`. */
  advanced?: boolean | 'only';
}

/** Enough of a filter definition to say what it is. */
export interface KindSource extends OffersAdvanced {
  id?: string;
  kind?: string;
  select?: 'single' | 'multiple';
  options?: readonly unknown[];
  /** A SAVED Advanced filter's answer, given field by field. TRAP T-a-saved-filter-is-its-readings */
  readings?: Readonly<Record<string, unknown>>;
}

const KNOWN = new Set<string>(FILTER_KINDS);

/** A field's Advanced offer: beside its values, instead of them, or none. */
export function advancedOf(def: OffersAdvanced & { kind?: string }): boolean | 'only' {
  // A NUMBER asks its range as an Advanced row, so it offers Advanced unless it says not. Will, TODO 375
  return def.advanced ?? def.kind === 'number';
}

/**
 * THE ONE DERIVATION. A definition that names its `kind` is believed; one that
 * does not has it worked out HERE, and nowhere else.
 */
export function kindOf(def: KindSource): FilterKind {
  if (def.kind && KNOWN.has(def.kind)) return def.kind as FilterKind;
  // `group` and `sort` are named for their job; their id IS the kind.
  if (def.id === 'group' || def.id === 'sort') return def.id;
  // Its answer is GIVEN, over any fields: a saved Advanced filter.
  if (def.readings) return 'advanced';
  // No list to tick and no list behind the rows: the condition IS the answer.
  if (advancedOf(def) === 'only') return 'advanced';
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

/** The most values a list draws as a run of chips, one each. Will, TODO 89.
 *  TRAP T-only-group-and-sort-stay-one-chip */
const EXPLODE_AT = 16;

/** A list too long for a run: ONE chip, its values in its menu. */
export function oneChipList(def: KindSource): boolean {
  const kind = kindOf(def);
  // PARENTS only: a tiered field's children are under them. TODO 369
  const parents = (def.options ?? []).filter((o) => !(o as { parent?: string }).parent).length;
  return (kind === 'single' || kind === 'multi') && parents > EXPLODE_AT;
}
