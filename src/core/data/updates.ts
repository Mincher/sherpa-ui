/**
 * updates.ts — what is new, as one page holds it: a new version, each store's rows
 * waiting, the saves made offline that were lost — until the reader takes it in or
 * dismisses it. Fed by what is heard; it orders nothing. DOM-free. Plan 687 U1
 * TRAP T-a-notice-is-heard-never-ordered
 *
 * Map:
 * - NewsKind — A kind of news: the app's own files, a store's rows, a lost save.
 * - UpdatesDetail — What a change says: the notice heard, or what the reader took in.
 * - Updates — What is new, as one page holds it, until the reader takes it in or dismisses it.
 * - .hear — Hear a notice: it waits, and its kind shows again.
 * - .shows — Whether news of this kind waits, and the reader has not dismissed it.
 * - .dismiss — The reader closed what shows this kind: it hides until the next notice of it.
 * - .take — The reader took it in: a store's rows loaded again, or a lost save seen.
 * - .waiting — What waits: a new version, each store's rows, the lost saves.
 */
import type { UpdateNotice } from './notices.js';

/** A kind of news: the app's own files, a store's rows, a lost save. */
export type NewsKind = UpdateNotice['kind'];

/** What a change says: the notice heard, or what the reader took in. */
export interface UpdatesDetail {
  notice?: UpdateNotice;
  taken?: { kind: NewsKind; key?: string };
}

/** What is new, as one page holds it, until the reader takes it in or dismisses it.
 *  Says `change` on each move. */
export class Updates extends EventTarget {
  /** A new version waits. */
  #app = false;
  /** Each store whose rows wait, and how many where known; `''`, a store not named. */
  readonly #data = new Map<string, number | undefined>();
  /** Each lost save, by its notice's id. */
  readonly #lost = new Map<string, UpdateNotice>();
  /** The kinds the reader closed, until their next notice. */
  readonly #dismissed = new Set<NewsKind>();

  /** Hear a notice: it waits, and its kind shows again. A kept notice said again is no news. */
  hear(notice: UpdateNotice): void {
    if (notice.kind === 'lost') {
      const id = notice.id ?? `lost-${this.#lost.size}`;
      if (this.#lost.has(id)) return;
      this.#lost.set(id, notice);
    } else if (notice.kind === 'data') {
      this.#data.set(notice.store ?? '', notice.rows);
    } else {
      this.#app = true;
    }
    this.#dismissed.delete(notice.kind);
    this.#say({ notice });
  }

  /** Whether news of this kind waits, and the reader has not dismissed it. */
  shows(kind: NewsKind): boolean {
    if (this.#dismissed.has(kind)) return false;
    return kind === 'app' ? this.#app : kind === 'data' ? this.#data.size > 0 : this.#lost.size > 0;
  }

  /** The reader closed what shows this kind: it hides until the next notice of it. */
  dismiss(kind: NewsKind): void {
    if (this.#dismissed.has(kind)) return;
    this.#dismissed.add(kind);
    this.#say({});
  }

  /** The reader took it in: `data`, a store's rows loaded again (none named, every
   *  store's); `lost`, that save seen (none named, every one). */
  take(kind: 'data' | 'lost', key?: string): void {
    const held: Map<string, unknown> = kind === 'data' ? this.#data : this.#lost;
    if (key === undefined) held.clear();
    else held.delete(key);
    this.#say({ taken: { kind, ...(key === undefined ? {} : { key }) } });
  }

  /** What waits: a new version, each store's rows, the lost saves. */
  get waiting(): { app: boolean; data: ReadonlyMap<string, number | undefined>; lost: readonly UpdateNotice[] } {
    return { app: this.#app, data: new Map(this.#data), lost: [...this.#lost.values()] };
  }

  /** Say a change. */
  #say(detail: UpdatesDetail): void {
    this.dispatchEvent(new CustomEvent<UpdatesDetail>('change', { detail }));
  }
}
