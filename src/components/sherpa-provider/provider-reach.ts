/**
 * provider-reach.ts — can the page's data be reached: the worst of its sources',
 * read from state, and tried again when the network or the tab comes back.
 *
 * Map:
 * - PageReach — The page's reach, with why while it is not ok.
 * - ReachHost — What the reach asks of its provider.
 * - ProviderReach — The page's reach, for one provider.
 * - .now — The page's reach, as last said.
 * - .watch — Read the reach again on each source's change and failure, until `signal`.
 * - .sync — Read each source's reach, from state, never from the last event, and say a change.
 * - .set — Keep the page's reach, and say it when it moved.
 * - .recheck — Try every source that cannot reach its store again, and ask what moved.
 * - .back — The network back, or the tab shown again: recheck.
 */
import type { Failure } from '../../core/data/failure.js';
import type { DataSource } from '../../core/data/data-source.js';

/** The page's reach, with why while it is not ok: `unreached` shows the last rows, unconfirmed; `down` has none. */
export interface PageReach {
  reach: 'ok' | 'unreached' | 'down';
  failure?: Failure;
}

/** What the reach asks of its provider. */
export interface ReachHost {
  /** The sources the subtree is given now. */
  sources(): DataSource[];
  /** The page's reach moved. */
  changed(reach: PageReach): void;
}

/** The page's reach, for one provider. */
export class ProviderReach {
  /** The provider it serves. */
  readonly #host: ReachHost;
  /** The page's reach, as last said. */
  #reach: PageReach = { reach: 'ok' };

  constructor(host: ReachHost) {
    this.#host = host;
  }

  /** The page's reach, as last said. */
  get now(): PageReach {
    return { ...this.#reach };
  }

  /** Read the reach again on each source's change and failure, until `signal`. */
  watch(sources: readonly DataSource[], signal: AbortSignal): void {
    for (const source of sources) {
      source.addEventListener('change', () => this.sync(), { signal });
      source.addEventListener('error', () => this.sync(), { signal });
    }
  }

  /** Read each source's reach — from state, never from the last event — and say a change. */
  sync(): void {
    const rank = { ok: 0, unreached: 1, down: 2 } as const;
    let worst: PageReach = { reach: 'ok' };
    const sources = this.#host.sources();
    // A source that has not answered yet says nothing: the page's reach stands until one does.
    const known = sources.filter((source) => source.loaded || source.reach !== 'ok');
    if (sources.length && !known.length) return;
    for (const source of known) {
      const reach = source.reach;
      if (rank[reach] <= rank[worst.reach]) continue;
      const failure = source.failure;
      worst = { reach, ...(failure ? { failure } : {}) };
    }
    this.set(worst);
  }

  /** Keep the page's reach, and say it when it moved. */
  set(next: PageReach): void {
    if (next.reach === this.#reach.reach && next.failure?.kind === this.#reach.failure?.kind) return;
    this.#reach = next;
    this.#host.changed({ ...next });
  }

  /** Try every source that cannot reach its store again, and ask one that may miss a writer what moved. */
  recheck(): void {
    for (const source of this.#host.sources()) source.recheck();
  }

  /** The network back, or the tab shown again: a store that could not be
   *  reached is tried again, and one that may miss a writer is asked what moved. */
  back = (): void => {
    if (document.visibilityState === 'visible') this.recheck();
  };
}
