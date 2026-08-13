/**
 * render-view.ts — build a whole live view from a normalised view-definition.
 *
 * The composition layer on top of renderElement(). Where an ElementNode is a
 * single self-contained element, a VIEW DEFINITION is a normalised description: a
 * flat `elements` registry keyed by id, a layout tree expressed by id references,
 * the app-shell regions each element fills, and state-mediated wiring between
 * elements.
 *
 *   {
 *     root: 'layout',
 *     shell: { nav: 'mainNav', header: 'appHeader' },
 *     state: { filter: null },
 *     elements: {
 *       layout: { type: 'sherpa-container', children: ['grid'] },
 *       grid:   { type: 'sherpa-data-grid', data: { $state: '/filter' } },
 *       qf:     { type: 'sherpa-quick-filter', writes: [{ on: 'change', to: '/filter' }] },
 *     },
 *   }
 *
 * Identity is separate from layout: an element is placed by being referenced from
 * a parent's children / slots, or a shell region. Cross-element effects flow
 * THROUGH state: an element `writes` to a `$state` pointer on an event; consumers
 * whose data/props bind that pointer re-populate. No direct element references.
 */
import { renderElement, type ElementNode } from './render-element.js';

/** A `{ "$state": "/pointer" }` binding into the view state blob. */
interface StateRef {
  $state: string;
}

/** A state-mediated wiring rule: on `on`, write into state at pointer `to`. */
interface WriteRule {
  on: string;
  to: string;
  /** '$detail…' path read from the event detail; omit to write the whole detail. */
  value?: string;
}

/** One element in a view — an id-addressed node with references, not inline nesting. */
export interface ViewElement {
  type: string;
  props?: Record<string, string | number | boolean | null | undefined | StateRef>;
  data?: unknown;
  slots?: Record<string, string | string[]>;
  children?: string[];
  writes?: WriteRule[];
}

/** A whole view. */
export interface ViewDefinition {
  view?: string;
  root: string;
  shell?: { nav?: string; header?: string; body?: string };
  state?: Record<string, unknown>;
  elements: Record<string, ViewElement>;
}

/** Result of rendering a view: the top element plus the live state store. */
export interface RenderedView {
  el: HTMLElement;
  state: StateStore;
}

function isStateRef(v: unknown): v is StateRef {
  return v != null && typeof v === 'object' && typeof (v as StateRef).$state === 'string';
}

function decodeToken(t: string): string {
  return t.replace(/~1/g, '/').replace(/~0/g, '~');
}

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

/** Two pointers overlap when one is a prefix of the other. */
function pointersOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

/**
 * Reactive state store. Holds the view's state blob; a `set` at a pointer re-runs
 * every subscriber whose pointer overlaps (a prefix either way).
 */
export class StateStore {
  #data: Record<string, unknown>;
  #subs = new Set<{ pointer: string; run: (value: unknown) => void }>();

  constructor(initial: Record<string, unknown> = {}) {
    this.#data = structuredClone(initial);
  }

  get(pointer: string): unknown {
    return getPointer(this.#data, pointer);
  }

  set(pointer: string, value: unknown): void {
    setPointer(this.#data, pointer, value);
    for (const sub of this.#subs) {
      if (pointersOverlap(sub.pointer, pointer)) sub.run(this.get(sub.pointer));
    }
  }

  subscribe(pointer: string, run: (value: unknown) => void): () => void {
    const sub = { pointer, run };
    this.#subs.add(sub);
    return () => this.#subs.delete(sub);
  }

  snapshot(): Record<string, unknown> {
    return structuredClone(this.#data);
  }
}

/** A populatable reforged element. */
interface Populatable extends HTMLElement {
  populate?: (data: unknown) => void;
  rendered?: Promise<void>;
}

/** Run `fn` once the element has rendered. */
function whenRendered(el: Populatable, fn: () => void): void {
  queueMicrotask(() => {
    if (el.rendered) void Promise.resolve(el.rendered).then(fn);
    else fn();
  });
}

/**
 * Build a live view from a view-definition. Resolves the id registry into a DOM
 * tree, binds `$state` references reactively, wires `writes`, and fills the
 * app-shell regions. Returns the element to append plus the live state store.
 */
export function renderView(view: ViewDefinition): RenderedView {
  if (!view || typeof view !== 'object' || !view.elements || typeof view.root !== 'string') {
    throw new Error('renderView: a view with { root, elements } is required');
  }
  const store = new StateStore(view.state ?? {});
  const built = new Map<string, HTMLElement>();

  const build = (id: string): HTMLElement => {
    const existing = built.get(id);
    if (existing) return existing;

    const def = view.elements[id];
    if (!def) throw new Error(`renderView: element id "${id}" is not in the registry`);

    // 1. This element's own node (props/data); slots/children wired by id below.
    const node: ElementNode = { type: def.type };

    const stateProps: Array<[string, string]> = [];
    if (def.props) {
      node.props = {};
      for (const [name, value] of Object.entries(def.props)) {
        if (isStateRef(value)) stateProps.push([name, value.$state]);
        else node.props[name] = value as string | number | boolean | null | undefined;
      }
    }

    let stateData: string | null = null;
    if (isStateRef(def.data)) stateData = def.data.$state;
    else if (def.data !== undefined) node.data = def.data;

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

    // 6. Wiring: on each event, write the (detail-derived) value into state.
    for (const w of def.writes ?? []) {
      el.addEventListener(w.on, (e: Event) => {
        store.set(w.to, readDetail(w.value, (e as CustomEvent).detail));
      });
    }

    return el;
  };

  const shell = view.shell;
  const bodyId = shell?.body ?? view.root;
  const bodyEl = build(bodyId);

  if (!shell) return { el: bodyEl, state: store };

  const shellEl = renderElement({ type: 'sherpa-app-shell' });
  for (const [key, slotName] of [
    ['nav', 'nav'],
    ['header', 'header'],
  ] as const) {
    const elId = shell[key];
    if (!elId) continue;
    const regionEl = build(elId);
    regionEl.slot = slotName;
    shellEl.appendChild(regionEl);
  }
  shellEl.appendChild(bodyEl); // body → default slot
  return { el: shellEl, state: store };
}
