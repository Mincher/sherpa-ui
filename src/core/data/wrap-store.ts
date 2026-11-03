/**
 * wrap-store.ts — one store over another: what the wrapper does not say itself is
 * the inner store's, read when asked — its facts, its optional reads, its events.
 * A wrapper that cannot keep one says so, by name. DOM-free.
 * TRAP T-a-store-says-what-it-can-do-once
 *
 * Map:
 * - StoreWrap — What a wrapper says itself: any member of a store, and each change as it says it.
 * - wrapStore — A store over another: its own members where it says them, the inner store's everywhere else.
 */
import type { Store, StoreChangeDetail } from './store.js';

/** The events a store says, each relayed. */
const STORE_EVENTS = ['change', 'waiting', 'queued', 'lost'] as const;

/** Every member of a store a wrapper forwards. */
const MEMBERS = [
  'key', 'time', 'capabilities', 'domains', 'history', 'stale',
  'load', 'totalCount', 'byKey', 'insert', 'update', 'remove',
  'distinct', 'scan', 'changes', 'recheck', 'take', 'send', 'forget',
] as const;
type Member = (typeof MEMBERS)[number];

/** What a wrapper says itself: any member of a store — `undefined` says it has
 *  none — and each change of the inner store as it says it; `null` says nothing. */
export type StoreWrap = { [K in Member]?: Store[K] | undefined } & {
  change?: (detail: StoreChangeDetail | undefined) => StoreChangeDetail | undefined | null;
};

/** A store over another: its own members where it says them, the inner store's
 *  everywhere else. TRAP T-a-store-says-what-it-can-do-once */
export function wrapStore(inner: Store, own: StoreWrap = {}): Store {
  const out = new EventTarget();
  const { change, ...members } = own;
  relay(inner, new WeakRef(out), change);
  // A member set later is the wrapper's own, as one it said.
  const ownValue = (name: Member, value: unknown): void => {
    Object.defineProperty(out, name, { value, writable: true, configurable: true, enumerable: true });
  };
  for (const name of MEMBERS) {
    if (name in members) ownValue(name, members[name]);
    else {
      Object.defineProperty(out, name, {
        get: () => {
          const value: unknown = inner[name];
          return typeof value === 'function' ? value.bind(inner) : value;
        },
        set: (value: unknown) => ownValue(name, value),
        configurable: true, enumerable: true,
      });
    }
  }
  return out as Store;
}

/** Each event of the inner store, said by its wrapper — held WEAKLY, so a wrapper
 *  dropped is freed and its relay goes at the next event. Its own scope: a closure
 *  beside the wrapper would keep it. TRAP T-a-closed-source-hears-nothing */
function relay(inner: Store, to: WeakRef<EventTarget>, change: StoreWrap['change']): void {
  const said = (event: Event): void => {
    const wrapper = to.deref();
    if (!wrapper) {
      for (const type of STORE_EVENTS) inner.removeEventListener(type, said);
      return;
    }
    const detail = (event as CustomEvent<unknown>).detail;
    const next = event.type === 'change' && change ? change(detail as StoreChangeDetail | undefined) : detail;
    if (next !== null) wrapper.dispatchEvent(new CustomEvent(event.type, { detail: next }));
  };
  for (const type of STORE_EVENTS) inner.addEventListener(type, said);
}
