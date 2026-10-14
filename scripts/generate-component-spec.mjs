#!/usr/bin/env node
/**
 * generate-component-spec.mjs — a component's `.component.json`, from its source.
 *
 * Reads its own HTML + CSS + TS + element-map and emits the mechanical surface
 * (props, anatomy, events, token bindings, element, best-effort states and
 * capabilities); richer prose is hand-finished.
 *
 *   node scripts/generate-component-spec.mjs sherpa-switch      # write next to component
 *   node scripts/generate-component-spec.mjs --all              # write every component
 *   node scripts/generate-component-spec.mjs --check sherpa-switch   # validate, round-trip, fresh
 *   node scripts/generate-component-spec.mjs --all --check [--staged]   # the gate
 *
 * Never modifies a component source. The Figma binding in `$extensions.sherpa`
 * (figmaName, figmaNodeId, category, variantAxes, booleanProps, divergence)
 * cannot be read from code and is preserved verbatim from the existing spec on
 * regen; resync-figma.mjs owns keeping it aligned with Figma.
 *
 * Map:
 * - generateSpec — one component's spec, built from its source; notes what it could not read
 * - toJson — a spec as the exact JSON text written to disk, so a fresh check can compare
 * - loadTokens — the Figma token export the bindings resolve against, or null
 * - loadElementMap — which element each Figma node maps to
 */
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import { specToDef } from './lib/component-to-def.mjs';
import { compileDef } from './lib/generation/compile-def.mjs';
import { authoredCss, extractBindings, parseStates } from './lib/css-reader.mjs';
import { parseTemplates, htmlDiff } from './lib/html-structure.mjs';
import { parseClassApi, parseEmits, parseObserved, parsePopulate, parsePropDecls } from './lib/ts-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');
const SCHEMA_PATH = join(ROOT, 'schemas', 'component.v1.json');
const TOKENS_PATH = join(ROOT, 'src', 'styles', 'tokens', 'figma.tokens.json');
const ELEMENT_MAP_PATH = join(ROOT, 'scripts', 'figma-data', 'element-map.yaml');

const NATIVE_ATTRS = new Set([
  'disabled', 'name', 'value', 'required', 'readonly', 'placeholder',
  'checked', 'min', 'max', 'step', 'minlength', 'maxlength', 'pattern',
  'multiple', 'href', 'target', 'type', 'rows', 'cols', 'autocomplete',
  // `indeterminate` has no content attribute but the select controls observe it
  // as one; a name missing here drops out of the generated observed list.
  'indeterminate', 'open', 'hidden', 'selected', 'inputmode',
]);

// ══ file loading ═══════════════════════════════════════════════════════════════
function readIf(p) { return existsSync(p) ? readFileSync(p, 'utf8') : null; }
function loadTokens() { try { return JSON.parse(readFileSync(TOKENS_PATH, 'utf8')); } catch { return null; } }
function loadElementMap() {
  try { return yaml.load(readFileSync(ELEMENT_MAP_PATH, 'utf8'))?.elements ?? {}; }
  catch { return {}; }
}

/** Build a bare <slot> child node { slot, attrs?, children? }. `name` becomes
 *  `slot`; other attrs (data-accepts) and fallback content are kept, so name,
 *  attrs and position all round-trip. */
