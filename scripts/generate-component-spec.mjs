#!/usr/bin/env node
/**
 * generate-component-spec.mjs — DERIVE a DTCG-dialect `*.component.yaml` spec for a
 * component from its CODE sources (HTML + CSS + TS + element-map).
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
 * `*.component.yaml` is now THE single authored+regenerable component contract;
 * `*.thin.yaml` has been RETIRED. Everything the generator emits derives from the
 * component's own HTML/CSS/TS — EXCEPT the Figma binding (figmaName, category,
 * variantAxes, booleanProps, divergence), which cannot be read from code. That
 * block lived in thin.yaml's `figmaVerbatim`; it now lives in each spec's
 * `$extensions.sherpa` and is PRESERVED verbatim from the existing spec on regen.
 *
 * PURE-ish: reads the component sources + shared data files, emits YAML. NEVER
 * modifies any component source (.ts/.html/.css).
 *
 * ── Derivation strategy, per spec block ───────────────────────────────────────
 *   $name
 *       ← the component directory name.
 *   $description
 *       ← the HTML comment's `sherpa-x — …` first line, then a stub.
 *   $extensions.sherpa (figmaName, category, variantAxes, booleanProps, divergence)
 *       ← PRESERVED from the EXISTING <name>.component.yaml's `$extensions.sherpa`
 *         (these came from thin.yaml's figmaVerbatim and cannot be re-derived from
 *         code). resync-figma.mjs keeps them aligned with live Figma. jsProps are
 *         re-derived fresh from the TS below and merged in.
 *   props
 *       ← the HTML `Public API:` comment block — the AUTHORITATIVE source of enum
 *         `values` + `default` + `(boolean)`. Native attrs (disabled/name/value/…)
 *         → native:true. Enum props get `values:[…]`. The TS `observed` list is the
 *         ground truth for which data-* props are reactive (kind).
 *   anatomy + templates
 *       ← parse the HTML `<template id="default">` node tree (el/class/part/attrs/
 *         slot/children). templates = every `<template id>` present.
 *   events
 *       ← the HTML `Fires:` list.
 *   tokens
 *       ← parse the AUTHORED CSS region (below `/* == end sherpa:tokens == *␣/`)
 *         for `.el { prop: var(--sherpa-X) }` bindings and emit `el.prop:{ref}`.
 *         This is what round-trips, because roundtrip-component.mjs re-extracts the
 *         same authored bindings.
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
import { authoredCss, extractBindings, parseStates } from './lib/css-reader.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');
const SCHEMA_PATH = join(ROOT, 'schemas', 'component.v1.json');
const TOKENS_PATH = join(ROOT, 'src', 'styles', 'tokens', 'figma.tokens.json');
const ELEMENT_MAP_PATH = join(ROOT, 'scripts', 'figma-data', 'element-map.yaml');

const NATIVE_ATTRS = new Set([
  'disabled', 'name', 'value', 'required', 'readonly', 'placeholder',
  'checked', 'min', 'max', 'step', 'minlength', 'maxlength', 'pattern',
  'multiple', 'href', 'target', 'type', 'rows', 'cols', 'autocomplete',
  // `indeterminate` is an IDL property with no content attribute, but the select
  // controls observe it as one — and a name missing here never gets a reactive
  // kind, so it lands as kind:style and drops out of the generated observed list.
  'indeterminate', 'open', 'hidden', 'selected', 'inputmode',
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
/**
 * The byte range each `<!-- … -->` occupies, so tag scanning can ignore them.
 *
 * parseNodes already skips comments; findMatchingClose did NOT, and it is the one
 * that COUNTS tags. A comment that merely MENTIONS a tag — "a bare <span> with an
 * aria-label is ignored by AT" — therefore pushed the depth one too deep, the true
 * close was never matched, and the element swallowed every sibling after it to the
 * end of the source. In sherpa-quick-filter that put .icon and .label inside
 * .count-wrap and emitted a phantom `/span` node from the unconsumed close tag.
 */
