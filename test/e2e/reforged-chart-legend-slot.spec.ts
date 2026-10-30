import { test, expect } from './harness';

/**
 * The CHART owns the split with its own legend, and its SHAPE decides: wider than
 * square, the legend sits BESIDE the plot; square or narrower, BELOW it. No
 * attribute says where. In a layout grid, its card's spans are its shape, not its
 * pixels. Will, TODO 623. TRAP T-a-chart-shape-places-its-legend
 *
 * These assertions read MEASURED BOXES, never a class name. The split is CSS, so
 * "the rule is in the file" proves nothing about whether it applied.
 */

const CHARTS = ['sherpa-barchart', 'sherpa-line-chart', 'sherpa-gauge-chart', 'sherpa-radial-chart'] as const;

/** One chart filling a box, as a card's body fills it, with a legend slotted in. */
async function build(page: import('@playwright/test').Page, tag: string, width: number, height: number) {
  return page.evaluate(
    async ([t, w, h]) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const box = document.createElement('div');
      box.id = 'box';
      box.style.cssText = `display:flex;flex-direction:column;inline-size:${w}px;block-size:${h}px`;
      const chart = document.createElement(t) as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
      chart.style.cssText = 'flex:1 1 auto;min-block-size:0';
      const legend = document.createElement('sherpa-chart-legend') as HTMLElement & {
        rendered?: Promise<void>; populate?: (d: unknown) => void;
      };
      legend.setAttribute('slot', 'legend');
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
      await window.__settled();

      const r = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      };
      // Every chart frames its plot in a .chart-body (TODO 283, 308).
      const body = chart.shadowRoot!.querySelector('.chart-body') as HTMLElement;
      const items = [...legend.shadowRoot!.querySelectorAll('.item')].map(r);
      return { chart: r(chart), legend: r(legend), body: r(body), items };
    },
    [tag, width, height] as const,
  );
}

type Built = Awaited<ReturnType<typeof build>>;
const beside = (r: Built) => r.legend.x >= r.body.x + r.body.w - 1 && r.legend.y < r.body.y + r.body.h;
const below = (r: Built) => r.legend.y >= r.body.y + r.body.h - 1 && r.legend.x < r.body.x + r.body.w;

for (const tag of CHARTS) {
  test(`${tag}: WIDER than square, the legend sits beside the plot, a list, at roughly 70/30`, async ({ page }) => {
    const r = await build(page, tag, 600, 400);
    expect(beside(r)).toBe(true);
    expect(r.items[1]!.y).toBeGreaterThan(r.items[0]!.y);
    // The plot takes the larger share. 7fr/3fr with a gap, so allow a band.
    const share = r.body.w / r.chart.w;
    expect(share).toBeGreaterThan(0.55);
    expect(share).toBeLessThan(0.8);
    // It takes the whole height, and the legend no more room than it was given.
    expect(r.body.h).toBeGreaterThan(r.chart.h * 0.9);
    expect(r.legend.w).toBeGreaterThan(0);
  });

  test(`${tag}: SQUARE, the legend sits below the plot, a strip`, async ({ page }) => {
    const r = await build(page, tag, 400, 400);
    expect(below(r)).toBe(true);
    expect(r.items[1]!.y).toBe(r.items[0]!.y);
    // It runs the host's full width. (The gauge's own BODY is centred and narrower
    // than the host, since the ring caps at 320px, so this reads the CHART.)
    expect(r.legend.w).toBeGreaterThan(r.chart.w * 0.8);
  });

  test(`${tag}: NARROWER than square, below, and under 22rem the strip is a list`, async ({ page }) => {
    const r = await build(page, tag, 300, 400);
    expect(below(r)).toBe(true);
    expect(r.items[1]!.y).toBeGreaterThan(r.items[0]!.y);
    expect(r.items[1]!.x).toBe(r.items[0]!.x);
    // Nothing is pushed out of the chart.
    expect(r.legend.x + r.legend.w).toBeLessThanOrEqual(r.chart.x + r.chart.w + 1);
  });

  test(`${tag}: the edge is square, and a chart turns as its box does`, async ({ page }) => {
    expect(beside(await build(page, tag, 401, 400))).toBe(true);
    expect(below(await build(page, tag, 400, 400))).toBe(true);
    const turned = await page.evaluate(async (t) => {
      const chart = document.querySelector(t)!;
      const read = () => {
        const body = chart.shadowRoot!.querySelector('.chart-body')!.getBoundingClientRect();
        return chart.querySelector('sherpa-chart-legend')!.getBoundingClientRect().x >= body.right - 1;
      };
      (document.getElementById('box') as HTMLElement).style.inlineSize = '700px';
      await window.__settled();
      return read();
    }, tag);
    expect(turned).toBe(true);
  });

  test(`${tag}: with NO legend the plot takes the whole chart, wide or not`, async ({ page }) => {
    const r = await page.evaluate(async (t) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const box = document.createElement('div');
      box.style.cssText = 'inline-size:600px';
      const chart = document.createElement(t) as HTMLElement & { rendered?: Promise<void> };
      box.appendChild(chart);
      root.appendChild(box);
      await chart.rendered;
      await window.__settled();
      const body = chart.shadowRoot!.querySelector('.chart-body')!.getBoundingClientRect();
      return {
        bodyW: body.width,
        chartW: chart.getBoundingClientRect().width,
        hasLegend: chart.matches(':state(has-legend)'),
      };
    }, tag);
    expect(r.hasLegend).toBe(false);
    expect(r.bodyW).toBeGreaterThan(r.chartW * 0.95);
  });
}

