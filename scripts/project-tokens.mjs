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
//   structure    — bound SIZES and SPACING only ([data-size]). Split 2026-09-14:
//                  rounding and border width moved to `border`.
//   border       — everything an edge-JOIN affects: per-corner rounding + per-edge
//                  border width, as a t-shirt range ([data-border]), the SNAP
//                  extensions ([data-snap]) and a `none` mode that nulls the
//                  border ([data-border="none"]).
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
  'border',
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

  // NO `data-viz` collection route. Theme owns the series now —
  // `theme.data-viz.sequence/<n>/color <s>` plus `sequence-border/<n>` — and the
  // public names are emitted from there (see the data-viz block below). The
  // collection's own leaves aliased `sequential/*`, which no longer exists.

  // Component-scoped collections. Emit each component's Figma collection into its
  // own partial; non-primary modes → :host([attr="mode"]).
  input: { target: { scoped: 'sherpa-input-text' }, attr: 'data-state' },
  // The Navigation collection scopes the RAIL (width, surface, shadow, header state,
  // indent tiers) — sherpa-nav. Items read the indent tiers off the rail by cascade.
  navigation: { target: { scoped: 'sherpa-nav' }, attr: 'data-nav-state' },
  switch: { target: { scoped: 'sherpa-switch' }, attr: 'data-type' },

  // Extension-only collections (no leaves in the dump) — consumed from the cache.
  // (hero/mono collections deleted 2026-09-07 — families now in content/font/*.)
  // The Status extension of Data Viz → [data-palette="status"] @layer style. It
  // re-points series 1-5 onto the status ramps, so ANY chart can speak status by
  // colouring its marks by POSITION exactly as it always does — the palette swap
  // is the one change, and no chart needs status-aware code of its own.
  'data-viz-status': { target: 'skip' },
  // SET 2 — the second five sequences, as an extension of Data Viz. The base
  // holds five, so every collection is five wide and the Status extension does
  // not have to repeat itself. → [data-palette="set-2"] @layer style.
  'data-viz-set-2': { target: 'skip' },
  'style-transparent': { target: 'skip' }, // → [data-look="transparent"] @layer style
  'style-saturated': { target: 'skip' }, // → [data-look="saturated"] @layer style
  // The BORDER collection — per-corner rounding + per-edge border width.
  // Its size modes ride their OWN attribute: a component picks its border scale
  // independently of its Structure size, and `none` (which nulls the border)
  // must not compete with the real sizes on one attribute.
  // Renamed Border → GROUPING (2026-09-14). Its 3 modes are DIRECTION
  // (solo / horizontal / vertical), not size — size modes were retired, and
  // `none` became a direct bind to display-mode/border/width/none.
  // `publicSlug` keeps the EMITTED variable names stable across a Figma rename.
  // leafName() strips the leading group only when it matches the collection slug
  // (`border/top` under `border` → `--sherpa-border-top`). Renaming the collection
  // to Grouping would otherwise emit `--sherpa-grouping-border-top` and every
  // component — which reads `--sherpa-border-top` — would silently lose its border.
  // Its modes are POSITION along an axis (solo / start / mid / end), and the parent
  // IS a row — so they project as [data-group="start"] etc. The 4 extensions add
  // the column and grid-cell cases as [data-group="<collection>-<mode>"].
  grouping: { target: 'border', attr: 'data-group', publicSlug: 'border' },
  // Pre-rename slug. An older dump can still carry it.
  border: { target: 'border', attr: 'data-border' },

  // The 4 POSITION extensions of Grouping → [data-group] blocks in @layer border.
  // `vertical` runs a COLUMN; the 3 `grid-*` each fix a grid ROW and let the MODE
  // pick the column. A plain ROW needs no extension — the parent Grouping IS a row.
  'vertical': { target: 'skip' },
  'grid-top': { target: 'skip' },
  'grid-mid': { target: 'skip' },
  'grid-bottom': { target: 'skip' },

  // RETIRED snap extensions — kept routed so an older cache does not warn.
  'snap-all-edges': { target: 'skip' },
  'snap-right-edge': { target: 'skip' },
  'snap-left-edge': { target: 'skip' },
  'snap-top-edge': { target: 'skip' },
  'snap-bottom-edge': { target: 'skip' },
  // Pre-rename slugs. Kept routed because an unrouted slug warns, and an older
  // extension CACHE can still carry them.
  'snapping-snap-all-edges': { target: 'skip' },
  'snapping-snap-right-edge': { target: 'skip' },
  'snapping-snap-left-edge': { target: 'skip' },
  'snapping-snap-top-edge': { target: 'skip' },
  'snapping-snap-bottom-edge': { target: 'skip' },
  'structure-snap-all-edges': { target: 'skip' },
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

