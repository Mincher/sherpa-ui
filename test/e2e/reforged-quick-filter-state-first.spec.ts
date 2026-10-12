import { test, expect } from './harness';

/**
 * A chip loses nothing set before its menu could draw it — TODO 113.
 * TRAP T-a-value-before-the-first-render-is-held
 */
type Menu = HTMLElement & { rendered: Promise<void>; values: string[]; items(next: { value: string; label: string }[]): void };
type Chip = HTMLElement & { rendered: Promise<void>; values: string[]; valueLabel: string; menu: Menu | null };
const ITEMS = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }];

test('values set before the menu has rows are its picks, and the face, once they come', async ({ page }) => {
  const r = await page.evaluate(async (items) => {
    const chip = document.createElement('sherpa-quick-filter') as Chip;
    chip.dataset['label'] = 'Region';
    const menu = document.createElement('sherpa-menu') as Menu;
    menu.slot = 'menu';
    chip.append(menu);
    document.getElementById('root')!.replaceChildren(chip);
    await chip.rendered;
    await menu.rendered;
    chip.values = ['b'];
    menu.items(items);
    await window.__settled();
    return { values: chip.values, face: chip.valueLabel };
  }, ITEMS);
  expect(r).toEqual({ values: ['b'], face: 'Beta' });
});

test('values reach a menu the panel has borrowed out of the chip', async ({ page }) => {
  const r = await page.evaluate(async (items) => {
    const chip = document.createElement('sherpa-quick-filter') as Chip;
    const menu = document.createElement('sherpa-menu') as Menu;
    menu.slot = 'menu';
    chip.append(menu);
    const elsewhere = document.createElement('div');
    document.getElementById('root')!.replaceChildren(chip, elsewhere);
    await chip.rendered;
    await menu.rendered;
    menu.items(items);
    // Borrowed: out of its slot and somewhere else. TRAP T-a-borrowed-menu-is-still-its-chips
    void chip.menu;
    menu.removeAttribute('slot');
    elsewhere.append(menu);
    chip.values = ['a'];
    return menu.values;
  }, ITEMS);
  expect(r).toEqual(['a']);
});

test('a value label set before the first render is on the face', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const chip = document.createElement('sherpa-quick-filter') as Chip;
    chip.valueLabel = 'Last 7 days';
    const before = chip.valueLabel;
    document.getElementById('root')!.replaceChildren(chip);
    await chip.rendered;
    return { before, after: chip.shadowRoot!.querySelector('.caret-label')?.textContent };
  });
  expect(r).toEqual({ before: 'Last 7 days', after: 'Last 7 days' });
});
