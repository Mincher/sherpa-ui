/**
 * render-view.ts — turn a view-definition JSON into a live view.
 *
 * The composition layer *on top of* renderElement(). Where an ElementNode is a
 * single self-contained element (children/slots inline), a **view definition** is
 * a NORMALISED description: a flat `elements` registry keyed by id, a layout tree
 * expressed by id references, the App-Shell regions each element fills, and
 * state-mediated wiring between elements. See docs/VIEW-DEFINITION.md and
 * schema/view-definition.schema.json.
 *
 *   {
 *     "root": "layout",                       // element filling the shell body
 *     "shell": { "nav": "mainNav", "header": "appHeader" },
 *     "state": { "filter": null },            // value blob, addressed by $state pointers
 *     "elements": {
 *       "layout": { "type": "sherpa-layout-grid", "children": ["grid"] },
 *       "grid":   { "type": "sherpa-data-grid", "data": { "$state": "/filter" } },
 *       "qf":     { "type": "sherpa-quick-filter", "writes": [{ on:"quick-filter-change", to:"/filter" }] }
 *     }
 *   }
 *
 * Identity is separate from layout: an element is *placed* by being referenced
 * from a parent's `children` (default slot) / `slots` (named slot), or assigned to
 * a shell region. Cross-element effects flow THROUGH state: an element `writes` to
 * a `$state` pointer on an event; consumers whose `data`/`props` bind that pointer
 * re-populate. No direct element-to-element references, no view re-render.
 *
 * The per-element build (attributes, slots, children, data→populate) is delegated
 * to renderElement() unchanged — this module resolves ids, binds state, and wires.
 */

import { renderElement, type ElementNode } from './render-element.js';

/** A `{ "$state": "/pointer" }` binding into the view state blob. */
interface StateRef {
  $state: string;
}

/** A state-mediated wiring rule: on `on`, write into state at pointer `to`. */
interface WriteRule {
  /** Event name to listen for on this element. */
  on: string;
  /** JSON Pointer into `state` to write on the event. */
  to: string;
  /** '$detail…' path read from the event detail; omit to write the whole detail. */
  value?: string;
}

/** One element in a view — an id-addressed ElementNode with references, not inline nesting. */
export interface ViewElement {
  /** Literal custom-element tag, e.g. 'sherpa-metric'. */
  type: string;
  /** Literal attributes; a `{ $state }` value binds the attribute to state. */
  props?: Record<string, string | number | boolean | null | undefined | StateRef>;
  /** populate() payload — array | keyed object | HTML string | { $state } | { src }. */
  data?: unknown;
  /** Named-slot fills: slot name → element id (or array of ids). */
  slots?: Record<string, string | string[]>;
  /** Ordered ids placed in this element's default slot. */
  children?: string[];
  /** State-mediated wiring: on each event, write into state at a pointer. */
  writes?: WriteRule[];
}

/** A whole view. */
export interface ViewDefinition {
  /** Optional human label. */
  view?: string;
  /** Id of the element filling the shell body region. */
  root: string;
  /** Region → element id for the implicit App-Shell frame. */
  shell?: { nav?: string; header?: string; productBar?: string; body?: string };
  /** Free-form value blob, addressed by `$state` pointers. */
  state?: Record<string, unknown>;
  /** Flat registry of every element, keyed by id. */
  elements: Record<string, ViewElement>;
}

/** Result of rendering a view: the shell (or root) element plus the live state store. */
export interface RenderedView {
  /** The top-level DOM element to append (sherpa-app-shell if `shell` was given, else root). */
  el: HTMLElement;
  /** The live reactive state store (reads/writes trigger re-population of bound consumers). */
  state: StateStore;
}

/** True when a value is a `{ $state }` reference. */
function isStateRef(v: unknown): v is StateRef {
  return v != null && typeof v === 'object' && typeof (v as StateRef).$state === 'string';
}

