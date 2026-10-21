import { test, expect } from './fixture';

/**
 * SAVE FILTERS — Will, TODO 105 and 366. Every scope's filters under one name,
 * kept with the page beside its Views. Taken from the Filters menu's Saved
 * section, it LOADS into the chips: every scope matches it, and no chip names
 * it. The panel's Save filters then reads "Save <name>", active, and saves over
 * it; the Filters menu ticks the set taken; unticked, the
 * scopes it names lose their filters. ONE set is taken at a time.
 * TRAP T-saved-filters-are-every-scope
 */
const PAGE = `{
  v: 1, id: 'plans',
  source: {
    store: 'plans', fields: { plan: { label: 'Plan' }, tier: { label: 'Tier' } },
    scopes: { view: { label: 'View', holds: ['tier'] }, data: { label: 'Rows', holds: ['plan'] } },
  },
}`;
const SETUP = `
  const { ArrayStore, SessionStore } = await import('/dist/index.js');
  // The app's session, which keeps the page's Query across a reload.
  const session = new SessionStore({});
  const root = document.getElementById('root');
  const provider = document.createElement('sherpa-provider');
  provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="data" data-saveable></sherpa-quick-filter-toolbar>'
    + '<sherpa-filter-panel data-scope="view data" data-saveable open></sherpa-filter-panel>';
  root.replaceChildren(provider);
  const bar = provider.querySelector('sherpa-quick-filter-toolbar');
  const panel = provider.querySelector('sherpa-filter-panel');
  const rows = [
    { id: 1, plan: 'Pro', tier: 'gold' }, { id: 2, plan: 'Free', tier: 'gold' }, { id: 3, plan: 'Pro', tier: 'silver' },
  ];
  const open = () => provider.open(${PAGE}, { stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {}, session });
  const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
  // What the panel's Save filters says, and whether it wears the active look.
  const save = () => ({
    says: panel.shadowRoot.querySelector('.save-filters').textContent.replace(/\\s+/g, ' ').trim(),
    active: panel.shadowRoot.querySelector('.save-group').dataset.status === 'active',
  });
  // Each set as the bar was told it, and whether it is the one taken.
  const told = () => bar.savedSets.map(({ id, applied }) => ({ id, applied: !!applied }));
`;

test.beforeEach(async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('sherpa:filter')) localStorage.removeItem(key);
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('sherpa:filter')) sessionStorage.removeItem(key);
  });
});

