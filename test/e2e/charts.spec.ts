import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

const settle = () => new Promise((r) => setTimeout(r, 150));

/* ── sherpa-barchart ───────────────────────────────────────────── */
// setData shape: { columns: [{field,name,type}], rows: [{field:value}] }.
// Category field resolves from a string-typed column; measure from a numeric column.

test('sherpa-barchart setData({columns,rows}) renders a bar row + segment per category', async ({ page }) => {
  await mount(page, `<sherpa-barchart data-title="Revenue"></sherpa-barchart>`, 'sherpa-barchart');
  await page.evaluate(async () => {
    const el = document.querySelector('sherpa-barchart') as HTMLElement & { rendered: Promise<void>; setData: (d: unknown) => Promise<void> };
    await el.rendered;
    await el.setData({
      columns: [
        { field: 'region', name: 'Region', type: 'string' },
        { field: 'revenue', name: 'Revenue', type: 'number' },
      ],
      rows: [
        { region: 'North', revenue: 40 },
        { region: 'South', revenue: 25 },
        { region: 'East', revenue: 15 },
      ],
    });
  });
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-barchart')!;
    const sr = el.shadowRoot!;
    return {
      rows: sr.querySelectorAll('.chart-rows .chart-row').length,
      segments: sr.querySelectorAll('.chart-segment').length,
      barCount: (el as HTMLElement).dataset['barCount'],
      empty: (el as HTMLElement).hasAttribute('data-empty'),
    };
  });
  expect(r.rows).toBe(3);
  expect(r.segments).toBe(3); // one segment per (non-stacked) bar
  expect(r.barCount).toBe('3');
  expect(r.empty).toBe(false);
});

/* ── sherpa-line-chart ─────────────────────────────────────────── */
// setData accepts a direct { labels, series:[{name,values}] } object.

test('sherpa-line-chart setData({labels,series}) renders shapes + x-axis labels', async ({ page }) => {
  await mount(page, `<sherpa-line-chart data-title="Trend"></sherpa-line-chart>`, 'sherpa-line-chart');
  await page.evaluate(async () => {
    const el = document.querySelector('sherpa-line-chart') as HTMLElement & { rendered: Promise<void>; setData: (d: unknown) => Promise<void> };
    await el.rendered;
    await el.setData({
      labels: ['Mon', 'Tue', 'Wed', 'Thu'],
      series: [{ name: 'Visits', values: [10, 30, 20, 45] }],
    });
  });
  await settle();
  const r = await page.evaluate(() => {
    const sr = document.querySelector('sherpa-line-chart')!.shadowRoot!;
    return {
      series: sr.querySelectorAll('.series-layer .series').length,
      shapes: sr.querySelectorAll('.series-layer .shape').length,
      xLabels: sr.querySelectorAll('.x-axis .x-label').length,
      legend: sr.querySelectorAll('.chart-legend .legend-item').length,
    };
  });
  expect(r.series).toBe(1);
  expect(r.shapes).toBe(3); // 4 points → 3 segments
  expect(r.xLabels).toBe(4);
  expect(r.legend).toBe(1);
});

/* ── sherpa-donut-chart ────────────────────────────────────────── */
// setData accepts a direct array [{label,value,color?}].

test('sherpa-donut-chart setData([...]) renders legend rows + conic ring', async ({ page }) => {
  await mount(page, `<sherpa-donut-chart data-variant="donut" data-title="Split"></sherpa-donut-chart>`, 'sherpa-donut-chart');
  await page.evaluate(async () => {
    const el = document.querySelector('sherpa-donut-chart') as HTMLElement & { rendered: Promise<void>; setData: (d: unknown) => Promise<void> };
    await el.rendered;
    await el.setData([
      { label: 'A', value: 50 },
      { label: 'B', value: 30 },
      { label: 'C', value: 20 },
    ]);
  });
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-donut-chart')!;
    const sr = el.shadowRoot!;
    const ring = sr.querySelector('.donut-ring') as HTMLElement;
    return {
      legend: sr.querySelectorAll('.chart-legend .legend-item').length,
      conic: ring.style.getPropertyValue('--_conic'),
      variant: (el as HTMLElement).dataset['variant'],
    };
  });
  expect(r.legend).toBe(3);
  expect(r.conic).toContain('conic-gradient');
  expect(r.variant).toBe('donut');
});

/* ── sherpa-gauge-chart ────────────────────────────────────────── */

test('sherpa-gauge-chart data-value renders needle angle + value text', async ({ page }) => {
  await mount(page, `<sherpa-gauge-chart data-value="75" data-min="0%" data-max="100%" data-label="SLA"></sherpa-gauge-chart>`, 'sherpa-gauge-chart');
  await settle();
  const r = await page.evaluate(() => {
    const sr = document.querySelector('sherpa-gauge-chart')!.shadowRoot!;
    const needle = sr.querySelector('.needle') as HTMLElement;
    return {
      angle: needle.style.getPropertyValue('--_angle'),
      value: sr.querySelector('.gauge-value')!.textContent,
      min: sr.querySelector('.range-min')!.textContent,
      max: sr.querySelector('.range-max')!.textContent,
      label: sr.querySelector('.gauge-label')!.textContent,
    };
  });
  // 75% → (75/100)*180-90 = 45deg
  expect(r.angle).toBe('45deg');
  expect(r.value).toBe('75%');
  expect(r.min).toBe('0%');
  expect(r.max).toBe('100%');
  expect(r.label).toBe('SLA');
});

