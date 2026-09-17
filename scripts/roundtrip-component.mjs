#!/usr/bin/env node
/**
 * roundtrip-component.mjs — the lossless / round-trip guard for the DTCG-dialect
 * component spec (schemas/component.v1.json is the contract).
 *
 *   node scripts/roundtrip-component.mjs <sherpa-name>
 *
 * Load <name>.component.yaml → specToDef (adapter) → compileDef (the existing pure
 * compiler) → compare the generated {ts,html,css} to the on-disk component files.
 * Exit 0 on match, non-zero on any mismatch, printing a clear diff.
 *
 * ── Comparison contract (why it is SEMANTIC, not byte-stable) ──────────────────
 * compileDef is a *scaffold* generator: given a def it emits the systematic parts
 * of the three files (anatomy → HTML, token map → CSS bindings, class shell → TS).
 * It deliberately does NOT reproduce hand-written JS behaviour or hand-written CSS
 * state rules — the real sherpa-switch.{ts,css} carry those, authored by a human.
 * So a byte-stable compare is impossible by design. Instead the guard asserts,
 * per file, exactly what the spec fully determines, and reports the residue it
 * cannot round-trip as a documented limitation (never loosened to force green):
 *
 *   HTML  SEMANTIC-STRUCTURAL. Parse each <template>'s node tree from generated
 *         and real; compare tag / class / attrs(as a set) / slot / child order.
 *         This proves the anatomy block regenerates the real Shadow-DOM markup.
 *
 *   CSS   TOKEN-BINDING assertion, against the AUTHORED region only. The .css now
 *         opens with a generated `/* == sherpa:tokens … == *␣/` region (projected
 *         --sherpa-switch-* vars); the compiler does not emit it, so the guard
 *         strips it and compares only the authored CSS below
 *         `/* == end sherpa:tokens == *␣/`. It asserts every `element.property →
 *         var(--sherpa-X)` binding the compiler emits is present in the authored
 *         base rule for that element. (The full hand-written CSS — state rules,
 *         ::after, focus, disabled, --_fill — is the declared residue.)
 *
 *   TS    STRUCTURAL. Assert class name, the css/html URL statics, and the
 *         `observed` attribute list. The hand-written method bodies (onClick,
 *         #syncAria, getters/setters) are the declared residue compileDef cannot
 *         and does not reproduce.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { specToDef } from './lib/component-to-def.mjs';
import { compileDef } from './lib/generation/compile-def.mjs';
import { authoredCss, extractBindingsMap } from './lib/css-reader.mjs';
import { htmlDiff } from './lib/html-structure.mjs';
import { parseObserved } from './lib/ts-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');

function checkHtml(genHtml, realHtml) {
  const diffs = [];
  htmlDiff(genHtml, realHtml, diffs);
  return diffs;
}

// ── CSS: authored region + token-binding extraction ────────────────────────────
// authoredCss + binding extraction now come from the shared PostCSS reader
// (./lib/css-reader.mjs). extractBindingsMap returns { '.el': { prop: 'sherpa-x' } }
// taking the FIRST binding per el.prop, with the `border` shorthand expanded to
// border-width/border-color — identical to the former local regex reader.

// what compileDef emitted, parsed the same way (its output has no token region)
function checkCss(genCss, realCssAuthored) {
  const gen = extractBindingsMap(genCss);
  const real = extractBindingsMap(realCssAuthored);
  const diffs = [];
  for (const [el, props] of Object.entries(gen)) {
    for (const [prop, sherpaVar] of Object.entries(props)) {
      const got = real[el]?.[prop];
      if (got === undefined) diffs.push(`.${el} { ${prop} } — generated binds var(--sherpa-${sherpaVar}); authored CSS has no such binding on .${el}`);
      else if (got !== sherpaVar) diffs.push(`.${el} { ${prop} } — generated var(--sherpa-${sherpaVar}) ≠ authored var(--sherpa-${got})`);
    }
  }
  return diffs;
}

// ── TS: structural facts ───────────────────────────────────────────────────────
function tsFacts(ts) {
  const f = {};
  f.class = (/export class (\w+) extends SherpaElement/.exec(ts) || [])[1] ?? null;
  f.css = (/static override css = new URL\('([^']+)'/.exec(ts) || [])[1] ?? null;
  f.html = (/static override html = new URL\('([^']+)'/.exec(ts) || [])[1] ?? null;
  // The SHARED reader — it strips comments and expands a `...SPREAD` of a
  // module-level const. This used to be a bare regex here, and both of those
  // fixes had landed in the spec generator only, so this script disagreed with
  // the gate on 5 of 58 components.
  f.observed = parseObserved(ts);
  f.define = (/customElements\.define\('([^']+)'/.exec(ts) || [])[1] ?? null;
  return f;
}
function checkTs(genTs, realTs) {
  const g = tsFacts(genTs), r = tsFacts(realTs);
  const diffs = [];
  for (const k of ['class', 'css', 'html', 'define']) {
    if (g[k] !== r[k]) diffs.push(`TS ${k}: "${g[k]}" (gen) ≠ "${r[k]}" (real)`);
  }
  const go = [...g.observed].sort(), ro = [...r.observed].sort();
  if (JSON.stringify(go) !== JSON.stringify(ro)) diffs.push(`TS observed: [${g.observed}] (gen) ≠ [${r.observed}] (real)`);
  return diffs;
}

// ── residue report: what the spec provably CANNOT round-trip today ─────────────
// Surfaced every run so the limitation is loud, not hidden — but does NOT fail the
// guard (it is inherent to compileDef being a scaffold generator).
function residueReport(realTs, realCssAuthored) {
  const notes = [];
  // hand-written .ts methods beyond the generated shell
  const methods = [...realTs.matchAll(/^\s*(?:override |#|get |set )([\w#]+)\s*[(=]/gm)].map((m) => m[1]);
  const handMethods = methods.filter((m) => !['constructor'].includes(m));
  if (handMethods.length) notes.push(`.ts: ${handMethods.length} hand-written member(s) not produced by compileDef — ${[...new Set(handMethods)].join(', ')}.`);
  // hand-written CSS state rules (any :host([…]) / :focus-visible / ::after)
  const stateRules = (realCssAuthored.match(/:host\(|:focus-visible|::after|::before/g) || []).length;
  if (stateRules) notes.push(`.css: ~${stateRules} hand-written state selector(s) (:host([…]) / :focus-visible / ::after) — compileDef emits none of these.`);
  return notes;
}

// ── main ───────────────────────────────────────────────────────────────────────
function run(name) {
  const dir = join(C, name);
  const specPath = join(dir, `${name}.component.yaml`);
  if (!existsSync(specPath)) { console.error(`✗ no spec: ${specPath}`); return 2; }

  const spec = yaml.load(readFileSync(specPath, 'utf8'));
  const def = specToDef(spec);
  if (!def.anatomy) { console.error(`✗ ${name}: spec carries no anatomy block — cannot regenerate HTML.`); return 2; }
  const gen = compileDef(def);

  const realTs = readFileSync(join(dir, `${name}.ts`), 'utf8');
  const realHtml = readFileSync(join(dir, `${name}.html`), 'utf8');
  const realCss = readFileSync(join(dir, `${name}.css`), 'utf8');
  const realCssAuthored = authoredCss(realCss);

  const htmlDiffs = checkHtml(gen.html, realHtml);
  const cssDiffs = checkCss(gen.css, realCssAuthored);
  const tsDiffs = checkTs(gen.ts, realTs);

  const line = (ok, label) => `${ok ? '✅' : '❌'} ${label}`;
  console.log(`\nRound-trip guard — ${name}  (spec → specToDef → compileDef → compare on-disk)\n`);
  console.log(line(!htmlDiffs.length, `HTML  anatomy → markup  (semantic-structural)`));
  htmlDiffs.forEach((d) => console.log(`      · ${d}`));
  console.log(line(!cssDiffs.length, `CSS   token map → bindings  (authored region only)`));
  cssDiffs.forEach((d) => console.log(`      · ${d}`));
  console.log(line(!tsDiffs.length, `TS    class shell + observed  (structural)`));
  tsDiffs.forEach((d) => console.log(`      · ${d}`));

  const residue = residueReport(realTs, realCssAuthored);
  console.log(`\nℹ️  Declared residue — NOT spec-round-trippable today (by design; compileDef is a scaffold generator):`);
  residue.forEach((n) => console.log(`      · ${n}`));

  const failed = htmlDiffs.length + cssDiffs.length + tsDiffs.length;
  if (failed) {
    console.log(`\n❌ ${name}: ${failed} mismatch(es) in the spec-determined surface. The spec does NOT faithfully regenerate these.\n`);
    return 1;
  }
  console.log(`\n✅ ${name}: spec-determined surface round-trips (HTML anatomy, CSS token bindings, TS shell all match).`);
  console.log(`   Everything compileDef is responsible for regenerates identically to the on-disk files.\n`);
  return 0;
}

const name = process.argv[2];
if (!name) { console.error('usage: roundtrip-component.mjs <sherpa-name>'); process.exit(2); }
process.exit(run(name));
