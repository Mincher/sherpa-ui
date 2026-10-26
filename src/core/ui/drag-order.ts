/**
 * drag-order.ts — drag one item among its siblings, or move it with Alt and an arrow, to change their order.
 * TRAP T-a-filter-is-dragged-into-its-place
 *
 * Map:
 * - DragOrderOptions — the items, the axis, whether it is on, and who hears the new order
 * - dragToOrder — wire a host: a pointer drag past a few px, or Alt+Arrow on a focused item
 */

/** The items, the axis, whether it is on, and who hears the new order. */
export interface DragOrderOptions {
  /** The items that may move, in their order now. */
  items: () => HTMLElement[];
  /** `x`: Left and Right; `y`: Up and Down. */
  axis: 'x' | 'y';
  /** On now: the app's setting. */
  enabled: () => boolean;
  /** The new order, once an item lands in another place. */
  moved: (order: HTMLElement[]) => void;
  signal: AbortSignal;
}

/** How far a pointer travels before a press becomes a drag. */
const THRESHOLD = 4;

/**
 * Wire a host. While dragged, the item is `data-dragging` and follows the
 * pointer by `--_drag-x` / `--_drag-y`; the item it would land beside is
 * `data-drop="before"` or `"after"`. The click a finished drag makes is eaten.
 */
export function dragToOrder(host: HTMLElement, options: DragOrderOptions): void {
  const { signal, axis } = options;
  const y = axis === 'y';
  const at = (e: PointerEvent): number => (y ? e.clientY : e.clientX);
  const middle = (el: HTMLElement): number => {
    const r = el.getBoundingClientRect();
    return y ? r.top + r.height / 2 : r.left + r.width / 2;
  };
  const itemOf = (e: Event): HTMLElement | null => {
    const items = options.items();
    return (e.composedPath().find((n) => items.includes(n as HTMLElement)) as HTMLElement | undefined) ?? null;
  };

  let held: { item: HTMLElement; id: number; start: number; dragging: boolean } | null = null;
  let target: { item: HTMLElement; side: 'before' | 'after' } | null = null;

  const mark = (next: typeof target): void => {
    if (target?.item !== next?.item || target?.side !== next?.side) target?.item.removeAttribute('data-drop');
    target = next;
    target?.item.setAttribute('data-drop', target.side);
  };
  const end = (): void => {
    if (held?.dragging) {
      held.item.removeAttribute('data-dragging');
      held.item.style.removeProperty(y ? '--_drag-y' : '--_drag-x');
    }
    mark(null);
    held = null;
  };
  /** The order once `item` lands beside `to`. */
  const landed = (item: HTMLElement, to: { item: HTMLElement; side: 'before' | 'after' }): HTMLElement[] => {
    const rest = options.items().filter((i) => i !== item);
    const i = rest.indexOf(to.item);
    rest.splice(to.side === 'before' ? i : i + 1, 0, item);
    return rest;
  };

  host.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !options.enabled()) return;
    const item = itemOf(e);
    if (item) held = { item, id: e.pointerId, start: at(e), dragging: false };
  }, { signal });

  host.addEventListener('pointermove', (e) => {
    if (!held || e.pointerId !== held.id) return;
    const by = at(e) - held.start;
    if (!held.dragging) {
      if (Math.abs(by) < THRESHOLD) return;
      held.dragging = true;
      held.item.setAttribute('data-dragging', '');
      held.item.setPointerCapture(e.pointerId);
    }
    held.item.style.setProperty(y ? '--_drag-y' : '--_drag-x', `${by}px`);
    const others = options.items().filter((i) => i !== held!.item);
    const over = others.find((i) => {
      const r = i.getBoundingClientRect();
      return y ? at(e) >= r.top && at(e) <= r.bottom : at(e) >= r.left && at(e) <= r.right;
    });
    mark(over ? { item: over, side: at(e) < middle(over) ? 'before' : 'after' } : null);
  }, { signal });

  host.addEventListener('pointerup', (e) => {
    if (!held || e.pointerId !== held.id) return;
    const { item, dragging } = held;
    const to = target;
    end();
    if (!dragging) return;
    // The click the release makes is the drag's, not a press. Capture: first.
    window.addEventListener('click', (c) => { c.stopPropagation(); c.preventDefault(); }, { capture: true, once: true });
    const order = to ? landed(item, to) : null;
    if (order && order.some((el, i) => el !== options.items()[i])) options.moved(order);
  }, { signal });

  host.addEventListener('pointercancel', end, { signal });
  host.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && held?.dragging) {
      end();
      return;
    }
    if (!e.altKey || !options.enabled()) return;
    const back = y ? 'ArrowUp' : 'ArrowLeft';
    const on = y ? 'ArrowDown' : 'ArrowRight';
    if (e.key !== back && e.key !== on) return;
    const item = itemOf(e);
    const items = options.items();
    const i = item ? items.indexOf(item) : -1;
    const j = e.key === back ? i - 1 : i + 1;
    if (!item || j < 0 || j >= items.length) return;
    e.preventDefault();
    options.moved(landed(item, { item: items[j]!, side: e.key === back ? 'before' : 'after' }));
  }, { signal });
}
