/**
 * drag-xy.ts — drag a HANDLE, or step it with the arrow keys, to change two numbers at once:
 * a place, or a size. Beside edge-resize.ts, which changes one.
 *
 * A helper a component IMPORTS: a floating overlay panel's header moves it, and its corner
 * resizes it. The component says what the value is drawn at now and writes what it is asked
 * for; its CSS owns the clamp. TRAP T-a-floating-panel-is-a-state
 *
 * Map:
 * - XY — two numbers in px: a place, or a size
 * - DragXYOptions — what the handle changes, how far a key steps it, and which presses start it
 * - dragXY — wire one handle: a pointer drag past its slop, the arrow keys, Shift for four steps
 */

/** Two numbers in px: a place, or a size. */
export interface XY {
  x: number;
  y: number;
}

/** What the handle changes, how far a key steps it, and which presses start it. */
export interface DragXYOptions {
  /** The value as it is drawn now. */
  measure: () => XY;
  /** Write the value asked for. `done` on release or a key: the moment to report. */
  apply: (to: XY, done: boolean) => void;
  /** Where the arrows are heard: the handle itself, by default. */
  keys?: HTMLElement | null;
  /** How far one arrow steps it; Shift steps four times as far. */
  step?: number;
  /** Whether a press may start a drag: a press on a control inside the handle may not. */
  starts?: (event: PointerEvent) => boolean;
  /** How far the pointer travels before a press is a drag: a click is none. */
  slop?: number;
  /** Told when a drag takes hold and lets go, so its handle can stay drawn. */
  hold?: (held: boolean) => void;
  signal?: AbortSignal;
}

/** The arrows, as a way to go on each axis. */
const WAYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

/** Wire one handle. One pointer drives a drag; a second, held at once, is ignored. */
export function dragXY(handle: HTMLElement, options: DragXYOptions): void {
  const listen = options.signal ? { signal: options.signal } : undefined;
  let held = false;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || held || (options.starts && !options.starts(event))) return;
    held = true;
    const id = event.pointerId;
    const from = { x: event.clientX, y: event.clientY };
    const start = options.measure();
    const slop = options.slop ?? 0;
    let moved = false;
    // Firefox refuses to capture a pointer it did not start (a synthetic one), and throws.
    try {
      handle.setPointerCapture(id);
    } catch { /* not a live pointer: the drag still works while over the handle */ }
    // No text selected and no native drag on the way.
    event.preventDefault();
    const at = (e: PointerEvent): XY => ({ x: start.x + e.clientX - from.x, y: start.y + e.clientY - from.y });
    let last = start;
    const move = (e: PointerEvent): void => {
      if (e.pointerId !== id) return;
      // No button held: its release was lost, let go outside the window.
      if (!(e.buttons & 1)) {
        end(e);
        return;
      }
      if (!moved && Math.hypot(e.clientX - from.x, e.clientY - from.y) < slop) return;
      if (!moved) options.hold?.(true);
      moved = true;
      last = at(e);
      options.apply(last, false);
    };
    // A lost capture ends it too, or a handle taken away mid-drag would stay held.
    const ends = ['pointerup', 'pointercancel', 'lostpointercapture'] as const;
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== id || !held) return;
      held = false;
      handle.removeEventListener('pointermove', move);
      for (const type of ends) handle.removeEventListener(type, end);
      if (!moved) return;
      options.hold?.(false);
      // Only a release says where: a cancelled drag keeps where it got to.
      options.apply(e.type === 'pointerup' ? at(e) : last, true);
    };
    handle.addEventListener('pointermove', move);
    for (const type of ends) handle.addEventListener(type, end);
  }, listen);

  (options.keys ?? handle).addEventListener('keydown', (event) => {
    const way = WAYS[event.key];
    // Alt, Ctrl and Meta pass through: Alt+ArrowLeft is the browser's Back.
    if (!way || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const step = (options.step ?? 16) * (event.shiftKey ? 4 : 1);
    const now = options.measure();
    options.apply({ x: now.x + way[0] * step, y: now.y + way[1] * step }, true);
  }, listen);
}
