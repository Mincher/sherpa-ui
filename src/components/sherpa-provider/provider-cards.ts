/**
 * provider-cards.ts — the card each component sits in, as its provider draws it:
 * the state of the data it holds, its Retry, and its filter toolbar's toggle.
 *
 * Map:
 * - cardOf — The card a component sits in, across shadow roots, or null.
 * - CardHost — What the cards ask of their provider.
 * - ProviderCards — The cards of one provider's subtree.
 * - .watch — Each source's loading, emptiness and failure, drawn on the cards of what it answers, until `signal`.
 * - .opening — A page opening is a load: every data card says so after a moment.
 * - .keepAll — Every card of what asked shows its state as its provider says: kept content, or an overlay.
 * - .retry — A card's Retry: the sources of what it holds load again.
 * - .drawToolbars — A slot's filter toolbars and their toggles: as asked, else as left, else as its markup.
 * - .toggled — A card's toggle: its filter toolbar shown or shut, kept in the session.
 */
import { declared, up } from './provider-declared.js';
import { drawsNothing } from '../../core/ui/filter-host.js';
import type { DataChangeDetail, DataSource } from '../../core/data/data-source.js';

/** The card a component sits in — what declares it takes a `card` — across shadow roots, or null. */
export const cardOf = (el: Element): HTMLElement | null => {
  for (let at = up(el); at; at = up(at)) if (declared(at).takes.includes('card')) return at as HTMLElement;
  return null;
};

/** A load quicker than this shows no spinner, so nothing flashes. */
const SLOW_LOAD = 300;

/** What the cards ask of their provider. */
export interface CardHost {
  /** The provider element: what the toggles sit in, and whether a card keeps its content. */
  readonly el: HTMLElement;
  /** Every component that asked. */
  asked(): Iterable<Element>;
  /** The source a component's subtree provides. */
  resolve(el: Element): DataSource | null;
  /** An attribute from the element, or the nearest one above it. */
  inherited(el: Element, name: string): string | null;
  /** The filter bars in a slot. */
  bars(slot: string): Element[];
  /** Where the open page keeps a card's toolbar. */
  session(): { get(key: string): unknown; set(key: string, value: unknown): void } | undefined;
  /** The open page's id: a slot's name is its own. */
  pageId(): string;
}

/** The cards of one provider's subtree. */
export class ProviderCards {
  /** The provider it serves. */
  readonly #host: CardHost;

  constructor(host: CardHost) {
    this.#host = host;
  }

  /**
   * Each source's loading, emptiness and failure, drawn on the card of every
   * component it answers — so no page writes `data-loading` by hand. Loading
   * and a failure reach every data component's card; empty and NO MATCHES a
   * ROWS one's only, as a chart under the View alone still has its rows.
   * Will, TODO 58. TRAP T-a-container-shows-its-datas-state
   */
  watch(sources: readonly DataSource[], signal: AbortSignal): void {
    for (const source of sources) {
      const cards = (rowsOnly: boolean): HTMLElement[] => this.#cardsOf((el) => this.#host.resolve(el) === source, rowsOnly);
      let slow: ReturnType<typeof setTimeout> | undefined;
      source.addEventListener('loading', (event) => {
        clearTimeout(slow);
        const loading = !!(event as CustomEvent).detail?.loading;
        if (loading) slow = setTimeout(() => { for (const c of cards(false)) c.toggleAttribute('data-loading', true); }, SLOW_LOAD);
        else for (const c of cards(false)) c.removeAttribute('data-loading');
      }, { signal });
      source.addEventListener('change', (event) => {
        const state = (event as CustomEvent<DataChangeDetail>).detail.emptiness ?? null;
        for (const c of cards(false)) if (c.dataset['state'] === 'error') delete c.dataset['state'];
        for (const c of cards(true)) {
          if (state) c.dataset['state'] = state;
          else delete c.dataset['state'];
        }
      }, { signal });
      source.addEventListener('error', (event) => {
        const { error } = (event as CustomEvent).detail as { error: unknown };
        for (const c of cards(false)) {
          c.dataset['state'] = 'error';
          c.dataset['error'] = error instanceof Error ? error.message : String(error);
        }
      }, { signal });
    }
  }

