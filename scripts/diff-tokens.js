#!/usr/bin/env node
/**
 * diff-tokens.js — Auto-generate figma-token-diff-report.md
 *
 * Compares the extracted Figma variables (figma-tokens/figma-variables.json)
 * against the current generated CSS token files (css/styles/tokens/) and
 * writes a structured Markdown report.
 *
 * Usage:
 *   node scripts/diff-tokens.js               # write figma-token-diff-report.md
 *   node scripts/diff-tokens.js --ci          # exit 1 if any High-priority gaps
 *   node scripts/diff-tokens.js --out foo.md  # custom output path
 *   npm run tokens:diff
 *
 * NOTE: Run `npm run tokens:extract` first to ensure figma-variables.json is
 * up-to-date. The diff compares that snapshot against the on-disk CSS.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSS } from './lib/css-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');

// ─── CLI args ────────────────────────────────────────────────────────

const CI_MODE  = process.argv.includes('--ci');
const outIdx   = process.argv.indexOf('--out');
const OUT_FILE = outIdx >= 0
  ? path.resolve(process.argv[outIdx + 1])
  : path.join(ROOT, 'figma-token-diff-report.md');

// ─── Load data ───────────────────────────────────────────────────────

const DATA_FILE = path.join(ROOT, 'figma-tokens', 'figma-variables.json');
if (!fs.existsSync(DATA_FILE)) {
  console.error(`Error: ${DATA_FILE} not found. Run npm run tokens:extract first.`);
  process.exit(1);
}
const figmaData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// ─── Name translation (must match generate-css-tokens.js) ────────────

const RENAME_MAP = new Map([
  ['adlumin-blue-test', 'adlumin-blue'],
  ['fonts-context-monospaced', 'fonts-context-mono'],
]);

function sanitize(name) {
  let s = name
    .replace(/ -> /g, '-')
    .replace(/\//g, '-')
    .replace(/ /g, '-')
    .replace(/[\[\]]/g, '')
    .toLowerCase();
  for (const [from, to] of RENAME_MAP) s = s.replaceAll(from, to);
  return s;
}

function figmaPathToCSSName(figmaPath, tier) {
  return `--${tier}-${sanitize(figmaPath)}`;
}

// ─── Build Figma token name set ──────────────────────────────────────

/**
 * Collections that contribute to CSS output (component-scoped -> collections
 * are design-time only and intentionally not mirrored in CSS).
 */
const SKIP_COLLECTIONS = new Set(['meta', 'themes']);
const COMPONENT_PREFIX_RE = /^->/;

const figmaTokens = new Map(); // cssName → { collection, figmaPath, tier }

for (const [collectionName, collection] of Object.entries(figmaData)) {
  if (SKIP_COLLECTIONS.has(collectionName)) continue;
  if (COMPONENT_PREFIX_RE.test(collectionName)) continue;
  if (!collection?.vars) continue;

  // Determine CSS tier: Primitives → --core-*, everything else → --sherpa-*
  const tier = collectionName === 'Primitives' ? 'core' : 'sherpa';

  for (const v of collection.vars) {
    if (v.n.startsWith('properties/')) continue;
    if (v.t === 'STRING' && v.n.startsWith('properties/')) continue;

    const cssName = figmaPathToCSSName(v.n, tier);
    if (!figmaTokens.has(cssName)) {
      figmaTokens.set(cssName, { collection: collectionName, figmaPath: v.n, tier, type: v.t });
    }
  }
}

// ─── Parse current CSS token files ──────────────────────────────────

const TOKEN_CSS_DIR = path.join(ROOT, 'css', 'styles');

function collectCSSTokens(dir) {
  const tokens = new Map(); // cssName → { file, value }
  const cssFiles = [];

  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.name.endsWith('.css')) cssFiles.push(full);
    }
  }
  walk(dir);

  for (const file of cssFiles) {
    const rel  = path.relative(ROOT, file);
    const css  = fs.readFileSync(file, 'utf8');
    const parsed = parseCSS(css, rel);
    for (const block of parsed.selectors) {
      for (const prop of block.properties) {
        if (!prop.name.startsWith('--core-') && !prop.name.startsWith('--sherpa-')) continue;
        if (!tokens.has(prop.name)) {
          tokens.set(prop.name, { file: rel, value: prop.value });
        }
      }
    }
  }
  return tokens;
}

const cssTokens = collectCSSTokens(TOKEN_CSS_DIR);

// ─── Compute diff ────────────────────────────────────────────────────

// Theme-level tokens (surface/*, content/*, border/*, elevation/*) live in
// sherpa-themes.css — their CSS names are derived via apexToCSS() which does
// additional path transforms. We detect them by collection name.
const THEME_COLLECTIONS = new Set([
  figmaData.themes?.base?.name,
  ...(figmaData.themes?.extended || []).map(e => e.name),
].filter(Boolean));

// Tokens known to be hand-authored in platform/functions/text files —
// their absence from Figma is expected and should not appear as stale.
const HAND_AUTHORED_PREFIXES = [
  '--sherpa-font-weight-',
  '--sherpa-line-height-',
  '--sherpa-motion-duration-',
  '--sherpa-motion-easing-',
  '--sherpa-z-',
  '--sherpa-effects-backdrop',
  '--sherpa-effects-focus-ring',
  '--sherpa-content-width-',
  '--sherpa-surface-search-highlight',
  '--sherpa-ai-accent-gradient',
  '--sherpa-border-container-subtle',
  '--sherpa-breakpoint-',
  '--sherpa-space-default',
  '--sherpa-fonts-context-default',
  '--sherpa-fonts-context-monospaced', // compat alias
  '--sherpa-shadow-',
  '--sherpa-opacity-',
  '--sherpa-color-overlay-',
  '--sherpa-color-palette-',
];

