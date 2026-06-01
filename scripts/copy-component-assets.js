#!/usr/bin/env node
/**
 * copy-component-assets.js — Make the compiled dist/ self-contained.
 *
 * The TypeScript compiler only emits .js/.d.ts; component CSS and HTML
 * templates are loaded at runtime via `new URL('./x.css', import.meta.url)`.
 * For a consumer importing from dist/, those URLs resolve relative to the
 * compiled .js file, so the assets must sit alongside the emitted output.
 *
 * This script mirrors:
 *   1. components/**\/*.{css,html}  →  dist/components/...
 *      (component-local stylesheets and templates)
 *   2. css/**\/*                    →  dist/css/...
 *      (shared stylesheets referenced via ../../../css/styles/... from the
 *       base class and a few components)
 *
 * Run after `tsc`. Idempotent; overwrites existing copies.
 */

import { readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const COMPONENT_ASSET_EXT = new Set(['.css', '.html']);

/** Recursively yield absolute file paths under `dir`. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === 'node_modules') continue;
      yield* walk(p);
    } else if (s.isFile()) {
      yield p;
    }
  }
}

/** Copy `src` to `dest`, creating parent dirs as needed. */
function copyInto(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

let copied = 0;

// 1. Component-local CSS + HTML → dist/components/...
const componentsDir = join(ROOT, 'components');
for (const src of walk(componentsDir)) {
  if (!COMPONENT_ASSET_EXT.has(extname(src))) continue;
  const rel = relative(componentsDir, src);
  copyInto(src, join(ROOT, 'dist', 'components', rel));
  copied++;
}

// 2. Shared CSS tree → dist/css/... (referenced via ../../../css/styles/...)
const cssDir = join(ROOT, 'css');
for (const src of walk(cssDir)) {
  if (extname(src) !== '.css') continue;
  const rel = relative(cssDir, src);
  copyInto(src, join(ROOT, 'dist', 'css', rel));
  copied++;
}

console.log(`Copied ${copied} asset(s) into dist/ (component CSS/HTML + shared CSS).`);
