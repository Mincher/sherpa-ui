/**
 * source-binding.ts — every component a DataSource is bound to, and how each
 * is bound. A DataSource holds one. DOM-free: a component is only a key.
 *
 * Map:
 * - Bound — One bound component: how it is bound, and what it was last pushed.
 * - SourceBinding — Every bound component, by element.
 * - .add — Bind a component, with the id a scope's `narrows` names it by.
 * - .remove — Let a component go, and tell its sink.
 * - .get — One component's bind, live, or undefined.
 * - .elements — Every bound component, as a copy.
 * - .entries — Every bind, live, in the order they were made.
 * - .componentScopes — The scopes a bound component answers — every other one is the page's.
 * - .wantsAllRows — Is any bind asking for the unpaged set?
 * - .showsOf — What the first component bound into a scope says it shows.
 * - .showsRows — Is a grid or a list bound into this scope?
 * - .debug — Each bind, for a bug report.
 */
import { VIEW } from './query.js';
import type { Populatable } from '../ui/apply-state.js';
import type { AttachFacts, BindSink } from './data-source-types.js';
import type { Row } from './store.js';

/** One bound component: how it is bound, and what it was last pushed. */
export interface Bound {
  readonly: boolean;
  steerOnly: boolean;
  /** See AttachFacts.rows. */
  rows: 'page' | 'all';
  /** The rows array last handed to this component — see `push`. */
  lastRows?: readonly Row[];
  /** See AttachFacts.id. */
  id: string;
  /** The filter narrowing ONLY this component it was last pushed with — see `push`. */
  lastOwn?: string;
  scope?: string | readonly string[];
  shows?: AttachFacts['shows'];
  /** Where its view, rows and pending fields go. */
  sink: BindSink;
}

/** Every bound component, by element. */
export class SourceBinding {
  /** Every bound component, and how it is bound. */
  #bound = new Map<Populatable, Bound>();
  /** Binds made, for an id when the element has none. */
  #binds = 0;

  /** Bind a component, with the id a scope's `narrows` names it by. */
  add(el: Populatable, facts: AttachFacts, sink: BindSink): void {
    this.#bound.set(el, {
      id: facts.id ?? (el.id || `bind-${++this.#binds}`),
      readonly: facts.readonly ?? false,
      steerOnly: facts.steerOnly ?? false,
      rows: facts.rows ?? 'page',
      sink,
      ...(facts.scope ? { scope: facts.scope } : {}),
      ...(facts.shows ? { shows: facts.shows } : {}),
    });
  }

  /** Let a component go, and tell its sink. */
  remove(el: Populatable): void {
    this.#bound.get(el)?.sink.off();
    this.#bound.delete(el);
  }

  /** One component's bind, live, or undefined. */
  get(el: Populatable): Bound | undefined {
    return this.#bound.get(el);
  }

  /** Every bound component, as a copy. */
  get elements(): Populatable[] {
    return [...this.#bound.keys()];
  }

  /** Every bind, live, in the order they were made. */
  entries(): IterableIterator<[Populatable, Bound]> {
    return this.#bound.entries();
  }

  /** The scopes a bound component answers — every other one is the page's. */
  componentScopes(): Set<string> {
    const out = new Set<string>();
    for (const { scope } of this.#bound.values()) {
      for (const s of Array.isArray(scope) ? scope : scope ? [scope] : []) if (s !== VIEW) out.add(s);
    }
    return out;
  }

  /** Is any bind asking for the unpaged set? TRAP T-a-summary-binds-to-all-the-rows */
  wantsAllRows(): boolean {
    for (const entry of this.#bound.values()) if (entry.rows === 'all') return true;
    return false;
  }

  /** What the first component bound into a scope says it shows. */
  showsOf(scope: string): AttachFacts['shows'] {
    return [...this.#bound.values()].find((b) => b.scope === scope && b.shows)?.shows;
  }

  /** Is a grid or a list bound into this scope? */
  showsRows(scope: string): boolean {
    return [...this.#bound.values()].some((b) => b.scope === scope && (b.shows === 'grid' || b.shows === 'list'));
  }

  /** Each bind, for a bug report. */
  debug(): Array<{ id: string; rows: 'page' | 'all'; readonly: boolean; steerOnly: boolean }> {
    return [...this.#bound.values()].map((e) => ({
      id: e.id, rows: e.rows, readonly: e.readonly, steerOnly: e.steerOnly,
    }));
  }
}
