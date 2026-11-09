import { test, expect } from './harness';

/**
 * sherpa-provider — a component ASKS, the nearest provider ANSWERS.
 *
 * A grid inside a provider fills with no `bind()` from anyone; one outside
 * waits for a page to populate it. A provider offering two sources refuses an
 * unnamed ask, loudly, and a named one reaches its source. docs/PROVIDER-DESIGN.md.
 * TRAP T-a-component-asks-its-provider
 */
const SETUP = `
  const { ArrayStore, DataSource, onReport } = await import('/dist/index.js');
  const reports = [];
  onReport((r) => reports.push(r.code));
  const rows = (n, tag) => Array.from({ length: n }, (_, i) => ({ id: i, name: tag + i }));
  const source = (n, tag) => new DataSource({ store: new ArrayStore(rows(n, tag), { key: 'id' }) });
  // Every element rendered and painted — never a fixed wait.
  const settle = () => window.__settled();
  const root = document.getElementById('root');
  root.innerHTML = '';
  const grid = (attrs = '') => {
    const g = document.createElement('sherpa-data-grid');
    for (const [k, v] of Object.entries(attrs || {})) g.setAttribute(k, v);
    g.columns = [{ field: 'name', header: 'Name' }];
    g.key = 'id';
    return g;
  };
  const drawn = (g) => g.shadowRoot.querySelectorAll('.body .row, tbody tr').length;
`;

/* THE WHOLE COLUMN comes from the data layer. A heading menu built from one
   page of rows lists only that page; the grid ASKS for its text columns' whole
   lists, and the provider sends them with the rows (TODO 37).
   TRAP T-unavailable-value-sorts-below-a-divider */
test('a paged grid in a provider lists the WHOLE column in its heading menu', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const g = grid({ 'data-column-filters': '' });
    provider.append(g);
    root.append(provider);
    const src = new DataSource({ store: new ArrayStore(rows(6, 'n'), { key: 'id' }), pageSize: 2 });
    // A page declares what its fields may hold, as openSource does.
    await src.declareFromRows(['name']);
    await provider.provide({ sources: { s: src } });
    await settle();
    const menu = g.shadowRoot.querySelector('.head-cell[data-field="name"] sherpa-menu');
    const listed = [...menu.querySelectorAll('input')].map((i) => i.value).filter((v) => v && v !== 'on');
    return { drawn: drawn(g), listed, reports };
  })()`) as Record<string, unknown>;
  expect(r['drawn']).toBe(2);
  expect(r['listed']).toEqual(['n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
  expect(r['reports']).toEqual([]);
});

/* "Hide unmatching filters" reaches a grid's headings as it reaches a bar:
   the provider tells the grid, and its heading menus hide a ruled-out value.
   TODO 305 · TRAP T-a-ruled-out-value-is-greyed */
test('a grid heading menu follows the provider\'s Hide unmatching switch', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const g = grid({ 'data-column-filters': '' });
    g.columns = [{ field: 'region', header: 'Region' }];
    provider.append(g);
    root.append(provider);
    const src = new DataSource({ store: new ArrayStore(
      [{ id: 0, region: 'EMEA' }, { id: 1, region: 'AMER' }], { key: 'id' }) });
    await src.declareFromRows(['region']);
    await provider.provide({ sources: { s: src } });
    provider.settings.set('limitOptions', true);
    provider.settings.set('hideUnmatched', true);
    await settle();
    const menu = () => g.shadowRoot.querySelector('.head-cell[data-field="region"] sherpa-menu');
    const amer = () => [...menu().querySelectorAll('.menu-row')].find((row) => row.querySelector('input')?.value === 'AMER');
    const read = () => ({ hides: menu().hasAttribute('data-hide-unavailable'),
      greyed: amer().hasAttribute('data-unavailable'), shown: getComputedStyle(amer()).display !== 'none' });
    const told = [g.dataset.limitOptions, g.dataset.hideUnmatched];
    // The filters before it leave EMEA alone.
    g.drawPresent({ region: ['EMEA'] });
    await settle();
    const hidden = read();
    provider.settings.set('hideUnmatched', false);
    await settle();
    return { told, hidden, greyed: read(), after: g.dataset.hideUnmatched, reports };
  })()`) as Record<string, unknown>;
  expect(r['told']).toEqual(['on', 'on']);
  expect(r['hidden']).toEqual({ hides: true, greyed: true, shown: false });
  expect(r['greyed']).toEqual({ hides: false, greyed: true, shown: true });
  expect(r['after']).toBe('off');
  expect(r['reports']).toEqual([]);
});

