#!/usr/bin/env node
// WARNING: Do not generate or modify css/styles/tokens/sherpa-functions.css in this script.
// All @function definitions are hand-maintained and must be edited directly in that file.
/**
 * generate-css-tokens.js — Per-axis CSS token generator
 *
 * Emits the entire token cascade into `css/styles/`.
 *
 * Output tree:
 *
 *   css/styles/
 *   ├── index.css                          ← @layer cascade + @import order
 *   ├── reset.css                          ← hand-maintained
 *   ├── tokens/
 *   │   ├── primitives.css          ← hand-maintained (oklch values)
 *   │   ├── sherpa-alias.css               ← generated: alias + @property regs
 *   │   └── sherpa-platform.css            ← generated: platform constants
 *   ├── sherpa-themes.css                  ← generated: all themes (base + extended)
 *   ├── sherpa-density-compact.css         ← generated
 *   ├── sherpa-density-comfortable.css     ← generated
 *   ├── sherpa-status.css                  ← generated
 *   ├── sherpa-data-viz-classes.css        ← generated
 *   └── sherpa-{icon,motion,text,utility,app}-classes.css ← hand-maintained
 *
 * Architecture choices (locked in plan):
 *   - `:where(...)` wraps every selector → zero specificity, components always win.
 *   - No `light-dark()`. Each theme file declares light values and nests dark+HC
 *     overrides gated by `[data-mode]` attribute OR a `prefers-*` media query →
 *     progressive enhancement: works without JS.
 *   - HC mode === Figma's "High Contrast" mode end-to-end (no bolt-on).
 *   - `data-mode="auto"` honours both `prefers-color-scheme` AND `prefers-contrast`.
 *   - `@property` registers interpolatable color/length tokens for smooth
 *     animation on theme/mode swap.
 *
 * Usage: node scripts/generate-css-tokens.js (alias: npm run tokens:generate)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC_CSS = path.join(ROOT, 'css', 'styles');
const OUT_CSS = path.join(ROOT, 'css', 'styles');
const DATA_FILE      = path.join(ROOT, 'figma-tokens', 'figma-variables.json');
const OVERRIDES_FILE = path.join(ROOT, 'figma-tokens', 'token-overrides.json');
const CONFIG_FILE    = path.join(ROOT, 'figma-tokens', 'figma-config.json');

// ─── Data loading ────────────────────────────────────────────────────

const data      = JSON.parse(fs.readFileSync(DATA_FILE,      'utf8'));
const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));

// Read figma-config.json for shared validation thresholds (same values as
// used by extract-figma-vars.js) so both scripts agree on what counts as valid.
let figmaConfig = {};
try { figmaConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { /* optional */ }
const MIN_ALIAS_VARS = figmaConfig.aliasValidation?.minVarCount ?? 150;

const primitives = data.Primitives;
const themesMeta = data.themes;

// Live Alias collection only. The pre-May-2026 snapshot has been retired.
// If the Alias collection ever appears shallow after extraction, the
// minVarCount guard in figma-config.json will emit a warning before this
// script runs — see extract-figma-vars.js ~L377.
const aliases = data.Alias || { vars: [] };

const baseThemeName = themesMeta?.base?.name || 'Apex 2.0';
const baseThemeSlug = themesMeta?.base?.slug || 'apex-2-core';
const status = data.Status;
const density = data['Density (Alias)'] || data.Density;

if (!data[baseThemeName]) {
  console.error(`Base theme "${baseThemeName}" missing`);
  process.exit(1);
}
if (!status) {
  console.error('Status collection missing');
  process.exit(1);
}
if (!density) {
  console.error('Density collection missing');
  process.exit(1);
}

const primitiveNames = new Set(primitives.vars.map((v) => v.n));
const aliasNames = new Set(aliases.vars.map((v) => v.n));

/**
 * Reverse map: primitive name → canonical semantic alias name.
 *
 * Built from the alias snapshot — any alias whose value is `@<primitive>` makes
 * that primitive substitutable. When multiple aliases point at the same
 * primitive (e.g. `color/info/200` AND `color/primary/cyan/200` both alias
 * `color/basic/blue-green/100`), the alias whose first segment ranks highest in
 * `ALIAS_NAMESPACE_PRIORITY` wins.
 *
 * Used by `refToVar` so generated `sherpa-themes.css` / `sherpa-overrides.css`
 * consume `var(--sherpa-color-*)` aliases instead of `var(--core-*)` primitives
 * wherever an alias exists — keeps the core tier off-limits to non-alias files.
 */
const ALIAS_NAMESPACE_PRIORITY = [
  'color/neutral/',
  'color/brand/',
  'color/critical/',
  'color/warning/',
  'color/success/',
  'color/info/',
  'color/urgent/',
  'color/primary/new/',
  'color/primary/blue/',
  'color/primary/cyan/',
  'color/primary/classic/',
  'color/tones/',
];
function aliasRank(name) {
  for (let i = 0; i < ALIAS_NAMESPACE_PRIORITY.length; i++) {
    if (name.startsWith(ALIAS_NAMESPACE_PRIORITY[i])) return i;
  }
  return ALIAS_NAMESPACE_PRIORITY.length;
}
const primToAlias = (() => {
  const map = new Map();
  for (const v of aliases.vars) {
    const val = v.v?.Value;
    if (typeof val !== 'string' || !val.startsWith('@')) continue;
    const prim = val.slice(1);
    if (!primitiveNames.has(prim)) continue;
    const existing = map.get(prim);
    if (!existing || aliasRank(v.n) < aliasRank(existing)) map.set(prim, v.n);
  }
  return map;
})();

/**
 * Hand-coded alias gap fills.
 *
 * Figma's Alias collection covers semantic colours but doesn't expose semantic
 * names for `effects/opacity/*` (used in `color-mix()` alpha), `effects/offset/*`
 * (used in shadow chains), the full `color/basic|extended/*` ramps (only
 * curated steps reach the `color/neutral|info|success|…` semantic aliases),
 * or the `transparent` overlay ramp. These entries:
 *   1. extend `primToAlias` so `refToVar` substitutes them in generated themes;
 *   2. drive an extra block emitted into `sherpa-alias.css` (see emitAlias).
 *
 * Palette gap-fills: every `color/{basic|extended}/<family>/<step>` primitive
 * gets a `color/palette/<family>/<step>` alias. Pre-existing curated aliases
 * (e.g. `color/neutral/200` → `monochrome/50`) still win because we only set
 * when the primitive is not already mapped.
 *
 * Overlay (alpha) ramp gets its own `color/overlay/<step>` namespace since
 * `transparent/*` carries alpha and doesn't belong with the opaque palette.
 */
const {
  effectsOpacitySteps: EFFECTS_OPACITY_STEPS = [0, 100, 200, 300, 400, 500],
  effectsOffsetSteps:  EFFECTS_OFFSET_STEPS  = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
  explicit:            explicitAliases        = [],
} = overrides.extraAliases || {};

