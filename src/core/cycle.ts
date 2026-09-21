/**
 * cycle.ts — the enumerated states a control steps through, stated ONCE.
 *
 *   nextSort('name', 'name', 'desc')   → { field: 'name', direction: null }
 *   nextToggle(true)                   → false
 *
 * THE RATIFIED RULE. A control's body cycles that control's states, and **off
 * is a state, not a delete** — one more click brings the same thing back
 * without re-picking it from a menu.
 *
 * | control | the states its body cycles |
 * |---|---|
 * | a filter chip | active → inactive |
 * | Group | active → inactive |
 * | Sort | ascending → descending → suspended |
 *
 * WHY THIS IS A MODULE. The Sort cycle was written twice — once in the data
 * grid's column header, once in the toolbar's Sort chip — and the two DRIFTED:
 * the grid deleted the column on its third click while the chip suspended it,
 * so two controls of one value disagreed about what their shared third state
 * keeps. A rule each component re-reads from a document is a rule that drifts;
 * a function is not.
 *
 * NO DOM. These take the current state and return the next one. Reading it off
 * an attribute and writing the result back belongs to whoever owns the state —
 * which, for a bound component, is the DataSource
 * (`T-a-suspended-sort-is-one-owners-job`).
 *
 * TRAP T-a-chip-body-cycles-its-states — the rule and why it is one.
 * TRAP T-one-cycle-for-one-value — why it is a module rather than a convention.
 */
import type { SortDirection } from './store.js';

/* ── Sort ──────────────────────────────────────────────────────────────── */

/**
 * What a sort control is doing right now.
 *
 * `null` for the direction is SUSPENDED and not "unsorted": the field survives,
 * so a control can still show which column it would resume on. No field at all
 * is unsorted.
 */
export interface SortState {
  field: string | null;
  direction: SortDirection | null;
}

/**
 * The next state after a click on `field`.
 *
 * ```
 * a different column  →  ascending
 * ascending           →  descending
 * descending          →  SUSPENDED (field kept, direction null)
 * suspended           →  ascending again
 * ```
 *
 * `direction: null` is what a caller sends onward as "the query has no sort".
 * The FIELD it comes back with is the one to keep showing — that is the whole
 * difference between suspending and clearing.
 *
 * A click on a DIFFERENT column always starts ascending, whatever the previous
 * column was left at: the direction belongs to the sort, not to the control.
 */
export function nextSort(
  clicked: string,
  current: string | null | undefined,
  direction: SortDirection | null | undefined,
): SortState {
  if (current !== clicked) return { field: clicked, direction: 'asc' };
  // SUSPENDED → back on, ascending. Not at the `desc` it was left at: the
  // reader turned it off there, and resuming into the state they rejected reads
  // as the click having done nothing.
  if (direction == null) return { field: clicked, direction: 'asc' };
  if (direction === 'asc') return { field: clicked, direction: 'desc' };
  // DESCENDING → suspended. The column survives; only the ordering stops.
  return { field: clicked, direction: null };
}

/**
 * How a sort state is spelled on the wire, as `data-sort-direction`.
 *
 * | state | attribute |
 * |---|---|
 * | ascending | `"asc"` |
 * | descending | `"desc"` |
 * | suspended | `""` — an empty string, NOT absent |
 * | no sort at all | `undefined` — the attribute is removed |
 *
 * The empty string is load-bearing: the FIELD says which column, and the
 * DIRECTION says whether it is being applied. Three readers agree on it — the
 * grid's row sorter, the grid's header glyph, and the toolbar's Sort chip.
 * TRAP T-a-suspended-sort-is-one-owners-job.
 */
export function sortDirectionAttr(state: SortState): string | undefined {
  if (!state.field) return undefined;
  return state.direction ?? '';
}

/** Read a `data-sort-direction` attribute back into a direction. */
export function sortDirectionFrom(attr: string | null | undefined): SortDirection | null {
  if (attr === 'desc') return 'desc';
  if (attr === 'asc') return 'asc';
  // EMPTY or absent — suspended, or nothing. The FIELD tells the two apart.
  return null;
}

/* ── Two-state controls ────────────────────────────────────────────────── */

/**
 * The next state of an on/off control.
 *
 * Trivial on its own, and here so the two-state and three-state cases read the
 * same way at every call site — and so that "off is a state, not a delete"
 * is stated once for both. A caller that turns something off keeps whatever it
 * held; only an explicit clear throws it away.
 */
export function nextToggle(current: boolean): boolean {
  return !current;
}
