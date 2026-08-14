import { test, expect } from '@playwright/test';

/**
 * sherpa-progress-bar on the reforged base — a determinate/indeterminate progress
 * indicator. Proves the data-value → fill-width bridge (via the --_pct custom
 * property, NOT JS styling), the value property API + clamping, indeterminate
 * mode dropping aria-valuenow, status colouring the fill, and populate({value}).
 */

const HARNESS = '/test/reforged/harness.html';

type ProgressEl = HTMLElement & {
  rendered?: Promise<void>;
  value?: number;
  populate?: (d: unknown) => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-progress-bar'));
});

test('data-value drives the fill width and role/aria', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-bar') as ProgressEl;
    el.setAttribute('data-value', '40');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const track = el.shadowRoot!.querySelector('.track') as HTMLElement;
    const fill = el.shadowRoot!.querySelector('.fill') as HTMLElement;
    const ratio = fill.getBoundingClientRect().width / track.getBoundingClientRect().width;

    return {
      role: el.getAttribute('role'),
      now: el.getAttribute('aria-valuenow'),
      pctVar: el.style.getPropertyValue('--_pct').trim(),
      ratio,
    };
  });
  expect(r.role).toBe('progressbar');
  expect(r.now).toBe('40');
  expect(r.pctVar).toBe('40%'); // the JS→CSS-var bridge
  expect(r.ratio).toBeGreaterThan(0.35);
  expect(r.ratio).toBeLessThan(0.45);
});

test('the value property clamps to 0–100 and reflects to the width', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-bar') as ProgressEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.value = 150; // over-max
    const over = { value: el.value, pct: el.style.getPropertyValue('--_pct').trim() };
    el.value = -20; // under-min
    const under = { value: el.value, pct: el.style.getPropertyValue('--_pct').trim() };
    return { over, under };
  });
  expect(r.over).toEqual({ value: 100, pct: '100%' });
  expect(r.under).toEqual({ value: 0, pct: '0%' });
});

test('indeterminate mode drops aria-valuenow', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-bar') as ProgressEl;
    el.setAttribute('data-value', '30');
    el.setAttribute('data-indeterminate', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { now: el.getAttribute('aria-valuenow') };
  });
  expect(r.now).toBeNull();
});

test('data-status colours the fill', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const paint = async (status?: string) => {
      const el = document.createElement('sherpa-progress-bar') as ProgressEl;
      el.setAttribute('data-value', '50');
      if (status) el.setAttribute('data-status', status);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el.shadowRoot!.querySelector('.fill')!).backgroundColor;
    };
    return { base: await paint(), success: await paint('success') };
  });
  expect(r.success).toBe('rgb(5, 129, 66)'); // status-success-color-4 #058142
  expect(r.base).not.toBe(r.success);
});

test('populate({ value }) sets the percentage', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-bar') as ProgressEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ value: 75 });
    await new Promise((res) => setTimeout(res, 10));
    return { value: el.value, pct: el.style.getPropertyValue('--_pct').trim() };
  });
  expect(r.value).toBe(75);
  expect(r.pct).toBe('75%');
});
