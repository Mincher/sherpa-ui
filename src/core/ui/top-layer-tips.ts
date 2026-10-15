/**
 * top-layer-tips.ts — lift a hovered or focused anchor's tip into the TOP LAYER.
 *
 * CSS shows and places a tip (`sherpa-anchor.css`); this lifts it, so no box it
 * sits in can clip it. A chart SEGMENT's tip is the exception: no selector can
 * reach it from the path, so the lift is what shows it.
 * TRAP T-a-tip-lives-in-the-top-layer
 *
 * Map:
 * - liftTips — Hear every hover and focus in the document, once, and lift the tip concerned.
 */

const ANCHOR = '.sherpa-anchor, .chart-mark';
const TIP = '.sherpa-tip, .chart-tip';
/** A donut slice or gauge band: an SVG path, its tip paired by index. */
const SEGMENT = '.chart-segment[data-index]';

/** Installed once per page. */
let lifting = false;

/** The anchor an event landed in, and its tip — the sibling after it, one
 *  inside it, or, for a segment, the tip of its index. */
function tipOf(event: Event): { anchor: Element; tip: HTMLElement } | null {
  // The DEEPEST target: a tip and its anchor share one shadow root.
  const at = event.composedPath()[0];
  if (!(at instanceof Element)) return null;
  const segment = at.closest(SEGMENT);
  const anchor = segment ?? at.closest(ANCHOR);
  if (!anchor) return null;
  const next = anchor.nextElementSibling;
  const tip = segment
    ? (segment.getRootNode() as ParentNode).querySelector(`.chart-tip[data-index="${segment.getAttribute('data-index')}"]`)
    : next?.matches(TIP) ? next : anchor.querySelector(TIP);
  return tip instanceof HTMLElement && tip.popover === 'manual' ? { anchor, tip } : null;
}

const lift = (event: Event): void => {
  const found = tipOf(event);
  if (found && !found.tip.matches(':popover-open')) found.tip.showPopover();
};

const drop = (event: Event): void => {
  const found = tipOf(event);
  if (!found) return;
  /* A FRAME LATER: Firefox still matches `:hover` while `pointerout` is heard.
     Still hovered, or still focused, then: the other of the two keeps it up. */
  requestAnimationFrame(() => {
    const { anchor, tip } = found;
    if (tip.matches(':popover-open') && !anchor.matches(':hover, :focus-visible')) tip.hidePopover();
  });
};

/** Hear every hover and focus in the document, once, and lift the tip concerned. */
export function liftTips(): void {
  if (lifting) return;
  lifting = true;
  document.addEventListener('pointerover', lift, { capture: true, passive: true });
  document.addEventListener('pointerout', drop, { capture: true, passive: true });
  document.addEventListener('focusin', lift, true);
  document.addEventListener('focusout', drop, true);
}
