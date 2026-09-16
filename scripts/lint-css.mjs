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
 *   E focus-ring     a focus ring not drawn with the canonical accent token
 *   W off-grid       an odd px literal (>=1px, not on the 2px grid) in a spacing/sizing/
 *                    radius property. Sherpa uses an 8px grid with a 4px text sub-grid;
 *                    2px/1px are edge cases, sub-1px is stroke-only. Allowed: sub-1px +
 *                    1px, 999px (pill), all `border*` props (CSS triangles / hairlines),
 *                    and font-size (occasional 2px-step scale). Fallbacks count too —
 *                    keep them equal to the on-grid token they back.
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

/** The comment node immediately following a decl (same line), else ''. */
function nextComment(decl) {
  const next = decl.next?.();
  return next && next.type === 'comment' ? next.text : '';
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
    /* E focus-ring: a focus ring drawn with anything but the canonical token.
       47 sites use `--sherpa-theme-border-accent-2, #3b4ccd` and nothing else.
       CLAUDE.md named a DIFFERENT token until 2026-09-16 — one that does not
       exist in tokens.css — so anyone who followed the doc got a ring in the
       fallback colour only. A ring nobody can see is an accessibility bug, and
       a wrong token fails silently, which is why this is a lint and not a note. */
    if (decl.prop === 'box-shadow' && /inset 0 0 0 2px/.test(decl.value)) {
      const inFocus = (() => {
        let p2 = decl.parent;
        while (p2 && p2.type === 'rule') {
          if (/:focus-visible|:focus\b/.test(p2.selector)) return true;
          p2 = p2.parent;
        }
        return false;
      })();
      const ok = /--sherpa-theme-border-accent-2\s*,\s*#3b4ccd/.test(decl.value)
        /* A PRIVATE var passes. A component that also draws an error ring
           (input-text) or names its accent once (progress-step-tracker) routes
           through `--_*`, and those resolve to the right thing —
           `--_border-error` is deliberately the RED status colour, not the
           accent. What this rule is for is a ring wired straight to some OTHER
           shared token, which is how the 47 copies could have drifted apart. */
        || /var\(--_/.test(decl.value);
      if (inFocus && !ok) {
        report('error', file, line, 'focus-ring',
          `focus ring must be `
          + `inset 0 0 0 2px var(--sherpa-theme-border-accent-2, #3b4ccd) `
          + `(or a --_* private var that resolves to it). Got: ${decl.value}`);
      }
    }
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

  root.walkDecls((decl) => {
    // Grid compliance: odd px literals in spacing/sizing/radius props. `border*`
    // (triangles/hairlines) and font-size are exempt; sub-1px + 1px + 999px allowed.
    const prop = decl.prop;
    if (/^border/.test(prop) || prop === 'font-size') return;
    if (!/(margin|padding|gap|inset|top|right|bottom|left|width|height|size|radius|rounding|translate)/i.test(prop)) return;
    const line = decl.source?.start?.line ?? 0;
    // Explicit opt-out for intentionally off-grid drawn glyphs (CSS triangles /
    // chevrons): a trailing `/* off-grid-ok */` comment on the declaration.
    const trailing = (decl.raws?.value?.raw ?? '') + (decl.raws?.between ?? '');
    if (/off-grid-ok/.test(trailing) || /off-grid-ok/.test(nextComment(decl))) return;
    for (const m of decl.value.matchAll(/(?<![\w.])(\d+)px\b/g)) {
      const v = Number(m[1]);
      if (v <= 1 || v === 999) continue;      // 1px edge case + 999 pill idiom
      if (v % 2 === 0) continue;               // on the 2px grid
      report('warning', file, line, 'off-grid',
        `${prop}: ${v}px is off the 2px/8px grid — use a grid step (…, 2, 4, 8…), the token's real value, or add /* off-grid-ok */ if it's a drawn glyph.`);
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
