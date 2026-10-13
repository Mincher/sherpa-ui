/**
 * The MCP ships as its own package, sherpa-ui-mcp, and sherpa-ui ships every
 * file it reads (TODO 192). `npm run check:mcp-pack` installs both and calls
 * everything; this checks the two file lists, with no network.
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

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const packed = (cwd) => new Set(JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd, encoding: 'utf8' }))[0]
  .files.map((f) => f.path));

test('sherpa-ui ships every file the MCP imports or reads, and no MCP of its own', () => {
  const files = packed(ROOT);
  const { sherpa } = mcpGraph();
  for (const file of [...sherpa, ...READS]) assert.ok(files.has(file), `sherpa-ui does not pack ${file}`);
  assert.ok(![...files].some((f) => f.startsWith('mcp-server/')), 'sherpa-ui still packs mcp-server/');
  assert.equal(JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).bin?.['sherpa-mcp'], undefined);
});

test('sherpa-ui-mcp ships its own code, and depends on every package it imports', () => {
  const files = packed(`${ROOT}mcp-server`);
  const { mcp, outside } = mcpGraph();
  for (const file of mcp) assert.ok(files.has(file.replace(/^mcp-server\//, '')), `sherpa-ui-mcp does not pack ${file}`);
  const pkg = JSON.parse(readFileSync(`${ROOT}mcp-server/package.json`, 'utf8'));
  assert.equal(pkg.name, 'sherpa-ui-mcp');
  assert.equal(pkg.bin['sherpa-mcp'], './index.js');
  const declared = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies ?? {})]);
  for (const name of outside) assert.ok(declared.has(name), `sherpa-ui-mcp imports ${name} but does not depend on it`);
  assert.ok(declared.has('sherpa-ui'));
});
