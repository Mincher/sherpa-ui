#!/usr/bin/env node
/**
 * generate-component-spec.mjs — DERIVE a DTCG-dialect `*.component.yaml` spec for a
 * component from its existing sources (thin.yaml + HTML + CSS + TS + element-map).
 *
 *   node scripts/generate-component-spec.mjs sherpa-switch      # write next to component
 *   node scripts/generate-component-spec.mjs --all              # write every component
 *   node scripts/generate-component-spec.mjs --check sherpa-switch   # gen→validate→round-trip, no write
 *   node scripts/generate-component-spec.mjs --all --check      # coverage table, no write
 *
 * This SCALES the hand-authored switch pilot to all ~47 components without writing
 * each spec by hand. It emits the MECHANICAL ~70% of the spec (props with enum
 * values, anatomy, events, token bindings, element, best-effort states/caps). The
 * hand spec's richer prose (state descriptions, capability narratives) is NOT
 * reproduced — that's the residue a human finishes.
 *
 * PURE-ish: reads the component sources + shared data files, emits YAML. NEVER
 * modifies any component source (.ts/.html/.css/.thin.yaml).
 *
 * ── Derivation strategy, per spec block ───────────────────────────────────────
 *   $name/$description/$extensions.sherpa
 *       ← thin.yaml (name, description, figmaName, category, figmaVerbatim.*).
 *         Description falls back to the HTML comment's first line, then a stub.
 *   props
 *       ← thin.yaml props map (name→{kind,type}) MERGED with the HTML `Public API:`
 *         comment block, which is the AUTHORITATIVE source of enum `values` +
 *         `default` + `(boolean)`. Comment wins for completeness (a prop only in
 *         the comment is still emitted). Native attrs (disabled/name/value/…) →
 *         native:true. Enum props get `values:[…]`.
 *   anatomy + templates
 *       ← parse the HTML `<template id="default">` node tree (el/class/part/attrs/
 *         slot/children). templates = every `<template id>` present.
 *   events
 *       ← thin.yaml events (with trigger node) UNION the HTML `Fires:` list.
 *   tokens
 *       ← parse the AUTHORED CSS region (below `/* == end sherpa:tokens == *␣/`)
 *         for `.el { prop: var(--sherpa-X) }` bindings and emit `el.prop:{ref}`.
 *         THIS — not thin.yaml's stale Figma-var token map — is what round-trips,
 *         because roundtrip-component.mjs re-extracts the same authored bindings.
 *   element
 *       ← the anatomy root's tag + provides/stateCss from element-map.yaml
 *         (best-effort; unknown root → tag + empty provides).
 *   states (best-effort)
 *       ← authored-CSS `:host([data-*])` / `:host([disabled])` / `:focus-visible`
 *         selectors, name + selector (token refs left to the human).
 *   capabilities / jsProps (best-effort)
 *       ← TS getters/setters + JSDoc `@prop`. Emitted only when found.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import { specToDef } from './lib/component-to-def.mjs';
import { compileDef } from './lib/generation/compile-def.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');
const SCHEMA_PATH = join(ROOT, 'schemas', 'component.v1.json');
const TOKENS_PATH = join(ROOT, 'src', 'styles', 'tokens', 'figma.tokens.json');
const ELEMENT_MAP_PATH = join(ROOT, 'scripts', 'figma-data', 'element-map.yaml');

const NATIVE_ATTRS = new Set([
  'disabled', 'name', 'value', 'required', 'readonly', 'placeholder',
  'checked', 'min', 'max', 'step', 'minlength', 'maxlength', 'pattern',
  'multiple', 'href', 'target', 'type', 'rows', 'cols', 'autocomplete',
]);

// ══ file loading ═══════════════════════════════════════════════════════════════
function readIf(p) { return existsSync(p) ? readFileSync(p, 'utf8') : null; }
function loadTokens() { try { return JSON.parse(readFileSync(TOKENS_PATH, 'utf8')); } catch { return null; } }
function loadElementMap() {
  try { return yaml.load(readFileSync(ELEMENT_MAP_PATH, 'utf8'))?.elements ?? {}; }
  catch { return {}; }
}

// ══ HTML template parsing (structure only — mirrors roundtrip-component.mjs) ═════
function parseTemplates(html) {
  const templates = {};
  const re = /<template id="([^"]+)">([\s\S]*?)<\/template>/g;
  let m;
  while ((m = re.exec(html))) templates[m[1]] = parseNodes(m[2].trim());
  return templates;
}
function voidTag(t) { return ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(t); }
function parseAttrs(s) {
  const attrs = {};
  const re = /([:\w-]+)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(s))) { if (m[1]) attrs[m[1]] = m[2] ?? ''; }
  return attrs;
}
function findMatchingClose(src, from, tag, endTag) {
  let depth = 1, i = from;
  while (i < src.length) {
    const nextOpen = src.indexOf(`<${tag}`, i);
    const nextClose = src.indexOf(endTag, i);
    if (nextClose === -1) return src.length;
    if (nextOpen !== -1 && nextOpen < nextClose && /[\s>/]/.test(src[nextOpen + 1 + tag.length] || '>')) {
      depth++; i = nextOpen + 1;
    } else { depth--; if (depth === 0) return nextClose; i = nextClose + endTag.length; }
  }
  return src.length;
}
function parseNodes(src) {
  const nodes = [];
  let i = 0;
  const len = src.length;
  while (i < len) {
    while (i < len && /\s/.test(src[i])) i++;
    if (i >= len) break;
    if (src.startsWith('<!--', i)) { i = src.indexOf('-->', i) + 3; continue; }
    if (src[i] !== '<') { const next = src.indexOf('<', i); i = next === -1 ? len : next; continue; }
    const close = src.indexOf('>', i);
    const raw = src.slice(i + 1, close);
    const selfClosing = raw.endsWith('/');
    const inner = selfClosing ? raw.slice(0, -1).trim() : raw.trim();
    const sp = inner.search(/\s/);
    const tag = (sp === -1 ? inner : inner.slice(0, sp)).toLowerCase();
    const attrStr = sp === -1 ? '' : inner.slice(sp + 1);
    const attrs = parseAttrs(attrStr);
    i = close + 1;
    if (selfClosing || voidTag(tag)) { nodes.push({ tag, attrs, children: [] }); continue; }
    // `<slot>` is a CONTAINER (may hold fallback content) — consume its close tag
    // rather than leaving `</slot>` to be mis-parsed as a phantom `/slot` node.
    // Its fallback children are ignored for anatomy (compileDef emits empty slots).
    const endTag = `</${tag}>`;
    const endIdx = findMatchingClose(src, i, tag, endTag);
    const childSrc = src.slice(i, endIdx);
    nodes.push({ tag, attrs, children: parseNodes(childSrc) });
    i = endIdx + endTag.length;
  }
  return nodes;
}

/** Convert one parsed HTML node → the anatomy `node` shape (el/class/part/attrs/slot/children). */
function htmlNodeToAnatomy(n) {
  const a = { ...n.attrs };
  const out = {};
  if (n.tag === 'slot') { out.slot = a.name ?? ''; return out; }
  out.el = n.tag;
  if (a.class) out.class = a.class;
  if (a.part) out.part = a.part;
  delete a.class; delete a.part;
  // a <slot> child collapses onto the parent as `slot`; keep both other children + slot
  const kids = [];
  let slotVal;
  for (const c of n.children ?? []) {
    if (c.tag === 'slot') { slotVal = c.attrs?.name ?? ''; continue; }
    kids.push(htmlNodeToAnatomy(c));
  }
  if (slotVal !== undefined) out.slot = slotVal;
  if (Object.keys(a).length) out.attrs = a;
  if (kids.length) out.children = kids;
  return out;
}

