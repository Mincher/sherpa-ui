/**
 * top-layer-tips.ts — open a hovered or focused anchor's tip in the TOP LAYER.
 *
 * CSS places a tip and shows it only while it is open (`sherpa-anchor.css`), so
 * no box it sits in can clip it. TRAP T-a-tip-lives-in-the-top-layer
 *
 * Map:
 * - liftTipsIn — Hear every hover and focus in one shadow root, and open or shut the tip concerned.
 */

const ANCHOR = '.sherpa-anchor';
const TIP = '.sherpa-tip';
/** A donut slice or gauge band: an SVG path, its tip paired by index. */
const SEGMENT = '.chart-segment[data-index]';

/** The one tip open now: a new one shuts it. */
let shown: HTMLElement | null = null;

/** The anchor an event landed in, in THIS root, and its tip: the sibling after
 *  it, one inside it, or a segment's by index. */
function tipOf(root: ShadowRoot, event: Event): { anchor: Element; tip: HTMLElement } | null {
  // The PATH, not `closest()`: the target may be a slotted label or a badge's own part.
  let anchor: Element | null = null;
  for (const node of event.composedPath()) {
    if (node === root) break;
    if (!(node instanceof Element)) continue;
    // A menu or a dialog the anchor holds is not the anchor.
    if (node.hasAttribute('popover')) return null;
    if (node.getRootNode() === root && node.matches(`${SEGMENT}, ${ANCHOR}`)) {
      anchor = node;
      break;
    }
  }
  if (!anchor) return null;
  const index = anchor.matches(SEGMENT) ? anchor.getAttribute('data-index') : null;
  const next = anchor.nextElementSibling;
  const tip = index != null ? root.querySelector(`${TIP}[data-index="${index}"]`)
    : next?.matches(TIP) ? next : anchor.querySelector(TIP);
  return tip instanceof HTMLElement && tip.popover === 'manual' ? { anchor, tip } : null;
}

/** The focused element, however deep, when it shows keyboard focus. */
function keyboardFocus(): Element | null {
  let at = document.activeElement;
  while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
  return at?.matches(':focus-visible') ? at : null;
}

/** Is `node` inside `anchor` as drawn: through slots and shadow roots. */
function drawnIn(anchor: Element, node: Node | null): boolean {
  for (let at = node; at; at = (at instanceof Element && at.assignedSlot) || at.parentNode || (at instanceof ShadowRoot ? at.host : null)) {
    if (at === anchor) return true;
  }
  return false;
}

function lift(this: ShadowRoot, event: Event): void {
  const found = tipOf(this, event);
  // A focus that does not SHOW — a press — opens nothing; the hover already did.
  if (!found || (event.type === 'focusin' && !keyboardFocus())) return;
  const { tip } = found;
  if (shown !== tip && shown?.matches(':popover-open')) shown.hidePopover();
  if (!tip.matches(':popover-open')) tip.showPopover();
  shown = tip;
  // One its host's CSS hides — empty, turned off, under its open menu — is never held open.
  if (getComputedStyle(tip).display === 'none') tip.hidePopover();
}

function drop(this: ShadowRoot, event: Event): void {
  const found = tipOf(this, event);
  if (!found) return;
  /* A FRAME LATER: Firefox still matches `:hover` while `pointerout` is heard.
     Still hovered, or still focused, then: the other of the two keeps it up. */
  requestAnimationFrame(() => {
    const { anchor, tip } = found;
    if (!tip.matches(':popover-open') || anchor.matches(':hover') || drawnIn(anchor, keyboardFocus())) return;
    tip.hidePopover();
  });
}

/** Hear every hover and focus in one shadow root, and open or shut the tip
 *  concerned. The ROOT, never the document: a move between two of its elements
 *  stops at its host. TRAP T-a-tip-lives-in-the-top-layer */
export function liftTipsIn(root: ShadowRoot): void {
  root.addEventListener('pointerover', lift, { capture: true, passive: true });
  root.addEventListener('pointerout', drop, { capture: true, passive: true });
  root.addEventListener('focusin', lift, true);
  root.addEventListener('focusout', drop, true);
}
