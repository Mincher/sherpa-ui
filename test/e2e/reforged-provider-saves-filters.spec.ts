import { test, expect } from './harness';

/**
 * SAVE FILTERS — Will, TODO 105, plan 960 U4.4c. The filters on screen under one name are Filters of the reader's on the
 * keeper's entity shelf: one per scope that holds an answer, "<name>", or "<name> · <scope's label>" for each of several.
 * A Filter over the page's store is a preset of its bar (TODO 776), so each is a chip there, off. Rename keeps its id and
 * publishes; Delete takes it off the shelf, refused while another entity uses it. "Save filters at any scope" ON
 * (TODO 485); OFF, its own test.
 * TRAP T-saved-filters-are-every-scope
 */
const PAGE = `{
  v: 1, id: 'plans',
  source: {
    store: 'plans', fields: { plan: { label: 'Plan' }, tier: { label: 'Tier', start: 'all' } },
    scopes: { view: { label: 'View', holds: ['tier'] }, data: { label: 'Rows', holds: ['plan'] } },
  },
}`;
const SETUP = `
  const { ArrayStore } = await import('/dist/index.js');
  const root = document.getElementById('root');
  const provider = document.createElement('sherpa-provider');
  provider.settings.set('saveAnyScope', true);
  provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="view"></sherpa-quick-filter-toolbar>'
    + '<sherpa-quick-filter-toolbar data-scope="data" data-saveable></sherpa-quick-filter-toolbar>';
  root.replaceChildren(provider);
  const [viewBar, bar] = provider.querySelectorAll('sherpa-quick-filter-toolbar');
  const rows = [
    { id: 1, plan: 'Pro', tier: 'gold' }, { id: 2, plan: 'Free', tier: 'gold' }, { id: 3, plan: 'Pro', tier: 'silver' },
  ];
  const open = () => provider.open(${PAGE}, { stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
  const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
  // The shelf moves, then the bars are drawn: wait for what is asked.
  const until = async (ok) => { for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 20)); await settle(); };
  const shelf = () => provider.keeper.entities;
  const filters = () => shelf().list('filter').map(({ id, label, origin }) => ({ id, label, origin }));
  // A Filter's chip on a bar: null while it is not there, else whether it is on.
  const chip = (on, id) => {
    const one = on.shadowRoot.querySelector('.chips > .chip[data-id="preset:filter:' + id + '"]');
    return one ? one.hasAttribute('data-current') : null;
  };
  const label = (on, id) => on.shadowRoot.querySelector('.chips > .chip[data-id="preset:filter:' + id + '"]')?.getAttribute('data-label') ?? null;
  const press = (on, id) => on.shadowRoot.querySelector('.chips > .chip[data-id="preset:filter:' + id + '"]').shadowRoot.querySelector('.body').click();
`;

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    for (const store of [localStorage, sessionStorage]) {
      for (const key of Object.keys(store)) if (key.startsWith('sherpa:')) store.removeItem(key);
    }
  });
});

