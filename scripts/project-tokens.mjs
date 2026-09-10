/**
 * project-tokens.mjs — project the canonical Figma DTCG export into Sherpa's CSS.
 *
 * DATA-DRIVEN rewrite (2026-09-02). Structure is derived from the dump, not from
 * hand-typed atom maps. The ONLY hand-config is the small ROUTING table below,
 * which maps each Figma collection slug → where it lands (a global @layer, or a
 * component-scoped partial) plus a couple of hints. Everything else — modes,
 * primary mode, leaf paths, scopes — is read from each leaf's
 * `$extensions["figma-console-mcp"]`.
 *
 * Sources of truth:
 *   src/styles/tokens/figma.tokens.json      — the DTCG dump (25 collections).
 *   src/styles/tokens/figma.extensions.json  — resolved values for the 11 EXTENSION
 *                                              collections that carry NO leaves in the
 *                                              dump (hero/mono, style-transparent/
 *                                              saturated, structure-snap-*, display-
 *                                              compact/comfortable). Read live from
 *                                              Figma and cached here.
 *
 * Output layering mirrors Figma's aliasing tiers as cascade layers:
 *   @layer core      — display[light/dark] ramp resolved to :root (+ dark re-point),
 *                      plus the sizing/geometry collections (structure, grid, …).
 *   @layer style     — the big semantic `theme` layer (surface/border/content/…).
 *   @layer overrides — status cascade, elevation, snap, density, categorical, view.
 *   @layer components — each scoped component's own <comp>.tokens.css partial.
 *
 * Primitives are reference-only: any ref into `primitives.*` is inlined to its
 * literal, so the Primitives collection is never emitted.
 *
 *   node scripts/project-tokens.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src/styles/tokens/figma.tokens.json');
const EXT = join(ROOT, 'src/styles/tokens/figma.extensions.json');
const OUT = join(ROOT, 'src/styles/tokens/tokens.css');
const COMPONENTS = join(ROOT, 'src/components');
const PREFIX = 'sherpa-';

// The projected scoped-token block is inlined at the TOP of <comp>.css between
// these sentinels (one .css per component — no separate <comp>.tokens.css). The
// writer splices the region in place, so hand-authored CSS below it is preserved.
const TOKENS_MARK_START = '/* == sherpa:tokens (generated — do not edit) == */';
const TOKENS_MARK_END = '/* == end sherpa:tokens == */';

/** Splice `region` (already wrapped in the sentinels) into a component's .css. */
function spliceTokenRegion(existing, region) {
  const start = existing.indexOf(TOKENS_MARK_START);
  const end = existing.indexOf(TOKENS_MARK_END);
  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + TOKENS_MARK_END.length);
    return before + region + after;
  }
  // No region yet — prepend it, then the existing file (one blank line between).
  return region + '\n\n' + existing.replace(/^\n+/, '');
}

const doc = JSON.parse(readFileSync(SRC, 'utf8'));
const extDoc = existsSync(EXT) ? JSON.parse(readFileSync(EXT, 'utf8')) : {};

const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn('  ⚠ ' + msg);
};

// ──────────────────────────────────────────────────────────────────────────
// ROUTING — the ONLY hand-config. Each dump/extension collection slug maps to a
// target. Any collection present in the dump or extension cache but MISSING here
// is warned about, never silently dropped.
//
//   target 'core'     → resolved into @layer core :root (with dark re-point if the
//                       collection carries a light/dark mode axis).
//   target 'style'    → the semantic layer, @layer style :root.
//   target 'override' → @layer overrides. `attr` (if given) turns the collection's
//                       non-primary MODES into [attr="<mode>"] blocks; otherwise
//                       only the primary values are emitted.
//   target {scoped:'<comp-dir>', attr}
//                     → a component partial (<comp>/<comp>.tokens.css, @layer
//                       components). Non-primary modes become :host([attr="mode"]).
//   target 'skip'     → intentionally not emitted (empty/dead/handled elsewhere).
//
//   modeAxis:'light-dark' → this collection re-points in dark mode (dump `dark`
//                       override, or the display-{compact,comfortable} density exts).
// ──────────────────────────────────────────────────────────────────────────
// The cascade layer order — one @layer per Figma collection family, mirroring the
// design-system tiers (2026-09-07 re-alignment). Each named layer owns its base
// values PLUS its own mode/extension variation blocks:
//   core         — shared base geometry only (primitives stay INLINED as literals).
//   display-mode — the light/dark colour+scale ramp + its dark re-point + DENSITY
//                  ([data-density] compact/comfortable extensions of the same ramp).
//   theme        — the semantic surface/border/content/size/weight/font layer,
//                  scoped [data-theme="<name>"] (default also on :root) so a second
//                  named theme is just another block. + font atoms + text classes.
//   layout       — grid layout properties (Layout Grid) + the .sherpa-view utility.
//   structure    — bound sizes / content sizes / per-corner rounding for anchoring
//                  components + SNAP ([data-snap] per-edge rounding extensions).
//   style        — default + status styling ([data-status]) + look tiers ([data-look])
//                  + the categorical data-viz series (all "styling").
//   elevation    — shadow styling ([data-elevation]) + convenience shadow aliases.
//   components   — each component's own scoped partial (always last → last word).
const LAYER_ORDER = [
  'core',
  'display-mode',
  'theme',
  'layout',
  'structure',
  'style',
  'elevation',
  'components',
];

