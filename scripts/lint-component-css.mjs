#!/usr/bin/env node
/**
 * lint-component-css.mjs — Sherpa CSS structural linter.
 *
 * Enforces the rules locked in docs/CSS-FILE-TEMPLATE.md.
 *
 * Usage:
 *   node scripts/lint-component-css.mjs              # warn on grid violations
 *   node scripts/lint-component-css.mjs --strict     # block grid violations too
 *   node scripts/lint-component-css.mjs path/to.css  # lint specific files
 *
 * Exit code:
 *   0 — no blocking findings
 *   1 — one or more blocking findings
 */

import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const explicitFiles = args.filter((a) => !a.startsWith("--"));

// ── File discovery ─────────────────────────────────────────────────────────
const COMPONENT_GLOB_ROOTS = [
  join(ROOT, "components"),
  join(ROOT, "docs"),
];
// Files exempt from the "no redeclare base rules" check.
const BASE_SHEETS = new Set([
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

const files = explicitFiles.length
  ? explicitFiles.map((f) => resolve(f))
  : COMPONENT_GLOB_ROOTS.flatMap((d) => walk(d));

// ── Rule implementations ───────────────────────────────────────────────────

/** Strip block comments so they don't contaminate selector/string matching. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Find line number (1-based) for an index into the original source. */
function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

const ALLOWED_PX = new Set([1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 72, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512, 640, 768, 896, 1024, 1280]);

function lintFile(absPath, raw) {
  const findings = [];
  const code = stripComments(raw);
  const rel = relative(ROOT, absPath);

  const push = (severity, line, rule, message) =>
    findings.push({ severity, line, rule, message, file: rel });

  // R1: chained :host:not / :host:is / :host:has — broken in shadow DOM.
  for (const m of code.matchAll(/:host:(?:not|is|has|where)\(/g)) {
    push("error", lineOf(raw, m.index), "host-chained-pseudo",
      `Chained \`${m[0]}\` does not match in shadow DOM. Use functional form \`:host(${m[0].slice(6)}…)\`.`);
  }

  // R2: nesting inside :host {} — desugars to chained form.
  // Find every `:host {` block (no parentheses immediately after) and scan its body
  // for `&` as the first non-whitespace token of a rule.
  const hostBlockRe = /(^|[\s,;}])(:host)\s*\{/g;
  let bm;
  while ((bm = hostBlockRe.exec(code)) !== null) {
    const open = bm.index + bm[0].length - 1; // position of `{`
    const close = findMatchingBrace(code, open);
    if (close < 0) continue;
    const body = code.slice(open + 1, close);
    // Look for `&` at the start of any rule inside this block (allowing nested braces to skip)
    let depth = 0;
    let atRuleStart = true;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === "{") { depth++; atRuleStart = false; continue; }
      if (ch === "}") { depth--; atRuleStart = true; continue; }
      if (ch === ";") { atRuleStart = true; continue; }
      if (depth !== 0) continue;
      if (/\s/.test(ch)) continue;
      if (atRuleStart && ch === "&") {
        push("error", lineOf(raw, open + 1 + i), "host-ampersand-nesting",
          "`&` inside `:host {}` desugars to chained `:host…` form which fails in shadow DOM. Hoist to standalone `:host(…)` rule.");
      }
      atRuleStart = false;
    }
  }

  // R3 + R4: redeclaring base sheet rules.
  if (!BASE_SHEETS.has(absPath)) {
    for (const m of code.matchAll(/:host\(\[hidden\]\)\s*\{[^}]*display\s*:\s*none/g)) {
      push("error", lineOf(raw, m.index), "redeclare-hidden",
        "`:host([hidden]) { display: none }` is provided by sherpa-base.css — delete this rule.");
    }
    for (const m of code.matchAll(/(^|[\s,;}])i\s*\{[^}]*font-style\s*:\s*normal/g)) {
      push("error", lineOf(raw, m.index + m[1].length), "redeclare-icon-reset",
        "`i { font-style: normal }` is provided by sherpa-base.css — delete this rule.");
    }
  }

  // R5: JSDoc header.
  if (!/^\s*\/\*\*/.test(raw)) {
    push("warn", 1, "missing-jsdoc-header",
      "File should start with a `/** … */` JSDoc header per docs/COMPONENT-API-STANDARD.md.");
  }

  // R6: opacity inside [disabled] selector block.
  const disabledBlockRe = /\[disabled\][^{]*\{([^}]*)\}/g;
  let dm;
  while ((dm = disabledBlockRe.exec(code)) !== null) {
    if (/\bopacity\s*:/.test(dm[1])) {
      push("error", lineOf(raw, dm.index), "disabled-opacity",
        "Never use `opacity` for `[disabled]`. Apply inactive tokens per property (color / background / border).");
    }
  }

  // R8: stale token namespace — semantic color tokens were renamed from
  // --sherpa-text-{default|inactive|primary|context|on-color}-* and
  // --sherpa-icon-context-* to --sherpa-content-* in the apex-2 theme.
  // Using the old names silently falls through to hardcoded light-mode fallbacks,
  // producing dark text in dark mode. Component-API hooks like --sherpa-icon-color
  // are not affected (they use a shorter path with no semantic segment).
  for (const m of code.matchAll(
    /var\(\s*(--sherpa-(?:text-(?:default|inactive|primary|context|on-color|placeholder)|icon-context)-[\w-]+)/g,
  )) {
    push("error", lineOf(raw, m.index), "stale-token-namespace",
      `\`${m[1]}\` uses a removed namespace. Replace with the equivalent \`--sherpa-content-*\` token (e.g. --sherpa-text-default-body → --sherpa-content-default-body).`);
  }

  // R7: off-grid pixel literals.
  const gridSeverity = STRICT ? "error" : "warn";
  for (const m of code.matchAll(/(?<![\w.-])(\d+)px\b/g)) {
    const px = Number(m[1]);
    if (px === 0) continue;
    if (ALLOWED_PX.has(px)) continue;
    push(gridSeverity, lineOf(raw, m.index), "off-grid-pixel",
      `\`${px}px\` is off the 8/4/2/1 grid. Use 4, 8, 12, 16, 20, 24, 32, … or a Sherpa space token.`);
  }

  return findings;
}

function findMatchingBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// ── Run ────────────────────────────────────────────────────────────────────
let errors = 0;
let warnings = 0;
const findings = [];

for (const f of files) {
  const raw = await readFile(f, "utf8");
  const fs = lintFile(f, raw);
  findings.push(...fs);
  for (const x of fs) {
    if (x.severity === "error") errors++;
    else warnings++;
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

for (const [file, fs] of [...byFile].sort()) {
  console.log(`\n${file}`);
  for (const x of fs.sort((a, b) => a.line - b.line)) {
    const tag = x.severity === "error" ? "ERROR" : "warn ";
    console.log(`  ${tag} L${x.line}  [${x.rule}]  ${x.message}`);
  }
}

console.log(
  `\n${files.length} file(s) scanned · ${errors} error(s) · ${warnings} warning(s)` +
    (STRICT ? "  [strict]" : ""),
);

process.exit(errors > 0 ? 1 : 0);
