/**
 * scope-rules.mjs — the single source of truth for Figma variable scopes.
 *
 * Derives the correct `variable.scopes` from a variable's tier, name, and role.
 * These rules were CORRECTED against the live Figma file after a human review
 * (the author fixed the machine's first pass). The corrections are the whole
 * point — encode them so the resolver, the ontology, and any re-scope agree.
 *
 * Corrections captured (machine-first-pass → human-corrected):
 *   1. content/* → NOT text-only. Content colours ink icons (shapes) too:
 *      SHAPE_FILL + STROKE_COLOR + TEXT_FILL.
 *   2. space/* (Core scale) → GAP + WIDTH_HEIGHT. Spacing sizes things, not just gaps.
 *   3. status/<s>/color N ramp steps → ALL_SCOPES. The palette stays OPEN; the
 *      CONSUMING var (status-surface / status-border) carries the tight scope,
 *      not the ramp step. Do NOT propagate consumer scope onto the palette.
 *   4. app/* → per-role, name does NOT reveal it (ontology case):
 *        app/primary = STROKE_COLOR, app/secondary = FILL, app/tertiary = open.
 *   5. data-viz/* series colours → FRAME_FILL + SHAPE_FILL + STROKE_COLOR (fill +
 *      stroke marks), NO text.
 *   6. Core::color/* ramps are FULLY PERMISSIVE (ALL_SCOPES) — like Primitives,
 *      they are reference ramps that semantic tokens alias FROM; they are never
 *      bound directly, so they stay open. (An earlier pass usage-scoped some
 *      steps; that was a mistake and was reset to permissive.)
 *   7. A `*-border/*` var is ALWAYS a stroke, even when the name also contains a
 *      fill word like "accent" (control-border/accent = STROKE, not fill). The
 *      border/stroke check must win over the surface/accent check — order it first.
 *   8. Style::content/* (semantic ramp) = TEXT_FILL only; component `*-content/*`
 *      inks icons too (broad); a `*-content/track` is really a surface → DEFER.
 *
 * THE DEEP RULE: scope follows USAGE, not the name's segments. Rules cover the
 * common cases; the ontology (usage graph + human) is the authority for the rest.
 * `deriveScopes` returns `DEFER` for vars whose scope only usage can decide.
 */

export const SCOPE = {
  FILL: ['FRAME_FILL', 'SHAPE_FILL'],
  STROKE: ['STROKE_COLOR'],
  TEXT: ['TEXT_FILL'],                                 // semantic content ramp (text only)
  CONTENT: ['SHAPE_FILL', 'STROKE_COLOR', 'TEXT_FILL'], // component content (inks icons too)
  EFFECT_COLOR: ['EFFECT_COLOR'],
  CHART: ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],  // correction #5
  PERMISSIVE: ['ALL_SCOPES'],
  SPACE: ['GAP', 'WIDTH_HEIGHT'],                       // correction #2
  GAP: ['GAP'],
  SIZE: ['WIDTH_HEIGHT'],
  CORNER: ['CORNER_RADIUS'],
  STROKE_FLOAT: ['STROKE_FLOAT'],
  FONT_SIZE: ['FONT_SIZE'],
  FONT_WEIGHT: ['FONT_WEIGHT'],
  LINE_HEIGHT: ['LINE_HEIGHT'],
  OPACITY: ['OPACITY'],
  EFFECT_FLOAT: ['EFFECT_FLOAT'],
};

/** Explicit per-name overrides where the name hides the role (correction #4). */
const NAME_OVERRIDES = {
  'app/primary': SCOPE.STROKE,
  'app/secondary': SCOPE.FILL,
  'app/tertiary': SCOPE.PERMISSIVE,
};

/** Sentinel: scope is decided by USAGE (the ontology/human), not by rule. */
export const DEFER = 'DEFER';