const EXTRA_ALIASES = [
  // Effects — opacity scale (used in color-mix alpha)
  ...EFFECTS_OPACITY_STEPS.map((n) => ({ name: `opacity/${n}`,       primitive: `effects/opacity/${n}` })),
  // Effects — shadow offset scale
  ...EFFECTS_OFFSET_STEPS.map( (n) => ({ name: `shadow/offset/${n}`, primitive: `effects/offset/${n}`  })),
  // One-off extras from token-overrides.json
  ...explicitAliases,
];

// Auto-sweep every basic|extended colour primitive and coin a palette/<family>
// alias. The `transparent` family routes to `color/overlay/*` instead because
// its values carry alpha.
for (const v of primitives.vars) {
  if (v.t !== 'COLOR') continue;
  const m = v.n.match(/^color\/(basic|extended)\/([a-z0-9-]+)\/(\d+|base)$/);
  if (!m) continue;
  const [, , family, step] = m;
  const aliasName =
    family === 'transparent' ? `color/overlay/${step}` : `color/palette/${family}/${step}`;
  EXTRA_ALIASES.push({ name: aliasName, primitive: v.n });
}

for (const { name, primitive } of EXTRA_ALIASES) {
  if (!primitiveNames.has(primitive)) continue;
  if (!primToAlias.has(primitive)) primToAlias.set(primitive, name);
  aliasNames.add(name);
}

// ─── Utilities ───────────────────────────────────────────────────────

/**
 * Canonical token renames applied to every generated CSS property name.
 * Keys and values are post-sanitize (kebab-case) substrings.
 *
 * Adding an entry here renames the token in all output layers (primitives,
 * alias, themes, overrides) in one pass. For breaking renames, add a
 * backwards-compat alias in emitAlias() to keep existing consumers working.
 */
const RENAME_MAP = new Map([
  ['adlumin-blue-test', 'adlumin-blue'],       // Figma renamed the collection
  ['fonts-context-monospaced', 'fonts-context-mono'], // Match new Figma path
]);

function applyRenames(cssName) {
  let out = cssName;
  for (const [from, to] of RENAME_MAP) out = out.replaceAll(from, to);
  return out;
}

function sanitize(name) {
  const s = name
    .replace(/ -> /g, '-')
    .replace(/\//g, '-')
    .replace(/ /g, '-')
    .replace(/[\[\]]/g, '')
    .toLowerCase();
  return applyRenames(s);
}

/** Figma "critical" → CSS "error" everywhere it appears in a token name. */
function renameStatus(name) {
  return name.replace(/\bcritical\b/g, 'error');
}

/** Theme variable Figma path → CSS custom property name. */
function apexToCSS(figmaName) {
  let n = renameStatus(figmaName);
  if (n.startsWith('surface/status/')) n = n.replace('surface/status/', 'surface/context/');
  else if (n.startsWith('border/status/')) n = n.replace('border/status/', 'border/context/');
  if (n.startsWith('content/status/')) n = n.replace('content/status/', 'text/context/');
  else if (n.startsWith('content/default/')) n = n.replace('content/default/', 'text/default/');
  else if (n.startsWith('content/primary/')) n = n.replace('content/primary/', 'text/primary/');
  else if (n.startsWith('content/inactive/')) n = n.replace('content/inactive/', 'text/inactive/');
  else if (n.startsWith('content/active/')) n = n.replace('content/active/', 'text/active/');
  return `--sherpa-${sanitize(n)}`;
}

/** Same as apexToCSS but for the icon namespace. */
function contentToIcon(figmaName) {
  let n = renameStatus(figmaName);
  if (n.startsWith('content/default/')) n = n.replace('content/default/', 'icon/context/default/');
  else if (n.startsWith('content/primary/')) n = n.replace('content/primary/', 'icon/primary/');
  else if (n.startsWith('content/status/')) n = n.replace('content/status/', 'icon/context/');
  else if (n.startsWith('content/inactive/')) n = n.replace('content/inactive/', 'icon/inactive/');
  else if (n.startsWith('content/active/')) n = n.replace('content/active/', 'icon/active/');
  return `--sherpa-${sanitize(n)}`;
}

/** Canonical content/* Figma path → --sherpa-content-* CSS custom property.
 *  Used at theme level; text/* and icon/* aliases live at component :host scope. */
function contentToCSSName(figmaName) {
  let n = renameStatus(figmaName);
  if (n.startsWith('content/status/')) n = n.replace('content/status/', 'content/context/');
  return `--sherpa-${sanitize(n)}`;
}

/** "@target/path" → var(--sherpa-...) — picks Primitive vs Alias vs Theme namespace.
 *  `preferAlias` (default true) substitutes a semantic alias when one exists for
 *  a primitive ref; set false when generating sherpa-alias.css itself to avoid
 *  self-referential aliases like `--sherpa-color-neutral-200: var(--sherpa-color-neutral-200)`. */
function refToVar(ref, { iconMode = false, preferAlias = true } = {}) {
  if (typeof ref !== 'string' || !ref.startsWith('@')) return null;
  const name = ref.slice(1);
  if (primitiveNames.has(name)) {
    const aliasName = preferAlias ? primToAlias.get(name) : null;
    return aliasName ? `var(--sherpa-${sanitize(aliasName)})` : `var(--core-${sanitize(name)})`;
  }
  if (aliasNames.has(name)) return `var(--sherpa-${sanitize(name)})`;
  // Theme-collection target → use contentToCSSName for content/* (single canonical var).
  if (name.startsWith('content/')) return `var(${contentToCSSName(name)})`;
  // Pattern-based primitive sniffing (matches legacy generator behaviour).
  const primPatterns = [
    'color/basic/',
    'color/extended/',
    'border/radius/',
    'border/stroke/',
    'border/dash/',
    'scale/',
    'effects/',
    'motion/',
    'typeface/',
  ];
  if (primPatterns.some((p) => name.startsWith(p))) {
    const aliasName = preferAlias ? primToAlias.get(name) : null;
    return aliasName ? `var(--sherpa-${sanitize(aliasName)})` : `var(--core-${sanitize(name)})`;
  }
  // Fallback — assume it's a sibling theme/alias var.
  return `var(${apexToCSS(name)})`;
}

function formatNumber(val, hint = '') {
  if (val === 0) return '0';
  const r = Math.round(val * 1000) / 1000;
  if (hint.includes('letter-spacing')) return `${r}`;
  if (Math.abs(r) < 1) return `${r}`;
  return `${r}px`;
}

function formatVal(val, type, hint = '', opts = {}) {
  const ref = refToVar(val, opts);
  if (ref) return ref;
  if (typeof val === 'string' && val.startsWith('rgba(')) {
    return val.replace(/(\d+\.\d{2})\d+/g, '$1').replace(/\.0+\)/g, ')');
  }
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') {
    if (type === 'FLOAT') return formatNumber(val, hint);
    return String(val);
  }
  return String(val);
}

