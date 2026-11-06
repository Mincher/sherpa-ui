import { test, expect } from './harness';

/**
 * SAVE FILTERS — Will, TODOs 105 and 605. Every scope's filters under one name,
 * kept with the page beside its Views. A saved set is a preset the reader made:
 * ticked in the Filters menu's Saved section, it adds a preset chip to the bar,
 * on; unticked, the chip goes and what it held. That is "Save filters at any
 * scope" ON (TODO 485); OFF, its own test, last.
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
  // The reader's saved filters, as the page's one document keeps them. TRAP T-one-page-one-document
  const storedSets = () => JSON.parse(localStorage.getItem('sherpa:page:plans') ?? '{}').filters ?? {};
  const keep = (filters) => localStorage.setItem('sherpa:page:plans', JSON.stringify({ v: 3, filters }));
  const root = document.getElementById('root');
  const provider = document.createElement('sherpa-provider');
  provider.settings.set('saveAnyScope', true);
  provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="data" data-saveable></sherpa-quick-filter-toolbar>'
    + '<sherpa-overlay-panel open data-heading="Filters"><sherpa-filter-panel data-scope="view data" data-saveable></sherpa-filter-panel></sherpa-overlay-panel>';
  root.replaceChildren(provider);
  const bar = provider.querySelector('sherpa-quick-filter-toolbar');
  const column = provider.querySelector('sherpa-filter-panel');
  const rows = [
    { id: 1, plan: 'Pro', tier: 'gold' }, { id: 2, plan: 'Free', tier: 'gold' }, { id: 3, plan: 'Pro', tier: 'silver' },
  ];
  const open = () => provider.open(${PAGE}, { stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
  const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
  // Each set as the bar was told it, and whether its chip is on a bar.
  const told = () => bar.savedSets.map(({ id, added }) => ({ id, added: !!added }));
  // A saved set's chip, on a bar: null while it is not there, else whether it is on.
  const chip = (on, id) => {
    const one = on.shadowRoot.querySelector('.chips > .chip[data-id="preset:saved:' + id + '"]');
    return one ? one.hasAttribute('data-current') : null;
  };
`;

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    for (const store of [localStorage, sessionStorage]) {
      for (const key of Object.keys(store)) if (key.startsWith('sherpa:')) store.removeItem(key);
    }
  });
});

test('Save filters keeps every scope under a name: its chip joins the bar, off, and no button names it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const source = await open();
    await settle();
    source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Pro'] } });
    source.query.ask({ scope: 'view', field: 'tier', reading: { picked: ['gold'] } });
    source.query.ask({ commit: true }); // the View waits for its Apply. TODO 406
    await source.load();
    bar.dispatchEvent(new CustomEvent('filters-save-as', { bubbles: true, composed: true }));
    const id = provider.saveFilters('Gold Pro');
    await settle();
    const stored = storedSets();
    return { id, stored, told: told(), read: provider.savedFilterSets, chip: chip(bar, 'gold-pro'), total: source.debugState().total,
      noName: provider.saveFilters('') ?? null, buttons: bar.shadowRoot.querySelectorAll('.save-set, .save-name').length };
  })()`) as Record<string, any>;
  expect(r['id']).toBe('gold-pro');
  const scopes = r['stored']['gold-pro'].query.scopes;
  expect(r['stored']['gold-pro'].label).toBe('Gold Pro');
  expect(scopes.view.where).toEqual({ tier: { eq: 'gold' } });
  expect(scopes.data.where).toEqual({ plan: { eq: 'Pro' } });
  // The filter half: no arrangement.
  expect(scopes.view.sort).toBeUndefined();
  expect(r['told']).toEqual([{ id: 'gold-pro', added: true }]);
  expect(r['read']).toEqual([{ id: 'gold-pro', label: 'Gold Pro', added: true, own: true }]);
  expect(r['chip']).toBe(false);
  // The filters on screen are the reader's own, as they were.
  expect(r['total']).toBe(1);
  expect(r['noName']).toBeNull();
  expect(r['buttons']).toBe(0);
});

test('a set ticked is a preset chip, on, with its conditions beside the reader\'s; several may be on, a reload keeps them, and unticked its chip goes and what it held', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    keep({
      silver: { label: 'Silver', query: { v: 1, scopes: { view: { holds: ['tier'], where: { tier: { eq: 'silver' } } } } } },
      pro: { label: 'Pro', query: { v: 1, scopes: { data: { where: { plan: { eq: 'Pro' } } } } } },
    });
    const source = await open();
    await settle();
    const listed = told();
    // Its tick asks.
    bar.dispatchEvent(new CustomEvent('filters-apply', { bubbles: true, composed: true, detail: { id: 'pro' } }));
    await source.load();
    await settle();
    const one = { chip: chip(bar, 'pro'), total: source.debugState().total, by: Object.keys(source.query.applied.scopes.data.readings.plan.byPreset),
      own: source.query.applied.scopes.data.readings.plan.picked ?? [], ticked: bar.shadowRoot.querySelector('.saved-btn sherpa-menu')?.values?.filter((v) => v.startsWith('set:')) };
    // The chip's own press turns it off, and it stays.
    bar.shadowRoot.querySelector('.chips > .chip[data-id="preset:saved:pro"]').shadowRoot.querySelector('.body').click();
    await source.load();
    await settle();
    const pressed = { chip: chip(bar, 'pro'), total: source.debugState().total, told: told() };
    provider.applyFilters('pro');
    provider.applyFilters('silver');
    await source.load();
    await settle();
    const both = { pro: chip(bar, 'pro'), total: source.debugState().total, told: told(),
      ticked: bar.shadowRoot.querySelector('.saved-btn sherpa-menu')?.values?.filter((v) => v.startsWith('set:')) };
    // A reload — a fresh provider over the same tab — keeps them.
    provider.close();
    const again = await open();
    await settle();
    await again.load();
    await settle();
    const kept = { pro: chip(bar, 'pro'), total: again.debugState().total, told: told() };
    bar.dispatchEvent(new CustomEvent('filters-dismiss', { bubbles: true, composed: true, detail: { id: 'pro' } }));
    bar.dispatchEvent(new CustomEvent('filters-dismiss', { bubbles: true, composed: true, detail: { id: 'silver' } }));
    await again.load();
    await settle();
    return { listed, one, pressed, both, kept, off: { pro: chip(bar, 'pro'), total: again.debugState().total, told: told(),
      plan: again.query.applied.scopes.data?.readings.plan ?? null } };
  })()`) as Record<string, any>;
  expect(r['listed']).toEqual([{ id: 'silver', added: false }, { id: 'pro', added: false }]);
  expect(r['one']).toEqual({ chip: true, total: 2, by: ['saved:pro'], own: [], ticked: ['set:pro'] });
  expect(r['pressed']).toEqual({ chip: false, total: 3, told: [{ id: 'silver', added: false }, { id: 'pro', added: true }] });
  const both = [{ id: 'silver', added: true }, { id: 'pro', added: true }];
  expect(r['both']).toEqual({ pro: true, total: 1, told: both, ticked: ['set:silver', 'set:pro'] });
  expect(r['kept']).toEqual({ pro: true, total: 1, told: both });
  expect(r['off']).toEqual({ pro: null, total: 3, told: [{ id: 'silver', added: false }, { id: 'pro', added: false }], plan: null });
});

/* Its chip on, a set's preset row in the Edit menu is ticked too. Taking the set off
   redraws that menu's one-value rows, and the ticked row was then read as a filter to
   add: the chip came back, off. TODO 702 */
