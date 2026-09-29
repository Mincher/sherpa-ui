import { test, expect } from './harness';

/**
 * A CLICK IN A MENU'S GAP IS THE MENU'S — TODO 106. The card is drawn in the
 * top layer, but in the DOM it sits inside its host: a click on empty space
 * bubbled to an accordion's <summary> and toggled it. A row still does its job.
 * TRAP T-a-gap-click-is-the-menus-own
 */
test('a click between rows toggles no accordion and reaches no host; a row still ticks', async ({ page }) => {
  const box = await page.evaluate(async () => {
    const acc = document.createElement('sherpa-accordion') as HTMLElement & { open: boolean; rendered: Promise<void> };
    acc.setAttribute('data-heading', 'Data');
    acc.innerHTML = `<span slot="actions" class="host">
      <sherpa-menu data-heading="Plan">
        <label><input type="checkbox" value="Pro"> Pro</label>
        <label><input type="checkbox" value="Free"> Free</label>
      </sherpa-menu></span><p>Body</p>`;
    document.getElementById('root')!.appendChild(acc);
    await acc.rendered;
    await window.__settled();
    const heard: string[] = [];
    acc.querySelector('.host')!.addEventListener('click', () => heard.push('host'));
    (window as unknown as { __heard: string[] }).__heard = heard;
    const menu = acc.querySelector('sherpa-menu') as HTMLElement & { show(): void };
    menu.show();
    await window.__settled();
    const card = menu.shadowRoot!.querySelector<HTMLElement>('[popover]')!.getBoundingClientRect();
    const rows = [...menu.querySelectorAll('label')].map((l) => l.getBoundingClientRect());
    return {
      card: { x: card.x, y: card.y, w: card.width, h: card.height },
      gap: { x: rows[0]!.x + rows[0]!.width / 2, y: (rows[0]!.bottom + rows[1]!.top) / 2 },
      pad: { x: card.x + card.width / 2, y: card.bottom - 2 },
      row: { x: rows[1]!.x + rows[1]!.width / 2, y: rows[1]!.y + rows[1]!.height / 2 },
    };
  });
  const state = () => page.evaluate(() => {
    const acc = document.querySelector('sherpa-accordion') as HTMLElement & { open: boolean };
    const menu = acc.querySelector('sherpa-menu') as HTMLElement & { open: boolean; values: string[] };
    return { accordion: acc.open, menu: menu.open, values: menu.values, heard: (window as unknown as { __heard: string[] }).__heard.length };
  });

  const before = await state();
  await page.mouse.click(box.pad.x, box.pad.y);
  const afterPad = await state();
  await page.mouse.click(box.gap.x, box.gap.y);
  const afterGap = await state();
  await page.mouse.click(box.row.x, box.row.y);
  const afterRow = await state();

  expect(before).toMatchObject({ accordion: false, menu: true, heard: 0 });
  expect(afterPad).toEqual(before);
  expect(afterGap).toEqual(before);
  // A row still ticks, and the accordion still stays shut.
  expect(afterRow).toMatchObject({ accordion: false, menu: true, values: ['Free'] });
});
