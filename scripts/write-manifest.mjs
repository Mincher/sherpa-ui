#!/usr/bin/env node
/**
 * write-manifest.mjs — `custom-elements.json` and VS Code's HTML data, written
 * from the component specs. Editors and tools read these to autocomplete and
 * document every `<sherpa-*>` tag. TRAP T-the-manifest-is-written-from-the-specs
 *
 *   npm run manifest          write both files
 *   npm run check:manifest    fail when either is not what the specs make
 *
 * Map:
 * - specs — every component spec, by tag
 * - manifest — the Custom Elements Manifest (schema 2.1.0) for every component
 * - htmlData — VS Code's HTML custom data (version 1.1) for every component
 * - FILES — the two files written, and what makes each
 */
import { readFileSync, writeFileSync, globSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

/** Every component spec, by tag. */
export function specs() {
  return globSync('src/components/*/*.component.json').sort()
    .map((f) => JSON.parse(readFileSync(f, 'utf8')))
    .filter((s) => s.$name?.startsWith('sherpa-'));
}

const className = (tag) => tag.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const typeOf = (p) => (p.values?.length ? p.values.map((v) => `'${v}'`).join(' | ') : p.type);

/** Split an argument list at its top-level commas: `a: Map<K, V>, b?` is two. */
function params(args) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of args ?? '') {
    if ('<([{'.includes(ch)) depth++;
    if ('>)]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((p) => {
    const [, name, opt, type] = /^\s*(\.{3}\w+|\w+)(\?)?\s*(?::\s*([\s\S]+?))?\s*(?:=[\s\S]*)?$/.exec(p) ?? [];
    return {
      name: name ?? p.trim(),
      ...(type ? { type: { text: type.trim() } } : {}),
      ...(opt || /=/.test(p) ? { optional: true } : {}),
    };
  });
}

/** Every `part` named in a spec's anatomy. */
function partsOf(node, out = new Set()) {
  if (Array.isArray(node)) node.forEach((n) => partsOf(n, out));
  else if (node && typeof node === 'object') {
    if (typeof node.part === 'string') node.part.split(/\s+/).forEach((p) => p && out.add(p));
    Object.values(node).forEach((n) => partsOf(n, out));
  }
  return out;
}

const described = (text) => (text ? { description: text } : {});

/** The Custom Elements Manifest (schema 2.1.0) for every component. */
export function manifest(all = specs()) {
  return {
    schemaVersion: '2.1.0',
    readme: 'README.md',
    modules: all.map((s) => {
      const tag = s.$name;
      const path = `dist/components/${tag}/${tag}.js`;
      const ext = s.$extensions?.sherpa ?? {};
      const declaration = {
        kind: 'class',
        name: className(tag),
        tagName: tag,
        customElement: true,
        ...described(s.$description),
        attributes: (s.props ?? []).map((p) => ({
          name: p.name,
          ...described(p.description),
          type: { text: typeOf(p) },
          ...(p.default != null ? { default: JSON.stringify(p.default) } : {}),
        })),
        members: [
          ...(ext.jsProps ?? []).map((p) => ({
            kind: 'field',
            name: p.name,
            type: { text: p.type },
            ...(p.access === 'read' ? { readonly: true } : {}),
            ...described(p.description),
          })),
          ...(ext.methods ?? []).map((m) => ({
            kind: 'method',
            name: m.name,
            parameters: params(m.args),
            ...described(m.description),
          })),
        ],
        events: (s.events ?? []).map((e) => ({
          name: e.name,
          type: { text: e.detail && Object.keys(e.detail).length
            ? `CustomEvent<{ ${Object.entries(e.detail).map(([k, t]) => `${k}: ${t}`).join('; ')} }>`
            : 'CustomEvent' },
        })),
        slots: (s.slots ?? []).map((sl) => ({
          name: sl.name,
          ...described([sl.description, sl.accepts?.length ? `(accepts: ${sl.accepts.join(', ')})` : '']
            .filter(Boolean).join(' ')),
        })),
        cssParts: [...partsOf(s.anatomy)].sort().map((name) => ({ name })),
        cssStates: (s.states ?? [])
          .filter((st) => /:state\(/.test(st.selector ?? ''))
          .map((st) => ({ name: /:state\(([^)]+)\)/.exec(st.selector)[1] })),
      };
      for (const key of ['attributes', 'members', 'events', 'slots', 'cssParts', 'cssStates']) {
        if (!declaration[key].length) delete declaration[key];
      }
      return {
        kind: 'javascript-module',
        path,
        declarations: [declaration],
        exports: [
          { kind: 'js', name: declaration.name, declaration: { name: declaration.name, module: path } },
          { kind: 'custom-element-definition', name: tag, declaration: { name: declaration.name, module: path } },
        ],
      };
    }),
  };
}

/** VS Code's HTML custom data (version 1.1) for every component. */
export function htmlData(all = specs()) {
  return {
    version: 1.1,
    tags: all.map((s) => ({
      name: s.$name,
      description: s.$description ?? '',
      attributes: (s.props ?? []).map((p) => ({
        name: p.name,
        ...described(p.description),
        ...(p.values?.length ? { values: p.values.map((v) => ({ name: String(v) })) } : {}),
        ...(p.type === 'boolean' ? { valueSet: 'v' } : {}),
      })),
    })),
  };
}

/** The two files written, and what makes each. */
export const FILES = { 'custom-elements.json': manifest, 'vscode.html-data.json': htmlData };

const isMain = process.argv[1] && basename(process.argv[1]) === 'write-manifest.mjs';
if (isMain) {
  const check = process.argv.includes('--check');
  const all = specs();
  const stale = [];
  for (const [file, make] of Object.entries(FILES)) {
    const text = `${JSON.stringify(make(all), null, 2)}\n`;
    if (check) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== text) stale.push(file);
    } else writeFileSync(file, text);
  }
  if (check && stale.length) {
    console.error(`check:manifest — not what the specs make: ${stale.join(', ')}. Run: npm run manifest`);
    process.exit(1);
  }
  console.log(`${check ? 'check:manifest' : 'manifest'} — ${all.length} components${check ? ' match' : ' written'}`);
}
