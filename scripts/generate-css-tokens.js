#!/usr/bin/env node
/**
 * generate-css-tokens.js — Per-axis CSS token generator
 *
 * Emits the entire token cascade into `css/styles/`. Filenames preserve the
 * legacy convention (`sherpa-theme-{slug}.css`, `tokens/sherpa-alias.css`) so
 * external consumers (ThemeManager defaults, hard-coded <link> hrefs in HTML)
 * keep working without changes.
 *
 * Output tree:
 *
 *   css/styles/
 *   ├── index.css                          ← @layer cascade + @import order
 *   ├── reset.css                          ← hand-maintained
 *   ├── tokens/
 *   │   ├── sherpa-primitives.css          ← hand-maintained (oklch values)
 *   │   ├── sherpa-alias.css               ← generated: alias + @property regs
 *   │   └── sherpa-platform.css            ← generated: platform constants
 *   ├── sherpa-theme-{default-slug}.css    ← generated: full token surface
 *   ├── sherpa-theme-{extended-slug}.css   ← generated: diff-only against default
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
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');
const SRC_CSS    = path.join(ROOT, 'css', 'styles');
const OUT_CSS    = path.join(ROOT, 'css', 'styles');
const DATA_FILE  = path.join(ROOT, 'figma-tokens', 'figma-variables.json');

// ─── Data loading ────────────────────────────────────────────────────

const data       = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const primitives = data.Primitives;
const themesMeta = data.themes;

const SNAPSHOT_FILE = path.join(ROOT, 'figma-tokens', 'alias-snapshot.json');
const snapshotAlias = fs.existsSync(SNAPSHOT_FILE)
  ? (JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')).Alias || { vars: [] })
  : { vars: [] };
const liveAlias = data.Alias || { vars: [] };
const aliasMap = new Map();
for (const v of snapshotAlias.vars) aliasMap.set(v.n, v);
for (const v of liveAlias.vars) {
  if (v.v?.Value == null) continue;
  aliasMap.set(v.n, v);
}
const aliases = { ...liveAlias, vars: [...aliasMap.values()] };

const baseThemeName = themesMeta?.base?.name || 'Apex 2.0';
const baseThemeSlug = themesMeta?.base?.slug || 'apex-2-core';
const status        = data.Status;
const density       = data['Density (Alias)'] || data.Density;

if (!data[baseThemeName]) { console.error(`Base theme "${baseThemeName}" missing`); process.exit(1); }
if (!status)              { console.error('Status collection missing');              process.exit(1); }
if (!density)             { console.error('Density collection missing');             process.exit(1); }

const primitiveNames = new Set(primitives.vars.map(v => v.n));
const aliasNames     = new Set(aliases.vars.map(v => v.n));

// ─── Utilities ───────────────────────────────────────────────────────

function sanitize(name) {
  return name.replace(/ -> /g, '-').replace(/\//g, '-').replace(/ /g, '-').toLowerCase();
}

/** Figma "critical" → CSS "error" everywhere it appears in a token name. */
function renameStatus(name) {
  return name.replace(/\bcritical\b/g, 'error');
}

/** Theme variable Figma path → CSS custom property name. */
function apexToCSS(figmaName) {
  let n = renameStatus(figmaName);
  if      (n.startsWith('surface/status/'))   n = n.replace('surface/status/',   'surface/context/');
  else if (n.startsWith('border/status/'))    n = n.replace('border/status/',    'border/context/');
  if      (n.startsWith('content/status/'))   n = n.replace('content/status/',   'text/context/');
  else if (n.startsWith('content/default/'))  n = n.replace('content/default/',  'text/default/');
  else if (n.startsWith('content/primary/'))  n = n.replace('content/primary/',  'text/primary/');
  else if (n.startsWith('content/inactive/')) n = n.replace('content/inactive/', 'text/inactive/');
  else if (n.startsWith('content/active/'))   n = n.replace('content/active/',   'text/active/');
  return `--sherpa-${sanitize(n)}`;
}

