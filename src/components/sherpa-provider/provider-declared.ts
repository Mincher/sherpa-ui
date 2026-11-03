/**
 * provider-declared.ts — what a component DECLARES to its provider, read here
 * alone: so the provider tells it what it can take, and never probes it.
 *
 * Map:
 * - declared — What an element declares to its provider: what it asks for, and what it takes.
 * - up — The element above this one, across a shadow root: the way an ask travels.
 */
import type { DataAsk, Take } from '../../core/ui/context.js';

/** What an element declares to its provider: what it asks for, and what it takes. */
export function declared(el: Element): { asks?: DataAsk; takes: readonly Take[] } {
  const { asks, takes = [] } = el.constructor as { asks?: DataAsk; takes?: readonly Take[] };
  return { ...(asks ? { asks } : {}), takes };
}

/** The element above this one, across a shadow root: the way an ask travels. */
export const up = (el: Element): Element | null =>
  el.parentElement ?? ((el.getRootNode() as ShadowRoot).host ?? null);
