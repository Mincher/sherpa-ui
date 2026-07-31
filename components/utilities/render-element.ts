/**
 * render-element.ts — turn an element JSON node into a live DOM element.
 *
 * The everyday path for dynamic / generative content: build a Sherpa element
 * (and its children/slots) from a plain, serialisable description, and populate
 * it through the same `populate()` dispatcher every component already uses.
 *
 * An element node is self-contained — children and named-slot fills are INLINE
 * nodes, not id references. (Id-addressed composition, cross-element wiring and
 * the App-Shell frame belong to the full *view definition*; see
 * docs/VIEW-DEFINITION.md. This module is the composable subset.)
 *
 * Shape (see schema/element-node.schema.json):
 *   {
 *     "type": "sherpa-container",              // literal custom-element tag
 *     "props": { "data-col-span": 6, "disabled": true },  // literal attributes
 *     "data": [ … ] | { steps:[…] } | "<html>" | { src:"/url.json" },  // populate() payload
 *     "slots": { "header": { type:"sherpa-container-header", … } },    // named-slot fills
 *     "children": [ { type:"sherpa-metric", … } ]          // default-slot content
 *   }
 *
 * `props` values map to attributes: string|number → setAttribute(String(v));
 * true → boolean (empty) attribute; false|null → attribute omitted.
 */

import type { TemplateData } from './sherpa-template/sherpa-template.js';

/** A serialisable element description. */
export interface ElementNode {
  /** Literal custom-element tag, e.g. 'sherpa-metric'. */
  type: string;
  /** Literal attributes. */
  props?: Record<string, string | number | boolean | null | undefined>;
  /** populate() payload: array | keyed object | HTML string | { src }. */
  data?: TemplateData | { src: string };
  /** Named-slot fills: slot name → inline node (or array of nodes). */
  slots?: Record<string, ElementNode | ElementNode[]>;
  /** Default-slot content. */
  children?: ElementNode[];
}

/** A component that can be populated (all SherpaElement subclasses qualify). */
interface Populatable extends HTMLElement {
  populate?: (data: unknown) => void;
  rendered?: Promise<void>;
}

/** Set a single attribute from a props value, honouring the boolean/omit rules. */
function applyAttr(el: HTMLElement, name: string, value: unknown): void {
  if (value === true) el.setAttribute(name, '');
  else if (value === false || value == null) el.removeAttribute(name);
  else el.setAttribute(name, String(value));
}

/** True when a `data` value is a remote `{ src }` reference. */
function isSrcRef(data: unknown): data is { src: string } {
  return (
    data != null &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    typeof (data as { src?: unknown }).src === 'string'
  );
}

/**
 * Populate an element once it has rendered. A `{ src }` payload is fetched and
 * the parsed JSON is handed to populate(); anything else is passed straight
 * through to the unified dispatcher (which sniffs array / keyed / HTML).
 */
function populateWhenReady(el: Populatable, data: ElementNode['data']): void {
  const run = (): void => {
    const populate = el.populate;
    if (typeof populate !== 'function') return;
    if (isSrcRef(data)) {
      fetch(data.src)
        .then((r) => r.json())
        .then((json) => populate.call(el, json))
        .catch((e) => console.error(`render-element: failed to fetch data.src "${data.src}"`, e));
      return;
    }
    populate.call(el, data);
  };
  // Defer to a microtask so the caller has appended the element first. Appending
  // fires connectedCallback synchronously, which sets up `rendered`; reading it
  // now (rather than at build time, when the element is still detached) means we
  // await the real first render before populate() touches the shadow DOM.
  queueMicrotask(() => {
    if (el.rendered) void Promise.resolve(el.rendered).then(run);
    else run();
  });
}

/**
 * Build a live element from an element JSON node. Recurses into `slots`
 * (named-slot fills) and `children` (default-slot content), and populates the
 * element from `data`. Returns the element synchronously; `data` population
 * resolves asynchronously once the element has rendered.
 *
 * @param node the element description
 * @returns the created element
 */
export function renderElement(node: ElementNode): HTMLElement {
  if (!node || typeof node.type !== 'string') {
    throw new Error('renderElement: node.type (a custom-element tag) is required');
  }
  const el = document.createElement(node.type) as Populatable;

  // 1. Attributes.
  for (const [name, value] of Object.entries(node.props ?? {})) {
    applyAttr(el, name, value);
  }

  // 2. Named-slot fills — each child gets its `slot` set and is appended.
  for (const [slotName, fill] of Object.entries(node.slots ?? {})) {
    const nodes = Array.isArray(fill) ? fill : [fill];
    for (const childNode of nodes) {
      const child = renderElement(childNode);
      child.slot = slotName;
      el.appendChild(child);
    }
  }

  // 3. Default-slot children, in order.
  for (const childNode of node.children ?? []) {
    el.appendChild(renderElement(childNode));
  }

  // 4. Data → populate() (after render).
  if (node.data !== undefined) {
    populateWhenReady(el, node.data);
  }

  return el;
}
