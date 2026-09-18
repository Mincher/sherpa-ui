/**
 * render-view.ts — build a whole live view from a normalised view-definition.
 *
 * The composition layer on top of renderElement(). Where an ElementNode is a
 * single self-contained element, a VIEW DEFINITION is a normalised description: a
 * flat `elements` registry keyed by id, a layout tree expressed by id references,
 * the view-frame regions (nav / header / body) each element fills, and
 * state-mediated wiring between elements.
 *
 *   {
 *     root: 'shell',
 *     state: { filter: null },
 *     elements: {
 *       shell: { type: 'sherpa-app-shell',
 *                slots: { nav: 'mainNav', header: 'appHeader' },
 *                children: ['grid'] },
 *       mainNav:   { type: 'sherpa-nav' },
 *       appHeader: { type: 'sherpa-app-header', slots: { filters: 'qf' } },
 *       grid: { type: 'sherpa-data-grid', data: { $state: '/filter' } },
 *       qf:   { type: 'sherpa-quick-filter', writes: [{ on: 'change', to: '/filter' }] },
 *     },
 *   }
 *
 * THE SHELL IS AN ELEMENT, not a special case — `sherpa-app-shell` has a YAML
 * contract like every other component, so a view names it and fills its slots
 * by id. See TRAP T-the-shell-is-a-component-not-a-region-map.
 *
 * Identity is separate from layout: an element is placed by being referenced from
 * a parent's children / slots. Cross-element effects flow
 * THROUGH state: an element `writes` to a `$state` pointer on an event; consumers
 * whose data/props bind that pointer re-populate. No direct element references.
 */
import { renderElement, type ElementNode, type Populatable } from './render-element.js';
import { SessionStore } from './session.js';

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
  /**
   * State applied through the element's OWN PUBLIC API, after it has its data.
   *
   * The same field `ElementNode.state` carries —
   * TRAP T-state-is-the-saved-view-half.
   *
   *   grid: { type: 'sherpa-data-grid', data: {…},
   *           state: { setColumnFilter: ['name', ['name', 'contains', 'ana']] } }
   */
  state?: Record<string, unknown>;
}

/** A whole view. */
export interface ViewDefinition {
  view?: string;
  /**
   * The id of the element this view builds. For a full screen that is normally
   * a `sherpa-app-shell` with its nav and header in its named slots — see
   * TRAP T-the-shell-is-a-component-not-a-region-map.
   */
  root: string;
  state?: Record<string, unknown>;
  elements: Record<string, ViewElement>;
}

/** Result of rendering a view: the top element plus the live state store. */
export interface RenderedView {
  el: HTMLElement;
  state: SessionStore;
  /**
   * Every element this view built, by the id the definition gave it.
   *
   * TRAP T-view-elements-registry-is-returned — the ids were write-only until
   * this was handed back; a live map, not a copy of the tree.
   */
  elements: Record<string, HTMLElement>;
}

function isStateRef(v: unknown): v is StateRef {
  return v != null && typeof v === 'object' && typeof (v as StateRef).$state === 'string';
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

/**
 * Reactive state store — a view's state blob.
 *
 * TRAP T-state-store-is-the-session-store — a re-export, not a second class.
 */
export { SessionStore as StateStore };

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
 * view-frame regions (nav / header / body). Returns the element to append plus
 * the live state store.
 */
export function renderView(view: ViewDefinition): RenderedView {
  if (!view || typeof view !== 'object' || !view.elements || typeof view.root !== 'string') {
    throw new Error('renderView: a view with { root, elements } is required');
  }
  const store = new SessionStore(view.state ?? {});
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

    // The element's own API state, applied after its data — see ViewElement.state.
    if (def.state) node.state = def.state;

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

  // ONE root, built like any other element.
  // TRAP T-the-shell-is-a-component-not-a-region-map — this used to be two
  // paths: a plain root, and a `shell: { nav, header, body }` option that
  // hand-built a <div class="sherpa-view"> and tagged its children with
  // data-region. That was a SECOND implementation of `sherpa-app-shell`, which
  // already owns the frame, its nav state machine and its CSS — and which every
  // real screen in examples/ used instead. The option had one consumer: a test.
  const rootEl = build(view.root);
  // Re-read — see TRAP T-view-elements-registry-is-returned.
  return { el: rootEl, state: store, elements: Object.fromEntries(built) };
}
