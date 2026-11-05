/**
 * tab-stops.ts — what Tab reaches in a box, through its slots and shadow roots.
 * Small on purpose: a menu imports it, and every component with a menu pays for it.
 *
 * Map:
 * - focusTarget — a control's own focus: itself, a host that delegates it, or its shadow root's first stop
 * - controlsIn — each control in a box, in reading order, through its slots: never inside one
 * - tabStops — what Tab reaches in a box, in reading order, through its slots
 */

/** What can take the focus on its own. */
const NATIVE = 'button, input, select, textarea, a[href], [tabindex]:not(slot)';

/** A control's own focus: itself; a host that delegates it; else the first stop in its shadow root. */
export function focusTarget(el: Element): HTMLElement | null {
  if (el.matches(NATIVE)) return el.matches('[tabindex="-1"]') ? null : el as HTMLElement;
  const root = (el as HTMLElement).shadowRoot;
  if (!root) return null;
  if (root.delegatesFocus) return el as HTMLElement;
  for (const inner of root.querySelectorAll('*')) {
    const hit = focusTarget(inner);
    if (hit) return hit;
  }
  return null;
}

/** Each control in a box, in reading order, through its slots: never inside one. */
export function controlsIn(box: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walk = (el: Element): void => {
    const kids = el instanceof HTMLSlotElement ? el.assignedElements({ flatten: true }) : [...el.children];
    for (const kid of kids) {
      if (kid instanceof HTMLTemplateElement) continue;
      const focus = focusTarget(kid);
      // Only a NATIVE off is passed by Tab: an inactive button keeps its stop. TRAP T-an-inactive-button-keeps-its-tip
      if (focus) {
        if (!kid.matches(':disabled') && !focus.matches(':disabled') && kid.checkVisibility()) out.push(kid as HTMLElement);
      } else walk(kid);
    }
  };
  walk(box);
  return out;
}

/** What Tab reaches in a box, in reading order, through its slots: each control's own focus. */
export function tabStops(box: Element): HTMLElement[] {
  return controlsIn(box).flatMap((control) => focusTarget(control) ?? []);
}
