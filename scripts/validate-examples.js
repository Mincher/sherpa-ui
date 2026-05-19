#!/usr/bin/env node
/**
 * Validate every component's examples.html against the component's
 * declared attribute surface (extracted from @attr JSDoc + observedAttributes
 * + the HTML template).
 *
 * Reports attributes used in examples that don't exist on the component.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../components/', import.meta.url).pathname;

const tagDirs = readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.startsWith('sherpa-'))
  .map(d => d.name)
  .sort();

/* ─── extract declared attrs from JS @attr + observedAttributes ──── */

function extractDeclaredAttrs(jsPath, visited = new Set()) {
  if (!existsSync(jsPath) || visited.has(jsPath)) return new Set();
  visited.add(jsPath);
  const src = readFileSync(jsPath, 'utf8');
  const attrs = new Set();

  // @attr {type} [data-foo] or @attr {type} data-foo
  for (const m of src.matchAll(/@attr\s+\{[^}]+\}\s+\[?([\w-]+)\]?/g)) {
    attrs.add(m[1]);
  }
  // observedAttributes contents — quoted strings
  const obs = src.match(/observedAttributes\(\)\s*\{[\s\S]*?return\s*\[([\s\S]*?)\];/);
  if (obs) {
    for (const m of obs[1].matchAll(/['"]([a-z][\w-]*)['"]/g)) attrs.add(m[1]);
  }
  // case "data-foo": in attribute handler
  for (const m of src.matchAll(/case\s+['"]([a-z][\w-]+)['"]/g)) attrs.add(m[1]);
  // dataset.foo references → data-foo
  for (const m of src.matchAll(/\.dataset\.([a-zA-Z][\w]*)/g)) {
    const kebab = m[1].replace(/([A-Z])/g, '-$1').toLowerCase();
    attrs.add(`data-${kebab}`);
  }

  // Walk to base class via "extends X" + matching import
  const extMatch = src.match(/class\s+\w+\s+extends\s+([\w()\s,]+?)\s*\{/);
  if (extMatch) {
    const expr = extMatch[1];
    // collect all identifiers in expression (mixins + base)
    const idents = [...new Set(expr.match(/\b[A-Z]\w*/g) || [])];
    for (const name of idents) {
      // Resolve via import
      const impRe = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`);
      const imp = src.match(impRe);
      if (!imp) continue;
      try {
        const baseUrl = new URL(imp[1], 'file://' + jsPath).pathname;
        for (const a of extractDeclaredAttrs(baseUrl, visited)) attrs.add(a);
      } catch {}
    }
  }
  // Detect ATTR_SCHEMA-style declarations: ["data-foo", ...]
  for (const m of src.matchAll(/\[\s*"(data-[a-z][\w-]*)"\s*,/g)) attrs.add(m[1]);

  return attrs;
}

/* ─── extract attribute selectors from CSS [data-foo] ────────────── */

function extractCssAttrs(cssPath) {
  if (!existsSync(cssPath)) return new Set();
  const src = readFileSync(cssPath, 'utf8');
  const attrs = new Set();
  for (const m of src.matchAll(/\[(data-[a-z][\w-]*)/g)) attrs.add(m[1]);
  return attrs;
}

/* ─── extract attrs referenced in HTML template (children/slots) ── */

function extractHtmlAttrs(htmlPath) {
  if (!existsSync(htmlPath)) return new Set();
  const src = readFileSync(htmlPath, 'utf8');
  const attrs = new Set();
  // attrs on the host template itself documented in HTML comments
  for (const m of src.matchAll(/^\s*(data-[a-z][\w-]+)\s+—/gm)) attrs.add(m[1]);
  return attrs;
}

/* ─── parse used attributes per tag from examples HTML ──────────── */

function parseExampleAttrs(html, tagName) {
  const used = new Set();
  const re = new RegExp(`<${tagName}(?![\\w-])([^>]*?)\\/?>`, 'g');
  let m;
  while ((m = re.exec(html))) {
    let attrs = (m[1] || '').trim();
    // strip quoted attribute values so we don't catch words inside them
    const stripped = attrs.replace(/=\s*"[^"]*"/g, '').replace(/=\s*'[^']*'/g, '');
    // remaining tokens are either bare attributes or attribute-name (after =) stripped
    for (const tok of stripped.split(/\s+/)) {
      const name = tok.trim().toLowerCase();
      if (!name) continue;
      if (/^[a-z][\w-]*$/.test(name)) used.add(name);
    }
  }
  return used;
}

/* ─── well-known global attrs (ignore) ──────────────────────────── */

const GLOBAL_ATTRS = new Set([
  'id', 'class', 'style', 'slot', 'part', 'hidden', 'disabled', 'tabindex',
  'role', 'aria-label', 'aria-hidden', 'aria-describedby', 'aria-controls',
  'aria-expanded', 'aria-current', 'name', 'value', 'placeholder', 'type',
  'href', 'src', 'alt', 'title', 'min', 'max', 'step', 'checked', 'open',
  'required', 'readonly', 'autofocus', 'autocomplete', 'multiple', 'selected',
  'for', 'rows', 'cols',
]);

/* ─── run ───────────────────────────────────────────────────────── */

const issues = [];

for (const tag of tagDirs) {
  const exFile = join(ROOT, tag, `${tag}.examples.html`);
  if (!existsSync(exFile)) continue;
  const exHtml = readFileSync(exFile, 'utf8');

  // Find every sherpa-* tag referenced in the examples (own + children).
  const referencedTags = new Set();
  for (const m of exHtml.matchAll(/<(sherpa-[a-z-]+)\b/g)) referencedTags.add(m[1]);

  for (const rTag of referencedTags) {
    const jsPath   = join(ROOT, rTag, `${rTag}.js`);
    const cssPath  = join(ROOT, rTag, `${rTag}.css`);
    const htmlPath = join(ROOT, rTag, `${rTag}.html`);

    if (!existsSync(jsPath)) continue;        // not a real component

    const declared = new Set([
      ...extractDeclaredAttrs(jsPath),
      ...extractCssAttrs(cssPath),
      ...extractHtmlAttrs(htmlPath),
    ]);

    const used = parseExampleAttrs(exHtml, rTag);
    for (const u of used) {
      if (GLOBAL_ATTRS.has(u)) continue;
      if (!u.startsWith('data-') && !declared.has(u)) {
        // Bare attribute that's not a known global and not declared
        issues.push({ exTag: tag, badTag: rTag, attr: u, kind: 'unknown-bare' });
        continue;
      }
      if (!declared.has(u)) {
        issues.push({ exTag: tag, badTag: rTag, attr: u, kind: 'unknown-data' });
      }
    }
  }
}

/* ─── report ─────────────────────────────────────────────────────── */

const byExTag = new Map();
for (const i of issues) {
  if (!byExTag.has(i.exTag)) byExTag.set(i.exTag, []);
  byExTag.get(i.exTag).push(i);
}

console.log(`# Schema audit — ${issues.length} possible mismatches in ${byExTag.size} example files\n`);
for (const [exTag, list] of [...byExTag.entries()].sort()) {
  console.log(`## ${exTag}`);
  // dedupe within file
  const seen = new Set();
  for (const i of list) {
    const k = `${i.badTag}::${i.attr}`;
    if (seen.has(k)) continue; seen.add(k);
    console.log(`  • <${i.badTag}> uses unknown attr: ${i.attr}`);
  }
  console.log('');
}