function formatValIcon(val, type) {
  const ref = refToVar(val, { iconMode: true });
  if (ref) return ref;
  return formatVal(val, type);
}

// ─── color-mix() helpers (rgba with partial alpha → token reference) ────────

/** Map "r,g,b" → CSS var name for every fully-opaque primitive colour.
 *  Prefers the matching semantic alias (--sherpa-color-*) when one exists,
 *  falling back to the raw --core-* primitive otherwise. */
const primRgbMap = (() => {
  const map = new Map();
  for (const v of primitives.vars) {
    if (v.t !== 'COLOR' || !v.v?.Value) continue;
    const m = v.v.Value.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
    if (!m) continue;
    const alpha = parseFloat(m[4]);
    if (Math.round(alpha) !== 1) continue; // only opaque primitives
    const aliasName = primToAlias.get(v.n);
    const varName = aliasName ? `--sherpa-${sanitize(aliasName)}` : `--core-${sanitize(v.n)}`;
    map.set(`${m[1]},${m[2]},${m[3]}`, varName);
  }
  return map;
})();

/** Map opacity-scale value (0–100 integer) → CSS var for effects/opacity/* tokens.
 *  Prefers the matching semantic alias (--sherpa-opacity-*) when one exists. */
const primOpacityMap = (() => {
  const map = new Map();
  for (const v of primitives.vars) {
    if (v.t !== 'FLOAT' || !v.n.startsWith('effects/opacity/')) continue;
    const val = v.v?.Value;
    if (val == null) continue;
    const aliasName = primToAlias.get(v.n);
    const varName = aliasName ? `--sherpa-${sanitize(aliasName)}` : `--core-${sanitize(v.n)}`;
    map.set(Math.round(val), varName);
  }
  return map;
})();

/**
 * Convert rgba(r,g,b,a) with a < 1 into an `--alpha(--c, --pct)` call that
 * references the matching core colour primitive and opacity token. The
 * `--alpha()` function is defined in css/styles/tokens/sherpa-functions.css.
 * Returns null if no matching primitive is found (caller falls back to raw rgba).
 */
function tryColorMix(rgba) {
  const m = rgba.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  if (!m) return null;
  const alpha = parseFloat(m[4]);
  if (alpha >= 1) return null;
  const rgbKey = `${m[1]},${m[2]},${m[3]}`;
  const colorVar = primRgbMap.get(rgbKey);
  if (!colorVar) return null;
  const pct = Math.round(alpha * 100);
  const opacityVar = primOpacityMap.get(pct);
  const pctArg = opacityVar ? `var(${opacityVar})` : `${pct}`;
  return `--alpha(var(${colorVar}), ${pctArg})`;
}

/** Resolve a theme variable's raw value (may be @ref, rgba, hex, number, bool). */
function formatThemeVal(rawVal, type, hint, { iconMode = false } = {}) {
  if (rawVal == null) return null;
  const ref = refToVar(rawVal, { iconMode });
  if (ref) return ref;
  if (typeof rawVal === 'string' && rawVal.startsWith('rgba(')) {
    const colorMix = tryColorMix(rawVal);
    if (colorMix) return colorMix;
    return rawVal.replace(/(\d+\.\d{2})\d+/g, '$1').replace(/\.0+\)/g, ')');
  }
  if (typeof rawVal === 'string') return rawVal;
  if (typeof rawVal === 'boolean') return String(rawVal);
  if (typeof rawVal === 'number') {
    if (type === 'FLOAT') return formatNumber(rawVal, hint);
    return String(rawVal);
  }
  return String(rawVal);
}

// ─── File writers ────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(relPath, content) {
  const fullPath = path.join(OUT_CSS, relPath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`  ✓ ${relPath} (${content.length} bytes)`);
}

function header(title, description) {
  return `/**
 * ${title}
 * Auto-generated from Figma Variables — do not edit manually.
 * Regenerate: node scripts/generate-css-tokens.js
 *
 * ${description}
 */\n\n`;
}

// ─── Emit: tokens/primitives.css ─────────────────────────────────────
// Generated from the Figma Primitives collection. Do not edit the output
// file manually — edit token-overrides.json or Figma instead.

/**
 * Section grouping for primitives output. Mirrors the structure of the
 * former hand-maintained file so diffs remain readable. Each entry is
 * [prefix, title] — a var whose path starts with `prefix/` goes into
 * that section. Vars not matching any prefix fall into "Other".
 */
const PRIMITIVE_SECTIONS = [
  ['border/dash',     'Border — Dash'],
  ['border/radius',   'Border — Radius'],
  ['border/stroke',   'Border — Stroke'],
  ['effects/blur',    'Effects — Blur'],
  ['effects/offset',  'Effects — Offset'],
  ['effects/opacity', 'Effects — Opacity'],
  ['effects/spread',  'Effects — Spread'],
  ['motion',          'Motion'],
  ['scale',           'Scale'],
  ['typeface',        'Typeface'],
  ['color/basic/monochrome',   'Color — Basic: Monochrome'],
  ['color/basic/greyscale',    'Color — Basic: Greyscale'],
  ['color/basic/adlumin-blue', 'Color — Basic: Adlumin Blue'],
  ['color/basic/blue-green',   'Color — Basic: Blue-Green'],
  ['color/basic/blue',         'Color — Basic: Blue'],
  ['color/basic/green',        'Color — Basic: Green'],
  ['color/basic/orange',       'Color — Basic: Orange'],
  ['color/basic/pink',         'Color — Basic: Pink'],
  ['color/basic/purple',       'Color — Basic: Purple'],
  ['color/basic/red',          'Color — Basic: Red'],
  ['color/basic/yellow',       'Color — Basic: Yellow'],
  ['color/basic',              'Color — Basic (other)'],
  ['color/extended/chrome-orange',   'Color — Extended: Chrome Orange'],
  ['color/extended/cool-green',      'Color — Extended: Cool Green'],
  ['color/extended/cool-red',        'Color — Extended: Cool Red'],
  ['color/extended/deep-purple',     'Color — Extended: Deep Purple'],
  ['color/extended/electric-indigo', 'Color — Extended: Electric Indigo'],
  ['color/extended/neon-blue',       'Color — Extended: Neon Blue'],
  ['color/extended/phlox',           'Color — Extended: Phlox'],
  ['color/extended/razamatazz',      'Color — Extended: Razamatazz'],
  ['color/extended/raven',           'Color — Extended: Raven'],
  ['color/extended/slate',           'Color — Extended: Slate'],
  ['color/extended/turquoise',       'Color — Extended: Turquoise'],
  ['color/extended/warm-green',      'Color — Extended: Warm Green'],
  ['color/extended/warm-yellow',     'Color — Extended: Warm Yellow'],
  ['color/extended',                 'Color — Extended (other)'],
  ['color/brand',    'Color — Brand'],
  ['color',          'Color (other)'],
];

