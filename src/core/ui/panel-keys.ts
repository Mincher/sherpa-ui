/**
 * panel-keys.ts — the keys for the panels' tabs. Left Shift and a number opens, or shuts back to its tab,
 * that number's panel of the left areas; Right Shift and a number, the right's. Shift and minus shuts every
 * panel to its tab; Shift and plus opens every tab. The number is the panel's place among the shown panels
 * of its side, in page order. The app shell installs it. TRAP T-the-panel-keys-are-shift-and-a-number
 *
 * Map:
 * - PanelLike — A panel the keys can drive.
 * - panelKeys — Listen for the panel keys; `listen` is the element's own `on`, so they end with it.
 */

/** A panel the keys can drive: an overlay panel or the node panel. */
export interface PanelLike extends HTMLElement {
  readonly minimised: boolean;
  readonly side: 'start' | 'end';
  readonly shown: boolean;
  minimise(on?: boolean): void;
}

/** A field that is being typed in takes the keys for itself. */
function typing(event: Event): boolean {
  const el = event.composedPath()[0];
  return el instanceof HTMLElement && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.localName));
}

/** The digit a key code says, 1 to 9: the row's or the pad's. */
function digit(code: string): number {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return m ? Number(m[1]) : 0;
}

/** Listen for the panel keys. */
export function panelKeys(listen: (target: EventTarget, type: string, handler: (event: Event) => void) => void): void {
  const held = { left: false, right: false };
  const panels = (): PanelLike[] => [...document.querySelectorAll<PanelLike>('sherpa-overlay-panel[data-minimisable], sherpa-node-panel[data-minimisable]')]
    .filter((p) => p.shown);
  listen(window, 'keydown', (e) => {
    const event = e as KeyboardEvent;
    if (event.code === 'ShiftLeft') held.left = true;
    else if (event.code === 'ShiftRight') held.right = true;
    if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || typing(event)) return;
    const n = digit(event.code);
    if (n) {
      // One Shift names the side; both, or none seen, name none.
      if (held.left === held.right) return;
      const side = held.left ? 'start' : 'end';
      const panel = panels().filter((p) => p.side === side)[n - 1];
      if (!panel) return;
      event.preventDefault();
      panel.minimise(!panel.minimised);
    } else if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
      event.preventDefault();
      for (const panel of panels()) panel.minimise(true);
    } else if (event.code === 'Equal' || event.code === 'NumpadAdd') {
      event.preventDefault();
      for (const panel of panels()) panel.minimise(false);
    }
  });
  listen(window, 'keyup', (e) => {
    const { code } = e as KeyboardEvent;
    if (code === 'ShiftLeft') held.left = false;
    else if (code === 'ShiftRight') held.right = false;
  });
  listen(window, 'blur', () => { held.left = false; held.right = false; });
}
