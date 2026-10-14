import { test, expect } from './fixture';

/**
 * SAVE FILTERS — Will, TODO 105. Every scope's filters under one name, kept
 * with the page beside its Views. Applied from the Filters menu's Saved
 * section, the Saved chip names it — ` *` and the warning look once changed —
 * and its cross puts the filters back as they were.
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
  const chip = (el) => {
    const saved = el.shadowRoot.querySelector('.saved-chip');
    return { shown: el.hasAttribute('data-saved'), says: saved.valueLabel, warning: saved.dataset.status === 'warning' };
  };
`;

test.beforeEach(async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('sherpa:filter')) localStorage.removeItem(key);
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('sherpa:filter')) sessionStorage.removeItem(key);
  });
});

test('Save filters keeps every scope under one name; the Saved chip says it, and an edit marks it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const source = await open();
    source.select('plan', ['Pro']);
    source.select('tier', ['gold']);
    await source.load();
    const id = provider.saveFilters('Gold Pro');
    await settle();
    const stored = JSON.parse(localStorage.getItem('sherpa:filter-sets:plans') ?? '{}');
    const saved = { bar: chip(bar), panel: chip(panel), read: provider.savedFilters };
    source.select('plan', ['Free']);
    await source.load();
    await settle();
    const edited = { bar: chip(bar), read: provider.savedFilters };
    // Saved again: the change is the set now.
    provider.saveFilters();
    await settle();
    return { id, stored, saved, edited, again: chip(panel) };
  })()`) as Record<string, any>;
  expect(r['id']).toBe('gold-pro');
  const scopes = r['stored']['gold-pro'].query.scopes;
  expect(r['stored']['gold-pro'].label).toBe('Gold Pro');
  expect(scopes.view.where).toEqual({ tier: { eq: 'gold' } });
  expect(scopes.data.where).toEqual({ plan: { eq: 'Pro' } });
  // The filter half: no arrangement.
  expect(scopes.view.sort).toBeUndefined();
  expect(r['saved']).toEqual({
    bar: { shown: true, says: 'Gold Pro', warning: false }, panel: { shown: true, says: 'Gold Pro', warning: false },
    read: { id: 'gold-pro', label: 'Gold Pro', edited: false },
  });
  expect(r['edited']).toEqual({
    bar: { shown: true, says: 'Gold Pro *', warning: true }, read: { id: 'gold-pro', label: 'Gold Pro', edited: true },
  });
  expect(r['again']).toEqual({ shown: true, says: 'Gold Pro', warning: false });
});

test('a set applies from the Filters menu, its cross dismisses it, and a reload keeps it on', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    localStorage.setItem('sherpa:filter-sets:plans', JSON.stringify({ silver: { label: 'Silver',
      query: { v: 1, scopes: { view: { holds: ['tier'], where: { tier: { eq: 'silver' } } } } } } }));
    const source = await open();
    source.select('plan', ['Free']);
    await source.load();
    await settle();
    // The Saved section lists it, and its tick asks to apply it.
    const listed = bar.savedSets.map((s) => s.id);
    bar.dispatchEvent(new CustomEvent('filters-apply', { bubbles: true, composed: true, detail: { id: 'silver' } }));
    await settle();
    await source.load();
    const applied = { tier: source.query.applied.scopes.view.readings.tier?.picked,
      plan: source.query.applied.scopes.data.readings.plan?.picked, total: source.debugState().total, chip: chip(bar) };
    // A reload — a fresh provider over the same tab — keeps it on.
    provider.close();
    const again = await open();
    await settle();
    const kept = { chip: chip(panel), read: provider.savedFilters };
    panel.shadowRoot.querySelector('.saved-chip').dispatchEvent(
      new CustomEvent('quick-filter-dismiss', { bubbles: true, composed: true, detail: {} }));
    await settle();
    await again.load();
    return { listed, applied, kept, dismissed: { tier: again.query.applied.scopes.view?.readings.tier?.picked ?? [],
      plan: again.query.applied.scopes.data.readings.plan?.picked, chip: chip(panel) } };
  })()`) as Record<string, any>;
  expect(r['listed']).toEqual(['silver']);
  // It sets the scope it names, and leaves the other as it was.
  expect(r['applied']).toEqual({ tier: ['silver'], plan: ['Free'], total: 0, chip: { shown: true, says: 'Silver', warning: false } });
  expect(r['kept']).toEqual({ chip: { shown: true, says: 'Silver', warning: false }, read: { id: 'silver', label: 'Silver', edited: false } });
  expect(r['dismissed']).toEqual({ tier: [], plan: ['Free'], chip: { shown: false, says: 'Silver', warning: false } });
});

test('Delete forgets a set; an old one-scope saved filter is not adopted', async ({ page }) => {
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
      chip: chip(bar), rows: bar.savedSets };
  })()`) as Record<string, any>;
  expect(Object.keys(r['sets'])).toEqual(['pro-only']);
  expect(r['old']).not.toBeNull();
  expect(r['deleted']).toBe(true);
  expect(r['left']).toEqual({});
  expect(r['chip'].shown).toBe(false);
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
    const sets = [{ id: 'a', label: 'A', on: true }, { id: 'b', label: 'B' }];
    bar.savedSets = sets;
    panel.savedSets = sets;
    await window.__settled();
    const heard: string[] = [];
    for (const el of [bar, panel]) {
      for (const type of ['filters-save', 'filters-save-as', 'filters-delete', 'filters-apply', 'filters-dismiss']) {
        el.addEventListener(type, (e) => heard.push(`${el.localName.replace('sherpa-', '')}:${type}:${(e as CustomEvent).detail?.id ?? ''}`));
      }
    }
    // The bar's ⋮.
    const sr = bar.shadowRoot!;
    sr.querySelector<HTMLElement>('.act[data-act="overflow"]')!.shadowRoot!.querySelector('button')!.click();
    await window.__settled();
    const more = [...sr.querySelectorAll('.more-menu .more-label')].map((l) => l.textContent);
    sr.querySelector<HTMLElement>('.more-menu .more-item[value="filters-save-as"]')!.click();
    // The panel's own button, and its menu's Delete.
    panel.shadowRoot!.querySelector('.save-filters')!.shadowRoot!.querySelector('button')!.click();
    panel.shadowRoot!.querySelector('.save-menu')!.dispatchEvent(
      new CustomEvent('menu-select', { bubbles: true, composed: true, detail: { value: 'filters-delete' } }));
    // The Filters menu: B ticked applies it; A unticked dismisses.
    const menu = sr.querySelector('.add-btn sherpa-menu')!;
    const values = (menu as unknown as { values: string[] }).values;
    menu.dispatchEvent(new CustomEvent('menu-change', { bubbles: true, composed: true, detail: { values: [...values, 'set:b'] } }));
    menu.dispatchEvent(new CustomEvent('menu-change', { bubbles: true, composed: true,
      detail: { values: values.filter((v: string) => v !== 'set:a') } }));
    return { more, ticked: values.filter((v: string) => v.startsWith('set:')), heard };
  });
  expect(r.more).toEqual(expect.arrayContaining(['Save filters', 'Save filters as', 'Delete filters']));
  expect(r.ticked).toEqual(['set:a']);
  expect(r.heard).toEqual([
    'quick-filter-toolbar:filters-save-as:', 'filter-panel:filters-save:', 'filter-panel:filters-delete:a',
    'quick-filter-toolbar:filters-apply:b', 'quick-filter-toolbar:filters-dismiss:',
  ]);
});
