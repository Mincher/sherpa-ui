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

/** The anchor a SHARED tip is on now. */
const sharedOn = new WeakMap<HTMLElement, HTMLElement>();

/** The anchor an event landed in, in THIS root, and its tip: the first tip
 *  after it, one inside it, a segment's by index, or the one it is
 *  `aria-describedby`, shared by many anchors. */
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
  const named = anchor.getAttribute('aria-describedby');
  let after = anchor.nextElementSibling;
  while (after && !after.matches(TIP)) after = after.nextElementSibling;
  const tip = index != null ? root.querySelector(`${TIP}[data-index="${index}"]`)
    : after ?? anchor.querySelector(TIP) ?? (named ? root.getElementById(named) : null);
  return tip instanceof HTMLElement && tip.matches(TIP) && tip.popover === 'manual' ? { anchor, tip } : null;
}

/** A tip SHARED by many anchors takes the anchor's name from the last one. TODO 490 */
function share(anchor: Element, tip: HTMLElement): void {
  if (!(anchor instanceof HTMLElement) || anchor.getAttribute('aria-describedby') !== tip.id) return;
  const name = `--sherpa-tip-${tip.id}`;
  sharedOn.get(tip)?.style.removeProperty('--_anchor');
  anchor.style.setProperty('--_anchor', name);
  tip.style.setProperty('--_anchor', name);
  sharedOn.set(tip, anchor);
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
  const { anchor, tip } = found;
  share(anchor, tip);
  if (!tip.matches(':popover-open')) tip.showPopover();
  // One its host's CSS hides — empty, turned off, under its open menu — is
  // never held open, and shuts no other.
  if (getComputedStyle(tip).display === 'none') return tip.hidePopover();
  if (shown !== tip && shown?.matches(':popover-open')) shown.hidePopover();
  shown = tip;
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
