/**
 * A REMOTE STORE SAYS WHAT CHANGED — 345 phase 9. A store that may miss a
 * writer and says `changes` is asked what moved since its mark — when a page
 * opens again or its tab is shown, never on a toggle — and only the moved
 * columns are read again. TRAP T-a-remote-store-says-what-changed
 *
 *   node --test test/unit/a-remote-store-says-what-changed.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, RestStore, bindSource, spoofRemote } from '../../dist/data.js';

const ROWS = [{ id: 1, owner: 'Ann', plan: 'Pro' }, { id: 2, owner: 'Bo', plan: 'Free' }];
const shown = (id) => Object.assign(new EventTarget(), {
  id, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {},
});
const settle = () => new Promise((r) => setTimeout(r, 0));

test('a write the page missed shows after a recheck, by its column alone', async () => {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const loads = [];
  const load = inner.load.bind(inner);
  inner.load = (o = {}) => { loads.push(o.fields ?? 'all'); return load(o); };
  let deaf = false;
  const store = spoofRemote(inner, { delay: 0, announcesAll: false, missed: () => deaf });
  const source = new DataSource({ store });
  bindSource(source, shown('grid'), {});
  await source.load();
  assert.equal(loads.length, 1);

  deaf = true;
  await inner.update(2, { owner: 'Cy' });
  deaf = false;
  await settle();
  assert.equal(source.rows[1].owner, 'Bo', 'missed: the page does not know');

  source.recheck();
  for (let i = 0; i < 5; i++) await settle();
  await source.load();
  assert.deepEqual(loads, ['all', ['owner']], 'the moved column alone');
  assert.equal(source.rows[1].owner, 'Cy');

  source.recheck();
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(loads.length, 2, 'nothing moved: nothing read');
});

test('a RestStore asks its changesUrl, with the mark it was given', async () => {
  const urls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const body = urls.length === 1 ? { at: 'c7' } : { at: 'c9', rows: false, fields: ['owner'] };
    return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body };
  };
  try {
    const store = new RestStore({ url: 'https://x.test/rows', key: 'id', changesUrl: 'https://x.test/changes' });
    assert.deepEqual(await store.changes(), { at: 'c7', rows: false, fields: 'all' });
    assert.deepEqual(await store.changes('c7'), { at: 'c9', rows: false, fields: ['owner'] });
    assert.deepEqual(urls, ['https://x.test/changes', 'https://x.test/changes?since=c7']);
    assert.equal(new RestStore({ url: 'https://x.test/rows', key: 'id' }).changes, undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});
