/**
 * context.ts — the Context Protocol: a component ASKS, the nearest provider ANSWERS.
 *
 * The W3C Web Components Community Group's protocol, as Lit's `@lit/context`
 * speaks it: a `context-request` event, composed so it crosses shadow roots
 * upward, carrying a key, the asking element and a callback. `subscribe` asks
 * to be told again on every change. docs/PROVIDER-DESIGN.md.
 * TRAP T-a-component-asks-its-provider
 *
 * Map:
 * - Context — A key a component asks for, typed by its answer.
 * - createContext — Make a context key. Its value IS the key, so any provider speaking the protocol can answer it.
 * - ContextCallback — How a provider answers — with the value, and a way to stop when subscribed.
 * - ContextRequestEvent — The request: bubbles and is composed; the provider that answers stops it.
 * - DataAsk — What a component asks its provider for: the shape of its data, and the events it keeps.
 * - DATA_CONTEXT — A component's data, in the shape it declared — pushed on every change.
 * - SOURCE_CONTEXT — The DataSource over this subtree itself — for page code, never a component.
 */

/** A key a component asks for, typed by its answer. */
export type Context<T> = string & { readonly __context__?: T };

/** Make a context key. Its value IS the key, so any provider speaking the protocol can answer it. */
export function createContext<T>(key: string): Context<T> {
  return key as Context<T>;
}

/** How a provider answers — with the value, and a way to stop when subscribed. */
export type ContextCallback<T> = (value: T, unsubscribe?: () => void) => void;

/** The request: bubbles and is composed; the provider that answers stops it. */
export class ContextRequestEvent<T> extends Event {
  constructor(
    public readonly context: Context<T>,
    public readonly contextTarget: Element,
    public readonly callback: ContextCallback<T>,
    public readonly subscribe?: boolean,
  ) {
    super('context-request', { bubbles: true, composed: true });
  }
}

/** What a component asks its provider for: the shape of its data, and the events it keeps. */
export interface DataAsk {
  /** `rows` — one page, as a grid draws it; `all` — every matching row;
   *  `state` — only the view state, as a pager needs; `scope` — its
   *  `data-scope`'s slice of the Query, drawn and reported, as a filter bar
   *  needs. `aggregate`, `segments` and `series` are SUMMARIES its attributes
   *  declare (`SUMMARY_PROPS`). With nothing declared, a page populates it. */
  shape: 'rows' | 'all' | 'state' | 'scope' | 'aggregate' | 'segments' | 'series';
  /** Events this component answers ITSELF, so its source must not act on them. */
  own?: readonly string[];
  /** Keep every declared category, at zero — a legend. */
  keepEmpty?: boolean;
  /** It PICKS values of its segment field, through its `picked` property: the
   *  event it fires, and what a pick narrows — its `host` (a legend's chart). */
  picks?: { event: string; narrows: 'host' | 'self' };
  /** The fields whose WHOLE list of values it needs — a heading menu built from
   *  one page is a one-way door. TRAP T-unavailable-value-sorts-below-a-divider */
  values?: (el: Element) => readonly string[];
}

/** A component's data, in the shape it declared — pushed on every change. */
export const DATA_CONTEXT = createContext<unknown>('sherpa:data');

/** The DataSource over this subtree itself — for page code, never a component. */
export const SOURCE_CONTEXT = createContext<unknown>('sherpa:source');