function isHandAuthored(cssName) {
  return HAND_AUTHORED_PREFIXES.some(p => cssName.startsWith(p));
}

// Missing: in Figma but no CSS token
const missing = [];
for (const [cssName, info] of figmaTokens) {
  // Theme-collection vars use apexToCSS naming which is harder to predict
  // here — skip them to avoid false positives.
  if (THEME_COLLECTIONS.has(info.collection)) continue;
  if (!cssTokens.has(cssName)) {
    missing.push({ cssName, ...info });
  }
}

// Extra: CSS token with no matching Figma variable
const extra = [];
for (const [cssName, info] of cssTokens) {
  if (isHandAuthored(cssName)) continue;
  if (!figmaTokens.has(cssName)) {
    extra.push({ cssName, ...info });
  }
}

// ─── Classify priority ───────────────────────────────────────────────

function classifyPriority(info) {
  const { collection, figmaPath } = info;
  // Semantic/Alias collection → High
  if (collection === 'Alias' || collection === 'Status') return 'High';
  // Primitive colour ramps → Low (lots of stops, rarely critical)
  if (collection === 'Primitives') {
    if (figmaPath.startsWith('color/')) return 'Low';
    return 'Medium';
  }
  // Density and Layout → Medium
  if (collection === 'Density (Alias)' || collection === 'Layout') return 'Medium';
  return 'Medium';
}

missing.sort((a, b) => {
  const order = { High: 0, Medium: 1, Low: 2 };
  return (order[classifyPriority(a)] - order[classifyPriority(b)]) || a.cssName.localeCompare(b.cssName);
});

// ─── Build report ────────────────────────────────────────────────────

const date = new Date().toISOString().slice(0, 10);

const highMissing   = missing.filter(t => classifyPriority(t) === 'High');
const medMissing    = missing.filter(t => classifyPriority(t) === 'Medium');
const lowMissing    = missing.filter(t => classifyPriority(t) === 'Low');
const extraNonPalette = extra.filter(t => !t.cssName.includes('-palette-') && !t.cssName.includes('-overlay-'));

function missingTable(items) {
  if (items.length === 0) return '_None_\n';
  let out = `| Figma path | Expected CSS token | Collection | Response |\n`;
  out    += `|---|---|---|---|\n`;
  for (const t of items) {
    out += `| \`${t.figmaPath}\` | \`${t.cssName}\` | ${t.collection} | |\n`;
  }
  return out + '\n';
}

function extraTable(items) {
  if (items.length === 0) return '_None_\n';
  let out = `| CSS token | Source file | Response |\n`;
  out    += `|---|---|---|\n`;
  for (const t of items) {
    out += `| \`${t.cssName}\` | \`${t.file}\` | |\n`;
  }
  return out + '\n';
}

const report = `# Figma Variable vs. Sherpa CSS — Diff Report

_Generated: ${date}. Source: \`figma-tokens/figma-variables.json\` vs \`css/styles/\`._
_Run \`npm run tokens:diff\` to regenerate this file after an extraction._

---

## Overview

| | Count |
|---|---|
| Figma variables mapped to CSS names | ${figmaTokens.size} |
| CSS custom properties (--core-* + --sherpa-*) | ${cssTokens.size} |
| Missing from CSS (High priority) | ${highMissing.length} |
| Missing from CSS (Medium priority) | ${medMissing.length} |
| Missing from CSS (Low priority) | ${lowMissing.length} |
| In CSS but not in Figma (non-palette) | ${extraNonPalette.length} |

> **Note:** Theme-collection variables (\`surface/*\`, \`content/*\`, \`border/*\`, \`elevation/*\`) use
> path transforms that differ from the simple \`sanitize()\` mapping and are excluded from this
> diff to avoid false positives. Palette and overlay auto-aliases are excluded from the Extra table.

---

## 1. Missing from CSS — High Priority

Semantic alias or status tokens in Figma with no CSS equivalent.

${missingTable(highMissing)}
---

## 2. Missing from CSS — Medium Priority

Non-colour primitives, density, or layout tokens in Figma with no CSS equivalent.

${missingTable(medMissing)}
---

## 3. Missing from CSS — Low Priority

Colour primitive stops in Figma with no CSS equivalent.

${missingTable(lowMissing)}
---

## 4. In CSS but not in Figma

CSS tokens with no matching Figma source (stale, hand-authored, or renamed).
Hand-authored platform tokens (font-weight, z-index, breakpoints, etc.) are excluded.

${extraTable(extraNonPalette)}
---

## 5. Priority Summary

| Priority | Count | Action |
|---|---|---|
| **High** | ${highMissing.length} | Run \`npm run tokens:extract && npm run tokens:generate\` once Figma has the token |
| **Medium** | ${medMissing.length} | Add to relevant CSS layer or wait for Figma update |
| **Low** | ${lowMissing.length} | Add missing colour stops to Figma Primitives |
| **Extra (non-palette)** | ${extraNonPalette.length} | Review for removal or document as intentional |
`;

// ─── Write + summarise ───────────────────────────────────────────────

fs.writeFileSync(OUT_FILE, report, 'utf8');
const rel = path.relative(ROOT, OUT_FILE);

console.log(`\n📊 Token diff report\n`);
console.log(`  Missing High:    ${highMissing.length}`);
console.log(`  Missing Medium:  ${medMissing.length}`);
console.log(`  Missing Low:     ${lowMissing.length}`);
console.log(`  Extra (non-pal): ${extraNonPalette.length}`);
console.log(`\n  ✓ ${rel}\n`);

if (CI_MODE && highMissing.length > 0) {
  console.error(`\n  ✗ CI: ${highMissing.length} High-priority token(s) missing from CSS.\n`);
  process.exit(1);
}
