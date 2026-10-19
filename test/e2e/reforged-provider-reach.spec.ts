import { test, expect } from './harness';

/**
 * THE PROVIDER SAYS WHETHER THE PAGE'S DATA CAN BE REACHED — TODO 345 phase 4.5.
 * The worst of its sources', read from their state, said by `reach-change`.
 * TRAP T-the-provider-says-the-pages-reach
 */
const SETUP = `
  const { ArrayStore, HttpError, spoofRemote } = await import('/dist/index.js');
  const settle = () => window.__settled();
  const tick = (ms = 60) => new Promise((d) => setTimeout(d, ms));
  const root = document.getElementById('root');
  root.innerHTML = '';
  const provider = document.createElement('sherpa-provider');
  provider.innerHTML = '<sherpa-container><sherpa-data-grid></sherpa-data-grid></sherpa-container>';
  root.append(provider);
  const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: 'n' + i }));
  const net = { down: false, refuse: false };
  const inner = new ArrayStore(rows, { key: 'id' });
  const store = spoofRemote(inner, { delay: 0, fail: () => (net.down ? 1 : 0) });
  const page = { v: 1, id: 't', source: { store: 's', fields: { name: { label: 'Name' } } } };
  const heard = [];
  provider.addEventListener('reach-change', (e) => heard.push(e.detail.reach + (e.detail.failure ? ':' + e.detail.failure.kind : '')));
`;

test('a store that stops answering: the page is unreached, then ok when the network is back', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const source = await provider.open(page, { stores: { s: store } });
    await settle();
    net.down = true;
    await source.load({ force: true });
    await tick();
    const mid = provider.reach.reach;
    net.down = false;
    window.dispatchEvent(new Event('online'));
    await tick();
    return { mid, end: provider.reach.reach, heard };
  })()`);
  expect(r).toEqual({ mid: 'unreached', end: 'ok', heard: ['unreached:offline', 'ok'] });
});

test('down from the start: the page is down; two opens over it say nothing between', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    net.down = true;
    await provider.open(page, { stores: { s: store } });
    await settle();
    await tick();
    const first = provider.reach.reach;
    provider.close({ next: true });
    await provider.open(page, { stores: { s: store } });
    await settle();
    await tick();
    return { first, again: provider.reach.reach, heard };
  })()`);
  expect(r).toEqual({ first: 'down', again: 'down', heard: ['down:offline'] });
});

test('a refusal is not a reach failure: the store answered', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const refusing = Object.assign(new EventTarget(), {
      key: 'id', remote: true, reportsTotal: true, announcesAll: true,
      load: async (o = {}) => { if (net.refuse) throw new HttpError(401, 'Unauthorized', '/api'); return { rows: rows.slice(0, o.take ?? 5), total: 5 }; },
      totalCount: async () => 5, byKey: async () => undefined, insert: async () => ({}), update: async () => ({}), remove: async () => {},
    });
    const source = await provider.open(page, { stores: { s: refusing } });
    await settle();
    net.refuse = true;
    await source.load({ force: true });
    await tick();
    return { reach: provider.reach.reach, heard };
  })()`);
  expect(r).toEqual({ reach: 'ok', heard: [] });
});
