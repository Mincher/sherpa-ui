#!/usr/bin/env node
/**
 * audit-bindings.mjs — the value→variable resolution rules for "every property
 * uses a variable if a relevant one exists". Shared by the Figma-side audit/fix
 * pass and documented as the enforcement standard.
 *
 * This module is the SOURCE OF TRUTH for how a hardcoded pixel value maps to the
 * correct design-system token. The Figma pass (figma_execute) mirrors these maps.
 *
 * THE RULE: a component's geometry properties (gap, padding, radius, stroke-width)
 * MUST bind the token that RESOLVES to their value — never a raw number. Bind the
 * component's own scoped token where one exists (Button::button-space/*,
 * Container::container-space/*); else the Core scale below.
 *
 * SAFETY RULES (learned — a naive value-match over-binds ~13×):
 *  - Map by RESOLVED pixel value, not by a name regex (semantic tokens are aliased;
 *    space/sm doesn't literally equal 12 in its own row — it resolves to 12).
 *  - Bind stroke-width ONLY on a node that actually HAS a stroke paint (a
 *    strokeWeight on a strokeless layout frame is noise — never bind it).
 *  - Skip OFF-SCALE values (radius 1, radius 5 have no token — leave them; they are
 *    a scale gap or intentional, not a binding failure).
 *  - Never touch INSTANCE internals — they inherit bindings from their main component.
 */

/** Resolved pixel value → Core token name. */
export const SPACE = {
  2: 'space/3xs', 4: 'space/2xs', 8: 'space/xs', 12: 'space/sm', 16: 'space/base',
  20: 'space/lg', 24: 'space/xl', 32: 'space/2xl', 40: 'space/3xl', 48: 'space/4xl',
  56: 'space/5xl', 64: 'space/6xl',
};
export const RADIUS = {
  2: 'border/rounding/sm', 4: 'border/rounding/base', 8: 'border/rounding/lg',
  16: 'border/rounding/xl', 24: 'border/rounding/2xl', 999: 'border/rounding/full',
};
export const STROKE_WIDTH = {
  0.5: 'border/width/sm', 1: 'border/width/base', 2: 'border/width/lg',
};

/** Figma property → { category, table }. */
export const PROP_MAP = {
  itemSpacing: ['space', SPACE], paddingLeft: ['space', SPACE], paddingRight: ['space', SPACE],
  paddingTop: ['space', SPACE], paddingBottom: ['space', SPACE],
  topLeftRadius: ['radius', RADIUS], topRightRadius: ['radius', RADIUS],
  bottomLeftRadius: ['radius', RADIUS], bottomRightRadius: ['radius', RADIUS],
  strokeTopWeight: ['stroke', STROKE_WIDTH], strokeBottomWeight: ['stroke', STROKE_WIDTH],
  strokeLeftWeight: ['stroke', STROKE_WIDTH], strokeRightWeight: ['stroke', STROKE_WIDTH],
};

/** Resolve a hardcoded value on a property to a Core token name, or null. */
export function tokenForValue(prop, value) {
  const entry = PROP_MAP[prop];
  if (!entry) return null;
  const [, table] = entry;
  return table[value] ?? null;
}

/** Should this property, with this value, on this node, be bound? (safety rules) */
export function shouldBind({ prop, value, hasStroke, isInstance, alreadyBound }) {
  if (isInstance || alreadyBound) return false;
  if (typeof value !== 'number' || value <= 0) return false;
  const cat = PROP_MAP[prop]?.[0];
  if (!cat) return false;
  if (cat === 'stroke' && !hasStroke) return false; // never bind stroke-width on a strokeless node
  return tokenForValue(prop, value) != null;        // skip off-scale values
}