function commentRanges(src) {
  const out = [];
  let i = 0;
  for (;;) {
    const start = src.indexOf('<!--', i);
    if (start === -1) return out;
    const close = src.indexOf('-->', start + 4);
    const end = close === -1 ? src.length : close + 3;
    out.push([start, end]);
    i = end;
  }
}
function findMatchingClose(src, from, tag, endTag) {
  const comments = commentRanges(src);
  // A hit inside a comment is TEXT, not markup — step past the whole comment and
  // look again, rather than counting it.
  const skip = (at) => {
    for (const [start, end] of comments) if (at >= start && at < end) return end;
    return -1;
  };
  const find = (needle, at) => {
    let k = at;
    for (;;) {
      const hit = src.indexOf(needle, k);
      if (hit === -1) return -1;
      const past = skip(hit);
      if (past === -1) return hit;
      k = past;
    }
  };
  let depth = 1, i = from;
  while (i < src.length) {
    const nextOpen = find(`<${tag}`, i);
    const nextClose = find(endTag, i);
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

/** Build a bare <slot> child node { slot, attrs?, children? } — dropping the `name`
 *  attr (it becomes `slot`) and keeping every other attr (notably data-accepts) so
 *  name + attr-set + position round-trip.
 *
 *  FALLBACK CONTENT is kept as `children`, which is what it is: the nodes the slot
 *  shows when nothing is projected into it. Dropping it was the single largest
 *  round-trip gap — 42 diffs across 12 components, every one of them a `<slot>`
 *  wrapping a default `<i class="glyph">` or similar. A slot node has no other use
 *  for `children`, so no new field is needed. */
function slotChildNode(n) {
  const a = { ...n.attrs };
  const out = { slot: a.name ?? '' };
  delete a.name;
  if (Object.keys(a).length) out.attrs = a;
  const kids = (n.children ?? []).map((c) => htmlNodeToAnatomy(c));
  if (kids.length) out.children = kids;
  return out;
}
/** True when a <slot> can collapse onto its parent as `parent.slot` — the legacy
 *  inline form (byte-stable for e.g. sherpa-tag): it must be the parent's SOLE
 *  child, carry no attrs beyond `name`, and hold no fallback content. */
function isCollapsibleSoleSlot(parent) {
  const kids = parent.children ?? [];
  if (kids.length !== 1) return false;
  const c = kids[0];
  if (c.tag !== 'slot') return false;
  const extra = Object.keys(c.attrs ?? {}).filter((k) => k !== 'name');
  if (extra.length) return false;               // has data-accepts etc. → first-class
  if ((c.children ?? []).length) return false;  // has fallback content → first-class
  return true;
}
/** Convert one parsed HTML node → the anatomy `node` shape (el/class/part/attrs/slot/children). */
function htmlNodeToAnatomy(n) {
  const a = { ...n.attrs };
  const out = {};
  // A bare <slot> becomes a first-class slot child node (name + attrs, no fallback).
  if (n.tag === 'slot') return slotChildNode(n);
  out.el = n.tag;
  if (a.class) out.class = a.class;
  if (a.part) out.part = a.part;
  delete a.class; delete a.part;
  // Collapse a lone, attr-free, fallback-free <slot> onto the parent (byte-stable
  // inline form). Otherwise slots are emitted as first-class children IN POSITION,
  // preserving sibling order, multiple slots per parent, and slot attrs.
  if (isCollapsibleSoleSlot(n)) {
    out.slot = n.children[0].attrs?.name ?? '';
    if (Object.keys(a).length) out.attrs = a;
    return out;
  }
  const kids = [];
  for (const c of n.children ?? []) kids.push(htmlNodeToAnatomy(c));
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
    //
    // A `data-*` name gets ONE space too. The 2-space rule assumes the author is
    // padding a description column, but a name long enough to fill that column
    // leaves only a single space — `data-icon-start` did, so it folded into the
    // `data-label` line above it and vanished from the props list entirely.
    // A `data-` prefix is unambiguous enough to start an entry on its own.
    const trimmed = raw.trim();
    const nameHead = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)(\s{2,}|\s*[—-]\s|\s*$)/;
    const dataHead = /^(data-[\w-]+(?:\s*\/\s*data-[\w-]+)*)\s+\S/;
    const looksEntry = nameHead.test(trimmed) || dataHead.test(trimmed);
    if (!looksEntry && entries.length) { entries[entries.length - 1] += ' ' + trimmed; continue; }
    entries.push(trimmed);
  }

  for (const entry of entries) {
    // split name(s) column from the description column: 2+ spaces, an em-dash, or
    // a single-space before "native"/"—".
    let mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)\s{2,}(.*)$/.exec(entry);
    // A long `data-*` name leaves only ONE space before its description — split on
    // that too, matching the single-space entry rule above.
    //
    // This MUST come before the dash rule below. `[\w-]*` is greedy but the regex
    // engine backtracks to let `[—-]` match, so `data-icon-start leading icon`
    // split at the hyphen and yielded the name `data-icon`. Consuming the whole
    // hyphenated name first removes the chance to backtrack into it.
    if (!mm) mm = /^(data-[\w-]+(?:\s*\/\s*data-[\w-]+)*)\s+(.*)$/.exec(entry);
    if (!mm) mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)\s*[—-]\s*(.*)$/.exec(entry);
    // A names-only entry, single or slashed, whose description wrapped onto the
    // next line and folded in behind a single space. `name / disabled / required`
    // matched none of the rules above — no 2-space column, no `data-` prefix, no
    // dash — so three real native attributes were dropped from both select
    // controls without a word. Take the leading slash list, keep the rest as the
    // description.
    if (!mm) mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)+)(?:\s+(.*))?$/.exec(entry);
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

/**
 * A value expression → a type name, or `unknown`.
 *
 * DELIBERATELY TIMID. Only the shapes that cannot be anything else are named:
 * a literal, a `??` fallback whose right side is a literal, a `!` / comparison,
 * an array literal. Everything else — a bare identifier, a call, a property
 * read — is `unknown`, because inferring it properly needs the type checker,
 * and a WRONG type in a contract is worse than an honest gap. A caller who
 * reads `unknown` looks; a caller who reads `string` and gets a number does not.
 */
