import { test, expect } from '@playwright/test';

/** sherpa-quick-filter — a chip that toggles active on click; ai type uses brand purple. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('clicking toggles data-active and fires quick-filter-click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-label', 'Status');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const fired: boolean[] = [];
    el.addEventListener('quick-filter-click', (e) => fired.push((e as CustomEvent).detail.active));

    const chip = el.shadowRoot!.querySelector<HTMLElement>('.chip')!;
    chip.click(); // on
    const afterOn = el.hasAttribute('data-active');
    chip.click(); // off
    const afterOff = el.hasAttribute('data-active');

    return { fired, afterOn, afterOff, label: el.shadowRoot!.querySelector('.label')!.textContent };
  });
  expect(r.label).toBe('Status');
  expect(r.afterOn).toBe(true);
  expect(r.afterOff).toBe(false);
  expect(r.fired).toEqual([true, false]);
});

test('ai type paints the chip with the brand-purple accent', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const paint = async (type?: string) => {
      const el = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void> };
      if (type) el.setAttribute('data-type', type);
      el.setAttribute('data-label', 'X');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el.shadowRoot!.querySelector('.chip')!).color;
    };
    return { def: await paint(), ai: await paint('ai') };
  });
  expect(r.ai).toBe('rgb(192, 70, 255)'); // border-interactive-active #C046FF (brand)
  expect(r.ai).not.toBe(r.def);
});