test('sherpa-gauge-chart series variant setSegments builds a fill gradient', async ({ page }) => {
  await mount(page, `<sherpa-gauge-chart data-variant="series"></sherpa-gauge-chart>`, 'sherpa-gauge-chart');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-gauge-chart') as HTMLElement & { rendered: Promise<void>; setSegments: (s: unknown) => void };
    await el.rendered;
    el.setSegments([{ value: 40, color: '#058142' }, { value: 30, color: '#ffaa00' }]);
    const fill = el.shadowRoot!.querySelector('.gauge-fill') as HTMLElement;
    return {
      gradient: fill.style.getPropertyValue('--_fill-gradient'),
      value: el.shadowRoot!.querySelector('.gauge-value')!.textContent,
    };
  });
  expect(r.gradient).toContain('conic-gradient');
  expect(r.value).toBe('70%'); // total of segment values
});

/* ── sherpa-sparkline ──────────────────────────────────────────── */

test('sherpa-sparkline setValues([...]) reveals shapes + points', async ({ page }) => {
  await mount(page, `<sherpa-sparkline></sherpa-sparkline>`, 'sherpa-sparkline');
  await page.evaluate(async () => {
    const el = document.querySelector('sherpa-sparkline') as HTMLElement & { rendered: Promise<void>; setValues: (v: number[]) => void };
    await el.rendered;
    el.setValues([5, 12, 8, 20, 15]);
  });
  await settle();
  const r = await page.evaluate(() => {
    const el = document.querySelector('sherpa-sparkline')!;
    const sr = el.shadowRoot!;
    return {
      visibleShapes: Array.from(sr.querySelectorAll('.shape')).filter((s) => !s.hasAttribute('hidden')).length,
      minVar: (el as HTMLElement).style.getPropertyValue('--_min'),
      valuesAttr: (el as HTMLElement).dataset['values'],
    };
  });
  // 5 points → 4 visible segment shapes
  expect(r.visibleShapes).toBe(4);
  expect(r.minVar).toBe('5');
  expect(r.valuesAttr).toBe('[5,12,8,20,15]');
});

/* ── sherpa-chart-legend ───────────────────────────────────────── */

test('sherpa-chart-legend setItems renders rows; interactive row fires legend-item-click', async ({ page }) => {
  await mount(page, `<sherpa-chart-legend></sherpa-chart-legend>`, 'sherpa-chart-legend');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-chart-legend') as HTMLElement & { rendered: Promise<void>; setItems: (i: unknown) => void };
    await el.rendered;
    let detail: any = null;
    el.addEventListener('legend-item-click', (e: any) => (detail = e.detail));
    el.setItems([
      { label: 'Alpha', value: 12, link: true },
      { label: 'Beta', value: 8, link: true },
    ]);
    const sr = el.shadowRoot!;
    const rows = sr.querySelectorAll('.legend-list .legend-item');
    (rows[1] as HTMLElement).click();
    return {
      rows: rows.length,
      firstLabel: sr.querySelector('.legend-list .legend-item .legend-label')!.textContent,
      detail,
    };
  });
  expect(r.rows).toBe(2);
  expect(r.firstLabel).toBe('Alpha');
  expect(r.detail).toEqual({ index: 1, label: 'Beta' });
});

/* ── sherpa-metric ─────────────────────────────────────────────── */

test('sherpa-metric renders label/value/delta and drives inner sparkline via setValues', async ({ page }) => {
  await mount(page, `<sherpa-metric data-label="Active Users" value="1.2K" data-trend="up" data-delta="+5%"></sherpa-metric>`, 'sherpa-metric');
  await settle();
  const r = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-metric')!;
    const sr = el.shadowRoot!;
    // set data-sparkline so the inner sparkline is present + driveable
    (el as HTMLElement).toggleAttribute('data-sparkline', true);
    const spark = sr.querySelector('sherpa-sparkline') as (HTMLElement & { rendered: Promise<void>; setValues: (v: number[]) => void }) | null;
    if (spark) { await spark.rendered; spark.setValues([1, 4, 2, 6]); }
    return {
      label: sr.querySelector('.header-title')!.textContent,
      value: sr.querySelector('.metric-value')!.textContent,
      delta: sr.querySelector('.metric-delta')!.textContent,
      trend: (el as HTMLElement).dataset['trend'],
      sparkVisibleShapes: spark
        ? Array.from(spark.shadowRoot!.querySelectorAll('.shape')).filter((s) => !s.hasAttribute('hidden')).length
        : 0,
    };
  });
  expect(r.label).toBe('Active Users');
  expect(r.value).toBe('1.2K');
  expect(r.delta).toBe('+5%');
  expect(r.trend).toBe('up');
  expect(r.sparkVisibleShapes).toBe(3); // 4 points → 3 segments
});
