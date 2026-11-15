/**
 * settle-after.ts — work an element began after its render, which settled() waits for as it waits for `rendered`.
 * Its own module, so what begins work pulls in nothing of settled(). TRAP T-settled-waits-for-renders-not-transitions
 *
 * Map:
 * - settleAfter — make settled() under an element wait for work it began after its render; done or failed, it is let go
 * - workOf — the work an element began that is not done yet
 */

const working = new WeakMap<Element, Set<Promise<void>>>();

/** Make settled() under `el` wait for `work` too, as it waits for `rendered`; done or failed, it is let go. */
export function settleAfter(el: Element, work: Promise<unknown>): void {
  const set = working.get(el) ?? new Set();
  working.set(el, set);
  const done: Promise<void> = work.then(() => undefined, () => undefined).then(() => void set.delete(done));
  set.add(done);
}

/** The work `el` began that is not done yet. */
export function workOf(el: Element): ReadonlySet<Promise<void>> {
  return working.get(el) ?? new Set();
}