// ROUTING — the ONLY hand-config. `target` is either a LAYER NAME (global emit into
// that @layer), 'skip', or a {scoped} component partial. `modeAxis:'light-dark'` marks
// a collection that re-points in dark mode. `attr` turns a collection's non-primary
// MODES into [attr="mode"] blocks inside the same layer.
const ROUTING = {
  // Reference-only — never emitted (all refs into it are inlined to literals).
  primitives: { target: 'skip' },

  // The light/dark colour + scale ramp → @layer display-mode (its dark re-point +
  // density extensions live in the same layer).
  // NB collection slug is 'display-mode' since the 2026-09-09 re-export (was 'display').
  'display-mode': { target: 'display-mode', modeAxis: 'light-dark' },

  // The big semantic layer (single mode `Sherpa`, 303 leaves) → @layer theme,
  // scoped [data-theme].
  theme: { target: 'theme' },

  // Shared control geometry → @layer structure. Also Button's primary consumer via
  // [data-size], so it is projected into the button partial with a name-remap onto
  // Button's public var contract; its primary values ALSO stay GLOBAL (@layer
  // structure) so other components (input/nav/container) consume the shared geometry.
  structure: {
    target: { scoped: 'sherpa-button', alsoGlobal: 'structure' },
    attr: 'data-size',
    // structure leaf path → the button public var name the component's CSS consumes.
    renameMap: {
      'structure/height': 'sherpa-button-size-height',
      'structure/icon-size': 'sherpa-button-size-icon',
      'structure/structure-font/size': 'sherpa-button-font-size',
      'structure/structure-font/line-height': 'sherpa-button-font-line-height',
      'structure/structure-space/gap': 'sherpa-button-space-gap',
      'structure/structure-space/padding': 'sherpa-button-space-padding',
    },
  },
  // NB collection slug is 'layout' since the 2026-09-09 re-export (was 'grid').
  layout: { target: 'layout', attr: null }, // primary feeds the .sherpa-view grid; breakpoints handled bespoke
  elevation: { target: 'elevation', attr: 'data-elevation' },

  // Status look (8 status modes) → @layer style. Primary values → global --sherpa-style-*
  // vars; the per-status [data-status] cascade is emitted bespoke as the --_status-*
  // contract components consume (see statusBlocks), so attr:null avoids a second,
  // redundant --sherpa-style-* mode cascade.
  style: { target: 'style', attr: null },

  // Typography folded into Theme's `content/` group (2026-09-07). The .sherpa-text-<mode>
  // utility classes + font atoms are emitted bespoke from doc.theme.content (size/
  // line-height/letter-spacing/weight/font), NOT a flat dump — see the typography block
  // below. No standalone `typography` collection any more.

  // Categorical / sequential / divergent series → @layer style (styling). Primary
  // (categorical) → the 11 public --sherpa-categorical-* names via a bespoke emit below.
  'data-viz': { target: 'style', attr: null },

  // Component-scoped collections. Emit each component's Figma collection into its
  // own partial; non-primary modes → :host([attr="mode"]).
  input: { target: { scoped: 'sherpa-input-text' }, attr: 'data-state' },
  navigation: { target: { scoped: 'sherpa-nav-item' }, attr: 'data-nav-state' },
  switch: { target: { scoped: 'sherpa-switch' }, attr: 'data-style' },

  // Extension-only collections (no leaves in the dump) — consumed from the cache.
  // (hero/mono collections deleted 2026-09-07 — families now in content/font/*.)
  'style-transparent': { target: 'skip' }, // → [data-look="transparent"] @layer style
  'style-saturated': { target: 'skip' }, // → [data-look="saturated"] @layer style
  'structure-snap-all-edges': { target: 'skip' }, // → [data-snap] @layer structure
  'structure-snap-right-edge': { target: 'skip' },
  'structure-snap-left-edge': { target: 'skip' },
  'structure-snap-top-edge': { target: 'skip' },
  'structure-snap-bottom-edge': { target: 'skip' },
  'display-mode-compact': { target: 'skip' }, // → [data-density="compact"] @layer display-mode
  'display-mode-comfortable': { target: 'skip' }, // → [data-density="comfortable"] @layer display-mode
  // The extension CACHE (figma.extensions.json) still uses the pre-rename slugs —
  // keep them routed so the density extensions resolve from the cache.
  'display-compact': { target: 'skip' },
  'display-comfortable': { target: 'skip' },

  // Empty in this dump (0 leaves) — kept as explicit skips so they don't warn.
  'layout-calendar-d': { target: 'skip' },
  'layout-calendar-m-y': { target: 'skip' },
  'layout-app-shell': { target: 'skip' },
};

// ── helpers (ported from the previous projector; sound) ─────────────────────