/** Shallow identity of an anatomy node for showWhen alignment. */
function nodeKey(n) {
  if (!n) return '';
  if (n.slot !== undefined && n.el === undefined) return `slot:${n.slot}`;
  return `${n.el || ''}.${n.class || ''}.${n.slot ?? ''}`;
}
/**
 * Merge an additional template's tree (`other`) onto the default tree (`base`),
 * marking `other`-only trailing children with `showWhen: tid`. Returns
 * { additive:true, node } when `other` is base + extra trailing children (possibly
 * recursively); { additive:false } otherwise.
 */
function mergeShowWhen(base, other, tid) {
  if (nodeKey(base) !== nodeKey(other)) return { additive: false };
  const bc = base.children ?? [], oc = other.children ?? [];
  // other must start with base's children (aligned by key), then add extras.
  if (oc.length < bc.length) return { additive: false };
  const outChildren = [];
  for (let i = 0; i < bc.length; i++) {
    if (nodeKey(bc[i]) !== nodeKey(oc[i])) return { additive: false };
    const sub = mergeShowWhen(bc[i], oc[i], tid);
    if (!sub.additive) return { additive: false };
    outChildren.push(sub.node);
  }
  for (let i = bc.length; i < oc.length; i++) {
    outChildren.push(tagShowWhen(oc[i], tid));
  }
  const node = { ...base };
  if (outChildren.length) node.children = outChildren;
  return { additive: true, node };
}
/** Recursively stamp showWhen onto a subtree that only appears in template `tid`. */
function tagShowWhen(node, tid) {
  const out = { ...node, showWhen: tid };
  return out;
}

// ══ HTML comment: `Public API:` + `Fires:` + first description line ═════════════
function htmlComment(html) {
  const m = /<!--([\s\S]*?)-->/.exec(html);
  return m ? m[1] : '';
}
function commentDescription(comment, name) {
  // first non-empty line that isn't the `sherpa-x — …` header keeps the em-dash tail
  const lines = comment.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const l of lines) {
    const m = new RegExp(`^${name}\\s*[—-]\\s*(.+)$`).exec(l);
    if (m) return m[1].trim();
  }
  return '';
}

/**
 * Parse the `Public API:` block. Returns a map: attrName → { type, values?, default?, native? }.
 * Handles:
 *   data-variant   primary | secondary | tertiary          → enum, values
 *   data-size      2xs | xs | sm   (default md)             → enum, values, default
 *   data-active    pressed state (boolean)                  → boolean
 *   data-type      icon            (default omitted)        → enum single value
 *   data-icon-start / data-icon-end   icon glyph value      → two names, string
 *   placeholder    native placeholder                       → native string
 *   name / required / disabled / readonly   native attrs    → several native names
 */
