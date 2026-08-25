#!/usr/bin/env node
/**
 * generate-defs.mjs — emit a <name>.def.json for every component from its code.
 *
 * Reads each component's three files and fills the CODE-derived half of the
 * shared component definition (the shape proven on sherpa-tag):
 *   .ts   → observed attrs, templates (templateId), emitted events, native
 *           triggers (addEventListener), public props/methods, nested listens
 *   .html → anatomy (nodes, classes, parts, slots), nested sherpa-* children
 *   .css  → token map (element.property → --sherpa-* / --_status-* override)
 *
 * FIGMA-only fields (extended-collection maps, variant axes, mode pins) are left
 * as TODO stubs — a second pass reads them from the Figma file via the bridge.
 *
 * Usage:
 *   node scripts/generate-defs.mjs            # all components, write files
 *   node scripts/generate-defs.mjs sherpa-tag # one component
 *   node scripts/generate-defs.mjs --dry      # print, don't write
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { thin } from './thin-def.mjs';
import { loadContract } from './lib/contract-io.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = join(ROOT, 'src', 'components');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const only = args.filter((a) => !a.startsWith('--'));

const KNOWN_COMPONENTS = new Set(readdirSync(COMPONENTS));

// ── tiny helpers ────────────────────────────────────────────────────────
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const uniq = (a) => [...new Set(a)];
const titleCase = (name) =>
  name.replace(/^sherpa-/, '').split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');

// ── .ts parsing ─────────────────────────────────────────────────────────
function parseTs(ts) {
  const out = { observed: [], templates: [], emits: [], triggers: [], listens: [], props: [], category: null };

  // observed = [...] — the data-* / native public attrs
  const obs = ts.match(/static\s+override\s+observed\s*=\s*\[([\s\S]*?)\]/);
  if (obs) out.observed = uniq([...obs[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

  // templateId branches → template ids the component can stamp
  const tid = ts.match(/get\s+templateId\(\)[\s\S]*?\{([\s\S]*?)\n {2}\}/);
  if (tid) out.templates = uniq([...tid[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

  // this.emit('name') → Sherpa events fired
  out.emits = uniq([...ts.matchAll(/this\.emit\(\s*'([^']+)'/g)].map((m) => m[1]));
  // new CustomEvent('name') → also fired
  out.emits = uniq([...out.emits, ...[...ts.matchAll(/new CustomEvent(?:<[^>]*>)?\(\s*'([^']+)'/g)].map((m) => m[1])]);

  // addEventListener('native', handler) on this.$('sel') → native triggers
  for (const m of ts.matchAll(/this\.\$\(\s*'([^']+)'\s*\)\??\.addEventListener\(\s*'([^']+)'/g)) {
    out.triggers.push({ node: m[1], on: m[2] });
  }

  // @prop {type} name — public props from JSDoc (when present)
  for (const m of ts.matchAll(/@prop\s+\{([^}]+)\}\s+(\w+)\s+—\s+([^\n*]+)/g)) {
    out.props.push({ name: m[2], type: m[1].trim(), description: m[3].trim() });
  }

  // @category
  const cat = ts.match(/@category\s+(\w+)/);
  if (cat) out.category = cat[1];

  return out;
}

// ── .html parsing (regex-light DOM walk) ────────────────────────────────
function parseHtml(html) {
  const templates = [];
  for (const t of html.matchAll(/<template\s+id="([^"]+)">([\s\S]*?)<\/template>/g)) {
    templates.push({ id: t[1], body: t[2] });
  }
  // OWNED nesting: a sherpa-* element written into this component's own template.
  const owned = uniq(
    [...html.matchAll(/<(sherpa-[a-z-]+)/g)].map((m) => m[1]),
  );
  const slots = uniq([...html.matchAll(/<slot(?:\s+name="([^"]*)")?/g)].map((m) => m[1] ?? ''));
  const parts = uniq([...html.matchAll(/part="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  return { templates, owned, slots, parts };
}

// ── .css parsing → token map ────────────────────────────────────────────
function parseCss(css) {
  // element (first class in a rule) → the --sherpa-* / --_status-* it consumes.
  const tokens = {};
  for (const rule of css.matchAll(/\.([a-z][\w-]*)\s*\{([\s\S]*?)\}/g)) {
    const el = rule[1];
    const body = rule[2];
    const vars = uniq([...body.matchAll(/var\(\s*(--(?:sherpa|_status)[\w-]+)/g)].map((m) => m[1]));
    for (const v of vars) {
      const clean = v.replace(/^--sherpa-/, '').replace(/^--_/, '');
      tokens[`${el}:${clean}`] = v.startsWith('--_status') ? { override: clean } : clean;
    }
  }
  return tokens;
}

// ── build one def ───────────────────────────────────────────────────────
function buildDef(name) {
  const dir = join(COMPONENTS, name);
  const ts = read(join(dir, `${name}.ts`));
  const html = read(join(dir, `${name}.html`));
  const css = read(join(dir, `${name}.css`));

  const t = parseTs(ts);
  const h = parseHtml(html);
  const c = parseCss(css);

  // OWNED = a sherpa-* the component ships inside its own template (Figma: INSTANCE).
  const owned = h.owned
    .filter((n) => n !== name && KNOWN_COMPONENTS.has(n))
    .map((component) => ({ component, relationship: 'owned' }));

  // SLOTTED = a named slot the APP fills with a component (Figma: a slot, not an
  // instance). Detected from a "compose with sherpa-X" hint in the HTML comment.
  const composeHint = [...html.matchAll(/compose with (sherpa-[a-z-]+)/gi)].map((m) => m[1]);
  const slotted = uniq(composeHint)
    .filter((n) => n !== name && KNOWN_COMPONENTS.has(n))
    .map((component) => ({ component, relationship: 'slotted' }));

  const nested = [...owned, ...slotted];

  const events = t.emits.map((ev) => {
    const trig = t.triggers[0];
    return {
      name: ev,
      bubbles: true,
      composed: true,
      cancelable: false,
      detail: {},
      ...(trig ? { trigger: { on: trig.on, node: trig.node } } : {}),
      _todo: 'confirm cancelable + default action + detail shape',
    };
  });

  return {
    $schema: 'https://sherpa-ui.dev/schema/component-definition/v2.json',
    generated: true,
    name,
    figmaName: titleCase(name),
    category: t.category ?? '_TODO',
    description: (ts.match(/\*\s+(sherpa-[a-z-]+\s+—\s+[^\n]+)/)?.[1] ?? '').trim() || '_TODO',

    props: t.observed.map((attr) => ({
      name: attr,
      type: '_TODO',
      kind: '_TODO(style|content|visibility|template)',
      description: '',
    })),

    templates: t.templates,
    slots: h.slots.map((s) => ({ name: s, accepts: [], description: '' })),
    parts: h.parts,
    nested,
    props_public: t.props,
    events,
    tokens: c,

    figma: {
      _todo: 'READ FROM FIGMA: variant axes, extended-collection maps, mode pins',
      page: name,
      variantAxes: [],
      extendedCollections: {},
      modePins: {},
    },
  };
}

// ── run ─────────────────────────────────────────────────────────────────
const targets = only.length ? only : readdirSync(COMPONENTS);
let n = 0;
for (const name of targets) {
  if (!KNOWN_COMPONENTS.has(name)) {
    console.warn(`skip: ${name} (not a component)`);
    continue;
  }
  const outPath = join(COMPONENTS, name, `${name}.thin.yaml`);
  // Never clobber an enriched def (hand-edited → "generated": false).
  if (!DRY && existsSync(outPath)) {
    try {
      if (loadContract(join(COMPONENTS, name, `${name}.def`)).generated === false) {
        console.log(`keep: ${name} (enriched — generated:false)`);
        continue;
      }
    } catch { /* unreadable → regenerate */ }
  }
  const def = thin(buildDef(name));   // emit the lightweight thin YAML, not JSON
  if (DRY) {
    console.log(`\n=== ${name} ===\n${yaml.dump(def, { lineWidth: 100, noRefs: true })}`);
  } else {
    writeFileSync(outPath, yaml.dump(def, { lineWidth: 100, noRefs: true }));
    n++;
  }
}
if (!DRY) console.log(`Wrote ${n} def files.`);
