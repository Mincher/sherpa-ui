import { test, expect } from './harness';

/**
 * A MENU WHOSE VALUES ARE ON THEIR WAY SAYS SO — TODO 345 phase 5. A remote
 * store the source does not hold reads a field's values when it is needed;
 * until then its filter says `loading`, and its chip's menu shows a Loading
 * row. Drawn again with its values, the row goes.
 * TRAP T-a-field-reads-its-values-when-needed
 */
test('a loading filter\'s menu shows Loading, and its values replace it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type Bar = HTMLElement & { drawScope(d: unknown): Promise<void> };
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'plan', label: 'Plan', select: 'multiple', loading: true },
    ], { style: 'inline-size: 900px' });
    await window.__settled();
    const menu = () => bar.shadowRoot!.querySelector('.chip[data-id="plan"] sherpa-menu') as HTMLElement & { shadowRoot: ShadowRoot };
    const shows = () => getComputedStyle(menu().shadowRoot.querySelector('.loading')!).display !== 'none';
    const before = { loading: menu().hasAttribute('data-loading'), shows: shows() };
    // As the source draws it once its values have come.
    await bar.drawScope({
      scope: 'data', label: 'Data', available: [],
      filters: [{ id: 'plan', label: 'Plan', select: 'multiple', options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }] }],
    });
    await window.__settled();
    return {
      before, after: { loading: menu().hasAttribute('data-loading'), shows: shows(), rows: menu().querySelectorAll('input').length },
    };
  });
  expect(r.before).toEqual({ loading: true, shows: true });
  expect(r.after.loading).toBe(false);
  expect(r.after.shows).toBe(false);
  expect(r.after.rows).toBeGreaterThanOrEqual(2);
});
