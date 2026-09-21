#!/usr/bin/env node
/**
 * Checks a component's CSS consumes the colour variable Figma BINDS — token
 * values can agree while the component points at a different token.
 *
 *   node scripts/figma-harvest-colours.mjs --snippet [--batch=N]
 *   node scripts/figma-harvest-colours.mjs --names
 *   node scripts/figma-harvest-colours.mjs --diff=<harvest.json> [--wrong-only]
 *
 * A binding counts as satisfied when the CSS mentions the projected property
 * anywhere; the two sides share no element↔selector correspondence.
 *
 * Known false positives, none silenced: JS-driven colour (barchart series hues
 * live in the .ts), slotted specimens the component does not own, one Figma
 * node shared by several components, and status-cascade colour.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const COMPONENTS = join(ROOT, 'src/components');

/** Every component dir → its Figma name, from the generated spec. */
export function componentMap() {
  const map = {};
  for (const dir of readdirSync(COMPONENTS)) {
    const spec = join(COMPONENTS, dir, `${dir}.component.yaml`);
    let text;
    try { text = readFileSync(spec, 'utf8'); } catch { continue; }
    const m = /^\s*figmaName:\s*(.+)$/m.exec(text);
    if (m) map[dir] = m[1].trim();
  }
  return map;
}

/**
 * Figma variable path → projected CSS custom property.
 * "Style::style-surface/base +1" → "--sherpa-style-surface-base-1"
 * Mirrors project-tokens.mjs — keep the two in step.
 */
