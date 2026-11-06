#!/usr/bin/env node
/**
 * check-layers.mjs — a z-index is a NAME from the layer scale, or it is counted.
 *
 * src/core/sherpa-layers.css writes the scale once. Anywhere else a layer is
 * `var(--sherpa-layer-<name>, <that value>)` — the fallback equal to the scale — or
 * `auto`, or a private `--_*`. A bare number is a loose layer: counted per file, and the
 * count may only fall (scripts/layers-baseline.json); a number inside a component that
 * seals its own stacking (`isolation: isolate`) is the usual case. TRAP T-the-layers-are-one-scale
 * `--update-baseline` records a fall. The generated tokens.css is Figma's, not this gate's.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCALE_FILE = 'src/core/sherpa-layers.css';
const BASELINE = join(ROOT, 'scripts', 'layers-baseline.json');
const SKIP = new Set(['src/styles/tokens/tokens.css']);

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (name.endsWith('.css')) yield path;
  }
}

const scale = {};
for (const [, name, value] of strip(readFileSync(join(ROOT, SCALE_FILE), 'utf8')).matchAll(/--sherpa-layer-([\w-]+)\s*:\s*(-?\d+)\s*;/g)) scale[name] = Number(value);

const problems = [];
const loose = {};
for (const path of walk(join(ROOT, 'src'))) {
  const file = relative(ROOT, path);
  if (file === SCALE_FILE || SKIP.has(file)) continue;
  const css = strip(readFileSync(path, 'utf8'));
  for (const m of css.matchAll(/(?<![\w-])z-index\s*:\s*([^;}]+)/g)) {
    const value = m[1].trim();
    const line = css.slice(0, m.index).split('\n').length;
    for (const [, name, fallback] of value.matchAll(/var\(\s*--sherpa-layer-([\w-]+)\s*(?:,\s*(-?\d+)\s*)?\)/g)) {
      if (!(name in scale)) problems.push(`${file}:${line} z-index names --sherpa-layer-${name}, which the scale does not have`);
      else if (fallback === undefined || Number(fallback) !== scale[name]) problems.push(`${file}:${line} --sherpa-layer-${name} needs its fallback, ${scale[name]}, as the scale writes it`);
    }
    const named = /--sherpa-layer-/.test(value);
    if (named || value === 'auto' || /^var\(\s*--_/.test(value) || /^(inherit|initial|unset)$/.test(value)) continue;
    loose[file] = (loose[file] ?? 0) + 1;
  }
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE, `${JSON.stringify(Object.fromEntries(Object.entries(loose).sort()), null, 2)}\n`);
  console.log(`check-layers: baseline recorded — ${total(loose)} loose layers in ${Object.keys(loose).length} files`);
  process.exit(0);
}
for (const [file, n] of Object.entries(loose)) {
  if (n > (baseline[file] ?? 0)) problems.push(`${file} has ${n} bare z-index number(s), baseline ${baseline[file] ?? 0}: name it in ${SCALE_FILE}, or seal it inside its component`);
}
if (problems.length) {
  console.error(`check-layers: ${problems.length} problem(s)\n\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`check-layers: ${Object.keys(scale).length} named layers; ${total(loose)} loose, baseline ${total(baseline)}`);