/* A provider used BEFORE it has drawn its template still gives its mode
   buttons — once it has. Making one from a template that is not there yet
   threw. TRAP T-the-mode-switch-is-the-pages-own */
test('mode buttons wait for the provider to draw; nothing throws', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 900 });
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const bar = document.createElement('sherpa-quick-filter-toolbar');
    bar.setAttribute('data-scope', 'data');
    // The page-level bar (the app header's) is the mode switch's one home. TRAP T-the-mode-switch-is-the-pages-own
    bar.setAttribute('data-type', 'view');
    const panelShell = document.createElement('sherpa-overlay-panel');
    panelShell.setAttribute('data-heading', 'Filters');
    panelShell.setAttribute('open', '');
    const panel = document.createElement('sherpa-filter-panel');
    panel.setAttribute('data-scope', 'view data');
    panelShell.append(panel);
    provider.append(bar, panelShell);
    root.append(provider);
    // At once: nothing has drawn yet.
    provider.settings.set('filterMode', 'toolbars');
    const src = source(2, 'p');
    src.query.offer('data', ['name']);
    await provider.provide({ sources: { s: src } });
    await settle();
    return { bar: !!bar.querySelector('[data-filter-mode]'), panel: !!panelShell.querySelector('[data-filter-mode]'), reports };
  })()`) as Record<string, unknown>;
  expect(r).toEqual({ bar: true, panel: true, reports: [] });
  expect(errors).toEqual([]);
});

test('a grid inside a provider fills with no bind; one outside waits', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const inside = grid();
    provider.append(inside);
    const outside = grid();
    root.append(provider, outside);
    // Asked BEFORE there is a source: it waits, and provide() answers it.
    await settle();
    const before = drawn(inside);
    const src = source(3, 'a');
    provider.provide({ sources: { customers: src } });
    await src.load();
    await settle();
    return { before, inside: drawn(inside), outside: drawn(outside), columns: inside.columns.length,
      locked: inside.hasAttribute('data-locked'), bound: src.boundElements.length, reports };
  })()`) as Record<string, unknown>;
  expect(r['before']).toBe(0);
  expect(r['inside']).toBe(3);
  // The page's CONFIGURATION stands — the data came in beside it.
  expect(r['columns']).toBe(1);
  expect(r['locked']).toBe(true);
  expect(r['outside']).toBe(0);
  expect(r['bound']).toBe(1);
  expect(r['reports']).toEqual([]);
});

test('two sources: a card\'s Retry reloads the source it shows; an unnamed one reloads nothing', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const card = document.createElement('sherpa-container');
    card.append(grid({ 'data-source': 'invoices' }));
    const loose = document.createElement('div');
    provider.append(card, loose);
    root.append(provider);
    await settle();
    const customers = source(2, 'c');
    const invoices = source(5, 'i');
    provider.provide({ sources: { customers, invoices } });
    await Promise.all([customers.load(), invoices.load()]);
    await settle();
    const loads = [];
    for (const [name, s] of Object.entries({ customers, invoices })) {
      const real = s.load.bind(s);
      s.load = (o) => { loads.push(name); return real(o); };
    }
    card.dispatchEvent(new CustomEvent('data-refresh', { bubbles: true, composed: true }));
    const byCard = [...loads];
    reports.length = 0;
    loose.dispatchEvent(new CustomEvent('data-refresh', { bubbles: true, composed: true }));
    return { byCard, byLoose: loads.slice(byCard.length), reports: [...new Set(reports)] };
  })()`) as Record<string, unknown>;
  expect(r['byCard']).toEqual(['invoices']);
  expect(r['byLoose']).toEqual([]);
  expect(r['reports']).toEqual(['provider-ambiguous']);
});

test('two sources: an unnamed ask is refused loudly, a named one is answered', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const unnamed = grid();
    const named = grid({ 'data-source': 'invoices' });
    const wrong = grid({ 'data-source': 'orders' });
    provider.append(unnamed, named, wrong);
    root.append(provider);
    await settle();
    const customers = source(2, 'c');
    const invoices = source(5, 'i');
    provider.provide({ sources: { customers, invoices } });
    await Promise.all([customers.load(), invoices.load()]);
    await settle();
    return { unnamed: drawn(unnamed), named: drawn(named), wrong: drawn(wrong), reports: [...new Set(reports)].sort() };
  })()`) as Record<string, unknown>;
  expect(r['unnamed']).toBe(0);
  expect(r['named']).toBe(5);
  expect(r['wrong']).toBe(0);
  expect(r['reports']).toEqual(['provider-ambiguous', 'provider-unknown-source']);
});

