import { test, expect, type Bar } from './harness';

/**
 * A CHIP CAN CARRY OVER BETWEEN VIEWS — TODO 21b, Will: header chips reset on a
 * View change unless the View sets them, but which carry over is CONFIGURABLE.
 * A View change keeps a carry-over chip's answer; Reset still clears it.
 * TRAP T-a-field-can-carry-over-views
 */
test('a View change keeps a carry-over chip; Reset clears it all the same', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type Values = Record<string, readonly string[]>;
    const bar = await window.__mount<Bar & { clearAll(o?: { carry?: boolean }): void; values: Values }>(
      'sherpa-quick-filter-toolbar', [
        { id: 'customer', label: 'Customer', select: 'multiple', active: true, carryOver: true,
          options: [{ value: 'Contoso', label: 'Contoso', selected: true }] },
        { id: 'region', label: 'Region', select: 'multiple', active: true,
          options: [{ value: 'EMEA', label: 'EMEA', selected: true }] },
      ], { 'data-type': 'view' });
    await window.__settled();
    const on = (id: string) => bar.shadowRoot!.querySelector(`.chip[data-id="${id}"]`)!.hasAttribute('data-current');
    bar.clearAll({ carry: true });
    await window.__settled();
    const viewChange = { customer: on('customer'), region: on('region') };
    bar.clearAll();
    await window.__settled();
    return { viewChange, reset: { customer: on('customer'), region: on('region') } };
  });
  expect(r.viewChange).toEqual({ customer: true, region: false });
  expect(r.reset).toEqual({ customer: false, region: false });
});
