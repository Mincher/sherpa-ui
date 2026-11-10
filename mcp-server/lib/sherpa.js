/**
 * sherpa.js — every file the MCP reads: sherpa-ui's, the installed package or
 * the checkout it sits in, each named in READS, every built entry it runs, in
 * IMPORTS, and the build it serves a preview, in SERVES; an app's, inside its
 * folder; and the Starter that makes one.
 * TRAP T-the-mcp-reads-sherpa-ui-through-one-door
 *
 * Map:
 * - SHERPA_ROOT — sherpa-ui's folder: the installed package, else this checkout
 * - READS — every sherpa-ui file the MCP reads, by its path in the package
 * - IMPORTS — every built entry of sherpa-ui the MCP runs, by its export
 * - imported — one of those entries, as an app imports it; it throws, in words to act on, when it is not built
 * - has — whether one of those files is there
 * - read — one of those files as text; null when it is not there
 * - load — one of those files that is code, as a module, run as it ships; null when it is not there
 * - SERVES — the folder of sherpa-ui a preview's browser is served, as an app serves it: the build
 * - served — a file of that folder, by its path in it, as bytes; null when not there or outside it
 * - components — every element the package defines, from its custom-elements.json
 * - spec — a component's spec; null for a name that is no component
 * - example — a component's example, its markup joined; null when it has none
 * - schemaVersion — a contract's newest version on disk: 2 for workflow.v2.json; null, none
 * - readSchema — a contract by name, at its newest version, as text; null when there is none
 * - schemas — each contract in schemas/ by name, at its newest version, with its own title
 * - patterns — the name of each pattern sherpa-ui ships in patterns/, in order
 * - tokens — every token tokens.css declares: its layer, first value and how often it is set
 * - appFile — a file of an app's, by its path from the app's folder; null when not there or outside it
 * - appFiles — the files in one folder of an app's, by name, in order; none when it is not there or outside it
 * - starterFiles — a new app's files, as create-sherpa-ui writes them; null where it is not installed
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** A package's folder, where this package can resolve it; null where it cannot. */
const installed = (name) => {
  try {
    return path.dirname(createRequire(import.meta.url).resolve(`${name}/package.json`));
  } catch {
    return null;
  }
};

/** sherpa-ui's folder: the installed package, else this checkout. */
export const SHERPA_ROOT = installed('sherpa-ui') ?? fileURLToPath(new URL('../..', import.meta.url));

/** Every sherpa-ui file the MCP reads, by its path in the package. */
export const READS = {
  manifest: 'custom-elements.json',
  schema: 'schemas/{name}.v{v}.json',
  spec: 'src/components/{name}/{name}.component.json',
  example: 'src/components/{name}/{name}.example.json',
  source: 'src/components/{name}/{name}.{kind}',
  appGuide: 'docs/APP-GUIDE.md',
  dataRules: 'docs/DATA-SOURCE-RULES.md',
  tokens: 'src/styles/tokens/tokens.css',
  pattern: 'patterns/{name}.json',
  // Code that no export names, run by path: check_usage is `npx sherpa-ui check-usage`'s own check.
  usage: 'scripts/check-usage.mjs',
};

/** Every built entry of sherpa-ui the MCP runs, by its export. */
export const IMPORTS = ['sherpa-ui/data', 'sherpa-ui/server'];

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

/** One of those files that is code, as a module, run as it ships; null when it is not there. A built entry is `imported`. */
export const load = async (key) => (has(key) ? import(pathToFileURL(where(key, {})).href) : null);

/** The folder of sherpa-ui a preview's browser is served, as an app serves it: the build. */
export const SERVES = 'dist';

/** A file of that folder, by its path in it, as bytes; null when it
 *  is not there, or the path leaves the folder. */
export function served(rel) {
  const root = path.join(SHERPA_ROOT, SERVES);
  const file = path.resolve(root, String(rel ?? ''));
  if (!file.startsWith(root + path.sep) || !existsSync(file) || !statSync(file).isFile()) return null;
  return readFileSync(file);
}

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

/** A contract file's name and version: `workflow`, 2 for workflow.v2.json. */
const versioned = (file) => {
  const m = /^(.+)\.v(\d+)\.json$/.exec(file);
  return m ? { name: m[1], v: Number(m[2]) } : null;
};

/** A contract's newest version on disk: 2 for workflow.v2.json; null, none. */
export function schemaVersion(name) {
  const vs = readdirSync(path.join(SHERPA_ROOT, path.dirname(READS.schema))).flatMap((f) => (versioned(f)?.name === name ? [versioned(f).v] : []));
  return vs.length ? Math.max(...vs) : null;
}

/** A contract by name, at its newest version, as text; null when there is none. */
export function readSchema(name) {
  const v = schemaVersion(name);
  return v === null ? null : read('schema', { name, v: String(v) });
}

/** Each contract in schemas/ by name, at its newest version — `page` for page.v1.json, `workflow` for workflow.v2.json —
 *  with its own title. */
export function schemas() {
  const names = new Set(readdirSync(path.join(SHERPA_ROOT, path.dirname(READS.schema))).flatMap((f) => versioned(f)?.name ?? []));
  return [...names].sort().map((name) => ({ name, title: JSON.parse(readSchema(name)).title ?? name }));
}

/** The name of each pattern sherpa-ui ships in patterns/, in order: `records-list` for records-list.json. */
export function patterns() {
  const dir = path.join(SHERPA_ROOT, path.dirname(READS.pattern));
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => f.slice(0, -'.json'.length)).filter((n) => SEGMENT.test(n));
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

/** A file of an app's, by its path from the app's folder, as text; null when it
 *  is not there, or the path leaves the folder: an app.json names its own files. */
export function appFile(folder, rel) {
  const root = path.resolve(folder);
  const file = path.resolve(root, String(rel ?? ''));
  if (!file.startsWith(root + path.sep) || !existsSync(file) || !statSync(file).isFile()) return null;
  return readFileSync(file, 'utf8');
}

/** The files in one folder of an app's, by name, in order; none when it is not there, or the path leaves the app's folder. */
export function appFiles(folder, rel) {
  const root = path.resolve(folder);
  const dir = path.resolve(root, String(rel ?? ''));
  if (!dir.startsWith(root + path.sep) || !existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir).filter((f) => statSync(path.join(dir, f)).isFile()).sort();
}

/** Every file under a folder, by its path from it with `/`, and its text, in order. */
const filesUnder = (root) => readdirSync(root, { recursive: true }).map(String).sort()
  .filter((rel) => statSync(path.join(root, rel)).isFile())
  .map((rel) => ({ path: rel.split(path.sep).join('/'), text: readFileSync(path.join(root, rel), 'utf8') }));

/**
 * A new app's files, as create-sherpa-ui writes them, named `name`: its own
 * `init` writes them into a temporary folder, and they are read back from it.
 * create-sherpa-ui is installed beside this package, else the checkout's
 * sibling Starter; null where neither is. TRAP T-a-starter-is-one-folder
 */
export async function starterFiles(name) {
  const root = installed('create-sherpa-ui') ?? path.resolve(SHERPA_ROOT, '..', 'Sherpa Starter');
  const entry = path.join(root, 'index.mjs');
  if (!existsSync(entry)) return null;
  const { init } = await import(pathToFileURL(entry).href);
  const work = mkdtempSync(path.join(tmpdir(), 'sherpa-scaffold-'));
  try {
    return filesUnder(init(path.join(work, String(name).replace(/[^A-Za-z0-9-]+/g, '-') || 'sherpa-app')));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
