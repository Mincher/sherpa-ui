/**
 * resolve.mjs — the resolution primitives every generation tool shares.
 * "Which token for this value?" · "What role is this token?" · "Can this bind here?"
 * Thin wrappers over the encoded rule modules (scope-rules, audit-bindings).
 */
import { tokenForValue as _tokenForValue, shouldBind, PROP_MAP } from '../../audit-bindings.mjs';
import { roleFromScopes, deriveScopes } from '../scope-rules.mjs';
import { loadOntology } from './data.mjs';

/** Which Core token should a hardcoded PROPERTY=VALUE bind to? (null if off-scale.) */
export function tokenForValue(property, value) {
  return _tokenForValue(property, value);
}
export { shouldBind, PROP_MAP };

/** The ontology role for a token id ("Collection::name"), or derived from scopes. */
export function roleForToken(id) {
  const ont = loadOntology();
  if (ont[id]) return ont[id].role;
  return null;
}

/** Full ontology entry for a token id (purpose, whenNOT, caveat, …). */
export function explainToken(id) {
  return loadOntology()[id] ?? null;
}

/** Figma property → the scope(s) a bound variable MUST include. */
const PROPERTY_SCOPE = {
  fill: ['FRAME_FILL', 'SHAPE_FILL', 'ALL_FILLS'],
  stroke: ['STROKE_COLOR'],
  text: ['TEXT_FILL'],
  cornerRadius: ['CORNER_RADIUS'],
  strokeWeight: ['STROKE_FLOAT'],
  gap: ['GAP'], padding: ['GAP'], size: ['WIDTH_HEIGHT'],
};

/** May a token (by its scopes) bind to a Figma property? {ok, error?, warn?} */
export function scopeAllows(property, scopes) {
  const want = PROPERTY_SCOPE[property];
  if (!want) return { ok: true, warn: `property "${property}" is not scope-checked` };
  const open = !scopes || scopes.length === 0 || scopes.includes('ALL_SCOPES');
  if (open) return { ok: true, warn: `open-scope var bound to ${property}; prefer a scoped token` };
  if (scopes.some((s) => want.includes(s))) return { ok: true };
  return {
    ok: false,
    error: `SCOPE MISMATCH: a [${scopes.join(',')}] var (role=${roleFromScopes(scopes)}) cannot bind ${property} (needs ${want.join('|')})`,
  };
}

export { roleFromScopes, deriveScopes };
