/**
 * roving-focus.ts — a set of items is ONE tab stop; the arrows, Home and End
 * move it. TRAP T-one-tab-stop-per-set
 *
 * Map:
 * - RovingItem — an item: an HTML or SVG element in the container's own tree
 * - RovingOptions — which items, how a key moves, and what a move does
 * - Roving — what a component keeps: restamp, refresh and focus
 * - rovingFocus — wire a container: one tab stop, the arrows, Home and End
 * - toolbarKeys — a toolbar's Left, Right, Home and End move between its controls; Tab is unchanged
 */
import { controlsIn, focusTarget } from './tab-stops.js';

/** An item: an HTML or SVG element in the container's own tree. */
export type RovingItem = HTMLElement | SVGElement;

/** Which items, how a key moves, and what a move does. */
export interface RovingOptions {
  /** The items, found again at every key and every focus: a selector, or a walk. */
  items: string | (() => RovingItem[]);
  /** The stop when none is held yet: the selected one, today, … Default: the first. */
  initial?: (items: RovingItem[]) => RovingItem | undefined;
  /** What names an item across a re-stamp. Default: its `data-index`. */
  key?: (item: RovingItem) => string | undefined;
  /** A move of the component's own: an item, `true` (handled, it moves focus
   *  itself), or `undefined` for the default arrows, Home and End. */
  step?: (from: RovingItem, event: KeyboardEvent, items: RovingItem[]) => RovingItem | true | undefined;
  /** A KEY moved the stop: tabs pick, as the platform's tablist does. */
  onMove?: (item: RovingItem, event: KeyboardEvent) => void;
  /** Every item keeps its own Tab stop: the keys only move focus. A toolbar. */
  everyStop?: boolean;
  /** Only Left and Right move: Up and Down stay the items' own. */
  inline?: boolean;
  /** A key the focused control uses itself — a caret, a select's items. */
  owns?: (event: KeyboardEvent) => boolean;
  /** What takes focus for an item. Default: the item. */
  focusOf?: (item: RovingItem) => RovingItem | null;
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
  // An SVG container with a focus listener is a tab stop in Chromium: keep it out.
  // TRAP T-an-svg-with-a-focus-listener-is-a-tab-stop
  if (container instanceof SVGElement && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');

  const which = options.items;
  const all = (): RovingItem[] => (typeof which === 'string' ? [...container.querySelectorAll<RovingItem>(which)] : which());
  const focusOf = options.focusOf ?? ((i: RovingItem): RovingItem | null => i);
  const live = (items = all()): RovingItem[] => items.filter((i) => !i.matches(OFF));
  const find = (items: RovingItem[], key?: string): RovingItem | undefined =>
    (key === undefined ? undefined : items.find((i) => keyOf(i) === key));
  const stopIn = (items: RovingItem[]): RovingItem | undefined => items.find((i) => i.getAttribute('tabindex') === '0');
  const place = (stop: RovingItem, items = all()): void => {
    if (options.everyStop) return;
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
    focusOf(find(all(), last) ?? to)?.focus();
  };
  /** The next live item after `from` in `every`, or before it, round the end. */
  const plain = (from: RovingItem, key: string, items: RovingItem[], every: RovingItem[]): RovingItem | undefined => {
    if (key === 'Home') return items[0];
    if (key === 'End') return items.at(-1);
    const step = NEXT.includes(key) ? 1 : PREV.includes(key) ? -1 : 0;
    const at = every.indexOf(from);
    for (let k = 1; step && k <= every.length; k++) {
      const to = every[(at + step * k + every.length) % every.length];
      if (to && items.includes(to)) return to;
    }
    return undefined;
  };
  const inPath = (event: Event, items: RovingItem[]): RovingItem | undefined =>
    event.composedPath().find((n): n is RovingItem => items.includes(n as RovingItem));

  container.addEventListener('keydown', (event) => {
    const e = event as KeyboardEvent;
    // Alt+ArrowLeft is the browser's Back; an inner set may have moved already.
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (options.inline && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
    if (options.owns?.(e)) return;
    const every = all();
    const items = live(every);
    // Focus may sit on an OFF item — an inactive button keeps it, for its tip — so step from
    // where it sits. TRAP T-an-inactive-button-keeps-its-tip
    const from = inPath(e, every) ?? stopIn(items) ?? items[0];
    if (!from) return;
    const told = items.includes(from) ? options.step?.(from, e, items) : undefined;
    if (told === true) {
      e.preventDefault();
      return;
    }
    const to = told ?? plain(from, e.key, items, every);
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
      const had = held ? all().find((i) => i === held || i.contains(held)) : undefined;
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

/** Keys the focused control uses itself: a text box all of them, a select Up and
 *  Down, and an open menu, list or dialog its own. Will, TODO 318. */
const TYPED = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'file', 'color']);
const OWN_KEYS = '[popover], sherpa-menu, [role="menu"], [role="listbox"], [role="dialog"], [role="grid"], [role="tree"], [role="slider"], [role="spinbutton"], [role="combobox"], [role="radiogroup"]';
function ownsKey(event: KeyboardEvent): boolean {
  for (const node of event.composedPath()) {
    if (node === event.currentTarget) return false;
    if (!(node instanceof HTMLElement)) continue;
    if (node instanceof HTMLTextAreaElement || node.isContentEditable || node.matches(OWN_KEYS)) return true;
    if (node instanceof HTMLInputElement && !TYPED.has(node.type)) return true;
    if (node instanceof HTMLSelectElement && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) return true;
  }
  return false;
}

/** A toolbar's Left, Right, Home and End move between its controls, slotted ones
 *  too; Tab is unchanged, and a control keeps the keys it uses.
 *  TRAP T-a-toolbar-moves-by-arrow-and-keeps-its-tabs */
export function toolbarKeys(bar: Element): void {
  rovingFocus(bar, {
    items: () => controlsIn(bar), everyStop: true, inline: true, owns: ownsKey, focusOf: focusTarget,
  });
}
