/**
 * journal.ts — a capped list of changes, each with what it was BEFORE and AFTER, and a
 * place in it: stepped back, then forward. Pure and DOM-free. A store keeps one for its
 * updates; the node editor keeps one for its draft. TRAP T-a-store-keeps-its-history
 *
 * Map:
 * - Change — One change: the state before it, and after.
 * - Journal — The last changes, capped; a new one after a step back drops what was stepped back from.
 * - .cap — The most changes it keeps.
 * - .push — Note a change, or fold it into the last one when `merge` says they are one.
 * - .back — The change to undo: the place moves back one.
 * - .forward — The change to redo: the place moves forward one.
 * - .canBack — Is there a change to undo?
 * - .canForward — Is there a change to redo?
 * - .peekBack — The change to undo, left where it is.
 * - .peekForward — The change to redo, left where it is.
 * - .clear — Forget every change.
 * - .size — How many changes it holds.
 */

/** One change: the state before it, and after. */
export interface Change<T> {
  before: T;
  after: T;
}

/** The last changes, capped (the OLDEST drop first); a new one after a step back drops the redo tail. */
export class Journal<T> {
  /** The most changes it keeps. */
  readonly cap: number;

  constructor(cap = 100) {
    this.cap = cap;
  }

  /** Note a change; `merge` returns the last change and this one as one (a drag, a typed word), or nothing. */
  push(change: Change<T>, merge?: (last: Change<T>, next: Change<T>) => Change<T> | undefined): void {
    this.#list.length = this.#at;
    const last = this.#list.at(-1);
    const merged = last && merge?.(last, change);
    if (merged) this.#list[this.#list.length - 1] = merged;
    else this.#list.push(change);
    if (this.#list.length > this.cap) this.#list.splice(0, this.#list.length - this.cap);
    this.#at = this.#list.length;
  }

  /** The change to undo; the place moves back one. */
  back(): Change<T> | undefined {
    return this.canBack ? this.#list[--this.#at] : undefined;
  }

  /** The change to redo; the place moves forward one. */
  forward(): Change<T> | undefined {
    return this.canForward ? this.#list[this.#at++] : undefined;
  }

  /** Is there a change to undo? */
  get canBack(): boolean {
    return this.#at > 0;
  }

  /** Is there a change to redo? */
  get canForward(): boolean {
    return this.#at < this.#list.length;
  }

  /** The change to undo, left where it is. */
  peekBack(): Change<T> | undefined {
    return this.#list[this.#at - 1];
  }

  /** The change to redo, left where it is. */
  peekForward(): Change<T> | undefined {
    return this.#list[this.#at];
  }

  /** Forget every change. */
  clear(): void {
    this.#list = [];
    this.#at = 0;
  }

  /** How many changes it holds. */
  get size(): number {
    return this.#list.length;
  }

  /** The changes, oldest first. */
  #list: Change<T>[] = [];
  /** How many are applied: the changes before this place can be undone, those after redone. */
  #at = 0;
}
