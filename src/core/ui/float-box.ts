/**
 * float-box.ts — a FLOATING box: drawn from its host's `data-x`, `data-y`, `data-width` and
 * `data-height`, lifted where it docked, moved by its bar and resized by any edge or corner, inside its
 * room (the window, or a panel area's layout). What a floating overlay panel, the node panel and
 * the filter column share, by `dragXY`; its sheet is sherpa-float.css. Each component keeps its
 * own events: this reports through the doors it is given. Every floating box in the tab is in
 * ONE stack: a press brings one to the front. TRAP T-a-floating-panel-is-a-state TRAP T-a-pressed-panel-comes-to-the-front
 *
 * Map:
 * - FLOAT_ATTRS — The floating box's attributes: where it floats, and how big.
 * - Room — A box in client px: what a floating box floats in, or the box itself.
 * - roomOf — The room of a panel docked in a panel area: the layout the area is in; else its parent.
 * - resized — The box an edge or a corner makes, dragged: the one across held; Shift on a corner, its shape.
 * - FloatHost — What a floating box needs of its component: its box, its room, its doors, its reports.
 * - FloatBox — One component's floating box: drawn, lifted, moved, resized and stacked.
 * - .floated — Floating, it joins the stack at the front, once; docked, it leaves it.
 * - .raise — To the front of every floating box in the tab.
 * - .draw — The kept box, drawn on the box that floats; an absent one is the CSS's own.
 * - .lift — The first float: where the box is drawn, `inset` px in on each side; a kept box stands.
 * - .wire — The bar moves it, an edge or a corner resizes it, by pointer or arrows; a press or focus raises it.
 */
import { dragXY, type XY } from './drag-xy.js';

/** The floating box's attributes, and the custom property each draws. */
const BOX = [
  ['data-x', '--_float-x'], ['data-y', '--_float-y'],
  ['data-width', '--_float-width'], ['data-height', '--_float-height'],
] as const;

/** The floating box's attributes: where it floats, and how big. */
export const FLOAT_ATTRS: readonly string[] = BOX.map(([attr]) => attr);

/** A press on one of these, in the bar, is a press on it: it moves nothing. */
const CONTROL = 'button, a[href], input, select, textarea, [role="button"], [role="menuitem"]';

/** A box in client px: what a floating box floats in, or the box itself. */
export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Up the flat tree: a slotted node's slot, a shadow root's host, else its parent. */
function up(node: Node): Node | null {
  if (node instanceof Element && node.assignedSlot) return node.assignedSlot;
  return node instanceof ShadowRoot ? node.host : node.parentNode;
}

/** The room of a panel docked in a panel area: the layout the area is in; else its parent. */
export function roomOf(el: Element): Room {
  for (let node = up(el); node; node = up(node)) {
    if (node instanceof Element && node.localName === 'sherpa-layout-panels') return node.getBoundingClientRect();
  }
  return (el.parentElement ?? el).getBoundingClientRect();
}

/**
 * The box an edge or a corner makes, dragged `by` from `from`: the side or corner across from it held. Shift on a corner
 * (`uniform`) keeps its shape. Never past its room, never under the least the CSS lets it be. TODO 903
 */
export function resized(from: Room, side: string, by: XY, uniform: boolean, room: Pick<Room, 'width' | 'height'>, least: { width: number; height: number }): Room {
  const [n, s, e, w] = ['n', 's', 'e', 'w'].map((c) => side.includes(c));
  // How far each moving side may go: to the room's edge, and no nearer the held side than the least size.
  let width = from.width + (e ? by.x : w ? -by.x : 0);
  let height = from.height + (s ? by.y : n ? -by.y : 0);
  const most = { width: e ? room.width - from.x : w ? from.x + from.width : from.width, height: s ? room.height - from.y : n ? from.y + from.height : from.height };
  if (uniform) {
    // The axis pulled further sets the scale; both keep to it.
    const scale = Math.max(width / from.width, height / from.height);
    const fits = Math.min(scale, most.width / from.width, most.height / from.height);
    const keep = Math.max(fits, least.width / from.width, least.height / from.height);
    width = from.width * keep;
    height = from.height * keep;
  } else {
    width = Math.min(Math.max(width, least.width), most.width);
    height = Math.min(Math.max(height, least.height), most.height);
  }
  return { x: w ? from.x + from.width - width : from.x, y: n ? from.y + from.height - height : from.y, width, height };
}