/** Normalise DTCG path segments into one CSS-identifier tail (names AND refs). */
function toIdent(segs) {
  return segs
    .filter((s) => s !== '@')
    .join('-')
    .replace(/->/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** A ref's leading collection segment is redundant when the leaf path repeats it. */
const REF_STRIP = new Set(['style-sherpa']);
function refName(ref) {
  let segs = ref.slice(1, -1).split('.');
  if (REF_STRIP.has(segs[0]) || (segs[1] && segs[1].startsWith(segs[0] + '-'))) segs = segs.slice(1);
  return `--${PREFIX}${toIdent(segs)}`;
}
const isRef = (v) => typeof v === 'string' && v.startsWith('{') && v.endsWith('}');
/** Cross-library refs the dump can't resolve (only appear in non-primary modes we skip). */
const isDeadRef = (v) => isRef(v) && v.includes('__library:');

/** literal → CSS value (px for dimensions, bare for unitless). */
function literal(value, type) {
  if (typeof value === 'number') {
    const unitless = type === 'number' || type === 'fontWeight';
    return unitless ? String(value) : `${value}px`;
  }
  return String(value);
}

// ── primitive resolution (so Primitives is reference-only) ──────────────────
const primLiteral = {};
(function walkPrim(node, path, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if ('$value' in node) {
    if (!isRef(node.$value)) primLiteral[path.join('.')] = literal(node.$value, node.$type);
    return;
  }
  for (const k of Object.keys(node)) {
    if (k.startsWith('$')) continue;
    walkPrim(node[k], [...path, k], seen);
  }
})(doc.primitives ?? {}, ['primitives']);

/** ref/literal → CSS value; refs into primitives are inlined to their literal. */
function toCss(value, type) {
  if (isRef(value)) {
    if (isDeadRef(value)) return null;
    const dotPath = value.slice(1, -1);
    if (dotPath.startsWith('primitives.') && primLiteral[dotPath] != null) return primLiteral[dotPath];
    return `var(${refName(value)})`;
  }
  return literal(value, type);
}

/** A leaf's public var name: drop a redundant repeated collection segment (e.g.
 * style/style-surface/base → --sherpa-style-surface-base) so emitted global names
 * match what refName() produces for refs pointing at the same leaf. */
function leafName(path) {
  let segs = path;
  if (segs[1] && segs[1].startsWith(segs[0] + '-')) segs = segs.slice(1);
  return `--${PREFIX}${toIdent(segs)}`;
}

/** Walk a collection subtree → structured leaves with modes + scopes (cycle-safe). */
function* walkLeaves(node, path = [], seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if ('$value' in node) {
    const ext = node.$extensions?.['figma-console-mcp'] ?? {};
    yield {
      path,
      name: leafName(path),
      rawPath: path.join('/'),
      value: node.$value,
      type: node.$type,
      modes: ext.modes ?? {},
      primaryMode: ext.primaryMode,
      scopes: ext.scopes ?? [],
    };
    return;
  }
  for (const k of Object.keys(node)) {
    if (k.startsWith('$')) continue;
    yield* walkLeaves(node[k], [...path, k], seen);
  }
}

// ── scope-aware validation ──────────────────────────────────────────────────
// scope → the CSS property it is expected to paint (from sherpa-token-dump-drift).
// We warn when a leaf's scope disagrees with the ref-family it resolves to (e.g. a
// STROKE_COLOR leaf pointing at a *surface* family, or a fill scope at a *border*
// family). Warnings only — no behaviour change.
const SCOPE_PROP = {
  SHAPE_FILL: 'background',
  FRAME_FILL: 'background',
  ALL_FILLS: 'background',
  TEXT_FILL: 'color',
  STROKE_COLOR: 'border-color',
  GAP: 'gap',
  CORNER_RADIUS: 'border-radius',
  WIDTH_HEIGHT: 'size',
  STROKE_FLOAT: 'border-width',
  EFFECT_COLOR: 'shadow',
  EFFECT_FLOAT: 'shadow',
};
function scopeCheck(leaf) {
  const s = leaf.scopes ?? [];
  if (!s.length || typeof leaf.value !== 'string' || !isRef(leaf.value)) return;
  const target = leaf.value.slice(1, -1).toLowerCase();
  const isStroke = s.includes('STROKE_COLOR');
  const isFill = s.includes('SHAPE_FILL') || s.includes('FRAME_FILL') || s.includes('ALL_FILLS');
  // A STROKE_COLOR that resolves through a *surface* family (not border) is suspect.
  if (isStroke && !isFill && /\.surface\./.test(target)) {
    warn(`scope mismatch: ${leaf.name} is STROKE_COLOR but resolves to a surface family (${target})`);
  }
  // A fill scope that resolves through a *border* family is suspect.
  if (isFill && !isStroke && /\.border\./.test(target)) {
    warn(`scope mismatch: ${leaf.name} is a fill scope but resolves to a border family (${target})`);
  }
  // A TEXT_FILL that resolves through a surface/border family (not a content family)
  // is suspect — the expected CSS property (SCOPE_PROP.TEXT_FILL = color) wants ink.
  if (s.includes('TEXT_FILL') && /\.(surface|border)\./.test(target) && !/\.content\./.test(target)) {
    warn(`scope mismatch: ${leaf.name} is TEXT_FILL (${SCOPE_PROP.TEXT_FILL}) but resolves to ${target}`);
  }
}

// ── @property registrations (modern, animatable custom props) ───────────────
// Register the interactive-surface seeds + snap radii as <color>/<length> so they
// animate and validate. Kept small — only props that genuinely benefit.
const propertyRegistrations = `  @property --sherpa-elevation-color {
    syntax: '<color>';
    inherits: true;
    initial-value: transparent;
  }`;

// ════════════════════════════════════════════════════════════════════════════
// Collect leaves per collection and route them.
// ════════════════════════════════════════════════════════════════════════════
// Per-layer buckets. Each named layer collects its own `root` (:root / primary lines),
// `rootDark` (light-dark re-point), and `modeBlocks` ([attr="mode"] strings). The
// bespoke sections (status/look/viz/snap/density/shadow/theme-scope/text) are slotted
// into their assigned layer at write time.
const GLOBAL_LAYERS = ['core', 'display-mode', 'theme', 'layout', 'structure', 'style', 'elevation'];
const layers = {};
for (const name of GLOBAL_LAYERS) layers[name] = { root: [], rootDark: [], modeBlocks: [] };
const scopedPartials = []; // { comp, css }

for (const slug of Object.keys(doc)) {
  if (slug.startsWith('$')) continue;
  const route = ROUTING[slug];
  if (!route) {
    warn(`unrouted dump collection "${slug}" — add it to ROUTING`);
    continue;
  }
  if (route.target === 'skip') continue;

  const leaves = [...walkLeaves(doc[slug], [slug])];
  for (const leaf of leaves) scopeCheck(leaf);

  // ── global target: `route.target` is a layer name ──
  if (typeof route.target === 'string' && layers[route.target]) {
    const L = layers[route.target];
    const byMode = {};
    for (const leaf of leaves) {
      if (typeof leaf.value === 'boolean') continue; // booleans are scoped visibility flags only
      const v = toCss(leaf.value, leaf.type);
      if (v == null) continue;
      L.root.push(`  ${leaf.name}: ${v};`);
      // light/dark re-point (display ramp) — into the SAME layer.
      if (route.modeAxis === 'light-dark' && leaf.modes.dark != null) {
        const dv = toCss(leaf.modes.dark, leaf.type);
        if (dv != null && dv !== v) L.rootDark.push(`  ${leaf.name}: ${dv};`);
      }
      // non-primary modes → [attr="mode"] blocks in the same layer.
      if (!route.attr) continue;
      for (const [mode, mval] of Object.entries(leaf.modes)) {
        const mv = toCss(mval, leaf.type);
        if (mv == null) continue;
        (byMode[mode] ??= []).push(`    ${leaf.name}: ${mv};`);
      }
    }
    for (const [mode, lines] of Object.entries(byMode)) {
      L.modeBlocks.push(`  [${route.attr}="${mode}"] {\n${lines.join('\n')}\n  }`);
    }
    continue;
  }

  // ── scoped target → a component partial (optionally also global) ──
  if (typeof route.target === 'object' && route.target.scoped) {
    // A collection can be BOTH a component's scoped source AND a shared global base
    // (structure): emit its primary values into its named layer so other components
    // can consume the geometry, then also emit the per-mode component partial.
    if (route.target.alsoGlobal && layers[route.target.alsoGlobal]) {
      for (const leaf of leaves) {
        if (typeof leaf.value === 'boolean') continue;
        const v = toCss(leaf.value, leaf.type);
        if (v == null) continue;
        // leaf.name already strips a redundant repeated collection segment
        // (structure/structure-rounding → --sherpa-structure-rounding-*) so the
        // global names match what [data-snap] and components consume.
        layers[route.target.alsoGlobal].root.push(`  ${leaf.name}: ${v};`);
      }
    }
    scopedPartials.push(
      buildScopedPartial(slug, route.target.scoped, route.attr, leaves, route.renameMap),
    );
    continue;
  }

  warn(`collection "${slug}" has an unrecognised routing target`);
}

// ── interactive states via color-mix (replaces the removed shade/tint hack) ──
// The new Figma model carries NO hover/down leaves — interactive states are DERIVED,
// not hand-picked ramp steps. For every emitted `theme.surface.<family>.base` seed we
// synthesise `-hover` and `-down` by mixing the seed toward `currentColor` (the text
// ink), which darkens on light grounds and lightens on dark grounds automatically —
// so one derivation is correct in both modes. Degrades to the seed on engines without
// color-mix. hover = 8% ink, down = 16% ink (mirrors the old shade-10/20 strengths).
const stateDerivations = [];
{
  const seenFam = new Set();
  for (const line of layers.theme.root) {
    const m = line.trim().match(/^(--sherpa-theme-surface-[a-z]+-base):/);
    if (!m) continue;
    const seed = m[1];
    const fam = seed.match(/surface-([a-z]+)-base/)[1];
    if (seenFam.has(fam)) continue;
    seenFam.add(fam);
    stateDerivations.push(
      `  --sherpa-theme-surface-${fam}-hover: color-mix(in oklab, var(${seed}) 92%, currentColor);`,
    );
    stateDerivations.push(
      `  --sherpa-theme-surface-${fam}-down: color-mix(in oklab, var(${seed}) 84%, currentColor);`,
    );
  }
}

// Extension collections that live ONLY in the cache — warn if the cache carries a
// collection ROUTING never mentions.
for (const slug of Object.keys(extDoc)) {
  if (!(slug in ROUTING)) warn(`extension cache collection "${slug}" is not in ROUTING`);
}

/**
 * A scoped component partial. Non-primary modes become :host([attr="mode"]). Boolean
 * mode-driven props become private `--_<flag>` visibility vars (true→revert-layer,
 * false→none) the component reads with `display: var(--_flag, …)` — visibility stays
 * in CSS, driven by the mode.
 */
function buildScopedPartial(slug, comp, attr, leaves, renameMap) {
  const primaryMode = leaves.find((l) => l.primaryMode)?.primaryMode ?? 'default';
  const rootVars = [];
  const byMode = {};
  // Boolean mode-driven props → private `--_<flag>` visibility vars using the
  // established `hasFoo → --_has-foo` / `isFoo → --_is-foo` convention (the leading
  // collection segment is dropped — the component consumes the bare flag name).
  const flagName = (path) =>
    '--_' +
    path[path.length - 1].replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  const vis = (b) => (b ? 'revert-layer' : 'none');
  for (const leaf of leaves) {
    const isBool = typeof leaf.value === 'boolean';
    // A renameMap (structure→button) maps a leaf's rawPath to the exact public var
    // the component's CSS consumes; leaves absent from the map are dropped (the
    // component only consumes the mapped subset).
    let name;
    if (renameMap) {
      const mapped = renameMap[leaf.rawPath];
      if (!mapped) continue;
      name = `--${PREFIX}${mapped.replace(/^sherpa-/, '')}`;
    } else {
      name = isBool ? flagName(leaf.path) : leaf.name;
    }
    const encode = (val) => (isBool ? vis(val) : toCss(val, leaf.type));
    const pv = encode(leaf.value);
    if (pv == null) continue;
    rootVars.push(`  ${name}: ${pv};`);
    for (const [mode, mval] of Object.entries(leaf.modes)) {
      if (mode === primaryMode) continue;
      const mv = encode(mval);
      if (mv == null) continue;
      (byMode[mode] ??= []).push(`  ${name}: ${mv};`);
    }
  }
  const modeBlocks = Object.entries(byMode).map(
    ([mode, lines]) => `:host([${attr}="${mode}"]) {\n${lines.join('\n')}\n}`,
  );
  // The scoped block is INLINED into <comp>.css inside a marked auto-regen region
  // (see spliceTokenRegion). The component's own [${attr}] re-points these per mode.
  const css = `${TOKENS_MARK_START}
/* Component-scoped token aliases, PROJECTED from Figma (the "${slug}" collection).
   DO NOT EDIT — edit in Figma, re-project. The component's own [${attr}] re-points
   these per mode. This region is regenerated by scripts/project-tokens.mjs. */
@layer components {
  :host {
${rootVars.map((l) => '  ' + l).join('\n')}
  }
${modeBlocks.length ? '\n' + modeBlocks.map((b) => b.replace(/^/gm, '  ')).join('\n\n') + '\n' : ''}}
${TOKENS_MARK_END}`;
  return { comp, css };
}

// ════════════════════════════════════════════════════════════════════════════
// Typography — REAL Figma modes (Figma wins). Emit one utility class per mode.
// ════════════════════════════════════════════════════════════════════════════
// The `typography` collection has ONE var per property (family, size, line-height,
// letter-spacing, paragraph-spacing) plus a SIX-var weight ramp (weight/{light,
// regular,medium,semibold,bold,black}). Each property var carries a per-MODE
// override map; the modes ARE the text sizes: base (primary), h1–h5, large, small,
// xs. Hero/Mono are family variants whose values live in the extension cache with
// the same mode shape.
//
// WEIGHT AXIS DECISION (documented): weight is a SEPARATE axis — the six weight
// sub-vars are identical across every mode (they're the shared weight ramp, not a
// per-mode value). So a mode does not dictate a weight on its own. We pick a
// sensible DEFAULT weight per mode class (headings h1–h5 → semibold; body base/
// large/small/xs → regular) so `.sherpa-text-<mode>` is a complete text style; a
// consumer overrides `font-weight` on the element to pick a different ramp step.
// Typography now lives INSIDE Theme as FLAT leaves under `content/` (2026-09-07 —
// the Typography/Hero/Mono collections were deleted; their SIZE modes were flattened
// into `content/size/<step>`, `content/line-height/<step>`, `content/letter-spacing/
// <step>`, plus the mode-independent `content/weight/<w>` ramp and `content/font/*`).
// There is no mode axis any more: each size STEP is its own var. We read those leaves
// into `typoBy` keyed by "<prop>/<step>" and expose the SAME typoVal(prop, mode)
// signature the emit code below expects — `mode` selects the step for size/line-height/
// letter-spacing; the weight ramp is step-independent (weight/<w> keys).
const typoLeaves = [...walkLeaves(doc.theme?.content ?? {}, ['content'])];
const typoBy = {}; // "size/h1" | "line-height/base" | "letter-spacing/xs" | "weight/regular" → { value, type }
for (const leaf of typoLeaves) {
  const key = leaf.path.slice(1).join('/'); // strip leading 'content'
  if (!/^(size|line-height|letter-spacing|weight|paragraph-spacing)(\/|$)/.test(key)) continue;
  typoBy[key] = { value: leaf.value, type: leaf.type };
}
const TYPO_MODES = ['base', 'h1', 'h2', 'h3', 'h4', 'h5', 'large', 'small', 'xs'];
const HEADING_MODES = new Set(['h1', 'h2', 'h3', 'h4', 'h5']);
const defaultWeightFor = (mode) => (HEADING_MODES.has(mode) ? 'semibold' : 'regular');

/**
 * Resolve a typography property at a given size step → CSS value.
 * `prop` is a per-step group ('size'|'line-height'|'letter-spacing') resolved as
 * `<prop>/<mode>`, or a fully-qualified step-independent key ('weight/regular',
 * 'paragraph-spacing') resolved as-is.
 */
function typoVal(prop, mode, type) {
  const key = prop.includes('/') || prop === 'paragraph-spacing' ? prop : `${prop}/${mode}`;
  const rec = typoBy[key];
  if (!rec) return null;
  return toCss(rec.value, type ?? rec.type);
}
/**
 * Hero/Mono no longer exist as collections — they were folded into `content/font/*`
 * and share body's sizes. Their text classes differ only by font-family (handled in
 * fontAtomLines below), so this always defers to the base typography value.
 */
function extTypoVal(_slug, _prop, _mode) {
  return null;
}

// Families: the base family is a var; hero uses the body font, mono uses the mono
// font (the extension cache did NOT capture the `family` override, and the task
// fixes these two by definition). Expose the two family atoms once.
const FONT_BODY = '"Inter", system-ui, sans-serif';
const FONT_MONO = 'ui-monospace, "JetBrains Mono", monospace';

function textClass(className, family, valueOf) {
  // valueOf(prop) → CSS value for size/line-height/letter-spacing.
  // `:where(.class)` = ZERO specificity: these are utilities, so any app/component rule
  // overrides them without a specificity fight.
  return `  :where(.${className}) {
    font-family: ${family};
    font-size: ${valueOf('size')};
    line-height: ${valueOf('line-height')};
    letter-spacing: ${valueOf('letter-spacing')};
    font-weight: ${valueOf('weight')};
  }`;
}

const textClassBlocks = [];
for (const mode of TYPO_MODES) {
  const wt = defaultWeightFor(mode);
  // body / brand
  textClassBlocks.push(
    textClass(`sherpa-text-${mode}`, `var(--sherpa-font-family-body, ${FONT_BODY})`, (p) =>
      p === 'weight' ? typoVal(`weight/${wt}`, mode) : typoVal(p, mode),
    ),
  );
  // hero (promo) — same sizes as body in this dump, body font family
  textClassBlocks.push(
    textClass(`sherpa-text-hero-${mode}`, `var(--sherpa-font-family-body, ${FONT_BODY})`, (p) =>
      p === 'weight'
        ? extTypoVal('hero', `weight/${wt}`, mode) ?? typoVal(`weight/${wt}`, mode)
        : extTypoVal('hero', p, mode) ?? typoVal(p, mode),
    ),
  );
  // mono — monospace family
  textClassBlocks.push(
    textClass(`sherpa-text-mono-${mode}`, `var(--sherpa-font-family-mono, ${FONT_MONO})`, (p) =>
      p === 'weight'
        ? extTypoVal('mono', `weight/${wt}`, mode) ?? typoVal(`weight/${wt}`, mode)
        : extTypoVal('mono', p, mode) ?? typoVal(p, mode),
    ),
  );
}

// Font atoms — the STABLE public names 44 component CSS files already consume. These
// are NOT invented: each is derived from a real typography mode / weight ramp step,
// so the values track Figma. (font-family, font-weight ramp, and the size subset the
// component layer references.) Kept as a compatibility bridge over the mode classes.
const fontAtomLines = [
  `  --sherpa-font-family-body: ${FONT_BODY};`,
  `  --sherpa-font-family-mono: ${FONT_MONO};`,
  `  --sherpa-font-weight-light: ${typoVal('weight/light', 'base')};`,
  `  --sherpa-font-weight-regular: ${typoVal('weight/regular', 'base')};`,
  `  --sherpa-font-weight-medium: ${typoVal('weight/medium', 'base')};`,
  `  --sherpa-font-weight-semibold: ${typoVal('weight/semibold', 'base')};`,
  `  --sherpa-font-weight-bold: ${typoVal('weight/bold', 'base')};`,
  `  --sherpa-font-weight-black: ${typoVal('weight/black', 'base')};`,
  `  --sherpa-font-size-body-large: ${typoVal('size', 'large')};`,
  `  --sherpa-font-size-body-base: ${typoVal('size', 'base')};`,
  `  --sherpa-font-size-body-small: ${typoVal('size', 'small')};`,
  `  --sherpa-font-size-body-xs: ${typoVal('size', 'xs')};`,
  `  --sherpa-font-size-heading-h1: ${typoVal('size', 'h1')};`,
  `  --sherpa-font-size-heading-h2: ${typoVal('size', 'h2')};`,
  `  --sherpa-font-size-heading-h3: ${typoVal('size', 'h3')};`,
  `  --sherpa-font-size-heading-h4: ${typoVal('size', 'h4')};`,
  `  --sherpa-font-size-heading-h5: ${typoVal('size', 'h5')};`,
];

// ════════════════════════════════════════════════════════════════════════════
// Categorical series — the 11 public --sherpa-categorical-* names.
// ════════════════════════════════════════════════════════════════════════════
// data-viz `series/1..11` primary mode = `categorical`; each resolves to a theme
// categorical colour. Emit the stable public names (consumed by charts).
const categoricalLines = [];
for (const leaf of walkLeaves(doc['data-viz'] ?? {}, ['data-viz'])) {
  const m = leaf.rawPath.match(/series\/(\d+)$/);
  if (!m) continue;
  const v = toCss(leaf.value, leaf.type);
  if (v != null) categoricalLines.push(`  --sherpa-categorical-${m[1]}: ${v};`);
}
categoricalLines.sort(
  (a, b) => Number(a.match(/-(\d+):/)[1]) - Number(b.match(/-(\d+):/)[1]),
);

// ════════════════════════════════════════════════════════════════════════════
// Status cascade — an ancestor [data-status] emits --_status-* to shadow roots.
// ════════════════════════════════════════════════════════════════════════════
// The `style` collection carries the 8 status modes. Map its roles to the public
// --_status-* cascade vars components consume via fallback chains.
const STATUS_MODES = ['info', 'critical', 'warning', 'urgent', 'success', 'active', 'inactive'];
const STATUS_ROLE_MAP = {
  'style-surface/base': '_status-surface',
  'style-surface/base +2': '_status-surface-strong',
  'style-border/base': '_status-border',
  'style-content/base': '_status-text',
  'style-content/inverse': '_status-text-on-color',
  'style-indicator/accent': '_status-icon',
};
const statusBlocks = [];
// Build a path → leaf lookup keyed to STATUS_ROLE_MAP keys ('style-surface/base' …).
const styleByKey = {};
for (const l of walkLeaves(doc.style ?? {}, ['style'])) {
  const key = l.path.slice(1).join('/'); // 'style-surface/base' etc
  styleByKey[key] = l;
}
for (const mode of STATUS_MODES) {
  const lines = [];
  for (const [key, publicVar] of Object.entries(STATUS_ROLE_MAP)) {
    const leaf = styleByKey[key];
    if (!leaf) continue;
    const raw = mode in leaf.modes ? leaf.modes[mode] : leaf.value;
    const v = toCss(raw, leaf.type);
    if (v != null) lines.push(`    --${publicVar}: ${v};`);
  }
  if (lines.length) statusBlocks.push(`  [data-status="${mode}"] {\n${lines.join('\n')}\n  }`);
}

// ════════════════════════════════════════════════════════════════════════════
// Look tiers — style-transparent / style-saturated (from the extension cache).
// ════════════════════════════════════════════════════════════════════════════
// SELECTOR CHOICE (documented): a component opts into a look tier with
// `[data-look="transparent"|"saturated"]`; that tier re-points the same status
// cascade vars, per status mode, so `[data-look][data-status]` composes. Values are
// literal hex from the cache (extension overrides don't serialise as refs).
const LOOK_ROLE_MAP = {
  'style-surface/base': '_status-surface',
  'style-surface/base +2': '_status-surface-strong',
  'style-border/base': '_status-border',
  'style-content/base': '_status-text',
  'style-content/inverse': '_status-text-on-color',
  'style-indicator/accent': '_status-icon',
};
const lookBlocks = [];
for (const look of ['transparent', 'saturated']) {
  const cache = extDoc[`style-${look}`]?.vars;
  if (!cache) {
    warn(`look tier "style-${look}" missing from extension cache`);
    continue;
  }
  const defaultMode = extDoc[`style-${look}`].defaultMode ?? 'default';
  const modes = new Set();
  for (const v of Object.values(cache)) for (const m of Object.keys(v)) modes.add(m);
  for (const mode of modes) {
    const status = mode === defaultMode ? null : mode; // 'default' look tier has no status
    const lines = [];
    for (const [key, publicVar] of Object.entries(LOOK_ROLE_MAP)) {
      const val = cache[key]?.[mode];
      if (val == null) continue;
      lines.push(`    --${publicVar}: ${val};`);
    }
    if (!lines.length) continue;
    const sel = status
      ? `  [data-look="${look}"][data-status="${status}"]`
      : `  [data-look="${look}"]`;
    lookBlocks.push(`${sel} {\n${lines.join('\n')}\n  }`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Snap — per-edge corner rounding ([data-snap]) from the extension cache.
// ════════════════════════════════════════════════════════════════════════════
// Each structure-snap-<edge> extension overrides the 4 structure-rounding corners.
// Emit one [data-snap="<edge>"] block re-pointing the 4 public corner radius vars
// (primary/`default` size step — the component's own size mode still applies to
// non-corner geometry). Edge slug 'all-edges' → 'all'.
const CORNER_VARS = {
  'structure-rounding/top-left': '--sherpa-structure-rounding-top-left',
  'structure-rounding/top-right': '--sherpa-structure-rounding-top-right',
  'structure-rounding/bottom-left': '--sherpa-structure-rounding-bottom-left',
  'structure-rounding/bottom-right': '--sherpa-structure-rounding-bottom-right',
};
const snapBlocks = [];
for (const slug of Object.keys(extDoc)) {
  const m = slug.match(/^structure-snap-(.+)$/);
  if (!m) continue;
  const edge = m[1] === 'all-edges' ? 'all' : m[1].replace(/-edge$/, '');
  const cache = extDoc[slug].vars;
  const lines = [];
  for (const [key, publicVar] of Object.entries(CORNER_VARS)) {
    const val = cache[key]?.default;
    if (val == null) continue;
    lines.push(`    ${publicVar}: ${literal(val, 'dimension')};`);
  }
  if (lines.length) snapBlocks.push(`  [data-snap="${edge}"] {\n${lines.join('\n')}\n  }`);
}

// ════════════════════════════════════════════════════════════════════════════
// Density — display-compact / display-comfortable ([data-density]).
// ════════════════════════════════════════════════════════════════════════════
// These are full 163-var light/dark ramps that OVERRIDE the display collection.
// Emit each as a [data-density="<name>"] block re-pointing every display var (light),
// plus a dark re-point nested under the mode + prefers-color-scheme. Names mirror
// the display leaf names exactly (same toIdent), so they shadow the core ramp.
function densityBlock(slug, name) {
  const cache = extDoc[slug]?.vars;
  if (!cache) {
    warn(`density "${slug}" missing from extension cache`);
    return { light: '', dark: '' };
  }
  const lightLines = [];
  const darkLines = [];
  for (const [rawPath, byMode] of Object.entries(cache)) {
    // Prefix must match the base ramp's var names — the collection slug is
    // 'display-mode' since the 2026-09-09 re-export (was 'display'), so density
    // overrides must shadow --sherpa-display-mode-* (not the old --sherpa-display-*).
    const cssName = `--${PREFIX}${toIdent(['display-mode', ...rawPath.split('/')])}`;
    // The extension cache stores bare values (no $type). The weight ramp must stay
    // unitless — `400px` is an invalid font-weight and silently voids every
    // `font-weight: var(--sherpa-…-weight-*)` under [data-density].
    const type = /(^|\/)weight\//.test(rawPath) ? 'fontWeight' : 'dimension';
    const lv = byMode.light;
    if (lv != null) lightLines.push(`    ${cssName}: ${literal(lv, type)};`);
    if (byMode.dark != null && byMode.dark !== byMode.light)
      darkLines.push(`      ${cssName}: ${literal(byMode.dark, type)};`);
  }
  return {
    light: `  [data-density="${name}"] {\n${lightLines.join('\n')}\n  }`,
    dark: darkLines.length
      ? `    [data-density="${name}"] {\n${darkLines.join('\n')}\n    }`
      : '',
  };
}
const densityCompact = densityBlock('display-compact', 'compact');
const densityComfortable = densityBlock('display-comfortable', 'comfortable');

// ════════════════════════════════════════════════════════════════════════════
// Elevation shadow convenience aliases (traceable to the elevation collection).
// ════════════════════════════════════════════════════════════════════════════
const shadowAliasLines = [
  '  --sherpa-shadow-sm: var(--sherpa-elevation-offset-x, 0) var(--sherpa-elevation-offset-y, 1px) var(--sherpa-elevation-blur, 2px) var(--sherpa-elevation-spread, 0) var(--sherpa-elevation-color, #15151e33);',
  '  --sherpa-shadow-md: var(--sherpa-elevation-offset-x, 0) var(--sherpa-elevation-offset-y, 4px) var(--sherpa-elevation-blur, 12px) var(--sherpa-elevation-spread, 0) var(--sherpa-elevation-color, #15151e33);',
  '  --sherpa-shadow-lg: var(--sherpa-elevation-offset-x, 0) var(--sherpa-elevation-offset-y, 12px) var(--sherpa-elevation-blur, 32px) var(--sherpa-elevation-spread, 0) var(--sherpa-elevation-color, #15151e33);',
];

// ════════════════════════════════════════════════════════════════════════════
// .sherpa-view frame utility — copied verbatim (consumed by src/core/render-view.ts).
// ════════════════════════════════════════════════════════════════════════════
const viewFrameBlock = `  .sherpa-view {
    --sherpa-view-nav-width: 240px;

    display: grid;
    grid-template-columns: var(--sherpa-view-nav-width) 1fr;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'nav header'
      'nav body';
    block-size: 100%;
    min-block-size: 100vh;
    background: var(--sherpa-app-primary, #ffffff);
    color: var(--sherpa-content-primary-base, #2e2e33);
  }
  .sherpa-view[data-nav-collapsed] {
    --sherpa-view-nav-width: 56px;
  }
  .sherpa-view > [data-region='nav'] {
    grid-area: nav;
    min-inline-size: 0;
    border-inline-end: var(--sherpa-core-border-width-base, 1px) solid
      var(--sherpa-border-primary, #d5d5d5);
    background: var(--sherpa-surface-primary-base, #ffffff);
    overflow: hidden;
  }
  .sherpa-view > [data-region='header'] {
    grid-area: header;
    border-block-end: var(--sherpa-core-border-width-base, 1px) solid
      var(--sherpa-border-primary, #d5d5d5);
  }
  .sherpa-view > [data-region='body'] {
    grid-area: body;
    min-block-size: 0;
    overflow: auto;
    padding: var(--sherpa-core-space-lg, 20px);
  }
  /* A view with no header region lets the body span both rows. */
  .sherpa-view:not(:has(> [data-region='header'])) {
    grid-template-areas:
      'nav body'
      'nav body';
  }`;

// ════════════════════════════════════════════════════════════════════════════
// Emit global tokens.css.
// ════════════════════════════════════════════════════════════════════════════
const header = `/**
 * tokens.css — Sherpa's global token layer, PROJECTED from Figma.
 *
 * Generated by scripts/project-tokens.mjs from figma.tokens.json (+ the extension
 * cache figma.extensions.json). DO NOT EDIT BY HAND — edit in Figma, re-export,
 * re-project. Load once in the document; the resolved --sherpa-* values inherit into
 * every component shadow root.
 *
 * Cascade layers mirror the Figma collection families (Primitives resolved away →
 * reference-only). Each layer owns its base values PLUS its own mode/extension blocks:
 *   core         — shared base geometry (primitives inlined as literals).
 *   display-mode — light/dark colour+scale ramp + dark re-point + density.
 *   theme        — semantic surface/border/content/size/weight/font, scoped [data-theme].
 *   layout       — grid layout properties + the .sherpa-view utility.
 *   structure    — bound sizes / content sizes / per-corner rounding + snap.
 *   style        — default + status ([data-status]) + look ([data-look]) + data-viz.
 *   elevation    — shadow styling ([data-elevation]).
 *   components   — each component's own scoped partial (last → last word).
 */
@layer ${LAYER_ORDER.join(', ')};

${propertyRegistrations}`;

// ── small emit helpers ──────────────────────────────────────────────────────
/** A :root block for a layer's primary lines (skips empty). */
const rootBlock = (lines) => (lines.length ? `  :root {\n${lines.join('\n')}\n  }` : '');
/** The standard light/dark re-point pair for a layer's dark lines. */
const darkBlocks = (darkLines) =>
  darkLines.length
    ? `
  /* Dark mode: explicit choice wins. */
  :root[data-mode="dark"] {
${darkLines.join('\n')}
  }

  /* Dark mode: follow the OS unless an explicit light choice overrides it. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-mode="light"]) {
${darkLines.map((l) => '  ' + l).join('\n')}
    }
  }`
    : '';
const joinBlocks = (arr) => arr.filter(Boolean).join('\n\n');

// ── per-layer bodies ─────────────────────────────────────────────────────────
// core — shared base geometry only.
const coreLayer = `@layer core {
${rootBlock(layers.core.root)}
}`;

// display-mode — the ramp (light) + dark re-point + density ([data-density]).
const displayModeLayer = `@layer display-mode {
${rootBlock(layers['display-mode'].root)}
${darkBlocks(layers['display-mode'].rootDark)}

  /* Density — [data-density] overrides the ramp (light). */
${densityCompact.light}

${densityComfortable.light}

  /* Density dark re-points. */
  :root[data-mode="dark"] {
${densityCompact.dark}
${densityComfortable.dark}
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-mode="light"]) {
${densityCompact.dark.replace(/^/gm, '  ')}
${densityComfortable.dark.replace(/^/gm, '  ')}
    }
  }
}`;

// theme — semantic layer, scoped [data-theme="sherpa"] (default also on :root so a
// document with no data-theme still resolves). Font atoms + interactive-state
// derivations + text-role classes ride here. A second named theme is just another
// [data-theme="<name>"] block.
const themeVars = [
  ...layers.theme.root,
  '',
  '    /* typography atoms — derived from Figma content/* (see projector) */',
  ...fontAtomLines,
  '',
  '    /* interactive states — color-mix derivations */',
  ...stateDerivations,
];
const themeLayer = `@layer theme {
  :root,
  [data-theme="sherpa"] {
${themeVars.join('\n')}
  }
${darkBlocks(layers.theme.rootDark)}

  /* Text roles — one class per Figma type step (base, h1–h5, large, small, xs), for
     body, hero, and mono families. Weight defaults per step; override on element. */
${textClassBlocks.join('\n\n')}
}`;

// layout — grid properties + the .sherpa-view app-shell utility.
const layoutLayer = `@layer layout {
${rootBlock(layers.layout.root)}

  /* View frame utility — the light-DOM app shell renderView() wraps a view in. */
${viewFrameBlock}
}`;

// structure — bound sizes / content sizes / per-corner rounding + snap ([data-snap]).
const structureLayer = `@layer structure {
${rootBlock(layers.structure.root)}

  /* Snap — per-edge corner rounding ([data-snap]). */
${joinBlocks(snapBlocks)}
}`;

// style — default styling + status cascade + look tiers + categorical data-viz series.
const styleVars = [
  ...layers.style.root,
  '',
  '    /* categorical data-viz series — stable public names */',
  ...categoricalLines,
];
const styleLayer = `@layer style {
  :root {
${styleVars.join('\n')}
  }

  /* Status cascade — an ancestor [data-status] emits --_status-* to shadow roots. */
${joinBlocks(statusBlocks)}

  /* Look tiers — [data-look] re-points the status cascade per status mode. */
${joinBlocks(lookBlocks)}
${layers.style.modeBlocks.length ? '\n' + joinBlocks(layers.style.modeBlocks) : ''}
}`;

// elevation — shadow styling ([data-elevation]) + convenience aliases.
const elevationLayer = `@layer elevation {
  :root {
${layers.elevation.root.join('\n')}

    /* elevation shadow convenience aliases */
${shadowAliasLines.join('\n')}
  }
${layers.elevation.modeBlocks.length ? '\n' + joinBlocks(layers.elevation.modeBlocks) : ''}
}`;

const css = `${header}

${coreLayer}

${displayModeLayer}

${themeLayer}

${layoutLayer}

${structureLayer}

${styleLayer}

${elevationLayer}
`;

writeFileSync(OUT, css);

// ── inline component token regions into <comp>.css ──────────────────────────
// One .css per component: splice the projected block into the marked region at the
// top of <comp>.css (replace in place, else prepend). No separate <comp>.tokens.css.
let wrote = 0;
for (const { comp, css: region } of scopedPartials) {
  const dir = join(COMPONENTS, comp);
  const cssPath = join(dir, `${comp}.css`);
  if (!existsSync(cssPath)) {
    warn(`scoped component css missing: ${comp}.css`);
    continue;
  }
  const existing = readFileSync(cssPath, 'utf8');
  const next = spliceTokenRegion(existing, region);
  if (next !== existing) writeFileSync(cssPath, next);
  wrote++;
}

console.log(
  `\n✓ tokens.css written\n` +
    `  core         ${layers.core.root.length} vars\n` +
    `  display-mode ${layers['display-mode'].root.length} vars (+${layers['display-mode'].rootDark.length} dark) + density (compact+comfortable)\n` +
    `  theme        ${layers.theme.root.length} vars, ${fontAtomLines.length} font atoms, ${textClassBlocks.length} text classes\n` +
    `  layout       ${layers.layout.root.length} vars + .sherpa-view\n` +
    `  structure    ${layers.structure.root.length} vars, ${snapBlocks.length} snap\n` +
    `  style        ${layers.style.root.length} vars, ${statusBlocks.length} status, ${lookBlocks.length} look, ${categoricalLines.length} categorical\n` +
    `  elevation    ${layers.elevation.root.length} vars, ${shadowAliasLines.length} shadow aliases, ${layers.elevation.modeBlocks.length} [data-elevation]\n` +
    `✓ ${wrote} component token regions inlined into <comp>.css\n` +
    `${warnings.length ? `⚠ ${warnings.length} warning(s) — see above` : '✓ no warnings'}`,
);
