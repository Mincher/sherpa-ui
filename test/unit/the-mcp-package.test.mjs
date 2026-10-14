/**
 * The MCP ships as its own package, sherpa-ui-mcp (TODO 192). sherpa-ui ships
 * the DATA it reads; the MCP carries its own copy of the generation CODE, made
 * as it is packed (TODO 298). `npm run check:mcp-pack` installs both and calls
 * everything; this checks the file lists, with no network.
 * TRAP T-the-mcp-reads-sherpa-ui-through-one-door
 *
 *   node --test test/unit/the-mcp-package.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { READS, mcpGraph } from '../../scripts/check-mcp-pack.mjs';
import { CODE } from '../../mcp-server/scripts/vendor.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** What `npm pack` would ship. The MCP's own scripts run: its prepack makes vendor/. */
const packed = (cwd, scripts = false) => new Set(JSON.parse(execFileSync('npm',
  ['pack', '--dry-run', '--json', ...(scripts ? [] : ['--ignore-scripts'])], { cwd, encoding: 'utf8' }))[0]
  .files.map((f) => f.path));

test('sherpa-ui ships the data the MCP reads, none of its code, and no MCP of its own', () => {
  const files = packed(ROOT);
  const { sherpa } = mcpGraph();
  for (const file of READS) assert.ok(files.has(file), `sherpa-ui does not pack ${file}`);
  for (const file of sherpa) assert.ok(!files.has(file), `sherpa-ui still packs the MCP's code ${file}`);
  assert.ok(![...files].some((f) => f.startsWith('mcp-server/')), 'sherpa-ui still packs mcp-server/');
  assert.equal(JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).bin?.['sherpa-mcp'], undefined);
});

test('sherpa-ui-mcp ships its own code and a copy of the generation code, and depends on every package it imports', () => {
  const files = packed(`${ROOT}mcp-server`, true);
  const { mcp, sherpa, outside } = mcpGraph();
  for (const file of mcp) assert.ok(files.has(file.replace(/^mcp-server\//, '')), `sherpa-ui-mcp does not pack ${file}`);
  // The copy is exactly what it imports: a new import cannot be forgotten.
  assert.deepEqual([...CODE].sort(), sherpa);
  for (const file of sherpa) assert.ok(files.has(`vendor/${file}`), `sherpa-ui-mcp does not carry ${file}`);
  const pkg = JSON.parse(readFileSync(`${ROOT}mcp-server/package.json`, 'utf8'));
  assert.equal(pkg.name, 'sherpa-ui-mcp');
  assert.equal(pkg.bin['sherpa-mcp'], './index.js');
  const declared = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies ?? {})]);
  for (const name of outside) assert.ok(declared.has(name), `sherpa-ui-mcp imports ${name} but does not depend on it`);
  assert.ok(declared.has('sherpa-ui'));
});
