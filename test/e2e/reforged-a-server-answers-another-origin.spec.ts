import { test, expect } from './harness';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A SERVER ANSWERS ANOTHER ORIGIN BY THE APP'S POLICY — plan 695 H5. A Node host
 * (`sherpa-ui/server`) on another origin than the page: an allowed page reads and
 * writes through its preflights — `QUERY` and the app's own header among them — and a
 * refused one reads `refused`, never offline; a host that is gone is offline. Each
 * engine's worker starts its own host, on a port the system picks.
 * TRAP T-a-preflight-is-the-apps-to-answer · TRAP T-a-node-host-is-the-same-handler
 */
type ServerEntry = typeof import('/dist/server.js');
type DataEntry = typeof import('/dist/data.js');
const lib = async <T>(file: string): Promise<T> => (await import(new URL(`../../dist/${file}`, import.meta.url).href)) as T;

const policy = { allow: [] as string[] };
const heard: string[] = [];
let host: Server;
let api = '';
let gone = '';

test.beforeAll(async () => {
  const { createDataHandler, nodeHandler } = await lib<ServerEntry>('server.js');
  const { ArrayStore, defineStores } = await lib<DataEntry>('data.js');
  const stores = defineStores(() => ({ people: new ArrayStore([{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }], { key: 'id' }) }));
  const handle = createDataHandler({ stores, host: 'server', cors: { origins: (origin) => policy.allow.includes(origin), headers: ['X-App'] } });
  host = createServer(nodeHandler((request) => {
    heard.push(request.method);
    return handle(request);
  }));
  await new Promise<void>((up) => host.listen(0, '127.0.0.1', up));
  api = `http://127.0.0.1:${(host.address() as AddressInfo).port}`;
  // A port that was a host's a moment ago, and is no one's now.
  const once = createServer();
  await new Promise<void>((up) => once.listen(0, '127.0.0.1', up));
  gone = `http://127.0.0.1:${(once.address() as AddressInfo).port}`;
  await new Promise((down) => once.close(down));
});

test.afterAll(() => new Promise((down) => {
  host.closeAllConnections();
  host.close(down);
}));

/** Open the people store on an origin from the page, and do `act` with it. */
const fromPage = (page: import('@playwright/test').Page, origin: string, act: string) => page.evaluate(`(async () => {
  const { failureOf, openRequestStore } = await import('/dist/index.js');
  try {
    const store = await openRequestStore({ name: 'people', origin: ${JSON.stringify(origin)}, send: (r) => fetch(r), headers: () => ({ 'X-App': 'mine' }) });
    ${act}
  } catch (error) {
    return { failed: failureOf(error).kind };
  }
})()`);

test('an allowed origin reads and writes across, QUERY and the app\'s header through its preflight', async ({ page, baseURL }) => {
  policy.allow = [new URL(baseURL!).origin];
  heard.length = 0;
  const r = await fromPage(page, api, `
    const read = await store.load({ sort: [{ field: 'name', direction: 'desc' }] });
    const row = await store.update(2, { name: 'Bea' });
    return { names: read.rows.map((x) => x.name), total: read.total, row: row.name };
  `);
  expect(r).toEqual({ names: ['Bo', 'Ada'], total: 2, row: 'Bea' });
  // Each preflighted, and the read went as QUERY: no fallback to POST.
  expect(heard.filter((m) => m !== 'OPTIONS')).toEqual(['GET', 'QUERY', 'PATCH']);
  expect(heard).toContain('OPTIONS');
});

test('a refused origin reads refused, never offline', async ({ page }) => {
  policy.allow = [];
  expect(await fromPage(page, api, 'return { opened: true };')).toEqual({ failed: 'refused' });
});

test('a host that is gone reads offline', async ({ page }) => {
  expect(await fromPage(page, gone, 'return { opened: true };')).toEqual({ failed: 'offline' });
});
