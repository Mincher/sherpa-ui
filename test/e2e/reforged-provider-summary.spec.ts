import { test, expect } from '@playwright/test';

/**
 * A chart or tile DECLARES what it needs of the rows, and its provider answers
 * — no `as` adapter anywhere. A legend reads its chart's field, and its pick
 * narrows that chart alone. docs/PROVIDER-DESIGN.md §7 P2.
 * TRAP T-a-component-declares-its-summary
 */
const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

const SETUP = `
  const { ArrayStore, DataSource, onReport } = await import('/dist/index.js');
  const reports = [];
  onReport((r) => reports.push(r.code));
  const PLANS = ['Free', 'Pro', 'Enterprise'];
  const rows = [
    { id: 1, plan: 'Pro', spend: 1200.5, day: 'Mon' },
    { id: 2, plan: 'Free', spend: 0, day: 'Tue' },
    { id: 3, plan: 'Pro', spend: 300, day: 'Wed' },
    { id: 4, plan: 'Enterprise', spend: 5000, day: 'Mon' },
  ];
  const make = () => {
    const s = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
    s.declareValues('plan', PLANS);
    s.declareValues('day', ['Mon', 'Tue', 'Wed']);
    return s;
  };
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const root = document.getElementById('root');
  root.innerHTML = '';
  const provider = document.createElement('sherpa-provider');
  root.append(provider);
`;

test('declared summaries fill with no bind; an undeclared chart waits', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-metric id="spend" data-label="Spend" data-aggregate="sum" data-field="spend"
        data-over-field="day" data-format='{"style":"currency","currency":"USD","maximumFractionDigits":0}'></sherpa-metric>
      <sherpa-barchart id="bar" data-segment-field="plan"></sherpa-barchart>
      <sherpa-gauge-chart id="gauge" data-aggregate="mean" data-field="spend"></sherpa-gauge-chart>
      <sherpa-line-chart id="line" data-over-field="day" data-segment-field="plan"></sherpa-line-chart>
      <sherpa-barchart id="bare"></sherpa-barchart>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const $ = (s) => provider.querySelector(s);
    return {
      value: $('#spend').dataset.value,
      want: new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(6500.5),
      spark: $('#spend').hasAttribute('data-has-values'),
      gauge: Number($('#gauge').dataset.value),
      bound: source.boundElements.map((el) => el.id).sort(),
      reports,
    };
  })()`) as Record<string, unknown>;
  // The platform formats it; the exact string is the engine's, so it is compared to Intl's own.
  expect(r['value']).toBe(r['want']);
  expect(r['spark']).toBe(true);
  expect(r['gauge']).toBeCloseTo(1625.125);
  // `bare` declares nothing, so the page populates it by hand.
  expect(r['bound']).toEqual(['bar', 'gauge', 'line', 'spend']);
  expect(r['reports']).toEqual([]);
});

test('a legend reads its chart\'s field; its pick narrows that chart alone', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-metric id="count" data-aggregate="count"></sherpa-metric>
      <sherpa-radial-chart id="donut" data-segment-field="plan">
        <sherpa-chart-legend slot="legend" id="legend"></sherpa-chart-legend>
      </sherpa-radial-chart>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const $ = (s) => provider.querySelector(s);
    const before = $('#donut').slices.map((s) => s.label);
    const items = $('#legend').shadowRoot.querySelectorAll('.item').length;
    $('#legend').shadowRoot.querySelector('.item').click();
    await settle();
    return { before, items, after: $('#donut').slices.map((s) => s.label), count: $('#count').dataset.value, reports };
  })()`) as Record<string, unknown>;
  expect(r['before']).toEqual(['Free', 'Pro', 'Enterprise']);
  expect(r['items']).toBe(3);
  expect(r['after']).toEqual(['Pro', 'Enterprise']);
  // The tile beside it is not the legend's: it still counts every row.
  expect(r['count']).toBe('4');
  expect(r['reports']).toEqual([]);
});

test('a child uses the nearest data-source above it; a new declaration asks again; a bad one is loud', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <div data-source="b"><sherpa-metric id="nested" data-aggregate="count"></sherpa-metric></div>
      <sherpa-metric id="wrong" data-source="a" data-aggregate="median"></sherpa-metric>\`;
    const a = make();
    const b = new DataSource({ store: new ArrayStore(rows.slice(0, 1), { key: 'id' }) });
    provider.provide({ sources: { a, b } });
    await Promise.all([a.load(), b.load()]);
    await settle();
    const $ = (s) => provider.querySelector(s);
    const nested = $('#nested').dataset.value;
    // Declared again: it leaves, asks, and is answered in its new shape.
    $('#nested').setAttribute('data-aggregate', 'sum');
    $('#nested').setAttribute('data-field', 'spend');
    await settle();
    return { nested, resummed: $('#nested').dataset.value, bBound: b.boundElements.length, reports: [...new Set(reports)] };
  })()`) as Record<string, unknown>;
  expect(r['nested']).toBe('1');
  expect(r['resummed']).toBe((1200.5).toLocaleString(undefined, { maximumFractionDigits: 2 }));
  expect(r['bBound']).toBe(1);
  expect(r['reports']).toEqual(['provider-unknown-aggregate']);
});