test('Save filters makes a Filter of the reader\'s per scope that holds an answer: each a chip on its bar, off, and the answers stay', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const source = await open();
    await settle();
    source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Pro'] } });
    source.query.ask({ scope: 'view', field: 'tier', reading: { picked: ['gold'] } });
    source.query.ask({ commit: true }); // the View waits for its Apply. TODO 406
    await source.load();
    bar.dispatchEvent(new CustomEvent('filters-save-as', { bubbles: true, composed: true }));
    const ids = await provider.saveFilters('Gold Pro');
    await until(() => chip(bar, 'gold-pro-rows') !== null && chip(viewBar, 'gold-pro-view') !== null);
    return { ids, filters: filters(), wheres: ids.map((id) => [id, shelf().get(id).query.where, shelf().get(id).settings.source]),
      chips: [chip(viewBar, 'gold-pro-view'), chip(bar, 'gold-pro-rows')], total: source.debugState().total,
      noName: await provider.saveFilters('  '), stored: 'filters' in JSON.parse(localStorage.getItem('sherpa:page:plans') ?? '{}') };
  })()`) as Record<string, any>;
  expect(r['ids']).toEqual(['gold-pro-view', 'gold-pro-rows']);
  expect(r['filters']).toEqual([
    { id: 'gold-pro-view', label: 'Gold Pro · View', origin: 'mine' }, { id: 'gold-pro-rows', label: 'Gold Pro · Rows', origin: 'mine' },
  ]);
  // The filter half, no arrangement: each Filter keeps its Where, over the page's store.
  expect(r['wheres']).toEqual([['gold-pro-view', { tier: { eq: 'gold' } }, 'plans'], ['gold-pro-rows', { plan: { eq: 'Pro' } }, 'plans']]);
  // Each on the bar of the scope that holds its field, off: the bars' own filters still say the same.
  expect(r['chips']).toEqual([false, false]);
  expect(r['total']).toBe(1);
  expect(r['noName']).toEqual([]);
  expect(r['stored']).toBe(false);
});

test('a reader\'s Filter is a chip like any Filter: pressed on, it filters; a reload has it, as the shelf does', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const source = await open();
    await settle();
    source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] }, commit: true });
    await source.load();
    // The data scope's alone: the View holds Tier, All, which is an answer too.
    provider.settings.set('saveAnyScope', false);
    await provider.saveFilters('Pro rows', 'data');
    // The reader's own answer goes; the Filter is still theirs.
    source.query.ask({ scope: 'data', field: 'plan', reading: null, commit: true });
    await source.load();
    await until(() => chip(bar, 'pro-rows') !== null);
    const saved = { chip: chip(bar, 'pro-rows'), total: source.debugState().total };
    press(bar, 'pro-rows');
    await source.load();
    await settle();
    const on = { chip: chip(bar, 'pro-rows'), total: source.debugState().total, by: Object.keys(source.query.applied.scopes.data.readings.plan?.byPreset ?? {}) };
    provider.close();
    const again = await open();
    await again.load();
    await until(() => chip(bar, 'pro-rows') !== null);
    return { saved, on, again: { chip: chip(bar, 'pro-rows'), total: again.debugState().total } };
  })()`) as Record<string, any>;
  expect(r['saved']).toEqual({ chip: false, total: 3 });
  expect(r['on']).toEqual({ chip: true, total: 2, by: ['filter:pro-rows'] });
  expect(r['again']).toEqual({ chip: true, total: 2 });
});

