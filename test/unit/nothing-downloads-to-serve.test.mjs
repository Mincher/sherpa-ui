/**
 * `sherpa-ui serve` — a folder over HTTP with Node alone, so running a page
 * downloads nothing (it was an unpinned `npx --yes serve`).
 * TRAP T-nothing-downloads-to-serve · TRAP T-a-cli-is-run-through-a-link
 *
 *   node --test test/unit/nothing-downloads-to-serve.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '../../bin/sherpa-ui.mjs';

const folder = mkdtempSync(join(tmpdir(), 'sherpa-serve-'));
writeFileSync(join(folder, 'index.html'), '<p>home</p>');
mkdirSync(join(folder, 'app'));
writeFileSync(join(folder, 'app', 'index.html'), '<p>app</p>');
writeFileSync(join(folder, 'app', 'page.js'), 'export const a = 1;');
writeFileSync(join(folder, 'app', 'page.css'), ':host { color: red; }');

test('it serves a folder: pages, modules and sheets with their types; a folder is its index', async (t) => {
  const server = await serve(folder, { port: 0 });
  t.after(() => server.close());
  const at = `http://localhost:${server.address().port}`;
  const home = await fetch(`${at}/`);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(await home.text(), '<p>home</p>');
  assert.equal((await fetch(`${at}/app/page.js`)).headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal((await fetch(`${at}/app/page.css`)).headers.get('content-type'), 'text/css; charset=utf-8');
  const bare = await fetch(`${at}/app`, { redirect: 'manual' });
  assert.deepEqual([bare.status, bare.headers.get('location')], [301, '/app/']);
  assert.equal(await (await fetch(`${at}/app/`)).text(), '<p>app</p>');
});

test('nothing outside the folder, nothing missing, and only reads', async (t) => {
  const server = await serve(folder, { port: 0 });
  t.after(() => server.close());
  const at = `http://localhost:${server.address().port}`;
  assert.equal((await fetch(`${at}/..%2f..%2fetc%2fpasswd`)).status, 403);
  assert.equal((await fetch(`${at}/nope.html`)).status, 404);
  assert.equal((await fetch(`${at}/`, { method: 'POST' })).status, 405);
  const head = await fetch(`${at}/app/page.js`, { method: 'HEAD' });
  assert.deepEqual([head.status, head.headers.get('content-length')], [200, '19']);
});

test('the CLI runs through a link, as npx and node_modules/.bin run it', () => {
  const link = join(mkdtempSync(join(tmpdir(), 'sherpa-bin-')), 'sherpa-ui');
  symlinkSync(fileURLToPath(new URL('../../bin/sherpa-ui.mjs', import.meta.url)), link);
  const run = spawnSync(process.execPath, [link], { encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /npx sherpa-ui serve/);
});