function parsePublicApi(comment) {
  const props = {};
  const lines = comment.split('\n');
  // locate the "Public API" line, capture the indented block until a blank line
  // followed by a non-indented label (Slots:/Fires:) or end.
  let start = -1, indent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)Public API[^:]*:/i.exec(lines[i]);
    if (m) { start = i + 1; indent = m[1].length; break; }
  }
  if (start === -1) return props;

  // Collect entry lines (more-indented than the label). A wrapped continuation
  // line (very deep indent, no attr token) is folded into the previous entry.
  const entries = [];
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) { // blank ends the block only if the next non-blank is a new label
      let j = i + 1; while (j < lines.length && !lines[j].trim()) j++;
      if (j >= lines.length) break;
      if (/^\s*(Slots|Fires|Events|Templates)\s*:/i.test(lines[j])) break;
      continue;
    }
    const lead = (/^(\s*)/.exec(raw) || [])[1].length;
    if (lead <= indent) { // a sibling label like Slots:/Fires: — stop
      if (/^\s*[A-Z][\w ]*:/.test(raw) && !/^\s*(data-|[a-z][\w-]*\s)/.test(raw)) break;
    }
    // A new entry starts with an attr name (data-* or a bare native attr) followed
    // by 2+ spaces OR an em-dash/hyphen separator OR end-of-line. Anything else
    // (a `| value` wrap, a prose continuation) folds into the previous entry.
    const trimmed = raw.trim();
    const nameHead = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)(\s{2,}|\s*[—-]\s|\s*$)/;
    const looksEntry = nameHead.test(trimmed);
    if (!looksEntry && entries.length) { entries[entries.length - 1] += ' ' + trimmed; continue; }
    entries.push(trimmed);
  }

  for (const entry of entries) {
    // split name(s) column from the description column: 2+ spaces, an em-dash, or
    // a single-space before "native"/"—".
    let mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)\s{2,}(.*)$/.exec(entry);
    if (!mm) mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)\s*[—-]\s*(.*)$/.exec(entry);
    if (!mm) mm = /^([a-z][\w-]*)\s*$/.exec(entry) ? [entry, entry.trim(), ''] : null;
    if (!mm) continue;
    const names = mm[1].split('/').map((s) => s.trim()).filter(Boolean);
    const rest = (mm[2] ?? '').trim();

    for (const nm of names) {
      const p = { name: nm };
      const isNative = !nm.startsWith('data-') && NATIVE_ATTRS.has(nm);
      if (isNative) p.native = true;

      // native boolean-ish attrs default to boolean; `(boolean)` or a bare
      // "boolean" word confirms it.
      const NATIVE_BOOL = new Set(['disabled', 'readonly', 'required', 'checked', 'multiple']);
      if (/\(boolean\)/i.test(rest) || (isNative && NATIVE_BOOL.has(nm)) || (isNative && /\bboolean\b/i.test(rest))) {
        p.type = 'boolean';
      } else {
        // enum values: `A | B | C` at the head, TOLERATING inline `(…)` value
        // descriptions between options (e.g. `default (rect…) | simple (pill…)`).
        const values = parseEnumValues(rest);
        if (values && values.length > 1) { p.type = 'enum'; p.values = values; }
      }
      // default: `(default X)` / `(default omitted)`
      const defM = /\(default\s+([^)]+)\)/i.exec(rest);
      if (defM) {
        const d = defM[1].trim();
        if (d !== 'omitted' && d !== 'none' && d !== 'unset') p.default = d;
      }
      // boolean default
      if (p.type === 'boolean' && p.default === undefined) p.default = false;
      // fallback type
      if (!p.type) p.type = 'string';

      const desc = rest.replace(/\((?:boolean|default[^)]*)\)/gi, '').trim();
      if (desc) p.description = desc;
      props[nm] = p;
    }
  }
  return props;
}

/**
 * Extract enum values from a Public-API description that begins with a pipe list,
 * tolerating inline `(…)` value descriptions between options:
 *   "primary | secondary | tertiary"                       → [primary,secondary,tertiary]
 *   "default (rect, label) | simple (pill, no label)"      → [default, simple]
 *   "2xs | xs | sm   (default md)"                          → [2xs, xs, sm]
 * Returns null when there's no `|` (not an enum by this heuristic).
 */
function parseEnumValues(rest) {
  if (!rest.includes('|')) return null;
  // cut at the first sentence-ending marker that's clearly prose, not a value list:
  // stop at " — " or " (via " etc. Keep it simple: remove parentheticals, then
  // take the leading run of `token ( | token )+`.
  const noParens = rest.replace(/\([^)]*\)/g, ' ');
  // leading segment up to the first char that isn't part of a pipe list
  const m = /^([\w-]+(?:\s*\|\s*[\w-]+)+)/.exec(noParens.trim());
  if (!m) return null;
  return m[1].split('|').map((s) => s.trim()).filter(Boolean);
}

/** Parse the `Fires:` line(s) → [name, …]. Handles `Fires: a, b` and multi-line lists. */
function parseFires(comment) {
  const out = new Set();
  const lines = comment.split('\n');
  let inFires = false, indent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)Fires\s*:(.*)$/i.exec(lines[i]);
    if (m) {
      inFires = true; indent = m[1].length;
      // names on the same line (before any `(detail…)`)
      collectEventNames(m[2], out);
      continue;
    }
    if (inFires) {
      if (!lines[i].trim()) { inFires = false; continue; }
      const lead = (/^(\s*)/.exec(lines[i]) || [])[1].length;
      if (lead <= indent) { inFires = false; continue; }
      collectEventNames(lines[i], out);
    }
  }
  return [...out];
}
function collectEventNames(text, set) {
  // strip `(detail: …)` tails, then take the leading identifier of each fragment
  const cleaned = text.replace(/\(detail[^)]*\)/gi, '').replace(/\(re-dispatched[^)]*\)/gi, '');
  for (const frag of cleaned.split(/[,\n]/)) {
    const mm = /^\s*([a-z][\w-]*)/.exec(frag.replace(/^[—-]\s*/, '').trim());
    if (mm && mm[1] && mm[1] !== 'detail') set.add(mm[1]);
  }
}

