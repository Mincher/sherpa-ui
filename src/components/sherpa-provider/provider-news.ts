/**
 * provider-news.ts — what is new for a page, heard from its feed and shown by
 * every element under its provider that listens for its kind.
 * Will, plan 652 S6 · TRAP T-a-notice-is-heard-never-ordered
 *
 * Map:
 * - ProviderNews — The notices of one provider's subtree.
 * - .hear — Hear what is new, until `stop()`.
 * - .stop — Stop hearing.
 * - .draw — Each listening element shows while news of its kind waits.
 * - .dismissed — A listening element dismissed: its kinds hide until the next notice.
 * - .refreshed — A listening element's own Refresh takes the waiting rows in.
 */
import { hearUpdates } from '../../core/browser/updates.js';
import type { NewsKind, Updates } from '../../core/data/updates.js';

/** The kinds of news an element listens for. */
const kindsOf = (el: HTMLElement): NewsKind[] => (el.dataset['listens'] ?? '').split(/\s+/).filter(Boolean) as NewsKind[];

/** The notices of one provider's subtree. */
export class ProviderNews {
  /** The subtree its listening elements are in. */
  readonly #root: ParentNode;
  /** What is new for the page. */
  readonly #updates: Updates;
  /** Stops hearing what is new. */
  #stop: (() => void) | null = null;

  constructor(root: ParentNode, updates: Updates) {
    this.#root = root;
    this.#updates = updates;
  }

  /** Hear what is new, until `stop()`. */
  hear(): void {
    this.#stop = hearUpdates(this.#updates);
  }

  /** Stop hearing. */
  stop(): void {
    this.#stop?.();
    this.#stop = null;
  }

  /** Each element under it that LISTENS shows while news of its kind waits. The
   *  data layer said a fact; this element asked to hear it. */
  draw = (): void => {
    for (const el of this.#root.querySelectorAll<HTMLElement>('[data-listens]')) {
      el.toggleAttribute('hidden', !kindsOf(el).some((kind) => this.#updates.shows(kind)));
    }
  };

  /** A listening element dismissed — a locked callout reports and stays: its kinds
   *  hide until the next notice. */
  dismissed = (event: Event): void => {
    const el = event.target as HTMLElement;
    if (el.hasAttribute?.('data-listens')) for (const kind of kindsOf(el)) this.#updates.dismiss(kind);
  };

  /** A listening element's own Refresh takes the waiting rows in. */
  refreshed(from: Element): void {
    if (from.hasAttribute?.('data-listens')) this.#updates.take('data');
  }
}
