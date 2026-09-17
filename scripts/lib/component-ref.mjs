/**
 * component-ref.mjs — the ONE shared {ref} resolver (plan §1.3).
 *
 * DTCG-style refs are `{path.to.thing}`. A component spec, its variant→tier
 * bindings, and its state→token links all use this same grammar — the single
 * seam shared with the token file. This resolver can walk BOTH:
 *
 *   • a component spec object (dot-path into the parsed *.component.yaml)
 *   • the token DTCG (dot-path into figma.tokens.json, unwrapping DTCG $value)
 *
 * Pure + importable. Neither the token pipeline nor the component pipeline
 * imports the other; they touch ONLY through this {ref} syntax.
 */

/** Is `s` a {ref} string? */
export function isRef(s) {
  return typeof s === 'string' && /^\{[^}]+\}$/.test(s);
}

/** "{a.b.c}" → "a.b.c"; a bare "a.b.c" → "a.b.c" (idempotent). */
function refPath(ref) {
  if (typeof ref !== 'string') throw new TypeError(`ref must be a string, got ${typeof ref}`);
  const m = /^\{([^}]+)\}$/.exec(ref.trim());
  return m ? m[1] : ref.trim();
}

/**
 * Walk a dot-path into a plain object. Returns the value at the path, or
 * `undefined` if any segment is missing. Does NOT unwrap DTCG.
 */
function walkPath(root, path) {
  const parts = String(path).split('.');
  let node = root;
  for (const p of parts) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[p];
  }
  return node;
}

/**
 * Resolve a {ref} against a component spec object. Returns the value the path
 * points at (a sub-object, an array, or a scalar), or undefined.
 *
 *   resolveComponentRef(spec, "{props}")          → the props array
 *   resolveComponentRef(spec, "{$extensions.sherpa.figmaName}") → "Switch"
 */
function resolveComponentRef(spec, ref) {
  return walkPath(spec, refPath(ref));
}

/**
 * Resolve a {ref} against the token DTCG (figma.tokens.json).
 *
 * By default returns the DTCG $value at the path (the token's value, which may
 * itself be a nested {ref} into the token file). Pass { unwrap:false } to get
 * the raw DTCG node ({ $value, $type, … }).
 *
 * The `{sherpa.*}` namespace is NOT a token-file path: those refs name a
 * --sherpa-* semantic alias consumed with a hardcoded fallback in component
 * CSS. resolveTokenRef leaves them for resolveRef to route (returns undefined).
 */
function resolveTokenRef(tokens, ref, { unwrap = true } = {}) {
  const path = refPath(ref);
  if (path.startsWith('sherpa.')) return undefined; // alias namespace, not a token path
  const node = walkPath(tokens, path);
  if (node == null) return undefined;
  if (unwrap && node && typeof node === 'object' && '$value' in node) return node.$value;
  return node;
}

/**
 * The unified entry point. Given a {ref} and both files, route it:
 *   • {sherpa.NAME}  → a --sherpa-NAME CSS alias   → { kind:'alias', name, css }
 *   • {$…} / spec key that exists in the spec       → { kind:'component', value }
 *   • otherwise a token path                        → { kind:'token', value }
 *   • unresolvable                                  → { kind:'unresolved' }
 *
 * `opts.spec` and/or `opts.tokens` may be omitted; the resolver only tries the
 * files it was given.
 */
export function resolveRef(ref, { spec, tokens } = {}) {
  const path = refPath(ref);

  // {sherpa.foo-bar} → the --sherpa-foo-bar alias (component CSS consumes it
  // with a hardcoded fallback; there's nothing to look up in a data file).
  if (path.startsWith('sherpa.')) {
    const name = path.slice('sherpa.'.length);
    return { kind: 'alias', name, css: `--sherpa-${name}` };
  }

  // A ref that begins with $ (or names a top-level spec block) is a component
  // ref — resolve against the spec first when one is supplied.
  if (spec) {
    const first = path.split('.')[0];
    const looksComponent = first.startsWith('$') || first in spec;
    if (looksComponent) {
      const value = walkPath(spec, path);
      if (value !== undefined) return { kind: 'component', value };
    }
  }

  // Otherwise a token-file path.
  if (tokens) {
    const value = resolveTokenRef(tokens, ref);
    if (value !== undefined) return { kind: 'token', value };
  }

  return { kind: 'unresolved', path };
}

/**
 * Fully resolve a token ref, following {ref} chains inside the token file to a
 * terminal value (a hex, a number, a keyword). Guards against cycles. Aliases
 * ({sherpa.*}) are terminal — returned as { alias } — since they're a CSS seam,
 * not a token value.
 */
function resolveTokenChain(tokens, ref, seen = new Set()) {
  const path = refPath(ref);
  if (path.startsWith('sherpa.')) return { alias: path.slice('sherpa.'.length) };
  if (seen.has(path)) throw new Error(`cyclic token ref: ${[...seen, path].join(' → ')}`);
  seen.add(path);
  const value = resolveTokenRef(tokens, ref);
  if (value === undefined) return { unresolved: path };
  if (isRef(value)) return resolveTokenChain(tokens, value, seen);
  return { value };
}
