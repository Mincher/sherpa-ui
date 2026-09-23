/**
 * project-tokens.mjs — project the Figma DTCG export into Sherpa's CSS as cascade
 * layers. Structure is read from the dump (figma.tokens.json + the extension cache
 * figma.extensions.json); the ROUTING table below is the only hand-config. Refs into
 * `primitives.*` are inlined to literals, so Primitives is never emitted.
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
/* The text-role utilities, ALSO written where a shadow root can adopt them.
   `tokens.css` is <link>ed into the document, so its classes never reach a
   component's inner nodes — measured: .sherpa-text-h1 gives 24px/600 in the
   document and 14px/400 inside a shadow root, which is why zero of 58
   components used one. TRAP T-a-document-class-cannot-reach-a-shadow-root. */
const OUT_TYPOGRAPHY = join(ROOT, 'src/core/sherpa-typography.css');
const OUT_GROUP_POSITIONS = join(ROOT, 'src/core/sherpa-group-positions.css');
const COMPONENTS = join(ROOT, 'src/components');
const PREFIX = 'sherpa-';

// The scoped-token block is spliced into the TOP of <comp>.css between these
// sentinels; hand-authored CSS below them is preserved.
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
  // No region yet — prepend it.
  return region + '\n\n' + existing.replace(/^\n+/, '');
}

const doc = JSON.parse(readFileSync(SRC, 'utf8'));
const extDoc = existsSync(EXT) ? JSON.parse(readFileSync(EXT, 'utf8')) : {};

const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn('  ⚠ ' + msg);
};

// One @layer per Figma collection family, in cascade order. Each layer owns its
// base values plus its own mode/extension blocks; `components` is always last.
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

// ROUTING — the only hand-config. `target` is a LAYER NAME, 'skip', or a {scoped}
// component partial. `modeAxis:'light-dark'` marks a collection that re-points in
// dark mode. `attr` turns non-primary MODES into [attr="mode"] blocks in the layer.
// A collection in the dump or cache but MISSING here warns — never silently dropped.
const ROUTING = {
  // Reference-only — refs into it are inlined to literals.
  primitives: { target: 'skip' },

  // Slug is 'display-mode' since the 2026-09-09 re-export (was 'display').
  'display-mode': { target: 'display-mode', modeAxis: 'light-dark' },

  theme: { target: 'theme' },

  // Shared control geometry. Projected into Button's partial (remapped onto its
  // public var names) AND kept global, so input/nav/container get the geometry too.
  structure: {
    target: { scoped: 'sherpa-button', alsoGlobal: 'structure' },
    attr: 'data-size',
    renameMap: {
      'structure/height': 'sherpa-button-size-height',
      'structure/icon-size': 'sherpa-button-size-icon',
      'structure/structure-font/size': 'sherpa-button-font-size',
      'structure/structure-font/line-height': 'sherpa-button-font-line-height',
      'structure/structure-space/gap': 'sherpa-button-space-gap',
      'structure/structure-space/padding': 'sherpa-button-space-padding',
    },
  },
  // Slug is 'layout' since the 2026-09-09 re-export (was 'grid').
  layout: { target: 'layout', attr: null }, // breakpoints handled bespoke below
  elevation: { target: 'elevation', attr: 'data-elevation' },

  // attr:null — the per-status cascade is emitted bespoke as --_status-* (see
  // statusBlocks), so this avoids a second redundant --sherpa-style-* cascade.
  style: { target: 'style', attr: null },

  // Typography lives in Theme's `content/` group and data-viz series in
  // `theme.data-viz` — both emitted bespoke below, so neither has a route here.

  // Component-scoped collections → a partial; non-primary modes → :host([attr=…]).
  input: { target: { scoped: 'sherpa-input-text' }, attr: 'data-state' },
  // Navigation scopes the RAIL; items read its indent tiers by cascade.
  navigation: { target: { scoped: 'sherpa-nav' }, attr: 'data-nav-state' },
  switch: { target: { scoped: 'sherpa-switch' }, attr: 'data-type' },

  // Extension-only collections (no leaves in the dump) — read from the cache.
  // Data Viz extensions → [data-palette="<name>"] @layer style. Status re-points
  // series 1-5 onto the status ramps, so any chart speaks status by colouring its
  // marks by POSITION as usual — no chart needs status-aware code.
  'data-viz-status': { target: 'skip' },
  'data-viz-set-2': { target: 'skip' },
  'style-transparent': { target: 'skip' }, // → [data-look="transparent"] @layer style
  'style-saturated': { target: 'skip' }, // → [data-look="saturated"] @layer style
  // Per-corner rounding + per-edge border width. Modes are POSITION along an axis,
  // and the parent IS a row → [data-group="start"] etc.
  // `publicSlug` keeps the EMITTED names stable across the Border → Grouping rename:
  // leafName() only strips a leading group matching the collection slug, so without
  // it this emits --sherpa-grouping-border-top and every component (which reads
  // --sherpa-border-top) silently loses its border.
  grouping: { target: 'border', attr: 'data-group', publicSlug: 'border' },
  // Pre-rename slug. An older dump can still carry it.
  border: { target: 'border', attr: 'data-border' },

  // The 4 POSITION extensions of Grouping → [data-group] blocks in @layer border.
  'vertical': { target: 'skip' },
  'grid-top': { target: 'skip' },
  'grid-mid': { target: 'skip' },
  'grid-bottom': { target: 'skip' },

  // Retired snap extensions — kept routed so an older cache does not warn.
  'snap-all-edges': { target: 'skip' },
  'snap-right-edge': { target: 'skip' },
  'snap-left-edge': { target: 'skip' },
  'snap-top-edge': { target: 'skip' },
  'snap-bottom-edge': { target: 'skip' },
  // Pre-rename slugs — an unrouted slug warns, and an older cache still carries them.
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
  'display-mode-compact': { target: 'skip' }, // → [data-density] @layer display-mode
  'display-mode-comfortable': { target: 'skip' },
  // The extension cache still uses the pre-rename slugs — keep them routed so the
  // density extensions resolve from it.
  'display-compact': { target: 'skip' },
  'display-comfortable': { target: 'skip' },

  // Empty in this dump — explicit skips so they don't warn.
  'layout-calendar-d': { target: 'skip' },
  'layout-calendar-m-y': { target: 'skip' },
  'layout-app-shell': { target: 'skip' },
};

