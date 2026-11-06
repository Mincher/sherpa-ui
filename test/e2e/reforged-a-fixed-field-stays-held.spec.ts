import { test, expect } from './harness';

/**
 * A FIXED FIELD STAYS HELD, AND ONE ALWAYS ON STAYS ON — Will, TODO 703: "In the
 * view context filter toolbar, Customer, Region, and Date chips can't be removed.
 * Customer and Region can't be toggled off, either. Chips after Date should be
 * preceded by a divider." The page's definition says it; the bar draws it, and
 * its doors refuse what its chips do not offer.
 * TRAP T-a-fixed-field-stays-held
 */
const PAGE = `{
  v: 1, id: 'accounts',
  source: {
    store: 'accounts',
    fields: {
      customer: { label: 'Customer' }, region: { label: 'Region' }, created: { label: 'Date', type: 'date' },
      health: { label: 'Health' }, plan: { label: 'Plan' },
    },
    scopes: {
      view: {
        label: 'View Context', holds: ['customer', 'region', 'created', 'health'],
        fixed: ['customer', 'region', 'created'], alwaysOn: ['customer', 'region'],
      },
      data: { label: 'Rows', offers: 'all', holds: ['plan'] },
    },
  },
}`;
// Wide enough that nothing folds: a folded chip is no neighbour.
test.use({ viewport: { width: 1800, height: 800 } });

const SETUP = `
  const { ArrayStore, onReport } = await import('/dist/index.js');
  const provider = document.createElement('sherpa-provider');
  provider.innerHTML = '<sherpa-quick-filter-toolbar data-type="view" data-scope="view" data-heading="View Context" style="inline-size: 1700px"></sherpa-quick-filter-toolbar>';
  document.getElementById('root').replaceChildren(provider);
  const bar = provider.querySelector('sherpa-quick-filter-toolbar');
  const rows = [
    { id: 1, customer: 'Acme', region: 'EU', created: '2026-01-05', health: 'Good', plan: 'Pro' },
    { id: 2, customer: 'Acme', region: 'US', created: '2026-02-05', health: 'Poor', plan: 'Free' },
    { id: 3, customer: 'Globex', region: 'EU', created: '2026-03-05', health: 'Good', plan: 'Pro' },
  ];
  const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
  const source = await provider.open(${PAGE}, {
    stores: { accounts: new ArrayStore(rows, { key: 'id' }) },
    views: { all: { label: 'All', query: { v: 1, scopes: { view: {} } } } },
  });
  source.query.ask([
    { scope: 'view', field: 'customer', reading: { picked: ['Acme'] } },
    { scope: 'view', field: 'created', reading: { picked: ['2026-01-01', '2026-12-31'], range: true } },
    { scope: 'view', field: 'health', reading: { picked: ['Good', 'Poor'] } },
    { commit: true },
  ]);
  await source.load();
  await settle();
  const chip = (id, on = bar) => on.shadowRoot.querySelector('.chips > .chip[data-id="' + id + '"]');
  const ids = () => [...bar.shadowRoot.querySelectorAll('.chips > .chip')].map((c) => c.dataset.id);
  const on = (id) => chip(id).hasAttribute('data-current');
  const off = (field) => !!source.query.reading('view', field)?.suspended;
  const press = async (id) => { chip(id).shadowRoot.querySelector('.body').click(); await settle(); };
  const after = (id, on = bar) => {
    const style = getComputedStyle(chip(id, on), '::after');
    return style.content === 'none' || style.display === 'none' ? null : style.inlineSize;
  };
  const heard = [];
  onReport((r) => heard.push(r.code));
`;

