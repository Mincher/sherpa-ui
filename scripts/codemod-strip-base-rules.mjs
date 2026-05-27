#!/usr/bin/env node
/**
 * codemod-strip-base-rules.mjs
 *
 * Phase 1 cleanup: delete rules now provided by sherpa-base.css from every
 * component CSS file. Idempotent — safe to re-run.
 *
 * Removes:
 *   • `:host([hidden]) { display: none; }`        (single-line OR multi-line)
 *   • `i { font-style: normal; }`                 (single-line OR multi-line)
 *
 * Leaves sherpa-base.css and sherpa-anchor.css untouched.
 *
 * Usage: node scripts/codemod-strip-base-rules.mjs [--dry]
 */

import { readFile, writeFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DRY = process.argv.includes("--dry");

const EXEMPT = new Set([
  resolve(ROOT, "components/utilities/sherpa-element/sherpa-base.css"),
  resolve(ROOT, "components/utilities/sherpa-element/sherpa-anchor.css"),
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (s.isFile() && p.endsWith(".css")) out.push(p);
  }
  return out;
}

// `:host([hidden])` rule whose body is *only* `display: none` (any whitespace).
const HIDDEN_RE =
  /^[ \t]*:host\(\[hidden\]\)\s*\{\s*display\s*:\s*none\s*;?\s*\}\s*\n?/gm;

// `i` selector (must be standalone — no chain) whose body is *only*
// `font-style: normal`. Anchored at start of line to avoid matching
// `body i { ... }` etc.
const ICON_RESET_RE =
  /^[ \t]*i\s*\{\s*font-style\s*:\s*normal\s*;?\s*\}\s*\n?/gm;

let totalRemoved = 0;
let filesChanged = 0;

for (const f of walk(join(ROOT, "components"))) {
  if (EXEMPT.has(f)) continue;
  const src = await readFile(f, "utf8");

  const hiddenHits = (src.match(HIDDEN_RE) || []).length;
  const iconHits = (src.match(ICON_RESET_RE) || []).length;
  if (hiddenHits + iconHits === 0) continue;

  let out = src.replace(HIDDEN_RE, "");
  out = out.replace(ICON_RESET_RE, "");
  // Collapse 3+ blank lines that may result from deletions.
  out = out.replace(/\n{3,}/g, "\n\n");

  console.log(
    `${relative(ROOT, f)}  -${hiddenHits} hidden  -${iconHits} icon-reset`,
  );
  totalRemoved += hiddenHits + iconHits;
  filesChanged++;

  if (!DRY) await writeFile(f, out, "utf8");
}

console.log(
  `\n${filesChanged} file(s) changed · ${totalRemoved} rule(s) removed` +
    (DRY ? "  [DRY RUN]" : ""),
);