/* PROVIDERS NEST: an inner one answers what it gives, and an ask for a source it
   does not give travels up to the one that does — its data and the source itself —
   whichever is given its sources first. A name no provider gives is said, by the
   nearest. PROVIDER-DESIGN §3 */
for (const first of ['outer', 'inner']) {
  test(`nested providers: the one above answers a source the inner one does not give (${first} provided first)`, async ({ page }) => {
    const r = await page.evaluate(`(async () => {
      ${SETUP}
      const { SOURCE_CONTEXT, ContextRequestEvent } = await import('/dist/index.js');
      const outer = document.createElement('sherpa-provider');
      const inner = document.createElement('sherpa-provider');
      const own = grid();
      const above = grid({ 'data-source': 'invoices' });
      const none = grid({ 'data-source': 'orders' });
      inner.append(own, above, none);
      outer.append(inner);
      // Asked BEFORE either has a source: each waits in the inner one.
      root.append(outer);
      await settle();
      const invoices = source(5, 'i');
      const customers = source(2, 'c');
      const give = { outer: () => outer.provide({ sources: { invoices } }), inner: () => inner.provide({ sources: { customers } }) };
      give['${first}']();
      give['${first}' === 'outer' ? 'inner' : 'outer']();
      await Promise.all([customers.load(), invoices.load()]);
      await settle();
      let given = null;
      above.dispatchEvent(new ContextRequestEvent(SOURCE_CONTEXT, above, (s) => { given = s; }));
      return { own: drawn(own), above: drawn(above), none: drawn(none), source: given === invoices,
        bound: [customers.boundElements.length, invoices.boundElements.length], reports: [...new Set(reports)] };
    })()`) as Record<string, unknown>;
    expect(r['own']).toBe(2);
    expect(r['above']).toBe(5);
    expect(r['none']).toBe(0);
    expect(r['source']).toBe(true);
    expect(r['bound']).toEqual([1, 1]);
    expect(r['reports']).toEqual(['provider-unknown-source']);
  });
}

test('a component that leaves the page leaves its source; a new source reaches what stays', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const stays = grid();
    const goes = grid();
    provider.append(stays, goes);
    root.append(provider);
    const first = source(2, 'f');
    provider.provide({ sources: { one: first } });
    await first.load();
    await settle();
    goes.remove();
    await settle();
    const afterRemove = first.boundElements.length;
    // A Context swapping its source swaps it for everything still asking.
    const second = source(4, 's');
    provider.provide({ sources: { one: second } });
    await second.load();
    await settle();
    return { afterRemove, stays: drawn(stays), firstBound: first.boundElements.length, secondBound: second.boundElements.length };
  })()`) as Record<string, number>;
  expect(r['afterRemove']).toBe(1);
  expect(r['stays']).toBe(4);
  expect(r['firstBound']).toBe(0);
  expect(r['secondBound']).toBe(1);
});

/* THE PROVIDER KEEPS THE VIEWS: it hears a View pick from inside, puts the
   View's Query on, keeps the Query in the page's one document, and puts it back
   — only on the View it was made on. TRAP T-a-provider-keeps-the-views */
test('a provider applies a View pick, keeps the Query, and restores it on its own View only', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const { PageKeeper, memoryTier } = await import('/dist/index.js');
    const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
    const VIEWS = {
      all: { label: 'All', query: { v: 1, scopes: { view: {} } } },
      odd: { label: 'Odd', query: { v: 1, scopes: { view: { readings: { name: { picked: ['o1', 'o3'] } } } } } },
    };
    const provider = document.createElement('sherpa-provider');
    provider.keeper = keeper;
    const g = grid();
    provider.append(g);
    root.append(provider);
    const src = source(4, 'o');
    await provider.provide({ sources: { s: src }, views: VIEWS, key: 'q' });
    await src.load();
    await settle();
    const before = drawn(g);
    // A pick reported, as the View chip reports it — its bar is scoped, so the provider hears it.
    provider.dispatchEvent(new CustomEvent('quick-filter-change', {
      bubbles: true, composed: true, detail: { scope: 'bar', values: { view: ['odd'] } },
    }));
    await settle();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const picked = { rows: drawn(g), view: provider.view, kept: keeper.read('q').view };
    // A reload on the SAME View puts the kept Query back.
    const again = source(4, 'o');
    await provider.provide({ sources: { s: again }, views: VIEWS, view: 'odd', key: 'q' });
    await again.load();
    await settle();
    const restored = drawn(g);
    // On ANOTHER View the kept Query is not its own, so the View's is used.
    const other = source(4, 'o');
    await provider.provide({ sources: { s: other }, views: VIEWS, view: 'all', key: 'q' });
    await other.load();
    await settle();
    return { before, picked, restored, other: drawn(g), reports };
  })()`) as Record<string, unknown>;
  expect(r['before']).toBe(4);
  expect(r['picked']).toEqual({ rows: 2, view: 'odd', kept: 'odd' });
  expect(r['restored']).toBe(2);
  expect(r['other']).toBe(4);
  expect(r['reports']).toEqual([]);
});

