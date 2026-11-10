/**
 * plane.ts — where an element stands on a canvas's PLANE, read from the model, never from layout: its place is its
 * resolved `left` and `top` (from its `--x`, `--y`), its size its own box; a point in it, by its offset in its drawn box at
 * the scale it is drawn. So an element a canvas does not draw — out of its view — still has its place, and one drawn into
 * a canvas (where it lays out in flow) has its own. Plan 852 (step 2).
 *
 * Map:
 * - PlaneBox — A box on the plane, in plane px.
 * - placeOf — An element's place on the plane: its resolved left and top.
 * - boxOf — An element's box on the plane.
 * - pointIn — The plane point of a screen box's middle — a socket's — inside an element on the plane, drawn at a scale.
 */

/** A box on the plane, in plane px. */
export interface PlaneBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** An element's place on the plane: its resolved left and top. Not its offset: drawn into a canvas, it lays out in flow. */
export function placeOf(el: HTMLElement): { x: number; y: number } {
  const style = getComputedStyle(el);
  return { x: parseFloat(style.left) || 0, y: parseFloat(style.top) || 0 };
}

/** An element's box on the plane. */
export function boxOf(el: HTMLElement): PlaneBox {
  const { x, y } = placeOf(el);
  return { left: x, top: y, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
}

/**
 * The plane point of a screen box's middle — a socket's — inside an element on the plane: its place, and the box's offset in
 * the element's own box on the screen at the `scale` it stands there (the view's zoom where drawn; 1 where a canvas leaves
 * it in flow). The caller says the scale: one read off the boxes (`offsetWidth` is whole pixels) is a pixel out on a node.
 */
export function pointIn(el: HTMLElement, rect: DOMRect, scale: number): [number, number] {
  const box = el.getBoundingClientRect();
  const { x, y } = placeOf(el);
  // To an eighth of a px: read through a scale, a point carries float noise, and a line's end must not flicker by it.
  const snap = (v: number): number => Math.round(v * 8) / 8;
  return [snap(x + (rect.left + rect.width / 2 - box.left) / scale), snap(y + (rect.top + rect.height / 2 - box.top) / scale)];
}
