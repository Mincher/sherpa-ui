/**
 * build-reforged.mjs — compile the reforged src/ tree and copy its CSS/HTML
 * assets into dist/ (components load them at runtime via import.meta.url).
 *
 *   node scripts/build-reforged.mjs
 */
import { execSync } from 'node:child_process';
import { readdirSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');

// ── CSS build transform ──────────────────────────────────────────────────────
// Source stays modern & raw (authored for Chromium; nesting, @property, color-mix,
// @container, @layer). The DIST copy is lowered for cross-browser via browserslist:
// preset-env flattens nesting + adds @property/color-mix fallbacks, autoprefixer adds
// vendor prefixes, cssnano minifies. Components load the DIST css into adoptedStyleSheets,
// so each file must stay a single valid stylesheet — preset-env preserves @layer + our
// live custom properties (we DON'T inline vars; the token cascade must stay dynamic).
const cssProcessor = postcss([
  postcssPresetEnv({
    stage: 2,
    features: {
      'nesting-rules': true, // flatten `&` nesting for Safari/Firefox
      'custom-properties': false, // keep --sherpa-* LIVE (dynamic cascade), don't inline
      'cascade-layers': false, // leave @layer intact — we rely on real layer ordering
      // Keep logical keywords LOGICAL — all targets (Safari 16+) support `start`/`end`;
      // lowering them to left/right would silently break RTL.
      'logical-properties-and-values': false,
    },
  }),
  autoprefixer(),
  cssnano({ preset: ['default', { discardComments: { removeAll: true } }] }),
]);

// Project Figma tokens first so each <comp>.css carries a fresh inlined token
// region before the copy step (one .css per component — no separate .tokens.css).
console.log('› project-tokens');
execSync('node scripts/project-tokens.mjs', { stdio: 'inherit' });

// Structural CSS lint — guards the shadow-DOM rules (no chained :host, no `&`
// nesting inside :host{}, no light-dark/opacity-disabled). Fails the build on error.
console.log('› lint:css');
execSync('node scripts/lint-css.mjs', { stdio: 'inherit' });

console.log('› tsc -p tsconfig.reforged.json');
execSync('npx tsc -p tsconfig.reforged.json', { stdio: 'inherit' });

/** Recursively process CSS (PostCSS transform) and copy HTML into the mirrored dist path. */
async function copyAssets(dir) {
  let cssCount = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      cssCount += await copyAssets(full);
    } else if (/\.css$/.test(entry)) {
      const dest = join(OUT, relative(SRC, full));
      mkdirSync(dirname(dest), { recursive: true });
      const src = readFileSync(full, 'utf8');
      const result = await cssProcessor.process(src, { from: full, to: dest });
      writeFileSync(dest, result.css);
      cssCount++;
    } else if (/\.html$/.test(entry)) {
      const dest = join(OUT, relative(SRC, full));
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(full, dest);
    }
  }
  return cssCount;
}
console.log('› css transform (preset-env + autoprefixer + cssnano)');
const cssCount = await copyAssets(SRC);
console.log(`✓ assets copied into dist/ (${cssCount} css transformed)`);