// ── helpers ─────────────────────────────────────────────────────────────────

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
// A scoped collection's mode can alias a MODE-SWITCHED collection (Navigation
// `hover` → {elevation.blur}). In Figma the component also pins that collection's
// mode; in CSS `var(--sherpa-elevation-blur)` resolves against :root, i.e. the
// PRIMARY mode — `passthrough`, all zeros — so the shadow silently vanished.
// Redirect such a value to the target collection's own named mode instead.
const MODE_ALIAS_TARGETS = {
  elevation: {
    // Which Elevation mode a scoped mode implies; unknown ones fall through.
    modeMap: { hover: 'lg' },
    raw: true,
    // The shadow COLOUR is the status shadow, not part of the step ramp.
    skip: new Set(['color']),
  },
};


/**
 * One Elevation step's value for a property, read from the dump — never a table in
 * this file, which has gone stale twice as the ramp moved. Returns a complete CSS
 * value, or null when the collection has no such property or mode.
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
 * A COMPOSED colour → CSS. The DTCG export flattens Figma's hue+alpha model and
 * SILENTLY DROPS the alpha (it once turned every drop shadow fully opaque), so the
 * opacity is carried in `$extensions[…].opacity` and re-applied here. `color-mix` is
 * the only way to put an alpha on a value that is itself a var(). 100% returns the
 * plain value.
 */
function withOpacity(css, opacityRef) {
  if (css == null || !opacityRef) return css;
  const m = /effects[./]opacity[./](\d+)/.exec(String(opacityRef));
  if (!m) return css;
  const pct = Number(m[1]) / 10;            // opacity/500 → 50
  if (!Number.isFinite(pct) || pct >= 100) return css;
  return `color-mix(in srgb, ${css} ${pct}%, transparent)`;
}

/** A leaf's public var name: drop a redundant repeated collection segment so the
 * emitted name matches what refName() produces for a ref at the same leaf. The group
 * either PREFIXES the collection name (style/style-surface) or IS it
 * (border/border/top → --sherpa-border-top, not --sherpa-border-border-top). */
function leafName(path) {
  let segs = path;
  if (segs[1] && (segs[1] === segs[0] || segs[1].startsWith(segs[0] + '-'))) {
    segs = segs.slice(1);
  }
  return `--${PREFIX}${toIdent(segs)}`;
}