test('a set unticked in the Saved menu takes its chip off, though the chip\'s own row there is ticked', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    keep({ pro: { label: 'Pro', query: { v: 1, scopes: { data: { where: { plan: { eq: 'Pro' } } } } } } });
    const source = await open();
    await settle();
    provider.applyFilters('pro');
    await source.load();
    await settle();
    const edit = bar.shadowRoot.querySelector('.add-btn');
    const saved = bar.shadowRoot.querySelector('.saved-btn');
    const menu = () => saved.querySelector('sherpa-menu');
    const before = { chip: chip(bar, 'pro'), ticked: [...edit.querySelector('sherpa-menu').values, ...menu().values].filter((v) => v.includes('pro')) };
    saved.shadowRoot.querySelector('button').click();
    await settle();
    [...menu().querySelectorAll('input')].find((i) => i.value === 'set:pro').click();
    await source.load();
    await settle();
    return { before, after: { chip: chip(bar, 'pro'), total: source.debugState().total, told: told() } };
  })()`) as Record<string, any>;
  expect(r['before']).toEqual({ chip: true, ticked: ['preset:saved:pro', 'set:pro'] });
  expect(r['after']).toEqual({ chip: null, total: 3, told: [{ id: 'pro', added: false }] });
});

/* The chip comes on after the Edit menu is drawn, and nothing draws it again: its
   preset row said off. Pressed off, the row says off, and the set's row stays ticked:
   the set is still on the bar. TODO 714 */
test('a set\'s chip on, its preset row in the Edit menu is ticked; its chip pressed off, the row is unticked', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    keep({ pro: { label: 'Pro', query: { v: 1, scopes: { data: { where: { plan: { eq: 'Pro' } } } } } } });
    const source = await open();
    await settle();
    const edit = bar.shadowRoot.querySelector('.add-btn');
    const saved = bar.shadowRoot.querySelector('.saved-btn');
    // Both menus as a reader opens them: the Edit menu's row for the chip, the Saved menu's for the set.
    const opened = async () => {
      const rows = [];
      for (const one of [edit, saved]) {
        one.shadowRoot.querySelector('button').click();
        await settle();
        const menu = one.querySelector('sherpa-menu');
        rows.push(...[...menu.querySelectorAll('input')].filter((i) => i.value.endsWith('pro')).map((i) => i.value + (i.checked ? ' on' : ' off')));
        menu.hide();
        await settle();
      }
      return { chip: chip(bar, 'pro'), rows };
    };
    provider.applyFilters('pro');
    await source.load();
    await settle();
    const on = await opened();
    bar.shadowRoot.querySelector('.chips > .chip[data-id="preset:saved:pro"]').shadowRoot.querySelector('.body').click();
    await source.load();
    await settle();
    return { on, off: await opened() };
  })()`) as Record<string, any>;
  expect(r['on']).toEqual({ chip: true, rows: ['preset:saved:pro on', 'set:pro on'] });
  expect(r['off']).toEqual({ chip: false, rows: ['preset:saved:pro off', 'set:pro on'] });
});

