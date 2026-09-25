import { test, expect } from '@playwright/test';

/**
 * The CHART owns the split with its own legend — not the card around it.
 *
 * Every chart takes a `legend` slot and a `data-legend` attribute saying what it
 * does about it: horizontal puts the legend BELOW the plot, vertical puts it
 * BESIDE. Before this the page wrapped the chart and the legend in its own div
 * and wrote the ratio there, so the pair could not move between cards without
 * carrying a stylesheet along.
 *
 * These assertions read MEASURED BOXES, never a class name. The split is CSS, so
 * "the rule is in the file" proves nothing about whether it applied — and the
 * first attempt at this used `:host(:has(…))`, which does not parse at all and
 * dropped all twelve rules silently.
 */

const HARNESS = '/test/reforged/harness.html';
const CHARTS = ['sherpa-barchart', 'sherpa-line-chart', 'sherpa-gauge-chart'] as const;

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

/** Build one chart in a fixed 600x400 box with a legend slotted in. */
async function build(page: import('@playwright/test').Page, tag: string, orientation: string) {
  return page.evaluate(
    async ([t, o]) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const box = document.createElement('div');
      box.style.cssText = 'inline-size:600px;block-size:400px';
      const chart = document.createElement(t) as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
      chart.setAttribute('data-legend', o);
      const legend = document.createElement('sherpa-chart-legend') as HTMLElement & {
        rendered?: Promise<void>; populate?: (d: unknown) => void;
      };
      legend.setAttribute('slot', 'legend');
      legend.setAttribute('data-orientation', o);
      chart.appendChild(legend);
      box.appendChild(chart);
      root.appendChild(box);

      await chart.rendered;
      await legend.rendered;
      chart.populate?.(
        t === 'sherpa-line-chart'
          ? { labels: ['a', 'b', 'c'], series: [{ label: 'S', values: [1, 2, 3] }] }
          : [{ label: 'a', value: 1 }, { label: 'b', value: 2 }],
      );
      legend.populate?.([{ label: 'Alpha' }, { label: 'Beta' }]);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();

      const r = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      };
      const body = chart.shadowRoot!.querySelector('.chart-body') as HTMLElement;
      return { chart: r(chart), legend: r(legend), body: r(body), hostDisplay: getComputedStyle(chart).display };
    },
    [tag, orientation] as const,
  );
}

for (const tag of CHARTS) {
  test(`${tag}: a HORIZONTAL legend sits BELOW the plot`, async ({ page }) => {
    const r = await build(page, tag, 'horizontal');
    // BELOW: the legend starts at or after the plot's bottom edge. That is the
    // whole claim — a stacked pair, not a side-by-side one.
    expect(r.legend.y).toBeGreaterThanOrEqual(r.body.y + r.body.h - 1);
    // And it is NOT beside: the two overlap horizontally rather than sitting in
    // separate columns.
    expect(r.legend.x).toBeLessThan(r.body.x + r.body.w);
    // It runs the host's full width — which is why a legend below needs only
    // height. (The gauge's own BODY is centred and narrower than the host, since
    // the ring caps at 320px, so this compares against the CHART, not the body.)
    expect(r.legend.w).toBeGreaterThan(r.chart.w * 0.8);
  });

  test(`${tag}: a VERTICAL legend sits BESIDE the plot at roughly 70/30`, async ({ page }) => {
    const r = await build(page, tag, 'vertical');
    expect(r.hostDisplay).toBe('grid');
    // Beside: the legend starts after the plot's right edge, and they overlap
    // vertically rather than stacking.
    expect(r.legend.x).toBeGreaterThanOrEqual(r.body.x + r.body.w - 1);
    expect(r.legend.y).toBeLessThan(r.body.y + r.body.h);
    // The plot takes the larger share. 7fr/3fr with a gap, so allow a band.
    const share = r.body.w / r.chart.w;
    expect(share).toBeGreaterThan(0.55);
    expect(share).toBeLessThan(0.8);
  });

  test(`${tag}: with NO legend the plot takes the whole chart`, async ({ page }) => {
    const r = await page.evaluate(async (t) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const box = document.createElement('div');
      box.style.cssText = 'inline-size:600px;block-size:400px';
      const chart = document.createElement(t) as HTMLElement & { rendered?: Promise<void> };
      box.appendChild(chart);
      root.appendChild(box);
      await chart.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return {
        display: getComputedStyle(chart).display,
        hasLegend: chart.hasAttribute('data-has-legend'),
      };
    }, tag);
    expect(r.hasLegend).toBe(false);
    // No 30% column reserved for a legend that is not there: the host stays a
    // flex column rather than becoming the two-track grid.
    expect(r.display).toBe('flex');
  });
}

// The x-axis ROW, not `.chart-body`: the body shrank and its row overflowed it,
// so a body-box check passed while the labels sat on the legend.
// TRAP T-a-percentage-floor-needs-a-definite-parent
test('sherpa-barchart: a SHORT host shrinks the plot; an unsized one keeps 180px', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const measure = async (blockSize: string) => {
      const box = document.createElement('div');
      box.style.cssText = 'inline-size:600px';
      const chart = document.createElement('sherpa-barchart') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void };
      chart.setAttribute('data-legend', 'horizontal');
      chart.style.blockSize = blockSize;
      const legend = document.createElement('sherpa-chart-legend') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void };
      legend.setAttribute('slot', 'legend');
      legend.setAttribute('data-orientation', 'horizontal');
      chart.appendChild(legend);
      box.appendChild(chart);
      root.appendChild(box);
      await chart.rendered;
      await legend.rendered;
      chart.populate([{ label: 'a', value: 1 }, { label: 'b', value: 2 }]);
      legend.populate([{ label: 'Alpha' }, { label: 'Beta' }]);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const sr = chart.shadowRoot!;
      return {
        plot: Math.round(sr.querySelector('.plot')!.getBoundingClientRect().height),
        axisBottom: sr.querySelector('.x-axis-row')!.getBoundingClientRect().bottom,
        legendTop: legend.getBoundingClientRect().top,
      };
    };
    // 220px is the Records card's host: less than the 180px plot + axis + legend.
    return { short: await measure('220px'), unsized: await measure('') };
  });
  expect(r.short.axisBottom).toBeLessThanOrEqual(r.short.legendTop);
  expect(r.short.plot).toBeLessThan(180);
  expect(r.unsized.plot).toBe(180);
  expect(r.unsized.axisBottom).toBeLessThanOrEqual(r.unsized.legendTop);
});

test('the split is declared on the CHART, not read from the legend', async ({ page }) => {
  // A guard against the bug this replaced: `:host(:has(…))` does not parse, so a
  // chart that tried to read the legend's own data-orientation got NO rule at
  // all. If someone puts that back, this test fails — the chart would stay a
  // flex column even though the legend says vertical.
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const chart = document.createElement('sherpa-barchart') as HTMLElement & { rendered?: Promise<void> };
    chart.setAttribute('data-legend', 'vertical');
    const legend = document.createElement('sherpa-chart-legend');
    legend.setAttribute('slot', 'legend');
    // Deliberately NOT matching the chart — the chart's own attribute decides.
    legend.setAttribute('data-orientation', 'horizontal');
    chart.appendChild(legend);
    root.appendChild(chart);
    await chart.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { display: getComputedStyle(chart).display };
  });
  expect(r.display).toBe('grid');
});
