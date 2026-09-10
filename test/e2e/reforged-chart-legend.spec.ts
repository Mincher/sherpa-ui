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
      // Figma Legend Item swatch: the series hue as a SOLID 1px ring, with a 60%
      // tint of the same hue as the fill.
      ring1: getComputedStyle(rows[0]!.querySelector('.swatch')!).borderTopColor,
      ring5: getComputedStyle(rows[1]!.querySelector('.swatch')!).borderTopColor,
      fill1: getComputedStyle(rows[0]!.querySelector('.swatch')!).backgroundColor,
    };
  });
  expect(r.count).toBe(2);
  expect(r.firstLabel).toBe('Revenue');
  expect(r.firstValue).toBe('48k');
  expect(r.ring1).toBe('rgb(123, 28, 230)'); // categorical-1 #7b1ce6
  expect(r.ring5).toBe('rgb(65, 65, 239)'); // categorical-5 #4141ef
  expect(r.fill1).toContain('0.6'); // the 60% tint (color-mix → color(srgb … / 0.6))
});

test('clicking a row fires legend-item-click and toggles current', async ({ page }) => {
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

    return { fired, active: rowB.getAttribute('data-current') };
  });
  expect(r.fired).toBe(1);
  expect(r.active).toBe('false'); // toggled off
});
