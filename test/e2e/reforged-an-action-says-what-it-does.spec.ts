import { test, expect } from './harness';

/**
 * AN ACTION SAYS WHAT IT DOES — Will, TODO 691. An action button's description is
 * shown under the heading of the menu it opens, unless the page turns it off
 * (`<html data-no-action-descriptions>`).
 * TRAP T-an-action-says-what-it-does
 */
test('a button\'s menu shows its description under its heading; the page can turn it off', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = `<sherpa-button data-label="Filters" data-description="Add, change and save the filters on this page">
      <sherpa-menu slot="menu" data-heading="Filters"><button type="button" value="a">A</button></sherpa-menu>
    </sherpa-button>`;
    const settle = async () => { await window.__settled(); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); };
    await settle();
    const button = root.querySelector('sherpa-button') as HTMLElement;
    const menu = root.querySelector('sherpa-menu') as HTMLElement;
    button.shadowRoot!.querySelector('button')!.click();
    await settle();
    const line = () => {
      const d = menu.shadowRoot!.querySelector<HTMLElement>('.description')!;
      return { text: d.textContent, shown: getComputedStyle(d).display !== 'none', below: d.getBoundingClientRect().top >= menu.shadowRoot!.querySelector('.heading')!.getBoundingClientRect().bottom - 0.5 };
    };
    const on = { open: menu.hasAttribute('open'), ...line() };
    document.documentElement.toggleAttribute('data-no-action-descriptions', true);
    await settle();
    const off = line();
    document.documentElement.removeAttribute('data-no-action-descriptions');
    return { on, off };
  });
  expect(r.on).toEqual({ open: true, text: 'Add, change and save the filters on this page', shown: true, below: true });
  expect(r.off.shown).toBe(false);
});

test('a filter bar\'s Filters and ⋮ menus each say what they do', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    const provider = document.createElement('sherpa-provider') as HTMLElement & { open(d: unknown, o: unknown): Promise<unknown> };
    provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="data"></sherpa-quick-filter-toolbar>';
    root.replaceChildren(provider);
    const bar = provider.querySelector('sherpa-quick-filter-toolbar')!;
    await provider.open({ v: 1, id: 'p', source: { store: 's', fields: { plan: { label: 'Plan' } }, scopes: { data: { label: 'Rows', holds: ['plan'] } } } },
      { stores: { s: new ArrayStore([{ id: 1, plan: 'Pro' }], { key: 'id' }) }, views: {} });
    const settle = async () => { await window.__settled(); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); };
    await settle();
    const said: Record<string, string | null> = {};
    for (const [name, sel] of [['filters', '.add-btn'], ['more', '[data-act="overflow"]']] as const) {
      const btn = bar.shadowRoot!.querySelector<HTMLElement>(sel)!;
      btn.shadowRoot!.querySelector('button')!.click();
      await settle();
      const menu = btn.querySelector('sherpa-menu') ?? bar.shadowRoot!.querySelector('sherpa-menu.more-menu');
      said[name] = menu!.hasAttribute('open') ? menu!.shadowRoot!.querySelector('.description')!.textContent : null;
      btn.shadowRoot!.querySelector('button')!.click();
      await settle();
    }
    return said;
  });
  expect(r).toEqual({ filters: 'Add filters to this page, or remove them.', more: 'Reset, save and refresh these filters.' });
});

/* A TIP IN LINES — Will, TODO 691 S3. Where the page says (`<html
   data-description-tips>`), a tip reads its Name, its Description, its Value, then
   the rest; off, its one line as before. TRAP T-a-tip-in-lines */
test('a button\'s tip, in lines: its name, then what it does; off, as before — and a labelled one says nothing', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = `<sherpa-button id="icon" data-type="icon" data-icon-start="ellipses-vertical" aria-label="More actions" data-description="Reset, save and refresh these filters."></sherpa-button>
      <sherpa-button id="labelled" data-label="Save"></sherpa-button>`;
    const settle = async () => { await window.__settled(); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); };
    await settle();
    const lines = (id: string) => {
      const tip = document.getElementById(id)!.shadowRoot!.querySelector<HTMLElement>('.tip')!;
      tip.showPopover();
      const shown = getComputedStyle(tip).display !== 'none';
      const read = [...tip.querySelectorAll('.tip-line')].map((l) => l.textContent);
      tip.hidePopover();
      return { shown, read };
    };
    const off = { icon: lines('icon'), labelled: lines('labelled') };
    document.documentElement.toggleAttribute('data-description-tips', true);
    await settle();
    const on = { icon: lines('icon'), labelled: lines('labelled') };
    document.documentElement.removeAttribute('data-description-tips');
    await settle();
    return { off, on, back: lines('icon') };
  });
  expect(r.off).toEqual({ icon: { shown: true, read: ['More actions', '', '', ''] }, labelled: { shown: false, read: ['', '', '', ''] } });
  expect(r.on).toEqual({ icon: { shown: true, read: ['More actions', 'Reset, save and refresh these filters.', '', ''] }, labelled: { shown: false, read: ['', '', '', ''] } });
  expect(r.back).toEqual(r.off.icon);
});

test('a filter chip\'s tip, in lines: its field, what the field is, its answer, then its matches', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    const provider = document.createElement('sherpa-provider') as HTMLElement & { open(d: unknown, o: unknown): Promise<{ query: { ask(r: unknown): void }; load(): Promise<void> }> };
    provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="data"></sherpa-quick-filter-toolbar>';
    root.replaceChildren(provider);
    const bar = provider.querySelector('sherpa-quick-filter-toolbar')!;
    const source = await provider.open({ v: 1, id: 'p', source: { store: 's', fields: { plan: { label: 'Plan', description: 'The plan a customer pays for.' } }, scopes: { data: { label: 'Rows', holds: ['plan'] } } } },
      { stores: { s: new ArrayStore([{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }], { key: 'id' }) }, views: {} });
    source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
    source.query.ask({ commit: true });
    await source.load();
    const settle = async () => { await window.__settled(); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); };
    await settle();
    const read = () => [...bar.shadowRoot!.querySelector('.chips > .chip[data-id="plan"]')!.shadowRoot!.querySelectorAll('.tip .tip-line')].map((l) => l.textContent);
    const off = read();
    document.documentElement.toggleAttribute('data-description-tips', true);
    await settle();
    const on = read();
    document.documentElement.removeAttribute('data-description-tips');
    return { off, on };
  });
  expect(r.off[0]).toMatch(/^Pro\b/);
  expect(r.off.slice(1)).toEqual(['', '', '']);
  expect(r.on.slice(0, 3)).toEqual(['Plan', 'The plan a customer pays for.', 'Pro']);
  expect(r.on[3]).toMatch(/match/);
});
