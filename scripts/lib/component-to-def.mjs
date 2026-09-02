/**
 * component-to-def.mjs — pure adapter: DTCG-dialect *.component.yaml spec → `def`.
 *
 * The round-trip guard needs to feed the new component spec through the EXISTING
 * pure compiler (scripts/lib/generation/compile-def.mjs :: compileDef), which
 * consumes a `def` object of a specific shape. This adapter maps the spec's
 * $-keyed, {ref}-carrying grammar onto that `def` shape — nothing more. It reads
 * nothing, writes nothing: a pure `specToDef(spec) → def`.
 *
 * Mapping (what compileDef actually reads — see its source):
 *   spec.$name                → def.name
 *   spec.$description          → def.description
 *   spec.anatomy.root          → def.anatomy.root  (node tree: el/class/part/attrs/
 *                                slot/component/showWhen/children — same shape)
 *   spec.templates             → def.templates
 *   spec.props[]               → def.props[]  (drop $type; keep name/kind/type/
 *                                values/default/template). observed = kind!=='style';
 *                                template prop = kind==='template'.
 *   spec.events[]              → def.events[]  ({name})
 *   spec.tokens {el.prop:{ref}}→ def.tokens {el.prop: <compileDef token form>}
 *                                (a plain alias string, or {override,fallback})
 *   spec.behaviours (if any)   → def.behaviours
 *   spec.docs (if any)         → def.docs
 *
 * The spec does NOT carry the hand-written .ts body or the hand-written CSS state
 * rules — compileDef doesn't emit those either, so the adapter has nothing to map
 * there. That residue is the guard's declared "cannot round-trip" surface.
 */

// ── {ref} → the token form compileDef's tokenVar() expects ─────────────────────
// tokenVar(t): string  t          → `var(--sherpa-${t})`
//              {override,fallback} → `var(--_${override}, var(--sherpa-${fallback}))`
//
// The spec writes refs as `{sherpa.<alias>}` (a --sherpa-* alias) or
// `{switch.<group>.<leaf>}` (a component-scoped --sherpa-switch-* var, projected
// from the token file's `switch` group). Both resolve to a --sherpa-* custom
// property, so both map to the PLAIN-STRING form of tokenVar, carrying only the
// part after the `--sherpa-` prefix.
export function refToToken(ref) {
  if (typeof ref !== 'string') return ref;
  const m = /^\{(.+)\}$/.exec(ref.trim());
  if (!m) return ref; // already a literal value
  const path = m[1];
  const dot = path.indexOf('.');
  const ns = dot === -1 ? '' : path.slice(0, dot);
  const rest = dot === -1 ? path : path.slice(dot + 1);

  if (ns === 'sherpa') {
    // {sherpa.theme-gap-sm} → 'theme-gap-sm' → var(--sherpa-theme-gap-sm)
    return rest;
  }
  // {switch.switch-size.width} → scoped var --sherpa-switch-size-width.
  // Namespace + dotted leaf, dots → hyphens: 'switch-size.width' → 'switch-size-width'.
  // (The `switch` namespace is implied by the --sherpa-switch-* prefix already in
  // the leaf path, so we only flatten dots.)
  return rest.replace(/\./g, '-');
}

// ── props: strip $type, keep the fields compileDef reads ───────────────────────
// compileDef reads: p.kind (observed = kind!=='style'; template prop = kind==='template'
// and p.template), p.name. It also reads p.kind==='visibility' + p.name for CSS.
function specPropToDef(p) {
  const out = { name: p.name };
  if ('type' in p) out.type = p.type;
  if ('kind' in p) out.kind = p.kind;
  if ('values' in p) out.values = p.values;
  if ('default' in p) out.default = p.default;
  if ('template' in p) out.template = p.template;
  if ('description' in p) out.description = p.description;
  return out;
}

/**
 * Pure `spec → def`. Maps a parsed *.component.yaml object onto the `def` shape
 * that compileDef(def) consumes.
 * @param {object} spec — the parsed DTCG-dialect component spec.
 * @returns {object} def — ready for compileDef().
 */
export function specToDef(spec) {
  const def = {
    name: spec.$name,
    description: spec.$description ?? '',
  };

  if (spec.anatomy?.root) def.anatomy = { root: spec.anatomy.root };
  if (Array.isArray(spec.templates)) def.templates = spec.templates;

  // A native attr with no reactive `kind` (e.g. `disabled`) is styled entirely by
  // CSS (:host([disabled])) and read live via a getter — it is NOT in
  // observedAttributes and produces nothing in compileDef. Drop it so the
  // generated `observed` list matches the real component (which observes only its
  // data-* content/visibility props). This is faithful, not a fudge: compileDef
  // has genuinely nothing to emit for such a prop.
  def.props = (spec.props ?? [])
    .filter((p) => !(p.native === true && !p.kind))
    .map(specPropToDef);
  def.events = (spec.events ?? []).map((e) => {
    const ev = { name: e.name };
    if ('description' in e) ev.description = e.description;
    return ev;
  });

  // tokens: el.prop → compileDef token form
  def.tokens = {};
  for (const [key, ref] of Object.entries(spec.tokens ?? {})) {
    def.tokens[key] = refToToken(ref);
  }

  if (spec.behaviours) def.behaviours = spec.behaviours;
  if (spec.docs) def.docs = spec.docs;

  return def;
}
