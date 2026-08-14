/**
 * token-resolver.mjs — resolve a def token to a Figma variable, SCOPE-CHECKED.
 *
 * The def→Figma compiler binds tokens to Figma vars. This resolver refuses a
 * bind whose Figma property does not match the variable's scope — so the
 * original bug (a border var bound as a surface fill) can never recur through
 * the pipeline. Scope is the guardrail; this enforces it at bind time.
 *
 * A def token declares WHERE it is used via the property it targets; the
 * variable declares WHERE it MAY be used via its scopes. They must agree.
 */
import { roleFromScopes } from './scope-rules.mjs';

/** Figma property → the scope(s) a bound variable MUST include. */
const PROPERTY_SCOPE = {
  // paint bindings
  fill:   ['FRAME_FILL', 'SHAPE_FILL', 'ALL_FILLS'],
  stroke: ['STROKE_COLOR'],
  text:   ['TEXT_FILL'],
  effectColor: ['EFFECT_COLOR'],
  // numeric bindings
  cornerRadius: ['CORNER_RADIUS'],
  strokeWeight: ['STROKE_FLOAT'],
  gap:     ['GAP'],
  padding: ['GAP'],
  size:    ['WIDTH_HEIGHT'],
  fontSize:   ['FONT_SIZE'],
  fontWeight: ['FONT_WEIGHT'],
};

/** ALL_SCOPES / empty = open palette; usable anywhere (a scoped token should be preferred). */
function isOpen(scopes) {
  return !scopes || scopes.length === 0 || scopes.includes('ALL_SCOPES');
}

/**
 * May a variable with `scopes` bind to Figma `property`?
 * Open-scope vars are allowed (palette) but flagged; scoped vars must overlap.
 */
export function scopeAllows(property, scopes) {
  const want = PROPERTY_SCOPE[property];
  if (!want) return { ok: true, warn: `unknown property "${property}" — not scope-checked` };
  if (isOpen(scopes)) return { ok: true, warn: `binding an OPEN palette var to ${property}; prefer a scoped token` };
  const overlap = scopes.some((s) => want.includes(s));
  if (overlap) return { ok: true };
  return {
    ok: false,
    error: `SCOPE MISMATCH: cannot bind a [${scopes.join(',')}] variable to ${property} ` +
      `(role=${roleFromScopes(scopes)}; ${property} needs ${want.join('|')}). ` +
      `This is the fill/border class of bug — pick a ${property}-scoped token.`,
  };
}

/**
 * Resolve + scope-check. `lookup(name)` returns { id, scopes } for a Figma var
 * (or throws). `property` is the Figma property being bound.
 * Throws on a scope mismatch; returns { id, warn? } on success.
 */
export function resolveChecked(varName, property, lookup) {
  const v = lookup(varName); // { id, scopes }
  const verdict = scopeAllows(property, v.scopes || []);
  if (!verdict.ok) throw new Error(`${verdict.error}  [var: ${varName}]`);
  return { id: v.id, name: varName, warn: verdict.warn };
}

/** The token-block property → Figma bind property, for the def `tokens` map. */
export const TOKEN_PROPERTY = {
  background: 'fill', surface: 'fill', fill: 'fill',
  borderColor: 'stroke', border: 'stroke',
  color: 'text',
  borderRadius: 'cornerRadius', borderWidth: 'strokeWeight',
  gap: 'gap', paddingBlock: 'padding', paddingInline: 'padding',
  fontSize: 'fontSize', fontWeight: 'fontWeight', size: 'size',
};
