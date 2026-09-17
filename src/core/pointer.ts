/**
 * pointer.ts — JSON Pointer (RFC 6901) reads, writes and overlap.
 *
 * `/theme/mode` addresses a value inside a plain object, and a subscriber can
 * watch a BRANCH — TRAP T-pointer-overlap-is-both-directions.
 *
 * TRAP T-pointer-stays-out-of-session — DOM-free by lint rule, so it must not be
 * folded into the browser-only `session.ts` an audit will point at.
 */

/**
 * Decode an escaped token. RFC 6901: `~1` is `/` and `~0` is `~`.
 *
 * TRAP T-pointer-escape-decode-order — `~1` first, then `~0`.
 */
function decodeToken(t: string): string {
  return t.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Read the value at `pointer`, or `undefined`.
 *
 * The empty pointer means the WHOLE document, per the standard. Anything not
 * starting with `/` is not a pointer and reads as undefined.
 */
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
 * A missing or non-object step is REPLACED with an object — refusing because the
 * branch does not exist yet would make every write order-dependent.
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
 * TRAP T-pointer-overlap-is-both-directions — one direction only leaves half the
 * subscribers stale.
 */
export function pointersOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}
