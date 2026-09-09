import { test, expect } from '@playwright/test';

/**
 * sherpa-metric on the reforged base — a KPI tile. Proves the label/value/delta
 * text render (from populate() and from data-* attributes), the trend colouring
 * of the delta (success for up, critical for down) driven purely by data-trend,
 * and the embedded sparkline being fed + revealed only when values are supplied.
 */

const HARNESS = '/test/reforged/harness.html';

type MetricEl = HTMLElement & {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() =>
    Promise.all([
      customElements.whenDefined('sherpa-metric'),
      customElements.whenDefined('sherpa-sparkline'),
    ]),
  );
});

test('populate() renders label, value, delta and derives an up trend', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.populate!({ name: 'Revenue', value: '$1.2M', deltaPercent: 12.5 });
    await new Promise((res) => setTimeout(res, 10));

    const text = (sel: string) => el.shadowRoot!.querySelector(sel)!.textContent;
    return {
      label: text('.label'),
      value: text('.value'),
      delta: text('.delta'),
      trend: el.getAttribute('data-trend'),
      deltaColor: getComputedStyle(el.shadowRoot!.querySelector('.trend')!).color,
    };
  });
  expect(r.label).toBe('Revenue');
  expect(r.value).toBe('$1.2M');
  expect(r.delta).toBe('+12.5%'); // derived from deltaPercent
  expect(r.trend).toBe('up');
  expect(r.deltaColor).toBe('rgb(0, 122, 69)'); // theme-content-success-1 #007A45 (readable up-trend ink)
});

test('a down trend colours the delta critical', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ name: 'Churn', value: '3.1%', deltaPercent: -4 });
    await new Promise((res) => setTimeout(res, 10));
    return {
      trend: el.getAttribute('data-trend'),
      delta: el.shadowRoot!.querySelector('.delta')!.textContent,
      color: getComputedStyle(el.shadowRoot!.querySelector('.trend')!).color,
      upArrow: getComputedStyle(el.shadowRoot!.querySelector('.arrow-up')!).display,
      downArrow: getComputedStyle(el.shadowRoot!.querySelector('.arrow-down')!).display,
    };
  });
  expect(r.trend).toBe('down');
  expect(r.delta).toBe('-4%');
  expect(r.color).toBe('rgb(183, 34, 0)'); // theme-content-critical-1 #B72200 (readable down-trend ink)
  expect(r.upArrow).toBe('none');
  expect(r.downArrow).not.toBe('none'); // down arrow revealed
});

test('attribute-only usage renders text without populate()', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    el.setAttribute('data-label', 'Users');
    el.setAttribute('data-value', '48,201');
    el.setAttribute('data-delta', '+2.0%');
    el.setAttribute('data-trend', 'up');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const text = (sel: string) => el.shadowRoot!.querySelector(sel)!.textContent;
    return { label: text('.label'), value: text('.value'), delta: text('.delta') };
  });
  expect(r.label).toBe('Users');
  expect(r.value).toBe('48,201');
  expect(r.delta).toBe('+2.0%');
});

test('values feed and reveal the embedded sparkline', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.populate!({ name: 'Sessions', value: '9,340', deltaPercent: 6, values: [4, 6, 5, 9] });

    // The embedded sparkline bootstraps asynchronously; wait for its first render
    // (and a tick for the deferred populate) before reading its geometry bridge.
    const spark = el.shadowRoot!.querySelector('sherpa-sparkline') as HTMLElement & {
      rendered?: Promise<void>;
    };
    await spark.rendered;
    await new Promise((res) => setTimeout(res, 10));

    return {
      hasValuesAttr: el.hasAttribute('data-has-values'),
      sparkVisible: getComputedStyle(el.shadowRoot!.querySelector('.spark')!).display !== 'none',
      // the sparkline received the series → its geometry bridge is populated
      sparkV0: spark.style.getPropertyValue('--_v0').trim(),
      sparkV3: spark.style.getPropertyValue('--_v3').trim(),
    };
  });
  expect(r.hasValuesAttr).toBe(true);
  expect(r.sparkVisible).toBe(true);
  expect(r.sparkV0).toBe('4');
  expect(r.sparkV3).toBe('9');
});

test('no values → the sparkline region stays hidden', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ name: 'Flat', value: '7' });
    await new Promise((res) => setTimeout(res, 10));
    return {
      hasValuesAttr: el.hasAttribute('data-has-values'),
      sparkHidden: getComputedStyle(el.shadowRoot!.querySelector('.spark')!).display === 'none',
    };
  });
  expect(r.hasValuesAttr).toBe(false);
  expect(r.sparkHidden).toBe(true);
});
