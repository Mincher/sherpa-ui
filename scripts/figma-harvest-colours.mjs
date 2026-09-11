#!/usr/bin/env node
/**
 * figma-harvest-colours.mjs — print the figma_execute snippet that harvests
 * every component's COLOUR BINDINGS, and (given the result) diff them against
 * the CSS each component actually consumes.
 *
 *   node scripts/figma-harvest-colours.mjs --snippet [--batch=N]
 *   node scripts/figma-harvest-colours.mjs --diff <harvest.json>
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The sweep has been run "a couple of times already" and still missed things —
 * the Key Value Pair's value chip was still the old dark grey (#b3b3c3) when
 * Figma had moved it to style-surface/base +1 (#e8e8f6). The CSS even carried a
 * comment saying "Figma: Value Slot = surface/default-2", which had been true
 * once and was never re-checked.
 *
 * That is the whole gap. The existing tools answer two DIFFERENT questions:
 *
 *   check-tokens.mjs      do the token VALUES match Figma?          (values)
 *   audit-bindings.mjs    should this raw number be a variable?     (Figma-side)
 *   figma-extract-component.js   print a node for a human to read   (manual)
 *
 * NOTHING asked: does the CSS consume the variable Figma actually BINDS? So a
 * token could be perfectly in sync and the component could still be pointing at
 * a different one — which is exactly what happened. A human comparing a printout
 * to a stylesheet will miss cases; that is not a reason to be more careful, it
 * is a reason to automate the comparison.
 *
 * ── What it compares ────────────────────────────────────────────────────────
 * Figma side: every visible SOLID fill / stroke on every component (and its
 * variants and nested instances), with the variable bound to its colour.
 *
 * Code side: every colour-valued `var(--sherpa-*)` in the component's CSS.
 *
 * A binding is SATISFIED when the component's CSS mentions the CSS custom
 * property the Figma variable projects to. Deliberately loose about WHERE: this
 * finds "the component never mentions this token at all", which is the miss that
 * actually happens. A property-by-property map would need an element↔selector
 * correspondence the two sides do not share.
 *
 * ── Known false positives, and why they are not silenced ────────────────────
 * A nested INSTANCE reports its own component's bindings (a Button inside a
 * Container Header is the Button's business). Those are filtered by depth when
 * the row's path crosses into a known component name — see `ownRows`.
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
 * A Figma variable path → the CSS custom property the projector emits.
 *
 * "Style::style-surface/base +1" → "--sherpa-style-surface-base-1"
 *
 * Mirrors project-tokens.mjs: the collection becomes the prefix, "/" and " "
 * become "-", and a "+N" suffix becomes "-N". Kept here rather than imported
 * because the projector's own slugger is wound through its emit path.
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
  // The projector drops the collection prefix for Display Mode / Theme / Style /
  // Structure / Elevation etc. only insofar as the LEAF already carries it —
  // "style-surface/base" under "Style" projects as --sherpa-style-surface-base,
  // not --sherpa-style-style-surface-base.
  const leafSlug = slug(leaf);
  return leafSlug.startsWith(col + '-') || leafSlug === col
    ? `--sherpa-${leafSlug}`
    : `--sherpa-${col}-${leafSlug}`;
}

/**
 * Every `--sherpa-*` custom property a component's CSS mentions.
 *
 * Includes the GENERATED scoped-token region at the top of the file. A
 * component-scoped Figma collection (navigation, input, switch, button) is
 * projected THERE and not into tokens.css, so a checker that only reads
 * tokens.css declares every one of those 15 navigation tokens missing. That was
 * the first false alarm this tool produced, and it is worth the comment: the
 * absence of a token from tokens.css is not evidence of anything.
 */
export function cssTokensUsed(dir) {
  let text;
  try { text = readFileSync(join(COMPONENTS, dir, `${dir}.css`), 'utf8'); } catch { return new Set(); }
  return new Set([...text.matchAll(/--sherpa-[a-z0-9-]+/g)].map((m) => m[0]));
}

/**
 * Rows that belong to THIS component rather than to something it instances.
 *
 * A Button nested in a Container Header reports the Button's own bindings, and
 * holding the Container Header responsible for them would bury every real miss
 * in noise. A row is foreign once its path passes through another component's
 * name — matched on the path SEGMENTS, so "Container Header" inside "Container"
 * is foreign while "Container" itself is not.
 */
export function ownRows(rows, selfName, allFigmaNames) {
  const others = new Set(allFigmaNames.filter((n) => n !== selfName));
  return rows.filter((r) => {
    const segs = r.at.split('>');
    // segs[0] is the component itself; a VARIANT ("Type=icon") is still its own.
    return !segs.slice(1).some((s) => others.has(s));
  });
}

/**
 * Every `--sherpa-*` token's RESOLVED hex, by following the alias chain in
 * tokens.css to a literal.
 *
 * Only the FIRST (light, :root) definition is taken. A token redefined under a
 * dark or density block is the same token — resolving it twice would report one
 * binding as two colours.
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

/** Compare two hexes ignoring case, and treating #rgb / #rrggbb / alpha tails. */
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
 * Diff a harvest against the CSS.
 *
 * Two DIFFERENT verdicts, and keeping them apart is the whole value of this:
 *
 *   WRONG COLOUR  the CSS paints something Figma does not. A real bug — the
 *                 Key Value Pair's value chip took theme-surface/default/+2
 *                 (#b3b3c3, dark) where Figma binds style-surface/base +1
 *                 (#e8e8f6, light).
 *   OTHER ROUTE   the CSS reaches the SAME colour through a different token.
 *                 The grid cell's header takes theme-surface/default/+1, which
 *                 is also #e8e8f6. Worth knowing — Figma's route is the one to
 *                 follow, so a re-point on the Style side reaches the component
 *                 — but it is not a visual bug and must not be reported as one.
 *
 * A name-only check calls both of those a miss, which buries the first ten deep
 * in the second. That is how the earlier sweeps produced noise and got skimmed.
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
    // What the component's CSS can actually paint — every colour it reaches by
    // any token. A binding is satisfied when the colour is reachable, even if
    // the component gets there by a different name.
    const reachable = new Set(
      [...used].map((t) => colours.get(t)).filter(Boolean).map((h) => h.slice(0, 7)),
    );
    const mine = ownRows(entry.rows ?? [], figmaName, figmaNames);
    const wrong = [], routed = [], raws = [];
    const seen = new Set();
    for (const row of mine) {
      if (row.token === 'RAW') {
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
      // A fully transparent paint is a NON-colour: Figma still names a variable
      // on it, but the component correctly paints nothing. Never a bug.
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
      console.log(`  raw     ${raw.prop.padEnd(6)} ${raw.hex.padEnd(9)} unbound in FIGMA  at ${raw.at}`);
    }
  }
  console.log(`\n${wrongCount} WRONG (the CSS cannot paint Figma's colour)` +
    (quiet ? '' : `  ·  ${routedCount} same colour via another token  ·  ${rawCount} unbound in Figma`));
  process.exit(wrongCount ? 1 : 0);
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