/** What a floating box needs of its component: its box, its room, its doors, its reports. */
export interface FloatHost {
  el: HTMLElement;
  /** The element that floats: the CSS clamps it, and `--_float-*` are written on it. */
  box(): HTMLElement | null;
  /** What it floats in, in client px: its numbers are from this box's top left. */
  room(): Room;
  /** Whether the bar and the corner may move it now: floating, and not maximised. */
  free(): boolean;
  set(attr: string, value: number): void;
  /** An attribute's number; NaN when it has none. */
  num(attr: string): number;
  toggleState(name: string, on: boolean): void;
  /** The end of a move, or a key on the grip: where it was drawn. */
  moved(at: XY): void;
  /** Where the pointer is while the bar moves it (client px), and how the move ended. TRAP T-a-dragged-panel-docks-where-the-area-lights-up */
  dragged?(pointer: XY, phase: 'move' | 'end' | 'cancel'): void;
  /** The end of a resize, or a key on the corner: how big it was drawn. */
  sized(size: { width: number; height: number }): void;
}

/** A press on a control in the bar, not on the bar. */
function onControl(event: PointerEvent, bar: Element): boolean {
  for (const node of event.composedPath()) {
    if (node === bar) return false;
    if (node instanceof Element && node.matches(CONTROL)) return true;
  }
  return false;
}

/** One component's floating box: drawn, lifted, moved, resized and stacked. */
export class FloatBox {
  /** Every floating box in the tab, back to front. TRAP T-a-pressed-panel-comes-to-the-front */
  static #stack: FloatBox[] = [];

  /** The component whose box this is, by its doors. */
  readonly #host: FloatHost;

  constructor(host: FloatHost) {
    this.#host = host;
  }

  /** Floating, it joins the stack at the front, once; docked, it leaves it. */
  floated(on: boolean): void {
    const at = FloatBox.#stack.indexOf(this);
    if (on && at < 0) this.raise();
    else if (!on && at >= 0) {
      FloatBox.#stack.splice(at, 1);
      this.#host.box()?.style.removeProperty('--_float-order');
      FloatBox.#restack();
    }
  }

  /** To the front of every floating box in the tab. */
  raise(): void {
    const stack = FloatBox.#stack;
    const at = stack.indexOf(this);
    if (at >= 0 && at === stack.length - 1) return;
    if (at >= 0) stack.splice(at, 1);
    stack.push(this);
    FloatBox.#restack();
  }

  /** Each box's place, front last, where its CSS reads it; one gone from the page leaves. */
  static #restack(): void {
    const stack = FloatBox.#stack;
    for (let i = stack.length - 1; i >= 0; i--) if (!stack[i]!.#host.el.isConnected) stack.splice(i, 1);
    stack.forEach((b, i) => b.#host.box()?.style.setProperty('--_float-order', String(i)));
  }

  /** The kept box, drawn on the box that floats; an absent one is the CSS's own. */
  draw(): void {
    const box = this.#host.box();
    if (!box) return;
    for (const [attr, prop] of BOX) {
      const px = this.#host.num(attr);
      if (Number.isFinite(px)) box.style.setProperty(prop, `${px}px`);
      else box.style.removeProperty(prop);
    }
  }

  /** The first float: where `drawn` is, `inset` px in on each side. A kept box stands. */
  lift(drawn: Room, inset = 0): void {
    const { el } = this.#host;
    if (BOX.every(([attr]) => el.hasAttribute(attr))) return;
    const room = this.#host.room();
    const box = [drawn.x - room.x + inset, drawn.y - room.y + inset, drawn.width - 2 * inset, drawn.height - 2 * inset];
    BOX.forEach(([attr], i) => {
      if (!el.hasAttribute(attr)) this.#host.set(attr, Math.round(box[i]!));
    });
  }

  /** Where the box is drawn now, from its room's top left. */
  #drawn(): Room {
    const b = this.#host.box()!.getBoundingClientRect();
    const room = this.#host.room();
    return { x: b.x - room.x, y: b.y - room.y, width: b.width, height: b.height };
  }