/** Reference ramps → fully permissive: Primitives AND Core::color/* (#6). */
export function isReferenceRamp(collName, name) {
  return collName === 'Primitives' || (collName === 'Core' && /^color\//.test(name.toLowerCase()));
}

/**
 * Derive scopes for a variable. Returns:
 *   - an array of scope strings (a confident rule), or
 *   - SCOPE.PERMISSIVE for Primitives, or
 *   - DEFER  → do not touch; usage/ontology owns this scope (#6), or
 *   - null   → BOOLEAN/STRING/unmatched: leave as-is.
 */
export function deriveScopes(v) {
  const { name, resolvedType: t, collection } = v;
  const n = name.toLowerCase();

  if (isReferenceRamp(collection, name)) return SCOPE.PERMISSIVE; // #6 — fully open
  if (NAME_OVERRIDES[n]) return NAME_OVERRIDES[n];

  // correction #3: status/<s>/color N and data-viz palette steps stay OPEN.
  if (/^status\/\w+\/color \d+$/.test(n)) return SCOPE.PERMISSIVE;
  if (/^data-viz\//.test(n)) return SCOPE.CHART; // #5 — fills+strokes for marks

  if (t === 'COLOR') {
    // #7: a *-border/* var is ALWAYS a stroke — even "control-border/accent".
    // This MUST precede the surface/accent check below.
    if (/(^|\/)(border|stroke|divider|outline)(\/|$|-|$)/.test(n) || /-border\//.test(n)) return SCOPE.STROKE;
    // SEMANTIC content ramp (Style::content/*) is TEXT ONLY (correction #1 refined).
    if (collection === 'Style (Sherpa)' && /^content\//.test(n)) return SCOPE.TEXT;
    // COMPONENT content (control-content, status-content…) inks icons too → broad.
    // But a "content" that is really a surface (switch-content/track) is misnamed →
    // DEFER to usage rather than guess.
    if (/-content\/track/.test(n)) return DEFER;
    if (/(^|\/)(content|text|label|heading|title|ink|on-color|link)(\/|$|-)/.test(n)) return SCOPE.CONTENT;
    if (/(^|\/)(surface|fill|background|bg|track|knob|thumb|accent|swatch)(\/|$|-)/.test(n)) return SCOPE.FILL;
    if (/(^|\/)(shadow|effect|elevation)(\/|$|-)/.test(n)) return SCOPE.EFFECT_COLOR;
    return null; // genuinely ambiguous → ontology decides, leave as-is for now
  }

  if (t === 'FLOAT') {
    if (/(radius|rounding|corner)/.test(n)) return SCOPE.CORNER;
    if (/(width|weight)/.test(n) && /(border|stroke)/.test(n)) return SCOPE.STROKE_FLOAT;
    if (/(^|\/)space\//.test(n)) return SCOPE.SPACE;   // #2
    if (/gap/.test(n)) return SCOPE.GAP;
    if (/(padding|inset)/.test(n)) return SCOPE.GAP;
    if (/(size|icon|thumb|track|width|height|dimension|columns)/.test(n)) return SCOPE.SIZE;
    if (/scale|font.*size/.test(n)) return SCOPE.FONT_SIZE;
    if (/weight/.test(n)) return SCOPE.FONT_WEIGHT;
    if (/line-height|leading/.test(n)) return SCOPE.LINE_HEIGHT;
    if (/opacity|alpha/.test(n)) return SCOPE.OPACITY;
    if (/elevation\/(blur|offset|spread)/.test(n)) return SCOPE.EFFECT_FLOAT;
    return null;
  }
  return null;
}

/** Which token ROLE a scope set represents (for the resolver + ontology). */
export function roleFromScopes(scopes) {
  const s = (scopes || []).join('+');
  if (s === 'ALL_SCOPES' || s === '') return 'open';
  if (/STROKE_COLOR/.test(s) && !/FILL|TEXT/.test(s)) return 'border';
  if (/TEXT_FILL/.test(s)) return 'content';
  if (/FRAME_FILL|SHAPE_FILL/.test(s) && /STROKE_COLOR/.test(s)) return 'chart';
  if (/FRAME_FILL|SHAPE_FILL/.test(s)) return 'surface';
  if (/GAP/.test(s) || /WIDTH_HEIGHT/.test(s)) return 'space';
  if (/CORNER_RADIUS/.test(s)) return 'radius';
  if (/EFFECT/.test(s)) return 'effect';
  return 'other';
}