// ══ authored CSS token-binding extraction (mirrors roundtrip-component.mjs) ══════
function authoredCss(css) {
  const end = css.indexOf('/* == end sherpa:tokens == */');
  return end === -1 ? css : css.slice(end + '/* == end sherpa:tokens == */'.length);
}
function stripCssComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }
/** Returns ordered [{ el, prop, sherpaVar }] taking the FIRST binding per el.prop. */
function extractCssBindings(cssRaw) {
  const css = stripCssComments(cssRaw);
  const seen = new Set();
  const out = [];
  const re = /([^{}]+?)\s*\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    const body = m[2];
    const cm = /^\.([\w-]+)$/.exec(sel);   // plain single-class rules only
    if (!cm) continue;
    const el = cm[1];
    const record = (prop, sherpaVar) => {
      const key = `${el}.${prop}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ el, prop, sherpaVar });
    };
    for (const d of body.split(';')) {
      const cd = /^\s*([\w-]+)\s*:\s*(.+)$/.exec(d);
      if (!cd) continue;
      const prop = cd[1];
      const val = cd[2];
      if (prop === 'border') {
        const vars = [...val.matchAll(/var\(\s*--sherpa-([\w-]+)/g)].map((mm) => mm[1]);
        if (vars[0]) record('border-width', vars[0]);
        if (vars[1]) record('border-color', vars[1]);
        continue;
      }
      const vm = /var\(\s*--sherpa-([\w-]+)/.exec(val);
      if (vm) record(prop, vm[1]);
    }
  }
  return out;
}

/**
 * A `--sherpa-X` var name → a `{ref}` string. Scoped component vars
 * (--sherpa-<comp>-…) become `{comp.<path>}` resolving in the token file when
 * possible; everything else is a `{sherpa.X}` alias. `refToToken` (the adapter)
 * inverts BOTH back to the same var name, so the round-trip is exact regardless.
 */
function varToRef(sherpaVar, compName, tokens) {
  const short = compName.replace(/^sherpa-/, '');
  if (sherpaVar.startsWith(short + '-') && tokens && tokens[short]) {
    // find the token-file path under tokens[short] whose flattened form == sherpaVar
    const path = findTokenPath(tokens[short], short, sherpaVar);
    if (path) return `{${short}.${path.join('.')}}`;
    // fallback: flat scoped ref that still round-trips (refToToken drops namespace)
    return `{${short}.${sherpaVar}}`;
  }
  return `{sherpa.${sherpaVar}}`;
}
/** DFS tokens[short] for a leaf whose `${short}-${dotpath→hyphen}` equals sherpaVar. */
function findTokenPath(group, short, sherpaVar) {
  const results = [];
  (function walk(node, trail) {
    if (node && typeof node === 'object' && !('$value' in node)) {
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('$')) continue;
        walk(v, [...trail, k]);
      }
    } else {
      results.push(trail);
    }
  })(group, []);
  for (const trail of results) {
    const flat = short + '-' + trail.join('-'); // {short.a.b} → refToToken → a-b → --sherpa-short?? no
    // refToToken({short.trail}) = trail.join('-'); compile emits var(--sherpa-<that>).
    // So we need trail.join('-') === sherpaVar.
    if (trail.join('-') === sherpaVar) return trail;
    if (flat === sherpaVar) return trail; // when leaf already carries the short prefix
  }
  return null;
}

// ══ TS: getters/setters + JSDoc @prop → jsProps + capabilities ══════════════════
function parseTsJsProps(ts) {
  const props = new Map();
  // JSDoc: @prop {type} name — desc
  for (const m of ts.matchAll(/@prop\s*(?:\{([^}]*)\})?\s*([\w$]+)\s*[—-]?\s*([^\n*]*)/g)) {
    const [, type, name, desc] = m;
    props.set(name, { name, type: (type || '').trim() || 'string', description: desc.trim() });
  }
  // getters/setters confirm read/write access + reflected attr
  const getters = new Set([...ts.matchAll(/\bget\s+([\w$]+)\s*\(/g)].map((m) => m[1]));
  const setters = new Set([...ts.matchAll(/\bset\s+([\w$]+)\s*\(/g)].map((m) => m[1]));
  for (const name of new Set([...getters, ...setters])) {
    if (name.startsWith('#')) continue;
    if (!props.has(name)) props.set(name, { name, type: 'string' });
    const p = props.get(name);
    p.access = getters.has(name) && setters.has(name) ? 'read-write' : getters.has(name) ? 'read' : 'write';
  }
  return [...props.values()];
}

// ══ authored-CSS state selectors → states[] (name + selector) ════════════════════
function parseStates(cssAuthored) {
  const css = stripCssComments(cssAuthored);
  const states = [];
  const seen = new Set();
  const add = (name, selector) => { if (!seen.has(selector)) { seen.add(selector); states.push({ name, selector }); } };
  // :host([data-state="on"])  → name = the attr's value or the attr
  for (const m of css.matchAll(/:host\(\[data-([\w-]+)(?:="([^"]*)")?\]\)/g)) {
    const [, attr, val] = m;
    const name = val || attr;
    add(name, m[0]);
  }
  for (const m of css.matchAll(/:host\(:not\(\[data-([\w-]+)(?:="([^"]*)")?\]\)\)/g)) {
    const [, attr, val] = m;
    add(`not-${val || attr}`, m[0]);
  }
  if (/:host\(\[disabled\]\)/.test(css)) add('disabled', ':host([disabled])');
  const fv = /(\.[\w-]+):focus-visible/.exec(css);
  if (fv) add('focus-visible', fv[0]);
  else if (/:focus-visible/.test(css)) add('focus-visible', ':focus-visible');
  return states;
}

// ══ the generator ════════════════════════════════════════════════════════════════
function generateSpec(name) {
  const dir = join(C, name);
  const notes = [];
  const thinRaw = readIf(join(dir, `${name}.thin.yaml`));
  const html = readIf(join(dir, `${name}.html`));
  const css = readIf(join(dir, `${name}.css`));
  const ts = readIf(join(dir, `${name}.ts`));
  const thin = thinRaw ? (yaml.load(thinRaw) ?? {}) : {};
  if (!thinRaw) notes.push('no thin.yaml (props/tokens derived from HTML+CSS only)');
  if (!html) notes.push('no HTML (cannot derive anatomy/props/events — round-trip will fail)');
  if (!css) notes.push('no CSS (no token bindings)');
  if (!ts) notes.push('no TS (no jsProps)');

  // TS `observed` list is the GROUND TRUTH for which data-* props are reactive.
  // compileDef derives observed from props with kind !== 'style', so a prop the TS
  // observes must NOT be kind:style in the spec (else the round-trip observed list
  // mismatches). thin.yaml's kind is often stale ('style'); the TS wins.
  const tsObserved = ts ? (() => { const m = /static override observed\s*=\s*\[([^\]]*)\]/.exec(ts); return m ? m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : []; })() : [];

  const comment = html ? htmlComment(html) : '';
  const apiProps = comment ? parsePublicApi(comment) : {};
  if (html && !comment) notes.push('HTML has no leading comment (no Public API block)');
  if (html && comment && !/Public API/i.test(comment)) notes.push('HTML comment lacks a `Public API:` block — no enum values parseable');

  const templatesObj = html ? parseTemplates(html) : {};
  const templateIds = Object.keys(templatesObj);
  const defaultTree = templatesObj['default'];

  // ── $description ──────────────────────────────────────────────────────────────
  const description = thin.description || commentDescription(comment, name) || `the ${name.replace('sherpa-', '')} component.`;

  // ── anatomy + templates ───────────────────────────────────────────────────────
  let anatomy = null;
  if (defaultTree && defaultTree.length) {
    // the single root element (ignore stray comment-only nodes)
    const roots = defaultTree.filter((n) => n.tag !== 'slot');
    if (roots.length === 1) anatomy = { root: htmlNodeToAnatomy(roots[0]) };
    else if (roots.length > 1) { anatomy = { root: htmlNodeToAnatomy(roots[0]) }; notes.push(`default template has ${roots.length} root nodes — compileDef supports one anatomy.root; only the first is used (multi-root not round-trippable)`); }

    // Multi-template union: compileDef renders ONE anatomy filtered by showWhen per
    // template. For each additional template that's an ADDITIVE superset of default
    // (same nodes + extra trailing children), fold the extras in with `showWhen`.
    // Non-additive templates (subset / divergent trees) can't be expressed and are
    // reported as gaps.
    if (anatomy && roots.length === 1) {
      for (const tid of templateIds) {
        if (tid === 'default') continue;
        const otherRoots = (templatesObj[tid] || []).filter((n) => n.tag !== 'slot');
        if (otherRoots.length !== 1) { notes.push(`template "${tid}" has ${otherRoots.length} roots — not merged (anatomy from default only)`); continue; }
        const merged = mergeShowWhen(anatomy.root, htmlNodeToAnatomy(otherRoots[0]), tid);
        if (merged.additive) anatomy.root = merged.node;
        else notes.push(`template "${tid}" is not an additive superset of default (subset/divergent tree) — not round-trippable via showWhen`);
      }
    }
  } else if (html) {
    notes.push('no <template id="default"> — cannot derive anatomy');
  }

  // ── props: merge thin.yaml + Public API comment ───────────────────────────────
  const thinProps = thin.props && typeof thin.props === 'object' ? thin.props : {};
  const propNames = new Set([...Object.keys(thinProps), ...Object.keys(apiProps)]);
  const props = [];
  for (const nm of propNames) {
    const fromThin = thinProps[nm] || {};
    const fromApi = apiProps[nm] || {};
    const p = { $type: 'prop', name: nm };
    // type: comment wins (it carries enum/boolean signal), else thin, else string
    p.type = fromApi.type || fromThin.type || (fromThin.$verbatim && fromThin.$verbatim.type) || 'string';
    // kind (variant mechanism): thin.yaml supplies it, but the TS `observed` list
    // OVERRIDES — a prop the component observes cannot be kind:style, and a data-*
    // prop the component does NOT observe must be kind:style (unobserved). This
    // keeps the round-trip observed list exact when thin.yaml's kind is stale.
    let kind = fromThin.kind || (fromThin.$verbatim && fromThin.$verbatim.kind);
    const native = fromApi.native === true || (!nm.startsWith('data-') && NATIVE_ATTRS.has(nm));
    // The TS `observed` list is authoritative for round-trip: compileDef derives
    // observed from props whose kind !== 'style'. So a data-* prop the component
    // does NOT observe must be kind:style (even if thin.yaml tags it visibility/
    // template — many components handle those via CSS/templateId, not observation).
    // A prop it DOES observe keeps a reactive kind (default content). Only applied
    // when a TS file exists (its observed list — even empty — is the ground truth).
    if (nm.startsWith('data-') && ts) {
      if (tsObserved.includes(nm)) { if (!kind || kind === 'style') kind = 'content'; }
      else kind = 'style'; // not observed at runtime → contributes nothing to observed
    }
    if (native) {
      p.native = true;
      // A native attr the component OBSERVES must survive into the observed list
      // (specToDef drops native attrs that carry no kind). Give it a reactive kind.
      if (ts && tsObserved.includes(nm)) p.kind = 'content';
    }
    else if (kind && kind !== 'style') p.kind = kind; // style kind is default/implicit; keep others
    else if (kind === 'style') p.kind = 'style';
    if (p.type === 'enum') {
      if (fromApi.values && fromApi.values.length) p.values = fromApi.values;
      else if (fromThin.values) p.values = fromThin.values;
      else { p.values = []; notes.push(`prop ${nm}: enum with NO parseable values (Public API comment lacks them) — NEEDS HAND-FINISHING`); }
    }
    const def = fromApi.default !== undefined ? fromApi.default : (fromThin.default ?? (fromThin.$verbatim && fromThin.$verbatim.default));
    if (def !== undefined && def !== null) p.default = def;
    else if (native && p.type === 'boolean') p.default = false;
    const desc = fromApi.description || fromThin.description;
    if (desc) p.description = desc;
    props.push(p);
  }
  // stable order: data-* first (alpha), then native
  props.sort((a, b) => {
    const an = a.native ? 1 : 0, bn = b.native ? 1 : 0;
    return an - bn || a.name.localeCompare(b.name);
  });

  // ── events ────────────────────────────────────────────────────────────────────
  const thinEvents = thin.events && typeof thin.events === 'object' ? thin.events : {};
  const firesNames = comment ? parseFires(comment) : [];
  const eventNames = new Set([...Object.keys(thinEvents), ...firesNames]);
  const events = [];
  for (const en of eventNames) {
    const ev = { $type: 'event', name: en, bubbles: true, composed: true };
    const trig = thinEvents[en]?.$verbatim?.trigger || thinEvents[en]?.trigger;
    if (trig) {
      ev.trigger = {};
      if (trig.on) ev.trigger.on = trig.on;
      if (trig.node) ev.trigger.node = trig.node;
    }
    events.push(ev);
  }

  // ── tokens (authored CSS bindings) ────────────────────────────────────────────
  const tokens = {};
  if (css) {
    for (const { el, prop, sherpaVar } of extractCssBindings(authoredCss(css))) {
      tokens[`${el}.${prop}`] = varToRef(sherpaVar, name, generateSpec._tokens);
    }
  }

  // ── element ───────────────────────────────────────────────────────────────────
  let element = null;
  const rootEl = anatomy?.root?.el;
  if (rootEl) {
    const em = generateSpec._elementMap[rootEl] || {};
    element = { $type: 'element', tag: rootEl };
    if (anatomy.root.attrs && Object.keys(anatomy.root.attrs).length) element.attributes = anatomy.root.attrs;
    element.provides = Array.isArray(em.provides) ? em.provides : [];
    if (em.stateCss) element.stateCss = em.stateCss;
    if (!Array.isArray(em.provides)) notes.push(`root element <${rootEl}> not a known semantic element in element-map — provides left empty`);
  }

  // ── states (best-effort) ──────────────────────────────────────────────────────
  const states = css ? parseStates(authoredCss(css)).map((s) => ({ $type: 'state', ...s })) : [];

  // ── capabilities + jsProps (best-effort) ──────────────────────────────────────
  const jsProps = ts ? parseTsJsProps(ts) : [];
  const capabilities = [];
  if (jsProps.length) {
    capabilities.push({
      $type: 'capability',
      api: 'js-property-mirror',
      description: `read/write JS properties (${jsProps.map((j) => j.name).join(', ')}). See $extensions.sherpa.jsProps.`,
    });
  }

  // ── $extensions.sherpa ────────────────────────────────────────────────────────
  const fv = thin.figmaVerbatim || {};
  const sherpaExt = {};
  const figmaName = thin.figmaName || fv.figmaName;
  if (figmaName) sherpaExt.figmaName = figmaName;
  if (thin.category) sherpaExt.category = thin.category;
  if (Array.isArray(fv.variantAxes) && fv.variantAxes.length) {
    sherpaExt.variantAxes = fv.variantAxes.map((a) => ({ name: a.name, ...(a.values ? { values: a.values } : {}) }));
  }
  if (Array.isArray(fv.booleanProps) && fv.booleanProps.length) sherpaExt.booleanProps = fv.booleanProps;
  if (thin._divergence) sherpaExt.divergence = thin._divergence;
  if (jsProps.length) sherpaExt.jsProps = jsProps;

  // ── assemble ──────────────────────────────────────────────────────────────────
  const spec = {
    $schema: '../../../schemas/component.v1.json',
    $type: 'component',
    $name: name,
    $description: description,
  };
  if (element) spec.element = element;
  spec.templates = templateIds.length ? templateIds : ['default'];
  if (anatomy) spec.anatomy = anatomy;
  if (props.length) spec.props = props;
  if (states.length) spec.states = states;
  if (capabilities.length) spec.capabilities = capabilities;
  if (events.length) spec.events = events;
  if (Object.keys(tokens).length) spec.tokens = tokens;
  if (Object.keys(sherpaExt).length) spec.$extensions = { sherpa: sherpaExt };

  return { spec, notes };
}
generateSpec._tokens = null;
generateSpec._elementMap = {};

// ══ serialise ═══════════════════════════════════════════════════════════════════
function toYaml(spec) {
  const body = yaml.dump(spec, { lineWidth: 100, noRefs: true, quotingType: '"', forceQuotes: false });
  const header = `# ${spec.$name} — DTCG-dialect component spec (GENERATED by scripts/generate-component-spec.mjs).
#
# Derived from ${spec.$name}.{thin.yaml,html,css,ts}. The MECHANICAL surface only —
# props (with enum values), anatomy, events, token bindings, element, best-effort
# states/capabilities. Richer state/capability PROSE is left for hand-finishing.
# Validated by schemas/component.v1.json; round-trips via roundtrip-component.mjs.
#
`;
  return header + body;
}

// ══ validate + round-trip (in-memory, for --check) ══════════════════════════════
let _validate = null;
function getValidator() {
  if (_validate) return _validate;
  const AjvCtor = Ajv2020.default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  _validate = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')));
  return _validate;
}
function validateSpec(spec) {
  const validate = getValidator();
  const ok = validate(spec);
  const errors = ok ? [] : (validate.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`);
  return { ok, errors };
}
/** In-memory round-trip: spec → specToDef → compileDef → compare on-disk files. */
function roundtripSpec(name, spec) {
  const dir = join(C, name);
  if (!spec.anatomy) return { ok: false, reason: 'no anatomy block', diffs: ['spec carries no anatomy — cannot regenerate HTML'] };
  let def, gen;
  try { def = specToDef(spec); gen = compileDef(def); }
  catch (e) { return { ok: false, reason: 'compile error', diffs: [String(e.message || e)] }; }
  const realHtml = readIf(join(dir, `${name}.html`));
  const realCss = readIf(join(dir, `${name}.css`));
  const realTs = readIf(join(dir, `${name}.ts`));
  if (!realHtml || !realCss || !realTs) return { ok: false, reason: 'missing source', diffs: ['component lacks .html/.css/.ts'] };
  const diffs = [];
  htmlDiff(gen.html, realHtml, diffs);
  cssDiff(gen.css, authoredCss(realCss), diffs);
  tsDiff(gen.ts, realTs, diffs);
  return { ok: diffs.length === 0, diffs };
}
// structural HTML compare (mirrors roundtrip-component.mjs)
function normNode(n) {
  const a = { ...n.attrs };
  const out = { tag: n.tag };
  if (n.tag === 'slot') out.slotName = a.name ?? '';
  out.class = a.class ?? ''; out.part = a.part ?? '';
  delete a.class; delete a.part;
  out.attrs = Object.fromEntries(Object.entries(a).sort());
  out.children = (n.children ?? []).map(normNode);
  return out;
}
function nodeDiff(gen, real, path, diffs) {
  if (!gen || !real) { diffs.push(`${path}: node present on one side only`); return; }
  for (const k of ['tag', 'class', 'part', 'slotName']) if ((gen[k] ?? '') !== (real[k] ?? '')) diffs.push(`${path}: ${k} "${gen[k] ?? ''}"≠"${real[k] ?? ''}"`);
  if (JSON.stringify(gen.attrs) !== JSON.stringify(real.attrs)) diffs.push(`${path}: attrs differ`);
  const gc = gen.children ?? [], rc = real.children ?? [];
  if (gc.length !== rc.length) diffs.push(`${path}: ${gc.length}≠${rc.length} children`);
  for (let i = 0; i < Math.max(gc.length, rc.length); i++) nodeDiff(gc[i], rc[i], `${path}>${(gc[i]?.tag || rc[i]?.tag)}[${i}]`, diffs);
}
function htmlDiff(genHtml, realHtml, diffs) {
  const g = parseTemplates(genHtml), r = parseTemplates(realHtml);
  for (const id of new Set([...Object.keys(g), ...Object.keys(r)])) {
    if (!g[id] || !r[id]) { diffs.push(`HTML template "${id}" one-sided`); continue; }
    const gn = g[id].map(normNode), rn = r[id].map(normNode);
    for (let i = 0; i < Math.max(gn.length, rn.length); i++) nodeDiff(gn[i], rn[i], `HTML ${id}[${i}]`, diffs);
  }
}
function cssDiff(genCss, realAuthored, diffs) {
  const gen = bindingsMap(extractCssBindings(genCss));
  const real = bindingsMap(extractCssBindings(realAuthored));
  for (const [k, v] of Object.entries(gen)) {
    if (real[k] === undefined) diffs.push(`CSS ${k}: generated binds --sherpa-${v}; authored has none`);
    else if (real[k] !== v) diffs.push(`CSS ${k}: --sherpa-${v}≠--sherpa-${real[k]}`);
  }
}
function bindingsMap(list) { const o = {}; for (const b of list) o[`.${b.el} ${b.prop}`] ??= b.sherpaVar; return o; }
function tsDiff(genTs, realTs, diffs) {
  const fact = (ts) => ({
    class: (/export class (\w+) extends SherpaElement/.exec(ts) || [])[1] ?? null,
    define: (/customElements\.define\('([^']+)'/.exec(ts) || [])[1] ?? null,
    observed: (() => { const m = /static override observed = \[([^\]]*)\]/.exec(ts); return m ? m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean).sort() : []; })(),
  });
  const g = fact(genTs), r = fact(realTs);
  for (const k of ['class', 'define']) if (g[k] !== r[k]) diffs.push(`TS ${k}: "${g[k]}"≠"${r[k]}"`);
  if (JSON.stringify(g.observed) !== JSON.stringify(r.observed)) diffs.push(`TS observed: [${g.observed}]≠[${r.observed}]`);
}

