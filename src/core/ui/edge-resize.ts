/**
 * edge-resize.ts — drag an EDGE, or move it with the keys, to resize a box.
 *
 * A helper a component IMPORTS, never a base class: the overlay panel's left
 * edge and the app shell's panel areas share it. The component says how wide
 * the box is drawn and writes the width it is asked for; its CSS owns the
 * clamp. TRAP T-an-edge-resizes-its-box
 *
 * Map:
 * - EdgeResizeOptions — what the edge moves, which way it grows, and its clamp
 * - resizeByEdge — wire one separator: a pointer drag, the arrow keys, Home and End, its values
 */

/** What the edge moves, which way it grows, and its clamp. */
export interface EdgeResizeOptions {
  /** The box's width as it is drawn now. */
  measure: () => number;
  /** Write the width asked for. `done` on release or a key: the moment to report. */
  apply: (px: number, done: boolean) => void;
  /** +1: the edge is the box's END, so pulling it on widens; -1: its START. */
  grows: 1 | -1;
  /** How far one arrow key moves the edge. */
  step?: number;
  /** The clamp, as drawn: the separator's range, and where Home and End go. */
  min?: () => number;
  max?: () => number;
  signal?: AbortSignal;
}

/**
 * Wire one separator. The edge moves the way the pointer or the key goes,
 * so an arrow widens on one side and narrows on the other. `data-dragging` is
 * on the edge while it is held, so its indicator stays when the pointer leaves
 * the strip.
 */
export function resizeByEdge(edge: HTMLElement, options: EdgeResizeOptions): void {
  const step = options.step ?? 16;
  const { signal } = options;
  /* A focusable separator states its value — and its range, which the one it
     replaced never did. */
  const say = (): void => {
    const now = options.measure();
    const min = options.min?.();
    const max = options.max?.();
    edge.setAttribute('aria-valuenow', String(Math.round(now)));
    if (min != null) edge.setAttribute('aria-valuemin', String(Math.round(min)));
    if (max != null) edge.setAttribute('aria-valuemax', String(Math.round(Math.max(max, min ?? max))));
  };
  const to = (px: number, done: boolean): void => {
    options.apply(px, done);
    say();
  };

  edge.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const start = options.measure();
    const from = event.clientX;
    /* Capture, so the drag follows a pointer that leaves the strip. Firefox
       REFUSES a pointer it did not start (a synthetic one) and throws, which
       stopped the drag before it began. */
    try {
      edge.setPointerCapture(event.pointerId);
    } catch { /* not a live pointer: the drag still works while over the edge */ }
    edge.toggleAttribute('data-dragging', true);
    event.preventDefault();
    const at = (e: PointerEvent): number => start + options.grows * (e.clientX - from);
    const move = (e: PointerEvent): void => to(at(e), false);
    const end = (e: PointerEvent): void => {
      edge.removeEventListener('pointermove', move);
      edge.removeEventListener('pointerup', end);
      edge.removeEventListener('pointercancel', end);
      edge.removeAttribute('data-dragging');
      // A cancelled drag keeps where it got to; its pointer says nothing.
      to(e.type === 'pointercancel' ? options.measure() : at(e), true);
    };
    edge.addEventListener('pointermove', move);
    edge.addEventListener('pointerup', end);
    edge.addEventListener('pointercancel', end);
  }, signal ? { signal } : undefined);

  edge.addEventListener('keydown', (event) => {
    const way = ({ ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[event.key];
    let px: number | undefined;
    if (way) px = options.measure() + way * options.grows * step;
    else if (event.key === 'Home') px = options.min?.();
    else if (event.key === 'End') px = options.max?.();
    if (px == null) return;
    event.preventDefault();
    to(px, true);
  }, signal ? { signal } : undefined);

  edge.addEventListener('focus', say, signal ? { signal } : undefined);
}