function slotChildNode(n) {
  const a = { ...n.attrs };
  const out = { slot: a.name ?? '' };
  delete a.name;
  if (Object.keys(a).length) out.attrs = a;
  const kids = (n.children ?? []).map((c) => htmlNodeToAnatomy(c));
  if (kids.length) out.children = kids;
  return out;
}
/** True when a <slot> can collapse onto its parent as `parent.slot` (the legacy
 *  inline form): sole child, no attrs beyond `name`, no fallback content. */
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
/** One parsed HTML node → the anatomy node shape. */
function htmlNodeToAnatomy(n) {
  const a = { ...n.attrs };
  const out = {};
  if (n.tag === 'slot') return slotChildNode(n);
  out.el = n.tag;
  if (a.class) out.class = a.class;
  if (a.part) out.part = a.part;
  delete a.class; delete a.part;
  // Otherwise slots stay first-class children in position, preserving order.
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
/** Merge template `other` onto the default tree `base`, marking other-only
 *  trailing children `showWhen: tid`. additive:false when it is not a superset. */
function mergeShowWhen(base, other, tid) {
  if (nodeKey(base) !== nodeKey(other)) return { additive: false };
  const bc = base.children ?? [], oc = other.children ?? [];
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
/** The `sherpa-x — …` header's whole first paragraph, on one line. */
function commentDescription(comment, name) {
  const lines = comment.split('\n').map((l) => l.trim());
  const at = lines.findIndex((l) => new RegExp(`^${name}\\s*[—-]\\s*\\S`).test(l));
  if (at < 0) return '';
  const end = lines.findIndex((l, i) => i > at && !l);
  return lines.slice(at, end < 0 ? undefined : end).join(' ')
    .replace(new RegExp(`^${name}\\s*[—-]\\s*`), '').replace(/\s+/g, ' ').trim();
}

/** Parse the `Public API:` block → attrName → { type, values?, default?, native? }. */
function parsePublicApi(comment) {
  const props = {};
  const lines = comment.split('\n');
  // the indented block after the label, until a blank line + a new label, or end
  let start = -1, indent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)Public API[^:]*:/i.exec(lines[i]);
    if (m) { start = i + 1; indent = m[1].length; break; }
  }
  if (start === -1) return props;

  // Wrapped continuation lines fold into the previous entry.
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
    // An entry starts with an attr name then 2+ spaces, a dash, or end-of-line.
    // A `data-*` name needs only ONE space: a long name fills the description
    // column, and requiring two folded `data-icon-start` into the line above it.
    const trimmed = raw.trim();
    const nameHead = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)(\s{2,}|\s*[—-]\s|\s*$)/;
    const dataHead = /^(data-[\w-]+(?:\s*\/\s*data-[\w-]+)*)\s+\S/;
    const looksEntry = nameHead.test(trimmed) || dataHead.test(trimmed);
    if (!looksEntry && entries.length) { entries[entries.length - 1] += ' ' + trimmed; continue; }
    entries.push(trimmed);
  }

  for (const entry of entries) {
    // split the name column from the description column
    let mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)\s{2,}(.*)$/.exec(entry);
    // MUST precede the dash rule: the engine backtracks into a hyphenated name,
    // so `data-icon-start leading icon` otherwise splits as `data-icon`.
    if (!mm) mm = /^(data-[\w-]+(?:\s*\/\s*data-[\w-]+)*)\s+(.*)$/.exec(entry);
    if (!mm) mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)*)\s*[—-]\s*(.*)$/.exec(entry);
    // A slash list whose description wrapped onto the next line — `name /
    // disabled / required` matches none of the rules above.
    if (!mm) mm = /^([a-z][\w-]*(?:\s*\/\s*[a-z][\w-]*)+)(?:\s+(.*))?$/.exec(entry);
    if (!mm) mm = /^([a-z][\w-]*)\s*$/.exec(entry) ? [entry, entry.trim(), ''] : null;
    if (!mm) continue;
    const names = mm[1].split('/').map((s) => s.trim()).filter(Boolean);
    const rest = (mm[2] ?? '').trim();

    for (const nm of names) {
      const p = { name: nm };
      const isNative = !nm.startsWith('data-') && NATIVE_ATTRS.has(nm);
      if (isNative) p.native = true;

      // native boolean-ish attrs default to boolean; the word confirms it
      const NATIVE_BOOL = new Set(['disabled', 'readonly', 'required', 'checked', 'multiple']);
      if (/\(boolean\)/i.test(rest) || (isNative && NATIVE_BOOL.has(nm)) || (isNative && /\bboolean\b/i.test(rest))) {
        p.type = 'boolean';
      } else {
        const values = parseEnumValues(rest);
        if (values && values.length > 1) { p.type = 'enum'; p.values = values; }
      }
      const defM = /\(default\s+([^)]+)\)/i.exec(rest);
      if (defM) {
        const d = defM[1].trim();
        if (d !== 'omitted' && d !== 'none' && d !== 'unset') p.default = d;
      }
      if (p.type === 'boolean' && p.default === undefined) p.default = false;
      if (!p.type) p.type = 'string';

      const desc = rest.replace(/\((?:boolean|default[^)]*)\)/gi, '').trim();
      if (desc) p.description = desc;
      props[nm] = p;
    }
  }
  return props;
}

