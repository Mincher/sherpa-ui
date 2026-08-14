import { test, expect } from '@playwright/test';

/** sherpa-line-chart — SVG polylines from populate({labels,series}); area variant; multi-series. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('maps a series to an SVG polyline (y inverted, x across the width)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ labels: ['a', 'b', 'c'], series: [[0, 50, 100]] }); // min 0, max 100
    await new Promise((res) => setTimeout(res, 10));
    const line = el.shadowRoot!.querySelector('polyline.line')!;
    return {
      points: line.getAttribute('points'),
      xLabels: Array.from(el.shadowRoot!.querySelectorAll('.x-label')).map((l) => l.textContent),
    };
  });
  // x: 0,50,100 across the width; y inverted: 0→100, 50→50, 100→0.
  expect(r.points).toBe('0,100 50,50 100,0');
  expect(r.xLabels).toEqual(['a', 'b', 'c']);
});

test('renders one series group per series (multi-series)', async ({ page }) => {
  const count = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({
      labels: ['x', 'y'],
      series: [
        { name: 'A', values: [1, 2] },
        { name: 'B', values: [2, 1] },
      ],
    });
    await new Promise((res) => setTimeout(res, 10));
    return el.shadowRoot!.querySelectorAll('.series-layer > .series').length;
  });
  expect(count).toBe(2);
});

test('area variant reveals the fill; line variant hides it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (variant?: string) => {
      const el = document.createElement('sherpa-line-chart') as HTMLElement & {
        rendered?: Promise<void>;
        populate?: (d: unknown) => void;
      };
      if (variant) el.setAttribute('data-variant', variant);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      el.populate!({ labels: ['a', 'b'], series: [[10, 20]] });
      await new Promise((res) => setTimeout(res, 10));
      return getComputedStyle(el.shadowRoot!.querySelector('.area')!).display;
    };
    return { line: await mk(), area: await mk('area') };
  });
  expect(r.line).toBe('none'); // line variant: no area fill
  expect(r.area).not.toBe('none');
});