// ══ CLI ═════════════════════════════════════════════════════════════════════════
function allComponentNames() {
  return readdirSync(C).filter((n) => n.startsWith('sherpa-') && existsSync(join(C, n, `${n}.thin.yaml`)) || (n.startsWith('sherpa-') && existsSync(join(C, n, `${n}.html`))));
}
function run() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const all = args.includes('--all');
  const names = all ? readdirSync(C).filter((n) => n.startsWith('sherpa-') && (existsSync(join(C, n, `${n}.html`)) || existsSync(join(C, n, `${n}.thin.yaml`))))
    : args.filter((a) => !a.startsWith('--')).map((n) => (n.startsWith('sherpa-') ? n : `sherpa-${n}`));
  if (!names.length) { console.error('usage: generate-component-spec.mjs <name>... | --all  [--check]'); process.exit(2); }

  generateSpec._tokens = loadTokens();
  generateSpec._elementMap = loadElementMap();

  const rows = [];
  for (const name of names) {
    const dir = join(C, name);
    if (!existsSync(dir)) { rows.push({ name, error: 'no component dir' }); continue; }
    const { spec, notes } = generateSpec(name);
    const { ok: valid, errors } = validateSpec(spec);
    const rt = roundtripSpec(name, spec);
    const enumIssues = notes.filter((n) => /NEEDS HAND-FINISHING/.test(n));
    rows.push({ name, valid, errors, rtOk: rt.ok, rtDiffs: rt.diffs, notes, enumIssues });

    if (!check) {
      const outPath = join(dir, `${name}.component.yaml`);
      // Protect a hand-authored / hand-finished spec: only (over)write files this
      // generator produced (they carry the GENERATED header). A hand spec (e.g. the
      // switch pilot) is left untouched unless explicitly regenerated by name.
      const existing = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
      const isHandAuthored = existing && !existing.includes('GENERATED by scripts/generate-component-spec.mjs');
      if (all && isHandAuthored) { rows[rows.length - 1].skippedWrite = 'hand-authored spec preserved'; continue; }
      writeFileSync(outPath, toYaml(spec), 'utf8');
    }
  }

  // report
  if (names.length === 1 && !all) {
    const r = rows[0];
    console.log(`\n${r.name}`);
    console.log(`  validate:   ${r.valid ? 'PASS' : 'FAIL'}`);
    r.errors?.forEach((e) => console.log(`     • ${e}`));
    console.log(`  round-trip: ${r.rtOk ? 'PASS' : 'FAIL'}`);
    r.rtDiffs?.forEach((d) => console.log(`     • ${d}`));
    if (r.notes?.length) { console.log(`  notes:`); r.notes.forEach((n) => console.log(`     • ${n}`)); }
    if (!check) console.log(`  written: ${r.name}/${r.name}.component.yaml`);
  } else {
    console.log(`\n${check ? '--check' : '--all'}: ${rows.length} components\n`);
    const pad = (s, n) => String(s).padEnd(n);
    console.log(`${pad('component', 30)} ${pad('valid', 7)} ${pad('round-trip', 12)} needs-hand-finishing`);
    console.log('-'.repeat(90));
    let vPass = 0, rPass = 0, needFix = 0;
    for (const r of rows) {
      if (r.error) { console.log(`${pad(r.name, 30)} ${pad('ERR', 7)} ${pad(r.error, 12)}`); continue; }
      if (r.valid) vPass++;
      if (r.rtOk) rPass++;
      const flags = [];
      if (r.enumIssues?.length) flags.push(`${r.enumIssues.length} enum(s) w/o values`);
      if (!r.rtOk) flags.push(`rt:${r.rtDiffs?.length || 0} diff(s)`);
      const otherNotes = (r.notes || []).filter((n) => !/NEEDS HAND-FINISHING/.test(n));
      if (otherNotes.some((n) => /no HTML|no <template|no thin|no leading comment|lacks a `Public API/.test(n))) flags.push('src-gap');
      if (flags.length) needFix++;
      console.log(`${pad(r.name, 30)} ${pad(r.valid ? 'PASS' : 'FAIL', 7)} ${pad(r.rtOk ? 'PASS' : 'FAIL', 12)} ${flags.join('; ')}`);
    }
    console.log('-'.repeat(90));
    console.log(`validate: ${vPass}/${rows.length} PASS   round-trip: ${rPass}/${rows.length} PASS   need hand-finishing: ${needFix}`);
    // detail on failures
    const fails = rows.filter((r) => !r.error && (!r.valid || !r.rtOk || r.enumIssues?.length));
    if (fails.length) {
      console.log(`\n── details for ${fails.length} component(s) needing attention ──`);
      for (const r of fails) {
        console.log(`\n${r.name}:`);
        if (!r.valid) r.errors.forEach((e) => console.log(`   validate • ${e}`));
        if (!r.rtOk) r.rtDiffs.slice(0, 8).forEach((d) => console.log(`   round-trip • ${d}`));
        r.enumIssues?.forEach((n) => console.log(`   enum • ${n}`));
        (r.notes || []).filter((n) => /no HTML|no <template|no thin|no leading comment|lacks a `Public API|not a known semantic/.test(n)).forEach((n) => console.log(`   note • ${n}`));
      }
    }
  }
  const anyFail = rows.some((r) => r.error || !r.valid);
  process.exit(anyFail ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();

export { generateSpec, toYaml };
