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
  /**
   * State applied through the component's OWN PUBLIC API, after it has its data.
   *
   * TRAP T-state-is-the-saved-view-half — why methods/accessors need their own
   * field, and why an unknown key is skipped rather than thrown.
   */
  state?: Record<string, unknown>;
}

/**
 * An element that takes a data payload — the one shape, declared once.
 *
 * TRAP T-populatable-declared-four-times — `rendered` was missing here and the
 * shortest of four copies was a different contract.
 */
export interface Populatable extends HTMLElement {
  populate?: (data: unknown) => void | Promise<void>;
  rendered?: Promise<void>;
}

/** Apply one attribute, honouring the boolean/omit rules. */
function applyAttr(el: HTMLElement, name: string, value: unknown): void {
  if (value === true) el.setAttribute(name, '');
  else if (value === false || value == null) el.removeAttribute(name);
  else el.setAttribute(name, String(value));
}

/**
 * Apply a `state` block through an element's own public API.
 *
 * Returns the keys it could NOT apply — TRAP T-state-is-the-saved-view-half.
 * Exported because a saved view loaded later has to reach a live screen.
 */
/**
 * Is this value a LIST OF CALLS rather than one argument list?
 *
 * TRAP T-state-value-may-be-a-call-list — every entry an array AND more than one.
 */
function isCallList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 1 && value.every((v) => Array.isArray(v));
}

export function applyState(el: HTMLElement, state: Record<string, unknown>): string[] {
  const skipped: string[] = [];
  const target = el as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(state)) {
    // `in` walks the prototype chain, where a component's accessors and methods live.
    if (!(key in target)) {
      skipped.push(key);
      continue;
    }

    try {
      const current = target[key];
      if (typeof current === 'function') {
        // A METHOD — TRAP T-state-value-may-be-a-call-list.
        const fn = current as (...a: unknown[]) => unknown;
        const calls = isCallList(value) ? (value as unknown[][]) : [Array.isArray(value) ? value : [value]];
        for (const args of calls) fn.apply(el, args);
      } else {
        // An ACCESSOR, or a plain property.
        target[key] = value;
      }
    } catch {
      // A setter that refused — counted, not thrown.
      skipped.push(key);
    }
  }

  return skipped;
}

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

  // TRAP T-state-applies-after-rendered — synchronous apply filtered a grid
  // that had no columns yet, and did nothing.
  if (node.state) {
    const state = node.state;
    void Promise.resolve(el.rendered).then(() => {
      applyState(el, state);
    });
  }

  return el;
}