/**
 * Leaf paths whose Figma FLOAT is a COUNT, not a length. Figma exports every FLOAT as
 * DTCG `dimension`, so a count projects with `px` and voids the declaration
 * (`repeat(4px, 1fr)` is invalid — the layout grid rendered as nothing). Keep this
 * tight: a genuine length here loses its unit.
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
      // A count must project UNITLESS or the declaration is void — see COUNT_PATHS.
      type: COUNT_PATHS.test(rawPath) ? 'number' : node.$type,
      modes: ext.modes ?? {},
      primaryMode: ext.primaryMode,
      // Per-mode alpha the DTCG export drops — re-applied by withOpacity().
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
// scope → the CSS property it should paint. Warn when a leaf's scope disagrees with
// the ref-family it resolves to. Warnings only — no behaviour change.
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
  if (isStroke && !isFill && /\.surface\./.test(target)) {
    warn(`scope mismatch: ${leaf.name} is STROKE_COLOR but resolves to a surface family (${target})`);
  }
  if (isFill && !isStroke && /\.border\./.test(target)) {
    warn(`scope mismatch: ${leaf.name} is a fill scope but resolves to a border family (${target})`);
  }
  if (s.includes('TEXT_FILL') && /\.(surface|border)\./.test(target) && !/\.content\./.test(target)) {
    warn(`scope mismatch: ${leaf.name} is TEXT_FILL (${SCOPE_PROP.TEXT_FILL}) but resolves to ${target}`);
  }
}

// @property registrations — nothing to register. An @property for a variable nothing
// sets is worse than nothing: it gives the name a valid initial value, so a typo
// resolves silently rather than failing loudly.
/* `@property` MUST be registered from a DOCUMENT sheet. In an adopted sheet it
   parses, lists in cssRules and even reports true from CSS.supports() — and
   does nothing: the value stays an untyped string, so arithmetic and
   `if(style(...))` comparisons silently fail.
   `.sherpa-group-grid` in core/sherpa-grouping.css is the consumer.
   TRAP T-at-property-needs-the-document. */
const propertyRegistrations = `/* Registered HERE because a shadow root cannot.
   TRAP T-at-property-needs-the-document. */
@property --sherpa-group-index { syntax: "<number>"; inherits: false; initial-value: 0; }
@property --sherpa-group-col { syntax: "<number>"; inherits: false; initial-value: 0; }
@property --sherpa-group-row { syntax: "<number>"; inherits: false; initial-value: 0; }
@property --sherpa-group-last-col { syntax: "<number>"; inherits: false; initial-value: 0; }
@property --sherpa-group-last-row { syntax: "<number>"; inherits: false; initial-value: 0; }`;

