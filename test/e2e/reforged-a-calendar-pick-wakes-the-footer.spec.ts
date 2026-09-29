import { test, expect } from './harness';

/**
 * A CALENDAR PICK WAKES THE FOOTER, AND AN OFF BUTTON DOES NOTHING — TODO 83.
 *
 * Will, 2026-09-27: picking a date left Apply and Discard looking inactive,
 * "yet they are still clickable and they work". The footer heard only `input`
 * and `change`; a calendar pick is `datetime-change`. And a disabled
 * sherpa-button only LOOKED off.
 * TRAP T-the-footer-owns-nothing-to-save · TRAP T-a-disabled-button-acts-on-nothing
 */

type Cal = HTMLElement & { rendered?: Promise<void>; shadowRoot: ShadowRoot };

test('a picked day turns the committing footer on', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<HTMLElement & { shadowRoot: ShadowRoot }>('sherpa-quick-filter-toolbar', [
      { id: 'created', label: 'Created', kind: 'date', commit: true, range: false },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = bar.shadowRoot.querySelector('.chip[data-id="created"]') as HTMLElement;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & {
      rendered?: Promise<void>; shadowRoot: ShadowRoot; show(t: HTMLElement): void;
    };
    const cal = menu.querySelector('sherpa-calendar') as Cal;
    await menu.rendered;
    await cal.rendered;
    menu.show(chip);
    await window.__settled();
    const apply = () => menu.shadowRoot.querySelector('.apply')!.hasAttribute('disabled');
    const before = apply();
    const cell = [...cal.shadowRoot.querySelectorAll<HTMLElement & { shadowRoot: ShadowRoot }>('sherpa-calendar-cell')]
      .find((c) => c.dataset['iso'] && !c.hasAttribute('disabled'))!;
    cell.shadowRoot.querySelector('button')!.click();
    await window.__settled();
    return { before, after: apply() };
  });
  expect(r).toEqual({ before: true, after: false });
});

test('a disabled button reaches no listener and no ancestor', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const button = await window.__mount<HTMLElement & { shadowRoot: ShadowRoot }>('sherpa-button', undefined, { disabled: true });
    const heard: string[] = [];
    button.addEventListener('click', () => heard.push('host'));
    button.addEventListener('button-click', () => heard.push('button-click'));
    document.getElementById('root')!.addEventListener('click', () => heard.push('ancestor'));
    button.click();
    button.shadowRoot.querySelector<HTMLElement>('.trigger')!.click();
    await window.__settled();
    const off = [...heard];
    button.removeAttribute('disabled');
    await window.__settled();
    button.click();
    return { off, on: heard.slice(off.length) };
  });
  expect(r.off).toEqual([]);
  expect(r.on).toContain('host');
});
