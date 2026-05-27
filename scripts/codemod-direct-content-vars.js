#!/usr/bin/env node
/**
 * codemod-direct-content-vars.js
 *
 * Two passes per file:
 *
 *  1. STRIP the alias blocks injected by the previous codemod
 *     (the "content aliases" comment + all --sherpa-text-X/--sherpa-icon-X alias lines)
 *
 *  2. REPLACE every --sherpa-text-* and --sherpa-icon-* var reference
 *     with the equivalent --sherpa-content-* name directly.
 *
 * Mapping rules (same as before, now applied to the property names themselves):
 *   --sherpa-text-{cat}-rest           → --sherpa-content-{cat}-rest
 *   --sherpa-icon-context-default-rest → --sherpa-content-default-rest
 *   --sherpa-icon-context-{status}-rest→ --sherpa-content-context-{status}-rest
 *   --sherpa-icon-primary-rest         → --sherpa-content-primary-rest
 *   --sherpa-icon-active-rest          → --sherpa-content-active-rest
 *   --sherpa-icon-inactive-rest        → --sherpa-content-inactive-rest
 *
 * Run once: node scripts/codemod-direct-content-vars.js
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COMPONENTS_DIR = join(ROOT, 'components');

// ---------------------------------------------------------------------------
// Rename: --sherpa-text-* / --sherpa-icon-* → --sherpa-content-*
// ---------------------------------------------------------------------------

function toContentVarName(varName) {
  // --sherpa-text-{category}-rest  (default, primary, active, inactive, context)
  const textMatch = varName.match(/^--sherpa-text-([a-z]+)-(.+)$/);
  if (textMatch) return `--sherpa-content-${textMatch[1]}-${textMatch[2]}`;

  // --sherpa-icon-context-default-rest → --sherpa-content-default-rest
  const iconDefaultMatch = varName.match(/^--sherpa-icon-context-default-(.+)$/);
  if (iconDefaultMatch) return `--sherpa-content-default-${iconDefaultMatch[1]}`;

  // --sherpa-icon-context-{status}-rest → --sherpa-content-context-{status}-rest
  const iconContextMatch = varName.match(/^--sherpa-icon-context-(.+)$/);
  if (iconContextMatch) return `--sherpa-content-context-${iconContextMatch[1]}`;

  // --sherpa-icon-primary-rest → --sherpa-content-primary-rest
  const iconPrimary = varName.match(/^--sherpa-icon-primary-(.+)$/);
  if (iconPrimary) return `--sherpa-content-primary-${iconPrimary[1]}`;

  // --sherpa-icon-active-rest → --sherpa-content-active-rest
  const iconActive = varName.match(/^--sherpa-icon-active-(.+)$/);
  if (iconActive) return `--sherpa-content-active-${iconActive[1]}`;

  // --sherpa-icon-inactive-rest → --sherpa-content-inactive-rest
  const iconInactive = varName.match(/^--sherpa-icon-inactive-(.+)$/);
  if (iconInactive) return `--sherpa-content-inactive-${iconInactive[1]}`;

  return null;
}

// ---------------------------------------------------------------------------
// Pass 1: remove the injected alias comment block from :host
// ---------------------------------------------------------------------------

function stripAliasBlock(css) {
  // Remove the comment header line
  css = css.replace(/\n  \/\* content aliases[^\n]*\*\//, '');
  // Remove lines that are alias declarations (--sherpa-text-* or --sherpa-icon-* pointing to --sherpa-content-*)
  css = css.replace(/\n  --sherpa-(text|icon)-[^:]+:\s+var\(--sherpa-content-[^)]+\);/g, '');
  return css;
}

// ---------------------------------------------------------------------------
// Pass 2: replace every --sherpa-text-* / --sherpa-icon-* occurrence
// ---------------------------------------------------------------------------

// Matches any --sherpa-text-... or --sherpa-icon-... custom property name
const RENAME_RE = /--sherpa-(text|icon(-context|-primary|-active|-inactive)?)-[a-z0-9-]+/g;

function replaceVarNames(css) {
  return css.replace(RENAME_RE, (match) => toContentVarName(match) ?? match);
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
    } else if (entry.endsWith('.css')) {
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
  const original = readFileSync(filePath, 'utf8');

  let css = original;
  css = stripAliasBlock(css);
  css = replaceVarNames(css);

  if (css !== original) {
    writeFileSync(filePath, css, 'utf8');
    console.log(`  UPDATED: ${rel}`);
    modifiedCount++;
  }
}

console.log(`\nDone. Modified ${modifiedCount} component CSS files.`);
