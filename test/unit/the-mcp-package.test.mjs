/**
 * The MCP ships as its own package, sherpa-ui-mcp (TODO 192), and reads the
 * sherpa-ui installed beside it: sherpa-ui packs every file it reads and no
 * Figma file; the MCP packs its own code, imports nothing outside its folder
 * and depends on every package it imports, and on the two it reads by path.
 * `npm run check:mcp-pack` installs them and calls everything; this checks the
 * file lists, with no network.
 * TRAP T-the-mcp-reads-sherpa-ui-through-one-door
 *
 *   node --test test/unit/the-mcp-package.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mcpGraph } from '../../scripts/check-mcp-pack.mjs';
import { IMPORTS, READS, components, patterns, schemaVersion } from '../../mcp-server/lib/sherpa.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** The contracts plan 700 serves. */
const SCHEMAS = ['app', 'page', 'views', 'workflow', 'defs', 'component', 'example', 'pattern'];
/** What `npm pack` would ship. */
const packed = (cwd) => new Set(JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd, encoding: 'utf8' }))[0]
  .files.map((f) => f.path));

test('sherpa-ui packs every file the MCP reads and every entry it runs, no Figma file and no MCP of its own', () => {
  const files = packed(ROOT);
  const { exports } = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'));
  for (const name of IMPORTS) {
    const file = exports[`.${name.slice('sherpa-ui'.length)}`]?.default?.replace(/^\.\//, '');
    assert.ok(file && files.has(file), `sherpa-ui does not pack ${name} (${file})`);
  }
  const fill = (pattern, vars) => pattern.replace(/\{(\w+)\}/g, (_, v) => vars[v]);
  const want = new Set();
  for (const [key, pattern] of Object.entries(READS)) {
    if (key === 'schema') for (const name of SCHEMAS) want.add(fill(pattern, { name, v: schemaVersion(name) }));
    else if (key === 'pattern') for (const name of patterns()) want.add(fill(pattern, { name }));
    else if (!pattern.includes('{')) want.add(pattern);
    else for (const { name } of components()) for (const kind of ['ts', 'html', 'css']) want.add(fill(pattern, { name, kind }));
  }
  for (const file of want) assert.ok(files.has(file), `sherpa-ui does not pack ${file}`);
  assert.deepEqual([...files].filter((f) => /figma/i.test(f)), []);
  assert.ok(!files.has('docs/DEF-TO-FIGMA-BUILD-RULES.md'));
  assert.ok(![...files].some((f) => f.startsWith('mcp-server/')), 'sherpa-ui still packs mcp-server/');
  assert.equal(JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).bin?.['sherpa-mcp'], undefined);
});

test('sherpa-ui-mcp packs the code it imports, nothing outside its folder, and depends on every package it imports', () => {
  const files = packed(`${ROOT}mcp-server`);
  const { files: code, outside } = mcpGraph();
  for (const file of code) {
    assert.ok(file.startsWith('mcp-server/'), `the MCP imports ${file}, which an installed package has not got`);
    assert.ok(files.has(file.slice('mcp-server/'.length)), `sherpa-ui-mcp does not pack ${file}`);
  }
  assert.ok(![...files].some((f) => f.startsWith('vendor/')), 'the MCP copies nothing of sherpa-ui');
  // A skill is served as its prompt, and read from the package as it ships (Q8).
  assert.ok(files.has('skills/build-page/SKILL.md'), 'sherpa-ui-mcp does not pack its build-page skill');
  const pkg = JSON.parse(readFileSync(`${ROOT}mcp-server/package.json`, 'utf8'));
  assert.equal(pkg.name, 'sherpa-ui-mcp');
  // A new app's .mcp.json starts this file. TRAP T-a-starter-is-one-folder
  assert.equal(pkg.bin['sherpa-mcp'], './index.js');
  // sherpa-ui, and create-sherpa-ui for scaffold_app, are read by path through the door, not imported.
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), [...outside, 'sherpa-ui', 'create-sherpa-ui'].sort());
});
