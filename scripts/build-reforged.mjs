/**
 * Compile src/ and transform its CSS/HTML into dist/.
 * --watch also re-transforms assets — `tsc --watch` alone emits nothing for a
 * CSS-only edit, so the change never reaches dist/.
 *
 * Each template and sheet a module hands the templater is put in the JS, so a
 * component fetches nothing — except in a DEV build (--dev, --watch), which
 * keeps the URLs for live reload. Will, TODO 208. TRAP T-the-text-is-in-the-js
 * Then each module is MINIFIED, one by one — never bundled, so every import
 * path holds; a dev build stays readable. Will, TODO 199.
 *
 *   node scripts/build-reforged.mjs [--watch | --dev]
 */
import { execSync, spawn } from 'node:child_process';
import { readdirSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync, watch, globSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import { transform } from 'esbuild';

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
const DEV = WATCH || process.argv.includes('--dev');

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

/** A template's text with no comments, no indent and no `data-accepts` — the
 *  spec carries that; nothing reads it at run time. */
const lean = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/ data-accepts="[^"]*"/g, '')
  .replace(/\n[ \t]+/g, '\n').trim();

/** Wrap each `new URL('./x.css' | './x.html', import.meta.url)` in `inlined(…, text)`.
 *  One ending in `.href` is a page's <link>, not the templater's, and stays a URL. */
function inlineFiles(dir, inlinedAssets) {
  let count = 0;
  for (const file of globSync('**/*.js', { cwd: dir })) {
    const path = join(dir, file);
    const src = readFileSync(path, 'utf8');
    let used = false;
    const out = src.replace(/new URL\((['"])(\.{1,2}\/[^'"]+\.(css|html))\1,\s*import\.meta\.url\)(?!\.href)/g,
      (call, _q, rel, kind) => {
        const asset = join(dirname(path), rel);
        if (!existsSync(asset)) return call;
        const text = readFileSync(asset, 'utf8');
        used = true;
        count++;
        inlinedAssets.add(asset);
        return `inlined(${call}, ${JSON.stringify(kind === 'html' ? lean(text) : text)})`;
      });
    if (!used) continue;
    const from = relative(dirname(path), join(dir, 'core/ui/templater.js')).split('\\').join('/');
    writeFileSync(path, `import { inlined } from '${from.startsWith('.') ? from : `./${from}`}';\n${out}`);
  }
  return count;
}

/** Minify each module on its own: no bundle, so every import path holds. */
async function minifyFiles(dir) {
  let before = 0;
  let after = 0;
  for (const file of globSync('**/*.js', { cwd: dir })) {
    const path = join(dir, file);
    const code = readFileSync(path, 'utf8');
    const out = await transform(code, { minify: true, format: 'esm', target: 'es2022', legalComments: 'none' });
    before += code.length;
    after += out.code.length;
    writeFileSync(path, out.code);
  }
  return `${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB`;
}

if (!DEV) {
  console.log('› inline the templates and sheets into the JS');
  const inlinedAssets = new Set();
  console.log(`✓ ${inlineFiles(OUT, inlinedAssets)} files inlined`);
  // Each now lives in its JS: the copy in dist/ would ship twice. TRAP T-the-text-is-in-the-js
  for (const asset of inlinedAssets) unlinkSync(asset);
  console.log(`✓ ${inlinedAssets.size} inlined files not shipped`);
  console.log('› minify the JS (esbuild)');
  console.log(`✓ ${await minifyFiles(OUT)}`);
}

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
