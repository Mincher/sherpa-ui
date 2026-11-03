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
    const menu = await window.__mount<HTMLElement & { condition: unknown }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-advanced': true, 'data-mode': 'advanced' });
    await window.__settled();
    menu.condition = { or: [{ op: 'contains', value: 'Da' }, { op: 'contains', value: 'Ra' }] };
    const set = menu.condition;
    // ANY attribute the menu observes re-syncs it.
    menu.setAttribute('data-heading', 'Owner');
    await window.__settled();
    return { set, after: menu.condition, op: menu.getAttribute('data-op'), value: menu.getAttribute('data-value') };
  });

  const tree = { or: [{ op: 'contains', value: 'Da' }, { op: 'contains', value: 'Ra' }] };
  expect(r.set).toEqual(tree);
  expect(r.after).toEqual(tree);
  expect(r.op).toBe('contains');
  expect(r.value).toBe('Da');
});
