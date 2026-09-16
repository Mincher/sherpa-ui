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
   * `props` sets attributes and `data` sets the populate payload. Neither can
   * express what a component exposes as a METHOD or an accessor — a grid's
   * column filters (`setColumnFilter`), its selection (`select`), a chart's
   * hidden series (`hiddenSeries`), a transfer list's chosen values.
   *
   * That is the half a SAVED VIEW needs. A reader who filters a column and
   * reloads should find it filtered; a preset called "Overdue invoices" should
   * arrive configured; an agent should be able to ask for a view by describing
   * it. All three are the same data, and this is the field that carries it.
   *
   *   { type: 'sherpa-data-grid',
   *     data: { columns, rows },
   *     state: { columnFilters: { name: ['name', 'contains', 'ana'] } } }
   *
   * Each key is a property or method NAME on the element. A method is CALLED
   * with the value (spread when it is an array of arguments); an accessor is
   * ASSIGNED. Applied after `populate()`, because a grid cannot filter a column
   * it does not have yet.
   *
   * A key the component does not expose is SKIPPED, not thrown: a saved view
   * outlives the code that made it, and one stale key must not stop the rest
   * being applied. See `renderElement`'s return for how to learn what was
   * skipped.
   */
  state?: Record<string, unknown>;
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
/**
 * Apply a `state` block through an element's own public API.
 *
 * Returns the keys it could NOT apply, so a caller can report them. A saved
 * view outlives the code that made it — a column that no longer exists, a
 * component that lost a method — and one stale key must not stop the rest. The
 * same reason a bad ROW is dropped and counted rather than thrown.
 *
 * Exported because a definition is also applied to elements that already exist:
 * `renderView` builds them, but a saved view loaded later has to reach a live
 * screen.
 */
export function applyState(el: HTMLElement, state: Record<string, unknown>): string[] {
  const skipped: string[] = [];
  const target = el as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(state)) {
    // `in` walks the prototype chain, which is where a component's accessors
    // and methods live — `key in el` is true for `hiddenSeries`, false for a
    // name nothing defines.
    if (!(key in target)) {
      skipped.push(key);
      continue;
    }

    try {
      const current = target[key];
      if (typeof current === 'function') {
        // A METHOD. An array is its ARGUMENT LIST, so `setColumnFilter` takes
        // two and `select` takes one — which is why a single-argument method
        // wanting an array is written as a nested array.
        const args = Array.isArray(value) ? value : [value];
        (current as (...a: unknown[]) => unknown).apply(el, args);
      } else {
        // An ACCESSOR, or a plain property.
        target[key] = value;
      }
    } catch {
      // A setter that refused — a value of the wrong shape, an index out of
      // range. Counted rather than thrown, for the same reason as above.
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

  // STATE LAST, and asynchronously, because it goes through the component's own
  // API and that needs the component to be ready: `populate()` waits for the
  // first render itself, so a grid has no columns to filter until after it
  // resolves. Applying synchronously here set a column filter on a grid with no
  // columns, which silently did nothing.
  if (node.state) {
    const state = node.state;
    void Promise.resolve((el as { rendered?: Promise<void> }).rendered).then(() => {
      applyState(el, state);
    });
  }

  return el;
}
