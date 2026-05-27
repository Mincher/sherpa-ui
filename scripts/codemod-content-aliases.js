#!/usr/bin/env node
/**
 * codemod-content-aliases.js
 *
 * For every component CSS file, find all --sherpa-text-* and --sherpa-icon-*
 * references that should now be aliases to --sherpa-content-* vars, then
 * inject those alias declarations into the top-level :host { } block.
 *
 * Run once: node scripts/codemod-content-aliases.js
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COMPONENTS_DIR = join(ROOT, 'components');

// ---------------------------------------------------------------------------
// Mapping: --sherpa-text-* / --sherpa-icon-* → --sherpa-content-*
// ---------------------------------------------------------------------------

function textIconVarToContentVar(varName) {
  // --sherpa-text-{category}-rest  (category: default, primary, active, inactive, context)
  const textMatch = varName.match(/^--sherpa-text-([a-z]+)-(.+)$/);
  if (textMatch) {
    return `--sherpa-content-${textMatch[1]}-${textMatch[2]}`;
  }
  // --sherpa-icon-context-default-rest  →  --sherpa-content-default-rest
  const iconDefaultMatch = varName.match(/^--sherpa-icon-context-default-(.+)$/);
  if (iconDefaultMatch) {
    return `--sherpa-content-default-${iconDefaultMatch[1]}`;
  }
  // --sherpa-icon-context-{status}-rest  →  --sherpa-content-context-{status}-rest
  const iconContextMatch = varName.match(/^--sherpa-icon-context-(.+)$/);
  if (iconContextMatch) {
    return `--sherpa-content-context-${iconContextMatch[1]}`;
  }
  // --sherpa-icon-primary-rest  →  --sherpa-content-primary-rest
  const iconPrimary = varName.match(/^--sherpa-icon-primary-(.+)$/);
  if (iconPrimary) return `--sherpa-content-primary-${iconPrimary[1]}`;
  // --sherpa-icon-active-rest  →  --sherpa-content-active-rest
  const iconActive = varName.match(/^--sherpa-icon-active-(.+)$/);
  if (iconActive) return `--sherpa-content-active-${iconActive[1]}`;
  // --sherpa-icon-inactive-rest  →  --sherpa-content-inactive-rest
  const iconInactive = varName.match(/^--sherpa-icon-inactive-(.+)$/);
  if (iconInactive) return `--sherpa-content-inactive-${iconInactive[1]}`;

  return null;
}

// ---------------------------------------------------------------------------
// CSS var extraction: find all --sherpa-text-* / --sherpa-icon-* usages
// ---------------------------------------------------------------------------

const USAGE_RE = /--sherpa-(text|icon(-context|-primary|-active|-inactive)?)-[a-z0-9-]+/g;

function extractUsedVars(css) {
  const vars = new Set();
  for (const m of css.matchAll(USAGE_RE)) {
    vars.add(m[0]);
  }
  return vars;
}

// ---------------------------------------------------------------------------
// Injection: insert alias declarations after the opening { of :host { }
// ---------------------------------------------------------------------------

const HOST_BLOCK_RE = /^:host\s*\{/m;

function injectAliases(css, aliases) {
  if (aliases.length === 0) return css;

  const match = HOST_BLOCK_RE.exec(css);
  if (!match) return css; // no top-level :host block — skip

  const insertAt = match.index + match[0].length;
  const block = aliases
    .map(([alias, content]) => {
      const pad = ' '.repeat(Math.max(1, 40 - alias.length));
      return `\n  ${alias}:${pad}var(${content});`;
    })
    .join('');

  return css.slice(0, insertAt) + block + css.slice(insertAt);
}

// ---------------------------------------------------------------------------
// Check if aliases are already present (idempotency)
// ---------------------------------------------------------------------------

function hasExistingAliases(css) {
  return css.includes('/* content aliases */') || /--sherpa-text-default-body:\s*var\(--sherpa-content/.test(css);
}

// ---------------------------------------------------------------------------
// Walk component directories
// ---------------------------------------------------------------------------

function findCssFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...findCssFiles(full));
    } else if (entry.endsWith('.css') && !entry.includes('sherpa-themes') && !entry.includes('sherpa-overrides')) {
      files.push(full);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const cssFiles = findCssFiles(COMPONENTS_DIR);
let modifiedCount = 0;

for (const filePath of cssFiles) {
  const rel = relative(ROOT, filePath);
  const css = readFileSync(filePath, 'utf8');

  if (hasExistingAliases(css)) {
    console.log(`  SKIP (already patched): ${rel}`);
    continue;
  }

  const usedVars = extractUsedVars(css);
  if (usedVars.size === 0) continue;

  // Build alias pairs: [aliasVar, contentVar], deduplicated, stable order
  const aliasMap = new Map();
  for (const varName of usedVars) {
    const contentVar = textIconVarToContentVar(varName);
    if (contentVar) aliasMap.set(varName, contentVar);
  }

  if (aliasMap.size === 0) continue;

  // Check if :host block exists
  if (!HOST_BLOCK_RE.test(css)) {
    console.log(`  NO :host block: ${rel}`);
    continue;
  }

  // Sort: text vars first (alphabetical), then icon vars
  const sorted = [...aliasMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  const header = `\n  /* content aliases — maps semantic text/icon names to canonical --sherpa-content-* */`;
  const aliasBlock = [['/* content aliases */', '']] ;

  // Build the actual injection using the header comment + sorted pairs
  const match = HOST_BLOCK_RE.exec(css);
  const insertAt = match.index + match[0].length;
  const lines = sorted
    .map(([alias, content]) => {
      const pad = ' '.repeat(Math.max(1, 40 - alias.length));
      return `\n  ${alias}:${pad}var(${content});`;
    })
    .join('');

  const newCss = css.slice(0, insertAt) + header + lines + css.slice(insertAt);
  writeFileSync(filePath, newCss, 'utf8');
  console.log(`  PATCHED (${aliasMap.size} aliases): ${rel}`);
  modifiedCount++;
}

console.log(`\nDone. Modified ${modifiedCount} files.`);
