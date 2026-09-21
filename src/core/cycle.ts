/**
 * cycle.ts — the states a control steps through, stated once.
 *
 * Off is a STATE, not a delete: one more click brings the same thing back.
 * Filter chips and Group are two-state; Sort is asc → desc → suspended.
 *
 * DOM-free on purpose — `sherpa-element.ts` throws on import in Node, which
 * would put this out of reach of `sherpa-ui/data`.
 *
 * TRAP T-a-chip-body-cycles-its-states
 * TRAP T-one-cycle-for-one-value
 */
import type { SortDirection } from './store.js';

/** A null direction is SUSPENDED — the field survives. No field is unsorted. */
export interface SortState {
  field: string | null;
  direction: SortDirection | null;
}

/**
 * The next state after a click on `field`.
 *
 * Another column → asc. asc → desc. desc → suspended. suspended → asc.
 */
export function nextSort(
  clicked: string,
  current: string | null | undefined,
  direction: SortDirection | null | undefined,
): SortState {
  if (current !== clicked) return { field: clicked, direction: 'asc' };
  // Resuming starts ASCENDING — not at the `desc` the reader turned off.
  if (direction == null) return { field: clicked, direction: 'asc' };
  if (direction === 'asc') return { field: clicked, direction: 'desc' };
  return { field: clicked, direction: null };
}

/**
 * `data-sort-direction`: `asc` | `desc` | `''` suspended | absent for no sort.
 *
 * The empty string is load-bearing — TRAP T-a-suspended-sort-is-one-owners-job.
 */
export function sortDirectionAttr(state: SortState): string | undefined {
  if (!state.field) return undefined;
  return state.direction ?? '';
}

/** Read it back. Empty and absent both give null; the FIELD tells them apart. */
export function sortDirectionFrom(attr: string | null | undefined): SortDirection | null {
  if (attr === 'desc') return 'desc';
  if (attr === 'asc') return 'asc';
  return null;
}

/** The next state of an on/off control — so both cases read the same way. */
export function nextToggle(current: boolean): boolean {
  return !current;
}
