/**
 * panel-keys.ts — the keys for the panels' modes. Left Shift and a number names that number's panel of the left
 * area (Right Shift, the right's), in the area's order: a tab opens, a panel shown takes the focus. Shift and minus shuts
 * the focused panel (else its side's first) back to its tab, the area's panels with it; Shift and plus opens one. Ctrl (Cmd on a
 * Mac) and Shift and minus, or plus, shuts or opens every panel and tab. The app shell installs it. TRAP T-the-panel-keys-are-shift-and-a-number
 *
 * Map:
 * - PanelLike — A panel the keys can drive.
 * - panelKeys — Listen for the panel keys; `listen` is the element's own `on`, so they end with it.
 */

import { isApple, primaryKey } from './modifier-key.js';

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
  const panels = (): PanelLike[] => [...document.querySelectorAll<PanelLike>('sherpa-overlay-panel[data-minimisable]')]
    .filter((p) => p.shown);
  /** The panel the focus is in, through every shadow root. */
  const focusedPanel = (event: Event): PanelLike | undefined => event.composedPath().find((n): n is PanelLike => n instanceof HTMLElement && 'minimise' in n && 'side' in n);
  /** The first one drawn on a side: not a tab. */
  const frontOf = (side: 'start' | 'end'): PanelLike | undefined => panels().find((p) => p.side === side && !p.minimised);
  listen(window, 'keydown', (e) => {
    const event = e as KeyboardEvent;
    if (event.code === 'ShiftLeft') held.left = true;
    else if (event.code === 'ShiftRight') held.right = true;
    // Ctrl is Cmd on a Mac; the other of the two is no chord of ours.
    const other = isApple ? event.ctrlKey : event.metaKey;
    const primary = primaryKey(event);
    if (!event.shiftKey || event.altKey || other || typing(event)) return;
    const n = digit(event.code);
    const minus = event.code === 'Minus' || event.code === 'NumpadSubtract';
    const plus = event.code === 'Equal' || event.code === 'NumpadAdd';
    if (n && !primary) {
      // One Shift names the side; both, or none seen, name none.
      if (held.left === held.right) return;
      const side = held.left ? 'start' : 'end';
      // The area's panels in their order, drawn first, then the tabs.
      const here = panels().filter((p) => p.side === side);
      const panel = [...here.filter((p) => !p.minimised), ...here.filter((p) => p.minimised)][n - 1];
      if (!panel) return;
      event.preventDefault();
      // A tab opens; a panel shown takes the focus. It never shuts: that is Shift and minus.
      if (panel.minimised) panel.minimise(false);
      else panel.shadowRoot?.querySelector<HTMLElement>('.root')?.focus();
    } else if (minus || plus) {
      event.preventDefault();
      // Ctrl: every panel and tab, whatever the side.
      if (primary) {
        for (const panel of panels()) panel.minimise(minus);
        return;
      }
      if (held.left === held.right) return;
      const side = held.left ? 'start' : 'end';
      // The focused panel, if it is on that side; else the side's own.
      const focus = focusedPanel(event);
      const own = focus?.side === side ? focus : undefined;
      if (minus) (own ?? frontOf(side))?.minimise(true);
      else (own?.minimised ? own : panels().find((p) => p.side === side && p.minimised))?.minimise(false);
    }
  });
  listen(window, 'keyup', (e) => {
    const { code } = e as KeyboardEvent;
    if (code === 'ShiftLeft') held.left = false;
    else if (code === 'ShiftRight') held.right = false;
  });
  listen(window, 'blur', () => { held.left = false; held.right = false; });
}
