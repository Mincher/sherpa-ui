import { test, expect } from './harness';

/**
 * A SCOPE BELOW NARROWS WITHIN A FIXED FIELD — Will, TODO 554: "A local scope may still add these fields and their
 * filters, but its options come from what the View scope's filter on that field allows." The card's bar offers the
 * View's fixed Customer; added, its chip is the card's own — never drawn held above — and offers what the View leaves.
 * TRAP T-a-scope-below-narrows-within-a-fixed-field
 */
const PAGE = `{
  v: 1, id: 'accounts',
  source: {
    store: 'accounts',
    fields: Object.fromEntries(['customer', 'region', 'health', 'plan'].map((f) => [f, { label: f[0].toUpperCase() + f.slice(1), start: 'all' }])),
    scopes: {
      view: { label: 'View Context', holds: ['customer', 'region', 'health'], fixed: ['customer', 'region'] },
      data: { label: 'Rows', offers: 'all', holds: ['plan'] },
    },
  },
}`;
test.use({ viewport: { width: 1800, height: 800 } });

const SETUP = `
  const { ArrayStore } = await import('/dist/index.js');
  const provider = document.createElement('sherpa-provider');
  provider.innerHTML = '<sherpa-quick-filter-toolbar data-type="view" data-scope="view" data-heading="View Context" style="inline-size: 1700px"></sherpa-quick-filter-toolbar>'
    + '<sherpa-quick-filter-toolbar data-scope="data" data-heading="Rows" style="inline-size: 1700px"></sherpa-quick-filter-toolbar>';
  document.getElementById('root').replaceChildren(provider);
  const [, card] = provider.querySelectorAll('sherpa-quick-filter-toolbar');
  const rows = [
    { id: 1, customer: 'Acme', region: 'EU', health: 'Good', plan: 'Pro' },
    { id: 2, customer: 'Acme', region: 'US', health: 'Poor', plan: 'Free' },
    { id: 3, customer: 'Globex', region: 'EU', health: 'Good', plan: 'Pro' },
    { id: 4, customer: 'Initech', region: 'US', health: 'Good', plan: 'Pro' },
  ];
  const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
  const source = await provider.open(${PAGE}, {
    stores: { accounts: new ArrayStore(rows, { key: 'id' }) },
    views: { all: { label: 'All', query: { v: 1, scopes: { view: {} } } } },
  });
  source.query.ask({ scope: 'view', field: 'customer', reading: { picked: ['Acme', 'Globex'] }, commit: true });
  await source.load();
  await settle();
  const chip = (id) => card.shadowRoot.querySelector('.chips > .chip[data-id="' + id + '"]');
`;

test('the card offers the View\'s fixed Customer; added, its chip is its own, offers what the View leaves, and narrows only it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const offered = (card.shadowRoot.querySelector('.add-btn sherpa-menu')?.itemData ?? []).map((i) => i.value);
    source.query.ask({ scope: 'data', hold: ['plan', 'customer'] });
    await settle();
    const added = chip('customer')?.hasAttribute('data-superseded');
    source.query.ask({ scope: 'data', field: 'customer', reading: { picked: ['Globex'] } });
    await source.load();
    await settle();
    return {
      offered: offered.filter((v) => ['customer', 'region', 'health'].includes(v)), added,
      values: chip('customer').values, present: [...(chip('customer').menu?.present ?? [])].sort(),
      view: source.query.reading('view', 'customer').picked, superseded: chip('customer').hasAttribute('data-superseded'),
    };
  })()`) as Record<string, unknown>;
  expect(r.offered).toEqual(['customer', 'region']);
  expect(r.added).toBe(false);
  expect(r.values).toEqual(['Globex']);
  expect(r.present).toEqual(['Acme', 'Globex']);
  expect(r.view).toEqual(['Acme', 'Globex']);
  expect(r.superseded).toBe(false);
});
