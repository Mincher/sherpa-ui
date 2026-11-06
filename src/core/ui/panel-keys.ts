/**
 * panel-keys.ts — the keys for the panels' tabs. Left Shift and a number brings that number's panel of the
 * left areas to the fore (a tab opens); Right Shift and a number, the right's. Shift and minus shuts the
 * focused panel (else its side's front one) back to its tab; Shift and plus opens one. Ctrl (Cmd on a Mac) and
 * Shift and minus, or plus, shuts or opens every panel and tab. The number is the tab's place on its side: the tabs in
 * the row of an area that holds several panels, in the row's order, then the tabs on the edge; a panel alone in
 * its area has no tab and no number. The app shell installs it. TRAP T-the-panel-keys-are-shift-and-a-number
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
  /** Has it a tab: a tab on the edge, or a tab in the row of an area holding several? */
  readonly tabbed: boolean;
  minimise(on?: boolean): void;
  front(): void;
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
  /** The panel the focus is in, through every shadow root. */
  const focusedPanel = (event: Event): PanelLike | undefined => event.composedPath().find((n): n is PanelLike => n instanceof HTMLElement && 'minimise' in n && 'side' in n);
  /** The one in front on a side: the one drawn, not a tab. */
  const frontOf = (side: 'start' | 'end'): PanelLike | undefined => panels().filter((p) => p.side === side && !p.minimised)
    .find((p) => p.hasAttribute('data-current')) ?? panels().find((p) => p.side === side && !p.minimised);
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
      // The row's tabs, then the edge's: a panel with no tab has no number.
      const tabs = panels().filter((p) => p.side === side && p.tabbed);
      const panel = [...tabs.filter((p) => !p.minimised), ...tabs.filter((p) => p.minimised)][n - 1];
      if (!panel) return;
      event.preventDefault();
      // A tab opens; a panel docked with others comes to the fore. It never shuts: that is Shift and minus.
      if (panel.minimised) panel.minimise(false);
      else panel.front();
    } else if (minus || plus) {
      event.preventDefault();
      // Ctrl: every panel and tab, whatever the side.
      if (primary) {
        for (const panel of panels()) panel.minimise(minus);
        return;
      }
      if (held.left === held.right) return;
      const side = held.left ? 'start' : 'end';
      const own = focusedPanel(event);
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
