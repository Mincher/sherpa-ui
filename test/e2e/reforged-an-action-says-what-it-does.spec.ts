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
