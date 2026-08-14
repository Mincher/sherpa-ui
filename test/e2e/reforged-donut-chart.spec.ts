import { test, expect } from '@playwright/test';

/** sherpa-donut-chart — composes a conic-gradient ring from slice shares; centre label; pie variant. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('builds a conic-gradient ring with a band per slice share', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-donut-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    el.setAttribute('data-label', '120');
    el.setAttribute('data-sublabel', 'total');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { label: 'A', value: 60 }, // 50%
      { label: 'B', value: 30 }, // 25%
      { label: 'C', value: 30 }, // 25%
    ]);
    await new Promise((res) => setTimeout(res, 10));
    const ring = getComputedStyle(el).getPropertyValue('--_ring');
    return {
      ring,
      value: el.shadowRoot!.querySelector('.value')!.textContent,
      sub: el.shadowRoot!.querySelector('.sub')!.textContent,
    };
  });
  // three bands; the first spans 0–50%.
  expect(r.ring).toContain('conic-gradient');
  expect(r.ring).toContain('0% 50%');
  expect(r.ring).toContain('50% 75%');
  expect(r.ring).toContain('75% 100%');
  expect(r.value).toBe('120');
  expect(r.sub).toBe('total');
});

test('pie variant removes the centre hole (mask none)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-donut-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    el.setAttribute('data-variant', 'pie');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'X', value: 1 }]);
    await new Promise((res) => setTimeout(res, 10));
    const ring = el.shadowRoot!.querySelector('.ring')!;
    return getComputedStyle(ring).maskImage;
  });
  expect(r).toBe('none'); // pie: no donut hole
});