test('another View takes the chips off with what they held; Rename keeps a chip on, and Delete takes it off; a reader\'s saved filter of the last shape is read once, an older one is not adopted', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    // Sherpa keeps no shim for an app's old stored data (Will, D4) — but a reader's
    // saved filters of the last shape are read once into the page's document (U3, B).
    localStorage.setItem('sherpa:filters:plans', JSON.stringify({ 'pro-only': { label: 'Pro only', where: { plan: { eq: 'Pro' } } } }));
    localStorage.setItem('sherpa:filter-sets:plans', JSON.stringify({ 'pro-only': { label: 'Pro only',
      query: { v: 1, scopes: { data: { where: { plan: { eq: 'Pro' } } } } } } }));
    const source = await open();
    await settle();
    const sets = storedSets();
    const old = [localStorage.getItem('sherpa:filters:plans') !== null, localStorage.getItem('sherpa:filter-sets:plans')];
    provider.applyFilters('pro-only');
    await source.load();
    await settle();
    const next = provider.renameFilters('pro-only', 'Pro rows');
    await source.load();
    await settle();
    const renamed = { next, was: chip(bar, 'pro-only'), now: chip(bar, 'pro-rows'), total: source.debugState().total };
    const deleted = provider.deleteFilters('pro-rows');
    await source.load();
    await settle();
    return { sets, old, renamed, deleted, left: storedSets(),
      chip: chip(bar, 'pro-rows'), total: source.debugState().total, rows: bar.savedSets };
  })()`) as Record<string, any>;
  expect(Object.keys(r['sets'])).toEqual(['pro-only']);
  expect(r['old']).toEqual([true, null]);
  expect(r['renamed']).toEqual({ next: 'pro-rows', was: null, now: true, total: 2 });
  expect(r['deleted']).toBe(true);
  expect(r['left']).toEqual({});
  expect(r['chip']).toBeNull();
  expect(r['total']).toBe(3);
  expect(r['rows']).toEqual([]);
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

/* A PAGE'S OWN saved filter (366 S2): a query definition in its JSON, listed
   beside a reader's on every bar, added as theirs is, and never saved over or
   deleted — a name that is its gets a copy's. */
test('a page\'s own saved filter is listed on an unsaveable bar, adds its chip to the bar it names, turns what is there blue, and is never saved over or deleted', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    const provider = document.createElement('sherpa-provider');
    provider.settings.set('saveAnyScope', true);
    provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="view"></sherpa-quick-filter-toolbar>'
      + '<sherpa-quick-filter-toolbar data-scope="data" data-saveable></sherpa-quick-filter-toolbar>';
    document.getElementById('root').replaceChildren(provider);
    const [viewBar, dataBar] = provider.querySelectorAll('sherpa-quick-filter-toolbar');
    const rows = [{ id: 1, plan: 'Pro', tier: 'gold' }, { id: 2, plan: 'Free', tier: 'gold' }, { id: 3, plan: 'Pro', tier: 'silver' }];
    const source = await provider.open({
      v: 1, id: 'plans',
      source: {
        store: 'plans', fields: { plan: { label: 'Plan' }, tier: { label: 'Tier', start: 'all' } },
        scopes: { view: { label: 'View', holds: ['tier'] }, data: { label: 'Rows', holds: ['plan'] } },
      },
      savedFilters: { 'pro-only': { label: 'Pro only', query: { v: 1, scopes: { data: { where: { plan: { eq: 'Pro' } } } } } } },
    }, { stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
    const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    await settle();
    const sets = (bar) => (bar.shadowRoot.querySelector('.saved-btn sherpa-menu')?.itemData ?? [])
      .filter((i) => i.value.startsWith('set:')).map((i) => i.label);
    const listed = { view: sets(viewBar), data: sets(dataBar) };
    provider.applyFilters('pro-only');
    await source.load();
    await settle();
    const chip = dataBar.shadowRoot.querySelector('.chip[data-id="plan"]');
    const taken = {
      rows: source.rows.map((row) => row.id),
      preset: dataBar.shadowRoot.querySelector('.chips > .chip[data-id="preset:saved:pro-only"]')?.hasAttribute('data-current') ?? null,
      blue: chip?.dataset.byPreset ?? null,
      readonly: chip?.querySelector('sherpa-menu')?.hasAttribute('data-readonly') ?? null,
      ticked: (dataBar.shadowRoot.querySelector('.saved-btn sherpa-menu')?.values ?? []).filter((v) => v.startsWith('set:')),
      read: provider.savedFilterSets,
    };
    const deleted = provider.deleteFilters('pro-only');
    const copy = provider.saveFilters('Pro only');
    return { listed, taken, deleted, copy, after: provider.savedFilterSets.map((set) => [set.id, set.own]) };
  })()`) as Record<string, any>;
  expect(r['listed']).toEqual({ view: ['Pro only'], data: ['Pro only'] });
  expect(r['taken']).toEqual({
    rows: [1, 3], preset: true, blue: 'Pro only', readonly: true, ticked: ['set:pro-only'],
    read: [{ id: 'pro-only', label: 'Pro only', added: true, own: false }],
  });
  expect(r['deleted']).toBe(false);
  expect(r['copy']).toBe('pro-only-copy-001');
  expect(r['after']).toEqual([['pro-only', false], ['pro-only-copy-001', true]]);
});