/** Enum values from a leading pipe list, tolerating inline `(…)` descriptions
 *  between options. null when there is no `|`. */
function parseEnumValues(rest) {
  if (!rest.includes('|')) return null;
  const noParens = rest.replace(/\([^)]*\)/g, ' ');
  const m = /^([\w-]+(?:\s*\|\s*[\w-]+)+)/.exec(noParens.trim());
  if (!m) return null;
  return m[1].split('|').map((s) => s.trim()).filter(Boolean);
}

/** Parse the `Fires:` line(s) → [name, …]; single-line or multi-line lists. */
function parseFires(comment) {
  const out = new Set();
  const lines = comment.split('\n');
  let inFires = false, indent = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)Fires\s*:(.*)$/i.exec(lines[i]);
    if (m) {
      inFires = true; indent = m[1].length;
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
 * Every event the TypeScript actually dispatches — the ground truth, because
 * the `Fires:` comment is prose and scraping it invented events. Reads the
 * three ways a component dispatches: `emit()`, `CustomEvent`, `Event`.
 */
/** Names only ever dispatched UN-composed — `new Event(name, { bubbles })` stops at
 *  the shadow root, so the contract must not say it crosses one. */
function uncomposedEvents(ts) {
  const plain = new Set();
  const crosses = new Set();
  if (!ts) return plain;
  for (const m of ts.matchAll(/new (?:Custom)?Event\(\s*['"`]([a-z][\w-]*)['"`]([^)]*)\)/g)) {
    (/composed:\s*true/.test(m[2]) ? crosses : plain).add(m[1]);
  }
  for (const m of ts.matchAll(/\bemit\(\s*['"`]([a-z][\w-]*)['"`]/g)) crosses.add(m[1]);
  for (const n of crosses) plain.delete(n);
  return plain;
}

/** The events dispatched on THIS element by hand. `emit()` is read by the
 *  checker (`parseEmits`); an event dispatched on another element is that
 *  element's. TRAP T-an-event-name-is-not-always-a-literal */
function dispatchedEvents(ts) {
  const out = new Set();
  if (!ts) return out;
  const patterns = [
    /* `bubbles: true` is what makes a CustomEvent PUBLIC: one built and handed
       to a handler is never dispatched. TRAP T-a-constructed-event-is-not-a-dispatched-one */
    /this\.dispatchEvent\(\s*new CustomEvent\(\s*['"`]([a-z][\w-]*)['"`][^)]*bubbles:\s*true/g,
    /this\.dispatchEvent\(\s*new Event\(\s*['"`]([a-z][\w-]*)['"`]/g,
  ];
  for (const re of patterns) {
    for (const m of ts.matchAll(re)) out.add(m[1]);
  }
  return out;
}

/** What a slot may take: HTML's own content categories, then one word per
 *  Sherpa role a slot takes ONE kind of component for. TRAP T-a-slot-says-what-it-accepts */
const SLOT_ACCEPTS = new Set([
  'text', 'icon', 'control', 'input', 'content',
  'item', 'menu', 'legend', 'header', 'footer', 'nav', 'panel', 'dialog', 'toolbar', 'badge',
]);

function collectEventNames(text, set) {
  const cleaned = text.replace(/\(detail[^)]*\)/gi, '').replace(/\(re-dispatched[^)]*\)/gi, '');
  for (const frag of cleaned.split(/[,\n]/)) {
    const mm = /^\s*([a-z][\w-]*)/.exec(frag.replace(/^[—-]\s*/, '').trim());
    if (mm && mm[1] && mm[1] !== 'detail') set.add(mm[1]);
  }
}

// authoredCss / extractBindings / parseStates live in ./lib/css-reader.mjs —
// the same reader roundtrip-component.mjs uses.

/** A `--sherpa-X` var name → a `{ref}` string. Scoped component vars become
 *  `{comp.<path>}`, everything else `{sherpa.X}`; refToToken inverts both back
 *  to the same var name, so the round-trip is exact either way. */
function varToRef(sherpaVar, compName, tokens) {
  const short = compName.replace(/^sherpa-/, '');
  if (sherpaVar.startsWith(short + '-') && tokens && tokens[short]) {
    const path = findTokenPath(tokens[short], short, sherpaVar);
    if (path) return `{${short}.${path.join('.')}}`;
    return `{${short}.${sherpaVar}}`;
  }
  return `{sherpa.${sherpaVar}}`;
}
/** DFS tokens[short] for the leaf whose flattened path equals sherpaVar. */
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
    const flat = short + '-' + trail.join('-');
    if (trail.join('-') === sherpaVar) return trail;
    if (flat === sherpaVar) return trail; // leaf already carries the short prefix
  }
  return null;
}

// ══ TS: the class's own members, plus JSDoc @prop → jsProps + capabilities ═══════
function parseTsJsProps(ts) {
  const props = new Map();
  for (const m of ts.matchAll(/@prop\s*(?:\{([^}]*)\})?\s*([\w$]+)\s*[—-]?\s*([^\n*]*)/g)) {
    const [, type, name, desc] = m;
    // A TYPE only where the tag names one; else the accessor's own says it.
    props.set(name, { name, ...(type?.trim() ? { type: type.trim() } : {}), description: desc.trim() });
  }
  for (const p of parseClassApi(ts).props) props.set(p.name, { ...props.get(p.name), ...p, type: props.get(p.name)?.type ?? p.type });
  for (const p of props.values()) p.type ??= 'unknown';
  return [...props.values()];
}

/**
 * What `populate()` takes. An override says so over its `renderData`; with
 * none, the base class sets each DECLARED prop by its short name.
 */
function populateOf(ts, props, notes) {
  if (!ts) return null;
  const own = parsePopulate(ts);
  if (own === null) {
    const keys = props.filter((p) => p.declared && p.name.startsWith('data-'))
      .map((p) => `${p.name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}?`);
    return keys.length
      ? { shape: `{ ${keys.join(', ')} }`, description: 'Its declared props by name: `label` sets data-label.' }
      : null;
  }
  if (!own.shape) notes.push('renderData has no `populate(…) — …` line, so the spec cannot say what populate() takes');
  return own.shape ? own : null;
}

/**
 * The real `<slot>`s, in order: its name ('' is the default slot), what it
 * accepts, and the `Slots:` block's first sentence for it. As with events, the
 * MARKUP decides which exist; the comment only describes them.
 */
function parseSlots(html, comment, notes) {
  if (!html) return [];
  const said = slotLines(comment);
  const out = new Map();
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<slot\b([^>]*)>/g)) {
    const name = /\bname="([^"]*)"/.exec(m[1])?.[1] ?? '';
    if (out.has(name)) continue;
    const accepts = /\bdata-accepts="([^"]*)"/.exec(m[1])?.[1];
    const words = (accepts ?? '').split(/[\s,]+/).filter(Boolean);
    const odd = words.filter((w) => !SLOT_ACCEPTS.has(w));
    if (!words.length || odd.length) {
      throw new Error(`a <slot name="${name}"> must say what it accepts, in data-accepts="…", from: ${[...SLOT_ACCEPTS].join(', ')}${
        odd.length ? ` — not ${odd.join(', ')}` : ''}. TRAP T-a-slot-says-what-it-accepts`);
    }
    out.set(name, {
      $type: 'slot', name,
      ...(accepts ? { accepts: accepts.split(/[\s,]+/).filter(Boolean) } : {}),
      ...(said.get(name) ? { description: said.get(name) } : {}),
    });
  }
  for (const name of said.keys()) {
    if (!out.has(name)) notes.push(`slot "${name || '(default)'}" is in the Slots: block, but the template has no such <slot>`);
  }
  return [...out.values()];
}

/** The `Slots:` block: each entry's name ('' for `(default)`) → its first sentence. */
function slotLines(comment) {
  const out = new Map();
  const lines = (comment ?? '').split('\n');
  const at = lines.findIndex((l) => /^\s*Slots:\s*$/.test(l));
  if (at < 0) return out;
  let indent = -1;
  let entry = null;
  const close = () => {
    if (!entry) return;
    const text = entry.text.join(' ')
      .replace(/\(data-accepts:[^)]*\)/g, '').replace(/TRAP\s+T-[\w-]+/g, '')
      .replace(/^[—–-]\s*/, '').replace(/\s+/g, ' ').trim();
    const sentence = /^(.*?[.!?])(?:\s|$)/.exec(text)?.[1] ?? text;
    if (sentence) out.set(entry.name, sentence.replace(/[\s·—–-]+$/, ''));
    entry = null;
  };
  for (const line of lines.slice(at + 1)) {
    if (!line.trim()) break;
    const lead = line.length - line.trimStart().length;
    if (indent < 0) indent = lead;
    if (lead < indent || /^\s*[A-Z][\w ]*:\s*$/.test(line)) break;
    const m = lead === indent ? /^\s*(\(default\)|[a-z][\w-]*)\s+(.*)$/.exec(line) : null;
    if (m) {
      close();
      entry = { name: m[1] === '(default)' ? '' : m[1], text: [m[2]] };
    } else if (lead > indent && entry) {
      entry.text.push(line.trim());
    } else {
      close();
    }
  }
  close();
  return out;
}

/** Public methods — the vocabulary a saved view, a preset or an agent may use on this component. */
function parseTsMethods(ts) {
  return parseClassApi(ts).methods;
}


// ══ the generator ════════════════════════════════════════════════════════════════

function generateSpec(name) {
  const dir = join(C, name);
  const notes = [];
  const html = readIf(join(dir, `${name}.html`));
  const css = readIf(join(dir, `${name}.css`));
  const ts = readIf(join(dir, `${name}.ts`));
  const existingRaw = readIf(join(dir, `${name}.component.json`));
  const existing = existingRaw ? (JSON.parse(existingRaw) ?? {}) : {};
  const priorExt = (existing.$extensions && existing.$extensions.sherpa) || {};
  if (!existingRaw) notes.push('no existing component.json — $extensions.sherpa (figmaName/category/…) minimal; re-run resync-figma to populate');
  if (!html) notes.push('no HTML (cannot derive anatomy/props/events — round-trip will fail)');
  if (!css) notes.push('no CSS (no token bindings)');
  if (!ts) notes.push('no TS (no jsProps)');

  // The TS `observed` list is the ground truth for which data-* props are
  // reactive; a prior spec's stale kind loses to it.
  const tsObserved = parseObserved(ts);
  // `static props` is the only honest source for `kind`, and the first for a
  // prop's type, values and default. TRAP T-kind-says-how-not-whether
  const tsDecls = parsePropDecls(ts, join(dir, `${name}.ts`));
  const tsKinds = Object.fromEntries(Object.entries(tsDecls).filter(([, d]) => d.kind).map(([n, d]) => [n, d.kind]));

  const comment = html ? htmlComment(html) : '';
  const apiProps = comment ? parsePublicApi(comment) : {};
  if (html && !comment) notes.push('HTML has no leading comment (no Public API block)');
  if (html && comment && !/Public API/i.test(comment)) notes.push('HTML comment lacks a `Public API:` block — no enum values parseable');

  const templatesObj = html ? parseTemplates(html) : {};
  const templateIds = Object.keys(templatesObj);
  const defaultTree = templatesObj['default'];

  // ── $description ──────────────────────────────────────────────────────────────
  // The existing spec's curated value wins; preserving it keeps specs stable.
  // The SOURCE's header wins, so a description cannot rot in the spec.
  const description = commentDescription(comment, name) || existing.$description || `the ${name.replace('sherpa-', '')} component.`;

  // ── anatomy + templates ───────────────────────────────────────────────────────
  let anatomy = null;
  if (defaultTree && defaultTree.length) {
    // A top-level `<slot>` is real markup and is KEPT; only empty nodes are skipped.
    const roots = defaultTree.filter((n) => n.tag);
    if (roots.length === 1) anatomy = { root: htmlNodeToAnatomy(roots[0]) };
    else if (roots.length > 1) {
      // compileDef renders sibling roots in order, byte-identical to the markup
      anatomy = { roots: roots.map((r) => htmlNodeToAnatomy(r)) };
    }

    /* Multi-template union. `showWhen` can only ADD or REMOVE a node against the
       default tree, so an additive superset folds into one compact tree. It
       cannot express a changed TAG, CLASS or PART — those fall back to
       `byTemplate`, one entry per template. */
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
      // the showWhen union aligns one tree against one, so multi-root cannot use it
      needsByTemplate.push(...extraIds);
    }
    if (anatomy && needsByTemplate.length) {
      /* One divergent template forces the WHOLE anatomy into `byTemplate` — the
         three forms are mutually exclusive. Start from the default's roots
         BEFORE any showWhen folding, so a merged template is still emitted from
         its own markup. */
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
  // Carry the prior spec's props so a hand-added kind/description survives regen;
  // the comment + TS still win for type/values/default/observed-kind.
  const priorProps = {};
  for (const p of (existing.props ?? [])) if (p && p.name) priorProps[p.name] = p;
  /* Union the comment's props with the prior spec's — some props live only in
     the spec. But a carried prop must still exist SOMEWHERE in the source, or a
     renamed attribute lingers for ever in a spec that can only grow. */
  /* A prop's own `values: ['a', 'b']` list is NOT evidence that `a` is itself
     an attribute — every enum value arrives single-quoted, which is the one
     spelling `attrInUse` trusts. Declaring `data-align`'s values made the
     phantom `stretch` prop pass the guard that exists to catch it.
     TRAP T-a-bare-name-must-be-used-not-mentioned */
  const tsWithoutEnumValues = (ts ?? '').replace(/values:\s*\[[^\]]*\]/g, 'values: []');
  const sourceText = `${tsWithoutEnumValues}\n${css ?? ''}\n${html ?? ''}`;
  /* USED, not merely MENTIONED — a bare substring search keeps a prop alive on
     the strength of a comment that explains its removal. Hence the three real
     spellings of use. A DOUBLE-quoted match is deliberately not proof:
     `"stretch"` is a VALUE in `[data-align="stretch"]`. Single quotes are, as
     that is how TS spells an attribute NAME in an `observed` list. */
  const attrInUse = (nm) => {
    const camel = nm.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return sourceText.includes(`[${nm}`)          // CSS selector
      || sourceText.includes(`${nm}=`)            // HTML attribute
      || sourceText.includes(`'${nm}'`)           // getAttribute / observed list
      || sourceText.includes(`dataset['${camel}']`)
      || sourceText.includes(`dataset.${camel}`);
  };
  /* The same check on props the COMMENT produced — a wrapped prose sentence
     reads exactly like an entry, so a bare lowercase name must be found in the
     code. A `data-*` name stands on its own.

     ORDER MATTERS: the carried-prop sweep below spares anything still in
     `apiProps`, so a phantom dropped afterwards survives in the prior spec. */
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
  // Every DECLARED prop is public, whether or not the comment names it.
  const propNames = new Set([...Object.keys(apiProps), ...Object.keys(priorProps), ...Object.keys(tsDecls)]);
  const props = [];
  for (const nm of propNames) {
    const fromApi = apiProps[nm] || {};
    const fromPrior = priorProps[nm] || {};
    const decl = tsDecls[nm] || {};
    const p = { $type: 'prop', name: nm };
    // The declaration wins; the comment carries the signal for what is undeclared.
    p.type = decl.type || fromApi.type || fromPrior.type || 'string';
    let kind = fromPrior.kind;
    const native = fromApi.native === true || (!nm.startsWith('data-') && NATIVE_ATTRS.has(nm));
    // `kind` says HOW a prop is realised; `observed` says WHETHER the component
    // watches it. They are independent — a CSS-only attribute is routinely
    // observed. TRAP T-kind-says-how-not-whether
    if (ts) p.observed = tsObserved.includes(nm) || nm in tsDecls;
    if (nm in tsDecls) p.declared = true;
    if (native) p.native = true;
    // The TS declaration wins. A prior spec's kind was inferred from the
    // observed list and cannot be trusted where the TS disagrees.
    if (ts && nm in tsKinds) kind = tsKinds[nm];
    else if (ts && kind === 'content' && !(nm in tsKinds)) kind = undefined;
    // A data-* prop the TS does not declare is CSS-only: that is what a bare
    // attribute selector is, and it holds whether or not it is observed.
    if (!kind && nm.startsWith('data-')) kind = 'style';
    if (kind) p.kind = kind;
    if (p.type === 'enum') {
      if (decl.values && decl.values.length) p.values = decl.values;
      else if (fromApi.values && fromApi.values.length) p.values = fromApi.values;
      else if (fromPrior.values && fromPrior.values.length) p.values = fromPrior.values;
      else { p.values = []; notes.push(`prop ${nm}: enum with NO parseable values (Public API comment lacks them) — NEEDS HAND-FINISHING`); }
    }
    const def = decl.default !== undefined ? decl.default : fromApi.default !== undefined ? fromApi.default : fromPrior.default;
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

  // ── events ───────────────────────────────────────────────────────────────────
  // The prior spec supplies only the `trigger` block, never a NAME — otherwise a
  // renamed or removed event lingers for ever.
  const priorEvents = {};
  for (const e of (existing.events ?? [])) if (e && e.name) priorEvents[e.name] = e;
  /* THE CODE DECIDES, the comment only describes. Intersecting with what the TS
     dispatches lets the comment choose WHICH emitted events are public, and
     never invent one. A component that emits nothing gets no `events:` key. */
  // Named and typed by TypeScript's checker. TRAP T-a-detail-is-typed-by-the-checker
  const { details, unread } = ts ? parseEmits(join(dir, `${name}.ts`)) : { details: new Map(), unread: [] };
  if (unread.length) {
    throw new Error(`${name}: an emit() whose name types as string — the spec cannot list it. Narrow it to literals:\n  ${
      unread.map((u) => relative(process.cwd(), u)).join('\n  ')}`);
  }
  const emitted = new Set([...details.keys(), ...dispatchedEvents(ts)]);
  const firesNames = comment ? parseFires(comment) : [];
  const eventNames = new Set(firesNames.filter((n) => emitted.has(n)));
  // an emitted event the comment forgot is still part of the contract
  for (const n of emitted) eventNames.add(n);
  const uncomposed = uncomposedEvents(ts);
  const events = [];
  for (const en of eventNames) {
    const ev = { $type: 'event', name: en, bubbles: true, composed: !uncomposed.has(en) };
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
  // Multi-root: the FIRST root, best-effort. byTemplate: the DEFAULT template's
  // first root — what a component IS does not change with the template showing,
  // and missing this dropped the whole `element:` block (with its native
  // provides) from all three such components.
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
    capabilities.push({
      $type: 'capability',
      api: 'js-methods',
      description: `callable from a view definition's state block (${methods.map((m) => m.name).join(', ')}). See $extensions.sherpa.methods.`,
    });
  }

  // ── $extensions.sherpa ────────────────────────────────────────────────────────
  // Carried verbatim from the prior spec; only methods and jsProps are re-derived.
  const sherpaExt = {};
  if (priorExt.figmaName) sherpaExt.figmaName = priorExt.figmaName;
  // never carried, so a removed method disappears rather than lingering
  if (methods.length) sherpaExt.methods = methods;
  // The node ID is what makes a binding CHECKABLE; omitting it from this list
  // silently dropped it on every regen.
  if (priorExt.figmaNodeId) sherpaExt.figmaNodeId = priorExt.figmaNodeId;
  if (priorExt.category) sherpaExt.category = priorExt.category;
  if (Array.isArray(priorExt.variantAxes) && priorExt.variantAxes.length) {
    sherpaExt.variantAxes = priorExt.variantAxes.map((a) => ({ name: a.name, ...(a.values ? { values: a.values } : {}) }));
  }
  if (Array.isArray(priorExt.booleanProps) && priorExt.booleanProps.length) sherpaExt.booleanProps = priorExt.booleanProps;
  // which OTHER components this one instances — the record that it is composed
  if (Array.isArray(priorExt.composes) && priorExt.composes.length) sherpaExt.composes = priorExt.composes;
  // BOTH spellings: `_divergence` is ratified, `divergence` is the older specs'.
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
  const slots = parseSlots(html, comment, notes);
  if (slots.length) spec.slots = slots;
  const populate = populateOf(ts, props, notes);
  if (populate) spec.populate = populate;
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
function toJson(spec) {
  const $comment = `${spec.$name} — GENERATED by scripts/generate-component-spec.mjs from its .html, .css and .ts. `
    + 'Regenerate it, never edit it. $extensions.sherpa is kept across regen; resync-figma.mjs owns it.';
  return `${JSON.stringify({ $comment, ...spec }, null, 2)}\n`;
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
    define: (/(?:customElements\.)?\bdefine\('([^']+)'/.exec(ts) || [])[1] ?? null,
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
  /* --staged: FRESHNESS only for a component this commit touches. Anyone's
     half-done CSS makes its spec stale until regenerated, and a hook that
     checked every component would block every commit on it. */
  const staged = args.includes('--staged')
    ? new Set(execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n').map((f) => (f.match(/^src\/components\/(sherpa-[^/]+)\//) ?? [])[1])
      .filter(Boolean))
    : null;
  const names = all ? readdirSync(C).filter((n) => n.startsWith('sherpa-') && (existsSync(join(C, n, `${n}.html`)) || existsSync(join(C, n, `${n}.component.json`))))
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
    /* FRESH, not just well-formed. --check used to test the spec it had just
       generated and never the one on disk, so a committed spec missing a new
       getter, or still naming a deleted method, passed every commit.
       TRAP T-a-spec-on-disk-must-be-the-spec-the-source-makes */
    const onDisk = join(dir, `${name}.component.json`);
    const existing = existsSync(onDisk) ? readFileSync(onDisk, 'utf8') : '';
    const generatedSpec = existing.includes('GENERATED by scripts/generate-component-spec.mjs');
    const stale = check && generatedSpec && existing !== toJson(spec)
      && (!staged || staged.has(name));
    rows.push({ name, valid, errors, rtOk: rt.ok, rtDiffs: rt.diffs, notes, enumIssues, stale });

    if (!check) {
      const outPath = join(dir, `${name}.component.json`);
      // Only overwrite specs this generator produced (they carry the GENERATED
      // header). A hand-authored one survives --all; name it to regenerate it.
      const existing = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
      const isHandAuthored = existing && !existing.includes('GENERATED by scripts/generate-component-spec.mjs');
      if (all && isHandAuthored) { rows[rows.length - 1].skippedWrite = 'hand-authored spec preserved'; continue; }
      writeFileSync(outPath, toJson(spec), 'utf8');
    }
  }

  if (names.length === 1 && !all) {
    const r = rows[0];
    console.log(`\n${r.name}`);
    console.log(`  validate:   ${r.valid ? 'PASS' : 'FAIL'}`);
    r.errors?.forEach((e) => console.log(`     • ${e}`));
    console.log(`  round-trip: ${r.rtOk ? 'PASS' : 'FAIL'}`);
    if (check) console.log(`  fresh:      ${r.stale ? 'STALE — regenerate it' : 'PASS'}`);
    r.rtDiffs?.forEach((d) => console.log(`     • ${d}`));
    if (r.notes?.length) { console.log(`  notes:`); r.notes.forEach((n) => console.log(`     • ${n}`)); }
    if (!check) console.log(`  written: ${r.name}/${r.name}.component.json`);
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
      if (r.stale) flags.push('STALE on disk — regenerate');
      const otherNotes = (r.notes || []).filter((n) => !/NEEDS HAND-FINISHING/.test(n));
      if (otherNotes.some((n) => /no HTML|no <template|no thin|no leading comment|lacks a `Public API/.test(n))) flags.push('src-gap');
      if (flags.length) needFix++;
      console.log(`${pad(r.name, 30)} ${pad(r.valid ? 'PASS' : 'FAIL', 7)} ${pad(r.rtOk ? 'PASS' : 'FAIL', 12)} ${flags.join('; ')}`);
    }
    console.log('-'.repeat(90));
    const stale = rows.filter((r) => r.stale);
    console.log(`validate: ${vPass}/${rows.length} PASS   round-trip: ${rPass}/${rows.length} PASS   `
      + `fresh: ${rows.length - stale.length}/${rows.length}   need hand-finishing: ${needFix}`);
    for (const r of stale) {
      console.log(`   stale • ${r.name}: node scripts/generate-component-spec.mjs ${r.name}`);
    }
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
  /* The ROUND-TRIP counts as a failure, not just the schema check — leaving
     `r.rtOk` out of this line let `--check` exit 0 with 22 components failing. */
  const anyFail = rows.some((r) => r.error || !r.valid || !r.rtOk || r.stale);
  process.exit(anyFail ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();

export { generateSpec, toJson, loadTokens, loadElementMap };