export function cssVarFor(figmaPath) {
  const [collection, ...rest] = figmaPath.split('::');
  if (!rest.length) return null;
  const leaf = rest.join('::');
  const slug = (s) => s
    .trim()
    .replace(/\+(\d+)/g, '$1')     // "base +1" → "base 1"
    .replace(/[/\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();
  const col = slug(collection);
  // Drop the collection prefix only when the leaf already carries it.
  const leafSlug = slug(leaf);
  return leafSlug.startsWith(col + '-') || leafSlug === col
    ? `--sherpa-${leafSlug}`
    : `--sherpa-${col}-${leafSlug}`;
}

/**
 * Every `--sherpa-*` a component's CSS mentions, INCLUDING the generated
 * scoped-token region at the top: component-scoped collections project there
 * and not into tokens.css.
 */
export function cssTokensUsed(dir) {
  let text;
  try { text = readFileSync(join(COMPONENTS, dir, `${dir}.css`), 'utf8'); } catch { return new Set(); }
  return new Set([...text.matchAll(/--sherpa-[a-z0-9-]+/g)].map((m) => m[0]));
}

/**
 * Rows belonging to THIS component, not to something it instances. Matched on
 * path SEGMENTS, so "Container Header" is not a match for "Container".
 */
export function ownRows(rows, selfName, allFigmaNames) {
  const others = new Set(allFigmaNames.filter((n) => n !== selfName));
  return rows.filter((r) => {
    const segs = r.at.split('>');
    // segs[0] is the component itself; a variant ("Type=icon") is still its own.
    return !segs.slice(1).some((s) => others.has(s));
  });
}

/**
 * Every `--sherpa-*` token's resolved hex, following the alias chain in
 * tokens.css. Only the FIRST (light, :root) definition counts — taking a dark
 * or density redefinition too would report one binding as two colours.
 */
export function resolvedColours() {
  const css = readFileSync(join(ROOT, 'src/styles/tokens/tokens.css'), 'utf8');
  const decl = new Map();
  for (const m of css.matchAll(/(--sherpa-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!decl.has(m[1])) decl.set(m[1], m[2].trim());
  }
  const seen = new Map();
  const resolve = (name, depth = 0) => {
    if (depth > 12) return null;
    if (seen.has(name)) return seen.get(name);
    const value = decl.get(name);
    if (!value) return null;
    const hex = /^#[0-9a-f]{3,8}$/i.exec(value);
    if (hex) { seen.set(name, hex[0].toLowerCase()); return seen.get(name); }
    const alias = /^var\(\s*(--sherpa-[a-z0-9-]+)/.exec(value);
    if (alias) { const r = resolve(alias[1], depth + 1); seen.set(name, r); return r; }
    return null;
  };
  const out = new Map();
  for (const name of decl.keys()) out.set(name, resolve(name));
  return out;
}

/** Compare hexes ignoring case, #rgb expansion and alpha tails. */
function sameColour(a, b) {
  if (!a || !b) return false;
  const norm = (h) => {
    let v = h.toLowerCase().replace('#', '');
    if (v.length === 3) v = v.split('').map((c) => c + c).join('');
    return v.slice(0, 6);
  };
  return norm(a) === norm(b);
}

/**
 * Diff a harvest against the CSS. Three buckets — a name-only check would bury
 * the real bugs in the rest. wrong: the CSS cannot paint Figma's colour at all.
 * routed: same colour, different token. raw: unbound in Figma.
 */
export function diff(harvest) {
  const map = componentMap();
  const figmaNames = [...new Set(Object.values(map))];
  const colours = resolvedColours();
  const report = [];
  for (const [dir, figmaName] of Object.entries(map)) {
    const entry = harvest[figmaName];
    if (!entry) continue;
    if (entry.missing) { report.push({ dir, figmaName, noNode: true, wrong: [], routed: [], raws: [] }); continue; }
    const used = cssTokensUsed(dir);
    const reachable = new Set(
      [...used].map((t) => colours.get(t)).filter(Boolean).map((h) => h.slice(0, 7)),
    );
    const mine = ownRows(entry.rows ?? [], figmaName, figmaNames);
    const wrong = [], routed = [], raws = [];
    const seen = new Set();
    for (const row of mine) {
      if (row.token === 'RAW') {
        // Translucent paint of a reachable hue is the opacity idiom, not drift:
        // the variable sits on the stroke, the fill repeats the hue at opacity.
        const reachableHue = reachable.has(row.hex.slice(0, 7));
        if (reachableHue && (row.opacity ?? 1) < 1) continue;
        const k = 'raw' + row.at + row.prop + row.hex;
        if (!seen.has(k)) { seen.add(k); raws.push(row); }
        continue;
      }
      if (row.token === 'DANGLING') {
        wrong.push({ ...row, cssVar: null, why: 'the Figma variable no longer exists' });
        continue;
      }
      const cssVar = cssVarFor(row.token);
      if (!cssVar || used.has(cssVar)) continue;
      const k = row.token + row.prop;
      if (seen.has(k)) continue;
      seen.add(k);
      // A fully transparent paint still names a variable in Figma; the
      // component correctly paints nothing.
      if (/^#[0-9a-f]{6}00$/i.test(row.hex)) continue;
      const want = colours.get(cssVar);
      const entry2 = { ...row, cssVar, want: want ?? null };
      if (reachable.has(row.hex.slice(0, 7))) routed.push(entry2);
      else wrong.push({ ...entry2, why: 'the CSS cannot paint this colour at all' });
    }
    report.push({ dir, figmaName, wrong, routed, raws });
  }
  return report;
}

const diffArg = process.argv.find((a) => a.startsWith('--diff='));
if (diffArg) {
  const harvest = JSON.parse(readFileSync(diffArg.split('=')[1], 'utf8'));
  const report = diff(harvest);
  const quiet = process.argv.includes('--wrong-only');
  let wrongCount = 0, routedCount = 0, rawCount = 0;
  for (const r of report) {
    if (r.noNode) { console.log(`\n${r.dir}  —  NO FIGMA NODE named "${r.figmaName}"`); continue; }
    const show = r.wrong.length || (!quiet && (r.routed.length || r.raws.length));
    if (!show) continue;
    console.log(`\n${r.dir}  (${r.figmaName})`);
    for (const m of r.wrong) {
      wrongCount += 1;
      console.log(`  WRONG   ${m.prop.padEnd(6)} figma ${m.hex.padEnd(9)} ${m.token}`);
      console.log(`          ${m.cssVar ?? '(no projected var)'} — ${m.why}`);
      console.log(`          at ${m.at}`);
    }
    if (quiet) continue;
    for (const m of r.routed) {
      routedCount += 1;
      console.log(`  route   ${m.prop.padEnd(6)} ${m.hex.padEnd(9)} same colour, different token than ${m.token}`);
    }
    for (const raw of r.raws) {
      rawCount += 1;
      const alpha = (raw.opacity ?? 1) < 1 ? ` @${raw.opacity}` : '';
      console.log(`  raw     ${raw.prop.padEnd(6)} ${(raw.hex + alpha).padEnd(11)} unbound in FIGMA  at ${raw.at}`);
    }
  }
  console.log(`\n${wrongCount} WRONG (the CSS cannot paint Figma's colour)` +
    (quiet ? '' : `  ·  ${routedCount} same colour via another token  ·  ${rawCount} unbound in Figma`));
  process.exit(wrongCount ? 1 : 0);
}

/**
 * `--names` — snippet checking every figmaName still resolves. A rename leaves
 * a spec pointing at nothing, and every tool that follows the name then passes
 * SILENTLY.
 */
if (process.argv.includes('--names')) {
  const names = [...new Set(Object.values(componentMap()))].sort();
  console.log('// paste into figma_execute — lists specs whose figmaName is GONE');
  console.log(`const WANT = ${JSON.stringify(names)};`);
  console.log(`await figma.loadAllPagesAsync();
const tops = figma.root.findAllWithCriteria({ types: ['COMPONENT_SET','COMPONENT'] })
  .filter((n) => !(n.parent && n.parent.type === 'COMPONENT_SET'));
const have = new Set(tops.map((n) => n.name));
return { missing: WANT.filter((w) => !have.has(w)) };`);
  process.exit(0);
}

if (process.argv.includes('--snippet')) {
  const map = componentMap();
  const names = [...new Set(Object.values(map))].sort();
  const batch = Number((process.argv.find((a) => a.startsWith('--batch=')) ?? '=0').split('=')[1]);
  const size = 14;
  const slice = names.slice(batch * size, (batch + 1) * size);
  if (!slice.length) { console.error(`no batch ${batch} (${Math.ceil(names.length / size)} batches)`); process.exit(1); }
  console.log(`// batch ${batch} of ${Math.ceil(names.length / size)} — paste into figma_execute`);
  console.log(`const WANT = ${JSON.stringify(slice)};`);
  console.log(readFileSync(join(ROOT, 'scripts/lib/harvest-colours.figma.js'), 'utf8'));
}