/** Decode one RFC 6901 reference token (`~1` → `/`, `~0` → `~`). */
function decodeToken(t: string): string {
  return t.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Read a JSON Pointer (RFC 6901) from an object. Returns undefined if any step is missing. */
function getPointer(root: unknown, pointer: string): unknown {
  if (pointer === '') return root;
  if (pointer[0] !== '/') return undefined;
  let cur: unknown = root;
  for (const raw of pointer.slice(1).split('/')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[decodeToken(raw)];
  }
  return cur;
}

/** Write a value at a JSON Pointer, creating intermediate objects as needed. */
function setPointer(root: Record<string, unknown>, pointer: string, value: unknown): void {
  if (pointer === '' || pointer[0] !== '/') return;
  const tokens = pointer.slice(1).split('/').map(decodeToken);
  const leaf = tokens.pop();
  if (leaf === undefined) return;
  let cur: Record<string, unknown> = root;
  for (const k of tokens) {
    const next = cur[k];
    if (next == null || typeof next !== 'object') cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[leaf] = value;
}

/** Read a `$detail…` accessor from an event's detail (e.g. '$detail.route'). */
function readDetail(accessor: string | undefined, detail: unknown): unknown {
  if (!accessor || accessor === '$detail') return detail;
  const path = accessor.replace(/^\$detail\.?/, '');
  if (!path) return detail;
  let cur: unknown = detail;
  for (const k of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/**
 * Reactive state store. Holds the view's `state` blob and a set of subscribers
 * keyed by the pointer prefix they care about. A `set` at `/filter` re-runs every
 * subscriber registered for `/filter` (or a parent/child pointer that overlaps).
 */
export class StateStore {
  #data: Record<string, unknown>;
  #subs = new Set<{ pointer: string; run: (value: unknown) => void }>();

  constructor(initial: Record<string, unknown> = {}) {
    this.#data = structuredClone(initial);
  }

  /** Read the value at a pointer. */
  get(pointer: string): unknown {
    return getPointer(this.#data, pointer);
  }

  /** Write a value at a pointer and notify overlapping subscribers. */
  set(pointer: string, value: unknown): void {
    setPointer(this.#data, pointer, value);
    for (const sub of this.#subs) {
      if (pointersOverlap(sub.pointer, pointer)) sub.run(this.get(sub.pointer));
    }
  }

  /** Subscribe to a pointer; `run` fires on every overlapping write. Returns an unsubscribe fn. */
  subscribe(pointer: string, run: (value: unknown) => void): () => void {
    const sub = { pointer, run };
    this.#subs.add(sub);
    return () => this.#subs.delete(sub);
  }

  /** Snapshot of the whole blob (for debugging/tests). */
  snapshot(): Record<string, unknown> {
    return structuredClone(this.#data);
  }
}

/** Two pointers overlap when one is a prefix of the other (so /a re-runs /a/b consumers and vice-versa). */
function pointersOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

/** A populatable Sherpa element. */
interface Populatable extends HTMLElement {
  populate?: (data: unknown) => void;
  rendered?: Promise<void>;
}

/** Run `fn` once the element has rendered (mirrors render-element's deferral). */
function whenRendered(el: Populatable, fn: () => void): void {
  queueMicrotask(() => {
    if (el.rendered) void Promise.resolve(el.rendered).then(fn);
    else fn();
  });
}

/**
 * Build a live view from a view-definition. Resolves the id registry into a DOM
 * tree, binds `$state` references reactively, wires `writes`, and fills the App
 * Shell regions. Returns the element to append plus the live state store.
 *
 * The shell frame is implicit: when `shell` is present, a `sherpa-app-shell` is
 * created and each named region's element is slotted into it; the body defaults to
 * `root`. Without `shell`, the `root` element is returned directly.
 *
 * @param view the view definition
 * @returns the top element to append and the reactive state store
 */
export function renderView(view: ViewDefinition): RenderedView {
  if (!view || typeof view !== 'object' || !view.elements || typeof view.root !== 'string') {
    throw new Error('renderView: a view with { root, elements } is required');
  }
  const store = new StateStore(view.state ?? {});
  const built = new Map<string, HTMLElement>();

  /** Build the element registered at `id` (memoised — an id is a single instance). */
  const build = (id: string): HTMLElement => {
    const existing = built.get(id);
    if (existing) return existing;

    const def = view.elements[id];
    if (!def) throw new Error(`renderView: element id "${id}" is not in the registry`);

    // 1. Resolve this element's own node (props/data), holding slots/children for id-wiring below.
    const node: ElementNode = { type: def.type };

    // Props: pass literals straight through; a $state prop is bound reactively after build.
    const stateProps: Array<[string, string]> = [];
    if (def.props) {
      node.props = {};
      for (const [name, value] of Object.entries(def.props)) {
        if (isStateRef(value)) stateProps.push([name, value.$state]);
        else node.props[name] = value as string | number | boolean | null | undefined;
      }
    }

    // Data: a $state data payload is bound reactively; everything else passes to renderElement.
    let stateData: string | null = null;
    if (isStateRef(def.data)) stateData = def.data.$state;
    else if (def.data !== undefined) node.data = def.data as ElementNode['data'];

    const el = renderElement(node) as Populatable;
    built.set(id, el);

    // 2. Named-slot fills by id.
    if (def.slots) {
      for (const [slotName, fill] of Object.entries(def.slots)) {
        for (const childId of Array.isArray(fill) ? fill : [fill]) {
          const child = build(childId);
          child.slot = slotName;
          el.appendChild(child);
        }
      }
    }

    // 3. Default-slot children by id, in order.
    for (const childId of def.children ?? []) {
      el.appendChild(build(childId));
    }

    // 4. Reactive $state prop bindings.
    for (const [name, pointer] of stateProps) {
      const apply = (v: unknown): void => {
        if (v === true) el.setAttribute(name, '');
        else if (v === false || v == null) el.removeAttribute(name);
        else el.setAttribute(name, String(v));
      };
      apply(store.get(pointer));
      store.subscribe(pointer, apply);
    }

    // 5. Reactive $state data binding — re-populate on every overlapping write.
    if (stateData != null) {
      const pointer = stateData;
      const populate = (v: unknown): void =>
        whenRendered(el, () => typeof el.populate === 'function' && el.populate(v));
      populate(store.get(pointer));
      store.subscribe(pointer, populate);
    }

    // 6. Wiring: on each listed event, write the (detail-derived) value into state.
    for (const w of def.writes ?? []) {
      el.addEventListener(w.on, (e: Event) => {
        store.set(w.to, readDetail(w.value, (e as CustomEvent).detail));
      });
    }

    return el;
  };

  // Build the root and (if present) the shell frame around it.
  const shell = view.shell;
  const bodyId = shell?.body ?? view.root;
  const bodyEl = build(bodyId);

  if (!shell) return { el: bodyEl, state: store };

  const shellEl = renderElement({ type: 'sherpa-app-shell' });
  const regions: Array<[keyof NonNullable<typeof shell>, string]> = [
    ['nav', 'nav'],
    ['header', 'app-header'],
    ['productBar', 'product-bar'],
  ];
  for (const [key, slotName] of regions) {
    const elId = shell[key];
    if (!elId) continue;
    const regionEl = build(elId);
    regionEl.slot = slotName;
    shellEl.appendChild(regionEl);
  }
  shellEl.appendChild(bodyEl); // body → default slot
  return { el: shellEl, state: store };
}
