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
 * Last, dist/bundle/: each entry as a few files, for a page with no bundler of
 * its own. Will, TODO 350 D1. TRAP T-a-page-loads-the-bundle
 * It is all made in dist.next/ and swapped in whole; --watch writes in place.
 * TRAP T-a-build-is-swapped-in-whole
 *
 *   node scripts/build-reforged.mjs [--watch | --dev | --no-minify]
 *   (--no-minify: inlined as shipped, but with readable names — to profile)
 */
import { execSync, spawn } from 'node:child_process';
import { readdirSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync, watch, globSync, existsSync, unlinkSync, rmSync, renameSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import { build, transform } from 'esbuild';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const WATCH = process.argv.includes('--watch');
const DEV = WATCH || process.argv.includes('--dev');
const MINIFY = !process.argv.includes('--no-minify');
const DIST = join(ROOT, 'dist');
/* A page never meets an empty or half-built dist/: the build is made beside it,
   then swapped in. --watch writes in place, as tsc --watch emits into dist/.
   TRAP T-a-build-is-swapped-in-whole */
const OUT = WATCH ? DIST : join(ROOT, 'dist.next');
const OLD = join(ROOT, 'dist.old');
if (!WATCH) {
  // A build stopped between the two renames left the last dist/ as dist.old/.
  if (!existsSync(DIST) && existsSync(OLD)) renameSync(OLD, DIST);
  rmSync(OUT, { recursive: true, force: true });
}

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
  const tsc = `tsc -p tsconfig.reforged.json --outDir ${relative(ROOT, OUT)}`;
  console.log(`› ${tsc}`);
  execSync(`npx ${tsc}`, { stdio: 'inherit' });
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
// The icon sprite: the one file every icon is drawn from. TRAP T-an-icon-loads-when-first-drawn
copyFileSync(join(SRC, 'core/ui/icons.svg'), join(OUT, 'core/ui/icons.svg'));

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

/* A PAGE's copy of the Button look — the sheet every shadow root adopts — layered
   so a page's own rules win, and naming the layer order so it is right linked
   before tokens.css too. Before the inline step takes the file away.
   TRAP T-a-native-wears-the-button-class */
function writeButtonPage() {
  const look = readFileSync(join(OUT, 'core/sherpa-button-look.css'), 'utf8');
  const order = /^@layer [^{;]+;/m.exec(readFileSync(join(OUT, 'styles/tokens/tokens.css'), 'utf8'))?.[0] ?? '';
  writeFileSync(join(OUT, 'styles/button.css'), `${order}\n@layer components {\n${look}\n}\n`);
}
writeButtonPage();
console.log('✓ dist/styles/button.css — the Button look, for a page');

if (!DEV) {
  console.log('› inline the templates and sheets into the JS');
  const inlinedAssets = new Set();
  console.log(`✓ ${inlineFiles(OUT, inlinedAssets)} files inlined`);
  // Each now lives in its JS: the copy in dist/ would ship twice. TRAP T-the-text-is-in-the-js
  for (const asset of inlinedAssets) unlinkSync(asset);
  console.log(`✓ ${inlinedAssets.size} inlined files not shipped`);
  if (MINIFY) {
    console.log('› minify the JS (esbuild)');
    console.log(`✓ ${await minifyFiles(OUT)}`);
  }
}

/* The BUNDLE: each entry joined into a few files in dist/bundle/, sharing their
   common code. Every file sits in that one folder, so a module's own URL —
   tokens.css beside components.js, the icon sprite — is moved to point from
   there. A DEV build writes each entry as a pass-through to the modules, so the
   same path serves live reload. TRAP T-a-page-loads-the-bundle */
const BUNDLED = ['index', 'data', 'app', 'components', 'worker'];
const BUNDLE = join(OUT, 'bundle');

async function writeBundle() {
  rmSync(BUNDLE, { recursive: true, force: true });
  mkdirSync(BUNDLE, { recursive: true });
  if (DEV) {
    for (const entry of BUNDLED) writeFileSync(join(BUNDLE, `${entry}.js`), `export * from '../${entry}.js';\n`);
    return 'pass-through to the modules (a dev build)';
  }
  const moveUrls = {
    name: 'bundle-inputs',
    setup(b) {
      b.onLoad({ filter: /\.js$/ }, (args) => {
        const code = readFileSync(args.path, 'utf8');
        const moved = code.replace(/new URL\((['"])(\.{1,2}\/[^'"]+)\1,\s*import\.meta\.url\)/g, (_call, q, rel) => {
          const to = relative(BUNDLE, resolve(dirname(args.path), rel)).split('\\').join('/');
          return `new URL(${q}${to.startsWith('.') ? to : `./${to}`}${q}, import.meta.url)`;
        });
        return { contents: moved, loader: 'js' };
      });
    },
  };
  const out = await build({
    entryPoints: BUNDLED.map((entry) => join(OUT, `${entry}.js`)),
    bundle: true, splitting: true, format: 'esm', target: 'es2022', minify: MINIFY,
    legalComments: 'none', outdir: BUNDLE, entryNames: '[name]', write: true, metafile: true, logLevel: 'warning', plugins: [moveUrls],
  });
  const files = Object.keys(out.metafile.outputs);
  const bytes = files.reduce((n, f) => n + out.metafile.outputs[f].bytes, 0);
  return `${files.length} files, ${Math.round(bytes / 1024)} KB`;
}
console.log('› bundle each entry into dist/bundle/');
console.log(`✓ ${await writeBundle()}`);

/** The new build in, whole: two renames, ~150 µs apart, with no dist/ between them. */
function swapIn() {
  rmSync(OLD, { recursive: true, force: true });
  if (existsSync(DIST)) renameSync(DIST, OLD);
  renameSync(OUT, DIST);
  rmSync(OLD, { recursive: true, force: true });
}
if (!WATCH) {
  swapIn();
  console.log('✓ dist/ swapped in');
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
        if (f.endsWith('sherpa-button-look.css')) writeButtonPage();
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
