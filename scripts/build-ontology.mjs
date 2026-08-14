#!/usr/bin/env node
/**
 * build-ontology.mjs — generate the token ontology from the variable graph.
 *
 * Reads:
 *   scripts/figma-data/variable-graph.json  — {id: {t,s,a,cb}} semantic vars
 *   scripts/lib/scope-rules.mjs              — role derivation (verified vs live)
 *
 * Emits docs/ontology/tokens.json — one entry per variable:
 *   { id, kind, tier, resolvedType, role, scope, purpose, whenToUse, whenNOT,
 *     aliasedFrom, consumedBy, modes, seeAlso }
 *
 * Prose (purpose/whenToUse/whenNOT) is TEMPLATED from role + tier + consumer —
 * grounded in the usage graph, not invented. Entries needing human prose are
 * flagged `"needsReview": true` (the ambiguous / opaque-name cases).
 *
 * Covers ALL 908 vars including Primitives (tier: foundation). Primitives are a
 * bindable foundation layer on both sides — bind them where no semantic token
 * fits (e.g. border/radius/150 = 3px, a gap in the Core scale). They are NOT
 * excluded as "reference-only".
 *
 * Usage: node scripts/build-ontology.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roleFromScopes } from './lib/scope-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const graph = JSON.parse(readFileSync(join(ROOT, 'scripts/figma-data/variable-graph.json'), 'utf8'));
const DRY = process.argv.includes('--dry');

const TYPE = { C: 'COLOR', F: 'FLOAT', COLOR: 'COLOR', FLOAT: 'FLOAT' };

// tier from the collection name
function tierOf(coll) {
  if (coll === 'Primitives') return 'foundation'; // bindable foundation layer (both sides)
  if (coll === 'Core') return 'core';
  if (coll === 'Style (Sherpa)') return 'style';
  if (['Control','Container','Status','Button','Switch','Input','Navigation','Badge','Calendar Day','Calendar Month','Calendar Year'].includes(coll)) return 'component';
  if (['Elevation','Layout (Grid)','Snapping','Color Sets','Data Viz','Typography','Saturated','Border Only','compact','comfortable','hero','brand','monospaced'].includes(coll)) return 'override';
  return 'other';
}

// role: TYPOGRAPHY first (its scope is ALL_SCOPES/WIDTH_HEIGHT which misleads the
// scope-derived role → 'palette'/'space'); then scope-derived; then name fallback.
function roleOf(id, entry) {
  const [coll, rawName] = id.split('::');
  const n = rawName.toLowerCase();
  // Typography collection + any *-font/* var + text-numeric names = the 'type' role.
  if (coll === 'Typography' || /-font\//.test(n) ||
      /(^|\/)(font-size|line-height|letter-spacing|paragraph|family|weight|leading)(\/|$)/.test(n)) {
    return 'type';
  }
  const scopeRole = roleFromScopes((entry.s || '').split(',').filter(Boolean));
  if (scopeRole !== 'open' && scopeRole !== 'other') return scopeRole;
  // Name fallback — order matters: radius/scale before the generic 'border' word,
  // so 'border/radius/150' is a radius and 'scale/400' is a space.
  if (/radius|rounding|corner/.test(n)) return 'radius';
  if (/(^|\/)(scale|space|gap|padding)(\/|$)/.test(n)) return 'space';
  if (/shadow|elevation|blur|offset|spread|effects\//.test(n)) return 'effect';
  if (/surface|fill|background|track|knob|thumb/.test(n)) return 'surface';
  if (/(border|stroke|divider)/.test(n)) return 'border';
  if (/content|text|label|heading|title|ink|link/.test(n)) return 'content';
  if (/size|icon|width|height/.test(n)) return 'size';
  return 'palette'; // colour ramp step (color/*, status/color N, data-viz) — a palette
}

const ROLE_PROSE = {
  surface:  { p: 'A background fill', use: 'As the surface behind an element.', not: 'Never as a border (use a border token) or text.' },
  border:   { p: 'A border / stroke colour', use: 'As the stroke of an element — or the FILL of a hairline divider / track / chart segment.', not: 'Not for a filled surface behind content, and not for text.' },
  content:  { p: 'Ink for text or an icon', use: 'As text colour, or to ink an icon glyph.', not: 'Never as a surface fill behind content.' },
  radius:   { p: 'A corner radius', use: 'As border-radius.', not: 'Not a spacing value.' },
  space:    { p: 'A spacing step', use: 'As a gap, padding, or size.', not: 'Not a colour or radius.' },
  size:     { p: 'A dimension', use: 'As width / height.', not: 'Not a gap between items.' },
  effect:   { p: 'A shadow / effect value', use: 'In a drop-shadow or blur.', not: 'Not a fill or stroke colour.' },
  type:     { p: 'A typography value (size / weight / family / spacing)', use: 'On a text node — via a text style.', not: 'Not a colour, gap, or radius.' },
  palette:  { p: 'A palette step (open scope)', use: 'A semantic colour a scoped token aliases; usable across fill/stroke/text.', not: 'Prefer the scoped token (e.g. status-surface) over binding a raw palette step directly.' },
};

function proseFor(role, tier, entry) {
  const base = ROLE_PROSE[role] || ROLE_PROSE.palette;
  const consumer = (entry.cb || [])[0];
  let purpose = base.p + '.';
  if (consumer) purpose = `${base.p} — consumed by \`${consumer}\`.`;
  return { purpose, whenToUse: base.use, whenNOT: base.not };
}

/**
 * CAVEATS — per-token gotchas learned from real build defects (see
 * docs/DEF-TO-FIGMA-BUILD-RULES.md). Keyed by exact var id or a name regex.
 * Surfaced by explain_token so the next build avoids the trap.
 */