// ── cross-collection mode aliases ───────────────────────────────────────────
// A Figma variable can alias a variable in a MODE-SWITCHED collection — e.g. the
// Navigation `hover` mode sets nav-shadow/blur → {elevation.blur}. In Figma the
// containing component also pins that collection's mode, so the alias resolves to
// (say) Elevation=md. In CSS the alias becomes `var(--sherpa-elevation-blur)`, which
// resolves against :root — where the collection sits in its PRIMARY mode. For
// Elevation that primary mode is `passthrough`, i.e. all zeros, so the shadow
// silently vanished.
//
// Fix: when a scoped collection's mode aliases one of these, redirect the var to the
// target collection's own named mode (--sherpa-theme-elevation-blur-base for `md`),
// which IS a plain :root value. Keyed by the alias root, with the mode of the
// SCOPED collection choosing the target mode.
const MODE_ALIAS_TARGETS = {
  // {elevation.<prop>} → the value that Elevation mode actually holds.
  //
  // Two earlier versions of this hardcoded the ramp: first as
  // `--sherpa-theme-elevation-<prop>-<step>` (those 20 Theme leaves were then
  // deleted, so the redirect named nothing), then as a literal SIZE table
  // (which went stale the moment the ramp moved onto its own
  // `effects/blur|offset|spread` primitives). Both failures were the same
  // mistake — a copy of Figma's data living in this file.
  //
  // So it READS the dump instead. `elevationStep()` is defined after the doc is
  // loaded and resolves {elevation.<prop>} for a given mode from the Elevation
  // collection itself, which means a ramp change in Figma flows through with no
  // edit here.
  elevation: {
    // Which Elevation mode a scoped mode implies. `hover` lifts a surface, and
    // the Figma nav pins Elevation=lg on the rail. Any mode the collection
    // actually has maps to itself; unknown ones fall through to null.
    modeMap: { hover: 'lg' },
    raw: true,
    // The shadow COLOUR is not part of the elevation step ramp; it is the
    // status shadow, so leave it pointing at the live var.
    skip: new Set(['color']),
  },
};


/**
 * Resolve a cross-collection mode alias for one scoped mode, or null when the value
 * needs no redirection.
 */
/**
 * One Elevation step's value for a property, READ FROM THE DUMP.
 *
 * The Elevation collection switches its four geometry leaves by mode, so
 * `{elevation.blur}` under a scoped `hover` mode means "blur, at Elevation=lg".
 * Resolving that here — rather than from a table in this file — is what stops
 * the mapping going stale: the ramp has already moved twice (out of Theme, then
 * onto its own effects/* primitives), and both times a hardcoded copy broke
 * silently.
 *
 * Returns a complete CSS value (a literal for a primitive, a var() otherwise),
 * or null when the collection has no such property or mode.
 */
function elevationStep(prop, mode) {
  const leaf = (doc.elevation ?? {})[prop];
  if (!leaf || !('$value' in leaf)) return null;
  const ext = leaf.$extensions?.['figma-console-mcp'] ?? {};
  const primary = ext.primaryMode;
  const raw = mode === primary ? leaf.$value : (ext.modes ?? {})[mode];
  if (raw === undefined) return null;
  return toCss(raw, leaf.$type);
}

function modeAliasVar(value, scopedMode) {
  if (!isRef(value)) return null;
  const [root, ...rest] = value.slice(1, -1).split('.');
  const spec = MODE_ALIAS_TARGETS[root];
  if (!spec) return null;
  const prop = rest.join('-');
  if (spec.skip?.has(prop)) return null;
  const step = spec.modeMap[scopedMode] ?? scopedMode;
  if (!step) return null;
  const out = spec.rename ? spec.rename(prop, step) : elevationStep(prop, step);
  if (out == null) return null;
  return spec.raw ? out : `var(${out})`;
}

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

/**
 * A COMPOSED colour → CSS.
 *
 * Figma's new model separates hue from alpha: a colour variable can alias
 * another AND carry its own opacity, bound to a number variable
 * (Primitives::effects/opacity/*). The DTCG dump has no slot for that, so the
 * export flattens it — the colour survives and the ALPHA IS SILENTLY LOST. That
 * is not hypothetical: it turned every drop shadow in the system fully opaque.
 *
 * The opacity is preserved in `$extensions["figma-console-mcp"].opacity` when
 * the dump is refreshed, and this applies it. `color-mix` is the only way to put
 * an alpha on a value that is itself a var() — `#rrggbbaa` cannot wrap one.
 *
 * 100% is the overwhelming majority (223 of 231 composed values) and needs no
 * wrapper at all, so it returns the plain value and keeps the output readable.
 */
function withOpacity(css, opacityRef) {
  if (css == null || !opacityRef) return css;
  const m = /effects[./]opacity[./](\d+)/.exec(String(opacityRef));
  if (!m) return css;
  const pct = Number(m[1]) / 10;            // opacity/500 → 50
  if (!Number.isFinite(pct) || pct >= 100) return css;
  return `color-mix(in srgb, ${css} ${pct}%, transparent)`;
}

/** A leaf's public var name: drop a redundant repeated collection segment (e.g.
 * style/style-surface/base → --sherpa-style-surface-base) so emitted global names
 * match what refName() produces for refs pointing at the same leaf.
 *
 * TWO shapes of repetition, and the second only appeared with the Border
 * collection: the group either PREFIXES the collection name (style/style-surface)
 * or IS it (border/border/top), which would otherwise emit
 * `--sherpa-border-border-top`. */
function leafName(path) {
  let segs = path;
  if (segs[1] && (segs[1] === segs[0] || segs[1].startsWith(segs[0] + '-'))) {
    segs = segs.slice(1);
  }
  return `--${PREFIX}${toIdent(segs)}`;
}

/**
 * Leaf paths whose Figma FLOAT is a COUNT, not a length.
 *
 * Figma exports every FLOAT as DTCG `dimension`, so a count arrives looking like a
 * length and projects with `px`. That voids any declaration expecting a number —
 * `repeat(4px, 1fr)` is invalid, so the layout grid rendered as nothing at all.
 * Keep this list tight: a genuine length must NOT be listed, or it loses its unit.
 */
