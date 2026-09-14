import { test, expect } from '@playwright/test';

/** sherpa-barchart — bars from populate(); height = value/max via --_h; bar-click event. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders a bar per datum with height proportional to the max', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { label: 'Q1', value: 50 }, // 50% of max(100)
      { label: 'Q2', value: 100 }, // 100%
      { label: 'Q3', value: 25 }, // 25%
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const bars = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.bar'));
    return {
      count: bars.length,
      heights: bars.map((b) => b.style.getPropertyValue('--_h')),
      labels: Array.from(el.shadowRoot!.querySelectorAll('.bar-label')).map((l) => l.textContent),
    };
  });
  expect(r.count).toBe(3);
  expect(r.heights).toEqual(['50%', '100%', '25%']);
  expect(r.labels).toEqual(['Q1', 'Q2', 'Q3']);
});

test('clicking a bar fires bar-click with the datum', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'A', value: 10 }, { label: 'B', value: 20 }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    let detail: { index: number; label: string; value: number } | null = null;
    el.addEventListener('bar-click', (e) => (detail = (e as CustomEvent).detail));

    const second = el.shadowRoot!.querySelectorAll<HTMLElement>('.bar-col')[1]!;
    second.click();
    return detail;
  });
  expect(r).toEqual({ index: 1, label: 'B', value: 20 });
});

test('bars use the data-viz series ramp: translucent fill, solid 1px stroke', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { label: 'A', value: 5, colorIndex: 1 },
      { label: 'B', value: 3, colorIndex: 2 },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const bars = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.bar'));
    return bars.map((bar) => {
      const s = getComputedStyle(bar);
      return {
        // The var the TS writes must actually RESOLVE. `--sherpa-categorical-N`
        // never existed, so it resolved to nothing and the fill fell back to the
        // property's initial value — black bars.
        hue: s.getPropertyValue('--_hue').trim(),
        background: s.backgroundColor,
        borderColor: s.borderTopColor,
        borderWidth: s.borderTopWidth,
      };
    });
  });

  expect(r).toHaveLength(2);

  // Figma Data Field: each Bar is the series hue at 60% with a solid 1px stroke in
  // the SAME hue, so overlapping marks stay readable and a thin bar still shows.
  const [a, b] = r as Array<Record<string, string>>;
  expect(a!['hue']).toBe('#7b1ce6'); // data-viz series 1
  expect(b!['hue']).toBe('#c046ff'); // data-viz series 2
  expect(a!['borderColor']).toBe('rgb(123, 28, 230)');
  expect(a!['borderWidth']).toBe('1px');
  // A translucent fill: 60% alpha, and NOT the initial black.
  expect(a!['background']).not.toBe('rgb(0, 0, 0)');
  expect(a!['background']).toMatch(/0\.6\)/);
});

test('the y axis labels its gridlines and lines up with the plot', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-axis-label', 'Alerts');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { label: 'A', value: 40 },
      { label: 'B', value: 20 },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const axis = sr.querySelector('.y-axis')!;
    const ticks = Array.from(sr.querySelectorAll('.y-tick'));
    const plot = sr.querySelector('.plot')!;
    const caption = sr.querySelector('.axis-label-y')!;

    const measure = (): Record<string, unknown> => ({
      shown: getComputedStyle(axis).display !== 'none',
      values: ticks.map((t) => t.querySelector('.y-value')!.textContent),
      // The axis must be EXACTLY as tall as the plot, or a value misses the
      // gridline it belongs to.
      heightsMatch:
        Math.abs(axis.getBoundingClientRect().height - plot.getBoundingClientRect().height) < 1,
      // The axis rule is the .y-axis box's own trailing border. It used to be each
      // label cell's border, back when the labels stacked in flow; now they are
      // absolutely placed at their `--_at` percentage, so the single box owns it —
      // one rule that spans the whole axis instead of N stacked segments.
      tickBorder: getComputedStyle(axis).borderInlineEndStyle,
      captionShown: getComputedStyle(caption).display !== 'none',
      captionText: caption.textContent,
      // Rotated to run up the axis.
      captionMode: getComputedStyle(caption).writingMode,
      // THE thing the user reported twice: a label's centre must sit on its own
      // gridline. Both come off tickPercent(i, bands), so measure the rendered
      // result rather than trusting that they share a formula.
      offsets: ticks.map((t) => {
        const a = axis.getBoundingClientRect();
        const b = t.getBoundingClientRect();
        const at = parseFloat(getComputedStyle(t).getPropertyValue('--_at')) || 0;
        const gridlineY = a.bottom - (a.height * at) / 100;
        return Math.abs(b.top + b.height / 2 - gridlineY).toFixed(1);
      }),
      // The axis must reserve real WIDTH. Its labels are absolutely positioned, so
      // a zero-width track let every number hang outside the chart.
      axisWidth: axis.getBoundingClientRect().width > 8,
      ticksInsideAxis: ticks.every(
        (t) => t.getBoundingClientRect().left >= axis.getBoundingClientRect().left - 0.5,
      ),
    });
    const withTicks = measure();

    // data-ticks="0" must remove the axis — an ABSENT attribute means "default 4",
    // so the state has to be written by the JS rather than inferred by a selector.
    el.setAttribute('data-ticks', '0');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const noTicks = {
      shown: getComputedStyle(axis).display !== 'none',
      flag: el.hasAttribute('data-has-y-axis'),
    };
    return { withTicks, noTicks };
  });

  expect(r.withTicks['shown']).toBe(true);
  // 4 gridlines → 5 boundaries, stamped 0 → max in DOM order.
  //
  // The order flipped when the axis stopped stacking its labels in flex. Each label
  // is now absolutely placed at its own `--_at` percentage (the SAME percentage its
  // gridline is drawn at), so DOM order carries no meaning and ascending is the
  // natural loop. On screen the max still renders at the top — the `offsets` check
  // below is what actually guards the visual result.
  expect(r.withTicks['values']).toEqual(['0', '10', '20', '30', '40']);
  // Every label's centre lands on its gridline (sub-pixel).
  for (const off of r.withTicks['offsets'] as string[]) expect(Number(off)).toBeLessThan(1);
  // The axis takes real width, so the numbers stay inside the chart.
  expect(r.withTicks['axisWidth']).toBe(true);
  expect(r.withTicks['ticksInsideAxis']).toBe(true);
  expect(r.withTicks['heightsMatch']).toBe(true);
  expect(r.withTicks['tickBorder']).toBe('solid');
  expect(r.withTicks['captionShown']).toBe(true);
  expect(r.withTicks['captionText']).toBe('Alerts');
  expect(r.withTicks['captionMode']).toBe('vertical-rl');

  expect(r.noTicks.shown).toBe(false);
  expect(r.noTicks.flag).toBe(false);
});

test('the x axis labels sit BELOW the baseline, one per bar', async ({ page }) => {
  // The labels used to live inside .bar-col, which put them ABOVE the baseline rule
  // (inside the drawing area) and let a long label steal height from the bars. They
  // are now a sibling row of the plot in the chart grid.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { label: 'Disk', value: 40 },
      { label: 'CPU', value: 30 },
      { label: 'Memory', value: 20 },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const row = sr.querySelector('.x-axis-row')!;
    const bars = Array.from(sr.querySelectorAll('.bar-col'));
    const labels = Array.from(row.children);
    const baseline = sr.querySelector('.bars')!.getBoundingClientRect().bottom;
    return {
      texts: labels.map((l) => l.textContent),
      // No label may live inside a bar column any more.
      insideBarCol: sr.querySelectorAll('.bar-col .bar-label').length,
      // Every label starts below where the bars end.
      allBelowBaseline: labels.every((l) => l.getBoundingClientRect().top >= baseline - 0.5),
      // Label N is centred under bar N: the two rows mirror each other's flex.
      centreOffsets: labels.map((l, i) => {
        const a = l.getBoundingClientRect();
        const b = bars[i]!.getBoundingClientRect();
        return Math.abs(a.left + a.width / 2 - (b.left + b.width / 2)).toFixed(1);
      }),
    };
  });

  expect(r.texts).toEqual(['Disk', 'CPU', 'Memory']);
  expect(r.insideBarCol).toBe(0);
  expect(r.allBelowBaseline).toBe(true);
  for (const off of r.centreOffsets) expect(Number(off)).toBeLessThan(1);
});
