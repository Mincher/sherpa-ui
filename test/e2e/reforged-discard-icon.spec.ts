import { test, expect } from './harness';

/** Every Discard leads with a trash can: a menu's footer, a bar's and a field's own. Will, TODO 417 */
test('every Discard wears the trash can', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<HTMLElement>('sherpa-quick-filter-toolbar', [
      { id: 'region', label: 'Region', options: [{ value: 'EMEA', label: 'EMEA' }] },
    ]);
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
    menu.setAttribute('data-type', 'filter');
    document.getElementById('root')!.append(menu);
    await menu.rendered;
    await window.__settled();
    return {
      bar: [...bar.shadowRoot!.querySelectorAll<HTMLElement>('.discard-all')].map((b) => b.dataset['iconStart']),
      menu: menu.shadowRoot!.querySelector<HTMLElement>('.discard')?.dataset['iconStart'] ?? null,
    };
  });
  expect(r.bar.length).toBeGreaterThan(0);
  expect(new Set(r.bar)).toEqual(new Set(['trash']));
  expect(r.menu).toBe('trash');
});
