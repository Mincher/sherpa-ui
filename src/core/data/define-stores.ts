/**
 * define-stores.ts — an app's stores, said ONCE, in one module both hosts import:
 * its Service Worker and, with no worker, the page's own handler build the same
 * stores from it. A request may pick among several stores of one name, or have
 * its own store made; the APP reads the request to pick or make, and Sherpa never
 * does. DOM-free. TRAP T-a-request-picks-its-stores
 *
 * Map:
 * - StoreChoice — Several stores under one name, each by the app's own word for it, and the pick.
 * - StoreFactory — A store made for each request, by the app: a server wraps the request's own sign-in into it.
 * - StoreDefinition — One name's store: itself, a choice each request makes, or one made for each request.
 * - DefinedStore — One store of a set: its name, the app's word for it where its name has several, and the store.
 * - StoreSet — An app's stores: the one that answers each request, and every one a host may hand out.
 * - defineStores — An app's stores, made once, at a host's first ask.
 */
import type { Store } from './store.js';

/** Several stores under one name, each by the app's own word for it, and the pick. */
export interface StoreChoice {
  /** Each store the name may answer with, by the app's word for it. */
  readonly stores: Readonly<Record<string, Store>>;
  /** The word of the store that answers this request: the APP reads the request —
   *  its headers, its own say. Sherpa hands it on and never reads it. A word the
   *  choice lacks answers as no store. */
  readonly pick: (request: Request) => string;
}

/** A store made for each request, by the app: a server wraps the request's own
 *  sign-in into it — a store that sends it upstream. Sherpa hands the request on and
 *  never reads it. Never held, never heard: it lives for its one request. */
export type StoreFactory = (request: Request) => Store;

/** One name's store: itself, a choice each request makes, or one made for each request. */
export type StoreDefinition = Store | StoreChoice | StoreFactory;

/** One store of a set: its name, the app's word for it where its name has several, and the store. */
export interface DefinedStore {
  readonly name: string;
  readonly as?: string;
  readonly store: Store;
}

/** An app's stores: the one that answers each request, and every one a host may hand out. */
export interface StoreSet {
  /** The store that answers this request under a name, or undefined. */
  pick(name: string, request: Request): DefinedStore | undefined;
  /** Is a store said under this name? */
  has(name: string): boolean;
  /** Every store under a name — with none, every store: what a host checks, sends, hears and forgets.
   *  A store made per request is none of them. */
  all(name?: string): readonly DefinedStore[];
  /** The same set, each store in a host's own form, made once at its first ask: a
   *  worker holds each remote one. A store made per request keeps its own form. */
  through(form: (defined: DefinedStore) => Store): StoreSet;
}

/** Is this definition a choice, not a store? */
function isChoice(definition: StoreDefinition): definition is StoreChoice {
  return 'pick' in definition && 'stores' in definition;
}

/** An app's stores, made once, at a host's first ask: a page a worker answers makes none. */
export function defineStores(make: () => Readonly<Record<string, StoreDefinition>>): StoreSet {
  let made: { choices: Map<string, StoreChoice | StoreFactory | null>; all: DefinedStore[] } | null = null;
  const once = (): NonNullable<typeof made> => {
    if (made) return made;
    const choices = new Map<string, StoreChoice | StoreFactory | null>();
    const all: DefinedStore[] = [];
    for (const [name, definition] of Object.entries(make())) {
      if (typeof definition === 'function') {
        choices.set(name, definition);
        continue;
      }
      if (!isChoice(definition)) {
        choices.set(name, null);
        all.push({ name, store: definition });
        continue;
      }
      choices.set(name, definition);
      for (const [as, store] of Object.entries(definition.stores)) all.push({ name, as, store });
    }
    return (made = { choices, all });
  };
  return setOf(() => once().all, (name) => once().choices.has(name), (name, request) => {
    const { choices, all } = once();
    if (!choices.has(name)) return undefined;
    const choice = choices.get(name);
    if (typeof choice === 'function') return { name, store: choice(request) };
    const as = choice?.pick(request);
    return all.find((each) => each.name === name && each.as === as);
  });
}

/** A set over its stores, and how a request picks one of them. */
function setOf(all: () => readonly DefinedStore[], has: (name: string) => boolean, pick: (name: string, request: Request) => DefinedStore | undefined): StoreSet {
  return {
    pick,
    has,
    all: (name) => (name === undefined ? all() : all().filter((each) => each.name === name)),
    through(form) {
      const formed = new Map<DefinedStore, DefinedStore>();
      const as = (defined: DefinedStore): DefinedStore => {
        let out = formed.get(defined);
        if (!out) formed.set(defined, (out = { ...defined, store: form(defined) }));
        return out;
      };
      return setOf(() => all().map(as), has, (name, request) => {
        const defined = pick(name, request);
        // One made for its request is never formed: a held set per request would read its source each time.
        return defined && (all().includes(defined) ? as(defined) : defined);
      });
    },
  };
}
