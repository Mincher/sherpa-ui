import { test, expect } from '@playwright/test';

/** sherpa-gauge-chart — data-value drives the fill sweep (--_fill-pct) + needle angle. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('data-value sets the fill fraction and needle angle', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (value: string) => {
      const el = document.createElement('sherpa-gauge-chart') as HTMLElement & { rendered?: Promise<void> };
      el.setAttribute('data-value', value);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      const cs = getComputedStyle(el);
      return {
        pct: cs.getPropertyValue('--_fill-pct').trim(),
        angle: cs.getPropertyValue('--_angle').trim(),
        value: el.shadowRoot!.querySelector('.value')!.textContent,
      };
    };
    return { zero: await read('0'), half: await read('50'), full: await read('100') };
  });
  // 0 → 0% / -90deg; 50 → 25% (of circle) / 0deg; 100 → 50% / 90deg
  expect(r.zero.pct).toBe('0%');
  expect(r.zero.angle).toBe('-90deg');
  expect(r.half.pct).toBe('25%');
  expect(r.half.angle).toBe('0deg');
  expect(r.full.pct).toBe('50%');
  expect(r.full.angle).toBe('90deg');
  expect(r.full.value).toBe('100');
});

test('data-status re-points the fill colour and a custom min/max scales', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-gauge-chart') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-value', '10');
    el.setAttribute('data-min', '0');
    el.setAttribute('data-max', '20'); // 10/20 = 50%
    el.setAttribute('data-status', 'critical');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const cs = getComputedStyle(el);
    return {
      pct: cs.getPropertyValue('--_fill-pct').trim(),
      fill: cs.getPropertyValue('--_fill').trim(),
      max: el.shadowRoot!.querySelector('.max')!.textContent,
    };
  });
  expect(r.pct).toBe('25%'); // 50% of the half
  expect(r.fill).toBe('#c8324f'); // critical
  expect(r.max).toBe('20');
});
