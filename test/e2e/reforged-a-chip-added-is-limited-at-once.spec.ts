import { test, expect } from './harness';

/**
 * A CHIP ADDED IS LIMITED AT ONCE — TODO 981. A field a reader adds to a card's bar offers only what the View leaves,
 * as soon as its chip draws: not at the next pick, and not every value until then.
 */
const PAGE = `{
  v: 1, id: 'accounts',
  source: {
    store: 'accounts',
    fields: Object.fromEntries(['customer', 'health', 'plan'].map((f) => [f, { label: f, start: 'all' }])),
    scopes: { view: { label: 'View Context', holds: ['customer'] }, data: { label: 'Rows', offers: 'all', holds: ['plan'] } },
  },
}`;
test.use({ viewport: { width: 1800, height: 800 } });

test('a chip added to a card\'s bar offers what the View leaves once it draws, with no pick and no load', async ({ page }) => {
  const present = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    const provider = document.createElement('sherpa-provider');
    provider.innerHTML = '<sherpa-quick-filter-toolbar data-type="view" data-scope="view" style="inline-size: 1700px"></sherpa-quick-filter-toolbar>'
      + '<sherpa-quick-filter-toolbar data-scope="data" style="inline-size: 1700px"></sherpa-quick-filter-toolbar>';
    document.getElementById('root').replaceChildren(provider);
    const [, card] = provider.querySelectorAll('sherpa-quick-filter-toolbar');
    const rows = [
      { id: 1, customer: 'Acme', health: 'Good', plan: 'Pro' },
      { id: 2, customer: 'Acme', health: 'Poor', plan: 'Free' },
      { id: 3, customer: 'Globex', health: 'Fair', plan: 'Pro' },
    ];
    const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    const source = await provider.open(${PAGE}, { stores: { accounts: new ArrayStore(rows, { key: 'id' }) }, views: { all: { label: 'All', query: { v: 1, scopes: { view: {} } } } } });
    source.query.ask({ scope: 'view', field: 'customer', reading: { picked: ['Acme'] }, commit: true });
    await source.load();
    await settle();
    source.query.ask({ scope: 'data', hold: ['plan', 'health'] });
    await settle();
    const chip = card.shadowRoot.querySelector('.chips > .chip[data-id="health"]');
    return chip?.menu?.present ? [...chip.menu.present].sort() : null;
  })()`);
  expect(present).toEqual(['Good', 'Poor']);
});
