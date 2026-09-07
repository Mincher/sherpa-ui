#!/usr/bin/env node
/**
 * lint-css.mjs — structural linter for component CSS (the `npm run lint:css` the
 * docs always promised but never shipped). PostCSS-based, so it understands native
 * nesting and modern selectors — which is the whole point: it GUARDS the modern-CSS
 * upgrade so a future edit can't reintroduce the shadow-DOM footguns.
 *
 *   node scripts/lint-css.mjs            # lint every src/components/…/*.css (authored region)
 *   node scripts/lint-css.mjs --strict   # elevate warnings to errors
 *
 * Rules (from CLAUDE.md "CSS owns all visibility" + "Template rules"):
 *   E chained-host   `:host:not(...)` / `:host:hover` chained form — broken in shadow DOM.
 *   E host-nesting   `&` nesting INSIDE a `:host {}` block — desugars to the broken
 *                    chained form. Nesting is allowed only BELOW :host (inside .class{}).
 *   E light-dark     `light-dark()` in component CSS — themes own mode, components are
 *                    mode-agnostic.
 *   E disabled-opacity  `opacity` under `:host([disabled])` — compounds in dark mode.
 *   W viewport-media `@media` other than forced-colors / prefers-* — components use
 *                    @container, not viewport media (warning; --strict makes it fail).
 *
 * Only the AUTHORED region is linted (below the generated `sherpa:tokens` marker):
 * the projector owns everything above it.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');
const STRICT = process.argv.includes('--strict');
const TOKENS_MARK_END = '/* == end sherpa:tokens == */';

function authoredCss(css) {
  const end = css.indexOf(TOKENS_MARK_END);
  return end === -1 ? css : css.slice(end + TOKENS_MARK_END.length);
}

/** Is this rule's own selector a `:host` (possibly functional `:host(...)`) rule? */
function isHostRule(rule) {
  return /^\s*:host\b/.test(rule.selector);
}

/** Walk up: is any ancestor rule a `:host {}` block? (nesting-inside-host check) */
function insideHostBlock(rule) {
  let p = rule.parent;
  while (p && p.type === 'rule') {
    if (isHostRule(p)) return true;
    p = p.parent;
  }
  return false;
}

const findings = [];
function report(level, file, line, code, msg) {
  findings.push({ level, file, line, code, msg });
}

function lintFile(file, cssRaw) {
  const css = authoredCss(cssRaw);
  let root;
  try {
    root = postcss.parse(css, { from: file });
  } catch (e) {
    report('error', file, 0, 'parse', `PostCSS could not parse: ${e.message}`);
    return;
  }

  root.walkRules((rule) => {
    const line = rule.source?.start?.line ?? 0;
    const sel = rule.selector;

    // E chained-host: `:host` immediately followed by `:` `.` `#` `[` — the broken
    // chained form (`:host:not(…)`, `:host[disabled]`, `:host.foo`). Functional
    // `:host(…)` and bare `:host` (end / space / comma) are fine.
    if (/:host[:.#[]/.test(sel)) {
      report('error', file, line, 'chained-host',
        `chained :host form "${sel.trim()}" — use functional :host(:not(…)) / :host([…]).`);
    }

    // E host-nesting: a nested rule (has a rule parent) that uses `&`, sitting
    // inside a :host {} block. `&` there desugars to the broken chained form.
    if (sel.includes('&') && insideHostBlock(rule)) {
      report('error', file, line, 'host-nesting',
        `"& …" nested inside a :host {} block — desugars to chained form. `
        + `Write compound host selectors as standalone :host(…) rules.`);
    }
  });

  root.walkDecls((decl) => {
    const line = decl.source?.start?.line ?? 0;
    // E light-dark
    if (/\blight-dark\(/.test(decl.value)) {
      report('error', file, line, 'light-dark',
        `light-dark() in component CSS — themes own mode; components are mode-agnostic.`);
    }
    // E disabled-opacity: `opacity` under a :host([disabled]) ancestor
    if (decl.prop === 'opacity') {
      let p = decl.parent;
      while (p && p.type === 'rule') {
        if (/:host\(\[disabled\]\)/.test(p.selector)) {
          report('error', file, line, 'disabled-opacity',
            `opacity under :host([disabled]) — compounds in dark mode; use inactive tokens per property.`);
          break;
        }
        p = p.parent;
      }
    }
  });

  root.walkAtRules('media', (at) => {
    const line = at.source?.start?.line ?? 0;
    const params = at.params;
    const sanctioned = /forced-colors|prefers-reduced-motion|prefers-contrast|prefers-color-scheme/.test(params);
    if (!sanctioned) {
      report('warning', file, line, 'viewport-media',
        `@media (${params}) — components use @container, not viewport media.`);
    }
  });
}

// ── run ──────────────────────────────────────────────────────────────────────
const dirs = existsSync(C) ? readdirSync(C, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
let fileCount = 0;
for (const d of dirs) {
  const p = join(C, d.name, `${d.name}.css`);
  if (!existsSync(p)) continue;
  fileCount++;
  lintFile(`src/components/${d.name}/${d.name}.css`, readFileSync(p, 'utf8'));
}

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warning');

for (const f of [...errors, ...warnings]) {
  const tag = f.level === 'error' ? 'ERROR' : 'warn ';
  console.log(`${tag} ${f.file}:${f.line}  [${f.code}] ${f.msg}`);
}

const failWarnings = STRICT && warnings.length > 0;
console.log(
  `\nlint:css — ${fileCount} files · ${errors.length} error(s) · ${warnings.length} warning(s)`
  + (STRICT ? ' (strict)' : ''),
);

if (errors.length || failWarnings) process.exit(1);