/* THE PAGE GOES OUT AS JSON: one provider's state — the page's one document —
   taken in by another, gives the same rows and the same View, and the View it
   left is still heard. TRAP T-a-page-goes-out-as-json */
test('a provider exports its state as JSON; another takes it in and draws the same rows', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const VIEWS = {
      all: { label: 'All', query: { v: 1, scopes: { view: {} } } },
      odd: { label: 'Odd', query: { v: 1, scopes: { view: { readings: { name: { picked: ['j1', 'j3'] } } } } } },
    };
    const make = () => {
      const provider = document.createElement('sherpa-provider');
      const g = grid();
      provider.append(g);
      root.append(provider);
      return { provider, g };
    };
    const one = make();
    const a = source(4, 'j');
    await one.provider.provide({ sources: { s: a }, views: VIEWS });
    await a.load();
    one.provider.dispatchEvent(new CustomEvent('quick-filter-change', {
      bubbles: true, composed: true, detail: { scope: 'bar', values: { view: ['odd'] } },
    }));
    await settle();
    const json = JSON.stringify(one.provider.export());

    const two = make();
    const b = source(4, 'j');
    await two.provider.provide({ sources: { s: b }, views: VIEWS });
    await b.load();
    await two.provider.import(JSON.parse(json));
    await settle();
    const taken = { rows: drawn(two.g), view: two.provider.view };
    // The View it LEFT is heard: a pick of it is not mistaken for the one on screen.
    two.provider.dispatchEvent(new CustomEvent('quick-filter-change', {
      bubbles: true, composed: true, detail: { scope: 'bar', values: { view: ['all'] } },
    }));
    await settle();
    const state = JSON.parse(json);
    return { json: { v: state.v, view: state.view, picked: state.query.scopes.view.readings.name.picked }, taken,
      back: { rows: drawn(two.g), view: two.provider.view }, reports };
  })()`) as Record<string, unknown>;
  expect(r['json']).toEqual({ v: 3, view: 'odd', picked: ['j1', 'j3'] });
  expect(r['taken']).toEqual({ rows: 2, view: 'odd' });
  expect(r['back']).toEqual({ rows: 4, view: 'all' });
  expect(r['reports']).toEqual([]);
});

/* THE PROVIDER OWNS THE PANEL MODE, for every page in it: a bar's mode button
   opens the panel and steps every bar back — one that joins later too — and a
   reader's close brings the bars back. TRAP T-the-provider-owns-the-panel-mode */
test('panel mode: Configure opens the panel and steps bars back; a later bar joins it; a close restores', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const bar = document.createElement('sherpa-quick-filter-toolbar');
    bar.setAttribute('data-scope', 'data');
    // The page-level bar (the app header's) is the mode switch's one home. TRAP T-the-mode-switch-is-the-pages-own
    bar.setAttribute('data-type', 'view');
    const panelShell = document.createElement('sherpa-overlay-panel');
    panelShell.setAttribute('data-heading', 'Filters');
    panelShell.setAttribute('open', '');
    const panel = document.createElement('sherpa-filter-panel');
    panel.setAttribute('data-scope', 'view data');
    panelShell.append(panel);
    provider.append(bar, panelShell);
    root.append(provider);
    const heard = [];
    provider.addEventListener('setting-change', (e) => { if (e.detail.key === 'filterMode') heard.push(e.detail.value); });
    const src = source(2, 'p');
    src.query.offer('data', ['name']);
    src.declareField('name', { label: 'Name' });
    await provider.provide({ sources: { s: src } });
    await settle();
    // The page's own mode button, in the bar's actions slot. TRAP T-the-mode-switch-is-the-pages-own
    bar.querySelector('[data-filter-mode]').dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
    await settle();
    const opened = { open: panel.hasAttribute('open'), bar: bar.hasAttribute('data-panel-mode'), mode: provider.settings.get('filterMode') };
    const late = document.createElement('sherpa-quick-filter-toolbar');
    late.setAttribute('data-scope', 'data');
    provider.append(late);
    await settle();
    const joined = late.hasAttribute('data-panel-mode');
    panel.close();
    await settle();
    return { opened, joined, closed: { open: panel.hasAttribute('open'), bar: bar.hasAttribute('data-panel-mode'), late: late.hasAttribute('data-panel-mode') }, heard, reports };
  })()`) as Record<string, unknown>;
  expect(r['opened']).toEqual({ open: true, bar: true, mode: 'panel' });
  expect(r['joined']).toBe(true);
  expect(r['closed']).toEqual({ open: false, bar: false, late: false });
  expect(r['heard']).toEqual(['panel', 'toolbars']);
  expect(r['reports']).toEqual([]);
});

