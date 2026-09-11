/**
 * build-reforged.mjs — compile the reforged src/ tree and copy its CSS/HTML
 * assets into dist/ (components load them at runtime via import.meta.url).
 *
 *   node scripts/build-reforged.mjs            one-shot
 *   node scripts/build-reforged.mjs --watch    stay up, rebuild on change
 *
 * --watch exists because `tsc --watch` alone is NOT enough here: a component's
 * CSS and HTML are separate runtime assets, so a CSS-only edit produces no TS
 * output and the change never reaches dist/ (or the examples app). The watch
 * runs tsc in watch mode AND re-transforms the changed CSS/HTML itself.
 */
import { execSync, spawn } from 'node:child_process';
import { readdirSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync, watch } from 'node:fs';
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

const WATCH = process.argv.includes('--watch');

// Structural CSS lint — guards the shadow-DOM rules (no chained :host, no `&`
// nesting inside :host{}, no light-dark/opacity-disabled). Fails the build on error.
//
// In WATCH mode it reports but does not exit: a lint error mid-edit would kill
// the watch, and you would not notice until nothing was updating any more. The
// one-shot build (and therefore CI and `npm test`) still treats it as fatal.
console.log('› lint:css');
try {
  execSync('node scripts/lint-css.mjs', { stdio: 'inherit' });
} catch (e) {
  if (!WATCH) throw e;
  console.error('✗ lint:css failed — continuing because --watch');
}

if (!WATCH) {
  console.log('› tsc -p tsconfig.reforged.json');
  execSync('npx tsc -p tsconfig.reforged.json', { stdio: 'inherit' });
}

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
/** Transform ONE asset file into its mirrored dist path. */
async function copyOne(full) {
  const dest = join(OUT, relative(SRC, full));
  mkdirSync(dirname(dest), { recursive: true });
  if (/\.css$/.test(full)) {
    const result = await cssProcessor.process(readFileSync(full, 'utf8'), { from: full, to: dest });
    writeFileSync(dest, result.css);
  } else {
    copyFileSync(full, dest);
  }
}

console.log('› css transform (preset-env + autoprefixer + cssnano)');
const cssCount = await copyAssets(SRC);
console.log(`✓ assets copied into dist/ (${cssCount} css transformed)`);

if (WATCH) {
  // tsc owns the TS half in its own process; this process owns the assets.
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.reforged.json', '--watch', '--preserveWatchOutput'],
    { stdio: 'inherit' });

  // Debounced: an editor save can fire several events for one write, and a
  // PostCSS run per event would queue up transforms of a half-written file.
  const pending = new Set();
  let timer = null;
  const flush = async () => {
    timer = null;
    const files = [...pending];
    pending.clear();
    for (const f of files) {
      try {
        await copyOne(f);
        console.log(`› asset ${relative(ROOT, f)}`);
      } catch (e) {
        // Keep the watch ALIVE on a CSS syntax error — the next save fixes it.
        console.error(`✗ ${relative(ROOT, f)}: ${e.message}`);
      }
    }
  };

  watch(SRC, { recursive: true }, (_event, name) => {
    if (!name || !/\.(css|html)$/.test(name)) return;
    pending.add(join(SRC, name));
    clearTimeout(timer);
    timer = setTimeout(flush, 60);
  });

  console.log('👀 watching src/ for CSS/HTML changes (tsc watching TS) — ctrl-C to stop');
  process.on('SIGINT', () => { tsc.kill(); process.exit(0); });
}
