#!/usr/bin/env node
/**
 * Structural linter for component CSS (PostCSS, so native nesting is understood).
 * Only the AUTHORED region is linted — the projector owns everything above the
 * `sherpa:tokens` end marker.
 *
 *   node scripts/lint-css.mjs            # lint every src/components/…/*.css
 *   node scripts/lint-css.mjs --strict   # elevate warnings to errors
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');
const STRICT = process.argv.includes('--strict');
const TOKENS_MARK_END = '/* == end sherpa:tokens == */';

/* The grids come from tokens.css, not from a number here — a theme that moves a
   scale moves the lint with it. There are TWO: spacing/sizing sits on one grid,
   text and the icons that alias it on a finer one.
   TRAP T-the-grid-is-two-grids */
function readGrids() {
  const fallback = { space: 4, text: 2 };
  const path = join(ROOT, 'src', 'styles', 'tokens', 'tokens.css');
  if (!existsSync(path)) return fallback;
  const css = readFileSync(path, 'utf8');
  const one = (name, d) => {
    const m = css.match(new RegExp(`--sherpa-grid-${name}-step\\s*:\\s*(\\d+)px`));
    return m ? Number(m[1]) : d;
  };
  return { space: one('space', fallback.space), text: one('text', fallback.text) };
}
const GRID = readGrids();

/* `var(--token, 12px)` — the px came from the token, so the grid question is
   "is the TOKEN on the grid", which project-tokens.mjs answers, not this file. */
const TOKEN_FALLBACK = /var\(\s*--[\w-]+\s*,[^)]*\d+px/;

/* An icon is the SAME size as the text beside it, so a box sized FROM the type
   scale answers to the text grid whatever the property is called — the token in
   the VALUE says so, not the property name. Measured 2026-09-24: 24 sites read
   `inline-size: var(--sherpa-theme-size-icon-*)`, every one a real icon box. */
const TEXT_SIZED_PROP = /(font-size|line-height)/i;
const TEXT_SIZED_VALUE = /--[\w-]*(size-icon|icon-size|content-size|font-size|fonts-scale)[\w-]*/i;

function authoredCss(css) {
  const end = css.indexOf(TOKENS_MARK_END);
  return end === -1 ? css : css.slice(end + TOKENS_MARK_END.length);
}

function isHostRule(rule) {
  return /^\s*:host\b/.test(rule.selector);
}

function insideHostBlock(rule) {
  let p = rule.parent;
  while (p && p.type === 'rule') {
    if (isHostRule(p)) return true;
    p = p.parent;
  }
  return false;
}

function nextComment(decl) {
  const next = decl.next?.();
  return next && next.type === 'comment' ? next.text : '';
}

/** A comment on the SAME line as the declaration, after its `;`. */
function sameLineComment(decl) {
  const next = decl.next?.();
  if (!next || next.type !== 'comment') return '';
  return next.source?.start?.line === decl.source?.end?.line ? next.text : '';
}

/* The Theme "active" ramp, read straight. A state binds the Style MODE instead,
   as Figma binds a Style variable and pins a mode — or a change to the mode
   never arrives. TRAP T-a-state-colour-binds-the-style-mode */
const THEME_ACTIVE = /--sherpa-theme-(surface|border|content)-active-/;

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

    // Functional `:host(…)` and bare `:host` are fine; only the chained form fails.
    if (/:host[:.#[]/.test(sel)) {
      report('error', file, line, 'chained-host',
        `chained :host form "${sel.trim()}" — use functional :host(:not(…)) / :host([…]).`);
    }

    if (sel.includes('&') && insideHostBlock(rule)) {
      report('error', file, line, 'host-nesting',
        `"& …" nested inside a :host {} block — desugars to chained form. `
        + `Write compound host selectors as standalone :host(…) rules.`);
    }
  });

  root.walkDecls((decl) => {
    const line = decl.source?.start?.line ?? 0;
    // A focus ring on the wrong token fails silently — it draws in the fallback
    // colour only.
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
        // A `--_*` private var passes — error-state components route through one.
        || /var\(--_/.test(decl.value);
      if (inFocus && !ok) {
        report('error', file, line, 'focus-ring',
          `focus ring must be `
          + `inset 0 0 0 2px var(--sherpa-theme-border-accent-2, #3b4ccd) `
          + `(or a --_* private var that resolves to it). Got: ${decl.value}`);
      }
    }
    if (/\blight-dark\(/.test(decl.value)) {
      report('error', file, line, 'light-dark',
        `light-dark() in component CSS — themes own mode; components are mode-agnostic.`);
    }
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
    // Off-grid px in a sizing prop. border* is exempt; font-size answers to the
    // text grid rather than being skipped. TRAP T-the-grid-is-two-grids
    const prop = decl.prop;
    if (/^border/.test(prop)) return;
    if (!/(margin|padding|gap|inset|top|right|bottom|left|width|height|size|radius|rounding|translate|font-size|line-height)/i.test(prop)) return;
    // Which grid this property answers to.
    const textSized = TEXT_SIZED_PROP.test(prop) || TEXT_SIZED_VALUE.test(decl.value);
    const step = textSized ? GRID.text : GRID.space;
    const line = decl.source?.start?.line ?? 0;
    // Drawn glyphs opt out with a trailing `/* off-grid-ok */`.
    const trailing = (decl.raws?.value?.raw ?? '') + (decl.raws?.between ?? '');
    if (/off-grid-ok/.test(trailing) || /off-grid-ok/.test(nextComment(decl))) return;
    for (const m of decl.value.matchAll(/(?<![\w.])(\d+)px\b/g)) {
      const v = Number(m[1]);
      if (v <= 1 || v === 999) continue;      // strokes + the pill idiom
      if (v % step === 0) continue;
      // A fallback INSIDE var() is the token's own value — `space-3xs` really
      // is 2px. project-tokens.mjs checks the SCALE against its own grid.
      if (TOKEN_FALLBACK.test(decl.value)) continue;
      const which = textSized ? 'text' : 'spacing';
      report('warning', file, line, 'off-grid',
        `${prop}: ${v}px is off the ${step}px ${which} grid — use a step (…, ${step}, ${step * 2}, ${step * 3}…), the token's real value, or add /* off-grid-ok */ if it's a drawn glyph.`);
    }
  });

  root.walkDecls((decl) => {
    if (!THEME_ACTIVE.test(decl.value)) return;
    if (/theme-direct/.test(sameLineComment(decl))) return;
    report('error', file, decl.source?.start?.line ?? 0, 'theme-active',
      `${decl.prop} reads the Theme "active" ramp — bind the Style mode (--sherpa-style-active-*, `
      + `--sherpa-style-<look>-active-*), or add /* theme-direct */ where Figma binds Theme too.`);
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