  /** The cards of the components that asked for data and pass `which` — ROWS ones only, or any. */
  #cardsOf(which: (el: Element) => boolean, rowsOnly = false): HTMLElement[] {
    return [...new Set([...this.#host.asked()]
      .filter((el) => {
        if (!which(el)) return false;
        const shape = declared(el).asks?.shape ?? 'rows';
        return rowsOnly ? shape === 'rows' : shape !== 'scope' && shape !== 'state';
      })
      .map(cardOf).filter((c): c is HTMLElement => !!c))].map((c) => this.#keep(c));
  }

  /**
   * A page OPENING is a load: its source reads the store before anyone can hear
   * it, so every data card says so after SLOW_LOAD. `stop` when the source is
   * open; `end` hands the cards it draws to its own loading and clears the rest.
   * A page left while it opens ends at once, so it never marks the next page.
   * TRAP T-a-container-shows-its-datas-state
   */
  opening(signal: AbortSignal): { stop(): void; end(source?: DataSource): void } {
    const marked: HTMLElement[] = [];
    const slow = setTimeout(() => {
      for (const c of this.#cardsOf(() => true)) {
        c.toggleAttribute('data-loading', true);
        marked.push(c);
      }
    }, SLOW_LOAD);
    const end = (source?: DataSource): void => {
      clearTimeout(slow);
      signal.removeEventListener('abort', left);
      const handed = new Set(source ? this.#cardsOf((el) => this.#host.resolve(el) === source) : []);
      for (const c of marked.splice(0)) if (!handed.has(c)) c.removeAttribute('data-loading');
    };
    const left = (): void => end();
    signal.addEventListener('abort', left);
    return { stop: () => clearTimeout(slow), end };
  }

  /** A card shows its state as its provider says: kept content, or an overlay. */
  #keep(card: HTMLElement): HTMLElement {
    card.toggleAttribute('data-keep-content', this.#host.el.hasAttribute('data-keep-content'));
    return card;
  }

  /** Every card of what asked shows its state as its provider says. */
  keepAll(): void {
    for (const el of this.#host.asked()) {
      const card = cardOf(el);
      if (card) this.#keep(card);
    }
  }

  /** A card's Retry: it reloads the sources of what it holds, as its state is
   *  theirs; an unclear ask loads nothing — `resolve` says so. */
  retry(from: Element): void {
    const held = [...this.#host.asked()].filter((el) => cardOf(el) === from).map((el) => this.#host.resolve(el));
    for (const source of new Set(held.length ? held : [this.#host.resolve(from)])) void source?.load({ force: true });
  }

  /** A slot's filter toolbars and its toggles: as asked, else as the reader left them,
   *  else as its page's markup does. A bar stepped back for the panel leaves its toggle
   *  inactive: a press would hide the panel; one with nothing to draw, off. Will, TODOs 672, 696
   *  TRAP T-a-card-toggles-its-own-toolbar */
  drawToolbars(slot: string, asked?: boolean): void {
    const host = this.#host;
    const toggles = [...host.el.querySelectorAll('[data-filter-toolbar]')].filter((el) => host.inherited(el, 'data-scope') === slot);
    if (!toggles.length) return;
    const bars = host.bars(slot);
    const kept = host.session()?.get(this.#key(slot));
    const shown = asked ?? (typeof kept === 'boolean' ? kept : bars.some((bar) => !bar.hasAttribute('hidden')));
    for (const bar of bars) bar.toggleAttribute('hidden', !shown);
    const panel = bars.length > 0 && bars.every((bar) => bar.hasAttribute('data-panel-mode'));
    const source = bars[0] ? host.resolve(bars[0]) : null;
    const blank = !!source && bars.every((bar) => bar.hasAttribute('data-no-actions')) && drawsNothing(source.describe(slot));
    const state = !bars.length || blank ? 'off' : panel ? 'panel' : shown ? 'shown' : 'shut';
    for (const toggle of toggles) toggle.setAttribute('data-filter-toolbar', state);
  }

  /** A card's toggle: its filter toolbar shown or shut, kept in the session. Will, TODO 629 */
  toggled = (event: Event): void => {
    const slot = this.#host.inherited(event.target as Element, 'data-scope');
    if (!slot || /\s/.test(slot)) return;
    event.stopPropagation();
    const { shown } = (event as CustomEvent<{ shown: boolean }>).detail;
    this.#host.session()?.set(this.#key(slot), shown);
    this.drawToolbars(slot, shown);
  };

  /** Where the session keeps a card's toolbar, as a slot's name is its page's. */
  #key(slot: string): string {
    return `/cards/toolbars/${this.#host.pageId()}/${slot}`;
  }
}