const CAVEATS = [
  {
    match: /^Status::status-content\//,
    text: 'DO NOT bind a control label (button/tag text) to this directly — under a status pin it resolves to the ON-COLOR (light) ink meant for text on a SATURATED fill. A secondary/tertiary control has a LIGHT surface, so the text vanishes (the sherpa-button secondary-in-status bug). Bind a control-aware content token that flips with the look tier instead.',
  },
  {
    match: /^Status::status-surface\//,
    text: 'A CONTAINER should bind its own container-surface/* (which aliases through Status), not this directly — only CONTROLS bind status-surface, because status IS their surface. Binding status-surface on a container bypasses the container semantics.',
  },
  {
    match: /^Control::control-content\/inverse$/,
    text: 'Flips with the Control look tier: on-color (light) ink on a filled primary surface; dark ink on a light secondary/tertiary surface. This is the token a control label should use so text stays readable under any tier + status.',
  },
];
function caveatFor(id) {
  for (const c of CAVEATS) if (c.match.test(id)) return c.text;
  return null;
}

// seeAlso: same group, adjacent role (a border's sibling surface, etc.)
function seeAlsoFor(id, all) {
  const [coll, name] = id.split('::');
  const group = name.replace(/\/(default|hover|down|base|primary|secondary|on-color.*)$/, '');
  const sibs = Object.keys(all).filter(k => k !== id && k.startsWith(coll + '::' + group)).slice(0, 4);
  return sibs;
}

const out = {};
let needsReview = 0;
for (const [id, entry] of Object.entries(graph)) {
  const [coll] = id.split('::');
  const tier = tierOf(coll);
  const role = roleOf(id, entry);
  const prose = proseFor(role, tier, entry);
  // opaque names with no consumer + open scope → human prose
  const opaque = role === 'palette' && (entry.cb || []).length === 0;
  if (opaque) needsReview++;
  const caveat = caveatFor(id);
  out[id] = {
    id, kind: 'variable', tier, resolvedType: TYPE[entry.t] || entry.t,
    role, scope: (entry.s || '').split(',').filter(Boolean),
    purpose: prose.purpose, whenToUse: prose.whenToUse, whenNOT: prose.whenNOT,
    aliasedFrom: entry.a, consumedBy: entry.cb || [],
    seeAlso: seeAlsoFor(id, graph),
    ...(caveat ? { caveat } : {}),
    ...(opaque ? { needsReview: true } : {}),
  };
}

const dir = join(ROOT, 'docs/ontology');
if (!DRY) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'tokens.json'), JSON.stringify(out, null, 2) + '\n'); }
// role distribution
const dist = {};
for (const e of Object.values(out)) dist[e.role] = (dist[e.role] || 0) + 1;
console.log(`ontology entries: ${Object.keys(out).length}`);
console.log('roles:', JSON.stringify(dist));
console.log('needsReview (opaque, no consumer):', needsReview);
if (DRY) console.log('(dry-run — not written)');