test('Rename keeps a Filter\'s id and publishes it, its chip on as it was; Delete takes it off with what it held, refused while another uses it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const source = await open();
    await settle();
    source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] }, commit: true });
    await source.load();
    provider.settings.set('saveAnyScope', false);
    const [id] = await provider.saveFilters('Pro only', 'data');
    source.query.ask({ scope: 'data', field: 'plan', reading: null, commit: true });
    await source.load();
    await until(() => chip(bar, id) !== null);
    press(bar, id);
    await source.load();
    await settle();
    const renamed = await provider.renameFilters(id, 'Pro rows');
    await until(() => label(bar, id) === 'Pro rows');
    const after = { renamed, label: label(bar, id), chip: chip(bar, id), total: source.debugState().total,
      versions: shelf().get(id).versions.map((v) => [v.number, v.definition.label]) };
    const refused = { empty: (await provider.renameFilters(id, ' ')) ?? null, none: (await provider.renameFilters('nobody', 'X')) ?? null };
    // Another entity uses it: it stays, and the shelf says why.
    await shelf().save({ v: 3, type: 'filter', id: 'wrap', label: 'Wrap', settings: { source: 'elsewhere' },
      graph: { nodes: [{ id: 'use', kind: 'filter:' + id, x: 0, y: 0 }], connections: [{ from: 'use', to: '#out/where' }] } });
    const used = { gone: provider.deleteFilters(id), why: shelf().whyKept(id) ?? null, chip: chip(bar, id) };
    shelf().remove('wrap');
    const gone = provider.deleteFilters(id);
    await source.load();
    await until(() => chip(bar, id) === null);
    return { id, after, refused, used, gone, filters: filters(), chip: chip(bar, id), total: source.debugState().total,
      plan: source.query.applied.scopes.data?.readings.plan ?? null };
  })()`) as Record<string, any>;
  expect(r['id']).toBe('pro-only');
  expect(r['after']).toEqual({ renamed: 'pro-only', label: 'Pro rows', chip: true, total: 2, versions: [[2, 'Pro rows'], [1, 'Pro only']] });
  expect(r['refused']).toEqual({ empty: null, none: null });
  expect(r['used'].gone).toBe(false);
  expect(r['used'].why).toMatch(/Wrap/);
  expect(r['used'].chip).toBe(true);
  expect(r['gone']).toBe(true);
  expect(r['filters']).toEqual([]);
  expect(r['chip']).toBeNull();
  expect(r['total']).toBe(3);
  expect(r['plan']).toBeNull();
});

test('the Saved menu\'s save row and a set row each ask, and the host answers: several ticked, each added; each unticked, taken off', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // Mounted with its children drawn: its ⋮ is pressed at once.
    const bar = await window.__mount<HTMLElement & { savedSets: unknown }>('sherpa-quick-filter-toolbar',
      [{ id: 'plan', label: 'Plan', removable: true, options: [{ value: 'Pro', label: 'Pro' }] }], { 'data-saveable': true });
    const sr = bar.shadowRoot!;
    // The bar's save rows are its Saved menu's (Will, TODO 430; 11-06).
    const action = async (value: string): Promise<HTMLElement> => (await window.__savedRow(bar, value))!;
    const actions = async (): Promise<(string | null)[]> => {
      await window.__savedRow(bar, 'filters-save');
      return [...sr.querySelectorAll('.saved-btn sherpa-menu > button')].map((l) => (l.textContent ?? '').trim());
    };
    bar.savedSets = [{ id: 'a', label: 'A', added: true, own: true }, { id: 'b', label: 'B', own: true }, { id: 'c', label: 'C', own: true }];
    await window.__settled();
    const heard: string[] = [];
    for (const type of ['filters-save', 'filters-save-as', 'filters-apply', 'filters-dismiss']) {
      bar.addEventListener(type, (e) => heard.push(`${type}:${(e as CustomEvent).detail?.id ?? ''}`));
    }
    const rows = await actions();
    (await action('filters-save')).click();
    // The Saved menu: B and C ticked add them; A unticked takes it off.
    const menu = sr.querySelector('.saved-btn sherpa-menu')!;
    const values = (menu as unknown as { values: string[] }).values;
    const ticked = values.filter((v: string) => v.startsWith('set:'));
    menu.dispatchEvent(new CustomEvent('menu-change', { bubbles: true, composed: true, detail: { values: [...values.filter((v: string) => v !== 'set:a'), 'set:b', 'set:c'] } }));
    return { rows, ticked, heard };
  });
  expect(r.rows.filter((l) => l?.startsWith('Save') || l?.startsWith('Delete'))).toEqual(['Save filters…']);
  expect(r.ticked).toEqual(['set:a']);
  expect(r.heard).toEqual(['filters-save:', 'filters-dismiss:a', 'filters-apply:b', 'filters-apply:c']);
});

/* OFF — the default (Will, TODO 485): Save filters is ONE local scope's. The bar that asks saves its own scope alone; the
   View's bar saves nothing. */
test('Save filters at any scope OFF: a Filter of the asking bar\'s scope alone; the View\'s bar saves nothing', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.settings.set('saveAnyScope', false);
    viewBar.setAttribute('data-saveable', '');
    const source = await open();
    await settle();
    source.query.ask({ scope: 'view', field: 'tier', reading: { picked: ['gold'] } });
    source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
    source.query.ask({ commit: true });
    await source.load();
    // The DATA bar asks; the host names it.
    bar.dispatchEvent(new CustomEvent('filters-save-as', { bubbles: true, composed: true }));
    const ids = await provider.saveFilters('Pro rows');
    // …and the View's bar asks: nothing is saved.
    viewBar.dispatchEvent(new CustomEvent('filters-save-as', { bubbles: true, composed: true }));
    const fromView = await provider.saveFilters('From the View');
    await until(() => chip(bar, 'pro-rows') !== null);
    return { ids, fromView, filters: filters(), where: shelf().get('pro-rows').query.where, chip: chip(bar, 'pro-rows') };
  })()`) as Record<string, any>;
  expect(r['ids']).toEqual(['pro-rows']);
  expect(r['fromView']).toEqual([]);
  expect(r['filters']).toEqual([{ id: 'pro-rows', label: 'Pro rows', origin: 'mine' }]);
  expect(r['where']).toEqual({ plan: { eq: 'Pro' } });
  expect(r['chip']).toBe(false);
});