/** Same as apexToCSS but for the icon namespace. */
function contentToIcon(figmaName) {
  let n = renameStatus(figmaName);
  if      (n.startsWith('content/default/'))  n = n.replace('content/default/',  'icon/context/default/');
  else if (n.startsWith('content/primary/'))  n = n.replace('content/primary/',  'icon/primary/');
  else if (n.startsWith('content/status/'))   n = n.replace('content/status/',   'icon/context/');
  else if (n.startsWith('content/inactive/')) n = n.replace('content/inactive/', 'icon/inactive/');
  else if (n.startsWith('content/active/'))   n = n.replace('content/active/',   'icon/active/');
  return `--sherpa-${sanitize(n)}`;
}

/** "@target/path" → var(--sherpa-...) — picks Primitive vs Alias vs Theme namespace. */
function refToVar(ref, { iconMode = false } = {}) {
  if (typeof ref !== 'string' || !ref.startsWith('@')) return null;
  const name = ref.slice(1);
  if (primitiveNames.has(name)) return `var(--sherpa-core-${sanitize(name)})`;
  if (aliasNames.has(name))     return `var(--sherpa-${sanitize(name)})`;
  // Theme-collection target → use apexToCSS / contentToIcon namespace map.
  if (name.startsWith('content/') && iconMode) return `var(${contentToIcon(name)})`;
  // Pattern-based primitive sniffing (matches legacy generator behaviour).
  const primPatterns = ['color/basic/', 'color/extended/', 'border/radius/', 'border/stroke/', 'border/dash/', 'scale/', 'effects/', 'motion/', 'typeface/'];
  if (primPatterns.some(p => name.startsWith(p))) return `var(--sherpa-core-${sanitize(name)})`;
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

function formatVal(val, type, hint = '') {
  const ref = refToVar(val);
  if (ref) return ref;
  if (typeof val === 'string' && val.startsWith('rgba(')) {
    return val.replace(/(\d+\.\d{2})\d+/g, '$1').replace(/\.0+\)/g, ')');
  }
  if (typeof val === 'string')  return val;
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

/** Resolve a theme variable's raw value (may be @ref, rgba, hex, number, bool). */
function formatThemeVal(rawVal, type, hint, { iconMode = false } = {}) {
  if (rawVal == null) return null;
  const ref = refToVar(rawVal, { iconMode });
  if (ref) return ref;
  if (typeof rawVal === 'string' && rawVal.startsWith('rgba(')) {
    return rawVal.replace(/(\d+\.\d{2})\d+/g, '$1').replace(/\.0+\)/g, ')');
  }
  if (typeof rawVal === 'string')  return rawVal;
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
// Primitives are hand-maintained (oklch values). Copy the existing file.

function emitPrimitives() {
  // Hand-maintained file lives in the canonical location and is not regenerated.
  // No-op kept for symmetry with the other emitters.
  console.log(`  ✓ tokens/sherpa-primitives.css (hand-maintained, not overwritten)`);
}

// ─── Emit: tokens/alias.css ──────────────────────────────────────────

function emitAlias() {
  const lines = [];

  lines.push(header(
    'Alias Tokens — Semantic',
    'Mode-less semantic tokens (Figma "Alias" collection).\n' +
    ' * Theme files reference these; switching theme rebinds — switching mode\n' +
    ' * never touches this layer.\n' +
    ' *\n' +
    ' * `@property` registrations at the top of the file enable smooth\n' +
    ' * interpolation when theme/mode tokens that resolve here animate.',
  ));

  // ── @property registrations for interpolatable tokens ──
  // Only register tokens whose downstream theme value is a <color> or
  // <length>; anything else is left unregistered to avoid syntax errors.
  lines.push('/* ── @property registrations ──────────────────────────────────── */\n');
  lines.push('/* These let the UA interpolate token swaps (theme/mode change)    */\n\n');

  const colorAliasNames = aliases.vars
    .filter(v => v.t === 'COLOR' && v.v?.Value != null && !v.n.startsWith('properties/'))
    .map(v => `--sherpa-${sanitize(v.n)}`);
  for (const propName of colorAliasNames) {
    lines.push(`@property ${propName} { syntax: "<color>"; inherits: true; initial-value: transparent; }\n`);
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
  for (const cat of catOrder.filter(c => categories[c])) {
    const vars = categories[cat].sort((a, b) => a.n.localeCompare(b.n));
    const title = cat[0].toUpperCase() + cat.slice(1);
    lines.push(`  /* ── ${title} ${'─'.repeat(Math.max(1, 56 - title.length))} */\n`);
    for (const v of vars) {
      lines.push(`  --sherpa-${sanitize(v.n)}: ${formatVal(v.v.Value, v.t, v.n)};\n`);
    }
    if (cat === 'fonts') {
      lines.push(`  --sherpa-fonts-context-default: var(--sherpa-core-typeface-open-sans-style-name);\n`);
    }
    lines.push('\n');
  }

  // Base density default — overridden by [data-density] in density/*.css
  lines.push('  /* Base density default — overridden by [data-density] axis */\n');
  lines.push('  --sherpa-space-default: var(--sherpa-core-scale-200);\n');
  lines.push('}\n\n');

  // ── Font composite tokens ──
  // These are sourced from the base theme's font/* vars (unmoded — same in
  // every theme) so they live in the alias layer.
  lines.push(emitFontsBlock());

  write('tokens/sherpa-alias.css', lines.join(''));
}

function emitFontsBlock() {
  const lines = [];
  const baseTheme = data[baseThemeName];
  const fontVars = baseTheme.vars
    .filter(v => v.n.startsWith('font/'))
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
  for (const size of sizeOrder.filter(s => groups.has(s))) {
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

function emitPlatform() {
  const css = `${header(
    'Platform Tokens — system constants',
    'Tokens with no Figma source: font weights, z-index scale, focus rings,\n' +
    ' * backdrops, content widths. Drop any entry here as soon as Figma adds the\n' +
    ' * canonical equivalent.',
  )}@property --sherpa-pdf-mode { syntax: "<integer>"; inherits: true; initial-value: 0; }

:where(:root) {
  /* Font weights */
  --sherpa-font-weight-regular:  400;
  --sherpa-font-weight-medium:   500;
  --sherpa-font-weight-semibold: 600;
  --sherpa-font-weight-bold:     700;

  /* Default body line-height */
  --sherpa-line-height-default: 1.5;

  /* Motion — durations and easing (platform constants; no Figma source).
     Hand-tuned values map to the equivalent --sherpa-core-motion-* primitives
     but stay independently authored so transitions can be tuned without
     re-extracting Figma. */
  --sherpa-motion-duration-fast: 0.15s;
  --sherpa-motion-duration-base: 0.25s;
  --sherpa-motion-duration-slow: 0.4s;
  --sherpa-motion-easing-default: ease-out;

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

  /* Product-bar icon-block background — defaults to the brand surface so the
     bar's logomark sits on the brand colour by default. */
  --sherpa-surface-app-product-bar-icon: var(--sherpa-color-brand-base, #c046ff);
}

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
  ['surface/app',         'Surface — App Chrome'],
  ['surface/container',   'Surface — Container'],
  ['surface/control',     'Surface — Control (Interactive)'],
  ['surface/status',      'Surface — Context (Status)'],
  ['border/container',    'Border — Container'],
  ['border/control',      'Border — Control (Interactive)'],
  ['border/status',       'Border — Context (Status)'],
  ['elevation',           'Elevation'],
  ['data-viz/categorical','Data Visualization — Categorical'],
  ['data-viz/sequential', 'Data Visualization — Sequential'],
  ['data-viz/divergent',  'Data Visualization — Divergent'],
  ['component',           'Component'],
];

function classifySection(figmaPath) {
  for (const [prefix, label] of SECTION_ORDER) {
    if (figmaPath.startsWith(prefix + '/')) return label;
  }
  return null;
}

/**
 * Build per-mode prop maps for one theme.
 * Returns { light, dark, hc, sectionByProp } where each map is propName→value
 * (theme + icon + text variants combined). Only color & float vars; strings
 * and `properties/*` excluded.
 */
function buildThemeMaps(themeName) {
  const collection = data[themeName];
  if (!collection) { console.error(`Theme "${themeName}" missing`); process.exit(1); }

  const light = new Map();
  const dark  = new Map();
  const hc    = new Map();
  const sectionByProp = new Map();
  const orderByProp   = []; // preserves first-seen order for stable output

  function record(propName, mode, val, section) {
    if (val == null) return;
    if (mode === 'light' && !light.has(propName)) {
      light.set(propName, val);
      orderByProp.push(propName);
      if (section) sectionByProp.set(propName, section);
    }
    if (mode === 'dark') dark.set(propName, val);
    if (mode === 'hc')   hc.set(propName, val);
  }

  for (const v of collection.vars) {
    if (v.t === 'STRING' || v.t === 'BOOLEAN') continue;
    if (v.n.startsWith('properties/')) continue;
    if (v.n.startsWith('font/')) continue; // fonts live in alias layer
    const lightRaw = v.v?.Light;
    const darkRaw  = v.v?.Dark;
    const hcRaw    = v.v?.['High Contrast'];

    const isContent = v.n.startsWith('content/');
    const sectionLabel = isContent ? 'Text' : (classifySection(v.n) || v.n.split('/').slice(0, 2).join(' / '));

    // Primary mapping (apexToCSS — covers content/* → text/* too)
    {
      const propName = apexToCSS(v.n);
      record(propName, 'light', formatThemeVal(lightRaw, v.t, v.n),                   sectionLabel);
      record(propName, 'dark',  formatThemeVal(darkRaw,  v.t, v.n),                   null);
      record(propName, 'hc',    formatThemeVal(hcRaw,    v.t, v.n),                   null);
    }

    // Icon variant (content/* only)
    if (isContent) {
      const propName = contentToIcon(v.n);
      record(propName, 'light', formatThemeVal(lightRaw, v.t, v.n, { iconMode: true }), 'Icon');
      record(propName, 'dark',  formatThemeVal(darkRaw,  v.t, v.n, { iconMode: true }), null);
      record(propName, 'hc',    formatThemeVal(hcRaw,    v.t, v.n, { iconMode: true }), null);
    }
  }

  return { light, dark, hc, sectionByProp, orderByProp };
}

function emitThemeFile(themeEntry, maps, refMaps) {
  const { name: themeName, slug } = themeEntry;
  const isDefault = (refMaps == null);

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
      ...maps.light.keys(), ...maps.dark.keys(),
      ...refMaps.light.keys(), ...refMaps.dark.keys(),
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
  const headerBody = isDefault
    ? `Default theme. Loaded by index.css. Holds the full token surface;\n` +
      ` * extended themes diff against this file.\n` +
      ' *\n' +
      ' * Three mode blocks compose orthogonally:\n' +
      ' *   light  → :where(:root) — default values, also active under\n' +
      ' *            data-mode="light" or `prefers-color-scheme: light`\n' +
      ' *   dark   → fires under data-mode="dark" or @media (prefers-color-scheme: dark)\n' +
      ' *   hc     → fires under data-mode="hc"  or @media (prefers-contrast: more)\n' +
      ' * `data-mode="auto"` (the default) honours BOTH `prefers-color-scheme`\n' +
      ' * and `prefers-contrast` — explicit modes override OS preference.\n' +
      ' *\n' +
      ' * Every selector is wrapped in :where() so theme tokens have zero\n' +
      ' * specificity — component CSS always wins without `!important`.'
    : `Diff-only override against the default theme (${baseThemeSlug}).\n` +
      ` *\n` +
      ` * REQUIRES the default theme to be loaded FIRST. Activate this theme by:\n` +
      ` *   1. Loading this file (e.g. <link rel="stylesheet" href="themes/${slug}.css">)\n` +
      ` *   2. Setting <html data-theme="${slug}">\n` +
      ' *\n' +
      ' * Each mode block re-emits not only props that differ in that mode, but\n' +
      ' * also any light-diffed prop whose dark/hc value matches the base — this\n' +
      ' * prevents source-order leak of light overrides into dark/hc cascades.';

  lines.push(header(`${themeName} — Theme tokens`, headerBody));

  lines.push('@layer theme {\n\n');

  // Build the per-mode selector lists.
  // - For the DEFAULT theme, include both bare `:root` AND `:root[data-theme="..."]`
  //   so a document with no data-theme attribute still gets the default tokens.
  // - For non-default themes, only the `:root[data-theme="..."]` form applies.
  function modeSel(modeAttr, notAttrs = []) {
    const notSuffix = notAttrs.map(a => `:not([data-mode="${a}"])`).join('');
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
    lines.push(`/* ── Light${isDefault ? ' (default)' : ' overrides'} ─────────────────────────── */\n`);
    lines.push(`${modeSel('')} {\n`);
    if (isDefault) {
      let lastSection = null;
      for (const propName of maps.orderByProp) {
        if (!lightOut.has(propName)) continue;
        const section = maps.sectionByProp.get(propName);
        if (section && section !== lastSection) {
          lines.push(`\n  /* ── ${section} ${'─'.repeat(Math.max(1, 50 - section.length))} */\n`);
          lastSection = section;
        }
        lines.push(`  ${propName}: ${lightOut.get(propName)};\n`);
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

  lines.push('} /* @layer theme */\n');
  write(`sherpa-theme-${slug}.css`, lines.join(''));
}

function emitThemes() {
  const baseMaps = buildThemeMaps(baseThemeName);
  console.log(`  Building theme "${baseThemeName}" → sherpa-theme-${baseThemeSlug}.css`);
  emitThemeFile({ name: baseThemeName, slug: baseThemeSlug }, baseMaps, null);
  for (const ext of (themesMeta?.extended || [])) {
    console.log(`  Building extended theme "${ext.name}" → sherpa-theme-${ext.slug}.css (diff vs base)`);
    const extMaps = buildThemeMaps(ext.name);
    emitThemeFile({ name: ext.name, slug: ext.slug }, extMaps, baseMaps);
  }
}

// ─── Emit: density/{compact,comfortable}.css ─────────────────────────

function emitDensity() {
  for (const mode of ['Compact', 'Comfortable']) {
    const slug = mode.toLowerCase();
    const lines = [];
    lines.push(header(
      `Density — ${mode}`,
      `Cascading density overrides. Apply to any subtree with [data-density="${slug}"].\n` +
      ' * Tokens cascade — descendant components automatically rescale.',
    ));
    lines.push('@layer density {\n');
    lines.push(`  :where([data-density="${slug}"]) {\n`);
    const spaceVars = density.vars
      .filter(v => v.n.startsWith('space/'))
      .sort((a, b) => a.n.localeCompare(b.n));
    for (const v of spaceVars) {
      const val = formatVal(v.v[mode], v.t);
      lines.push(`    --sherpa-${sanitize(v.n)}: ${val};\n`);
    }
    lines.push('  }\n');
    lines.push('} /* @layer density */\n');
    write(`sherpa-density-${slug}.css`, lines.join(''));
  }
}

// ─── Emit: status/status.css ─────────────────────────────────────────

const STATUS_PROP_MAP = {
  'border/default':         '--_status-border',
  'surface/default':        '--_status-surface',
  'surface/hover':          '--_status-surface-hover',
  'surface/down':           '--_status-surface-down',
  'surface/color/default':  '--_status-surface-strong',
  'surface/color/hover':    '--_status-surface-strong-hover',
  'surface/color/down':     '--_status-surface-strong-down',
  'surface/subtle/default': '--_status-surface-subtle',
  'surface/subtle/hover':   '--_status-surface-subtle-hover',
  'surface/subtle/down':    '--_status-surface-subtle-down',
  'text/default':           '--_status-text',
  'text/on-color':          '--_status-text-on-color',
  'icon/default':           '--_status-icon',
  'icon/on-color':          '--_status-icon-on-color',
  'shadow/status':          '--_status-shadow',
};

function emitStatus() {
  const lines = [];
  lines.push(header(
    'Status — semantic state mapping',
    `One block per status mode. Set [data-status="<mode>"] on any element\n` +
    ` * (or the document root) — descendant components consume the\n` +
    ` * resulting --_status-* private vars through their var() fallbacks.\n` +
    ` * Custom properties inherit through shadow DOM, so component CSS\n` +
    ` * never needs a per-status block.`,
  ));
  lines.push('@layer status {\n\n');

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

  lines.push('} /* @layer status */\n');
  write('sherpa-status.css', lines.join(''));
}

// ─── Emit: utilities/data-viz.css ────────────────────────────────────

function emitDataViz() {
  const baseTheme = data[baseThemeName];
  const indices = new Set();
  for (const v of baseTheme.vars) {
    const m = v.n.match(/^data-viz\/categorical\/color[ -](\d+)$/);
    if (m) indices.add(parseInt(m[1], 10));
  }
  const sorted = [...indices].sort((a, b) => a - b);
  if (sorted.length === 0) return;

  const lines = [];
  lines.push(header(
    'Data Visualization Color Classes',
    `One class per categorical color. Each class sets a private custom property\n` +
    ` * (--_data-viz-color) and applies it to background-color, color, and\n` +
    ` * border-color so the same class works for bars, swatches, labels, regions.\n` +
    ` *\n` +
    ` * Layer assignment is handled by @import layer(utilities.dataviz) in index.css.`,
  ));
  for (const i of sorted) {
    lines.push(`.color-${i} {\n`);
    lines.push(`  --_data-viz-color: var(--sherpa-data-viz-categorical-color-${i});\n`);
    lines.push(`  background-color: var(--_data-viz-color);\n`);
    lines.push(`  color: var(--_data-viz-color);\n`);
    lines.push(`  border-color: var(--_data-viz-color);\n`);
    lines.push(`}\n`);
  }
  write('sherpa-data-viz-classes.css', lines.join(''));
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
 *   density     — [data-density] subtree overrides (Compact / Comfortable)
 *   status      — [data-status] semantic state mapping (--_status-* private vars)
 *   components  — light DOM component overrides
 *   utilities   — class-based helpers (.color-N data-viz, text/icon/motion classes)
 *     ↳ utilities.icons   — icon font + .sherpa-icon sizing
 *     ↳ utilities.motion  — animation keyframes + transition utilities
 *     ↳ utilities.text    — typography classes
 *     ↳ utilities.dataviz — data-viz color classes
 *     ↳ utilities.layout  — control-group, app-shell, scroll-under patterns
 *
 * Switching axes (single source of truth — JS sets ATTRIBUTES only):
 *   Theme    — base theme is always loaded (sherpa-theme-${baseThemeSlug}.css).
 *              To activate an extended theme, append its file AFTER index.css
 *              and set <html data-theme="<slug>">. Extended themes are diff-only
 *              against the base, so the load order matters.
 *   Mode     — set <html data-mode="auto|light|dark|hc"> (default "auto")
 *              "auto" honours both prefers-color-scheme AND prefers-contrast.
 *   Density  — set [data-density="compact|base|comfortable"] on any subtree
 *   Status   — set [data-status="critical|info|success|warning|urgent"] on any element
 *
 * No light-dark(): each theme file declares its light values + nested dark
 * and HC override blocks (gated by data-mode attr OR a prefers-* media query).
 */

@layer reset, primitives, alias, platform, theme, density, status, components, utilities;
@layer utilities.icons, utilities.motion, utilities.text, utilities.dataviz, utilities.layout;

@import "reset.css"                   layer(reset);
@import "tokens/sherpa-primitives.css" layer(primitives);
@import "tokens/sherpa-alias.css"      layer(alias);
@import "tokens/sherpa-platform.css"   layer(platform);

/* Theme — default always loaded; consumers append an extended theme via JS */
@import "sherpa-theme-${baseThemeSlug}.css";

/* Density — both files always loaded; activated by [data-density] attribute */
@import "sherpa-density-compact.css"     layer(density);
@import "sherpa-density-comfortable.css" layer(density);

/* Status — semantic state mapping (--_status-* private vars) */
@import "sherpa-status.css"              layer(status);

/* Utilities — class-based helpers (sub-layered for cascade control) */
@import "sherpa-icon-classes.css"       layer(utilities.icons);
@import "sherpa-motion-classes.css"     layer(utilities.motion);
@import "sherpa-text-classes.css"       layer(utilities.text);
@import "sherpa-data-viz-classes.css"   layer(utilities.dataviz);
@import "sherpa-app-classes.css"        layer(utilities.layout);
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
emitDensity();
emitStatus();
emitDataViz();
emitIndex();

console.log(`\n✅ generation complete — output under css/styles/\n`);
