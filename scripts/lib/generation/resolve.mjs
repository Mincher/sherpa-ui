/**
 * resolve.mjs — the resolution primitives every generation tool shares.
 * "Which token for this value?" · "What role is this token?" · "Can this bind here?"
 * Thin wrappers over the encoded rule modules (scope-rules, audit-bindings).
 */
import { tokenForValue as _tokenForValue, shouldBind, PROP_MAP } from '../../audit-bindings.mjs';
import { roleFromScopes, deriveScopes } from '../scope-rules.mjs';

/** Which Core token should a hardcoded PROPERTY=VALUE bind to? (null if off-scale.) */
export function tokenForValue(property, value) {
  return _tokenForValue(property, value);
}
export { shouldBind, PROP_MAP };

/* `roleForToken` and `explainToken` lived here and are GONE (2026-09-17).
   Both read the ontology, which was deleted 2026-09-16 for having rotted, so
   both returned `null` for every input — and their callers read that null as
   "this token is wrong". A function that can only answer null is not a
   degraded answer, it is a trap. Token NAMES are checked against the generated
   `tokens.css` instead (`loadCssTokenNames`); ROLE and SCOPE have no source. */

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
