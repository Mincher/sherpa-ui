import { test, expect } from './harness';

/**
 * sherpa-quick-filter data-type="jump" — a JUMP TO chip. Its menu lists places
 * on the page; a pick scrolls the element whose id is the value into view and
 * fires `jump-select`. It is never a filter, so it is never on.
 */

type Chip = HTMLElement & {
  rendered?: Promise<void>;
  populate(d: unknown): Promise<void>;
  values: string[];
};

test('a pick scrolls its section into view, clear of the edge, and reports it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const scroller = document.createElement('div');
    scroller.style.cssText = 'block-size: 200px; overflow: auto';
    for (const id of ['one', 'two', 'three']) {
      const header = document.createElement('sherpa-section-header');
      header.id = `section-${id}`;
      header.dataset['heading'] = id;
      const spacer = document.createElement('div');
      spacer.style.blockSize = '400px';
      scroller.append(header, spacer);
    }
    const chip = document.createElement('sherpa-quick-filter') as Chip;
    chip.dataset['type'] = 'jump';
    chip.dataset['label'] = 'Jump to';
    chip.toggleAttribute('data-menu', true);
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
    menu.slot = 'menu';
    chip.append(menu);
    document.getElementById('root')!.append(chip, scroller);
    await chip.rendered;
    await menu.rendered;

    await chip.populate(['one', 'two', 'three'].map((id) => ({ value: `section-${id}`, label: id })));
    const rows = [...menu.querySelectorAll('button')].map((b) => `${b.value}:${b.textContent}`);

    const fired: unknown[] = [];
    chip.addEventListener('jump-select', (e) => fired.push((e as CustomEvent).detail));
    menu.querySelector<HTMLButtonElement>('button[value="section-three"]')!.click();

    const target = document.getElementById('section-three')!;
    return {
      rows,
      fired,
      gap: Math.round(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top),
      margin: getComputedStyle(target).scrollMarginBlockStart,
      current: chip.hasAttribute('data-current'),
      values: chip.values,
    };
  });
  expect(r.rows).toEqual(['section-one:one', 'section-two:two', 'section-three:three']);
  expect(r.fired).toEqual([{ value: 'section-three', label: 'three' }]);
  // The header lands its scroll margin below the top, not flush against it.
  expect(r.margin).toBe('16px');
  expect(r.gap).toBe(16);
  expect(r.current).toBe(false);
  expect(r.values).toEqual([]);
});

test('the body opens the menu, and a re-populate replaces the rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const chip = document.createElement('sherpa-quick-filter') as Chip;
    chip.id = 'jump';
    chip.dataset['type'] = 'jump';
    chip.toggleAttribute('data-menu', true);
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
    menu.slot = 'menu';
    chip.append(menu);
    document.getElementById('root')!.append(chip);
    await chip.rendered;
    await menu.rendered;

    await chip.populate([{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]);
    await chip.populate([{ value: 'c', label: 'C' }]);
    const rows = [...menu.querySelectorAll('button')].map((b) => b.value);

    chip.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    return { rows, current: chip.hasAttribute('data-current') };
  });
  expect(r.rows).toEqual(['c']);
  // The menu reports itself open, and the chip follows that report.
  await expect.poll(() => page.evaluate(() =>
    document.getElementById('jump')!.hasAttribute('data-open'))).toBe(true);
  expect(r.current).toBe(false);
});
