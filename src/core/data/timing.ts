/**
 * timing.ts — two timing rules the data layer keeps: one run per tick, and
 * the latest ask wins. DOM-free.
 * TRAP T-coalesce-microtask-not-debounce · TRAP T-in-flight-ticket-discards-stale
 *
 * Map:
 * - coalesce — `run` once at the end of this tick, however often it is asked.
 * - Latest — A ticket per ask: only the newest is current.
 * - .next — A new ticket; every older one is stale.
 * - .is — Is this ticket still the newest?
 * - .end — The newest ask is done, so none is in flight; false for a stale ticket.
 * - .busy — Is an ask in flight?
 */

/** `run` once at the end of this tick, however often it is asked. */
export function coalesce(run: () => void): () => void {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      run();
    });
  };
}

/** A ticket per ask: only the newest is current. */
export class Latest {
  /** The newest ticket, or null when none is in flight. */
  #now: symbol | null = null;

  /** A new ticket; every older one is stale. */
  next(): symbol {
    return (this.#now = Symbol('latest'));
  }

  /** Is this ticket still the newest? */
  is(ticket: symbol): boolean {
    return ticket === this.#now;
  }

  /** The newest ask is done, so none is in flight; false for a stale ticket. */
  end(ticket: symbol): boolean {
    if (ticket !== this.#now) return false;
    this.#now = null;
    return true;
  }

  /** Is an ask in flight? */
  get busy(): boolean {
    return this.#now !== null;
  }
}
