/**
 * sherpa-template.ts — Zero-dependency declarative binder for Sherpa components.
 *
 * Turns a data object into rendered DOM by binding it against a native
 * `<template>` that carries `data-bind*` markers. No template language, no
 * runtime dependency — just a walk over the cloned fragment.
 *
 * This is the single, consistent data → HTML path that replaces the ad-hoc
 * per-component `#createXItem()` clone-and-map functions. A component can be
 * populated with EITHER:
 *   • a data object  → bound at runtime to its `<template>` (this module), or
 *   • precompiled HTML → injected as-is via `bindHtml()` (no binding walk).
 *
 * ── Binding attributes (authored in the component's HTML template) ──────────
 *   data-bind="path"          textContent  ← get(data, path)
 *   data-bind-html="path"     innerHTML     ← get(data, path)   (trusted HTML)
 *   data-bind-attr="a:pA; b:pB"  set attribute a = get(data, pA), …
 *                             A value of null/undefined/false REMOVES the attr;
 *                             `true` sets a boolean (empty) attribute.
 *   data-bind-class="path"    space-joined class list appended to the node
 *   data-bind-if="path"       node is removed when get(data, path) is falsy
 *   data-bind-each="path"     the node's own child <template> is cloned+bound
 *                             once per array item (item becomes the scope)
 *
 * `path` is a dotted accessor: "user.name", "items", "0.label". A leading "@"
 * means "the current scope itself" (useful inside data-bind-each over strings).
 *
 * All data-bind* attributes are stripped from the output so the DOM stays clean.
 */

export type TemplateData = Record<string, unknown> | unknown[] | string | number | boolean | null;

/** Resolve a dotted path against a scope. "@" (or "") returns the scope itself. */
function get(scope: unknown, path: string): unknown {
  if (path === '' || path === '@') return scope;
  let cur: unknown = scope;
  for (const key of path.split('.')) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Parse a "a:pathA; b:pathB" attr-binding spec into [attr, path] pairs. */
function parseAttrSpec(spec: string): Array<[string, string]> {
  return spec
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(':');
      return idx === -1
        ? ([pair.trim(), pair.trim()] as [string, string])
        : ([pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()] as [string, string]);
    });
}

/** Apply all data-bind* markers on a single element against a scope. */
function applyBindings(el: Element, scope: unknown): void {
  // data-bind-if — drop the node entirely when falsy.
  const ifPath = el.getAttribute('data-bind-if');
  if (ifPath !== null) {
    el.removeAttribute('data-bind-if');
    if (!get(scope, ifPath)) {
      el.remove();
      return;
    }
  }

  // data-bind — textContent.
  const textPath = el.getAttribute('data-bind');
  if (textPath !== null) {
    el.removeAttribute('data-bind');
    const v = get(scope, textPath);
    el.textContent = v == null ? '' : String(v);
  }

  // data-bind-html — innerHTML (trusted precompiled markup).
  const htmlPath = el.getAttribute('data-bind-html');
  if (htmlPath !== null) {
    el.removeAttribute('data-bind-html');
    const v = get(scope, htmlPath);
    el.innerHTML = v == null ? '' : String(v);
  }

  // data-bind-attr — arbitrary attributes.
  const attrSpec = el.getAttribute('data-bind-attr');
  if (attrSpec !== null) {
    el.removeAttribute('data-bind-attr');
    for (const [attr, path] of parseAttrSpec(attrSpec)) {
      const v = get(scope, path);
      if (v == null || v === false) el.removeAttribute(attr);
      else if (v === true) el.setAttribute(attr, '');
      else el.setAttribute(attr, String(v));
    }
  }

  // data-bind-class — append class tokens.
  const classPath = el.getAttribute('data-bind-class');
  if (classPath !== null) {
    el.removeAttribute('data-bind-class');
    const v = get(scope, classPath);
    if (v) String(v).split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
  }
}

/**
 * Recursively bind a subtree against a scope. `data-bind-each` short-circuits
 * normal child recursion: the element's inner <template> is cloned once per
 * array item and appended, each bound with the item as its scope.
 */