test('Save filters keeps every scope under a name; the button then says it, active, through an edit, and saves over it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const source = await open();
    await settle();
    const before = save();
    source.query.setReading('view', 'plan', { picked: ['Pro'] });
    source.query.setReading('view', 'tier', { picked: ['gold'] });
    await source.load();
    const id = provider.saveFilters('Gold Pro');
    await settle();
    const stored = JSON.parse(localStorage.getItem('sherpa:filter-sets:plans') ?? '{}');
    const saved = { save: save(), told: told(), read: provider.savedFilterSets };
    source.query.setReading('view', 'plan', { picked: ['Free'] });
    await source.load();
    await settle();
    const edited = { save: save(), told: told() };
    // No name: over the set last taken, with the change.
    const over = provider.saveFilters();
    await settle();
    const again = JSON.parse(localStorage.getItem('sherpa:filter-sets:plans') ?? '{}')['gold-pro'].query.scopes.data.where;
    return { before, id, stored, saved, edited, over, again, told: told() };
  })()`) as Record<string, any>;
  expect(r['before']).toEqual({ says: 'Save filters', active: false });
  expect(r['id']).toBe('gold-pro');
  const scopes = r['stored']['gold-pro'].query.scopes;
  expect(r['stored']['gold-pro'].label).toBe('Gold Pro');
  expect(scopes.view.where).toEqual({ tier: { eq: 'gold' } });
  expect(scopes.data.where).toEqual({ plan: { eq: 'Pro' } });
  // The filter half: no arrangement.
  expect(scopes.view.sort).toBeUndefined();
  expect(r['saved']).toEqual({
    save: { says: 'Save Gold Pro', active: true }, told: [{ id: 'gold-pro', applied: true }],
    read: [{ id: 'gold-pro', label: 'Gold Pro', applied: true, own: true }],
  });
  // Changed, it is still the set taken, and the one Save saves over.
  expect(r['edited']).toEqual({ save: { says: 'Save Gold Pro', active: true }, told: [{ id: 'gold-pro', applied: true }] });
  expect(r['over']).toBe('gold-pro');
  expect(r['again']).toEqual({ plan: { eq: 'Free' } });
  expect(r['told']).toEqual([{ id: 'gold-pro', applied: true }]);
});

test('a set taken: every scope matches it, one it does not name is cleared, another replaces it; unticked, its scopes lose their filters', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    localStorage.setItem('sherpa:filter-sets:plans', JSON.stringify({ silver: { label: 'Silver',
      query: { v: 1, scopes: { view: { holds: ['tier'], where: { tier: { eq: 'silver' } } } } } } }));
    const source = await open();
    source.query.setReading('view', 'plan', { picked: ['Free'] });
    await source.load();
    await settle();
    const listed = told();
    // Its tick asks to take it.
    bar.dispatchEvent(new CustomEvent('filters-apply', { bubbles: true, composed: true, detail: { id: 'silver' } }));
    await settle();
    await source.load();
    await settle();
    const taken = { tier: source.query.applied.scopes.view.readings.tier?.picked,
      plan: source.query.applied.scopes.data.readings.plan?.picked ?? [], total: source.debugState().total,
      holds: source.query.applied.scopes.data.holds, told: told(), save: save() };
    // A reload — a fresh provider over the same tab — keeps the set last taken.
    provider.close();
    const again = await open();
    await settle();
    const kept = save();
    // Unticked: the scopes it names lose their filters.
    bar.dispatchEvent(new CustomEvent('filters-dismiss', { bubbles: true, composed: true, detail: { id: 'silver' } }));
    await settle();
    await again.load();
    await settle();
    return { listed, taken, kept, off: { tier: again.query.applied.scopes.view?.readings.tier?.picked ?? [],
      total: again.debugState().total, told: told(), save: save() } };
  })()`) as Record<string, any>;
  expect(r['listed']).toEqual([{ id: 'silver', applied: false }]);
  // Plan was Free: the set does not name the data scope, so it is cleared (Will, 366). Its chip stays.
  expect(r['taken']).toEqual({ tier: ['silver'], plan: [], total: 1, holds: ['plan'],
    told: [{ id: 'silver', applied: true }], save: { says: 'Save Silver', active: true } });
  expect(r['kept']).toEqual({ says: 'Save Silver', active: true });
  expect(r['off']).toEqual({ tier: [], total: 3, told: [{ id: 'silver', applied: false }], save: { says: 'Save filters', active: false } });
});

test('ONE set is taken at a time: another replaces it, and only it is ticked', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    localStorage.setItem('sherpa:filter-sets:plans', JSON.stringify({
      silver: { label: 'Silver', query: { v: 1, scopes: { view: { where: { tier: { eq: 'silver' } } } } } },
      pro: { label: 'Pro', query: { v: 1, scopes: { data: { where: { plan: { eq: 'Pro' } } } } } },
    }));
    const source = await open();
    await settle();
    await provider.applyFilters('silver');
    await settle();
    const first = told();
    await provider.applyFilters('pro');
    await source.load();
    await settle();
    const ticked = bar.shadowRoot.querySelector('.add-btn sherpa-menu')?.values?.filter((v) => v.startsWith('set:'));
    return { first, second: told(), ticked, tier: source.query.applied.scopes.view.readings.tier?.picked ?? [],
      plan: source.query.applied.scopes.data.readings.plan?.picked, save: save() };
  })()`) as Record<string, any>;
  expect(r['first']).toEqual([{ id: 'silver', applied: true }, { id: 'pro', applied: false }]);
  expect(r['second']).toEqual([{ id: 'silver', applied: false }, { id: 'pro', applied: true }]);
  expect(r['ticked']).toEqual(['set:pro']);
  // Pro does not name the View: Silver's tier went with it.
  expect(r['tier']).toEqual([]);
  expect(r['plan']).toEqual(['Pro']);
  expect(r['save']).toEqual({ says: 'Save Pro', active: true });
});

test('Delete forgets the set last taken; an old one-scope saved filter is not adopted', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    // Sherpa keeps no shim for an app's old stored data (Will, D4).
    localStorage.setItem('sherpa:filters:plans', JSON.stringify({ 'pro-only': { label: 'Pro only', where: { plan: { eq: 'Pro' } } } }));
    localStorage.setItem('sherpa:filter-sets:plans', JSON.stringify({ 'pro-only': { label: 'Pro only',
      query: { v: 1, scopes: { data: { where: { plan: { eq: 'Pro' } } } } } } }));
    await open();
    await settle();
    const sets = JSON.parse(localStorage.getItem('sherpa:filter-sets:plans') ?? '{}');
    const old = localStorage.getItem('sherpa:filters:plans');
    await provider.applyFilters('pro-only');
    const deleted = provider.deleteFilters();
    await settle();
    return { sets, old, deleted, left: JSON.parse(localStorage.getItem('sherpa:filter-sets:plans') ?? '{}'),
      save: save(), rows: bar.savedSets };
  })()`) as Record<string, any>;
  expect(Object.keys(r['sets'])).toEqual(['pro-only']);
  expect(r['old']).not.toBeNull();
  expect(r['deleted']).toBe(true);
  expect(r['left']).toEqual({});
  expect(r['save']).toEqual({ says: 'Save filters', active: false });
  expect(r['rows']).toEqual([]);
});