/* THE MODE SWITCH IS THE PAGE'S. No bar or panel carries it: the provider puts
   one in each bar's `actions` slot while a panel is on the page, takes it out
   while the panel answers, and gives the panel its way back.
   TRAP T-the-mode-switch-is-the-pages-own */
test('the provider gives bars and the panel their mode buttons, only while a panel is on the page', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const bar = document.createElement('sherpa-quick-filter-toolbar');
    bar.setAttribute('data-scope', 'data');
    // The page-level bar (the app header's) is the mode switch's one home. TRAP T-the-mode-switch-is-the-pages-own
    bar.setAttribute('data-type', 'view');
    provider.append(bar);
    root.append(provider);
    const src = source(2, 'p');
    src.query.offer('data', ['name']);
    src.declareField('name', { label: 'Name' });
    await provider.provide({ sources: { s: src } });
    await settle();
    const toggle = (el) => el.querySelector('[data-filter-mode]');
    const local = document.createElement('sherpa-quick-filter-toolbar');
    local.setAttribute('data-scope', 'data');
    provider.append(local);
    await settle();
    const alone = !!toggle(bar);
    const panelShell = document.createElement('sherpa-overlay-panel');
    panelShell.setAttribute('data-heading', 'Filters');
    panelShell.setAttribute('open', '');
    const panel = document.createElement('sherpa-filter-panel');
    panel.setAttribute('data-scope', 'view data');
    panelShell.append(panel);
    provider.append(panelShell);
    await settle();
    const withPanel = { bar: toggle(bar)?.getAttribute('aria-label'), slot: toggle(bar)?.slot };
    toggle(bar).dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
    await settle();
    const inPanel = { bar: !!toggle(bar), barOff: toggle(bar)?.hasAttribute('disabled'), panel: toggle(panelShell)?.getAttribute('aria-label'), mode: provider.settings.get('filterMode') };
    toggle(panelShell).dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
    await settle();
    return { alone, withPanel, inPanel, localNever: !!toggle(local), back: { bar: !!toggle(bar), mode: provider.settings.get('filterMode') }, reports };
  })()`) as Record<string, unknown>;
  expect(r['alone']).toBe(false);
  // A local scope's bar never has it: not alone, not with a panel, not in panel mode.
  expect(r['localNever']).toBe(false);
  expect(r['withPanel']).toEqual({ bar: 'View as filter panel', slot: 'actions' });
  // The header bar's switch stays, inactive: the panel's own header returns to the toolbars.
  expect(r['inPanel']).toEqual({ bar: true, barOff: true, panel: 'Filter in the toolbars instead', mode: 'panel' });
  expect(r['back']).toEqual({ bar: true, mode: 'toolbars' });
  expect(r['reports']).toEqual([]);
});

/* A PAGE WITH NO DATA shuts the panel — not the reader's choice, so the next
   page with filters opens it again. TRAP T-navigating-sets-up-the-page */
test('a page with no data shuts the panel without changing the mode; the next page reopens it', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const panelShell = document.createElement('sherpa-overlay-panel');
    panelShell.setAttribute('data-heading', 'Filters');
    panelShell.setAttribute('open', '');
    const panel = document.createElement('sherpa-filter-panel');
    panel.setAttribute('data-scope', 'view data');
    panelShell.append(panel);
    provider.append(panelShell);
    root.append(provider);
    const heard = [];
    provider.addEventListener('setting-change', (e) => { if (e.detail.key === 'filterMode') heard.push(e.detail.value); });
    provider.settings.set('filterMode', 'panel');
    await provider.provide({ sources: { s: source(2, 'x') } });
    await settle();
    const first = panel.hasAttribute('open');
    await provider.provide({ sources: {} });
    await settle();
    const empty = panel.hasAttribute('open');
    await provider.provide({ sources: { s: source(3, 'y') } });
    await settle();
    return { first, empty, again: panel.hasAttribute('open'), heard, reports };
  })()`) as Record<string, unknown>;
  expect(r['first']).toBe(true);
  expect(r['empty']).toBe(false);
  expect(r['again']).toBe(true);
  expect(r['heard']).toEqual([]);
  expect(r['reports']).toEqual([]);
});
