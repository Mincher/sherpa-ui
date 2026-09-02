#!/usr/bin/env node
/**
 * roundtrip-component.mjs — the lossless / round-trip guard for the DTCG-dialect
 * component spec (docs/COMPONENT-SPEC-DTCG-PLAN.md §1.3-1.4, "Verification").
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');

// ── tiny HTML template parser (structure only) ─────────────────────────────────
// We only need the shape compileDef produces: nested tags with class/part/attrs,
// self-closing-less elements, and <slot [name]> children. Good enough for the
// deterministic markup both sides emit — not a general HTML parser.
function parseTemplates(html) {
  const templates = {};
  const re = /<template id="([^"]+)">([\s\S]*?)<\/template>/g;
  let m;
  while ((m = re.exec(html))) templates[m[1]] = parseNodes(m[2].trim());
  return templates;
}
function parseNodes(src) {
  const nodes = [];
  let i = 0;
  const len = src.length;
  while (i < len) {
    // skip whitespace / comments between tags
    while (i < len && /\s/.test(src[i])) i++;
    if (i >= len) break;
    if (src.startsWith('<!--', i)) { i = src.indexOf('-->', i) + 3; continue; }
    if (src[i] !== '<') { // stray text — ignore (labels use ::after, no text nodes)
      const next = src.indexOf('<', i);
      i = next === -1 ? len : next;
      continue;
    }
    // an opening tag
    const close = src.indexOf('>', i);
    const raw = src.slice(i + 1, close);
    const selfClosing = raw.endsWith('/');
    const inner = selfClosing ? raw.slice(0, -1).trim() : raw.trim();
    const sp = inner.search(/\s/);
    const tag = (sp === -1 ? inner : inner.slice(0, sp)).toLowerCase();
    const attrStr = sp === -1 ? '' : inner.slice(sp + 1);
    const attrs = parseAttrs(attrStr);
    i = close + 1;

    if (tag === 'slot' || selfClosing || voidTag(tag)) {
      nodes.push({ tag, attrs, children: [] });
      continue;
    }
    // find matching close tag (no nesting of same tag inside our simple markup)
    const endTag = `</${tag}>`;
    const endIdx = findMatchingClose(src, i, tag, endTag);
    const childSrc = src.slice(i, endIdx);
    nodes.push({ tag, attrs, children: parseNodes(childSrc) });
    i = endIdx + endTag.length;
  }
  return nodes;
}
function findMatchingClose(src, from, tag, endTag) {
  // handle same-tag nesting by depth counting
  let depth = 1, i = from;
  const openRe = new RegExp(`<${tag}(?=[\\s>/])`, 'g');
  while (i < src.length) {
    const nextOpen = src.indexOf(`<${tag}`, i);
    const nextClose = src.indexOf(endTag, i);
    if (nextClose === -1) return src.length;
    if (nextOpen !== -1 && nextOpen < nextClose && /[\s>/]/.test(src[nextOpen + 1 + tag.length] || '>')) {
      depth++; i = nextOpen + 1;
    } else {
      depth--; if (depth === 0) return nextClose; i = nextClose + endTag.length;
    }
  }
  return src.length;
}
function voidTag(t) { return ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(t); }
function parseAttrs(s) {
  const attrs = {};
  const re = /([:\w-]+)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(s))) { if (m[1]) attrs[m[1]] = m[2] ?? ''; }
  return attrs;
}

// normalise a node for structural compare: tag + class + part + attr set + slot
function normNode(n) {
  const a = { ...n.attrs };
  const out = { tag: n.tag };
  if (n.tag === 'slot') out.slotName = a.name ?? '';
  out.class = a.class ?? '';
  out.part = a.part ?? '';
  delete a.class; delete a.part;
  out.attrs = Object.fromEntries(Object.entries(a).sort());
  out.children = (n.children ?? []).map(normNode);
  return out;
}
function nodeDiff(gen, real, path, diffs) {
  if (!gen || !real) { diffs.push(`${path}: node present on one side only (gen=${!!gen} real=${!!real})`); return; }
  for (const k of ['tag', 'class', 'part', 'slotName']) {
    if ((gen[k] ?? '') !== (real[k] ?? '')) diffs.push(`${path}: ${k} "${gen[k] ?? ''}" (gen) ≠ "${real[k] ?? ''}" (real)`);
  }
  const ga = JSON.stringify(gen.attrs), ra = JSON.stringify(real.attrs);
  if (ga !== ra) diffs.push(`${path}: attrs ${ga} (gen) ≠ ${ra} (real)`);
  const gc = gen.children ?? [], rc = real.children ?? [];
  if (gc.length !== rc.length) diffs.push(`${path}: ${gc.length} children (gen) ≠ ${rc.length} (real)`);
  const n = Math.max(gc.length, rc.length);
  for (let i = 0; i < n; i++) nodeDiff(gc[i], rc[i], `${path} > ${(gc[i]?.tag || rc[i]?.tag)}[${i}]`, diffs);
}

function checkHtml(genHtml, realHtml) {
  const g = parseTemplates(genHtml), r = parseTemplates(realHtml);
  const diffs = [];
  const ids = new Set([...Object.keys(g), ...Object.keys(r)]);
  for (const id of ids) {
    if (!g[id] || !r[id]) { diffs.push(`template "${id}" present on one side only`); continue; }
    const gn = g[id].map(normNode), rn = r[id].map(normNode);
    if (gn.length !== rn.length) diffs.push(`template "${id}": ${gn.length} root nodes (gen) ≠ ${rn.length} (real)`);
    for (let i = 0; i < Math.max(gn.length, rn.length); i++) nodeDiff(gn[i], rn[i], `${id}[${i}]`, diffs);
  }
  return diffs;
}

// ── CSS: authored region + token-binding extraction ────────────────────────────
function authoredCss(css) {
  const end = css.indexOf('/* == end sherpa:tokens == */');
  return end === -1 ? css : css.slice(end + '/* == end sherpa:tokens == */'.length);
}
// pull `--sherpa-*` var refs per element rule. Returns { '.el': { prop: 'sherpa-x' } }
// taking the FIRST occurrence of each element block (the live one; the file may
// carry a stale duplicate block below it).
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
function extractCssBindings(cssRaw) {
  const css = stripCssComments(cssRaw);
  const out = {};
  // match each `selector { body }` block. Selector = run with no braces/semicolons;
  // body = run with no braces. No `}`-anchor (consecutive rules would be skipped).
  const re = /([^{}]+?)\s*\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    const body = m[2];
    // only plain element rules like `.track` / `.knob` / `.label` (no combinators)
    const cm = /^\.([\w-]+)$/.exec(sel);
    if (!cm) continue;
    const el = cm[1];
    out[el] ??= {};
    const decls = body.split(';');
    for (const d of decls) {
      const cd = /^\s*([\w-]+)\s*:\s*(.+)$/.exec(d);
      if (!cd) continue;
      const prop = cd[1];
      const val = cd[2];
      const record = (p, v) => { if (v && !(p in out[el])) out[el][p] = v.replace(/^--sherpa-/, ''); };
      // The `border` shorthand carries width + colour vars: expand it into the
      // longhands the compiler emits (border-width / border-color). Order in the
      // authored CSS is `<width-var> solid <color-var>`.
      if (prop === 'border') {
        const vars = [...val.matchAll(/var\(\s*(--sherpa-[\w-]+)/g)].map((mm) => mm[1]);
        if (vars[0]) record('border-width', vars[0]);
        if (vars[1]) record('border-color', vars[1]);
        continue;
      }
      const vm = /var\(\s*(--sherpa-[\w-]+)/.exec(val);
      if (vm) record(prop, vm[1]);
    }
  }
  return out;
}
// what compileDef emitted, parsed the same way (its output has no token region)
function checkCss(genCss, realCssAuthored) {
  const gen = extractCssBindings(genCss);
  const real = extractCssBindings(realCssAuthored);
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
  const obs = /static override observed = \[([^\]]*)\]/.exec(ts);
  f.observed = obs ? obs[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
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