test('the bar\'s ⋮, the panel\'s Save filters and a Saved row each ask, and the host answers', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered: Promise<void>; populate(d: unknown): Promise<void>; savedSets: unknown;
    };
    const panel = document.createElement('sherpa-filter-panel') as HTMLElement & {
      rendered: Promise<void>; populate(d: unknown): Promise<void>; savedSets: unknown;
    };
    bar.setAttribute('data-saveable', '');
    panel.setAttribute('data-saveable', '');
    panel.setAttribute('open', '');
    panel.style.inlineSize = '480px';
    document.getElementById('root')!.replaceChildren(bar, panel);
    await Promise.all([bar.rendered, panel.rendered]);
    await bar.populate([{ id: 'plan', label: 'Plan', removable: true, options: [{ value: 'Pro', label: 'Pro' }] }]);
    await panel.populate([{ scope: 'data', label: 'Rows', filters: [{ id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }] }] }]);
    const sr = bar.shadowRoot!;
    const more = async (): Promise<(string | null)[]> => {
      sr.querySelector<HTMLElement>('.act[data-act="overflow"]')!.shadowRoot!.querySelector('button')!.click();
      await window.__settled();
      return [...sr.querySelectorAll('.more-menu .more-label')].map((l) => (l.textContent ?? '').trim());
    };
    // Nothing taken: one row, and it asks for a name.
    bar.savedSets = [{ id: 'a', label: 'A', own: true }];
    const none = await more();
    (sr.querySelector('.more-menu') as HTMLElement & { hide?(): void }).hide?.();
    const sets = [{ id: 'a', label: 'A', applied: true, own: true }, { id: 'b', label: 'B', own: true }];
    bar.savedSets = sets;
    panel.savedSets = sets;
    await window.__settled();
    const heard: string[] = [];
    for (const el of [bar, panel]) {
      for (const type of ['filters-save', 'filters-save-as', 'filters-delete', 'filters-apply', 'filters-dismiss']) {
        el.addEventListener(type, (e) => heard.push(`${el.localName.replace('sherpa-', '')}:${type}:${(e as CustomEvent).detail?.id ?? ''}`));
      }
    }
    const taken = await more();
    sr.querySelector<HTMLElement>('.more-menu .more-item[value="filters-save-as"]')!.click();
    // The panel's own button, and its menu's Delete.
    panel.shadowRoot!.querySelector('.save-filters')!.shadowRoot!.querySelector('button')!.click();
    panel.shadowRoot!.querySelector('.save-menu')!.dispatchEvent(
      new CustomEvent('menu-select', { bubbles: true, composed: true, detail: { value: 'filters-delete' } }));
    // The Filters menu: B ticked takes it; A unticked takes it off.
    const menu = sr.querySelector('.add-btn sherpa-menu')!;
    const values = (menu as unknown as { values: string[] }).values;
    menu.dispatchEvent(new CustomEvent('menu-change', { bubbles: true, composed: true, detail: { values: [...values, 'set:b'] } }));
    menu.dispatchEvent(new CustomEvent('menu-change', { bubbles: true, composed: true,
      detail: { values: values.filter((v: string) => v !== 'set:a') } }));
    return { none, taken, ticked: values.filter((v: string) => v.startsWith('set:')), heard };
  });
  expect(r.none.filter((l) => l?.startsWith('Save') || l?.startsWith('Delete'))).toEqual(['Save filters…']);
  expect(r.taken).toEqual(expect.arrayContaining(['Save A', 'Save filters as…', 'Delete filters']));
  expect(r.ticked).toEqual(['set:a']);
  expect(r.heard).toEqual([
    'quick-filter-toolbar:filters-save-as:', 'filter-panel:filters-save:', 'filter-panel:filters-delete:a',
    'quick-filter-toolbar:filters-apply:b', 'quick-filter-toolbar:filters-dismiss:a',
  ]);
});

