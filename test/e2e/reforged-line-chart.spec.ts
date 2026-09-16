import { test, expect } from '@playwright/test';

/** sherpa-line-chart — SVG polylines from populate({labels,series}); area variant; multi-series. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('maps a series to an SVG polyline (y inverted, x across the width)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ labels: ['a', 'b', 'c'], series: [[0, 50, 100]] }); // min 0, max 100
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const line = el.shadowRoot!.querySelector('polyline.line')!;
    return {
      points: line.getAttribute('points'),
      xLabels: Array.from(el.shadowRoot!.querySelectorAll('.x-label')).map((l) => l.textContent),
    };
  });
  // x: 0,50,100 across the width; y inverted: 0→100, 50→50, 100→0.
  expect(r.points).toBe('0,100 50,50 100,0');
  expect(r.xLabels).toEqual(['a', 'b', 'c']);
});

test('renders one series group per series (multi-series)', async ({ page }) => {
  const count = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({
      labels: ['x', 'y'],
      series: [
        { name: 'A', values: [1, 2] },
        { name: 'B', values: [2, 1] },
      ],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return el.shadowRoot!.querySelectorAll('.series-layer > .series').length;
  });
  expect(count).toBe(2);
});

test('area variant reveals the fill; line variant hides it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (variant?: string) => {
      const el = document.createElement('sherpa-line-chart') as HTMLElement & {
        rendered?: Promise<void>;
        populate?: (d: unknown) => void;
      };
      if (variant) el.setAttribute('data-type', variant);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      el.populate!({ labels: ['a', 'b'], series: [[10, 20]] });
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return getComputedStyle(el.shadowRoot!.querySelector('.area')!).display;
    };
    return { line: await mk(), area: await mk('area') };
  });
  expect(r.line).toBe('none'); // line variant: no area fill
  expect(r.area).not.toBe('none');
});

test('setSeriesHidden removes a series and re-scales the axis to what is left', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      setSeriesHidden(i: number, hidden?: boolean): void;
      hiddenSeries: number[];
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    // One series peaks at 1000, the other stays under 10. With both visible the
    // small one is squashed flat; hiding the big one must re-scale for it.
    el.populate({
      labels: ['a', 'b', 'c'],
      series: [
        { name: 'big', values: [900, 1000, 950] },
        { name: 'small', values: [2, 8, 5] },
      ],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const count = (): number => sr.querySelectorAll('g.series').length;
    /** The small series' y range — a squashed line has almost no spread. */
    const spread = (): number => {
      const line = sr.querySelectorAll('polyline.line');
      const last = line[line.length - 1];
      const ys = (last?.getAttribute('points') ?? '')
        .split(' ')
        .map((p) => parseFloat(p.split(',')[1] ?? '0'));
      return Math.round(Math.max(...ys) - Math.min(...ys));
    };
    const hues = (): string[] =>
      Array.from(sr.querySelectorAll<HTMLElement>('g.series')).map((g) =>
        g.style.getPropertyValue('--_hue'),
      );

    const both = { count: count(), spread: spread(), hues: hues() };
    el.setSeriesHidden(0);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const alone = { count: count(), spread: spread(), hues: hues(), list: el.hiddenSeries };
    el.setSeriesHidden(0, false);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const restored = { count: count(), hues: hues(), list: el.hiddenSeries };
    return { both, alone, restored };
  });

  expect(r.both.count).toBe(2);
  expect(r.alone.count).toBe(1);
  expect(r.alone.list).toEqual([0]);

  // The point of re-rendering rather than hiding the drawn <g>: the y-scale comes
  // from the VISIBLE values, so the small series stops being a flat line at the
  // bottom of the canvas once the 1000-peak series is out of the extent.
  expect(r.both.spread).toBeLessThan(3);
  expect(r.alone.spread).toBeGreaterThan(50);

  // Unhiding restores BOTH series and their original hues — the colour comes from
  // the series index, so hiding one must not shift the other's colour.
  expect(r.restored.count).toBe(2);
  expect(r.restored.hues).toEqual(r.both.hues);
  expect(r.restored.list).toEqual([]);
});

test('the y axis spans the data extent, not zero to max', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    // Values well above zero: an axis running 0..1000 would label gridlines that
    // are nowhere near where the line actually sits.
    el.populate({ labels: ['a', 'b', 'c'], series: [[900, 1000, 950]] });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const ticks = Array.from(sr.querySelectorAll('.y-tick'));
    const axis = sr.querySelector('.y-axis')!;
    const plot = sr.querySelector('.plot')!;
    return {
      values: ticks.map((t) => t.querySelector('.y-value')!.textContent),
      heightsMatch:
        Math.abs(axis.getBoundingClientRect().height - plot.getBoundingClientRect().height) < 1,
      // The plot must SHRINK to sit beside the axis rather than overflow — it was
      // stuck at its intrinsic width until `flex: 1 1 auto; min-inline-size: 0`.
      plotNarrowerThanHost:
        plot.getBoundingClientRect().width < el.getBoundingClientRect().width,
      // Each label's centre must sit on its own gridline — the misalignment the
      // user reported twice. Measured, not inferred from a shared formula.
      offsets: ticks.map((t) => {
        const a = axis.getBoundingClientRect();
        const b = t.getBoundingClientRect();
        const at = parseFloat(getComputedStyle(t).getPropertyValue('--_at')) || 0;
        return Math.abs(b.top + b.height / 2 - (a.bottom - (a.height * at) / 100)).toFixed(1);
      }),
      // The axis reserves real width, so its numbers stay inside the chart rather
      // than hanging off its left edge (absolutely-placed labels add no width of
      // their own, which collapsed the `auto` grid track to zero).
      ticksInsideHost: ticks.every(
        (t) => t.getBoundingClientRect().left >= el.getBoundingClientRect().left - 0.5,
      ),
    };
  });

  // Math.min(0, …) floors the SCALE at 0 for the plot, but the axis labels the
  // same window the lines are drawn in, so both agree.
  //
  // Stamped 0 → max in DOM order: each label is absolutely placed at its own
  // `--_at` percentage, so DOM order carries no visual meaning (the max still
  // renders at the TOP). `offsets` is the check that guards what is on screen.
  expect(r.values).toHaveLength(5);
  expect(r.values[0]).toBe('0');
  expect(r.values[r.values.length - 1]).toBe('1K'); // the max, compacted
  for (const off of r.offsets) expect(Number(off)).toBeLessThan(1);
  expect(r.ticksInsideHost).toBe(true);
  expect(r.heightsMatch).toBe(true);
  expect(r.plotNarrowerThanHost).toBe(true);
});
