/**
 * pointer.ts — JSON Pointer (RFC 6901) reads, writes and overlap.
 *
 * `/theme/mode` addresses a value inside a plain object. Sherpa uses pointers
 * wherever one value has many readers — a view definition's `$state` bindings,
 * the session store's subscriptions — because a pointer lets a subscriber watch
 * a BRANCH and hear about anything beneath it. A flat key cannot do that.
 *
 * Extracted from `render-view.ts` when `SessionStore` needed the same three
 * functions. They are the standard's, not ours, so there is exactly one right
 * implementation and no reason for two.
 */

/**
 * Decode an escaped token. RFC 6901: `~1` is `/` and `~0` is `~`.
 *
 * ORDER MATTERS — `~1` first, then `~0`. Reversed, a literal `~1` in a key
 * would decode to `~` and then to `/`, which is a different key.
 */
function decodeToken(t: string): string {
  return t.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Read the value at `pointer`, or `undefined`.
 *
 * The empty pointer means the WHOLE document, per the standard. Anything that
 * does not start with `/` is not a pointer and reads as undefined rather than
 * being guessed at.
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
 * A missing or non-object step is REPLACED with an object: the caller asked for
 * a value to live at this address, and refusing because the branch does not
 * exist yet would make every write order-dependent.
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
 * TRUE EITHER WAY ROUND, which is the whole subtlety: a subscriber on `/theme`
 * must hear a write to `/theme/mode` (its branch changed), and a subscriber on
 * `/theme/mode` must hear a write to `/theme` (its value may have been replaced
 * wholesale). Checking one direction only leaves half the subscribers stale.
 */
export function pointersOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}