/* A PAGE'S OWN saved filter (366 S2): a query definition in its JSON, listed
   beside a reader's on every bar, applied as theirs is, and never saved over or
   deleted — a name that is its gets a copy's. */
test('a page\'s own saved filter is listed on an unsaveable bar, fills the chips, is ticked while taken, and is never saved over or deleted', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    const provider = document.createElement('sherpa-provider');
    provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="view"></sherpa-quick-filter-toolbar>'
      + '<sherpa-quick-filter-toolbar data-scope="data" data-saveable></sherpa-quick-filter-toolbar>';
    document.getElementById('root').replaceChildren(provider);
    const [viewBar, dataBar] = provider.querySelectorAll('sherpa-quick-filter-toolbar');
    const rows = [{ id: 1, plan: 'Pro', tier: 'gold' }, { id: 2, plan: 'Free', tier: 'gold' }, { id: 3, plan: 'Pro', tier: 'silver' }];
    const source = await provider.open({
      v: 1, id: 'plans',
      source: {
        store: 'plans', fields: { plan: { label: 'Plan' }, tier: { label: 'Tier' } },
        scopes: { view: { label: 'View', holds: ['tier'] }, data: { label: 'Rows', holds: ['plan'] } },
      },
      savedFilters: { 'pro-only': { label: 'Pro only', query: { v: 1, scopes: { data: { where: { plan: { eq: 'Pro' } } } } } } },
    }, { stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
    const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    await settle();
    const sets = (bar) => (bar.shadowRoot.querySelector('.add-btn sherpa-menu')?.itemData ?? [])
      .filter((i) => i.value.startsWith('set:')).map((i) => i.label);
    const listed = { view: sets(viewBar), data: sets(dataBar) };
    await provider.applyFilters('pro-only');
    await source.load();
    await settle();
    const chip = dataBar.shadowRoot.querySelector('.chip[data-id="plan"]');
    const taken = {
      rows: source.rows.map((row) => row.id),
      chip: chip?.valueLabel ?? null,
      ticked: (dataBar.shadowRoot.querySelector('.add-btn sherpa-menu')?.values ?? []).filter((v) => v.startsWith('set:')),
      read: provider.savedFilterSets,
    };
    const over = provider.saveFilters();
    const deleted = provider.deleteFilters();
    const copy = provider.saveFilters('Pro only');
    return { listed, taken, over: over ?? null, deleted, copy, after: provider.savedFilterSets.map((set) => [set.id, set.own]) };
  })()`) as Record<string, any>;
  expect(r['listed']).toEqual({ view: ['Pro only'], data: ['Pro only'] });
  expect(r['taken']).toEqual({
    rows: [1, 3], chip: 'Pro', ticked: ['set:pro-only'],
    read: [{ id: 'pro-only', label: 'Pro only', applied: true, own: false }],
  });
  expect(r['over']).toBeNull();
  expect(r['deleted']).toBe(false);
  expect(r['copy']).toBe('pro-only-copy-001');
  expect(r['after']).toEqual([['pro-only', false], ['pro-only-copy-001', true]]);
});
