/**
 * Compile src/ and transform its CSS/HTML into dist/.
 * --watch also re-transforms assets — `tsc --watch` alone emits nothing for a
 * CSS-only edit, so the change never reaches dist/.
 *
 *   node scripts/build-reforged.mjs [--watch]
 */
import { execSync, spawn } from 'node:child_process';
import { readdirSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync, watch } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');

// Each output must stay ONE valid stylesheet — components adopt it into
// adoptedStyleSheets. Nesting ships AS WRITTEN: no supported engine lacks it
// since the Safari 16 floor went (Will, TODO 36).
const cssProcessor = postcss([
  autoprefixer(),
  cssnano({ preset: ['default', { discardComments: { removeAll: true } }] }),
]);

// Must run first: it rewrites each <comp>.css token region in place.
console.log('› project-tokens');
execSync('node scripts/project-tokens.mjs', { stdio: 'inherit' });

const WATCH = process.argv.includes('--watch');

// Fatal one-shot; in --watch it only reports — an error there would kill the
// watch and stop all updates silently.
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

console.log('› css transform (autoprefixer + cssnano)');
const cssCount = await copyAssets(SRC);
console.log(`✓ assets copied into dist/ (${cssCount} css transformed)`);

if (WATCH) {
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.reforged.json', '--watch', '--preserveWatchOutput'],
    { stdio: 'inherit' });

  // Debounced: one save fires several events, and a run per event would
  // transform a half-written file.
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
