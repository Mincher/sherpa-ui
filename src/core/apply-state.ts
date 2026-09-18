/**
 * apply-state.ts — configure a live element through its OWN public API.
 *
 *   applyState(grid, { setColumnFilter: ['name', ['name', 'contains', 'ana']] });
 *
 * THE PARITY PATH. Anything a person can do by clicking, a caller can do by
 * calling — through the same code, not a parallel one. This is that door: a
 * saved view, a preset, a deep link and an agent's MCP request are all one
 * object, applied one way.
 *
 * It does NOT set attributes. Attributes are the state channel a host writes
 * directly (`T-attributes-are-the-state-channel`); this is for the half a
 * component exposes as a METHOD or an ACCESSOR, which an attribute cannot
 * reach — `setColumnFilter`, `select`, `openColumnFilter`.
 *
 * TRAP T-state-is-the-saved-view-half — why those need their own field, and
 * why an unknown key is skipped rather than thrown.
 * TRAP T-one-way-to-build-an-element — why the `renderElement` half of this
 * file's ancestor is gone, and what builds an element now.
 * TRAP T-populatable-declared-four-times — `Populatable` lives here because it
 * is the one shape every bound component shares, and it had four copies.
 */

/**
 * An element that takes a data payload — the one shape, declared once.
 *
 * TRAP T-populatable-declared-four-times — `rendered` was missing from one of
 * them, and the shortest of four copies was a different contract.
 */
export interface Populatable extends HTMLElement {
  populate?: (data: unknown) => void | Promise<void>;
  rendered?: Promise<void>;
}

/**
 * Is this value a LIST OF CALLS rather than one argument list?
 *
 * TRAP T-state-value-may-be-a-call-list — every entry an array AND more than
 * one, because `setColumnFilter(field, clause)` is a single call whose args
 * happen to include an array.
 */
function isCallList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 1 && value.every((v) => Array.isArray(v));
}

/**
 * Apply a `state` block through an element's own public API.
 *
 * Returns the keys it could NOT apply, rather than throwing: a saved view made
 * against an older component set must degrade to "most of it came back", never
 * take the screen down.
 * TRAP T-state-is-the-saved-view-half.
 */
export function applyState(el: HTMLElement, state: Record<string, unknown>): string[] {
  const skipped: string[] = [];
  const target = el as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(state)) {
    // `in` walks the prototype chain, where a component's accessors and methods live.
    if (!(key in target)) {
      skipped.push(key);
      continue;
    }

    try {
      const current = target[key];
      if (typeof current === 'function') {
        // A METHOD — TRAP T-state-value-may-be-a-call-list.
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
      // A setter that refused — counted, not thrown.
      skipped.push(key);
    }
  }

  return skipped;
}
