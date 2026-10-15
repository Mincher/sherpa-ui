/**
 * roving-focus.ts — a set of items is ONE tab stop; the arrows, Home and End
 * move it. TRAP T-one-tab-stop-per-set
 *
 * Map:
 * - RovingItem — an item: an HTML or SVG element in the container's own tree
 * - RovingOptions — which items, how a key moves, and what a move does
 * - Roving — what a component keeps: restamp, refresh and focus
 * - rovingFocus — wire a container: one tab stop, the arrows, Home and End
 */

/** An item: an HTML or SVG element in the container's own tree. */
export type RovingItem = HTMLElement | SVGElement;

/** Which items, how a key moves, and what a move does. */
export interface RovingOptions {
  /** The items, found again at every key and every focus. */
  items: string;
  /** The stop when none is held yet: the selected one, today, … Default: the first. */
  initial?: (items: RovingItem[]) => RovingItem | undefined;
  /** What names an item across a re-stamp. Default: its `data-index`. */
  key?: (item: RovingItem) => string | undefined;
  /** A move of the component's own: an item, `true` (handled, it moves focus
   *  itself), or `undefined` for the default arrows, Home and End. */
  step?: (from: RovingItem, event: KeyboardEvent, items: RovingItem[]) => RovingItem | true | undefined;
  /** A KEY moved the stop: tabs pick, as the platform's tablist does. */
  onMove?: (item: RovingItem, event: KeyboardEvent) => void;
}

/** What a component keeps: restamp, refresh and focus. */
export interface Roving {
  /** Draw, then put the stop — and focus, if it was inside — back on the same item. */
  restamp<T>(draw: () => T, prefer?: string): T;
  /** Put the stop on `prefer`, or keep it where it is. */
  refresh(prefer?: string): void;
  /** Focus an item, or the stop. */
  focus(target?: RovingItem | string): void;
}

const OFF = '[disabled], [aria-disabled="true"]';
const NEXT = ['ArrowRight', 'ArrowDown'];
const PREV = ['ArrowLeft', 'ArrowUp'];

/** Wire a container: one tab stop, the arrows, Home and End. */
export function rovingFocus(container: Element, options: RovingOptions): Roving {
  const keyOf = options.key ?? ((i: RovingItem): string | undefined => i.dataset['index']);
  let last: string | undefined;

  const all = (): RovingItem[] => [...container.querySelectorAll<RovingItem>(options.items)];
  const live = (items = all()): RovingItem[] => items.filter((i) => !i.matches(OFF));
  const find = (items: RovingItem[], key?: string): RovingItem | undefined =>
    (key === undefined ? undefined : items.find((i) => keyOf(i) === key));
  const stopIn = (items: RovingItem[]): RovingItem | undefined => items.find((i) => i.getAttribute('tabindex') === '0');
  const place = (stop: RovingItem, items = all()): void => {
    for (const i of items) i.setAttribute('tabindex', i === stop ? '0' : '-1');
  };
  const settle = (prefer?: string): RovingItem | undefined => {
    const ok = live();
    const stop = find(ok, prefer) ?? find(ok, last) ?? options.initial?.(ok) ?? ok[0];
    if (stop) place(stop);
    return stop;
  };
  const go = (to: RovingItem, event?: KeyboardEvent): void => {
    last = keyOf(to);
    place(to);
    if (event) options.onMove?.(to, event);
    // A move may re-stamp: focus what holds the key now.
    (find(all(), last) ?? to).focus();
  };
  const plain = (from: RovingItem, key: string, items: RovingItem[]): RovingItem | undefined => {
    const at = items.indexOf(from);
    if (NEXT.includes(key)) return items[at + 1] ?? items[0];
    if (PREV.includes(key)) return at > 0 ? items[at - 1] : items.at(-1);
    if (key === 'Home') return items[0];
    if (key === 'End') return items.at(-1);
    return undefined;
  };
  const inPath = (event: Event, items: RovingItem[]): RovingItem | undefined =>
    event.composedPath().find((n): n is RovingItem => items.includes(n as RovingItem));

  container.addEventListener('keydown', (event) => {
    const e = event as KeyboardEvent;
    // Alt+ArrowLeft is the browser's Back; an inner set may have moved already.
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const items = live();
    const from = inPath(e, items) ?? stopIn(items) ?? items[0];
    if (!from) return;
    const told = options.step?.(from, e, items);
    if (told === true) {
      e.preventDefault();
      return;
    }
    const to = told ?? plain(from, e.key, items);
    if (!to) return;
    e.preventDefault();
    go(to, e);
  });
  container.addEventListener('focusin', (event) => {
    const items = live();
    const at = inPath(event, items);
    if (!at) return;
    last = keyOf(at);
    if (at.getAttribute('tabindex') !== '0') place(at, items);
  });

  return {
    restamp<T>(draw: () => T, prefer?: string): T {
      // A re-stamp removes the focused node, and focus drops to <body>.
      const active = (container.getRootNode() as Document | ShadowRoot).activeElement;
      const held = active && container.contains(active) ? active : null;
      const had = held?.closest<RovingItem>(options.items);
      if (had) last = keyOf(had);
      const out = draw();
      const stop = settle(prefer);
      if (held) stop?.focus({ preventScroll: true });
      return out;
    },
    refresh(prefer?: string): void {
      settle(prefer);
    },
    focus(target?: RovingItem | string): void {
      const items = live();
      const to = (typeof target === 'string' ? find(items, target) : target) ?? stopIn(items) ?? settle();
      if (to) go(to);
    },
  };
}
