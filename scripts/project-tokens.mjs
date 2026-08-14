/**
 * project-tokens.mjs — project the canonical Figma DTCG export into Sherpa's
 * CSS token layer.
 *
 * Source of truth: src/styles/tokens/figma.tokens.json (written by
 * figma_export_tokens, format:dtcg, scope:file — the full 28-collection dump).
 *
 * This is the collection-AWARE projection. Figma has many mode axes, but only a
 * few are *document-global* CSS mechanisms; the rest are component-scoped and are
 * consumed inside each component's own CSS as :host([data-*]) rules. So the global
 * token layer (tokens.css) carries exactly:
 *
 *   • Primitives + Core   → the value layer, emitted flat into :root
 *   • Style (Sherpa) light → the semantic layer, emitted into :root
 *   • Style (Sherpa) dark  → the same vars re-pointed, emitted into
 *                            :root[data-mode="dark"] AND a
 *                            @media (prefers-color-scheme: dark) block guarded by
 *                            :not([data-mode="light"]) — the reforged themes.css
 *                            contract (explicit choice beats OS; OS beats default).
 *
 * Component-scoped collections (Button sizes, Control/Container/Input/Navigation/
 * Switch/Status/Badge/Elevation/Layout/Grouping/Color Sets/Data Viz/Typography and
 * their extensions) are NOT projected globally — they stay in figma.tokens.json and
 * are wired per-component. Projecting them into [data-theme="<mode>"] would collide
 * ("secondary" means Control-secondary AND Container-secondary) and break the
 * shadow-DOM :host model.
 *
 *   node scripts/project-tokens.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src/styles/tokens/figma.tokens.json');
const OUT = join(ROOT, 'src/styles/tokens/tokens.css');
const PREFIX = 'sherpa-';

/** Collections whose PRIMARY (or only) mode feeds the global :root value/semantic layer. */
const GLOBAL_COLLECTIONS = new Set(['primitives', 'core', 'style-sherpa']);
/** The one collection that also contributes a dark-mode override block. */
const DARK_COLLECTION = 'style-sherpa';

const doc = JSON.parse(readFileSync(SRC, 'utf8'));

/**
 * Normalise DTCG path segments into a single CSS-identifier tail. Figma names
 * carry spaces ("color 1"), arrows ("blue green -> pink"), and the DTCG writer's
 * "@" leaf-conflict marker — all must collapse to hyphens, identically for both
 * emitted var NAMES and resolved REFERENCES, or the two sides won't match.
 */
function toIdent(segs) {
  return segs
    .filter((s) => s !== '@')
    .join('-')
    .replace(/->/g, '-') // arrow separators
    .replace(/[^a-zA-Z0-9-]+/g, '-') // spaces & any other non-ident char
    .replace(/-+/g, '-') // collapse runs
    .replace(/^-|-$/g, '') // trim edges
    .toLowerCase();
}

/** {a.b.c} reference → var(--sherpa-a-b-c). Literal hex/number → CSS value. */
function toCss(value, type) {
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    let segs = value.slice(1, -1).split('.');
    // style-sherpa self-refs address the semantic layer, which we emit WITHOUT
    // the collection segment — drop it so the reference resolves.
    if (segs[0] === 'style-sherpa') segs = segs.slice(1);
    return `var(--${PREFIX}${toIdent(segs)})`;
  }
  // literal
  if (typeof value === 'number') {
    // dimensions/space/size get px; unitless numbers (line-height, weight, opacity, z) stay bare
    const unitless = type === 'number' || type === 'fontWeight';
    return unitless ? String(value) : `${value}px`;
  }
  return String(value); // hex colours, font families, strings
}

/** Walk one collection subtree, yielding { name, value, darkValue } leaves. */
function* leaves(node, path = []) {
  if (node && typeof node === 'object' && '$value' in node) {
    const name = `--${PREFIX}${toIdent(path)}`;
    const ext = node.$extensions?.['figma-console-mcp'] ?? {};
    const darkRef = ext.modes?.dark;
    yield {
      name,
      value: toCss(node.$value, node.$type),
      dark: darkRef != null ? toCss(darkRef, node.$type) : null,
    };
    return;
  }
  for (const k of Object.keys(node ?? {})) {
    if (k.startsWith('$')) continue;
    yield* leaves(node[k], [...path, k]);
  }
}

// ── collect ──────────────────────────────────────────────────────────
const rootLines = [];
const darkLines = [];

for (const collKey of GLOBAL_COLLECTIONS) {
  const coll = doc[collKey];
  if (!coll) continue;
  // Path base per collection:
  //  • primitives / core → keep the collection segment (--sherpa-core-color-…),
  //    so references like {core.color.neutral.0} resolve to the same name.
  //  • style-sherpa → DROP it. This is THE semantic layer components alias into;
  //    its tokens are --sherpa-content-title-base, not --sherpa-style-sherpa-…
  //    (nothing references style-sherpa vars by dot-path, so no chain breaks).
  const base = collKey === DARK_COLLECTION ? [] : [collKey];
  for (const leaf of leaves(coll, base)) {
    rootLines.push(`  ${leaf.name}: ${leaf.value};`);
    if (collKey === DARK_COLLECTION && leaf.dark) {
      darkLines.push(`  ${leaf.name}: ${leaf.dark};`);
    }
  }
}