function typeOfExpr(raw) {
  const e = (raw ?? '').trim().replace(/\/\/.*$/gm, '').trim();
  if (!e) return 'unknown';
  if (/^(true|false)$/.test(e) || /^!/.test(e) || /[=!<>]==?|\b(?:&&|\|\|)\s*(?:true|false)\b/.test(e)) return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(e)) return 'number';
  if (/^['"`]/.test(e)) return 'string';
  if (/^\[/.test(e)) return 'array';
  // `x ?? ''` and `x ?? 0` state their own fallback type, which is the only
  // type the field can take when the left side is absent.
  const fallback = /\?\?\s*(.+)$/.exec(e);
  if (fallback) {
    const t = typeOfExpr(fallback[1]);
    if (t !== 'unknown') return t;
  }
  return 'unknown';
}

/**
 * What each event actually CARRIES — read from the `emit()` call sites.
 *
 * A spec used to declare that an event exists and nothing about its payload,
 * even though `schemas/component.v1.json` has had a `detail` field all along.
 * That is how three different `values` shapes hid behind one
 * `quick-filter-change`: a bare `string[]` from a chip, a
 * `Record<id, string[]>` from the bar, and `[]` beside an `id` from an overflow
 * toggle. A host read one as another and emptied the grid on every sort.
 *
 * The detail is the half of an event contract a caller actually codes against.
 *
 * TOP-LEVEL KEYS ONLY, and the brace walk is why: `{ index, detail: { a, b } }`
 * declares `index` and `detail`, not `a` and `b`. A regex over the whole body
 * would have flattened nested shapes into a lie.
 *
 * An event emitted MORE THAN ONCE with different keys reports the UNION, which
 * is honest — the payload really does vary — and the variance is visible rather
 * than hidden behind whichever call site was read last.
 */
function emitDetails(ts) {
  const out = new Map();
  if (!ts) return out;

  for (const m of ts.matchAll(/\bemit\(\s*['"`]([a-z][\w-]*)['"`]\s*,\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0, close = -1;
    for (let i = open; i < ts.length; i++) {
      if (ts[i] === '{') depth++;
      else if (ts[i] === '}') { depth--; if (depth === 0) { close = i; break; } }
    }
    if (close < 0) continue;

    const keys = new Map();
    let d = 0, token = '', pendingKey = '';
    const shorthand = new Map();
    const flush = () => {
      if (pendingKey) keys.set(pendingKey, typeOfExpr(token));
      else {
        // No colon was seen for this entry, so the whole token is the key —
        // `{ values }`. Anything with an operator in it is an expression that
        // happened to sit between two commas, not a shorthand property.
        const t = token.replace(/\/\/.*$/gm, '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(t)) shorthand.set(t, 'unknown');
      }
      pendingKey = '';
      token = '';
    };
    for (const ch of ts.slice(open + 1, close)) {
      if ('{[('.includes(ch)) d++;
      else if ('}])'.includes(ch)) d--;
      if (d === 0 && ch === ',') { flush(); continue; }
      if (d === 0) token += ch;
      if (d === 0 && ch === ':' && !pendingKey) {
        // The key is whatever sits on the last line before the colon, so a
        // comment on the lines above cannot be mistaken for one.
        const k = token.slice(0, -1).split('\n').pop().trim();
        if (/^[A-Za-z_$][\w$]*$/.test(k)) pendingKey = k;
        token = '';
        continue;
      }
    }
    flush();
    /* Shorthand — `{ values }` carries no colon for the walk above to find, and
       gives no expression to read a type from.

       THE WALK HANDLES IT, not a comma split over the raw body. A split found
       `held` inside `clause: held ? … : null` — the fragment between two commas
       there IS a bare identifier — and wrote a payload field that does not
       exist. The walk already knows the difference between a key and the middle
       of an expression, so shorthand is collected the same way. */
    for (const [k, t] of shorthand) if (!keys.has(k)) keys.set(k, t);

    const prev = out.get(m[1]) ?? new Map();
    for (const [k, t] of keys) {
      // A field emitted twice with different inferences is `unknown`: the
      // payload really does vary, and claiming one of the two would be a guess.
      prev.set(k, prev.has(k) && prev.get(k) !== t ? 'unknown' : t);
    }
    out.set(m[1], prev);
  }
  return out;
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
/**
 * Every event the TypeScript actually dispatches.
 *
 * THE GROUND TRUTH, and the reason this exists: the `Fires:` comment is PROSE,
 * and prose was being scraped for identifiers. `@fires nothing — it is a layout
 * surface` produced an event called `nothing` in 14 specs; a sentence about a
 * column filter produced `since`, `means`, `from` and `to` in the data grid's.
 * 31 of 58 specs claimed at least one event their component never emits.
 *
 * Reads the three ways a Sherpa component can dispatch: the base class's
 * `emit()`, a hand-built `CustomEvent`, and a re-dispatched native `Event`.
 */
function emittedEvents(ts) {
  const out = new Set();
  if (!ts) return out;
  const patterns = [
    /\bemit\(\s*['"`]([a-z][\w-]*)['"`]/g,
    /new CustomEvent\(\s*['"`]([a-z][\w-]*)['"`]/g,
    /new Event\(\s*['"`]([a-z][\w-]*)['"`]/g,
  ];
  for (const re of patterns) {
    for (const m of ts.matchAll(re)) out.add(m[1]);
  }
  return out;
}

function collectEventNames(text, set) {
  // strip `(detail: …)` tails, then take the leading identifier of each fragment
  const cleaned = text.replace(/\(detail[^)]*\)/gi, '').replace(/\(re-dispatched[^)]*\)/gi, '');
  for (const frag of cleaned.split(/[,\n]/)) {
    const mm = /^\s*([a-z][\w-]*)/.exec(frag.replace(/^[—-]\s*/, '').trim());
    if (mm && mm[1] && mm[1] !== 'detail') set.add(mm[1]);
  }
}

// authored-CSS reading (authoredCss / extractBindings / parseStates) now lives in
// ./lib/css-reader.mjs — a shared PostCSS reader used by roundtrip-component.mjs too.

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

/**
 * PUBLIC METHODS — what a caller can DO to a component.
 *
 * The specs recorded attributes, events, slots, tokens and accessors, and no
 * methods at all. That was tolerable while a component's whole surface was its
 * attributes; it is not any more.
 *
 * A VIEW DEFINITION can set exactly what a component exposes, so the set of
 * public methods IS the set of things a saved view, a preset or an agent can
 * configure. The MCP serves these specs — an agent asking "what can I set on a
 * data grid?" was getting an answer that left out setColumnFilter, select and
 * every other verb the parity work added.
 *
 * WHAT COUNTS as public, and why each exclusion:
 *   - `#name`        private by construction
 *   - lifecycle      onRender / onConnect / onChange / onDisconnect / renderData
 *                    are the base class's contract with the SUBCLASS, not with a
 *                    caller
 *   - `get` / `set`  already recorded as jsProps, with their access
 *   - `static`       not reachable from an element
 *
 * The leading JSDoc line becomes the description, so the spec says what a method
 * is FOR rather than only that it exists.
 */
const LIFECYCLE = new Set([
  'onRender', 'onConnect', 'onDisconnect', 'onChange', 'renderData', 'constructor',
  'connectedCallback', 'disconnectedCallback', 'attributeChangedCallback', 'adoptedCallback',
]);

function parseTsMethods(ts) {
  const out = [];
  // A method at CLASS BODY indentation (two spaces), optionally `override` or
  // `async`, not preceded by get/set/static. The two-space anchor is what keeps
  // nested functions and object literals out.
  const re = /\n {2}(?:override\s+)?(?:async\s+)?([a-z][\w$]*)\s*\(([^)]*)\)\s*:/g;
  for (const m of ts.matchAll(re)) {
    const [, name, args] = m;
    if (LIFECYCLE.has(name)) continue;
    if (out.some((x) => x.name === name)) continue;

    // The JSDoc block immediately above, if there is one — its first prose line
    // is the summary, which is what a reader (or an agent) actually needs.
    //
    // `m.index` points at the leading NEWLINE of the match, so the slice ends
    // mid-line and a `$`-anchored search would never find the closing `*​/`.
    // Take the LAST block and check it really is adjacent — otherwise every
    // method inherited the file header, which is worse than no description.
    const before = ts.slice(0, m.index + 1);
    const lastClose = before.lastIndexOf('*/');
    const doc = lastClose >= 0 && before.slice(lastClose + 2).trim() === ''
      ? /\/\*\*([\s\S]*)$/.exec(before.slice(before.lastIndexOf('/**', lastClose), lastClose))
      : null;
    let description = '';
    if (doc) {
      const line = doc[1]
        .split('\n')
        .map((l) => l.replace(/^\s*\*ledge?/, '').replace(/^\s*\*\s?/, '').trim())
        .find((l) => l && !l.startsWith('@'));
      if (line) description = line;
    }

    out.push({
      $type: 'method',
      name,
      // The signature as written, so a caller knows the argument ORDER — which
      // is what a view definition's `state` block encodes.
      args: args.replace(/\s+/g, ' ').trim(),
      ...(description ? { description } : {}),
    });
  }
  return out;
}


// ══ the generator ════════════════════════════════════════════════════════════════
/**
 * The `static override observed` list, as names.
 *
 * COMMENTS ARE STRIPPED FIRST. This used to be a bare `split(',')`, so a
 * component that explained an entry inline —
 *
 *   static override observed = [
 *     'data-select',
 *     // SINGLE vs multiple changes the CONTROL each row draws.
 *     'data-filter-fields',
 *   ];
 *
 * — produced observed names like "// SINGLE vs multiple changes the CONTROL
 * each row draws" and failed its own round-trip. The spec then looked "flaky"
 * when the only thing that had changed was a comment.
 *
 * Comments in this array are not unusual: `observed` is where a component says
 * WHY an attribute is reactive, which is exactly the kind of thing worth
 * writing down next to it.
 */
function parseObserved(ts) {
  const src = ts ?? '';
  const m = /static override observed\s*=\s*\[([\s\S]*?)\]/.exec(src);
  if (!m) return [];
  const out = [];
  for (const raw of m[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/[^\n]*/g, '')           // line comments
    .split(',')) {
    const tok = raw.trim().replace(/^['"]|['"]$/g, '');
    if (!tok) continue;
    /* `...MIRRORED` spreads a const array declared above — the select controls
       share one list of native attributes they copy onto the inner <input>.
       Read as a literal it became an attribute called `...MIRRORED`, so both
       components failed the round-trip for ever. Expand it from the file. */
    const spread = /^\.\.\.\s*([A-Za-z_$][\w$]*)$/.exec(tok);
    if (spread) {
      out.push(...expandArrayConst(src, spread[1]));
      continue;
    }
    out.push(tok);
  }
  return out;
}

/**
 * Read a module-level `const NAME = ['a', 'b'] as const;` back into its strings.
 *
 * Returns `[]` when the name is not a plain array of literals here — an import,
 * a computed value, a call. An honest gap beats a guessed one, the same ruling
 * that leaves an un-inferable event detail as `unknown`.
 */
function expandArrayConst(src, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`);
  const m = re.exec(src);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^(['"]).*\1$/.test(x))
    .map((x) => x.slice(1, -1));
}

function generateSpec(name) {
  const dir = join(C, name);
  const notes = [];
  const html = readIf(join(dir, `${name}.html`));
  const css = readIf(join(dir, `${name}.css`));
  const ts = readIf(join(dir, `${name}.ts`));
  // The Figma binding (figmaName/category/variantAxes/booleanProps/divergence)
  // cannot be read from code — it is PRESERVED from the existing spec on regen.
  const existingRaw = readIf(join(dir, `${name}.component.yaml`));
  const existing = existingRaw ? (yaml.load(existingRaw) ?? {}) : {};
  const priorExt = (existing.$extensions && existing.$extensions.sherpa) || {};
  if (!existingRaw) notes.push('no existing component.yaml — $extensions.sherpa (figmaName/category/…) minimal; re-run resync-figma to populate');
  if (!html) notes.push('no HTML (cannot derive anatomy/props/events — round-trip will fail)');
  if (!css) notes.push('no CSS (no token bindings)');
  if (!ts) notes.push('no TS (no jsProps)');

  // TS `observed` list is the GROUND TRUTH for which data-* props are reactive.
  // compileDef derives observed from props with kind !== 'style', so a prop the TS
  // observes must NOT be kind:style in the spec (else the round-trip observed list
  // mismatches). A prior spec's stale kind loses to the TS `observed` list.
  const tsObserved = parseObserved(ts);

  const comment = html ? htmlComment(html) : '';
  const apiProps = comment ? parsePublicApi(comment) : {};
  if (html && !comment) notes.push('HTML has no leading comment (no Public API block)');
  if (html && comment && !/Public API/i.test(comment)) notes.push('HTML comment lacks a `Public API:` block — no enum values parseable');

  const templatesObj = html ? parseTemplates(html) : {};
  const templateIds = Object.keys(templatesObj);
  const defaultTree = templatesObj['default'];

  // ── $description ──────────────────────────────────────────────────────────────
  // Carry the existing spec's $description forward (it's the curated value, seeded
  // from thin.yaml before retirement); fall back to the HTML comment header, then a
  // stub. Preserving it keeps specs stable across regen.
  const description = existing.$description || commentDescription(comment, name) || `the ${name.replace('sherpa-', '')} component.`;

  // ── anatomy + templates ───────────────────────────────────────────────────────
  let anatomy = null;
  if (defaultTree && defaultTree.length) {
    /* The root element(s). A top-level `<slot>` is kept — it is real markup, not
       stray: `sherpa-loader`'s template is a spinner `<div>` beside a
       `<slot name="label" class="label">`, and dropping the slot left ONE root,
       so the second node disappeared from the spec and the round-trip reported a
       node "present on one side only" for ever. Only genuinely empty nodes are
       skipped. */
    const roots = defaultTree.filter((n) => n.tag);
    if (roots.length === 1) anatomy = { root: htmlNodeToAnatomy(roots[0]) };
    else if (roots.length > 1) {
      // Multi-root <template>: emit the ordered list of sibling root node trees.
      // compileDef renders each in order (byte-identical to the real markup).
      anatomy = { roots: roots.map((r) => htmlNodeToAnatomy(r)) };
    }

    /* Multi-template union. compileDef renders ONE anatomy per template, filtered
       by `showWhen`, so an extra template can only ADD or REMOVE a node against
       the default tree. Where that is enough — the template is an ADDITIVE
       superset — fold the extras in with `showWhen` and keep the compact single
       tree, which is byte-stable for every component that has always passed.

       Where it is NOT enough, fall back to `byTemplate`: one entry per template,
       each with its own roots. `showWhen` cannot express a changed TAG, CLASS or
       PART, and three components need exactly that — input-text swaps `<input>`
       for `<textarea>`, nav-item's `promo` renames every class, button's `icon`
       drops four of five children. They were reported as permanent gaps and
       failed the round-trip for ever; the honest answer is to record both trees
       rather than to pretend one covers both. */
    const extraIds = templateIds.filter((t) => t !== 'default');
    const needsByTemplate = [];
    if (anatomy && roots.length === 1) {
      for (const tid of extraIds) {
        const otherRoots = (templatesObj[tid] || []).filter((n) => n.tag);
        if (otherRoots.length !== 1) { needsByTemplate.push(tid); continue; }
        const merged = mergeShowWhen(anatomy.root, htmlNodeToAnatomy(otherRoots[0]), tid);
        if (merged.additive) anatomy.root = merged.node;
        else needsByTemplate.push(tid);
      }
    } else if (anatomy && anatomy.roots) {
      // A multi-root default cannot run the showWhen union at all (it aligns one
      // tree against one tree), so every extra template needs its own entry.
      needsByTemplate.push(...extraIds);
    }
    if (anatomy && needsByTemplate.length) {
      /* Any template that needs its own tree forces the WHOLE anatomy into
         `byTemplate` — the three forms are mutually exclusive, and a half-merged
         anatomy (a `root` carrying showWhen for one template plus a map for
         another) would have two sources of truth for the same template. Start
         from the default's roots BEFORE any showWhen folding, so a template that
         did merge is still emitted from its own markup. */
      const byTemplate = {};
      for (const tid of templateIds) {
        const tRoots = (templatesObj[tid] || []).filter((n) => n.tag);
        if (tRoots.length) byTemplate[tid] = tRoots.map((r) => htmlNodeToAnatomy(r));
      }
      if (!byTemplate['default']) byTemplate['default'] = roots.map((r) => htmlNodeToAnatomy(r));
      anatomy = { byTemplate };
      notes.push(`anatomy uses byTemplate — template(s) ${needsByTemplate.join(', ')} are divergent trees, not additive supersets of default`);
    }
  } else if (html) {
    notes.push('no <template id="default"> — cannot derive anatomy');
  }

  // ── props: from the Public API comment ────────────────────────────────────────
  // Carry the prior spec's props (keyed by name) so a hand-added `kind`/`description`
  // survives regen when the code can't re-derive it. The comment + TS still win for
  // type/values/default/observed-kind.
  const priorProps = {};
  for (const p of (existing.props ?? [])) if (p && p.name) priorProps[p.name] = p;
  // Union the Public-API comment's props with any props the prior spec carried —
  // some props (e.g. grid-cell data-type, nav-item data-description) live in the
  // spec but not in the HTML comment; carrying them keeps the spec stable.
  /* …but a carried prop must still EXIST somewhere in the source. The union
     alone means a RENAMED attribute lingers for ever: `data-variant` became
     `data-type` in three charts and the old name stayed in every spec, because
     nothing ever drops a name the prior spec knew. Same shape as the phantom
     events — a spec that can only grow.

     "Mentioned anywhere" is deliberately loose: a prop can be read in the TS,
     selected in the CSS, or written in the HTML, and any of those is proof it
     is real. What it cannot be is present in NONE of them. */
  const sourceText = `${ts ?? ''}\n${css ?? ''}\n${html ?? ''}`;
  /* USED, not merely MENTIONED. A bare substring search keeps a prop alive on
     the strength of a COMMENT — removing `data-variant` from sherpa-container
     and explaining why in a comment left the dead prop in its spec, because the
     explanation contains the name. So look for the three ways an attribute is
     really used: selected in CSS (`[data-x`), written in HTML (`data-x=`), or
     read in TS (`dataset['x']` / `dataset.x`, its camelCase spelling).

     A DOUBLE-quoted match is not proof. `"stretch"` is the VALUE in
     `:host([data-align="stretch"])` and `"scale"` is the VALUE in
     `class="scale"` — both read as "used" under a bare substring test, which is
     how two prose fragments became props. Single quotes are kept because that is
     how TypeScript spells an attribute NAME (`'value-start'` in an `observed`
     list); CSS and HTML use double quotes for values, so the two spellings
     separate name from value on their own. */
  const attrInUse = (nm) => {
    const camel = nm.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return sourceText.includes(`[${nm}`)          // CSS selector
      || sourceText.includes(`${nm}=`)            // HTML attribute
      || sourceText.includes(`'${nm}'`)           // getAttribute / observed list
      || sourceText.includes(`dataset['${camel}']`)
      || sourceText.includes(`dataset.${camel}`);
  };
  /* The SAME check on props the COMMENT produced, and it has to run FIRST.
     `Public API:` is prose, and a wrapped sentence whose first word is followed
     by an em-dash reads exactly like an entry — `stretch — ONE wide control
     fills the row` is the tail of `data-align`'s description, and `scale — it is
     a TICK` is the tail of `data-label`'s. Both became props. A `data-*` name is
     unambiguous enough to stand on its own; a bare lowercase word has to be
     found in the code, which is the rule the events already follow: the comment
     may describe what the source does, never invent it.

     ORDER MATTERS. The carried-prop sweep below spares anything still present in
     `apiProps`, so dropping a phantom afterwards leaves the prior spec's copy of
     it alive and the phantom survives regeneration for ever. */
  for (const nm of Object.keys(apiProps)) {
    if (nm.startsWith('data-') || attrInUse(nm)) continue;
    delete apiProps[nm];
    notes.push(`dropped prose prop "${nm}" — read from the Public API comment, but the source never uses it as an attribute`);
  }
  const carriedButGone = Object.keys(priorProps).filter(
    (nm) => !(nm in apiProps) && !attrInUse(nm),
  );
  for (const nm of carriedButGone) {
    delete priorProps[nm];
    notes.push(`dropped stale prop "${nm}" — the prior spec carried it, the source does not mention it`);
  }
  const propNames = new Set([...Object.keys(apiProps), ...Object.keys(priorProps)]);
  const props = [];
  for (const nm of propNames) {
    const fromApi = apiProps[nm] || {};
    const fromPrior = priorProps[nm] || {};
    const p = { $type: 'prop', name: nm };
    // type: comment wins (it carries enum/boolean signal), else prior spec, else string
    p.type = fromApi.type || fromPrior.type || 'string';
    // kind (variant mechanism): the prior spec supplies it, but the TS `observed`
    // list OVERRIDES — a prop the component observes cannot be kind:style, and a
    // data-* prop the component does NOT observe must be kind:style (unobserved).
    // This keeps the round-trip observed list exact.
    let kind = fromPrior.kind;
    const native = fromApi.native === true || (!nm.startsWith('data-') && NATIVE_ATTRS.has(nm));
    // The TS `observed` list is authoritative for round-trip: compileDef derives
    // observed from props whose kind !== 'style'. So a data-* prop the component
    // does NOT observe must be kind:style (even if the prior spec tags it
    // visibility/template — many are handled via CSS/templateId, not observation).
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
      else if (fromPrior.values && fromPrior.values.length) p.values = fromPrior.values;
      else { p.values = []; notes.push(`prop ${nm}: enum with NO parseable values (Public API comment lacks them) — NEEDS HAND-FINISHING`); }
    }
    const def = fromApi.default !== undefined ? fromApi.default : fromPrior.default;
    if (def !== undefined && def !== null) p.default = def;
    else if (native && p.type === 'boolean') p.default = false;
    const desc = fromApi.description || fromPrior.description;
    if (desc) p.description = desc;
    props.push(p);
  }
  // stable order: data-* first (alpha), then native
  props.sort((a, b) => {
    const an = a.native ? 1 : 0, bn = b.native ? 1 : 0;
    return an - bn || a.name.localeCompare(b.name);
  });

  // ── events: driven by the code's `Fires:` list (ground truth) ────────────────
  // The HTML `Fires:` comment (kept in sync with the TS @fires / emit() strings) is
  // the AUTHORITATIVE set of event names. The prior spec only supplies the `trigger`
  // block (on/node) that can't be read from the comment — it must NOT introduce or
  // keep event names, or renamed/removed events would linger forever (stale-event bug).
  const priorEvents = {};
  for (const e of (existing.events ?? [])) if (e && e.name) priorEvents[e.name] = e;
  /* THE CODE DECIDES, the comment only describes.
     `Fires:` is authored prose, so a word in it is not evidence of an event —
     `@fires nothing`, and half a sentence about a column filter, put 60-odd
     phantom events into these specs. Intersecting with what the TS actually
     dispatches keeps the comment useful (it still chooses WHICH of the emitted
     events are public) while making it unable to invent one.

     A component that emits nothing gets no `events:` key at all, rather than a
     key holding a sentinel — which is how `nothing` read as an event name. */
  const emitted = emittedEvents(ts);
  const firesNames = comment ? parseFires(comment) : [];
  const eventNames = new Set(firesNames.filter((n) => emitted.has(n)));
  /* An event the code emits but the comment forgot is still part of the
     contract — a caller can listen for it. Silence in a comment is an
     oversight, not a decision to make something private. */
  for (const n of emitted) eventNames.add(n);
  const details = emitDetails(ts);
  const events = [];
  for (const en of eventNames) {
    const ev = { $type: 'event', name: en, bubbles: true, composed: true };
    /* WHAT IT CARRIES. `unknown` for every field rather than a guessed type:
       the emit site gives a NAME reliably and a type only by inference, and a
       wrong type in a contract is worse than an honest "there is a field here".
       The schema takes `field -> type name`, so the names are the half that is
       always true. */
    const keys = details.get(en);
    if (keys?.size) {
      ev.detail = Object.fromEntries([...keys].sort(([a], [b]) => a.localeCompare(b)));
    }
    const trig = priorEvents[en]?.trigger;
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
    for (const { el, prop, sherpaVar } of extractBindings(authoredCss(css))) {
      tokens[`${el}.${prop}`] = varToRef(sherpaVar, name, generateSpec._tokens);
    }
  }

  // ── element ───────────────────────────────────────────────────────────────────
  let element = null;
  // For a multi-root <template> the "element the component IS" is taken from the
  // FIRST root node (best-effort — the component has no single interactive root).
  // A `byTemplate` anatomy takes it from the DEFAULT template's first root: the
  // element a component is does not change with which template is showing, and
  // reading only `root`/`roots` dropped the whole `element:` block (with its
  // native provides — keyboard, focus, click) from all three such components.
  const primaryRoot = anatomy?.root
    ?? anatomy?.roots?.[0]
    ?? anatomy?.byTemplate?.['default']?.[0];
  const rootEl = primaryRoot?.el;
  if (rootEl) {
    const em = generateSpec._elementMap[rootEl] || {};
    element = { $type: 'element', tag: rootEl };
    if (primaryRoot.attrs && Object.keys(primaryRoot.attrs).length) element.attributes = primaryRoot.attrs;
    element.provides = Array.isArray(em.provides) ? em.provides : [];
    if (em.stateCss) element.stateCss = em.stateCss;
    if (!Array.isArray(em.provides)) notes.push(`root element <${rootEl}> not a known semantic element in element-map — provides left empty`);
  }

  // ── states (best-effort) ──────────────────────────────────────────────────────
  const states = css ? parseStates(authoredCss(css)).map((s) => ({ $type: 'state', ...s })) : [];

  // ── capabilities + jsProps (best-effort) ──────────────────────────────────────
  const jsProps = ts ? parseTsJsProps(ts) : [];
  const methods = ts ? parseTsMethods(ts) : [];
  const capabilities = [];
  if (jsProps.length) {
    capabilities.push({
      $type: 'capability',
      api: 'js-property-mirror',
      description: `read/write JS properties (${jsProps.map((j) => j.name).join(', ')}). See $extensions.sherpa.jsProps.`,
    });
  }
  if (methods.length) {
    // A capability, not just a list, because this is what a VIEW DEFINITION can
    // set: the methods are the vocabulary a saved view, a preset or an agent
    // may use on this component.
    capabilities.push({
      $type: 'capability',
      api: 'js-methods',
      description: `callable from a view definition's state block (${methods.map((m) => m.name).join(', ')}). See $extensions.sherpa.methods.`,
    });
  }

  // ── $extensions.sherpa ────────────────────────────────────────────────────────
  // The Figma binding cannot be read from code — carry it VERBATIM from the prior
  // spec (figmaName/figmaNodeId/category/variantAxes/booleanProps/composes/
  // _divergence). resync-figma.mjs
  // owns keeping it aligned with live Figma. Only jsProps are re-derived (from TS).
  const sherpaExt = {};
  if (priorExt.figmaName) sherpaExt.figmaName = priorExt.figmaName;
  // Re-derived from the TS, like jsProps — never carried from the prior spec, so
  // a removed method disappears rather than lingering as a promise the code no
  // longer keeps.
  if (methods.length) sherpaExt.methods = methods;
  // The node ID is what makes a binding CHECKABLE — a name can be duplicated or
  // renamed, an id addresses one node. It was silently dropped on every regen
  // because it was not on this list, so all 54 specs name a Figma component
  // that nothing can look up.
  if (priorExt.figmaNodeId) sherpaExt.figmaNodeId = priorExt.figmaNodeId;
  if (priorExt.category) sherpaExt.category = priorExt.category;
  if (Array.isArray(priorExt.variantAxes) && priorExt.variantAxes.length) {
    sherpaExt.variantAxes = priorExt.variantAxes.map((a) => ({ name: a.name, ...(a.values ? { values: a.values } : {}) }));
  }
  if (Array.isArray(priorExt.booleanProps) && priorExt.booleanProps.length) sherpaExt.booleanProps = priorExt.booleanProps;
  // Which OTHER components this one instances, mirroring the Figma node's own
  // instance children — the record that a thing is composed rather than redrawn.
  if (Array.isArray(priorExt.composes) && priorExt.composes.length) sherpaExt.composes = priorExt.composes;
  // BOTH spellings. The ratified key is `_divergence` (the leading underscore
  // marks it as a note rather than a binding, and is what the components that
  // carry one actually write); `divergence` is kept for the older specs.
  if (priorExt.divergence) sherpaExt.divergence = priorExt.divergence;
  if (priorExt._divergence) sherpaExt._divergence = priorExt._divergence;
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
# Derived from ${spec.$name}.{html,css,ts}. The MECHANICAL surface only — props
# (with enum values), anatomy, events, token bindings, element, best-effort
# states/capabilities. Richer state/capability PROSE is left for hand-finishing.
# The Figma binding under $extensions.sherpa is preserved verbatim across regen
# (owned by resync-figma.mjs). Validated by schemas/component.v1.json; round-trips
# via roundtrip-component.mjs.
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
  const gen = bindingsMap(extractBindings(genCss));
  const real = bindingsMap(extractBindings(realAuthored));
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
    observed: parseObserved(ts).sort(),
  });
  const g = fact(genTs), r = fact(realTs);
  for (const k of ['class', 'define']) if (g[k] !== r[k]) diffs.push(`TS ${k}: "${g[k]}"≠"${r[k]}"`);
  if (JSON.stringify(g.observed) !== JSON.stringify(r.observed)) diffs.push(`TS observed: [${g.observed}]≠[${r.observed}]`);
}

// ══ CLI ═════════════════════════════════════════════════════════════════════════
function allComponentNames() {
  return readdirSync(C).filter((n) => n.startsWith('sherpa-') && existsSync(join(C, n, `${n}.html`)));
}
function run() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const all = args.includes('--all');
  const names = all ? readdirSync(C).filter((n) => n.startsWith('sherpa-') && (existsSync(join(C, n, `${n}.html`)) || existsSync(join(C, n, `${n}.component.yaml`))))
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
