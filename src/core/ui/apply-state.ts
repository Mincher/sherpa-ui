/**
 * apply-state.ts — configure a live element through its OWN public API, the
 * same path a click takes: `applyState(grid, { setColumnFilter: [f, clause] })`.
 *
 * Methods and accessors only — attributes are the other channel
 * (`T-attributes-are-the-state-channel`).
 *
 * TRAP T-state-is-the-saved-view-half  TRAP T-one-way-to-build-an-element
 * TRAP T-populatable-declared-four-times
 *
 * Map:
 * - Populatable — An element that takes a data payload.
 * - applyState — Apply a `state` block through an element's own public API.
 */
import type { BoundControl } from '../data/data-source-types.js';

/** An element that takes a data payload, and may be drawn by its source. TRAP T-populatable-declared-four-times */
export interface Populatable extends HTMLElement, BoundControl {
  /** HTMLElement's own, said again so the two parents agree. */
  id: string;
  populate?: (data: unknown) => void | Promise<void>;
  rendered?: Promise<void>;
  /** The fields its chips hold — what a scoped bar's scope holds. */
  heldFields?: string[];
}

/** A list of CALLS, not one argument list? TRAP T-state-value-may-be-a-call-list */
function isCallList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 1 && value.every((v) => Array.isArray(v));
}

/**
 * Apply a `state` block through an element's own public API.
 *
 * Returns the keys it could NOT apply. A saved view against an older component
 * set degrades; it never throws.
 * TRAP T-state-is-the-saved-view-half
 */
export function applyState(el: HTMLElement, state: Record<string, unknown>, refused: string[] = []): string[] {
  const skipped: string[] = [];
  const target = el as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(state)) {
    // `in` walks the prototype chain, where accessors and methods live.
    if (!(key in target)) {
      skipped.push(key);
      continue;
    }

    try {
      const current = target[key];
      if (typeof current === 'function') {
        // A METHOD — TRAP T-state-value-may-be-a-call-list
        const fn = current as (...a: unknown[]) => unknown;
        const calls = isCallList(value)
          ? (value as unknown[][])
          : [Array.isArray(value) ? value : [value]];
        for (const args of calls) fn.apply(el, args);
      } else {
        // An ACCESSOR, or a plain property.
        target[key] = value;
      }
    } catch {
      // A setter that refused — counted, not thrown; told apart from a key it lacks.
      skipped.push(key);
      refused.push(key);
    }
  }

  return skipped;
}
