/**
 * show-as.ts — the kinds a slot's data can be shown as, REGISTERED: each component
 * says in its `static presents` the kind it draws, what it can draw another kind's
 * data from and the slots it fills, and `define()` registers it. This answers who
 * draws a kind and what it keeps across a swap; it imports no component.
 * Will, TODO 548 · TRAP T-a-kind-is-registered-never-a-tag
 *
 * Map:
 * - Shape — The answer a component draws, as its `static asks` names it.
 * - Presents — One kind, as a component declares it in `static presents`.
 * - Presenter — A registered kind: its declaration, its element's class and the shape it draws.
 * - presentsOf — The kind an element presents, where it presents one.
 * - presenter — The element that draws a kind, as registered; none while no component that draws it is loaded.
 * - offered — The kinds Show as offers over a slot whose own is `own`.
 * - kept — The attributes an element made for a kind keeps of the one it replaces.
 */
import { PRESENTATION_KINDS } from '../data/query.js';
import type { DataAsk } from './context.js';
import { defined, type PropMap } from './sherpa-element.js';

/** The answer a component draws, as its `static asks` names it. */
export type Shape = DataAsk['shape'];

/** One kind, as a component declares it in `static presents`. */
export interface Presents {
  /** Its word: what the Query keeps, and Show as offers. */
  readonly kind: string;
  /** The shapes of answer it can draw another kind's data from: Show as offers it
   *  over a slot whose own draws one. None: it is only ever its page's own. */
  readonly accepts: readonly Shape[];
  /** The slots it fills from the element it replaces: a chart's legend. */
  readonly slots?: readonly string[];
  /** Its attributes as this kind: set when Show as makes it, and what tells one
   *  class's kinds apart — a radial chart is a donut or a pie by `data-type`. */
  readonly is?: Readonly<Record<string, string>>;
}

/** A registered kind: its declaration, its element's class and the shape it draws. */
export interface Presenter extends Presents {
  readonly ctor: CustomElementConstructor;
  readonly shape?: Shape;
}

/** A class's kinds, as it declares them. */
function kinds(ctor: unknown): readonly Presents[] {
  const presents = (ctor as { presents?: Presents | readonly Presents[] }).presents;
  return !presents ? [] : 'kind' in presents ? [presents] : presents;
}

/** A class's declared attributes. */
const props = (ctor: unknown): PropMap => (ctor as { props?: PropMap }).props ?? {};

/** The kind an element presents, where it presents one: its class's, told apart by `is`. One not
 *  upgraded — in a template — presents what its tag's class does. */
export function presentsOf(el: Element): Presents | undefined {
  const all = kinds(globalThis.customElements?.get(el.localName) ?? el.constructor);
  const own = (p: Presents): boolean => Object.entries(p.is ?? {}).every(([name, value]) => el.getAttribute(name) === value);
  return (all.length > 1 ? all.find(own) : undefined) ?? all[0];
}

/** The element that draws a kind, as registered; none while no component that draws it is loaded. */
export function presenter(kind: string): Presenter | undefined {
  for (const ctor of defined().values()) {
    const presents = kinds(ctor).find((p) => p.kind === kind);
    if (!presents) continue;
    const shape = (ctor as { asks?: DataAsk }).asks?.shape;
    return { ...presents, ctor, ...(shape ? { shape } : {}) };
  }
  return undefined;
}

/** The kinds Show as offers over a slot whose own is `own`: each a Query keeps
 *  whose component is loaded and draws what `own` draws — a gauge's one number
 *  as a grid, never a chart. In the Query's order. */
export function offered(own: string | undefined): string[] {
  const from = own ? presenter(own)?.shape : undefined;
  return PRESENTATION_KINDS.filter((kind) => {
    const shown = kind === own ? undefined : presenter(kind);
    return !!shown && (!from || shown.accepts.includes(from));
  });
}

/** The attributes an element made for a kind keeps of the one it replaces: those
 *  both declare, and those neither does — where it sat: its id, slot, style and
 *  place in a layout. Its kind's `is` goes on after. */
export function kept(from: Element, to: Presenter): string[] {
  const was = props(from.constructor);
  const will = props(to.ctor);
  return [...from.attributes].map((a) => a.name).filter((name) => (name in was) === (name in will));
}
