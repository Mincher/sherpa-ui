/**
 * render-element.ts — build a live element from a plain JSON node.
 *
 * The everyday path for dynamic / generative content: turn a serialisable
 * description into a Sherpa element (with its children/slots) and populate it
 * through the same populate() every component already has. Self-contained —
 * children and named-slot fills are INLINE nodes, not id references (that's the
 * view-definition's job; see render-view.ts).
 *
 *   {
 *     type: 'sherpa-container',
 *     props: { 'data-elevation': 'md' },       // literal attributes
 *     data: { state: 'loading' },              // populate() payload
 *     slots: { header: { type: 'sherpa-…' } }, // named-slot fills
 *     children: [ { type: 'sherpa-tag', … } ], // default-slot content
 *   }
 */

/** A populate()-payload value. */
export type ElementData = unknown;

/** A serialisable element description. */
export interface ElementNode {
  /** Literal custom-element tag, e.g. 'sherpa-tag'. */
  type: string;
  /** Literal attributes. string|number → set; true → boolean attr; false|null → omitted. */
  props?: Record<string, string | number | boolean | null | undefined>;
  /** populate() payload. */
  data?: ElementData;
  /** Named-slot fills: slot name → inline node (or array of nodes). */
  slots?: Record<string, ElementNode | ElementNode[]>;
  /** Default-slot content, in order. */
  children?: ElementNode[];
}

/** An element that can be populated (all reforged components qualify). */
interface Populatable extends HTMLElement {
  populate?: (data: unknown) => void;
}

/** Apply one attribute, honouring the boolean/omit rules. */
function applyAttr(el: HTMLElement, name: string, value: unknown): void {
  if (value === true) el.setAttribute(name, '');
  else if (value === false || value == null) el.removeAttribute(name);
  else el.setAttribute(name, String(value));
}

/**
 * Build a live element from an element node. Recurses into slots (named-slot
 * fills) and children (default-slot content), and populates from data. Returns
 * the element synchronously; data population resolves after the element renders
 * (populate() defers internally via the base class's `rendered`).
 */
export function renderElement(node: ElementNode): HTMLElement {
  if (!node || typeof node.type !== 'string') {
    throw new Error('renderElement: node.type (a custom-element tag) is required');
  }
  const el = document.createElement(node.type) as Populatable;

  for (const [name, value] of Object.entries(node.props ?? {})) {
    applyAttr(el, name, value);
  }

  for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
    for (const childNode of Array.isArray(fill) ? fill : [fill]) {
      const child = renderElement(childNode);
      child.slot = slotName;
      el.appendChild(child);
    }
  }

  for (const childNode of node.children ?? []) {
    el.appendChild(renderElement(childNode));
  }

  if (node.data !== undefined && typeof el.populate === 'function') {
    el.populate(node.data);
  }

  return el;
}