  /**
   * The bar moves it, and each edge or corner (`data-edge`: n, e, s, w, ne, nw, se, sw) resizes it, the side or corner
   * across from it held: by the pointer, or the arrows on the grip and on a focusable edge. Shift on a corner keeps its
   * shape. Each writes back the box the CSS clamp DREW, so a key steps from there, and reports it. A press or a focus
   * raises it. Will, TODO 903
   */
  wire(bar: HTMLElement | null, grip: HTMLElement | null, edges: readonly HTMLElement[] = []): void {
    const host = this.#host;
    // A press anywhere on it, or a focus into it, brings it to the front: the keys too.
    const raise = (): void => {
      if (host.free()) this.raise();
    };
    host.box()?.addEventListener('pointerdown', raise, { capture: true });
    host.box()?.addEventListener('focusin', raise);
    if (bar) {
      dragXY(bar, {
        keys: grip,
        slop: 4,
        starts: (event) => host.free() && !onControl(event, bar),
        measure: () => ({ x: this.#drawn().x, y: this.#drawn().y }),
        apply: (to, done) => this.#move(to, done),
        hold: (held) => host.toggleState('moving', held),
        track: (pointer, phase) => host.dragged?.(pointer, phase),
      });
    }
    for (const edge of edges) {
      const side = edge.dataset['edge'] ?? '';
      // The box when the edge takes hold: each move is how far the pointer went from there.
      let from: Room = { x: 0, y: 0, width: 0, height: 0 };
      dragXY(edge, {
        starts: () => host.free(),
        measure: () => {
          from = this.#drawn();
          return { x: 0, y: 0 };
        },
        apply: (by, done, shift) => {
          const uniform = !!shift && side.length === 2;
          host.toggleState('uniform', uniform && !done);
          this.#writeBox(resized(from, side, by, uniform, host.room(), this.#least()), done, /[nw]/.test(side));
        },
        hold: (held) => host.toggleState('sizing', held),
      });
    }
  }

  /** The least the CSS lets the box be: its floor, `--_float-min-width` and `-height` (sherpa-float.css), in px. */
  #least(): { width: number; height: number } {
    const box = this.#host.box();
    if (!box) return { width: 0, height: 0 };
    const style = getComputedStyle(box);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const px = (name: string): number => {
      const value = style.getPropertyValue(name).trim();
      return (parseFloat(value) || 0) * (value.endsWith('rem') ? rem : 1);
    };
    return { width: px('--_float-min-width'), height: px('--_float-min-height') };
  }

  /** Draw a whole box; done, write back what the clamp drew, and report how big, and where, if its top or left moved. */
  #writeBox(to: Room, done: boolean, moved: boolean): void {
    const box = this.#host.box();
    if (!box) return;
    const values = [to.x, to.y, to.width, to.height];
    BOX.forEach(([, prop], i) => box.style.setProperty(prop, `${Math.round(values[i]!)}px`));
    if (!done) return;
    const d = this.#drawn();
    const drawn = [d.x, d.y, d.width, d.height].map(Math.round);
    BOX.forEach(([attr], i) => this.#host.set(attr, drawn[i]!));
    if (moved) this.#host.moved({ x: drawn[0]!, y: drawn[1]! });
    this.#host.sized({ width: drawn[2]!, height: drawn[3]! });
  }

  /** Draw a place; done, write back where the clamp drew it, and report it. */
  #move(to: XY, done: boolean): void {
    const box = this.#host.box();
    if (!box) return;
    box.style.setProperty(BOX[0][1], `${Math.round(to.x)}px`);
    box.style.setProperty(BOX[1][1], `${Math.round(to.y)}px`);
    if (!done) return;
    const d = this.#drawn();
    this.#host.set(BOX[0][0], Math.round(d.x));
    this.#host.set(BOX[1][0], Math.round(d.y));
    this.#host.moved({ x: Math.round(d.x), y: Math.round(d.y) });
  }
}
