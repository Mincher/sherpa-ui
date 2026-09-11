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
  expect(r.deltaColor).toBe('rgb(0, 173, 98)'); // theme-content-success-1 #00AD62 (readable up-trend ink)
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

test('status is derived from the trend, and the card stays white with no border', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const build = async (data: unknown): Promise<Record<string, unknown>> => {
      const el = document.createElement('sherpa-metric') as HTMLElement & {
        rendered?: Promise<void>; populate(d: unknown): void;
      };
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      el.populate(data);
      await new Promise((res) => setTimeout(res, 20));
      const row = el.shadowRoot!.querySelector('.row')!;
      const rs = getComputedStyle(row);
      return {
        trend: el.getAttribute('data-trend'),
        status: el.getAttribute('data-status'),
        bg: rs.backgroundColor,
        borderWidth: rs.borderTopWidth,
        deltaColour: getComputedStyle(el.shadowRoot!.querySelector('.delta')!).color,
      };
    };
    return {
      up: await build({ name: 'A', value: '1', deltaPercent: 3.1, values: [1, 2, 3] }),
      down: await build({ name: 'B', value: '2', deltaPercent: -12.5, values: [3, 2, 1] }),
      flat: await build({ name: 'C', value: '3', deltaPercent: 0, values: [2, 2, 2] }),
      none: await build({ name: 'D', value: '4', values: [1, 2, 3] }),
    };
  });

  // Will's rule: status IS the trend. Success if positive, critical if negative,
  // and NO status for a flat trend or a raw data point with no trend at all —
  // "default" means the attribute is absent, since the --_status-* cascade only
  // emits for a named status.
  expect(r.up['trend']).toBe('up');
  expect(r.up['status']).toBe('success');
  expect(r.down['trend']).toBe('down');
  expect(r.down['status']).toBe('critical');
  expect(r.flat['trend']).toBe('flat');
  expect(r.flat['status']).toBeNull();
  expect(r.none['status']).toBeNull();

  // The card binds Style::style-surface/base, which is WHITE in every status mode
  // — the status shows in the INK and the sparkline stroke, not the surface. And
  // Figma's card is STROKE NONE, so there is no border on any of them.
  for (const [name, got] of Object.entries(r)) {
    expect(got['bg'], `${name} background`).toBe('rgb(255, 255, 255)');
    expect(got['borderWidth'], `${name} border`).toBe('0px');
  }

  // …but the delta ink DOES follow the status.
  expect(r.up['deltaColour']).not.toBe(r.down['deltaColour']);
});

test('a [data-status] ancestor does NOT recolour the label or the value', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (status: string | null) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const box = document.createElement('div');
      if (status) box.setAttribute('data-status', status);
      const el = document.createElement('sherpa-metric') as HTMLElement & {
        rendered?: Promise<void>;
        populate(d: unknown): void;
      };
      box.appendChild(el);
      root.appendChild(box);
      await el.rendered;
      el.populate({ label: 'Active endpoints', value: '1,284', deltaPercent: 3.1 });
      await new Promise((res) => setTimeout(res, 30));
      const sr = el.shadowRoot!;
      return {
        label: getComputedStyle(sr.querySelector('.label')!).color,
        value: getComputedStyle(sr.querySelector('.value')!).color,
      };
    };
    return { none: await read(null), success: await read('success'), critical: await read('critical') };
  });

  // Read from the Figma node (Metric 61:263): the label binds content/body/+1 and
  // the value binds content/body/BASE — plain Theme tokens with no status in them.
  // Only the DELTA binds style-content/base, which follows the status cascade.
  //
  // Reading --_status-text first turned the whole reading green or red, which said
  // "this number is a success" when the status belongs to the CHANGE: 1,284
  // endpoints is neither good nor bad, and +3.1% is the part carrying a verdict.
  expect(r.none.value).toBe('rgb(12, 11, 17)');
  expect(r.none.label).toBe('rgb(53, 53, 61)');
  expect(r.success).toEqual(r.none);
  expect(r.critical).toEqual(r.none);
});
