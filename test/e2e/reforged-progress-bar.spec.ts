import { test, expect } from '@playwright/test';

/**
 * sherpa-progress-bar on the reforged base — native-first: a real <progress>
 * owns value + role=progressbar + aria-valuenow. Proves the value → native
 * <progress>.value bridge + clamping, indeterminate mode (valueless progress
 * drops aria-valuenow), status colouring the fill (via the --_fill custom
 * property; the fill is a vendor pseudo-element, not a measurable node), and
 * populate({value}).
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

test('data-value drives the native progress value + role/aria', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-bar') as ProgressEl;
    el.setAttribute('data-value', '40');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const bar = el.shadowRoot!.querySelector('.bar') as HTMLProgressElement;
    return {
      role: bar.getAttribute('role') ?? (bar.tagName === 'PROGRESS' ? 'progressbar' : null),
      tag: bar.tagName,
      value: bar.value,
      max: bar.max,
    };
  });
  // native <progress> has an implicit role=progressbar + aria-valuenow=value
  expect(r.tag).toBe('PROGRESS');
  expect(r.role).toBe('progressbar');
  expect(r.value).toBe(40);
  expect(r.max).toBe(100);
});

test('the value property clamps to 0–100 and reflects to the native progress', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-bar') as ProgressEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const bar = el.shadowRoot!.querySelector('.bar') as HTMLProgressElement;

    el.value = 150; // over-max
    const over = { value: el.value, barValue: bar.value };
    el.value = -20; // under-min
    const under = { value: el.value, barValue: bar.value };
    return { over, under };
  });
  expect(r.over).toEqual({ value: 100, barValue: 100 });
  expect(r.under).toEqual({ value: 0, barValue: 0 });
});

test('indeterminate mode drops the value (native indeterminate progress)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-bar') as ProgressEl;
    el.setAttribute('data-value', '30');
    el.setAttribute('data-indeterminate', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const bar = el.shadowRoot!.querySelector('.bar') as HTMLProgressElement;
    // a native <progress> with no value attribute is indeterminate (position === -1)
    return { hasValueAttr: bar.hasAttribute('value'), position: bar.position };
  });
  expect(r.hasValueAttr).toBe(false);
  expect(r.position).toBe(-1); // indeterminate
});

test('data-status colours the fill (via the --_fill custom property)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (status?: string) => {
      const el = document.createElement('sherpa-progress-bar') as ProgressEl;
      el.setAttribute('data-value', '50');
      if (status) el.setAttribute('data-status', status);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      // The fill is ::-webkit-progress-value (not a queryable node); assert the
      // token it consumes instead — --_fill routes through the status cascade.
      const bar = el.shadowRoot!.querySelector('.bar') as HTMLElement;
      return getComputedStyle(bar).getPropertyValue('--_fill').trim();
    };
    return { base: await read(), success: await read('success') };
  });
  // success → the strong success status surface #82edb1 (success-color-2)
  expect(r.success.toLowerCase()).toContain('82edb1');
  expect(r.base).not.toBe(r.success);
});

test('populate({ value }) sets the percentage', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-bar') as ProgressEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ value: 75 });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const bar = el.shadowRoot!.querySelector('.bar') as HTMLProgressElement;
    return { value: el.value, barValue: bar.value };
  });
  expect(r.value).toBe(75);
  expect(r.barValue).toBe(75);
});
