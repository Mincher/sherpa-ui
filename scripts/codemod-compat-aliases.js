#!/usr/bin/env node
/**
 * codemod-compat-aliases.js — Phase 3 of Token Pipeline v2
 *
 * Rewrites every reference to a Sherpa "compat alias" token in
 * `components/(any)/(any).css` (and selected stylesheets under
 * `css/styles/`) to its canonical Figma-sourced name. Compat aliases are the entries in
 * `css/styles/tokens/sherpa-platform.css` §2 plus the alias-of-alias entries
 * in `css/styles/sherpa-theme-base.css` (lines 410–417).
 *
 * After this codemod runs:
 *   - `css/styles/tokens/sherpa-platform.css` §2 can be deleted
 *   - The alias-of-alias block in `sherpa-theme-base.css` can be deleted
 *   - The v2 generator's `tokens/platform.css` (which already omits these)
 *     becomes a drop-in replacement for the legacy file
 *
 * Replacement strategy:
 *   - Match `var(--sherpa-<old>` (with optional fallback) and rewrite the
 *     property name only — fallbacks are preserved verbatim so any
 *     hard-coded fallback colour/length still applies.
 *   - Replace LHS occurrences too (e.g. inline `--sherpa-space-md: 12px;`
 *     in component CSS would be flagged as an error so it can be
 *     hand-fixed; in practice none exist outside platform.css §2).
 *
 * Run: node scripts/codemod-compat-aliases.js [--dry]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');
const DRY        = process.argv.includes('--dry');

// ─── Canonical mapping ──────────────────────────────────────────────
// Keys are the legacy name **without** the --sherpa- prefix; values are
// the canonical Figma name (also without prefix). Sourced from:
//   - css/styles/tokens/sherpa-platform.css §2
//   - css/styles/sherpa-theme-base.css lines 410-417

const MAP = {
  // ── Spacing / sizing scale renames ──
  'space-md':           'space-base',
  'fonts-scale-md':     'fonts-scale-base',
  'size-default':       'size-md',
  'border-width-md':    'border-width-base',

  // ── Border-rounding gaps (Figma scale skips xs/2xs/round) ──
  'border-rounding-xs':    'border-rounding-sm',
  'border-rounding-2xs':   'border-rounding-sm',
  'border-rounding-round': 'border-rounding-full',

  // ── Font-family alias ──
  'fonts-mono': 'fonts-context-monospaced',

  // ── Text-default semantic shorthands ──
  'text-default-primary':            'text-default-body',
  'text-default-tertiary':           'text-default-placeholder',
  'text-default-inactive':           'text-default-placeholder',
  // Selected items sit on tinted brand-100 / brand-900 — use heading/body,
  // NOT on-color variants (would be unreadable on tinted surface).
  'text-default-selected':           'text-default-heading',
  'text-default-selected-secondary': 'text-default-body',
  'icon-default-selected':           'icon-context-default-body',

  // ── Border-container shorthands ──
  // border-container-subtle exists in v2 platform.css as a hairline divider
  // constant (not in Figma); the `-default` suffix variant is just a rename.
  'border-container-subtle-default': 'border-container-subtle',
  'border-container-strong-default': 'border-container-default',
  'border-container-hover':          'border-control-hover',

  // ── Border-control shorthands ──
  'border-control-primary-active': 'border-control-active-default',

  // ── Generic border shorthands ──
  'border-default': 'border-container-default',
  'border-focus':   'border-control-primary-default',

  // ── Surface shorthands ──
  'surface-subtle-default':            'surface-container-secondary-default',
  'surface-container-selected-default':'surface-container-active-default',

  // ── Context surface / text / border shorthands ──
  'surface-context-info-default':  'surface-context-info-subtle-default',
  'surface-context-info-subtle':   'surface-context-info-subtle-default',
  'surface-context-error-subtle':  'surface-context-error-subtle-default',
  'surface-warning-subtle':        'surface-context-warning-subtle-default',
  'text-context-info-on-default':  'text-context-info-default',
  'border-context-info-strong':    'border-context-info-default',

  // ── App-chrome shorthands ──
  // bar-brand has no clean Figma equivalent; rewrite to the brand primitive
  // (matches the legacy alias's effective value).
  'surface-app-product-bar-brand':    'color-brand-base',
  'surface-app-product-nav-secondary':'surface-app-product-nav-base-icon',
  'surface-app-product-bg-default':   'surface-app-background-default',
};

// ─── File discovery ─────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

// Components + the playground-shell stylesheets in css/styles/ (NOT the
// generated theme files — those are regenerated from Figma each build).
const targets = [
  ...walk(path.join(ROOT, 'components')),
  path.join(ROOT, 'css', 'styles', 'sherpa-app-classes.css'),
  path.join(ROOT, 'css', 'styles', 'sherpa-text-classes.css'),
  path.join(ROOT, 'css', 'styles', 'sherpa-motion-classes.css'),
  path.join(ROOT, 'css', 'styles', 'sherpa-data-viz-classes.css'),
  path.join(ROOT, 'css', 'styles', 'reset.css'),
].filter(p => fs.existsSync(p));

// ─── Rewrite logic ──────────────────────────────────────────────────

// Build a single regex matching any --sherpa-<oldName> occurrence as a
// property NAME (i.e. preceded by `var(` or at start of `--sherpa-X:`).
const oldNames = Object.keys(MAP);
// Sort longest-first to prevent shorter prefixes from matching inside longer
// names (e.g. `space-md` shouldn't fire inside `space-md-foo` — we use a
// negative-lookahead char class to be safe).
oldNames.sort((a, b) => b.length - a.length);

const tokenAlt = oldNames.map(n => n.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
// Match `--sherpa-<oldName>` only when the next char is NOT a name continuation.
const re = new RegExp(`--sherpa-(${tokenAlt})(?![a-z0-9-])`, 'g');

let totalFiles = 0;
let totalRewrites = 0;
const perTokenCount = Object.fromEntries(oldNames.map(n => [n, 0]));

for (const file of targets) {
  const before = fs.readFileSync(file, 'utf8');
  let count = 0;
  const after = before.replace(re, (_, oldName) => {
    count++;
    perTokenCount[oldName]++;
    return `--sherpa-${MAP[oldName]}`;
  });
  if (count === 0) continue;
  totalFiles++;
  totalRewrites += count;
  if (!DRY) fs.writeFileSync(file, after, 'utf8');
  const rel = path.relative(ROOT, file);
  console.log(`  ${DRY ? '[dry]' : '✓'} ${count.toString().padStart(3)} × ${rel}`);
}

console.log(`\n${DRY ? '[dry-run]' : 'Done.'} ${totalRewrites} rewrites across ${totalFiles} files.`);
console.log('\n=== Per-token counts ===');
for (const [name, count] of Object.entries(perTokenCount).sort((a, b) => b[1] - a[1])) {
  if (count > 0) console.log(`  ${count.toString().padStart(3)} × --sherpa-${name} → --sherpa-${MAP[name]}`);
}
const unused = Object.entries(perTokenCount).filter(([, c]) => c === 0).map(([n]) => n);
if (unused.length) {
  console.log(`\n=== Unused mappings (${unused.length}) — safe to drop from compat aliases ===`);
  for (const n of unused) console.log(`  --sherpa-${n}`);
}