// In a layout grid, the spans decide: a 4x4 card measures wide and reads square.
test('in a layout grid, a card\'s spans place its legend, whatever its pixels', async ({ page }) => {
  const read = (attrs: Record<string, string>) => page.evaluate(async (given) => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const grid = document.createElement('sherpa-layout-grid');
    grid.setAttribute('data-rows', 'fixed');
    grid.style.inlineSize = '1500px';
    const card = document.createElement('sherpa-container');
    for (const [name, value] of Object.entries(given)) card.setAttribute(name, value);
    const chart = document.createElement('sherpa-barchart') as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
    const legend = document.createElement('sherpa-chart-legend') as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
    legend.setAttribute('slot', 'legend');
    chart.appendChild(legend);
    card.appendChild(chart);
    grid.appendChild(card);
    root.appendChild(grid);
    await chart.rendered;
    await legend.rendered;
    chart.populate?.([{ label: 'a', value: 1 }, { label: 'b', value: 2 }]);
    legend.populate?.([{ label: 'Alpha' }, { label: 'Beta' }]);
    await window.__settled();
    const box = chart.getBoundingClientRect();
    const body = chart.shadowRoot!.querySelector('.chart-body')!.getBoundingClientRect();
    const items = [...legend.shadowRoot!.querySelectorAll('.item')].map((i) => i.getBoundingClientRect());
    return {
      beside: legend.getBoundingClientRect().x >= body.right - 1,
      strip: items[0]!.y === items[1]!.y,
      wider: box.width > box.height,
    };
  }, attrs);
  // Wider by span.
  expect(await read({ 'data-col-span': 'medium', 'data-row-span': '3' })).toMatchObject({ beside: true, strip: false });
  expect(await read({ 'data-col-span': 'full', 'data-row-span': '4' })).toMatchObject({ beside: true, strip: false });
  // Square by span, wide in pixels: the spans win.
  expect(await read({ 'data-col-span': 'medium', 'data-row-span': '4' })).toEqual({ beside: false, strip: true, wider: true });
  // Narrower by span. A DRAGGED width counts, as it is what the card spans now.
  expect(await read({ 'data-col-span': 'medium', 'data-col-span-12': '2', 'data-row-span': '3' })).toMatchObject({ beside: false });
  // No row span, no ratio: its pixels decide.
  expect((await read({ 'data-col-span': 'full' })).beside).toBe(true);
});

// A size container takes no height from its content, so each family names it.
for (const [tag, natural] of [['sherpa-barchart', 212], ['sherpa-line-chart', 212], ['sherpa-gauge-chart', 208], ['sherpa-radial-chart', 300]] as const) {
  test(`${tag}: unsized, it keeps its natural height of ${natural}px`, async ({ page }) => {
    const h = await page.evaluate(async (t) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const box = document.createElement('div');
      box.style.cssText = 'inline-size:600px';
      const chart = document.createElement(t) as HTMLElement & { rendered?: Promise<void> };
      box.appendChild(chart);
      root.appendChild(box);
      await chart.rendered;
      await window.__settled();
      return Math.round(chart.getBoundingClientRect().height);
    }, tag);
    expect(h).toBe(natural);
  });
}

// The x-axis ROW, not `.chart-body`: the body shrank and its row overflowed it,
// so a body-box check passed while the labels sat on the legend.
// TRAP T-a-percentage-floor-needs-a-definite-parent
test('sherpa-barchart: a SHORT host shrinks the plot; an unsized one keeps 180px', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const measure = async (inlineSize: string, blockSize: string) => {
      const box = document.createElement('div');
      box.style.inlineSize = inlineSize;
      const chart = document.createElement('sherpa-barchart') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void };
      chart.style.blockSize = blockSize;
      const legend = document.createElement('sherpa-chart-legend') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void };
      legend.setAttribute('slot', 'legend');
      chart.appendChild(legend);
      box.appendChild(chart);
      root.appendChild(box);
      await chart.rendered;
      await legend.rendered;
      chart.populate([{ label: 'a', value: 1 }, { label: 'b', value: 2 }]);
      legend.populate([{ label: 'Alpha' }, { label: 'Beta' }]);
      await window.__settled();
      const sr = chart.shadowRoot!;
      return {
        plot: Math.round(sr.querySelector('.plot')!.getBoundingClientRect().height),
        // The value axis is its lowest row now. Will, TODO 548
        axisBottom: sr.querySelector('.value-axis')!.getBoundingClientRect().bottom,
        legendTop: legend.getBoundingClientRect().top,
        hostBottom: chart.getBoundingClientRect().bottom,
      };
    };
    // Square, so its legend is below: the axis must clear it.
    return { short: await measure('220px', '220px'), unsized: await measure('600px', '') };
  });
  expect(r.short.axisBottom).toBeLessThanOrEqual(r.short.legendTop);
  expect(r.short.plot).toBeLessThan(180);
  expect(r.unsized.plot).toBe(180);
  expect(r.unsized.axisBottom).toBeLessThanOrEqual(r.unsized.hostBottom);
});
