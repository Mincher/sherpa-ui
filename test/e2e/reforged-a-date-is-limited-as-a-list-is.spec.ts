import { test, expect } from './harness';

/**
 * A DATE IS LIMITED AS A LIST IS — Will, TODO 982 A (2026-11-15). A card's own date chip offers only the days the View
 * leaves it, live: its calendar's days follow each pick in the View, as a list chip's values do.
 *
 * TRAP T-a-ruled-out-value-is-greyed
 */
const PAGE = `{
  v: 1, id: 'accounts',
  source: {
    store: 'accounts',
    fields: { customer: { label: 'Customer', start: 'all' }, seen: { label: 'Seen', type: 'date' } },
    scopes: { view: { label: 'View Context', holds: ['customer'] }, data: { label: 'Rows', holds: ['seen'] } },
  },
}`;
test.use({ viewport: { width: 1800, height: 800 } });

test('a card\'s date chip offers only the days the View leaves it, and follows the View\'s next pick', async ({ page }) => {
  const days = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    const provider = document.createElement('sherpa-provider');
    provider.innerHTML = '<sherpa-quick-filter-toolbar data-type="view" data-scope="view" style="inline-size: 1700px"></sherpa-quick-filter-toolbar>'
      + '<sherpa-quick-filter-toolbar data-scope="data" style="inline-size: 1700px"></sherpa-quick-filter-toolbar>';
    document.getElementById('root').replaceChildren(provider);
    const [, card] = provider.querySelectorAll('sherpa-quick-filter-toolbar');
    const rows = [
      { id: 1, customer: 'Acme', seen: '2024-01-05' },
      { id: 2, customer: 'Acme', seen: '2024-01-20' },
      { id: 3, customer: 'Globex', seen: '2024-03-02' },
    ];
    const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    const source = await provider.open(${PAGE}, { stores: { accounts: new ArrayStore(rows, { key: 'id' }) }, views: { all: { label: 'All', query: { v: 1, scopes: { view: {} } } } } });
    const calendar = () => card.shadowRoot.querySelector('.chips > .chip[data-id="seen"]')?.menu?.querySelector('sherpa-calendar');
    const said = () => calendar()?.getAttribute('data-available')?.split(',').sort() ?? null;
    const pick = async (customer) => {
      source.query.ask({ scope: 'view', field: 'customer', reading: { picked: [customer] }, commit: true });
      await source.load();
      await settle();
      return said();
    };
    return { acme: await pick('Acme'), globex: await pick('Globex') };
  })()`);
  expect(days).toEqual({ acme: ['2024-01-05', '2024-01-20'], globex: ['2024-03-02'] });
});

test('a date chip added to a card offers the View\'s days once it draws: a hold asks a walk (981)', async ({ page }) => {
  const days = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    const provider = document.createElement('sherpa-provider');
    provider.innerHTML = '<sherpa-quick-filter-toolbar data-type="view" data-scope="view" style="inline-size: 1700px"></sherpa-quick-filter-toolbar>'
      + '<sherpa-quick-filter-toolbar data-scope="data" style="inline-size: 1700px"></sherpa-quick-filter-toolbar>';
    document.getElementById('root').replaceChildren(provider);
    const [, card] = provider.querySelectorAll('sherpa-quick-filter-toolbar');
    const rows = [{ id: 1, customer: 'Acme', seen: '2024-01-05' }, { id: 2, customer: 'Globex', seen: '2024-03-02' }];
    const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    const page = ${PAGE};
    page.source.scopes.data.holds = [];
    const source = await provider.open(page, { stores: { accounts: new ArrayStore(rows, { key: 'id' }) }, views: { all: { label: 'All', query: { v: 1, scopes: { view: {} } } } } });
    source.query.ask({ scope: 'view', field: 'customer', reading: { picked: ['Globex'] }, commit: true });
    await source.load();
    await settle();
    source.query.ask({ scope: 'data', hold: ['seen'] });
    await settle();
    const cal = card.shadowRoot.querySelector('.chips > .chip[data-id="seen"]')?.menu?.querySelector('sherpa-calendar');
    return cal?.getAttribute('data-available')?.split(',').sort() ?? null;
  })()`);
  expect(days).toEqual(['2024-03-02']);
});
