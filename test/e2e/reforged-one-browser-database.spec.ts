import { test, expect, type Page } from './harness';

/**
 * ONE SHERPA DATABASE in the browser (plan 695 H3): every part that keeps data —
 * an IdbStore's rows, its seed mark, a kept set, an outbox, the kept notices, the
 * saved Views — keeps it in one database, made in one upgrade, which the page and
 * the worker open alike. Bugs 2 and 3 of the architecture review.
 * TRAP T-one-browser-database
 */

/** Run `body` in a module Worker of this page's origin, with `/dist/data.js` as `data`. */
const inWorker = (page: Page, body: string): Promise<unknown> => page.evaluate(async (code) => {
  const source = `const data = await import('${location.origin}/dist/data.js');
    try { postMessage({ ok: await (async () => { ${code} })() }); }
    catch (error) { postMessage({ error: String(error) }); }`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url, { type: 'module' });
  try {
    const said = await new Promise<{ ok?: unknown; error?: string }>((done, fail) => {
      worker.onmessage = (event) => done(event.data);
      worker.onerror = (event) => fail(new Error(event.message || 'the worker failed to start'));
    });
    if (said.error) throw new Error(said.error);
    return said.ok;
  } finally {
    worker.terminate();
    URL.revokeObjectURL(url);
  }
}, body);

test('two stores share the one database: each keeps its own rows (bug 2)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { IdbStore } = await import('/dist/index.js');
    const alpha = new IdbStore({ name: 'alpha', key: 'id' });
    const beta = new IdbStore({ name: 'beta', key: 'id' });
    await alpha.insert({ id: 1, n: 'a' });
    // Before: the second store's object store was never made, so this threw NotFoundError.
    await beta.insert({ id: 1, n: 'b' });
    await beta.insert({ id: 2, n: 'b2' });
    await alpha.clear();
    await alpha.insert({ id: 3, n: 'a3' });
    return { alpha: (await alpha.load()).rows, beta: (await beta.load()).rows };
  });
  expect(r).toEqual({ alpha: [{ id: 3, n: 'a3' }], beta: [{ id: 1, n: 'b' }, { id: 2, n: 'b2' }] });
});

test('in a worker, a new seed version re-seeds: the mark lives in the database (bug 3)', async ({ page }) => {
  const seeded = await inWorker(page, `
    const seed = (name, seedVersion) => data.localRecords({ name: 'people', key: 'id', seed: [{ id: 1, name }], seedVersion });
    const one = seed('old', 1);
    await one.ready;
    const two = seed('new', 2);
    await two.ready;
    return (await two.store.byKey(1)).name;
  `);
  // Before: a worker has no localStorage, so the mark read as unknown and the seed never moved.
  expect(seeded).toBe('new');

  // The page and the worker read ONE mark: a page's seed, at the same version, stays as edited.
  await page.evaluate(async () => {
    const { localRecords } = await import('/dist/index.js');
    const { store, ready } = localRecords({ name: 'people', key: 'id', seed: [{ id: 1, name: 'new' }], seedVersion: 2 });
    await ready;
    await store.update(1, { name: 'edited' });
  });
  const kept = await inWorker(page, `
    const { store, ready } = data.localRecords({ name: 'people', key: 'id', seed: [{ id: 1, name: 'new' }], seedVersion: 2 });
    await ready;
    return (await store.byKey(1)).name;
  `);
  expect(kept).toBe('edited');
});

test('every part keeps its data in ONE database, with one fixed schema', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { IdbStore, localRecords, keepCache, keepOutbox, PageKeeper, fakeRemote, ArrayStore, DataSource } = await import('/dist/index.js');
    const { keepNotices } = await import('/dist/core/browser/notice-keep.js');
    const { DATABASE } = await import('/dist/core/browser/database.js');
    await new IdbStore({ name: 'things', key: 'id' }).insert({ id: 1 });
    await localRecords({ name: 'seeded', key: 'id', seed: [{ id: 1 }] }).ready;
    await keepOutbox('writes').add({ id: '1', type: 'update', key: 1, values: { n: 1 }, at: 1 });
    await keepNotices().put({ kind: 'lost', id: 'n1', store: 'writes', key: 1 });
    localStorage.clear();
    const keeper = new PageKeeper({ database: true });
    keeper.write('records', { views: { mine: { label: 'Mine' } } });
    await keeper.flush();
    const remote = fakeRemote(new ArrayStore([{ id: 1 }], { key: 'id' }), { delay: 0, announcesAll: false });
    await keepCache(remote, { name: 'kept' }).ready;
    await new DataSource({ store: remote }).load();
    // A kept set is written once quiet, in idle time.
    await new Promise((done) => setTimeout(done, 3200));

    const names = (await indexedDB.databases()).map((db) => db.name).sort();
    const counts = await new Promise<Record<string, number>>((done, fail) => {
      const open = indexedDB.open(DATABASE);
      open.onerror = () => fail(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const stores = [...db.objectStoreNames];
        const tx = db.transaction(stores);
        const out: Record<string, number> = {};
        for (const name of stores) {
          const asked = tx.objectStore(name).count();
          asked.onsuccess = () => { out[name] = asked.result; };
        }
        tx.oncomplete = () => { db.close(); done(out); };
      };
    });
    return { names, DATABASE, counts };
  });
  expect(r.names).toEqual([r.DATABASE]);
  expect(r.counts).toEqual({ notices: 1, outbox: 1, rows: 2, seeds: 1, sets: 1, views: 1 });
});

test('Sherpa never asks the device to keep its data; the app does, with keepData (Will, H3: B)', async ({ page }) => {
  await page.addInitScript(() => {
    const said = { persisted: 0, persist: 0 };
    (globalThis as { __asked?: typeof said }).__asked = said;
    // On the prototype: WebKit may drop a wrapper's own properties when it collects it.
    StorageManager.prototype.persisted = () => { said.persisted += 1; return Promise.resolve(false); };
    StorageManager.prototype.persist = () => { said.persist += 1; return Promise.resolve(true); };
  });
  await page.reload();
  const r = await page.evaluate(async () => {
    const { IdbStore, keepData, localRecords } = await import('/dist/index.js');
    await new IdbStore({ name: 'one', key: 'id' }).insert({ id: 1 });
    await localRecords({ name: 'three', key: 'id', seed: [{ id: 1 }] }).ready;
    const opened = { ...(globalThis as { __asked?: object }).__asked };
    const kept = await keepData();
    return { opened, kept, asked: (globalThis as { __asked?: unknown }).__asked };
  });
  expect(r.opened).toEqual({ persisted: 0, persist: 0 });
  expect(r.kept).toBe(true);
  expect(r.asked).toEqual({ persisted: 1, persist: 1 });
});
