import { test, expect } from './harness';

/**
 * ROW ONE IS `data-op` / `data-value`.
 *
 * Every sync of a filter menu rebuilds its FIRST condition row from those two
 * attributes — that is how a re-stamp keeps what was typed. So rows set from
 * outside, with the attributes left behind, lasted only until any attribute
 * moved: "contains Da" became an empty "equals". Found saving a filter, which
 * flags the menu. TRAP T-row-one-is-data-op
 */
test('rows set from outside survive the next sync of the menu', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = await window.__mount<HTMLElement & { conditions: unknown[] }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-advanced': true, 'data-mode': 'advanced' });
    await window.__settled();
    menu.conditions = [{ op: 'contains', text: 'Da' }, { join: 'or', op: 'contains', text: 'Ra' }];
    const set = menu.conditions;
    // ANY attribute the menu observes re-syncs it.
    menu.setAttribute('data-heading', 'Owner');
    await window.__settled();
    return { set, after: menu.conditions, op: menu.getAttribute('data-op'), value: menu.getAttribute('data-value') };
  });

  const rows = [{ op: 'contains', text: 'Da' }, { op: 'contains', join: 'or', text: 'Ra' }];
  expect(r.set).toEqual(rows);
  expect(r.after).toEqual(rows);
  expect(r.op).toBe('contains');
  expect(r.value).toBe('Da');
});