test('on the bar: Customer, Region and Date have no Remove, Customer and Region no toggle, and a divider follows Date', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const drawn = Object.fromEntries(['customer', 'region', 'created', 'health'].map((id) => [id, {
      persistent: chip(id).hasAttribute('data-persistent'), on: on(id),
      remove: chip(id).querySelector(':scope > sherpa-menu').hasAttribute('data-removable'),
    }]));
    // The Edit list holds only what a reader can take off.
    const edit = bar.shadowRoot.querySelector('.add-btn sherpa-menu');
    const listed = { rows: (edit?.itemData ?? []).map((i) => i.value), ticked: edit?.values ?? [] };
    const dividers = Object.fromEntries(['view', 'customer', 'region', 'created', 'health'].map((id) => [id, after(id)]));
    await press('customer');
    await press('region');
    const pressed = { customer: on('customer'), region: on('region'), off: off('customer') || off('region'), rows: source.rows.map((x) => x.id) };
    await press('created');
    await press('health');
    const toggled = { created: off('created'), health: off('health') };
    // Panel mode keeps only the View chip on the bar: an always-on chip is no selector.
    bar.setAttribute('data-panel-mode', '');
    const panelled = ['view', 'customer', 'created'].map((id) => getComputedStyle(chip(id)).display !== 'none');
    bar.removeAttribute('data-panel-mode');
    // With no chip after it, no divider.
    bar.removeFilter('health');
    await settle();
    return { ids: ids(), drawn, listed, dividers, pressed, toggled, panelled, alone: after('created'), held: source.query.scope('view'), heard };
  })()`) as Record<string, unknown>;
  expect(r['ids']).toEqual(['view', 'customer', 'region', 'created']);
  expect(r['drawn']).toEqual({
    customer: { persistent: true, on: true, remove: false },
    region: { persistent: true, on: true, remove: false },
    created: { persistent: false, on: true, remove: false },
    health: { persistent: false, on: true, remove: true },
  });
  expect(r['listed']).toEqual({ rows: ['health', 'plan'], ticked: ['health'] });
  expect(r['dividers']).toEqual({ view: '1px', customer: null, region: null, created: '1px', health: null });
  // Region opens on its first value, EU.
  expect(r['pressed']).toEqual({ customer: true, region: true, off: false, rows: [1] });
  expect(r['toggled']).toEqual({ created: true, health: true });
  expect(r['panelled']).toEqual([true, false, false]);
  expect(r['alone']).toBeNull();
  expect(r['held']).toEqual(['customer', 'region', 'created']);
  expect(r['heard']).toEqual([]);
});

test('no door does what the chips do not offer: the bar\'s and the Query\'s refuse, and say so', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    bar.removeFilter('created');
    bar.setChipReading('customer', { picked: ['Globex'], suspended: true });
    await source.load();
    await settle();
    source.query.ask({ scope: 'view', field: 'region', suspended: true });
    source.query.ask({ scope: 'view', release: 'region' });
    source.query.ask({ commit: true });
    await source.load();
    await settle();
    return {
      held: source.query.scope('view'), ids: ids(), customer: { on: on('customer'), off: off('customer'), picked: source.query.reading('view', 'customer')?.picked },
      region: { on: on('region'), off: off('region') }, rows: source.rows.map((x) => x.id), heard,
    };
  })()`) as Record<string, unknown>;
  expect(r['held']).toEqual(['customer', 'region', 'created', 'health']);
  expect(r['ids']).toEqual(['view', 'customer', 'region', 'created', 'health']);
  // Its answer moved, and it stayed on.
  expect(r['customer']).toEqual({ on: true, off: false, picked: ['Globex'] });
  expect(r['region']).toEqual({ on: true, off: false });
  expect(r['rows']).toEqual([3]);
  expect(r['heard']).toEqual(['filter-fixed', 'filter-always-on', 'field-always-on', 'field-fixed']);
});

test('in the panel\'s column: each stays a section, a fixed one\'s ⋮ has no Remove, and no divider is drawn', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const columnShell = document.createElement('sherpa-overlay-panel');
    columnShell.setAttribute('data-heading', 'Filters');
    columnShell.setAttribute('open', '');
    const column = document.createElement('sherpa-filter-panel');
    column.setAttribute('data-scope', 'view data');
    columnShell.append(column);
    provider.append(columnShell);
    await settle();
    await new Promise((r) => setTimeout(r, 300));
    await settle();
    const section = column.shadowRoot.querySelector('.sections > * > [data-scope="view"]');
    const field = (id) => chip(id, section);
    const more = (id) => field(id).querySelector(':scope > .field-more');
    return Object.fromEntries(['customer', 'created', 'health'].map((id) => [id, {
      layout: field(id).dataset.layout ?? null, remove: more(id)?.hasAttribute('data-removable') ?? null, divider: after(id, section),
    }]));
  })()`) as Record<string, unknown>;
  expect(r).toEqual({
    customer: { layout: 'section', remove: false, divider: null },
    created: { layout: null, remove: null, divider: null },
    health: { layout: 'section', remove: true, divider: null },
  });
});
