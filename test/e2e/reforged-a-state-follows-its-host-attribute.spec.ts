import { test, expect } from './harness';

/**
 * AN ARIA STATE THAT FOLLOWS A HOST ATTRIBUTE IS IN THE MARKUP — a `data-when-*`
 * on the element, not a script write. TODO 523 P6 · TRAP T-a-template-binds-by-markup
 */
test('an expand button and the Advanced button follow their host, through the markup', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = (el: Element, sel: string, attr: string) => el.shadowRoot!.querySelector(sel)!.getAttribute(attr);
    const item = await window.__mount<HTMLElement>('sherpa-list-item', undefined, { 'data-label': 'Row', 'data-expandable': '' });
    const nav = await window.__mount<HTMLElement>('sherpa-nav-item', undefined, { 'data-label': 'Billing', 'data-has-children': '' });
    const menu = await window.__mount<HTMLElement & { switchMode(m?: string): void }>('sherpa-menu', undefined, { 'data-type': 'filter', 'data-advanced': '' });
    await window.__settled();
    const before = [read(item, '.expand', 'aria-expanded'), read(nav, '.expand', 'aria-expanded'), read(menu, '.use-advanced', 'aria-pressed')];
    item.toggleAttribute('data-expanded', true);
    nav.toggleAttribute('data-expanded', true);
    menu.switchMode('advanced');
    await window.__settled();
    const on = [read(item, '.expand', 'aria-expanded'), read(nav, '.expand', 'aria-expanded'), read(menu, '.use-advanced', 'aria-pressed')];
    item.toggleAttribute('data-expanded', false);
    nav.toggleAttribute('data-expanded', false);
    menu.switchMode('simple');
    await window.__settled();
    const off = [read(item, '.expand', 'aria-expanded'), read(nav, '.expand', 'aria-expanded'), read(menu, '.use-advanced', 'aria-pressed')];
    return { before, on, off, label: read(nav, '.expand', 'aria-label') };
  });
  expect(r.before).toEqual(['false', 'false', 'false']);
  expect(r.on).toEqual(['true', 'true', 'true']);
  expect(r.off).toEqual(['false', 'false', 'false']);
  expect(r.label).toBe('Expand Billing');
});
