#!/usr/bin/env node
/**
 * inject-css-fallbacks.js — REQ-08 / AC-08 enforcement
 *
 * Walks every component CSS file (and shadow-root CSS strings inside
 * component JS files) and ensures every `var(--sherpa-…)` reference has
 * a hardcoded fallback value.
 *
 * Resolution strategy:
 *   1. Build a name → raw-value map by parsing token definition files
 *      (primitives + alias + theme-base + fonts + components).
 *   2. For each missing fallback, resolve the token recursively until a
 *      literal value is reached. light-dark(LIGHT, DARK) collapses to LIGHT
 *      (matches the OS-light default; runtime mode switching is unaffected
 *      because the token itself almost always resolves first — fallback
 *      only fires when the cascade is broken).
 *   3. Inject the literal as `var(--name, <literal>)`.
 *   4. Skip + report tokens that cannot be resolved (component-internal
 *      tokens, missing definitions, circular refs).
 *
 * Idempotent: running twice is a no-op because the regex skips refs that
 * already have a comma.
 *
 * Usage:
 *   node scripts/inject-css-fallbacks.js          # apply
 *   node scripts/inject-css-fallbacks.js --dry    # report only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'css', 'styles');
const COMPONENTS_DIR = path.join(ROOT, 'components');
const DRY = process.argv.includes('--dry');

// ─── Build token map ────────────────────────────────────────────────

const SOURCES = [
  'tokens/primitives.css',
  'tokens/sherpa-alias.css',         // includes fonts + status (consolidated)
  'sherpa-themes.css',               // all themes — fills in per-theme tokens
  'sherpa-motion-classes.css',
  // Other per-theme files contain mode-specific overrides; fallback uses
  // the default theme so non-default themes still get a sensible value.
];

/** Map of CSS prop name → raw declared value (last write wins, source order). */
const tokenMap = new Map();

const DECL_RE = /^\s*(--sherpa-[a-z0-9-]+)\s*:\s*([^;]+);/gm;
for (const file of SOURCES) {
  const fullPath = path.join(CSS_DIR, file);
  if (!fs.existsSync(fullPath)) continue;
  const src = fs.readFileSync(fullPath, 'utf8');
  let m;
  DECL_RE.lastIndex = 0;
  while ((m = DECL_RE.exec(src)) !== null) {
    tokenMap.set(m[1], m[2].trim());
  }
}

// Also scan component CSS for component-internal tokens (e.g. --sherpa-node-*)
// that one component declares and another consumes.
function preScanComponents(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) preScanComponents(full);
    else if (/\.css$/.test(entry.name)) {
      const src = fs.readFileSync(full, 'utf8');
      let m;
      DECL_RE.lastIndex = 0;
      while ((m = DECL_RE.exec(src)) !== null) {
        // Only adopt if not already defined globally (component-internal).
        if (!tokenMap.has(m[1])) tokenMap.set(m[1], m[2].trim());
      }
    }
  }
}
preScanComponents(COMPONENTS_DIR);

console.log(`Loaded ${tokenMap.size} token definitions from ${SOURCES.length} files.`);

// ─── Recursive resolver ─────────────────────────────────────────────

/**
 * Split a comma-separated argument list at the top level (depth=0),
 * respecting nested parens. Returns trimmed parts.
 */
function splitTopLevelArgs(s) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(s.slice(start).trim());
  return parts;
}

/**
 * If `s` starts with `funcName(` return the inner argument string (matched
 * to the corresponding close paren) plus the index after the close paren.
 * Returns null if the prefix doesn't match or parens are unbalanced.
 */
function readFunc(s, funcName) {
  const prefix = funcName + '(';
  if (!s.toLowerCase().startsWith(prefix)) return null;
  let depth = 1, i = prefix.length;
  while (i < s.length && depth > 0) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (depth === 0) return { inner: s.slice(prefix.length, i), end: i + 1 };
    i++;
  }
  return null;
}

/**
 * Recursively resolve a token name to a literal value.
 * Returns null if unresolvable. Cycle-safe via `seen`.
 */
function resolve(name, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const raw = tokenMap.get(name);
  if (raw == null) return null;
  return resolveValue(raw, seen);
}

function resolveValue(value, seen) {
  const trimmed = value.trim();

  // light-dark(LIGHT, DARK) → recurse on LIGHT (used when fallback fires;
  // runtime mode switching is unaffected because the token itself wins).
  const ld = readFunc(trimmed, 'light-dark');
  if (ld && ld.end === trimmed.length) {
    const args = splitTopLevelArgs(ld.inner);
    if (args.length >= 1) return resolveValue(args[0], seen);
  }

  // var(--name) or var(--name, fallback)
  const v = readFunc(trimmed, 'var');
  if (v && v.end === trimmed.length) {
    const args = splitTopLevelArgs(v.inner);
    const refName = args[0];
    if (/^--sherpa-/i.test(refName)) {
      const inner = resolve(refName, seen);
      if (inner != null) return inner;
    }
    if (args.length > 1) return resolveValue(args.slice(1).join(', '), seen);
    return null;
  }

  // Anything else: treat as literal (color, length, calc(), rgba(), etc.)
  return trimmed;
}

// ─── Walk component files ───────────────────────────────────────────

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(css|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

// Match `var(--sherpa-…)` with NO comma before the closing paren.
// Avoids matching nested vars inside an existing fallback.
const MISSING_FALLBACK_RE = /var\(\s*(--sherpa-[a-z0-9-]+)\s*\)/gi;

const stats = {
  filesScanned: 0,
  filesModified: 0,
  totalRefs: 0,
  injected: 0,
  unresolved: new Map(),  // name → count
};

const componentFiles = walk(COMPONENTS_DIR);
for (const file of componentFiles) {
  const src = fs.readFileSync(file, 'utf8');
  let modified = false;
  let fileInjected = 0;

  const next = src.replace(MISSING_FALLBACK_RE, (full, name) => {
    stats.totalRefs++;
    const literal = resolve(name);
    if (literal == null) {
      stats.unresolved.set(name, (stats.unresolved.get(name) || 0) + 1);
      return full;
    }
    modified = true;
    fileInjected++;
    return `var(${name}, ${literal})`;
  });

  stats.filesScanned++;
  if (modified) {
    stats.filesModified++;
    stats.injected += fileInjected;
    if (!DRY) fs.writeFileSync(file, next, 'utf8');
  }
}

// ─── Report ─────────────────────────────────────────────────────────

console.log(`\nScanned: ${stats.filesScanned} files`);
console.log(`Bare var() refs found: ${stats.totalRefs}`);
console.log(`Fallbacks ${DRY ? 'would be injected into' : 'injected into'} ${stats.injected} call sites across ${stats.filesModified} files.`);

if (stats.unresolved.size > 0) {
  console.log(`\nUnresolved references (${stats.unresolved.size} unique tokens):`);
  const sorted = [...stats.unresolved.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sorted) {
    console.log(`  ${count.toString().padStart(4)}  ${name}`);
  }
  console.log(`\nThese are likely component-internal tokens not defined in the global token files.`);
  console.log(`If they are intended to be theme-able, add them to figma-tokens/ and regenerate.`);
}

if (DRY) console.log('\n(dry run — no files were modified)');
