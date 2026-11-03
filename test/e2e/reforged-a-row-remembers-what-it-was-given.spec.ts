import { test, expect } from './harness';

/**
 * A ROW REMEMBERS WHAT IT WAS GIVEN. A rebuilt condition row's op select has no
 * options for a frame or two, and a select with no options reads `''`. The
 * menu used to read the control, so at the moment it reported `rendered` its
 * row said `{ op: '' }` and every reader (the chip, the bar, the panel)
 * waited a frame or four to ask again. The row keeps its op and join as data.
 * TRAP T-a-row-remembers-what-it-was-given
 */
test('a chip\'s menu reads its typed condition the moment it has rendered', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & { populate(d: unknown): Promise<void>; rendered: Promise<void> };
    bar.style.cssText = 'inline-size: 1200px';
    document.getElementById('root')!.appendChild(bar);
    await bar.rendered;
    let seen: unknown = null;
    const watch = new MutationObserver(() => {
      const chip = bar.shadowRoot!.querySelector('.chips > .chip') as (HTMLElement & { menu?: { rendered: Promise<void>; condition: unknown } }) | null;
      if (!chip?.menu || seen) return;
      seen = 'waiting';
      void Promise.resolve(chip.menu.rendered).then(() => { seen = JSON.stringify(chip.menu!.condition); });
    });
    watch.observe(bar.shadowRoot!, { childList: true, subtree: true });
    await bar.populate([{ id: 'owner', label: 'Owner', select: 'multiple', active: true, advanced: true, op: 'contains', text: 'Da',
      options: [{ value: 'Dana', label: 'Dana' }] }]);
    await window.__settled();
    return seen;
  });
  expect(r).toBe(JSON.stringify({ op: 'contains', value: 'Da' }));
});

test('a second row keeps its join and its op through a rebuild, read at once', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = await window.__mount<HTMLElement & { condition: unknown }>('sherpa-menu', undefined,
      { 'data-type': 'filter', 'data-advanced': true, 'data-mode': 'advanced' });
    await window.__settled();
    const tree = { and: [{ op: 'contains', value: 'Da' }, { op: 'startswith', value: 'R' }] };
    menu.condition = tree;
    return JSON.stringify(menu.condition) === JSON.stringify(tree);
  });
  expect(r).toBe(true);
});