/* OFF — the default (Will, TODO 485): a set is ONE local scope's. The bar that
   asks saves its own scope alone, is told its own scope's sets alone, and its
   chip goes there; the View's bar and the panel save nothing, and list nothing.
   On, every scope again. */
test('Save filters at any scope OFF: a set is the asking bar\'s scope alone, listed and added there; the View and the panel save nothing', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    const provider = document.createElement('sherpa-provider');
    provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="view" data-saveable></sherpa-quick-filter-toolbar>'
      + '<sherpa-quick-filter-toolbar data-scope="data" data-saveable></sherpa-quick-filter-toolbar>'
      + '<sherpa-overlay-panel open data-heading="Filters"><sherpa-filter-panel data-scope="view data" data-saveable></sherpa-filter-panel></sherpa-overlay-panel>';
    document.getElementById('root').replaceChildren(provider);
    const [viewBar, dataBar] = provider.querySelectorAll('sherpa-quick-filter-toolbar');
    const column = provider.querySelector('sherpa-filter-panel');
    const rows = [{ id: 1, plan: 'Pro', tier: 'gold' }, { id: 2, plan: 'Free', tier: 'gold' }, { id: 3, plan: 'Pro', tier: 'silver' }];
    const source = await provider.open(${PAGE}, { stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
    const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    await settle();
    const flags = () => [viewBar, dataBar, column].map((b) => b.hasAttribute('data-no-saves'));
    const told = () => [viewBar, dataBar, column].map((b) => b.savedSets.map((set) => set.id));
    source.query.ask({ scope: 'view', field: 'tier', reading: { picked: ['gold'] } });
    source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
    source.query.ask({ commit: true });
    await source.load();
    // The DATA bar asks; the host names it.
    dataBar.dispatchEvent(new CustomEvent('filters-save-as', { bubbles: true, composed: true }));
    const id = provider.saveFilters('Pro rows');
    await settle();
    const stored = Object.keys(JSON.parse(localStorage.getItem('sherpa:page:plans') ?? '{}').filters?.['pro-rows']?.query.scopes ?? {});
    // …and the View's bar asks: nothing is saved.
    viewBar.dispatchEvent(new CustomEvent('filters-save-as', { bubbles: true, composed: true }));
    const fromView = provider.saveFilters('From the View') ?? null;
    const off = { flags: flags(), told: told(), id, stored, fromView };
    // Added after a change everywhere: its conditions join the data scope, and what the reader picked stays.
    source.query.ask({ scope: 'view', field: 'tier', reading: { picked: ['silver'] } });
    source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
    source.query.ask({ commit: true });
    await source.load();
    provider.applyFilters('pro-rows');
    await source.load();
    await settle();
    const taken = { tier: source.query.applied.scopes.view.readings.tier?.picked, plan: source.query.applied.scopes.data.readings.plan?.picked,
      by: Object.keys(source.query.applied.scopes.data.readings.plan?.byPreset ?? {}),
      on: dataBar.shadowRoot.querySelector('.chips > .chip[data-id="preset:saved:pro-rows"]')?.hasAttribute('data-current') ?? null };
    provider.settings.set('saveAnyScope', true);
    await settle();
    return { off, taken, on: { flags: flags(), told: told() } };
  })()`) as Record<string, any>;
  expect(r['off']).toEqual({
    flags: [true, false, true], told: [[], ['pro-rows'], []], id: 'pro-rows', stored: ['data'], fromView: null,
  });
  expect(r['taken']).toEqual({ tier: ['silver'], plan: ['Pro'], by: ['saved:pro-rows'], on: true });
  expect(r['on']).toEqual({ flags: [false, false, false], told: [['pro-rows'], ['pro-rows'], ['pro-rows']] });
});