function formatPrimitive(val, type) {
  if (val == null) return null;
  if (typeof val === 'string' && val.startsWith('rgba(')) {
    return val.replace(/(\d+\.\d{2})\d+/g, '$1').replace(/\.0+\)/g, ')');
  }
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'number') return formatNumber(val);
  return String(val);
}

function emitPrimitives() {
  const lines = [
    header(
      'Core Primitives',
      'Raw Figma Primitives collection — do not use directly in component CSS.\n' +
        ' * Always consume via --sherpa-* alias tokens with a hardcoded fallback.',
    ),
    ':root {\n',
  ];

  // Assign each var to its first matching section prefix
  const buckets = new Map(); // section title → vars[]
  const matched = new Set();

  for (const [prefix, title] of PRIMITIVE_SECTIONS) {
    buckets.set(title, []);
  }
  buckets.set('Other', []);

  for (const v of primitives.vars) {
    let placed = false;
    for (const [prefix, title] of PRIMITIVE_SECTIONS) {
      if (v.n.startsWith(prefix + '/') || v.n === prefix) {
        buckets.get(title).push(v);
        placed = true;
        break;
      }
    }
    if (!placed) buckets.get('Other').push(v);
  }

  let first = true;
  for (const [title, vars] of buckets) {
    if (vars.length === 0) continue;
    if (!first) lines.push('\n');
    first = false;
    lines.push(`  /* ── ${title} ${'─'.repeat(Math.max(1, 52 - title.length))} */\n`);
    const sorted = [...vars].sort((a, b) => a.n.localeCompare(b.n));
    for (const v of sorted) {
      const val = formatPrimitive(v.v?.Value, v.t);
      if (val == null) continue;
      lines.push(`  --core-${sanitize(v.n)}: ${val};\n`);
    }
  }

  lines.push('}\n');

  // Safety guard: primitives.css is effectively hand-maintained.
  // The Figma Variables API for the Primitives collection often returns only
  // a handful of variables (not the full color palette). If we have fewer than
  // 50 primitive vars, skip the write to avoid overwriting the good file.
  const MIN_PRIMITIVES = 50;
  if (primitives.vars.length < MIN_PRIMITIVES) {
    console.warn(
      `  ⚠ Skipping tokens/primitives.css — Figma returned only ${primitives.vars.length} primitive var(s) ` +
        `(expected ≥ ${MIN_PRIMITIVES}). Keeping existing file.`,
    );
    return;
  }
  write('tokens/primitives.css', lines.join(''));
}

// ─── Emit: tokens/alias.css ──────────────────────────────────────────

