import { test, expect } from './harness';

/**
 * A PAGE OPENING IS A LOAD — TODO 343. A remote source reads its whole set in
 * openSource(), before the provider can hear it, so open() marks the cards
 * itself after 300 ms; a page left while it opens marks nothing.
 * TRAP T-a-container-shows-its-datas-state
 */
const RUN = (leaveAt: number | null) => `(async () => {
  const { ArrayStore, spoofRemote } = await import('/dist/index.js');
  const root = document.getElementById('root');
  root.innerHTML = '';
  const provider = document.createElement('sherpa-provider');
  provider.innerHTML = '<sherpa-container><sherpa-data-grid></sherpa-data-grid></sherpa-container>';
  root.append(provider);
  const card = provider.querySelector('sherpa-container');
  const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: 'n' + i }));
  const store = spoofRemote(new ArrayStore(rows, { key: 'id' }), { delay: 700 });
  const page = { v: 1, id: 't', source: { store: 's', fields: { name: { label: 'Name' } } } };
  const seen = [];
  const watch = setInterval(() => seen.push(card.hasAttribute('data-loading')), 25);
  const opened = provider.open(page, { stores: { s: store } });
  ${leaveAt === null ? '' : `setTimeout(() => provider.close(), ${leaveAt});`}
  await opened;
  await new Promise((done) => setTimeout(done, 900));
  clearInterval(watch);
  return { marked: seen.some(Boolean), after: card.hasAttribute('data-loading') };
})()`;

test('a slow page opening shows its card loading, and the first answer clears it', async ({ page }) => {
  const r = await page.evaluate(RUN(null)) as { marked: boolean; after: boolean };
  expect(r).toEqual({ marked: true, after: false });
});

test('a page left while it opens never marks a card', async ({ page }) => {
  const r = await page.evaluate(RUN(100)) as { marked: boolean; after: boolean };
  expect(r).toEqual({ marked: false, after: false });
});
