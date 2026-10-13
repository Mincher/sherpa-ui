import { test, expect } from './harness';

/**
 * A READ-ONLY ROW REMOVES NOTHING: no row ×, and no clear button in its value —
 * a saved filter's card and a grid's held heading show rows a reader cannot
 * change, and their text is the secondary ink. Editable again, all come back. Will, TODO 236.
 * TRAP T-a-view-held-heading-shows-and-refuses
 */
test('read-only condition rows show no ×, and their values no clear button', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = await window.__mount<HTMLElement & { conditions: unknown[] }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-advanced': true, 'data-mode': 'advanced', 'data-readonly': true });
    await window.__settled();
    menu.conditions = [{ op: 'gt', text: '10' }, { join: 'and', op: 'lt', text: '60' }];
    await window.__settled();
    const read = () => [...menu.shadowRoot!.querySelectorAll<HTMLElement>('.condition-row')].map((row) => {
      const value = row.querySelector<HTMLElement>('.condition-value')!;
      const ink = (el: HTMLElement) => getComputedStyle(el.shadowRoot!.querySelector('.control')!).color;
      return {
        drop: getComputedStyle(row.querySelector('.drop-condition')!).display,
        readonly: value.hasAttribute('readonly'),
        clear: getComputedStyle(value.shadowRoot!.querySelector('.clear')!).display,
        ink: [ink(row.querySelector<HTMLElement>('.condition')!), ink(value)],
      };
    });
    const shown = read();
    menu.removeAttribute('data-readonly');
    await window.__settled();
    return { shown, editable: read() };
  });
  const secondary = ['rgb(53, 53, 61)', 'rgb(53, 53, 61)'];
  expect(r.shown).toEqual([
    { drop: 'none', readonly: true, clear: 'none', ink: secondary },
    { drop: 'none', readonly: true, clear: 'none', ink: secondary },
  ]);
  for (const row of r.editable) {
    expect(row.ink).not.toEqual(secondary);
    expect(row.drop).not.toBe('none');
    expect(row.readonly).toBe(false);
    expect(row.clear).not.toBe('none');
  }
});
