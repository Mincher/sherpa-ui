/**
 * THE SERVER ENTRY IS PACKED — plan 695 H5. `sherpa-ui/server` as a user gets it:
 * the package packed, installed into an empty folder, and a Node server started
 * from it that answers a store's read. TRAP T-a-node-host-is-the-same-handler
 *
 *   npm run build && node --test test/unit/the-server-entry-is-packed.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

test('installed from its tarball, sherpa-ui/server serves a store on node:http', (t) => {
  const work = mkdtempSync(join(tmpdir(), 'sherpa-server-pack-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const tarball = execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', work], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').at(-1);
  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'probe', version: '1.0.0', private: true, type: 'module' }));
  // sherpa-ui has no dependency of its own: the install needs no network.
  execFileSync('npm', ['install', '--offline', '--no-audit', '--no-fund', join(work, tarball)], { cwd: work, stdio: 'pipe' });
  writeFileSync(join(work, 'serve.mjs'), `
    import { createServer } from 'node:http';
    import { ArrayStore, defineStores } from 'sherpa-ui/data';
    import { DATA_BASE, createDataHandler, nodeHandler } from 'sherpa-ui/server';
    const stores = defineStores(() => ({ people: new ArrayStore([{ id: 1, name: 'Ada' }], { key: 'id' }) }));
    const server = createServer(nodeHandler(createDataHandler({ stores, host: 'server' })));
    server.listen(0, '127.0.0.1', async () => {
      const at = 'http://127.0.0.1:' + server.address().port + DATA_BASE + 'people';
      const facts = await (await fetch(at)).json();
      const rows = await (await fetch(at, { method: 'QUERY', headers: { 'Content-Type': 'application/vnd.sherpa.query+json' }, body: '{}' })).json();
      console.log(JSON.stringify({ key: facts.key, total: rows.total }));
      server.close();
    });
  `);
  const out = execFileSync('node', ['serve.mjs'], { cwd: work, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), { key: 'id', total: 1 });
});