function bindNode(el: Element, scope: unknown): void {
  const eachPath = el.getAttribute('data-bind-each');
  if (eachPath !== null) {
    el.removeAttribute('data-bind-each');
    // Own bindings (on the container) still apply against the outer scope.
    applyBindings(el, scope);
    const proto = el.querySelector(':scope > template') as HTMLTemplateElement | null;
    const list = get(scope, eachPath);
    // Clear any authoring placeholder content, keep the prototype out of output.
    el.replaceChildren();
    if (proto && Array.isArray(list)) {
      for (const item of list) {
        const frag = proto.content.cloneNode(true) as DocumentFragment;
        for (const child of Array.from(frag.children)) bindNode(child, item);
        el.appendChild(frag);
      }
    }
    return;
  }

  applyBindings(el, scope);
  // The node may have been removed by data-bind-if.
  if (!el.isConnected && !el.parentNode) return;
  for (const child of Array.from(el.children)) bindNode(child, scope);
}

/**
 * Bind a data object against a <template> and return the rendered fragment.
 * The template is not mutated (its content is cloned).
 */
export function renderTemplate(template: HTMLTemplateElement, data: TemplateData): DocumentFragment {
  const frag = template.content.cloneNode(true) as DocumentFragment;
  for (const child of Array.from(frag.children)) bindNode(child, data);
  return frag;
}

/**
 * Precompiled-HTML fast path: parse an HTML string into a fragment with no
 * binding walk. Use when the caller already has final markup.
 */
export function bindHtml(html: string): DocumentFragment {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return tpl.content.cloneNode(true) as DocumentFragment;
}

/** True when the input looks like a precompiled HTML string rather than data. */
export function isHtmlString(input: unknown): input is string {
  return typeof input === 'string' && /<[a-z][\s\S]*>/i.test(input);
}

/* ── Data-shape detection (drives the unified populate() dispatcher) ─────────
 *
 * A component is populated with one of two *kinds*:
 *
 *   'template'   — a precompiled HTML string, injected as-is.
 *   'collection' — structured data. An array is the 1-D case; a keyed JSON
 *                  definition ({rows, columns} / {steps} / {nodes}) is the
 *                  structured case; a single object is the 1-item case. All
 *                  three flow through the component's data renderer.
 *
 * A caller may declare the kind explicitly (`populate('collection', data)`)
 * or omit it and let `detectKind()` sniff the value (`populate(data)`). Within
 * a collection, `collectionShape()` reports whether the payload is a bare
 * array, a keyed definition, or a single record — a hint the renderer can use.
 */
export type PopulateKind = 'template' | 'collection';
export type CollectionShape = 'array' | 'keyed' | 'record';

/**
 * The property names that mark a plain object as a *keyed* collection — a JSON
 * definition that structures data into key-values (rows/columns/nodes/steps/…)
 * — rather than a single flat record to bind to one template.
 */
export const COLLECTION_KEYS: readonly string[] = [
  'rows',
  'columns',
  'nodes',
  'edges',
  'steps',
  'items',
  'options',
  'sections',
  'series',
  'data',
];

/** True when a plain object carries at least one recognised collection key. */
export function isKeyedCollection(input: unknown): input is Record<string, unknown> {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return false;
  const obj = input as Record<string, unknown>;
  return COLLECTION_KEYS.some((k) => k in obj);
}

/**
 * Infer the populate kind from an untyped value. Total — always returns a kind.
 * Everything that is not a precompiled HTML string is a collection (an array is
 * a 1-D collection; an object is a keyed or single-record collection).
 */
export function detectKind(input: unknown): PopulateKind {
  return isHtmlString(input) ? 'template' : 'collection';
}

/** Report the shape of a collection payload: bare array, keyed definition, or single record. */
export function collectionShape(input: unknown): CollectionShape {
  if (Array.isArray(input)) return 'array';
  if (isKeyedCollection(input)) return 'keyed';
  return 'record';
}
