/**
 * pointer.ts — JSON Pointer (RFC 6901) reads, writes and overlap.
 *
 * TRAP T-pointer-overlap-is-both-directions
 * TRAP T-pointer-stays-out-of-session — DOM-free by lint rule; never fold into
 * the browser-only `session.ts`.
 *
 * Map:
 * - getPointer — Read the value at `pointer`, or `undefined`.
 * - setPointer — Write `value` at `pointer`, creating the objects on the way.
 * - pointersOverlap — Does a change at one pointer concern a subscriber at the other?
 */

/** Decode an escaped token. TRAP T-pointer-escape-decode-order — `~1` before `~0`. */
function decodeToken(t: string): string {
  return t.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Read the value at `pointer`, or `undefined`. The empty pointer is the whole document. */
export function getPointer(root: unknown, pointer: string): unknown {
  if (pointer === '') return root;
  if (pointer[0] !== '/') return undefined;
  let cur: unknown = root;
  for (const raw of pointer.slice(1).split('/')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[decodeToken(raw)];
  }
  return cur;
}

/**
 * Write `value` at `pointer`, creating the objects on the way.
 *
 * A missing or non-object step is REPLACED — otherwise writes are order-dependent.
 */
export function setPointer(
  root: Record<string, unknown>,
  pointer: string,
  value: unknown,
): void {
  if (pointer === '' || pointer[0] !== '/') return;
  const tokens = pointer.slice(1).split('/').map(decodeToken);
  const leaf = tokens.pop();
  if (leaf === undefined) return;
  let cur: Record<string, unknown> = root;
  for (const k of tokens) {
    const next = cur[k];
    if (next == null || typeof next !== 'object') cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[leaf] = value;
}

/**
 * Does a change at one pointer concern a subscriber at the other?
 *
 * TRAP T-pointer-overlap-is-both-directions — one direction leaves half stale.
 */
export function pointersOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}
