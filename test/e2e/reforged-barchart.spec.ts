import { test, expect } from './harness';

/** sherpa-barchart — bars from populate(); height = value/max via --_h; bar-click event. */


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
        border: s.getPropertyValue('--_border').trim(),
        background: s.backgroundColor,
        borderColor: s.borderTopColor,
        borderWidth: s.borderTopWidth,
      };
    });
  });

  expect(r).toHaveLength(2);

  // Figma Data Field: each Bar is the series hue at 60%, with a solid 1px stroke
  // in the series' BORDER token — colour 5 of its sequence, held at full strength.
  // The border does NOT track the fill: a mark's fill moves along its ramp, its
  // outline is the series' identity and stays put.
  //
  // The RELATIONSHIPS are asserted, not the hexes: the palette is a design
  // decision that has changed twice, and pinning hexes only re-states the token
  // file. (`getPropertyValue` returns a custom property RESOLVED, so the var name
  // itself is not observable here — but a resolved value proves it resolved.)
  const [a, b] = r as Array<Record<string, string>>;
  // Each series is a DIFFERENT hue…
  expect(a!['hue']).not.toBe(b!['hue']);
  // …TRANSLUCENT, whatever syntax the token arrives in. It was `color-mix(… 50%)`
  // while the series were composed in CSS; Theme bakes the alpha into the hex
  // now, so the computed value is `rgba(…, .502)`. Asserting the SYNTAX made the
  // test a mirror of the token file rather than a check on the result.
  const TRANSLUCENT = /(\b50%|0?\.5\d*\s*\)|\/\s*0?\.5)/;
  expect(a!['hue']).toMatch(TRANSLUCENT);
  // …and its border is a SEPARATE value, not the fill — and SOLID.
  expect(a!['border']).not.toBe(a!['hue']);
  expect(a!['border']).not.toMatch(TRANSLUCENT);
  expect(a!['borderWidth']).toBe('1px');
  // Both must RESOLVE — an undefined custom property paints nothing at all, with
  // no error, so a wrong name shows up as the property's initial value.
  expect(a!['background']).not.toBe('rgb(0, 0, 0)');
  expect(a!['borderColor']).not.toBe('rgb(0, 0, 0)');
  // A translucent fill at the TOKEN's 50% — the component adds no tint of its
  // own. It used to apply a further 60%, which multiplied down to 30%.
  expect(a!['background']).toMatch(/0\.5\)/);
  // …and a SOLID border. `/ 0.` would mean an alpha slipped into the stroke.
  expect(a!['borderColor']).not.toMatch(/\/ 0\./);
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

/**
 * A TOOLTIP IS NOT AN AXIS.
 *
 * An axis compacts because it has four labels and no room. A tooltip has one
 * label and exists BECAUSE the reader wants the number. Sharing `formatTick`
 * made a bar worth 1,234 read as "1.2K" in the one place precision was asked
 * for.
 *
 * TRAP T-a-tooltip-is-not-an-axis
 */
test('the tooltip shows the value in full; the axis still compacts', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const chart = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(chart);
    await customElements.whenDefined('sherpa-barchart');
    await chart.rendered;
    chart.populate!([
      { label: 'Big', value: 1234, colorIndex: 1 },
      { label: 'Huge', value: 1250500, colorIndex: 2 },
      { label: 'Fractional', value: 7.25, colorIndex: 3 },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = chart.shadowRoot!;
    return {
      tips: Array.from(sr.querySelectorAll('.chart-tip-value')).map((t) => t.textContent!.trim()),
      axis: Array.from(sr.querySelectorAll('[class*=tick]'))
        .map((t) => t.textContent!.trim())
        .filter(Boolean),
    };
  });

  // In FULL, and grouped — 1250500 is unreadable without separators.
  expect(r.tips).toEqual(['1,234', '1,250,500', '7.25']);
  // The axis keeps compacting: four labels, no room.
  expect(r.axis.some((t) => /[KM]$/.test(t))).toBe(true);
});