function emitAlias() {
  const lines = [];

  lines.push(
    header(
      'Alias Tokens — Semantic',
      'Mode-less semantic tokens (Figma "Alias" collection).\n' +
        ' * Theme files reference these; switching theme rebinds — switching mode\n' +
        ' * never touches this layer.\n' +
        ' *\n' +
        ' * `@property` registrations at the top of the file enable smooth\n' +
        ' * interpolation when theme/mode tokens that resolve here animate.',
    ),
  );

  // ── @property registrations for interpolatable tokens ──
  // Only register tokens whose downstream theme value is a <color> or
  // <length>; anything else is left unregistered to avoid syntax errors.
  lines.push('/* ── @property registrations ──────────────────────────────────── */\n');
  lines.push('/* These let the UA interpolate token swaps (theme/mode change)    */\n\n');

  const colorAliasNames = aliases.vars
    .filter((v) => v.t === 'COLOR' && v.v?.Value != null && !v.n.startsWith('properties/'))
    .map((v) => `--sherpa-${sanitize(v.n)}`);
  for (const propName of colorAliasNames) {
    lines.push(
      `@property ${propName} { syntax: "<color>"; inherits: true; initial-value: transparent; }\n`,
    );
  }
  lines.push('\n');

  // ── Alias values ──
  lines.push(':where(:root) {\n');
  lines.push('  color-scheme: light dark;\n\n');

  const categories = {};
  for (const v of aliases.vars) {
    if (v.n.startsWith('properties/')) continue;
    if (v.v?.Value == null) continue;
    const cat = v.n.split('/')[0];
    (categories[cat] ||= []).push(v);
  }

  const catOrder = ['border', 'color', 'effects', 'fonts', 'size', 'space'];
  for (const cat of catOrder.filter((c) => categories[c])) {
    const vars = categories[cat].sort((a, b) => a.n.localeCompare(b.n));
    const title = cat[0].toUpperCase() + cat.slice(1);
    lines.push(`  /* ── ${title} ${'─'.repeat(Math.max(1, 56 - title.length))} */\n`);
    for (const v of vars) {
      lines.push(
        `  --sherpa-${sanitize(v.n)}: ${formatVal(v.v.Value, v.t, v.n, { preferAlias: false })};\n`,
      );
    }
    if (cat === 'fonts') {
      lines.push(`  --sherpa-fonts-context-default: var(--core-typeface-open-sans-style-name);\n`);
    }
    lines.push('\n');
  }

  // Base density default — overridden by [data-density] in density/*.css
  lines.push('  /* Base density default — overridden by [data-density] axis */\n');
  lines.push('  --sherpa-space-default: var(--core-scale-200);\n');

  // ── Hand-coded gap-fill aliases (see EXTRA_ALIASES) ──
  // Figma doesn't expose semantic names for these effects primitives; we coin
  // them here so generated theme files can reference them via the alias layer
  // instead of reaching into --core-* directly.
  const extraByGroup = EXTRA_ALIASES.reduce((acc, e) => {
    const group = e.name.split('/').slice(0, -1).join('/') || e.name;
    (acc[group] ||= []).push(e);
    return acc;
  }, {});
  for (const group of Object.keys(extraByGroup)) {
    const title = group.replace(/\//g, ' ');
    lines.push(`\n  /* ── ${title} ${'─'.repeat(Math.max(1, 56 - title.length))} */\n`);
    for (const { name, primitive } of extraByGroup[group]) {
      if (!primitiveNames.has(primitive)) continue;
      lines.push(`  --sherpa-${sanitize(name)}: var(--core-${sanitize(primitive)});\n`);
    }
  }
  lines.push('}\n\n');

  // ── Backwards-compat aliases for renamed tokens ──
  // Remove each entry once all component CSS references are updated.
  lines.push('/* ── Backwards-compat aliases (renamed tokens) ─────────────────── */\n\n');
  lines.push(':where(:root) {\n');
  lines.push('  /* fonts-context-monospaced renamed to fonts-context-mono (match Figma path) */\n');
  lines.push('  --sherpa-fonts-context-monospaced: var(--sherpa-fonts-context-mono);\n');
  lines.push('}\n\n');

  // ── Font composite tokens ──
  // These are sourced from the base theme's font/* vars (unmoded — same in
  // every theme) so they live in the alias layer.
  lines.push(emitFontsBlock());

  // Safety guard: sherpa-alias.css contains hundreds of semantic tokens.
  // If the Figma Alias collection returned fewer vars than the configured minimum
  // (figma-config.json aliasValidation.minVarCount), the API response is truncated
  // — skip the write to protect the existing file. The extract script should have
  // already aborted before we got here, but this is a second line of defence.
  if (aliases.vars.length < MIN_ALIAS_VARS) {
    console.warn(
      `  ⚠ Skipping tokens/sherpa-alias.css — Figma returned only ${aliases.vars.length} alias var(s) ` +
        `(expected ≥ ${MIN_ALIAS_VARS}). Keeping existing file.`,
    );
    return;
  }
  write('tokens/sherpa-alias.css', lines.join(''));
}

function emitFontsBlock() {
  const lines = [];
  const baseTheme = data[baseThemeName];
  const fontVars = baseTheme.vars
    .filter((v) => v.n.startsWith('font/'))
    .sort((a, b) => a.n.localeCompare(b.n));
  if (fontVars.length === 0) return '';

  lines.push('/* ── Font composite tokens ──────────────────────────────────── */\n\n');
  lines.push(':where(:root) {\n');

  const groups = new Map();
  for (const v of fontVars) {
    const sizeName = v.n.split('/')[1];
    (groups.get(sizeName) || groups.set(sizeName, []).get(sizeName)).push(v);
  }
  const sizeOrder = ['h1', 'h2', 'h3', 'h4', 'h5', 'lg', 'base', 'sm', 'xs'];
  for (const size of sizeOrder.filter((s) => groups.has(s))) {
    const vars = groups.get(size).sort((a, b) => a.n.localeCompare(b.n));
    lines.push(`  /* ── ${size} ── */\n`);
    for (const v of vars) {
      lines.push(`  --sherpa-${sanitize(v.n)}: ${formatVal(v.v.Light, v.t, v.n)};\n`);
    }
    lines.push('\n');
  }
  lines.push('}\n');
  return lines.join('');
}

// ─── Emit: tokens/platform.css ───────────────────────────────────────
// True platform constants ONLY. No compat aliases (Phase 3 codemod removes
// every legacy name from component CSS so this file stays clean).

/**
 * Breakpoint block for platform.css. Values sourced from token-overrides.json
 * `breakpoints` key so they can be updated without touching the script.
 * NOTE: CSS custom properties cannot be used in @media query conditions —
 * these tokens are for JS consumption and documentation only.
 */
function emitBreakpoints() {
  const bp = overrides.breakpoints;
  if (!bp || Object.keys(bp).length === 0) return '';
  const lines = ['\n  /* Breakpoints — JS consumption only; cannot be used in @media conditions */\n'];
  for (const [name, val] of Object.entries(bp)) {
    lines.push(`  --sherpa-breakpoint-${name}: ${val};\n`);
  }
  return lines.join('');
}

function emitPlatform() {
  const fw = overrides.fontWeights || {};
  const mo = overrides.motion || {};
  const css = `${header(
    'Platform Tokens — system constants',
    'System constants without a direct Figma alias: z-index, focus ring,\n' +
      ' * backdrop, content widths, color-scheme contract. Font weights, motion,\n' +
      ' * and breakpoints ARE defined in Figma but are sourced from\n' +
      ' * token-overrides.json (font weights: Figma stores style NAMES not CSS\n' +
      ' * numbers; motion: Sherpa values are a deliberate hand-tune).',
  )}\n:where(:root) {
  /* Font weights — CSS numbers from token-overrides.json (Figma stores names) */
  --sherpa-font-weight-regular:  ${fw.regular ?? 400};
  --sherpa-font-weight-medium:   ${fw.medium ?? 500};
  --sherpa-font-weight-semibold: ${fw.semibold ?? 600};
  --sherpa-font-weight-bold:     ${fw.bold ?? 700};

  /* Default body line-height */
  --sherpa-line-height-default: 1.5;

  /* Motion — durations + easing from token-overrides.json.
     Deliberate hand-tune (Figma has motion/duration/* but design keeps
     these independently authored so transitions can be adjusted freely). */
  --sherpa-motion-duration-fast: ${mo.durationFast ?? '0.15s'};
  --sherpa-motion-duration-base: ${mo.durationBase ?? '0.25s'};
  --sherpa-motion-duration-slow: ${mo.durationSlow ?? '0.4s'};
  --sherpa-motion-easing-default: ${mo.easingDefault ?? 'ease-out'};

  /* Z-index scale */
  --sherpa-z-panel:   100;
  --sherpa-z-popover: 1000;
  --sherpa-z-toast:   1100;

  /* Modal backdrop tint (sherpa-dialog ::backdrop, view-header scroll-under) */
  --sherpa-effects-backdrop: rgba(0, 0, 0, 0.4);

  /* Focus ring (consumed by component :focus-visible outlines) */
  --sherpa-effects-focus-ring: 0 0 0 2px var(--sherpa-color-primary-new-base, #c046ff);

  /* Content width scale */
  --sherpa-content-width-md: 720px;

  /* Search-result highlight tint */
  --sherpa-surface-search-highlight: rgba(255, 216, 64, 0.35);

  /* Default AI accent gradient */
  --sherpa-ai-accent-gradient: linear-gradient(
    135deg,
    var(--sherpa-color-brand-base, #c046ff) 0%,
    var(--sherpa-color-primary-new-base, #5e3df5) 100%
  );

  /* Hairline divider — used for card/footer/accordion separators, line-chart
     gridlines, and the node-canvas grid. No Figma source: lighter than
     border-container-default by intent. */
  --sherpa-border-container-subtle: rgba(0, 0, 0, 0.08);
${emitBreakpoints()}}

/* ── Color-scheme contract ─────────────────────────────────────────── */
/* JS sets data-mode on :root; the cascade does the rest.              */

:where(:root[data-mode="light"]) { color-scheme: light; }
:where(:root[data-mode="dark"])  { color-scheme: dark; }
:where(:root[data-mode="hc"])    { color-scheme: light dark; }
`;
  write('tokens/sherpa-platform.css', css);
}

// ─── Emit: themes/{slug}.css ─────────────────────────────────────────

const SECTION_ORDER = [
  // ── Surface ──────────────────────────────────────────────
  ['surface/app', 'Surface — App Chrome'],
  ['surface/product-bar', 'Surface — App Chrome'],
  ['surface/container', 'Surface — Container'],
  ['surface/control', 'Surface — Control (Interactive)'],
  ['surface/status', 'Surface — Context (Status)'],
  ['surface/tag', 'Surface — Component'],
  ['surface/button', 'Surface — Component'],
  // ── Border ───────────────────────────────────────────────
  ['border/container', 'Border — Container'],
  ['border/control', 'Border — Control (Interactive)'],
  ['border/status', 'Border — Context (Status)'],
  ['border/warning', 'Border — Context (Status)'],
  ['border/info', 'Border — Context (Status)'],
  ['border/error', 'Border — Context (Status)'],
  ['border/success', 'Border — Context (Status)'],
  ['border/urgent', 'Border — Context (Status)'],
  ['border/focused', 'Border — Focus'],
  ['border/tag', 'Border — Component'],
  // ── Other ────────────────────────────────────────────────
  ['elevation', 'Elevation'],
  ['data-viz/categorical', 'Data Visualization — Categorical'],
  ['data-viz/sequential', 'Data Visualization — Sequential'],
  ['data-viz/divergent', 'Data Visualization — Divergent'],
  ['component', 'Component'],
  // ── Content-derived text tokens (emitted via apexToCSS mapping) ───
  ['content/default', 'Text / Icon — Default'],
  ['content/primary', 'Text / Icon — Primary'],
  ['content/active', 'Text / Icon — Active'],
  ['content/inactive', 'Text / Icon — Inactive'],
  ['content/status', 'Text / Icon — Context (Status)'],
  // ── Deprecated ───────────────────────────────────────────
  ['[DEPRECATED] data-viz', 'Data Visualization — Legacy'],
];

function classifySection(figmaPath) {
  for (const [prefix, label] of SECTION_ORDER) {
    if (figmaPath.startsWith(prefix + '/') || figmaPath === prefix) return label;
  }
  return null;
}

/**
 * Derive a human-readable section label for content/* Figma variables.
 * Both the text prop and icon prop for the same variable share this section
 * so that related text+icon pairs are emitted under one header.
 */
function contentGroupSection(figmaPath) {
  const parts = figmaPath.replace(/^content\//, '').split('/');
  if (parts[0] === 'status') {
    const label = renameStatus(parts[1]);
    return `Text & Icon — Context: ${label[0].toUpperCase()}${label.slice(1)}`;
  }
  const label = parts[0].replace(/-/g, ' ');
  return `Text & Icon — ${label[0].toUpperCase()}${label.slice(1)}`;
}

/**
 * Build per-mode prop maps for one theme.
 * Returns { light, dark, hc, sectionByProp } where each map is propName→value
 * (theme + icon + text variants combined). Only color & float vars; strings
 * and `properties/*` excluded.
 */
function buildThemeMaps(themeName) {
  const collection = data[themeName];
  if (!collection) {
    console.error(`Theme "${themeName}" missing`);
    process.exit(1);
  }

  const light = new Map();
  const dark = new Map();
  const hc = new Map();
  const sectionByProp = new Map();
  const orderByProp = []; // preserves first-seen order for stable output

  function record(propName, mode, val, section) {
    if (val == null) return;
    if (mode === 'light' && !light.has(propName)) {
      light.set(propName, val);
      orderByProp.push(propName);
      if (section) sectionByProp.set(propName, section);
    }
    if (mode === 'dark') dark.set(propName, val);
    if (mode === 'hc') hc.set(propName, val);
  }

  for (const v of collection.vars) {
    if (v.t === 'STRING' || v.t === 'BOOLEAN') continue;
    if (v.n.startsWith('properties/')) continue;
    if (v.n.startsWith('font/')) continue; // fonts live in alias layer
    const lightRaw = v.v?.Light;
    const darkRaw = v.v?.Dark;
    const hcRaw = v.v?.['High Contrast'];

    const isContent = v.n.startsWith('content/');
    const sectionLabel = isContent
      ? contentGroupSection(v.n)
      : classifySection(v.n) || v.n.split('/').slice(0, 2).join(' / ');

    if (isContent) {
      // Canonical content/* var — one property per Figma token at theme level.
      // Text and icon aliases live at component :host scope.
      const propName = contentToCSSName(v.n);
      record(propName, 'light', formatThemeVal(lightRaw, v.t, v.n), sectionLabel);
      record(propName, 'dark', formatThemeVal(darkRaw, v.t, v.n), null);
      record(propName, 'hc', formatThemeVal(hcRaw, v.t, v.n), null);
    } else {
      // Non-content vars use apexToCSS naming (surface, border, elevation, etc.)
      const propName = apexToCSS(v.n);
      record(propName, 'light', formatThemeVal(lightRaw, v.t, v.n), sectionLabel);
      record(propName, 'dark', formatThemeVal(darkRaw, v.t, v.n), null);
      record(propName, 'hc', formatThemeVal(hcRaw, v.t, v.n), null);
    }
  }

  return { light, dark, hc, sectionByProp, orderByProp };
}

function emitThemeFile(themeEntry, maps, refMaps) {
  const { name: themeName, slug } = themeEntry;
  const isDefault = refMaps == null;

  // ── Build per-mode override maps ──
  // Default theme: emit ALL light values; dark/hc emit only diffs from own light.
  // Extended theme: emit only diffs from base theme. For dark/hc we also re-emit
  // any light-diffed prop so the cascade can't leak the extended light value into
  // dark/hc mode. (Because extended-light selectors come AFTER core-dark blocks
  // in source order, an unhanded light-diff would override core-dark.)

  let lightOut, darkOut, hcOut;

  if (isDefault) {
    lightOut = maps.light;
    darkOut = new Map();
    for (const [k, v] of maps.dark) {
      if (maps.light.get(k) !== v) darkOut.set(k, v);
    }
    hcOut = new Map();
    for (const [k, v] of maps.hc) {
      const cascadeVal = maps.dark.get(k) ?? maps.light.get(k);
      if (cascadeVal !== v) hcOut.set(k, v);
    }
  } else {
    // ── Extended theme: diff vs base ──
    lightOut = new Map();
    for (const [k, v] of maps.light) {
      if (refMaps.light.get(k) !== v) lightOut.set(k, v);
    }

    const allKeys = new Set([
      ...maps.light.keys(),
      ...maps.dark.keys(),
      ...refMaps.light.keys(),
      ...refMaps.dark.keys(),
    ]);

    darkOut = new Map();
    for (const k of allKeys) {
      const tv = maps.dark.get(k) ?? maps.light.get(k);
      const rv = refMaps.dark.get(k) ?? refMaps.light.get(k);
      if (tv == null) continue;
      if (tv !== rv) {
        darkOut.set(k, tv);
      } else if (lightOut.has(k)) {
        // Light diffs but dark resolves equal to base — re-emit to prevent leak.
        darkOut.set(k, tv);
      }
    }

    const allKeysHC = new Set([...allKeys, ...maps.hc.keys(), ...refMaps.hc.keys()]);
    hcOut = new Map();
    for (const k of allKeysHC) {
      const tv = maps.hc.get(k) ?? maps.dark.get(k) ?? maps.light.get(k);
      const rv = refMaps.hc.get(k) ?? refMaps.dark.get(k) ?? refMaps.light.get(k);
      if (tv == null) continue;
      if (tv !== rv) {
        hcOut.set(k, tv);
      } else if (lightOut.has(k) || darkOut.has(k)) {
        // Same leak prevention for HC.
        hcOut.set(k, tv);
      }
    }
  }

  const lines = [];
  const sectionTitle = isDefault
    ? `${themeName} — Default theme (no data-theme attribute required)`
    : `${themeName} — Activate: <html data-theme="${slug}">`;
  const divider = '─'.repeat(Math.max(1, 60 - sectionTitle.length));
  lines.push(`/* ─── ${sectionTitle} ${divider} */\n\n`);

  // Build the per-mode selector lists.
  // - For the DEFAULT theme, include both bare `:root` AND `:root[data-theme="..."]`
  //   so a document with no data-theme attribute still gets the default tokens.
  // - For non-default themes, only the `:root[data-theme="..."]` form applies.
  function modeSel(modeAttr, notAttrs = []) {
    const notSuffix = notAttrs.map((a) => `:not([data-mode="${a}"])`).join('');
    const attrSuffix = modeAttr ? `[data-mode="${modeAttr}"]` : '';
    const themeAttr = `[data-theme="${slug}"]`;
    if (isDefault) {
      // Default theme: bare :root path + explicit data-theme path.
      const bare = `:root${attrSuffix}${notSuffix}`;
      const named = `:root${themeAttr}${attrSuffix}${notSuffix}`;
      return `:where(${bare}, ${named})`;
    }
    return `:where(:root${themeAttr}${attrSuffix}${notSuffix})`;
  }

  // ── Light values ──
  // Default theme: full token emission, sectioned by Figma category.
  // Extended theme: only the diff from base.
  if (lightOut.size > 0) {
    lines.push(
      `/* ── Light${isDefault ? ' (default)' : ' overrides'} ─────────────────────────── */\n`,
    );
    lines.push(`${modeSel('')} {\n`);
    if (isDefault) {
      // Group properties by section (preserving first-appearance order for sections)
      // so all props sharing a section header are contiguous — no alternating headers.
      const sectionOrder = [];
      const sectionGroups = new Map();
      for (const propName of maps.orderByProp) {
        if (!lightOut.has(propName)) continue;
        const section = maps.sectionByProp.get(propName) || '';
        if (!sectionGroups.has(section)) {
          sectionOrder.push(section);
          sectionGroups.set(section, []);
        }
        sectionGroups.get(section).push(propName);
      }
      for (const section of sectionOrder) {
        if (section) {
          lines.push(`\n  /* ── ${section} ${'─'.repeat(Math.max(1, 50 - section.length))} */\n`);
        }
        for (const propName of sectionGroups.get(section)) {
          lines.push(`  ${propName}: ${lightOut.get(propName)};\n`);
        }
      }
    } else {
      for (const propName of maps.orderByProp) {
        if (lightOut.has(propName)) lines.push(`  ${propName}: ${lightOut.get(propName)};\n`);
      }
    }
    lines.push('}\n\n');
  }

  // ── Dark overrides ──
  if (darkOut.size > 0) {
    lines.push(`/* ── Dark ──────────────────────────────────────────────────── */\n`);
    // Block 1: explicit opt-in via attribute (always wins over media query).
    lines.push(`${modeSel('dark')} {\n`);
    for (const [k, v] of darkOut) lines.push(`  ${k}: ${v};\n`);
    lines.push('}\n\n');
    // Block 2: OS preference — fires only when no explicit non-dark mode is set.
    lines.push('@media (prefers-color-scheme: dark) {\n');
    lines.push(`  ${modeSel('', ['light', 'hc'])} {\n`);
    for (const [k, v] of darkOut) lines.push(`    ${k}: ${v};\n`);
    lines.push('  }\n}\n\n');
  }

  // ── High Contrast overrides ──
  if (hcOut.size > 0) {
    lines.push(`/* ── High Contrast ─────────────────────────────────────────── */\n`);
    lines.push(`${modeSel('hc')} {\n`);
    for (const [k, v] of hcOut) lines.push(`  ${k}: ${v};\n`);
    lines.push('}\n\n');
    lines.push('@media (prefers-contrast: more) {\n');
    lines.push(`  ${modeSel('', ['light', 'dark'])} {\n`);
    for (const [k, v] of hcOut) lines.push(`    ${k}: ${v};\n`);
    lines.push('  }\n}\n\n');
  }

  return lines.join('');
}

function emitThemes() {
  console.log(`  Building theme "${baseThemeName}" (default)`);
  const baseMaps = buildThemeMaps(baseThemeName);
  const coreContent = emitThemeFile({ name: baseThemeName, slug: baseThemeSlug }, baseMaps, null);

  const extParts = [];
  for (const ext of themesMeta?.extended || []) {
    console.log(`  Building extended theme "${ext.name}"`);
    const extMaps = buildThemeMaps(ext.name);
    const content = emitThemeFile({ name: ext.name, slug: ext.slug }, extMaps, baseMaps);
    if (content) extParts.push(content);
  }

  const fileHeader = header(
    'Sherpa Themes — Base + Extended Theme Tokens',
    'All themes bundled in one file; [data-theme="..."] selectors ensure\n' +
      " * only the active theme's tokens apply. Every selector is wrapped in\n" +
      ' * :where() — zero specificity, components always win without `!important`.\n' +
      ' *\n' +
      ' * Default theme (apex-2-core): no data-theme attribute required.\n' +
      ' * Extended themes: set <html data-theme="apex-2-blue|apex-2-purple|apex-2-teal|classic">.',
  );
  const allContent = [coreContent, ...extParts].join('\n');
  write(
    'sherpa-themes.css',
    fileHeader + '\n@layer theme {\n\n' + allContent + '\n} /* @layer theme */\n',
  );
  console.log(`  → sherpa-themes.css`);
}

// ─── Emit: sherpa-overrides.css (density + status) ───────────────────

function emitOverrides() {
  const lines = [];
  lines.push(
    header(
      'Theme Corrections & Attribute-Driven Overrides',
      'Mixed origin: theme corrections are hand-coded in this script;\n' +
        ' * density and status sections are generated from Figma Variables.\n' +
        ' *\n' +
        ' *   Theme corrections  [@layer theme]\n' +
        ' *            Hand-maintained fixes for Figma-generated aliases that resolve\n' +
        ' *            to values that are visually incorrect. These patches come AFTER\n' +
        ' *            sherpa-themes.css in the @layer theme order so they win over\n' +
        ' *            the generated values.\n' +
        ' *\n' +
        ' *   Overrides  [@layer overrides]\n' +
        ' *            Unified layer containing all attribute-driven token modifications:\n' +
        ' *\n' +
        ' *            Density  [data-density="compact|comfortable"]\n' +
        ' *                     Applies to any subtree. Tokens cascade — descendant\n' +
        ' *                     components automatically rescale. Base density needs\n' +
        ' *                     no attribute.\n' +
        ' *\n' +
        ' *            Status   [data-status="critical|info|success|warning|urgent"]\n' +
        ' *                     Set on any element or the document root. Descendant\n' +
        ' *                     components consume the resulting --_status-* private\n' +
        ' *                     vars via var() fallbacks. Custom properties inherit\n' +
        ' *                     through shadow DOM — no per-component status block\n' +
        ' *                     needed.',
    ),
  );

  // ── Theme corrections (from token-overrides.json) ──
  // Previously hard-coded in this script. Edit figma-tokens/token-overrides.json
  // → themeCorrections.entries to add, remove, or annotate corrections.
  const corrections = overrides.themeCorrections?.entries || [];
  if (corrections.length > 0) {
    lines.push('\n/* ─── Theme corrections ─────────────────────────────────────────────── */\n\n');
    lines.push('@layer theme {\n\n');
    lines.push('  :where(:root) {\n');
    for (const { property, value } of corrections) {
      const pad = ' '.repeat(Math.max(1, 52 - property.length));
      lines.push(`    ${property}:${pad}${value};\n`);
    }
    lines.push('  }\n\n');
    lines.push('} /* @layer theme */\n\n');
  }

  // ── Overrides (Density + Status) ──
  lines.push('\n/* ─── Overrides (Density + Status) ────────────────────────────── */\n\n');
  lines.push('@layer overrides {\n\n');

  // Density section
  lines.push('  /* Density ─────────────────────────────────────────────────── */\n\n');
  for (const mode of ['Compact', 'Comfortable']) {
    const slug = mode.toLowerCase();
    lines.push(`  :where([data-density="${slug}"]) {\n`);
    const spaceVars = density.vars
      .filter((v) => v.n.startsWith('space/'))
      .sort((a, b) => a.n.localeCompare(b.n));
    for (const v of spaceVars) {
      const val = formatVal(v.v[mode], v.t);
      const prop = `--sherpa-${sanitize(v.n)}`;
      const pad = ' '.repeat(Math.max(1, 24 - prop.length));
      lines.push(`    ${prop}:${pad}${val};\n`);
    }
    lines.push('  }\n\n');
  }

  // Status section
  lines.push('  /* Status ──────────────────────────────────────────────────── */\n\n');
  for (const mode of ['critical', 'info', 'success', 'warning', 'urgent']) {
    lines.push(`  :where([data-status="${mode}"]) {\n`);
    for (const v of status.vars) {
      const prop = STATUS_PROP_MAP[v.n];
      if (!prop) continue;
      const raw = v.v[mode];
      if (raw === undefined) continue;
      const isIcon = v.n.startsWith('icon/');
      const val = isIcon ? formatValIcon(raw, v.t) : formatVal(raw, v.t);
      const pad = ' '.repeat(Math.max(1, 38 - prop.length));
      lines.push(`    ${prop}:${pad}${val};\n`);
    }
    lines.push('  }\n\n');
  }

  lines.push('} /* @layer overrides */\n');

  write('sherpa-overrides.css', lines.join(''));
}

// ─── Emit: status/status.css ─────────────────────────────────────────

// Read from token-overrides.json — previously a hard-coded constant.
const STATUS_PROP_MAP = overrides.statusPropMap || {};

function emitStatus() {
  // Deprecated: status is now emitted by emitOverrides() into sherpa-overrides.css
  // This stub is kept for backwards-compat in case external code calls it.
  console.warn('  ⚠ emitStatus() is deprecated — use emitOverrides() instead');
}

// ─── Emit: reset.css (copy) and index.css (cascade contract) ─────────

function emitReset() {
  // reset.css is hand-maintained at the canonical location and not regenerated.
  console.log(`  ✓ reset.css (hand-maintained, not overwritten)`);
}

function emitIndex() {
  const css = `/**
 * Sherpa Design System — Per-axis token cascade
 *
 * Cascade layers (lowest → highest):
 *   reset       — box-sizing, fonts, body defaults
 *   primitives  — raw design values (colors, scales, motion durations)
 *   alias       — semantic mode-less tokens; @property registrations
 *   platform    — system constants (focus ring, z-index, color-scheme contract)
 *   theme       — themed surface/text/border/icon (LIGHT default + nested dark/hc)
 *   overrides   — attribute-driven token modifications (density, status)
 *   components  — light DOM component overrides
 *   utilities   — class-based helpers (text/icon/motion/layout classes)
 *     ↳ utilities.icons   — icon font + .sherpa-icon sizing
 *     ↳ utilities.motion  — animation keyframes + transition utilities
 *     ↳ utilities.text    — typography classes
 *     ↳ utilities.layout  — grouped, app-shell, scroll-under patterns
 *
 * Switching axes (single source of truth — JS sets ATTRIBUTES only):
 *   Theme    — all themes bundled in sherpa-themes.css. Default (apex-2-core)
 *              always active; extended themes gated by [data-theme="<slug>"].
 *              To activate: set <html data-theme="<slug>"> (JS attribute only).
 *   Mode     — set <html data-mode="auto|light|dark|hc"> (default "auto")
 *              "auto" honours both prefers-color-scheme AND prefers-contrast.
 *   Density  — set [data-density="compact|base|comfortable"] on any subtree
 *   Status   — set [data-status="critical|info|success|warning|urgent"] on any element
 *
 * No light-dark(): each theme file declares its light values + nested dark
 * and HC override blocks (gated by data-mode attr OR a prefers-* media query).
 */

@layer reset, primitives, alias, platform, theme, overrides, components, utilities;
@layer utilities.icons, utilities.motion, utilities.text, utilities.layout;

@import "reset.css"                   layer(reset);
@import "tokens/primitives.css" layer(primitives);
@import "tokens/sherpa-alias.css"      layer(alias);
@import "tokens/sherpa-platform.css"   layer(platform);

/* All themes — default + four extended variants; [data-theme] selectors
 * ensure only the active theme fires. Activate: set <html data-theme="..."> */
@import "sherpa-themes.css";

/* Theme corrections & Overrides — all attribute-driven token modifications */
@import "sherpa-overrides.css";

/* Brand status — hand-maintained [data-status="brand"] token definitions;
 * appended after overrides so its @layer overrides rules take precedence */
@import "sherpa-brand-status.css";

/* Utilities — class-based helpers (sub-layered for cascade control) */
@import "sherpa-icon-classes.css"       layer(utilities.icons);
@import "sherpa-motion-classes.css"     layer(utilities.motion);
@import "sherpa-text-classes.css"       layer(utilities.text);
@import "sherpa-utility-classes.css"    layer(utilities.layout);
`;
  write('index.css', css);
}

// ─── Main ────────────────────────────────────────────────────────────

console.log('\n🎨 Generating CSS tokens v2 (per-axis)...\n');
console.log(`  Source: ${DATA_FILE}`);
console.log(`  Output: ${OUT_CSS}/\n`);

ensureDir(OUT_CSS);
emitReset();
emitPrimitives();
emitAlias();
emitPlatform();
emitThemes();
emitOverrides();
emitIndex();

console.log(`\n✅ generation complete — output under css/styles/\n`);
