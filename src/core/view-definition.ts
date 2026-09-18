/**
 * view-definition.ts — what a VIEW IS, with no DOM.
 *
 * A view definition is a plain object: a flat registry of elements keyed by id,
 * a root id, a state blob, and the wiring between them. Nothing in it is an
 * element — it is a DESCRIPTION of one, the same way a `Filter` is a description
 * of a query rather than a function that runs it.
 *
 * WHY THIS IS A SEPARATE FILE FROM `render-view.ts`.
 *
 * TRAP T-a-view-definition-is-data-the-render-is-not — the split, and the hole
 * it closed: `SavedView.content` IS a `ViewDefinition`, `SavedView` ships in
 * `sherpa-ui/data`, and yet `ViewDefinition` did not — so a server could hold
 * one and had no name for it.
 *
 *   sherpa-ui/data   this file — build, validate, store, send a definition
 *   sherpa-ui        renderView() — turn one into live elements. Needs a DOM.
 *
 * The same split `Store` and `DataSource` already have from the components that
 * consume them, and the reason is the same: the DATA half is what a server, a
 * test, an MCP tool and a saved view all share.
 */

/** A `{ "$state": "/pointer" }` binding into the view state blob. */
export interface StateRef {
  $state: string;
}

/** A state-mediated wiring rule: on `on`, write into state at pointer `to`. */
export interface WriteRule {
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

/* ── Reading a definition ──────────────────────────────────────────────── */

/** Whether a prop or data value is a `$state` pointer rather than a literal. */
export function isStateRef(v: unknown): v is StateRef {
  return v != null && typeof v === 'object' && typeof (v as StateRef).$state === 'string';
}

/**
 * Resolve a `WriteRule.value` accessor against an event detail.
 *
 * `undefined` or `'$detail'` means the WHOLE detail; `'$detail.a.b'` walks into
 * it. A path that does not exist reads as `undefined` rather than throwing —
 * a wiring rule pointed at a field an event stopped carrying should quietly
 * write nothing, not take the view down.
 */
export function readDetail(accessor: string | undefined, detail: unknown): unknown {
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

/* ── Checking a definition ─────────────────────────────────────────────── */

/** What `checkView` reports. Empty `problems` means the definition is sound. */
export interface ViewCheck {
  ok: boolean;
  problems: string[];
}

/**
 * Check a definition WITHOUT building it.
 *
 * TRAP T-a-view-definition-is-data-the-render-is-not — this is the half a
 * server can run. `renderView` throws on a missing id at the moment it reaches
 * it, which is the right behaviour in a browser and useless to an endpoint
 * deciding whether to accept a saved view at all.
 *
 * It checks SHAPE and REFERENCES, never element types: whether
 * `sherpa-data-grid` exists is a question for the component registry, and the
 * registry is exactly what a headless caller does not have.
 */
export function checkView(view: unknown): ViewCheck {
  const problems: string[] = [];
  const v = view as Partial<ViewDefinition> | null;

  if (!v || typeof v !== 'object') {
    return { ok: false, problems: ['not an object'] };
  }
  if (typeof v.root !== 'string' || !v.root) problems.push('`root` must be a non-empty string');
  if (!v.elements || typeof v.elements !== 'object') {
    problems.push('`elements` must be an object');
    return { ok: false, problems };
  }

  const ids = new Set(Object.keys(v.elements));
  if (typeof v.root === 'string' && v.root && !ids.has(v.root)) {
    problems.push(`root "${v.root}" is not in \`elements\``);
  }

  for (const [id, el] of Object.entries(v.elements)) {
    if (!el || typeof el !== 'object') {
      problems.push(`"${id}" is not an object`);
      continue;
    }
    if (typeof el.type !== 'string' || !el.type) {
      problems.push(`"${id}" has no \`type\``);
    }
    // EVERY REFERENCE, both kinds. A dangling id is the one error that is
    // certain to be a mistake — the registry is flat, so there is nowhere else
    // the id could be coming from.
    for (const childId of el.children ?? []) {
      if (!ids.has(childId)) problems.push(`"${id}".children &rarr; unknown id "${childId}"`);
    }
    for (const [slot, fill] of Object.entries(el.slots ?? {})) {
      for (const childId of Array.isArray(fill) ? fill : [fill]) {
        if (!ids.has(childId)) problems.push(`"${id}".slots.${slot} &rarr; unknown id "${childId}"`);
      }
    }
    for (const w of el.writes ?? []) {
      if (!w || typeof w.on !== 'string' || typeof w.to !== 'string') {
        problems.push(`"${id}" has a write rule without \`on\` and \`to\``);
      }
    }
  }

  // A CYCLE would make `renderView` recurse forever. Cheap to find here, and
  // impossible to report usefully once the stack has blown.
  const seen = new Set<string>();
  const stack = new Set<string>();
  const walk = (id: string): void => {
    if (stack.has(id)) {
      problems.push(`cycle through "${id}"`);
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    stack.add(id);
    const el = v.elements?.[id];
    for (const childId of el?.children ?? []) if (ids.has(childId)) walk(childId);
    for (const fill of Object.values(el?.slots ?? {})) {
      for (const childId of Array.isArray(fill) ? fill : [fill]) if (ids.has(childId)) walk(childId);
    }
    stack.delete(id);
  };
  for (const id of ids) walk(id);

  return { ok: problems.length === 0, problems };
}

/**
 * Every `$state` pointer a definition reads or writes.
 *
 * What a host needs to know which state blob a saved view expects — and what a
 * migration needs to find the views that still point at a renamed pointer.
 */
export function viewPointers(view: ViewDefinition): string[] {
  const out = new Set<string>();
  for (const el of Object.values(view.elements ?? {})) {
    if (isStateRef(el.data)) out.add(el.data.$state);
    for (const value of Object.values(el.props ?? {})) {
      if (isStateRef(value)) out.add(value.$state);
    }
    for (const w of el.writes ?? []) out.add(w.to);
  }
  return [...out].sort();
}