// ════════════════════════════════════════════════════════════════════════════
// Collect leaves per collection and route them. Each layer bucket holds `root`
// (primary lines), `rootDark` (light-dark re-point) and `modeBlocks`. The bespoke
// sections below are slotted into their layer at write time.
// ════════════════════════════════════════════════════════════════════════════
const GLOBAL_LAYERS = ['core', 'display-mode', 'theme', 'layout', 'structure', 'border', 'style', 'elevation'];
const layers = {};
for (const name of GLOBAL_LAYERS) layers[name] = { root: [], rootDark: [], modeBlocks: [] };
const scopedPartials = []; // { comp, css }
/** [data-group] position blocks — adopted, not linked. */
const groupPositionBlocks = [];

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

  // ── global target: a layer name ──
  if (typeof route.target === 'string' && layers[route.target]) {
    const L = layers[route.target];
    const byMode = {};
    for (const leaf of leaves) {
      if (typeof leaf.value === 'boolean') continue; // scoped visibility flags only
      const v = withOpacity(toCss(leaf.value, leaf.type), leaf.opacity[leaf.primaryMode ?? 'light']);
      if (v == null) continue;
      L.root.push(`  ${leaf.name}: ${v};`);
      if (route.modeAxis === 'light-dark' && leaf.modes.dark != null) {
        const dv = withOpacity(toCss(leaf.modes.dark, leaf.type), leaf.opacity.dark);
        if (dv != null && dv !== v) L.rootDark.push(`  ${leaf.name}: ${dv};`);
      }
      if (!route.attr) continue;
      for (const [mode, mval] of Object.entries(leaf.modes)) {
        const mv = withOpacity(toCss(mval, leaf.type), leaf.opacity[mode]);
        if (mv == null) continue;
        (byMode[mode] ??= []).push(`    ${leaf.name}: ${mv};`);
      }
    }
    for (const [mode, lines] of Object.entries(byMode)) {
      const block = `  [${route.attr}="${mode}"] {\n${lines.join('\n')}\n  }`;
      // A [data-group] position must reach INSIDE a shadow root, so it goes to
      // the adopted sheet rather than this document layer.
      if (route.attr === 'data-group') groupPositionBlocks.push(block);
      else L.modeBlocks.push(block);
    }
    continue;
  }

  // ── scoped target → a component partial (optionally also global) ──
  if (typeof route.target === 'object' && route.target.scoped) {
    if (route.target.alsoGlobal && layers[route.target.alsoGlobal]) {
      const L = layers[route.target.alsoGlobal];
      for (const leaf of leaves) {
        if (typeof leaf.value === 'boolean') continue;
        const v = toCss(leaf.value, leaf.type);
        if (v == null) continue;
        L.root.push(`  ${leaf.name}: ${v};`);
      }

      // The NON-PRIMARY modes too, as [data-size] blocks. Without them a component
      // Figma pins to Structure=sm has no way to reach the sm values, and every such
      // icon silently gets the default size.
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
        // `passthrough` NULLS the border widths rather than being a size, so it
        // gets its own attribute — on [data-size] it would compete with the real
        // sizes and a passthrough element could not also be sm.
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

// ── interactive states via color-mix ────────────────────────────────────────
// Figma carries no hover/down leaves. Mix each surface seed toward `currentColor`
// (8% hover, 16% down), which darkens on light grounds and lightens on dark ones —
// so one derivation is correct in both modes.
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

// Warn if the cache carries a collection ROUTING never mentions.
for (const slug of Object.keys(extDoc)) {
  if (!(slug in ROUTING)) warn(`extension cache collection "${slug}" is not in ROUTING`);
}

/**
 * A scoped component partial. Non-primary modes become :host([attr="mode"]). Booleans
 * become private `--_<flag>` visibility vars (true→revert-layer, false→none) the
 * component reads with `display: var(--_flag, …)` — visibility stays in CSS.
 */
function buildScopedPartial(slug, comp, attr, leaves, renameMap) {
  const primaryMode = leaves.find((l) => l.primaryMode)?.primaryMode ?? 'default';
  const rootVars = [];
  const byMode = {};
  // hasFoo → --_has-foo, isFoo → --_is-foo; the component consumes the bare name.
  const flagName = (path) =>
    '--_' +
    path[path.length - 1].replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  const vis = (b) => (b ? 'revert-layer' : 'none');
  for (const leaf of leaves) {
    const isBool = typeof leaf.value === 'boolean';
    // A renameMap maps rawPath → the public var; unmapped leaves are dropped.
    let name;
    if (renameMap) {
      const mapped = renameMap[leaf.rawPath];
      if (!mapped) continue;
      name = `--${PREFIX}${mapped.replace(/^sherpa-/, '')}`;
    } else {
      name = isBool ? flagName(leaf.path) : leaf.name;
    }
    // `mode` matters for cross-collection aliases — see MODE_ALIAS_TARGETS.
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
// Typography — one utility class per size step, from Theme's flat `content/` leaves
// (`content/size/<step>`, `line-height/<step>`, `letter-spacing/<step>`, plus the
// step-independent `weight/<w>` ramp and `content/font/*`). There is no mode axis.
// Weight is a separate axis, so each class gets a sensible default (headings →
// semibold, body → regular) and a consumer overrides font-weight on the element.
// ════════════════════════════════════════════════════════════════════════════
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
 * A typography property at a size step → CSS value. `prop` is a per-step group
 * ('size'|'line-height'|'letter-spacing'), or a fully-qualified step-independent key
 * ('weight/regular', 'paragraph-spacing') resolved as-is.
 */
function typoVal(prop, mode, type) {
  const key = prop.includes('/') || prop === 'paragraph-spacing' ? prop : `${prop}/${mode}`;
  const rec = typoBy[key];
  if (!rec) return null;
  return toCss(rec.value, type ?? rec.type);
}
/** Hero/Mono share body's sizes and differ only by font-family, so this always
 * defers to the base typography value. */
function extTypoVal(_slug, _prop, _mode) {
  return null;
}

// The two family atoms. The extension cache never captured the `family` override,
// so hero uses the body font and mono the mono font.
const FONT_BODY = '"Inter", system-ui, sans-serif';
const FONT_MONO = 'ui-monospace, "JetBrains Mono", monospace';

function textClass(className, family, valueOf) {
  // `:where(.class)` = ZERO specificity, so any app rule overrides these utilities.
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
  // body
  textClassBlocks.push(
    textClass(`sherpa-text-${mode}`, `var(--sherpa-font-family-body, ${FONT_BODY})`, (p) =>
      p === 'weight' ? typoVal(`weight/${wt}`, mode) : typoVal(p, mode),
    ),
  );
  // hero — body sizes, body family
  textClassBlocks.push(
    textClass(`sherpa-text-hero-${mode}`, `var(--sherpa-font-family-body, ${FONT_BODY})`, (p) =>
      p === 'weight'
        ? extTypoVal('hero', `weight/${wt}`, mode) ?? typoVal(`weight/${wt}`, mode)
        : extTypoVal('hero', p, mode) ?? typoVal(p, mode),
    ),
  );
  // mono
  textClassBlocks.push(
    textClass(`sherpa-text-mono-${mode}`, `var(--sherpa-font-family-mono, ${FONT_MONO})`, (p) =>
      p === 'weight'
        ? extTypoVal('mono', `weight/${wt}`, mode) ?? typoVal(`weight/${wt}`, mode)
        : extTypoVal('mono', p, mode) ?? typoVal(p, mode),
    ),
  );
}

// Font atoms — the stable public names component CSS consumes, each derived from a
// real weight-ramp or size step so the values track Figma.
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
// The count follows the dump, never a hardcoded number, so a palette change cannot
// leave the CSS emitting a series the tokens no longer define. A mark's fill moves
// along its ramp; its BORDER does not — it is the series' identity, so
// --sherpa-data-viz-series-border-N rides alongside each hue.
// ════════════════════════════════════════════════════════════════════════════
const categoricalLines = [];
const seriesBorderLines = [];
{
  // Theme holds `data-viz/sequence/<n>/color <s>` (ten sequences of ten steps, each
  // carrying its 50%) plus `sequence-border/<n>`, that ramp's colour 5 held solid.
  // A chart wants ONE colour per series: sequence N's MID step, and its border.
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
// Status palette — [data-palette="status"] re-points the series onto the status
// ramps. As an ATTRIBUTE rather than per-component code: every chart already colours
// its marks by POSITION, so one attr turns any of them into a status chart. Both the
// --sherpa-categorical-* names and the --sherpa-data-viz-series-* aliases are
// re-pointed, because charts consume whichever they were written against.
// ════════════════════════════════════════════════════════════════════════════
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
      // The 50% is applied HERE, not inherited: a Figma extension override replaces
      // the whole composed value, so the cached override is a flat colour.
      const tinted = `color-mix(in srgb, ${val} 50%, transparent)`;
      lines.push(`    --sherpa-categorical-${n}: ${tinted};`);
      lines.push(`    --sherpa-data-viz-series-${n}: ${tinted};`);
      if (borderVal != null) lines.push(`    --sherpa-data-viz-series-border-${n}: ${borderVal};`);
    }
    // Sort by series index; the unnumbered border sorts to the top.
    const idx = (l) => Number(l.match(/-(\d+):/)?.[1] ?? -1);
    lines.sort((a, b) => idx(a) - idx(b) || a.localeCompare(b));
    if (lines.length) {
      paletteBlocks.push(`  [data-palette="${palette}"] {\n${lines.join('\n')}\n  }`);
    }

    // STATUS also gets a variable NAMED for each status: its five sequences ARE the
    // five statuses, so a status is a MODE here, not a series index. A gauge paints
    // several at once and cannot pin five modes. These live OUTSIDE the
    // [data-palette] block — a chart names a status without opting into the palette.
    if (slug === 'data-viz-status') {
      const order = ['success', 'warning', 'urgent', 'critical', 'info'];
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
// The `style` collection's 8 status modes map onto the public cascade vars.
// ════════════════════════════════════════════════════════════════════════════
const STATUS_MODES = ['info', 'critical', 'warning', 'urgent', 'success', 'active', 'inactive'];
const STATUS_ROLE_MAP = {
  'style-surface/base': '_status-surface',
  'style-surface/base +1': '_status-surface-subtle',
  'style-surface/base +2': '_status-surface-strong',
  'style-surface/shadow': '_status-shadow',
  'style-border/base': '_status-border',
  // A status-tinted rule/stroke (chart lines, dividers) — the neutral
  // `_status-border` cannot express these.
  'style-border/base +1': '_status-border-strong',
  // A DATA MARK under a status pin: fill is the ramp mid at 50%, border the same
  // solid. Not `_status-border-strong`, which is a CARD's border step.
  'style-surface/data-viz': '_status-data-viz',
  'style-border/data-viz': '_status-data-viz-border',
  'style-content/base': '_status-text',
  'style-content/inverse': '_status-text-on-color',
  'style-indicator/accent': '_status-icon',
};
const statusBlocks = [];
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
// Look tiers — style-transparent / style-saturated, from the extension cache. A tier
// re-points the same status cascade vars per status mode, so [data-look][data-status]
// composes. Values are literal hex (extension overrides don't serialise as refs).
// ════════════════════════════════════════════════════════════════════════════
const LOOK_ROLE_MAP = {
  'style-surface/base': '_status-surface',
  'style-surface/base +1': '_status-surface-subtle',
  'style-surface/base +2': '_status-surface-strong',
  'style-surface/shadow': '_status-shadow',
  'style-border/base': '_status-border',
  // A status-tinted rule/stroke (chart lines, dividers) — the neutral
  // `_status-border` cannot express these.
  'style-border/base +1': '_status-border-strong',
  // A DATA MARK under a status pin: fill is the ramp mid at 50%, border the same
  // solid. Not `_status-border-strong`, which is a CARD's border step.
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
    const status = mode === defaultMode ? null : mode; // the default tier has no status
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
// Grouping — per-position borders ([data-group]) from the extension cache. Position
// lives in EXTENSION collections because a Figma extension inherits its parent's
// modes and cannot add its own. ONE SIDE OWNS the shared edge (a neighbour to the
// right drops the right edge), so no halving and no negative overlap.
//
// The public names below must match what leafName() emits: `rounding/*` does NOT
// repeat the collection name so it keeps the `border-` prefix, unlike `border/top`
// where the duplicate is stripped. Get it wrong and grouping silently stops
// squaring corners while every consumer reads a name nothing defines.
// ════════════════════════════════════════════════════════════════════════════
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
// A position is COLLECTION + MODE: `grid-top` at mode `start` is the top-left cell.
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
    if (lines.length) groupPositionBlocks.push(`  [data-group="${slug}-${mode}"] {\n${lines.join('\n')}\n  }`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Density — display-compact / display-comfortable. Full light/dark ramps that
// OVERRIDE the display collection, emitted as [data-density="<name>"] blocks plus a
// dark re-point. Names mirror the display leaf names so they shadow the core ramp.
// ════════════════════════════════════════════════════════════════════════════
function densityBlock(slug, name) {
  const cache = extDoc[slug]?.vars;
  if (!cache) {
    warn(`density "${slug}" missing from extension cache`);
    return { light: '', dark: '' };
  }
  const lightLines = [];
  const darkLines = [];
  for (const [rawPath, byMode] of Object.entries(cache)) {
    // Prefix must match the base ramp's var names (--sherpa-display-mode-*).
    const cssName = `--${PREFIX}${toIdent(['display-mode', ...rawPath.split('/')])}`;
    // The cache stores bare values (no $type). The weight ramp must stay unitless —
    // `400px` silently voids every font-weight under [data-density].
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

// ── elevation shadow convenience aliases ────────────────────────────────────
const shadowAliasLines = [
  // The shadow COLOUR is style-surface/shadow directly: Elevation carries geometry
  // only, so `--sherpa-elevation-color` does not exist. One token also means a
  // status re-point moves every shadow in the system together.
  '  --sherpa-shadow-sm: var(--sherpa-elevation-offset-x, 0) var(--sherpa-elevation-offset-y, 1px) var(--sherpa-elevation-blur, 2px) var(--sherpa-elevation-spread, 0) var(--sherpa-style-surface-shadow, #35353d4c);',
  '  --sherpa-shadow-md: var(--sherpa-elevation-offset-x, 0) var(--sherpa-elevation-offset-y, 4px) var(--sherpa-elevation-blur, 12px) var(--sherpa-elevation-spread, 0) var(--sherpa-style-surface-shadow, #35353d4c);',
  '  --sherpa-shadow-lg: var(--sherpa-elevation-offset-x, 0) var(--sherpa-elevation-offset-y, 12px) var(--sherpa-elevation-blur, 32px) var(--sherpa-elevation-spread, 0) var(--sherpa-style-surface-shadow, #35353d4c);',
];

// ── .sherpa-view frame utility — NO CONSUMER as of 2026-09-18 ───────────────
// It duplicates sherpa-app-shell in the light DOM; see TRAP
// T-the-shell-is-a-component-not-a-region-map. Kept because an app that cannot use a
// custom element has nowhere else to go. If nothing claims it, delete this block.
//
// The nav is an OVERLAY: absolute down the left edge, with the header/body inset by
// the COLLAPSED rail width only, so hovering reveals it OVER the content instead of
// reflowing. The inset grows only when the rail is latched open.
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

// ── emit global tokens.css ──────────────────────────────────────────────────
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

/** A :root block for a layer's primary lines (skips empty). */
const rootBlock = (lines) => (lines.length ? `  :root {\n${lines.join('\n')}\n  }` : '');
/** The light/dark re-point pair for a layer's dark lines. */
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
// The DOCUMENT reset. `html` and `body` are outside every shadow root, so only a
// light-DOM sheet can reach them and tokens.css is the only one Sherpa ships. It
// sits in `core` (the FIRST layer) so an app overrides it with one unlayered rule.
//
// The height chain matters: a percentage height resolves against the PARENT's, so
// one `height:auto` anywhere collapses everything below it to content height.
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

const coreLayer = `@layer core {
${rootBlock(layers.core.root)}

${documentResetBlock}
}`;

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

// theme — scoped [data-theme="sherpa"], and also :root so a document with no
// data-theme still resolves. A second named theme is just another block.
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
}`;
/* The text-role CLASSES are not here. tokens.css holds tokens; a class built
   OUT of them goes to sherpa-typography.css, which a shadow root can adopt.
   TRAP T-a-document-class-cannot-reach-a-shadow-root. */


// ── layout: responsive breakpoint blocks + the .sherpa-grid utility ─────────
// The Layout collection's modes ARE the breakpoints, and a mode pin has no meaning
// in CSS on its own — a viewport mode IS a media query. Emitted as
// `@media (min-width: …)` in ascending order.
const layoutBreakpointBlocks = (() => {
  const leaves = [...walkLeaves(doc.layout ?? {}, ['layout'])];
  const bp = leaves.find((l) => l.rawPath === 'layout/breakpoint');
  if (!bp) return [];
  // sorted ascending so later (wider) blocks win.
  const modes = Object.entries(bp.modes)
    .map(([mode, value]) => ({ mode, min: Number(toCss(value, 'dimension')?.replace('px', '')) }))
    .filter((m) => Number.isFinite(m.min))
    .sort((a, b) => a.min - b.min);

  return modes.map(({ mode, min }) => {
    const lines = [];
    for (const leaf of leaves) {
      // The breakpoint itself is the QUERY, not a value inside it.
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

// The grid utility views lay themselves out on. It consumes the projected values, so
// it re-flows at each breakpoint block above with no per-view media queries.
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
  .sherpa-grid > [data-span='full'] { grid-column: 1 / -1; }

  /* ── Row sizing — two variants, and the default is neither ───────────────
     No attribute: rows size to their CONTENT and the page scrolls, which is
     how every view behaved before these existed.
     TRAP T-a-content-grid-has-two-row-modes */

  /* FIXED — every row one grid row high, and the area scrolls.

     block-size: 100% is what makes overflow mean anything: without it the grid
     grew to 656px inside a 500px parent and scrolled nothing. */
  .sherpa-grid[data-rows='fixed'] {
    grid-auto-rows: var(--sherpa-layout-grid-row-height, 64px);
    block-size: 100%;
    min-block-size: 0;
    overflow-y: auto;
  }

  /* FIT — rows hug their content, the grid fills its area exactly, and one
     item takes what is left. Nothing scrolls.

     --_fit-rows is the ROW COUNT BEFORE THE FILLER, written by JS because CSS
     cannot see it. A grid item can never be taller than its row, so the ROW
     must be 1fr — and there is no way to name the last auto row. Seven shapes
     were measured; the trap lists them.
     TRAP T-a-fit-grid-needs-its-row-count */
  .sherpa-grid[data-rows='fit'] {
    block-size: 100%;
    min-block-size: 0;
    /* AUTO, not hidden: when the rows above already exceed the area the filler
       hits its floor and the grid scrolls rather than crushing it. Content is
       never lost — at that size it simply behaves like the default mode. */
    overflow-y: auto;
    grid-template-rows: repeat(var(--_fit-rows, 0), min-content) 1fr;
  }
  /* The filler, named by data-grow; with none, the LAST child fills.
     Its FLOOR is two grid rows: below that there is no room for a header and a
     line of content, so scrolling is the honest answer. */
  .sherpa-grid[data-rows='fit'] > [data-grow],
  .sherpa-grid[data-rows='fit']:not(:has(> [data-grow])) > :last-child {
    min-block-size: calc(
      2 * var(--sherpa-layout-grid-row-height, 64px)
      + var(--sherpa-layout-grid-gap-vertical, 16px)
    );
    block-size: 100%;
  }`;

const layoutLayer = `@layer layout {
${rootBlock(layers.layout.root)}
${layoutBreakpointBlocks.length ? '\n' + layoutBreakpointBlocks.join('\n\n') + '\n' : ''}
${gridUtilityBlock}

  /* View frame utility — the light-DOM app shell renderView() wraps a view in. */
${viewFrameBlock}
}`;

// structure — bound sizes and spacing only. Rounding and border width live in
// @layer border.
const structureLayer = `@layer structure {
${rootBlock(layers.structure.root)}
${layers.structure.modeBlocks.length ? '\n' + joinBlocks(layers.structure.modeBlocks) + '\n' : ''}}`;

/* The [data-group] POSITION blocks appear BOTH here and in the adopted
   core/sherpa-group-positions.css. Not an oversight: a bare attribute selector
   in this document sheet can never match an element inside a shadow root, and
   an adopted sheet can never match one in the page. Both are real — a host app
   groups controls in its own markup, a component groups them in its template —
   so the same generated blocks are emitted to each.
   TRAP T-grouping-is-an-attribute-and-a-class.
   TRAP T-a-document-class-cannot-reach-a-shadow-root. */
const borderLayer = `@layer border {
${rootBlock(layers.border.root)}
${layers.border.modeBlocks.length ? '\n' + joinBlocks(layers.border.modeBlocks) + '\n' : ''}
  /* Grouping — per-position borders + rounding ([data-group]). */
${joinBlocks(groupPositionBlocks)}
}`;

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

/* The same text classes, unwrapped from their @layer so a shadow root can adopt
   them. `:where()` keeps them at ZERO specificity, so a component's own rule
   still wins — which is what makes them safe to adopt everywhere. */
writeFileSync(
  OUT_TYPOGRAPHY,
  `/**
 * sherpa-typography.css — GENERATED by scripts/project-tokens.mjs. Do not edit.
 *
 * Adopted into every shadow root beside sherpa-base.css, because the same
 * classes in tokens.css reach the document only.
 * TRAP T-a-document-class-cannot-reach-a-shadow-root.
 */
${textClassBlocks.join('\n\n').replace(/^ {2}/gm, '')}
`,
);

/* The [data-group] POSITION blocks, unwrapped from @layer so a shadow root can
   adopt them. The same rules in tokens.css never matched anything: every
   consumer sits inside a shadow root, which a bare document selector cannot
   reach. TRAP T-a-document-class-cannot-reach-a-shadow-root. */
writeFileSync(
  OUT_GROUP_POSITIONS,
  `/**
 * sherpa-group-positions.css — GENERATED by scripts/project-tokens.mjs. Do not edit.
 *
 * data-group names an item's POSITION in a row, column or grid, so a template
 * or a JS property change can join controls with no CSS of its own. The values
 * are the Figma Grouping matrix.
 *
 * Adopted into every shadow root; the hand-written .sherpa-group* classes in
 * sherpa-grouping.css derive the same thing by position instead.
 * TRAP T-grouping-is-an-attribute-and-a-class.
 * TRAP T-a-document-class-cannot-reach-a-shadow-root.
 */
${groupPositionBlocks.join('\n\n').replace(/^ {2}/gm, '')}
`,
);

// ── inline component token regions into <comp>.css ──────────────────────────
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
    `  border       ${layers.border.root.length} vars, ${groupPositionBlocks.length} group positions\n` +
    `  style        ${layers.style.root.length} vars, ${statusBlocks.length} status, ${lookBlocks.length} look, ${categoricalLines.length / 2} series, ${seriesBorderLines.length} border, ${paletteBlocks.length} palette\n` +
    `  elevation    ${layers.elevation.root.length} vars, ${shadowAliasLines.length} shadow aliases, ${layers.elevation.modeBlocks.length} [data-elevation]\n` +
    `✓ ${wrote} component token regions inlined into <comp>.css\n` +
    `${warnings.length ? `⚠ ${warnings.length} warning(s) — see above` : '✓ no warnings'}`,
);
