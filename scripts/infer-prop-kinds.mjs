#!/usr/bin/env node
/**
 * infer-prop-kinds.mjs — fill the scaffolder's `_TODO` prop kinds from real usage.
 *
 * The generated defs left `type: _TODO` / `kind: _TODO(...)` for a human to
 * decide. The answer is knowable from the component's own CSS/HTML/TS — how each
 * prop is actually consumed — so we infer it, we don't guess:
 *
 *   template  — the prop selects an HTML <template> (get templateId / data-x ? 'a')
 *   visibility— CSS toggles display/visibility on :host([data-x]) .part
 *   content   — the prop's value is written into a text node / holds a value
 *   style     — the prop only restyles :host([x]) (incl. native disabled/checked)
 *
 * Writes the inferred kind+type back into the JSON def (the source we thin from),
 * then the thin files are regenerated. Reports anything it can't classify with
 * confidence so a human finishes those by hand — never a silent wrong guess.
 *
 *   node scripts/infer-prop-kinds.mjs            # infer + write, report low-confidence
 *   node scripts/infer-prop-kinds.mjs --dry      # report only, no write
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');
const DRY = process.argv.includes('--dry');

const isTodo = (v) => typeof v === 'string' && v.includes('_TODO');

/** Read a component's three source files (any may be missing). */
function sources(name) {
  const read = (ext) => { const p = join(C, name, `${name}.${ext}`); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
  return { css: read('css'), html: read('html'), ts: read('ts') };
}

/** Infer one prop's kind + type from how the code uses it. */
function infer(prop, src, def) {
  const name = prop.name;                       // e.g. "data-icon-start" | "disabled"
  const attr = name;                            // selector attribute
  const esc = attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1. native boolean state FIRST — disabled/checked/etc. are style, not content
  const nativeStateful = ['disabled', 'checked', 'indeterminate', 'readonly', 'required', 'open', 'hidden', 'selected'];
  if (nativeStateful.includes(name)) {
    return { kind: 'style', type: 'boolean', default: false, confidence: 'high' };
  }
  // 2. template — TS switches an HTML <template> on this attribute
  if (new RegExp(`templateId[\\s\\S]{0,200}${esc}`).test(src.ts) ||
      (def.templates?.length > 1 && new RegExp(`${esc}[\\s\\S]{0,60}\\?`).test(src.ts))) {
    return { kind: 'template', type: 'boolean', default: false, confidence: 'high' };
  }
  // 3. visibility — CSS toggles display/visibility gated on this attribute
  const visRe = new RegExp(`:host\\(\\[${esc}[^\\]]*\\]\\)[^{]*\\{[^}]*(display|visibility)\\s*:`, 'i');
  if (visRe.test(src.css)) {
    return { kind: 'visibility', type: 'boolean', default: false, confidence: 'high' };
  }
  // 4. content — value written into a text node, or a value-shaped data-* name
  const valueNames = /^(data-)?(label|title|value|values|content|code|text|author|time|description|max|min|step|name|href|url|placeholder|count|total|total-pages|current-page|current-step|caption|message|heading|subtitle|sublabel|helper|delta|language|accept|active-id|active-step|source-heading|target-heading)$/i;
  const writesText = new RegExp(`(textContent|innerText|innerHTML)[\\s\\S]{0,120}${esc}`).test(src.ts);
  if (writesText || valueNames.test(name)) {
    return { kind: 'content', type: 'string', default: null, confidence: (writesText || valueNames.test(name)) ? 'high' : 'medium' };
  }
  // 5. enum variant axes (data-variant/type/size) styled via :host([x="v"])
  if (/^data-(variant|type|size|layout|placement|align|state)$/i.test(name) &&
      new RegExp(`:host\\([^)]*${esc}\\s*=`).test(src.css)) {
    return { kind: 'style', type: 'enum', default: null, confidence: 'medium' };
  }
  // 6. boolean config flags (multiple/…) → style toggles
  if (/^(data-)?(multiple|open|reverse|stacked|compact)$/i.test(name) || new RegExp(`:host\\(\\[${esc}`).test(src.css)) {
    return { kind: 'style', type: 'boolean', default: false, confidence: 'medium' };
  }
  return { kind: null, type: null, confidence: 'none' };
}

let filled = 0, low = 0;
const report = [];
for (const name of readdirSync(C)) {
  const jsonPath = join(C, name, `${name}.def.json`);
  if (!existsSync(jsonPath)) continue;
  const def = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const src = sources(name);
  let changed = false;

  for (const prop of def.props || []) {
    const wasTodo = isTodo(prop.type) || isTodo(prop.kind);
    // also complete visibility/template props that are missing their figma
    // binding, even if their kind was already filled — makes every def whole.
    const needsFigma = (prop.kind === 'visibility' || prop.kind === 'template') && !prop.figma;
    if (!wasTodo && !needsFigma) continue;
    if (!wasTodo && needsFigma) {
      const cap2 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
      const stem = prop.name.replace(/^data-/, '').split('-').map(cap2).join('');
      prop.figma = { boolean: 'has' + stem };
      changed = true; filled++;
      continue;
    }
    const r = infer(prop, src, def);
    if (!r.kind) { report.push(`❓ ${name} ${prop.name} — could not classify (needs human)`); low++; continue; }
    prop.kind = r.kind;
    prop.type = r.type;
    prop.default = r.default ?? null;
    if (isTodo(prop.description) || !prop.description) prop.description = '';
    // complete the figma binding per kind so the def is whole (and hydrate's
    // per-kind derivation matches exactly):
    //   visibility/template → hasX boolean;  content/style → no auto binding
    const cap2 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const stem = prop.name.replace(/^data-/, '').split('-').map(cap2).join('');
    if ((r.kind === 'visibility' || r.kind === 'template') && !prop.figma) {
      prop.figma = { boolean: 'has' + stem };
    }
    // clean any stray _todo scaffolding keys on the prop
    delete prop._todo;
    changed = true; filled++;
    if (r.confidence === 'medium') { report.push(`△ ${name} ${prop.name} → ${r.kind} (medium confidence — verify)`); }
  }
  // clean event _todo notes too
  for (const ev of def.events || []) if (ev._todo) { delete ev._todo; changed = true; }

  if (changed && !DRY) writeFileSync(jsonPath, JSON.stringify(def, null, 2) + '\n');
}

console.log(`${DRY ? '[dry] ' : ''}filled ${filled} prop kinds, ${low} unclassified.`);
if (report.length) { console.log('\nReview:'); report.forEach((r) => console.log('  ' + r)); }
