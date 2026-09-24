/**
 * allow.ts — an optional allow-list, for any axis a component offers.
 *
 * No list means EVERYTHING is allowed. That is the default, so a component
 * that never hears about this behaves exactly as it did.
 *
 * Four axes, one rule: fields a toolbar offers, values a menu offers, states a
 * control cycles through, actions a component may perform. A list is a plain
 * array — data, not code — so it can come from a context, a role or a fetch,
 * and no component needs a branch for who is looking.
 *
 * DOM-free: the rule, not the wiring.
 *
 * TRAP T-an-allow-list-is-a-filter-not-an-order
 */
import { valueKey } from './store.js';

/** An item with an identity. A bare string is its own id. */
export interface Identified {
  id?: string;
  value?: string;
  field?: string;
}

/**
 * What names an item on an allow-list. A LIST entry may be a bare string or an
 * object; so may the item being tested, and they match by the same key.
 */
export type AllowEntry = string | Identified;

/** A list, or nothing at all — which allows everything. */
export type AllowList = readonly AllowEntry[] | null | undefined;

/**
 * The identity used for comparison: `id`, else `value`, else `field`, else the
 * value itself through `valueKey`.
 *
 * Checked IN THAT ORDER and the first present one wins, so a filter def
 * (`{ id, label, field }`) and the field name it is listed under still meet.
 */
export function allowKey(item: unknown): string {
  if (item != null && typeof item === 'object') {
    const o = item as Identified;
    if (typeof o.id === 'string') return o.id;
    if (typeof o.value === 'string') return o.value;
    if (typeof o.field === 'string') return o.field;
  }
  return valueKey(item);
}

/** The keys a list permits, or `null` for "no list, everything allowed". */
function keysOf(list: AllowList): Set<string> | null {
  if (list == null) return null;
  return new Set(list.map(allowKey));
}

/** Is this item permitted? No list → yes. */
export function isAllowed(item: unknown, list: AllowList): boolean {
  const keys = keysOf(list);
  return keys == null || keys.has(allowKey(item));
}

/**
 * The permitted subset of `items`, in THEIR order — not the list's.
 *
 * The list says WHICH, never in what sequence: a component that sorts its own
 * options would otherwise have that sort silently replaced by whatever order a
 * caller happened to write. TRAP T-an-allow-list-is-a-filter-not-an-order
 */
export function allow<T>(items: readonly T[], list: AllowList): T[] {
  const keys = keysOf(list);
  if (keys == null) return [...items];
  return items.filter((item) => keys.has(allowKey(item)));
}

/**
 * What a list names that `items` does not have.
 *
 * A value must exist in the field's own set to be allow-listed, so a name with
 * nothing behind it is a caller's mistake — a typo, or a field that has since
 * gone. It is reported rather than thrown: a stale entry should not stop the
 * other nine from working.
 */
export function unknownEntries<T>(items: readonly T[], list: AllowList): string[] {
  if (list == null) return [];
  const have = new Set(items.map(allowKey));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of list) {
    const key = allowKey(entry);
    if (have.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/* ── States ─────────────────────────────────────────────────────────── */

/**
 * The next state in a cycle, given where it is now.
 *
 * This is what makes a two-state toggle and a tri-state cycle the SAME
 * control: the component steps the list it was given and does not care how
 * long it is. An unknown current state starts the cycle from the beginning,
 * so a value that has been removed from the list cannot strand a control.
 *
 * Returns `undefined` for an empty list — there is no state to be in.
 */
export function nextState<T>(states: readonly T[], current: unknown): T | undefined {
  if (!states.length) return undefined;
  const at = states.findIndex((s) => allowKey(s) === allowKey(current));
  return states[at < 0 ? 0 : (at + 1) % states.length];
}
