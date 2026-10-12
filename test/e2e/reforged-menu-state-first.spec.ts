import { test, expect } from './harness';

/**
 * A menu loses nothing set before it could draw it — TODO 113, "state first".
 * TRAP T-a-value-before-the-first-render-is-held
 */
type Menu = HTMLElement & {
  rendered: Promise<void>;
  values: string[];
  conditions: { op: string; text?: string }[];
  items(next: { value: string; label?: string; drill?: boolean; count?: number }[]): void;
  setCount(value: string, count: number): void;
};
const ITEMS = [{ value: 'a' }, { value: 'b' }, { value: 'c' }];

test('values set before the items arrive are ticked when they do, and read back before', async ({ page }) => {
  const r = await page.evaluate(async (items) => {
    const menu = document.createElement('sherpa-menu') as Menu;
    document.getElementById('root')!.replaceChildren(menu);
    await menu.rendered;
    menu.values = ['b'];
    const before = menu.values;
    menu.items(items);
    const ticked = [...menu.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value);
    return { before, after: menu.values, ticked };
  }, ITEMS);
  expect(r).toEqual({ before: ['b'], after: ['b'], ticked: ['b'] });
});

test('values and items set before the first render are drawn by it', async ({ page }) => {
  const r = await page.evaluate(async (items) => {
    const menu = document.createElement('sherpa-menu') as Menu;
    menu.values = ['c'];
    menu.items(items);
    const before = menu.values;
    document.getElementById('root')!.replaceChildren(menu);
    await menu.rendered;
    return { before, after: menu.values };
  }, ITEMS);
  expect(r).toEqual({ before: ['c'], after: ['c'] });
});

test('conditions set before the first render are its rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = document.createElement('sherpa-menu') as Menu;
    menu.dataset['type'] = 'filter';
    menu.setAttribute('data-advanced-only', '');
    menu.conditions = [{ op: 'contains', text: 'acme' }];
    const before = menu.conditions;
    document.getElementById('root')!.replaceChildren(menu);
    await menu.rendered;
    await window.__settled();
    return { before, after: menu.conditions.map(({ op, text }) => ({ op, text })) };
  });
  expect(r.before).toEqual([{ op: 'contains', text: 'acme' }]);
  expect(r.after).toEqual([{ op: 'contains', text: 'acme' }]);
});

test('a count set before the rows stamp is on the row once they do', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = document.createElement('sherpa-menu') as Menu;
    menu.items([{ value: 'region', label: 'Region', drill: true, count: 0 }]);
    menu.setCount('region', 3);
    document.getElementById('root')!.replaceChildren(menu);
    await menu.rendered;
    return menu.querySelector('.menu-row[data-drill] .menu-row-count')?.textContent;
  });
  expect(r).toBe('3');
});
