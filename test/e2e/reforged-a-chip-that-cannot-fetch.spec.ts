import { test, expect, type Bar } from './harness';

/**
 * A CHIP THAT CANNOT FETCH SAYS SO — TODO 411. A bound source lists the fields
 * whose own read failed in the bar's `data-failed`; each chip wears the critical
 * look, and its tip starts "Unable to fetch data - ". A system error, not 0
 * matches. Will, 2026-10-22.
 */
test('a failed field\'s chip is critical and its tip says it could not fetch; read again, it is not', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate([
      { id: 'region', label: 'Region', select: 'multiple', active: true,
        options: [{ value: 'EU', label: 'EU', selected: true }] },
      { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }] },
    ]);
    await window.__settled();
    const chip = (id: string) => el.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
    const settle = () => new Promise((res) => setTimeout(res, 300));
    const look = async (id: string) => {
      await settle();
      const cs = getComputedStyle(chip(id).shadowRoot!.querySelector('.body')!);
      return {
        failed: chip(id).hasAttribute('data-failed'), edge: cs.borderTopColor,
        tip: chip(id).shadowRoot!.querySelector<HTMLElement>('.count-wrap')!.dataset['text'] ?? '',
      };
    };
    const before = await look('region');
    el.setAttribute('data-failed', 'region');
    await window.__settled();
    const failed = await look('region');
    const other = await look('plan');
    el.removeAttribute('data-failed');
    await window.__settled();
    return { before, failed, other, after: await look('region') };
  });
  expect(r.failed.failed).toBe(true);
  expect(r.failed.edge).not.toBe(r.before.edge);
  expect(r.failed.tip).toMatch(/^Unable to fetch data - EU/);
  expect(r.other.failed).toBe(false);
  expect(r.after).toEqual(r.before);
});