// ── status cascade ───────────────────────────────────────────────────
// The Status collection has 4 vars (surface/border/content/shadow), each carrying
// a value PER status mode (info/critical/warning/urgent/success + passthrough).
// Project them into the CLAUDE.md [data-status] cascade: an ancestor data-status
// emits --_status-* custom props that inherit through shadow boundaries.
const STATUS_MODES = ['info', 'critical', 'warning', 'urgent', 'success'];
const statusColl = doc.status;
const statusBlocks = [];
if (statusColl) {
  // gather the collection's leaves once; each leaf's ext.modes holds per-status refs
  const statusVars = [];
  for (const k of Object.keys(statusColl)) {
    if (k.startsWith('$')) continue;
    for (const leaf of leaves(statusColl[k], [])) {
      // leaf.name is --sherpa-<...>; recover the DTCG node to read per-mode modes
      statusVars.push({ key: k, path: leaf.name });
    }
  }
  // Map the Figma Status structure onto the CLAUDE.md cascade vocabulary the
  // reforged components actually read: --_status-{surface,surface-strong,border,text}.
  // (Figma splits content/surface into many sub-roles; components consume a compact set.)
  const ROLE_MAP = {
    'status-surface-default': '_status-surface-strong', // the filled status surface
    'status-surface-hover': '_status-surface',
    'status-border-default': '_status-border',
    'status-content-title': '_status-text', // the primary status ink
  };
  function collectStatus(node, path, out) {
    if (node && typeof node === 'object' && '$value' in node) {
      const ext = node.$extensions?.['figma-console-mcp'] ?? {};
      out.push({ figmaRole: toIdent(path), modes: ext.modes ?? {}, primary: node.$value });
      return;
    }
    for (const k of Object.keys(node ?? {})) {
      if (k.startsWith('$')) continue;
      collectStatus(node[k], [...path, k], out);
    }
  }
  const roles = [];
  collectStatus(statusColl, [], roles);
  for (const mode of STATUS_MODES) {
    const lines = roles
      .filter((r) => ROLE_MAP[r.figmaRole] && r.modes[mode] != null)
      .map((r) => `  --${ROLE_MAP[r.figmaRole]}: ${toCss(r.modes[mode])};`);
    if (lines.length) {
      statusBlocks.push(`[data-status="${mode}"] {\n${lines.join('\n')}\n}`);
    }
  }
}

// ── convenience aliases ──────────────────────────────────────────────
// Stable public names components consume that don't map 1:1 to a single Figma var:
//  • font families (Typography collection is text-style-driven, not a flat token)
//  • composed box-shadows (Figma elevation = 5 separate offset/blur/spread/tint vars)
//  • data-viz categorical series hues (the JS→CSS bridge in charts reads these)
// Each is sourced from the projected Figma vars where one exists.
const aliasLines = [
  '  --sherpa-font-family-body: "Inter", system-ui, sans-serif;',
  '  --sherpa-font-family-mono: ui-monospace, "JetBrains Mono", monospace;',
  '  --sherpa-shadow-sm: var(--sherpa-elevation-offset-x-small, 0) var(--sherpa-elevation-offset-y-small, 1px) var(--sherpa-elevation-blur-small, 2px) var(--sherpa-elevation-spread-small, 0) var(--sherpa-elevation-tint, #372f4f33);',
  '  --sherpa-shadow-md: var(--sherpa-elevation-offset-x-base, 0) var(--sherpa-elevation-offset-y-base, 4px) var(--sherpa-elevation-blur-base, 12px) var(--sherpa-elevation-spread-base, 0) var(--sherpa-elevation-tint, #372f4f33);',
  '  --sherpa-shadow-lg: var(--sherpa-elevation-offset-x-large, 0) var(--sherpa-elevation-offset-y-large, 12px) var(--sherpa-elevation-blur-large, 32px) var(--sherpa-elevation-spread-large, 0) var(--sherpa-elevation-tint, #372f4f33);',
];
for (let i = 1; i <= 11; i++) {
  aliasLines.push(`  --sherpa-categorical-${i}: var(--sherpa-data-viz-categorical-color-${i});`);
}

// ── emit ─────────────────────────────────────────────────────────────
const header = `/**
 * tokens.css — Sherpa's global token layer, PROJECTED from Figma.
 *
 * Generated by scripts/project-tokens.mjs from figma.tokens.json (the canonical
 * DTCG export). DO NOT EDIT BY HAND — edit in Figma, re-export, re-project.
 *
 * Load once in the document; the resolved --sherpa-* values inherit into every
 * component shadow root. Primitives + Core are the value layer; Style (Sherpa) is
 * the semantic layer components alias into. Dark mode re-points the semantic vars
 * only — components stay mode-agnostic.
 */`;

const css = `${header}
:root {
${rootLines.join('\n')}

  /* convenience aliases — stable public names (see project-tokens.mjs) */
${aliasLines.join('\n')}
}

/* Dark mode: explicit choice wins. */
:root[data-mode="dark"] {
${darkLines.join('\n')}
}

/* Dark mode: follow the OS unless an explicit light choice overrides it. */
@media (prefers-color-scheme: dark) {
  :root:not([data-mode="light"]) {
${darkLines.join('\n')}
  }
}

/* Status cascade — an ancestor [data-status] emits --_status-* to shadow roots. */
${statusBlocks.join('\n\n')}
`;

writeFileSync(OUT, css);
console.log(
  `✓ projected ${rootLines.length} vars (${darkLines.length} dark, ${aliasLines.length} aliases, ${statusBlocks.length} status blocks) → src/styles/tokens/tokens.css`,
);
