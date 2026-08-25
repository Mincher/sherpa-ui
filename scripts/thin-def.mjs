#!/usr/bin/env node
/**
 * thin-def.mjs — convert a full def.json → thin def.yaml, then PROVE it lossless.
 *
 * Strategy: derive the thin form by DROPPING what the element-map + defaults can
 * rebuild, then hydrate the thin form back and require it to deep-equal the
 * original. If it doesn't, the file is left unconverted and reported — never a
 * silent lossy write.
 *
 *   node scripts/thin-def.mjs <name>...       # convert named components
 *   node scripts/thin-def.mjs --all           # attempt every def
 *   node scripts/thin-def.mjs --check <name>  # guard only, no write
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { hydrate, checkProgressiveEnhancement } from './lib/hydrate-def.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');
const MAP = yaml.load(readFileSync(join(ROOT, 'scripts/figma-data/element-map.yaml'), 'utf8'));

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const stemOf = (name) => name.replace(/^data-/, '').split('-').map(cap).join('');
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Deep SEMANTIC equality — order-independent. The thin def is the source of
// truth now; the old JSON is a first pass we're evolving from (and deleting).
// The guard proves no DATA is lost, not that byte-order is reproduced.
function semanticEq(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => semanticEq(v, b[i]));
  }
  if (typeof a === 'object') {
    const ak = Object.keys(a).sort(), bk = Object.keys(b).sort();
    if (ak.length !== bk.length || !ak.every((k, i) => k === bk[i])) return false;
    return ak.every((k) => semanticEq(a[k], b[k]));
  }
  return false;
}

// ── thin a full def by removing rebuildable parts ─────────────────────────────
export function thin(full) {
  const t = { name: full.name, figmaName: full.figmaName, category: full.category, description: full.description };
  if ('generated' in full && full.generated !== true) t.generated = full.generated;
  // carry bespoke top-level fields verbatim so the round-trip is exact
  if ('tier' in full) t.tier = full.tier;
  if ('parentComponent' in full) t.parentComponent = full.parentComponent;

  if (full.anatomy) t.anatomy = thinAnatomy(full.anatomy.root, true);

  if (full.props?.length) {
    t.props = {};
    for (const p of full.props) t.props[p.name] = thinProp(p);
  }

  if (full.templates?.length) t.templates = full.templates;
  if (full.slots?.length) {
    t.slots = {};
    for (const s of full.slots) t.slots[s.name] = { accepts: s.accepts, description: s.description };
  }
  if (full.events?.length) {
    t.events = {};
    for (const e of full.events) t.events[e.name] = thinEvent(e);
  }
  // scaffolded (anatomy-less) defs keep parts/nested/props_public + the whole figma
  // block, since there's no anatomy to derive them from.
  if (!full.anatomy) {
    if (full.parts?.length) t.parts = full.parts;
    if (full.nested?.length) t.nested = full.nested;
    if (full.props_public?.length) t.props_public = full.props_public;
  }
  // parts + nested kept verbatim on anatomy defs (robust — no fragile
  // re-derivation from the tree, which loses bespoke fields like nested.role)
  if (full.anatomy && full.parts?.length) t.parts = full.parts;
  if (full.anatomy && full.nested?.length) t.nested = full.nested;
  // overrides: absent → omit; equals the shared boilerplate → $standard marker;
  // diverged → verbatim. (Never inject a block the original didn't have.)
  if (full.overrides) t.overrides = eq(full.overrides, MAP.overrides) ? '$standard' : full.overrides;
  if ('_divergence' in full) t._divergence = full._divergence;
  if ('_notes' in full) t._notes = full._notes;
  if (full.tokens && Object.keys(full.tokens).length) t.tokens = full.tokens;
  // FIGMA — the baseline requirement: store the exact node structure, any type.
  // Kept verbatim as figmaVerbatim so ANY Figma node/prop shape round-trips.
  if (full.figma) t.figmaVerbatim = full.figma;
  return t;
}

// class(el) shorthand is only safe for a single-token class. A multi-class
// (space) or missing class keeps el explicit in the body instead.
function anatomyKey(node) {
  const cls = node.class ?? '';
  const single = cls && !/\s/.test(cls);
  if (node.el && single) return { key: `${cls}(${node.el})`, elInBody: false };
  return { key: cls || node.el || '_', elInBody: !!node.el };
}
function thinAnatomy(node, isRoot) {
  const { elInBody } = anatomyKey(node);
  const body = {};
  if (elInBody) body.el = node.el;
  if (node.component) body.owns = node.component;
  if (node.relationship && node.relationship !== 'owned') body.relationship = node.relationship;
  // keep part verbatim when present (robust — no re-derivation guesswork).
  // Root part always equals class, so it's the one safe omission.
  if (node.part && !isRoot) body.part = node.part;
  if ('slot' in node) body.slot = node.slot;
  if (node.showWhen) body.showWhen = node.showWhen;
  if (node.attrs) body.attrs = node.attrs;
  // keep figma only if it isn't the plain el→node default
  const def = node.el && MAP.elements[node.el]?.node;
  if (node.figma && !(Object.keys(node.figma).length === 1 && node.figma.node === def)) body.figma = node.figma;
  if (node.listen) body.listen = node.listen;
  // if the key can't carry the class (multi-class in body-el mode), store it
  if (elInBody && node.class && /\s/.test(node.class)) body.class = node.class;
  if (node.children) body.children = node.children.map((c) => ({ [anatomyKey(c).key]: thinAnatomy(c, false) }));
  return isRoot ? { [anatomyKey(node).key]: body } : body;
}

// A prop is "standard" only if hydrate can rebuild it from its kind. Scaffolded
// _TODO stubs are not — pass those through verbatim so nothing is lost.
const KNOWN_KINDS = new Set(['visibility', 'template', 'style', 'content']);
// A prop reduces to shorthand ONLY when hydrate can rebuild it exactly. The
// figma shapes hydrate knows: {extends+map}, {boolean}, {axis+value}, or none.
// Anything else (variantAxis, instance swaps, mode pins…) → verbatim, lossless.
function reducibleFigma(f) {
  if (!f) return true;
  const keys = Object.keys(f).sort().join(',');
  return keys === 'boolean' || keys === 'axis,value' || keys === 'extends,map';
}
function thinProp(p) {
  if (p.type === 'enum' && eq(p.values, MAP.status.values) && p.figma?.extends === 'Status') return '$status';
  // What hydrate rebuilds exactly per kind:
  //  visibility/template → boolean, default false, figma {boolean}
  //  style               → boolean, default false, figma {axis,value}
  //  content             → string,  default null,  NO figma
  // A prop only reduces if it fits its kind's mould precisely; else verbatim.
  const mould = {
    visibility: p.type === 'boolean' && p.default === false && reducibleFigma(p.figma),
    template:   p.type === 'boolean' && p.default === false && reducibleFigma(p.figma),
    style:      p.type === 'boolean' && p.default === false && (!p.figma || 'axis' in p.figma),
    content:    p.type === 'string'  && p.default === null  && !p.figma,
  };
  const standard = KNOWN_KINDS.has(p.kind) && mould[p.kind];
  if (!standard) { const { name, ...rest } = p; return { $verbatim: rest }; }
  const body = { kind: p.kind };
  if (p.template) body.template = p.template;
  if (p.figma?.axis) body.axis = { name: p.figma.axis, value: p.figma.value };
  const derivedBool = 'has' + stemOf(p.name);
  if (p.figma?.boolean && p.figma.boolean !== derivedBool) body.figmaBoolean = p.figma.boolean;
  if (p.description) body.description = p.description;
  return body;
}

// Event thinning: drop the four defaults; pass anything else (incl. _todo,
// non-standard trigger shapes) through so the round-trip stays exact.
const EVENT_DEFAULT_KEYS = ['bubbles', 'composed', 'cancelable', 'detail'];
function thinEvent(e) {
  const body = {};
  const extra = {};
  for (const [k, v] of Object.entries(e)) {
    if (k === 'name') continue;
    if (k === 'cancelable') { if (v !== MAP.eventDefaults.cancelable) body.cancelable = v; continue; }
    if (EVENT_DEFAULT_KEYS.includes(k)) { if (!eq(v, MAP.eventDefaults[k])) extra[k] = v; continue; }
    if (k === 'description') { if (v) body.description = v; continue; }
    extra[k] = v; // trigger, default, _todo, anything bespoke
  }
  if (Object.keys(extra).length) body.$verbatim = extra;
  return body;
}

// ── per-file convert + guard ──────────────────────────────────────────────────
function convertOne(name, { write }) {
  const jsonPath = join(C, name, `${name}.def.json`);
  const thinPath = join(C, name, `${name}.thin.yaml`);
  // Thin is the source of truth now. If the JSON is gone but a thin def exists,
  // VALIDATE it standalone (hydrates cleanly + passes the PE lint) instead of
  // converting. This keeps the guard useful after the JSON is deleted.
  if (!existsSync(jsonPath)) {
    if (!existsSync(thinPath)) return { name, ok: false, reason: 'no def' };
    try {
      const thinDoc = yaml.load(readFileSync(thinPath, 'utf8'));
      hydrate(thinDoc);
      const warns = checkProgressiveEnhancement(thinDoc);
      const lines = readFileSync(thinPath, 'utf8').split('\n').length;
      return { name, ok: true, before: lines, after: lines, warns, validatedOnly: true };
    } catch (e) { return { name, ok: false, reason: 'thin hydrate failed: ' + e.message }; }
  }
  const full = JSON.parse(readFileSync(jsonPath, 'utf8'));

  let thinDoc;
  try { thinDoc = thin(full); } catch (e) { return { name, ok: false, reason: 'thin() threw: ' + e.message }; }

  // guard: hydrate(thin) must equal original
  let rebuilt;
  try { rebuilt = hydrate(thinDoc); } catch (e) { return { name, ok: false, reason: 'hydrate threw: ' + e.message }; }
  const drift = [];
  for (const k of new Set([...Object.keys(full), ...Object.keys(rebuilt)])) if (!semanticEq(full[k], rebuilt[k])) drift.push(k);
  if (drift.length) return { name, ok: false, reason: 'DATA LOSS in: ' + drift.join(', ') };

  const warns = checkProgressiveEnhancement(thinDoc);
  const before = readFileSync(jsonPath, 'utf8').split('\n').length;
  const yamlText = yaml.dump(thinDoc, { lineWidth: 100, noRefs: true });
  const after = yamlText.split('\n').length;
  if (write) writeFileSync(join(C, name, `${name}.thin.yaml`), yamlText);
  return { name, ok: true, before, after, warns };
}

// ── cli ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();
function runCli() {
const args = process.argv.slice(2);
const check = args.includes('--check');
const write = !check;
let names = args.filter((a) => !a.startsWith('--'));
if (args.includes('--all')) names = readdirSync(C).filter((n) =>
  existsSync(join(C, n, `${n}.def.json`)) || existsSync(join(C, n, `${n}.thin.yaml`)));

let pass = 0, fail = 0, savedBefore = 0, savedAfter = 0;
const allWarns = [];
for (const name of names) {
  const r = convertOne(name, { write });
  if (r.ok) {
    pass++; savedBefore += r.before; savedAfter += r.after;
    console.log(`✅ ${name.padEnd(32)} ${r.before} → ${r.after} lines${r.warns.length ? `  ⚠️ ${r.warns.length} PE` : ''}`);
    r.warns.forEach((w) => allWarns.push(w));
  } else {
    fail++;
    console.log(`⏭️  ${name.padEnd(32)} ${r.reason}`);
  }
}
console.log(`\n${pass} converted, ${fail} skipped.` + (pass ? `  Lines ${savedBefore} → ${savedAfter} (${Math.round((1 - savedAfter / savedBefore) * 100)}% smaller)` : ''));
if (allWarns.length) { console.log('\nProgressive-enhancement punch-list:'); allWarns.forEach((w) => console.log('  ⚠️  ' + w)); }
}