const COUNT_PATHS = /(^|\/)(columns|column-count|row-count)$/;

/** Walk a collection subtree → structured leaves with modes + scopes (cycle-safe). */
function* walkLeaves(node, path = [], seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if ('$value' in node) {
    const ext = node.$extensions?.['figma-console-mcp'] ?? {};
    const rawPath = path.join('/');
    yield {
      path,
      name: leafName(path),
      rawPath,
      value: node.$value,
      // A Figma FLOAT is exported as $type 'dimension' whether it is a LENGTH or a
      // COUNT, and a count must project UNITLESS or the declaration is void.
      // `layout-grid/columns` is 4 / 8 / 12 columns, and projected as `4px` it made
      // `grid-template-columns: repeat(var(...), 1fr)` invalid — the whole layout
      // grid silently did nothing. Same shape as the `400px` font-weight bug.
      type: COUNT_PATHS.test(rawPath) ? 'number' : node.$type,
      modes: ext.modes ?? {},
      primaryMode: ext.primaryMode,
      // Per-mode alpha from Figma's COMPOSED colour values. The DTCG export
      // flattens a composition to its colour and drops the opacity, so it is
      // carried here and re-applied by withOpacity(). See that function.
      opacity: ext.opacity ?? {},
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
// Nothing to register. This held `--sherpa-elevation-color`, which the Elevation
// collection no longer defines — its colour leaf is gone and the shadow colour
// comes from Style::style-surface/shadow instead. An @property for a variable
// nothing sets is worse than nothing: it gives the name a valid initial value,
// so a typo resolves to `transparent` rather than failing loudly.
const propertyRegistrations = '';

// ════════════════════════════════════════════════════════════════════════════
// Collect leaves per collection and route them.
// ════════════════════════════════════════════════════════════════════════════
// Per-layer buckets. Each named layer collects its own `root` (:root / primary lines),
// `rootDark` (light-dark re-point), and `modeBlocks` ([attr="mode"] strings). The
// bespoke sections (status/look/viz/snap/density/shadow/theme-scope/text) are slotted
// into their assigned layer at write time.
const GLOBAL_LAYERS = ['core', 'display-mode', 'theme', 'layout', 'structure', 'border', 'style', 'elevation'];
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

  const leaves = [...walkLeaves(doc[slug], [route.publicSlug ?? slug])];
  for (const leaf of leaves) scopeCheck(leaf);

  // ── global target: `route.target` is a layer name ──
  if (typeof route.target === 'string' && layers[route.target]) {
    const L = layers[route.target];
    const byMode = {};
    for (const leaf of leaves) {
      if (typeof leaf.value === 'boolean') continue; // booleans are scoped visibility flags only
      const v = withOpacity(toCss(leaf.value, leaf.type), leaf.opacity[leaf.primaryMode ?? 'light']);
      if (v == null) continue;
      L.root.push(`  ${leaf.name}: ${v};`);
      // light/dark re-point (display ramp) — into the SAME layer.
      if (route.modeAxis === 'light-dark' && leaf.modes.dark != null) {
        const dv = withOpacity(toCss(leaf.modes.dark, leaf.type), leaf.opacity.dark);
        if (dv != null && dv !== v) L.rootDark.push(`  ${leaf.name}: ${dv};`);
      }
      // non-primary modes → [attr="mode"] blocks in the same layer.
      if (!route.attr) continue;
      for (const [mode, mval] of Object.entries(leaf.modes)) {
        const mv = withOpacity(toCss(mval, leaf.type), leaf.opacity[mode]);
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
      const L = layers[route.target.alsoGlobal];
      for (const leaf of leaves) {
        if (typeof leaf.value === 'boolean') continue;
        const v = toCss(leaf.value, leaf.type);
        if (v == null) continue;
        // leaf.name already strips a redundant repeated collection segment
        // (structure/structure-rounding → --sherpa-structure-rounding-*) so the
        // global names match what [data-snap] and components consume.
        L.root.push(`  ${leaf.name}: ${v};`);
      }

      // …AND the collection's NON-PRIMARY modes, as `[data-size]` blocks.
      //
      // Without these the global layer only ever carried the PRIMARY mode, so a
      // component Figma pins to `Structure=sm` (the nav header's 24px icon buttons,
      // for one) had no way to reach the sm values — `--sherpa-structure-icon-size`
      // resolved to the default 14 everywhere and every such icon was the wrong
      // size. Same class of silent failure as the cross-collection mode aliases:
      // a mode pin is a selector, and a selector only applies where it is written.
      const modeNames = new Set();
      for (const leaf of leaves) for (const m of Object.keys(leaf.modes ?? {})) modeNames.add(m);
      for (const mode of modeNames) {
        const lines = [];
        for (const leaf of leaves) {
          if (typeof leaf.value === 'boolean') continue;
          const raw = leaf.modes?.[mode];
          if (raw === undefined) continue;
          const v = toCss(raw, leaf.type);
          if (v == null) continue;
          lines.push(`    ${leaf.name}: ${v};`);
        }
        if (!lines.length) continue;
        // `passthrough` is NOT a size. It is the mode that NULLS a structure
        // value — today the four structure-border/* widths, so a snapped or
        // borderless surface can switch them off without a per-component rule.
        // Emitting it as `[data-size="passthrough"]` would have made it compete
        // with the real sizes on one attribute, so a passthrough element could
        // not also be sm. It gets its own attribute instead.
        const isPassthrough = mode === 'passthrough';
        const sel = isPassthrough ? '[data-structure="passthrough"]' : `[data-size="${mode}"]`;
        const label = isPassthrough
          ? `the passthrough mode ([data-structure]) — nulls the border widths`
          : `the ${mode} size mode ([data-size])`;
        L.modeBlocks.push(
          `  /* ${route.target.alsoGlobal} — ${label}. */\n` +
            `  ${sel} {\n${lines.join('\n')}\n  }`,
        );
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
    // `mode` matters for cross-collection aliases: a value pointing into a
    // mode-switched collection must resolve through THAT collection's mode
    // (see MODE_ALIAS_TARGETS), not against :root's primary mode.
    const encode = (val, mode) =>
      isBool ? vis(val) : (modeAliasVar(val, mode) ?? toCss(val, leaf.type));
    const pv = encode(leaf.value, primaryMode);
    if (pv == null) continue;
    rootVars.push(`  ${name}: ${pv};`);
    for (const [mode, mval] of Object.entries(leaf.modes)) {
      if (mode === primaryMode) continue;
      const mv = encode(mval, mode);
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
// Data-viz series — the public --sherpa-categorical-* / --sherpa-data-viz-* names.
// ════════════════════════════════════════════════════════════════════════════
// The Data Viz collection is TEN sequences of TEN steps (rebuilt 2026-09-15); its
// `series/1..10` read one step each from whichever sequence mode is active, and
// its `border` reads that sequence's colour 5.
//
// The count is NOT hardcoded here — it follows whatever the dump carries, so a
// palette change cannot leave the CSS emitting a series the tokens no longer
// define. (It was eleven, with a `categorical` primary mode that has since been
// retired: step 5 of each sequence covers that job.)
//
// A mark's fill moves along its ramp; its BORDER does not. The border is the
// series' identity, so `--sherpa-data-viz-series-border-N` is emitted alongside
// each hue and every chart strokes with it.
const categoricalLines = [];
const seriesBorderLines = [];
{
  // The DEFAULT palette comes from THEME now, not the Data Viz collection.
  //
  // Theme holds `data-viz/sequence/<n>/color <s>` — ten sequences of ten steps,
  // each already carrying its 50% — plus `data-viz/sequence-border/<n>`, that
  // ramp's colour 5 held solid. A multi-series chart wants ONE colour per series,
  // so `--sherpa-data-viz-series-N` is sequence N's MID step (colour 5) and the
  // border is sequence N's border.
  //
  // It used to read the Data Viz collection's own `series/N`, whose primary mode
  // is a single sequence — ten shades of purple — and then re-point them at the
  // per-sequence picks. Theme names them directly, so the indirection is gone.
  const seqMid = new Map();
  const seqBorder = new Map();
  const seqSteps = new Map();
  for (const leaf of walkLeaves(doc.theme?.['data-viz'] ?? {}, ['theme', 'data-viz'])) {
    const v = withOpacity(toCss(leaf.value, leaf.type), leaf.opacity?.[leaf.primaryMode]);
    if (v == null) continue;
    let m = leaf.rawPath.match(/sequence\/(\d+)\/color (\d+)$/);
    if (m) {
      const [, n, step] = m.map(Number);
      if (Number(step) === 5) seqMid.set(Number(n), v);
      seqSteps.set(`${n}/${step}`, v);
      continue;
    }
    m = leaf.rawPath.match(/sequence-border\/(\d+)$/);
    if (m) seqBorder.set(Number(m[1]), v);
  }
  const count = Math.max(seqMid.size, seqBorder.size);
  for (let n = 1; n <= count; n++) {
    const fill = seqMid.get(n);
    const border = seqBorder.get(n);
    if (fill != null) {
      categoricalLines.push(`  --sherpa-categorical-${n}: ${fill};`);
      categoricalLines.push(`  --sherpa-data-viz-series-${n}: ${fill};`);
    }
    if (border != null) seriesBorderLines.push(`  --sherpa-data-viz-series-border-${n}: ${border};`);
  }
  if (seqBorder.get(1) != null) {
    seriesBorderLines.push(`  --sherpa-data-viz-series-border: ${seqBorder.get(1)};`);
  }
  if (!count) warn('theme data-viz: no sequence/<n>/color <s> leaves found');
}

// ════════════════════════════════════════════════════════════════════════════
// Status palette — [data-palette="status"] re-points the series onto the ramps.
// ════════════════════════════════════════════════════════════════════════════
// The `Status` EXTENSION of Data Viz overrides series/1..5 to the status ramps'
// +2 step (the saturated middle — `base`/+1 are the pale card tints, +3/+4 the
// dark inks for text on them). Series 6-11 keep the categorical hues.
//
// Emitting it as an ATTRIBUTE rather than per-component code is the whole point:
// every chart already colours its marks by POSITION (series-1, series-2, …), so
// one `data-palette="status"` turns any of them into a status chart with no
// chart-specific status handling anywhere.
//
// Both the public `--sherpa-categorical-*` names and the `--sherpa-data-viz-
// series-*` aliases are re-pointed, because charts consume whichever they were
// written against.
const paletteBlocks = [];
const statusSeriesLines = [];
for (const slug of ['data-viz-status', 'data-viz-set-2']) {
  const cache = extDoc[slug]?.vars;
  const palette = slug.replace(/^data-viz-/, '');
  if (!cache) {
    warn(`palette "${slug}" missing from extension cache`);
  } else {
    const mode = extDoc[slug].defaultMode ?? 'sequence 1';
    const lines = [];
    // The BORDER first, so it is not mistaken for a series index.
    const borderVal = cache['data-viz/border']?.[mode];
    if (borderVal != null) lines.push(`    --sherpa-data-viz-series-border: ${borderVal};`);
    for (const [path, byMode] of Object.entries(cache)) {
      const n = path.match(/series\/(\d+)$/)?.[1];
      const val = byMode[mode];
      if (!n || val == null) continue;
      // The 50% is applied HERE, not inherited. Overriding a leaf in a Figma
      // extension replaces the whole composed value, so the cached override is a
      // flat colour — and the plugin API cannot write a replacement composition
      // ("Composed color variable values are not supported").
      const tinted = `color-mix(in srgb, ${val} 50%, transparent)`;
      lines.push(`    --sherpa-categorical-${n}: ${tinted};`);
      lines.push(`    --sherpa-data-viz-series-${n}: ${tinted};`);
      // Every series shares the mode's ONE border — the ramp's saturated mid.
      if (borderVal != null) lines.push(`    --sherpa-data-viz-series-border-${n}: ${borderVal};`);
    }
    // Sort by series index. The unnumbered `--sherpa-data-viz-series-border`
    // has none, so it sorts to the top rather than throwing on a null match.
    const idx = (l) => Number(l.match(/-(\d+):/)?.[1] ?? -1);
    lines.sort((a, b) => idx(a) - idx(b) || a.localeCompare(b));
    if (lines.length) {
      paletteBlocks.push(`  [data-palette="${palette}"] {\n${lines.join('\n')}\n  }`);
    }

    // STATUS gets one more thing: a variable NAMED for each status.
    //
    // Its five sequences ARE the five statuses — sequence 1 is the whole green
    // ramp, 2 amber, and so on — so a status is a MODE here, not a series index.
    // A gauge paints several statuses at once and cannot pin five modes, so it
    // needs to name a colour directly: `--sherpa-status-<name>` is that ramp's
    // mid (its `border`), and `-fill` is the same at the marks' 50%.
    //
    // These live OUTSIDE the [data-palette] block — a chart names a status
    // whether or not it has opted into the palette.
    if (slug === 'data-viz-status') {
      const order = ['success', 'warning', 'urgent', 'critical', 'info'];
      // FILL = the sequence's MID step (series 5); BORDER = the `border`
      // variable. Both are read from the status's own sequence, so the pair
      // stays correct if a ramp is ever re-pointed.
      const midRow = cache['data-viz/series/5'] ?? {};
      const borderRow = cache['data-viz/border'] ?? {};
      order.forEach((status, i) => {
        const mode = `sequence ${i + 1}`;
        const mid = midRow[mode];
        const bor = borderRow[mode];
        if (mid != null) {
          statusSeriesLines.push(
            `  --sherpa-status-${status}-fill: color-mix(in srgb, ${mid} 50%, transparent);`);
        }
        if (bor != null) statusSeriesLines.push(`  --sherpa-status-${status}: ${bor};`);
      });
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Status cascade — an ancestor [data-status] emits --_status-* to shadow roots.
// ════════════════════════════════════════════════════════════════════════════
// The `style` collection carries the 8 status modes. Map its roles to the public
// --_status-* cascade vars components consume via fallback chains.
const STATUS_MODES = ['info', 'critical', 'warning', 'urgent', 'success', 'active', 'inactive'];
const STATUS_ROLE_MAP = {
  'style-surface/base': '_status-surface',
  'style-surface/base +1': '_status-surface-subtle',
  'style-surface/base +2': '_status-surface-strong',
  'style-surface/shadow': '_status-shadow',
  'style-border/base': '_status-border',
  // The STRONG border step — a status-tinted rule/stroke (chart lines, tinted
  // dividers). The neutral `_status-border` cannot express these.
  'style-border/base +1': '_status-border-strong',
  // A DATA MARK under a status pin — a sparkline's line, a metric's trend fill.
  // The fill is that status's ramp mid at 50%, the border the same colour solid.
  //
  // These exist because the status cascade and the data-viz palette answer
  // different questions: a cascade says "what is THIS thing's status" and drives
  // everything from one [data-status] pin, while a multi-series chart picks ten
  // colours at once and cannot pin ten modes. A sparkline is the first case and
  // was reading `_status-border-strong` — a CARD's border step, not a data colour.
  'style-surface/data-viz': '_status-data-viz',
  'style-border/data-viz': '_status-data-viz-border',
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
    const v = withOpacity(toCss(raw, leaf.type), leaf.opacity[mode] ?? leaf.opacity[leaf.primaryMode]);
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
  'style-surface/base +1': '_status-surface-subtle',
  'style-surface/base +2': '_status-surface-strong',
  'style-surface/shadow': '_status-shadow',
  'style-border/base': '_status-border',
  // The STRONG border step — a status-tinted rule/stroke (chart lines, tinted
  // dividers). The neutral `_status-border` cannot express these.
  'style-border/base +1': '_status-border-strong',
  // A DATA MARK under a status pin — a sparkline's line, a metric's trend fill.
  // The fill is that status's ramp mid at 50%, the border the same colour solid.
  //
  // These exist because the status cascade and the data-viz palette answer
  // different questions: a cascade says "what is THIS thing's status" and drives
  // everything from one [data-status] pin, while a multi-series chart picks ten
  // colours at once and cannot pin ten modes. A sparkline is the first case and
  // was reading `_status-border-strong` — a CARD's border step, not a data colour.
  'style-surface/data-viz': '_status-data-viz',
  'style-border/data-viz': '_status-data-viz-border',
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
// Grouping — per-position borders ([data-group]) from the extension cache.
// ════════════════════════════════════════════════════════════════════════════
// The GROUPING collection (renamed from Border, 2026-09-14) carries 3 DIRECTION
// modes: solo / horizontal / vertical. Position lives in 15 EXTENSION collections,
// because a Figma extension inherits its parent's modes and cannot add its own —
// so the position has to be the COLLECTION, not a mode.
//
//   group-h-{left,mid,right}      a ROW     → [data-group="h-left"] …
//   group-v-{top,mid,bottom}      a COLUMN  → [data-group="v-top"] …
//   group-{left,mid,right}-{top,mid,bottom}  a GRID CELL → [data-group="left-top"] …
//
// ONE SIDE OWNS the shared edge: an item with a neighbour to its right drops its
// own right edge; with a neighbour below, its bottom edge. No halving, so no
// 0.25px values and no negative overlap.
//
// Each block re-points the 4 per-edge WIDTH vars and the 4 corner RADIUS vars.
// The public names must match what leafName() emits for the same leaf — the
// `rounding/*` group does NOT repeat the collection name, so it keeps the
// `border-` prefix, unlike `border/top` where the group IS the collection name
// and the duplicate is stripped. Getting this wrong writes `--sherpa-rounding-*`
// while every consumer reads `--sherpa-border-rounding-*`, and grouping silently
// stops squaring corners.
const GROUP_VARS = {
  'border/top': '--sherpa-border-top',
  'border/bottom': '--sherpa-border-bottom',
  'border/left': '--sherpa-border-left',
  'border/right': '--sherpa-border-right',
  'rounding/top-left': '--sherpa-border-rounding-top-left',
  'rounding/top-right': '--sherpa-border-rounding-top-right',
  'rounding/bottom-left': '--sherpa-border-rounding-bottom-left',
  'rounding/bottom-right': '--sherpa-border-rounding-bottom-right',
};
const snapBlocks = [];
// A position is COLLECTION + MODE: `grid-top` at mode `start` is the top-left cell.
// Emitted as [data-group="<collection>-<mode>"], plus the parent's own modes as
// [data-group="<mode>"] for a plain row.
for (const slug of Object.keys(extDoc)) {
  if (!/^(vertical|grid-)/.test(slug)) continue;
  const cache = extDoc[slug].vars;
  const modes = Object.keys(cache['border/top'] ?? {});
  for (const mode of modes) {
    const lines = [];
    for (const [key, publicVar] of Object.entries(GROUP_VARS)) {
      const val = cache[key]?.[mode];
      if (val == null) continue;
      lines.push(`    ${publicVar}: ${literal(val, 'dimension')};`);
    }
    if (lines.length) snapBlocks.push(`  [data-group="${slug}-${mode}"] {\n${lines.join('\n')}\n  }`);
  }
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
  // THE SHADOW COLOUR IS style-surface/shadow, directly. The Elevation
  // collection now carries GEOMETRY only — Will removed its colour leaf, so
  // `--sherpa-elevation-color` no longer exists and these aliases named a
  // variable nothing defines. One token also means a status re-point moves
  // every shadow in the system together.
  '  --sherpa-shadow-sm: var(--sherpa-elevation-offset-x, 0) var(--sherpa-elevation-offset-y, 1px) var(--sherpa-elevation-blur, 2px) var(--sherpa-elevation-spread, 0) var(--sherpa-style-surface-shadow, #35353d4c);',
  '  --sherpa-shadow-md: var(--sherpa-elevation-offset-x, 0) var(--sherpa-elevation-offset-y, 4px) var(--sherpa-elevation-blur, 12px) var(--sherpa-elevation-spread, 0) var(--sherpa-style-surface-shadow, #35353d4c);',
  '  --sherpa-shadow-lg: var(--sherpa-elevation-offset-x, 0) var(--sherpa-elevation-offset-y, 12px) var(--sherpa-elevation-blur, 32px) var(--sherpa-elevation-spread, 0) var(--sherpa-style-surface-shadow, #35353d4c);',
];

// ════════════════════════════════════════════════════════════════════════════
// .sherpa-view frame utility — NO CONSUMER AS OF 2026-09-18.
// ════════════════════════════════════════════════════════════════════════════
// It said "consumed by src/core/render-view.ts" until that stopped being true.
// renderView's `shell:` option built a <div class="sherpa-view"> and was deleted
// as a second implementation of `sherpa-app-shell`; a view now names the shell
// COMPONENT like any other element. See TRAP
// T-the-shell-is-a-component-not-a-region-map.
//
// The last line of the old comment already admitted the duplication: "mirrors
// sherpa-app-shell.css, which does the same thing in the shadow DOM." It does,
// and the component's copy is the one with a contract, a state machine and a
// test.
//
// KEPT, not deleted, because a light-DOM frame is a real thing to want: an app
// that cannot use a custom element (a server-rendered page, a host framework
// that owns the root) has nowhere else to go. If nothing claims it, delete this
// block and the `layout` layer's only bespoke output goes with it.
//
// The nav is an OVERLAY: absolutely positioned down the left edge at full height,
// with the header/body inset by the COLLAPSED rail width only. Hovering the rail
// then reveals it OVER the content instead of reflowing the page; the inset grows
// only when the rail is latched open (pinned/settings). Widths are the Figma
// Navigation nav-layout/width values (40 collapsed / 320 open).
const viewFrameBlock = `  .sherpa-view {
    --sherpa-view-nav-collapsed: var(--sherpa-display-mode-size-3xl, 40px);
    --sherpa-view-nav-open: 320px;
    --sherpa-view-content-inset: var(--sherpa-view-nav-collapsed);

    position: relative;
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'header'
      'body';
    block-size: 100%;
    min-block-size: 100vh;
    padding-inline-start: var(--sherpa-view-content-inset);
    background: var(--sherpa-display-mode-color-app-color-1, #e8e8f6);
    color: var(--sherpa-theme-content-body-1, #35353d);
    transition: padding-inline-start 160ms ease;
  }
  /* Latched open (pinned/settings) → the content sits beside the full-width rail. */
  .sherpa-view[data-nav-state='pinned'],
  .sherpa-view[data-nav-state='settings'] {
    --sherpa-view-content-inset: var(--sherpa-view-nav-open);
  }
  .sherpa-view > [data-region='nav'] {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 2;
    display: flex;
  }
  .sherpa-view > [data-region='header'] {
    grid-area: header;
    min-inline-size: 0;
  }
  .sherpa-view > [data-region='body'] {
    grid-area: body;
    min-block-size: 0;
    overflow: auto;
    padding: var(--sherpa-layout-grid-padding, 16px);
  }
  /* A view with no header region lets the body span both rows. */
  .sherpa-view:not(:has(> [data-region='header'])) {
    grid-template-areas:
      'body'
      'body';
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
// The DOCUMENT reset. Every Sherpa app was hand-writing this in its own <style>
// block — margin, height, page font, page colour, page background — because
// nothing in the system owned the page itself. A component cannot: `html` and
// `body` are outside every shadow root, so only a light-DOM sheet can reach them
// and tokens.css is the only light-DOM sheet Sherpa ships.
//
// It is in `core` (the FIRST layer) on purpose: an app that wants a different
// page background writes one unlayered rule and wins, because any unlayered
// declaration beats every layer.
//
// The height chain matters. A view that fills the screen (the chat thread, a
// scrolling data grid) needs an unbroken 100% from `html` down to the shell, and
// a percentage height resolves against the PARENT's height — so one `height:auto`
// anywhere in the chain collapses everything below it to content height.
const documentResetBlock = `  /* The page itself — see the note above the layer. */
  html,
  body {
    margin: 0;
    block-size: 100%;
  }
  body {
    font-family: var(--sherpa-font-family-body, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
    color: var(--sherpa-theme-content-body-base, #0c0b11);
    background: var(--sherpa-theme-surface-default-1, #e8e8f6);
  }
  /* The shell is the page's frame, so it inherits the full height rather than
     each app re-declaring it. :is() keeps this at class specificity. */
  body > sherpa-app-shell,
  body > :is(div, main) > sherpa-app-shell {
    block-size: 100%;
  }`;

// core — shared base geometry + the document reset.
const coreLayer = `@layer core {
${rootBlock(layers.core.root)}

${documentResetBlock}
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


// ── layout: responsive breakpoint blocks + the .sherpa-grid utility ─────────
//
// The Layout collection's modes ARE the breakpoints (mobile primary, then tablet /
// desktop / wide), and each mode re-points the grid's column count, max width and
// gutters. None of that was being emitted: only the primary (mobile) values
// reached :root, so the grid never responded to width at all.
//
// Emitted as `@media (min-width: <breakpoint>)` blocks in ascending order, because
// a mode pin has no meaning in CSS on its own — a viewport mode IS a media query.
const layoutBreakpointBlocks = (() => {
  const leaves = [...walkLeaves(doc.layout ?? {}, ['layout'])];
  const bp = leaves.find((l) => l.rawPath === 'layout/breakpoint');
  if (!bp) return [];
  // mode → its min-width, sorted ascending so later (wider) blocks win.
  const modes = Object.entries(bp.modes)
    .map(([mode, value]) => ({ mode, min: Number(toCss(value, 'dimension')?.replace('px', '')) }))
    .filter((m) => Number.isFinite(m.min))
    .sort((a, b) => a.min - b.min);

  return modes.map(({ mode, min }) => {
    const lines = [];
    for (const leaf of leaves) {
      // The breakpoint itself is the QUERY, not a value to emit inside it.
      if (leaf.rawPath === 'layout/breakpoint') continue;
      const raw = leaf.modes?.[mode];
      if (raw === undefined) continue;
      const v = toCss(raw, leaf.type);
      if (v == null) continue;
      lines.push(`      ${leaf.name}: ${v};`);
    }
    if (!lines.length) return null;
    return `  /* ${mode} — the Layout collection's own mode, as its breakpoint. */\n` +
      `  @media (min-width: ${min}px) {\n    :root {\n${lines.join('\n')}\n    }\n  }`;
  }).filter(Boolean);
})();

// The grid utility every view lays itself out on. Consumes the projected values,
// so it re-flows at each breakpoint block above with no per-view media queries.
const gridUtilityBlock = `  /* Layout grid — the track system views place their content on.
     \`columns\` is a COUNT, so it must project unitless (see COUNT_PATHS); as
     \`4px\` the repeat() was invalid and the whole grid silently did nothing. */
  .sherpa-grid {
    display: grid;
    grid-template-columns: repeat(var(--sherpa-layout-grid-columns, 4), minmax(0, 1fr));
    column-gap: var(--sherpa-layout-grid-gap-horizontal, 16px);
    row-gap: var(--sherpa-layout-grid-gap-vertical, 16px);
    /* FILLS ITS PARENT. No max-inline-size.

       It used to cap at --sherpa-layout-grid-max-width and centre, which left a
       1428px parent showing a 1280px grid — 74px of dead space each side, and
       224px at 1800. Two reasons that was wrong:

         • Those values are Figma's ARTBOARD widths (480 / 768 / 1280 / 1600),
           which describe the canvas a design is drawn on, not a measure limit
           for the content inside it. The token stays; this rule just is not its
           consumer.
         • They sit one breakpoint behind. 'wide' is 1600 but its media query
           starts at 1920, so every width from 1280 to 1920 was pinned at 1280.

       The app shell already constrains the page, so this was a SECOND cap
       fighting it. 'data-bleed' went with the cap — there is nothing left to
       opt out of.

       'inline-size: 100%' is still explicit: inside a flex column an auto inline
       margin overrides the default align-items stretch, and the grid
       shrink-wrapped to its content (358px inside a 1368px view) with every
       track a few pixels wide. */
    inline-size: 100%;
    padding: var(--sherpa-layout-grid-padding, 16px);
    box-sizing: border-box;
  }
  /* Span helpers — a child claims N of the current breakpoint's columns, clamped
     so a span wider than the grid wraps rather than overflowing it. */
  .sherpa-grid > [data-span] {
    grid-column: span min(var(--_span), var(--sherpa-layout-grid-columns, 4));
  }
  .sherpa-grid > [data-span='1']  { --_span: 1; }
  .sherpa-grid > [data-span='2']  { --_span: 2; }
  .sherpa-grid > [data-span='3']  { --_span: 3; }
  .sherpa-grid > [data-span='4']  { --_span: 4; }
  .sherpa-grid > [data-span='6']  { --_span: 6; }
  .sherpa-grid > [data-span='8']  { --_span: 8; }
  .sherpa-grid > [data-span='12'] { --_span: 12; }
  .sherpa-grid > [data-span='full'] { grid-column: 1 / -1; }`;

// layout — grid properties + breakpoints + the .sherpa-grid / .sherpa-view utilities.
const layoutLayer = `@layer layout {
${rootBlock(layers.layout.root)}
${layoutBreakpointBlocks.length ? '\n' + layoutBreakpointBlocks.join('\n\n') + '\n' : ''}
${gridUtilityBlock}

  /* View frame utility — the light-DOM app shell renderView() wraps a view in. */
${viewFrameBlock}
}`;

// structure — bound sizes and spacing only ([data-size]). Rounding and border
// width moved to @layer border in the 2026-09-14 split.
const structureLayer = `@layer structure {
${rootBlock(layers.structure.root)}
${layers.structure.modeBlocks.length ? '\n' + joinBlocks(layers.structure.modeBlocks) + '\n' : ''}}`;

// border — per-corner rounding + per-edge border width, the snap extensions
// ([data-snap]) and the `none` mode that nulls the border.
const borderLayer = `@layer border {
${rootBlock(layers.border.root)}
${layers.border.modeBlocks.length ? '\n' + joinBlocks(layers.border.modeBlocks) + '\n' : ''}
  /* Grouping — per-position borders + rounding ([data-group]). */
${joinBlocks(snapBlocks)}
}`;

// style — default styling + status cascade + look tiers + categorical data-viz series.
const styleVars = [
  ...layers.style.root,
  '',
  '    /* data-viz series — stable public names */',
  ...categoricalLines,
  ...(statusSeriesLines.length
    ? ['', '    /* status by NAME — a chart paints several statuses at once and so',
       '       cannot pin a mode per status. The ramp mid, and the same at 50%. */',
       ...statusSeriesLines]
    : []),
  ...(seriesBorderLines.length
    ? ['', '    /* series BORDER — colour 5 of the active sequence, held fixed */',
       ...seriesBorderLines]
    : []),
];
const styleLayer = `@layer style {
  :root {
${styleVars.join('\n')}
  }

  /* Status cascade — an ancestor [data-status] emits --_status-* to shadow roots. */
${joinBlocks(statusBlocks)}

  /* Look tiers — [data-look] re-points the status cascade per status mode. */
${joinBlocks(lookBlocks)}

  /* Status palette — [data-palette] re-points the data-viz series onto the
     status ramps, so any chart can colour its marks by status with one attr. */
${joinBlocks(paletteBlocks)}
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

${borderLayer}

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
    `  structure    ${layers.structure.root.length} vars\n` +
    `  border       ${layers.border.root.length} vars, ${snapBlocks.length} group positions\n` +
    `  style        ${layers.style.root.length} vars, ${statusBlocks.length} status, ${lookBlocks.length} look, ${categoricalLines.length / 2} series, ${seriesBorderLines.length} border, ${paletteBlocks.length} palette\n` +
    `  elevation    ${layers.elevation.root.length} vars, ${shadowAliasLines.length} shadow aliases, ${layers.elevation.modeBlocks.length} [data-elevation]\n` +
    `✓ ${wrote} component token regions inlined into <comp>.css\n` +
    `${warnings.length ? `⚠ ${warnings.length} warning(s) — see above` : '✓ no warnings'}`,
);
