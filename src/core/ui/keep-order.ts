/**
 * keep-order.ts — redraw a list of elements and touch only what CHANGED: each element taken out and put back is a style and
 * a layout again, up to every `:has()` round it. TRAP T-a-redraw-keeps-what-it-can
 *
 * Map:
 * - keepOrder — Put these elements in a parent in this order, moving only those out of place.
 * - morph — Make an element match a fresh one, attribute by attribute, and its children in turn.
 */

/**
 * Put `els` in `parent` in this order, moving only those out of place. `exact`: they are ALL its children, and any other
 * child goes. Without it, its other children stay where they are.
 */
export function keepOrder(parent: Element, els: readonly Element[], exact = false): void {
  if (exact) {
    const keep = new Set<Node>(els);
    for (const child of [...parent.childNodes]) if (!keep.has(child)) child.remove();
  }
  let prev: Element | null = null;
  for (const el of els) {
    const placed = el.parentNode === parent && (!prev || !!(prev.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
    if (!placed) {
      if (prev) prev.after(el);
      else parent.prepend(el);
    }
    prev = el;
  }
}

/**
 * Make `old` match `fresh`: its attributes, and its children by place, in turn. Returns the one to keep: `old`, or `fresh`
 * where the two are not the same tag. One with no child elements takes the fresh one's text.
 */
export function morph(old: Element, fresh: Element): Element {
  if (old.localName !== fresh.localName || old.namespaceURI !== fresh.namespaceURI) return fresh;
  for (const { name } of [...old.attributes]) if (!fresh.hasAttribute(name)) old.removeAttribute(name);
  for (const { name, value } of fresh.attributes) if (old.getAttribute(name) !== value) old.setAttribute(name, value);
  if (!fresh.children.length) {
    if (old.children.length || old.textContent !== fresh.textContent) old.textContent = fresh.textContent;
    return old;
  }
  const was = old.children;
  const kids = [...fresh.children].map((child, i) => (was[i] ? morph(was[i]!, child) : child));
  keepOrder(old, kids, true);
  return old;
}
