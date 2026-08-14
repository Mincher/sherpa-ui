import { test, expect } from '@playwright/test';

/** sherpa-chart-legend — rows from populate(); swatch colour by categorical index; click event. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders a row per item with label + value and categorical swatches', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { label: 'Revenue', value: '48k', colorIndex: 1 },
      { label: 'Cost', value: '12k', colorIndex: 5 },
    ]);
    await new Promise((res) => setTimeout(res, 10));
    const rows = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.item'));
    return {
      count: rows.length,
      firstLabel: rows[0]!.querySelector('.label')!.textContent,
      firstValue: rows[0]!.querySelector('.value')!.textContent,
      swatch1: getComputedStyle(rows[0]!.querySelector('.swatch')!).backgroundColor,
      swatch5: getComputedStyle(rows[1]!.querySelector('.swatch')!).backgroundColor,
    };
  });
  expect(r.count).toBe(2);
  expect(r.firstLabel).toBe('Revenue');
  expect(r.firstValue).toBe('48k');
  expect(r.swatch1).toBe('rgb(123, 28, 230)'); // categorical-1 #7b1ce6
  expect(r.swatch5).toBe('rgb(65, 65, 239)'); // categorical-5 #4141ef
});

test('clicking a row fires legend-item-click and toggles active', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'A' }, { label: 'B' }]);
    await new Promise((res) => setTimeout(res, 10));

    let fired: number | null = null;
    el.addEventListener('legend-item-click', (e) => (fired = (e as CustomEvent).detail.index));

    const rowB = el.shadowRoot!.querySelectorAll<HTMLElement>('.item')[1]!;
    rowB.querySelector<HTMLElement>('.row')!.click();
    await new Promise((res) => setTimeout(res, 5));

    return { fired, active: rowB.getAttribute('data-active') };
  });
  expect(r.fired).toBe(1);
  expect(r.active).toBe('false'); // toggled off
});
