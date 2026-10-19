/**
 * spoofRemote reads its delay and its failure rate at each load, so ONE wrapper
 * serves an app while a setting changes; it fails as fetch does (a TypeError),
 * and a dropped wrapper is freed. TRAP T-a-failure-has-a-kind
 *
 *   node --test test/unit/a-spoof-fails-when-told.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ArrayStore, failureOf, spoofRemote } from '../../dist/data.js';

const ROWS = [{ id: 1 }, { id: 2 }];

test('the failure rate is read at each load, and a count fails too', async () => {
  let fail = 0;
  const store = spoofRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: () => 0, fail: () => fail });
  assert.equal((await store.load()).total, 2);
  fail = 1;
  const error = await store.load().catch((e) => e);
  assert.ok(error instanceof TypeError);
  assert.equal(failureOf(error).kind, 'offline');
  await assert.rejects(store.totalCount(), TypeError);
  fail = 0;
  assert.equal(await store.totalCount(), 2);
});

test('a dropped wrapper is freed, and its relay goes at the next change', () => {
  const dist = fileURLToPath(new URL('../../dist/data.js', import.meta.url));
  const script = `
    const { ArrayStore, spoofRemote } = await import(${JSON.stringify(dist)});
    const inner = new ArrayStore([{ id: 1 }], { key: 'id' });
    let removed = 0;
    const remove = inner.removeEventListener.bind(inner);
    inner.removeEventListener = (...a) => { removed++; return remove(...a); };
    for (let i = 0; i < 100; i++) spoofRemote(inner, { delay: 0 });
    const kept = spoofRemote(inner, { delay: 0 });
    let heard = 0;
    kept.addEventListener('change', () => heard++);
    await new Promise((r) => setTimeout(r, 0));
    globalThis.gc();
    await new Promise((r) => setTimeout(r, 0));
    await inner.insert({ id: 2 });
    console.log(JSON.stringify({ removed, heard }));
  `;
  const run = spawnSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout.trim()), { removed: 100, heard: 1 });
});
