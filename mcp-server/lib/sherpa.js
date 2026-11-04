/**
 * sherpa.js — the sherpa-ui this MCP describes: the installed package, or the
 * checkout it sits in. Every file it reads is named in READS, by its path in
 * the package, and read here; every built entry it runs, in IMPORTS.
 * TRAP T-the-mcp-reads-sherpa-ui-through-one-door
 *
 * Map:
 * - SHERPA_ROOT — sherpa-ui's folder: the installed package, else this checkout
 * - READS — every sherpa-ui file the MCP reads, by its path in the package
 * - IMPORTS — every built entry of sherpa-ui the MCP runs, by its export
 * - imported — one of those entries, as an app imports it; it throws, in words to act on, when it is not built
 * - has — whether one of those files is there
 * - read — one of those files as text; null when it is not there
 * - components — every element the package defines, from its custom-elements.json
 * - spec — a component's spec; null for a name that is no component
 * - example — a component's example, its markup joined; null when it has none
 * - schemas — each contract in schemas/ by name, `page` for page.v1.json, with its own title
 * - tokens — every token tokens.css declares: its layer, first value and how often it is set
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const installed = () => {
  try {
    return path.dirname(createRequire(import.meta.url).resolve('sherpa-ui/package.json'));
  } catch {
    return null;
  }
};

/** sherpa-ui's folder: the installed package, else this checkout. */
export const SHERPA_ROOT = installed() ?? fileURLToPath(new URL('../..', import.meta.url));

/** Every sherpa-ui file the MCP reads, by its path in the package. */
export const READS = {
  manifest: 'custom-elements.json',
  schema: 'schemas/{name}.v1.json',
  spec: 'src/components/{name}/{name}.component.json',
  example: 'src/components/{name}/{name}.example.json',
  source: 'src/components/{name}/{name}.{kind}',
  appGuide: 'docs/APP-GUIDE.md',
  dataRules: 'docs/DATA-SOURCE-RULES.md',
  tokens: 'src/styles/tokens/tokens.css',
};

/** Every built entry of sherpa-ui the MCP runs, by its export. */
export const IMPORTS = ['sherpa-ui/data'];

/** One of those entries, as an app imports it: through the package's `exports`. It
 *  throws, in words to act on, when it is not built. */
export async function imported(name) {
  if (!IMPORTS.includes(name)) throw new Error(`${name} is not an entry the MCP runs: ${IMPORTS.join(', ')}`);
  let file;
  try {
    file = createRequire(path.join(SHERPA_ROOT, 'package.json')).resolve(name);
  } catch {
    throw new Error(`${name} is not built in ${SHERPA_ROOT}: run \`npm run build\` there.`);
  }
  return import(pathToFileURL(file).href);
}

/** A name from a caller is one path segment, never a way out of the package. */
const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;

/** Where one of those files is; null when a name in it is not one segment. */
function where(key, vars) {
  let bad = false;
  const rel = READS[key].replace(/\{(\w+)\}/g, (_, v) => {
    if (!SEGMENT.test(vars[v] ?? '')) bad = true;
    return vars[v];
  });
  return bad ? null : path.join(SHERPA_ROOT, rel);
}

/** Whether one of those files is there. */
export const has = (key, vars = {}) => existsSync(where(key, vars) ?? '');

/** One of those files as text; null when it is not there. */
export const read = (key, vars = {}) => (has(key, vars) ? readFileSync(where(key, vars), 'utf8') : null);

/** Every element the package defines, from its custom-elements.json: name, description and import. */
export function components() {
  const manifest = JSON.parse(read('manifest'));
  return manifest.modules.flatMap((m) => {
    // `sherpa-ui/components/<short>` is the package's export for that module.
    const short = m.path.match(/^dist\/components\/sherpa-([^/]+)\//)?.[1];
    return m.declarations.filter((d) => d.customElement).map((d) => ({
      name: d.tagName,
      description: d.description ?? '',
      import: short ? `sherpa-ui/components/${short}` : null,
    }));
  }).sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** A component's spec; null for a name that is no component. */
export function spec(name) {
  const text = read('spec', { name });
  return text && JSON.parse(text);
}

/** A component's example, its markup joined; null when it has none. */
export function example(name) {
  const text = read('example', { name });
  if (!text) return null;
  const ex = JSON.parse(text);
  return { ...ex, html: [ex.html].flat().join('') };
}

/** Each contract in schemas/ by name, `page` for page.v1.json, with its own title. */
export function schemas() {
  const dir = path.join(SHERPA_ROOT, path.dirname(READS.schema));
  return readdirSync(dir).filter((f) => f.endsWith('.v1.json')).sort().map((f) => {
    const name = f.slice(0, -'.v1.json'.length);
    return { name, title: JSON.parse(read('schema', { name })).title ?? name };
  });
}

/** Every token tokens.css declares: its layer, its first value and how many times it is set. */
export function tokens() {
  const out = new Map();
  let layer = '';
  for (const line of (read('tokens') ?? '').split('\n')) {
    const opened = line.match(/^@layer ([\w-]+) \{/);
    if (opened) layer = opened[1];
    for (const [, name, value] of line.matchAll(/(--sherpa-[\w-]+)\s*:\s*([^;{}]+);/g)) {
      const seen = out.get(name);
      if (seen) seen.count++;
      else out.set(name, { name, layer, value: value.trim(), count: 1 });
    }
  }
  return [...out.values()];
}
