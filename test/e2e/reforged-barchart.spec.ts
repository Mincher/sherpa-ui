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
    await window.__settled();
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
    await window.__settled();

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
    await window.__settled();

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
  // 50% however it is written — the minifier makes a colour-mix `#rrggbb80`.
  const TRANSLUCENT = /(\b50%|0?\.5\d*\s*\)|\/\s*0?\.5|#[0-9a-f]{6}80\b)/i;
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

test('the value axis labels its gridlines along the bottom, the width of the plot (Will, TODO 548)', async ({ page }) => {
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
    await window.__settled();

    const sr = el.shadowRoot!;
    const axis = sr.querySelector('.value-axis')!;
    const ticks = Array.from(sr.querySelectorAll('.value-tick'));
    const plot = sr.querySelector('.plot')!;
    const caption = sr.querySelector('.axis-label-value')!;

    const measure = (): Record<string, unknown> => ({
      shown: getComputedStyle(axis).display !== 'none',
      values: ticks.map((t) => t.querySelector('.y-value')!.textContent),
      // The axis must be EXACTLY as wide as the plot, or a value misses the
      // gridline it belongs to.
      widthsMatch: Math.abs(axis.getBoundingClientRect().width - plot.getBoundingClientRect().width) < 1,
      // Under the plot.
      below: axis.getBoundingClientRect().top >= plot.getBoundingClientRect().bottom - 0.5,
      captionShown: getComputedStyle(caption).display !== 'none',
      captionText: caption.textContent,
      captionBelow: caption.getBoundingClientRect().top >= axis.getBoundingClientRect().bottom - 0.5,
      // A label's centre sits on its own gridline. Both come off tickPercent(i,
      // bands), so measure the rendered result.
      offsets: ticks.map((t) => {
        const a = axis.getBoundingClientRect();
        const b = t.getBoundingClientRect();
        const at = parseFloat(getComputedStyle(t).getPropertyValue('--_at')) || 0;
        const gridlineX = a.left + (a.width * at) / 100;
        return Math.abs(b.left + b.width / 2 - gridlineX).toFixed(1);
      }),
    });
    const withTicks = measure();

    // data-ticks="0" removes the axis — an ABSENT attribute means "default 4",
    // so the state is written by the JS rather than inferred by a selector.
    el.setAttribute('data-ticks', '0');
    await window.__settled();
    const noTicks = {
      shown: getComputedStyle(axis).display !== 'none',
      flag: el.matches(':state(has-value-axis)'),
    };
    return { withTicks, noTicks };
  });

  expect(r.withTicks['shown']).toBe(true);
  // 4 gridlines → 5 boundaries, 0 → max, each at its own --_at.
  expect(r.withTicks['values']).toEqual(['0', '10', '20', '30', '40']);
  for (const off of r.withTicks['offsets'] as string[]) expect(Number(off)).toBeLessThan(1);
  expect(r.withTicks['widthsMatch']).toBe(true);
  expect(r.withTicks['below']).toBe(true);
  expect(r.withTicks['captionShown']).toBe(true);
  expect(r.withTicks['captionText']).toBe('Alerts');
  expect(r.withTicks['captionBelow']).toBe(true);

  expect(r.noTicks.shown).toBe(false);
  expect(r.noTicks.flag).toBe(false);
});

test('the category labels sit LEFT of the baseline, one beside each bar (Will, TODO 548)', async ({ page }) => {
  // The labels are a sibling column of the plot, so a long label never steals
  // length from the bars.
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
    await window.__settled();

    const sr = el.shadowRoot!;
    const column = sr.querySelector('.category-axis')!;
    const bars = Array.from(sr.querySelectorAll('.bar-col'));
    const labels = Array.from(column.children);
    const baseline = sr.querySelector('.bars')!.getBoundingClientRect().left;
    return {
      texts: labels.map((l) => l.textContent),
      insideBarCol: sr.querySelectorAll('.bar-col .bar-label').length,
      allLeftOfBaseline: labels.every((l) => l.getBoundingClientRect().right <= baseline + 0.5),
      // Label N is centred beside bar N: the two columns mirror each other's flex.
      centreOffsets: labels.map((l, i) => {
        const a = l.getBoundingClientRect();
        const b = bars[i]!.getBoundingClientRect();
        return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)).toFixed(1);
      }),
    };
  });

  expect(r.texts).toEqual(['Disk', 'CPU', 'Memory']);
  expect(r.insideBarCol).toBe(0);
  expect(r.allLeftOfBaseline).toBe(true);
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
    await window.__settled();

    const sr = chart.shadowRoot!;
    return {
      tips: Array.from(sr.querySelectorAll('.sherpa-tip-value')).map((t) => t.textContent!.trim()),
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

/**
 * A BAR HANGS FROM THE ZERO LINE.
 *
 * Every bar used to measure from the plot's bottom, so a negative value drew
 * an empty column and said nothing. `chartScale` fits the data, and where it
 * dips below zero the baseline lifts off the floor and a negative bar hangs
 * beneath it.
 *
 * TRAP T-a-bar-hangs-from-the-zero-line
 */
test('a NEGATIVE value grows left of a moved zero line (Will, TODO 548)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void;
    };
    el.style.inlineSize = '400px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { label: 'A', value: -5 }, { label: 'B', value: 10 }, { label: 'C', value: 20 },
    ]);
    await window.__settled();

    const plot = el.shadowRoot!.querySelector('.bars')!.getBoundingClientRect();
    const line = el.shadowRoot!.querySelector('.bars-zero')!;
    const along = (n: number): number => Math.round(n - plot.left);

    return {
      flagged: el.matches(':state(below-zero)'),
      lineShown: getComputedStyle(line).display,
      // The scale runs -5..20, so zero sits a fifth of the way along.
      lineAt: along(line.getBoundingClientRect().left),
      plotW: Math.round(plot.width),
      bars: [...el.shadowRoot!.querySelectorAll<HTMLElement>('.bar-col')].map((c) => {
        const box = c.querySelector('.bar')!.getBoundingClientRect();
        return { sign: c.dataset['sign'], start: along(box.left), end: along(box.right) };
      }),
    };
  });

  expect(r.flagged).toBe(true);
  expect(r.lineShown).toBe('block');
  // -5 of a 25 span is a fifth.
  expect(Math.abs(r.lineAt - Math.round(r.plotW * 0.2))).toBeLessThanOrEqual(1);

  // A grows LEFT: its end is the line, its start the plot's edge.
  expect(r.bars[0]!.sign).toBe('-');
  expect(Math.abs(r.bars[0]!.end - r.lineAt)).toBeLessThanOrEqual(1);
  expect(r.bars[0]!.start).toBe(0);

  // B and C start ON the line, and C is twice B.
  expect(Math.abs(r.bars[1]!.start - r.lineAt)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.bars[2]!.start - r.lineAt)).toBeLessThanOrEqual(1);
  const b = r.bars[1]!.end - r.bars[1]!.start;
  const c = r.bars[2]!.end - r.bars[2]!.start;
  expect(Math.abs(c - b * 2), 'twice the value is twice the bar').toBeLessThanOrEqual(1);
});


test('a chart of POSITIVE values is untouched — no line, bars on the baseline', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'A', value: 10 }, { label: 'B', value: 20 }]);
    await window.__settled();

    const plot = el.shadowRoot!.querySelector('.bars')!.getBoundingClientRect();
    const line = el.shadowRoot!.querySelector('.bars-zero')!;
    return {
      flagged: el.matches(':state(below-zero)'),
      lineShown: getComputedStyle(line).display,
      // Bars start at the baseline, within its 1px border.
      feet: [...el.shadowRoot!.querySelectorAll('.bar')]
        .map((n) => Math.round(n.getBoundingClientRect().left - plot.left)),
    };
  });

  expect(r.flagged).toBe(false);
  expect(r.lineShown, 'nothing is drawn for a chart that never dips').toBe('none');
  expect(r.feet.every((f) => f <= 1)).toBe(true);
});

/** A datum's `matched` is the part the highlight's driver matches: the bar goes
 *  pale and that part is drawn solid, its share of the bar. Will, TODO 441 */
test('a bar draws the part the highlight matches, and none without one', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const read = () => ({
      on: el.matches(':state(highlighting)'),
      parts: [...el.shadowRoot!.querySelectorAll<HTMLElement>('.bar-match')].map((m) => Math.round(m.getBoundingClientRect().width / m.parentElement!.clientWidth * 100)),
    });
    el.populate!([{ label: 'A', value: 40, matched: 10 }, { label: 'B', value: 20, matched: 20 }, { label: 'C', value: 30, matched: 0 }]);
    await window.__settled();
    const marked = read();
    el.populate!([{ label: 'A', value: 40 }, { label: 'B', value: 20 }]);
    await window.__settled();
    return { marked, plain: read() };
  });
  expect(r.marked.on).toBe(true);
  // Its share of the bar, give or take a pixel.
  r.marked.parts.forEach((p, i) => expect(Math.abs(p - [25, 100, 0][i]!)).toBeLessThanOrEqual(2));
  expect(r.plain).toEqual({ on: false, parts: [0, 0] });
});

test('a grouped bar stacks its parts in its own colour, each its share, 1px inside its outline; the tip and the name list them (Will, TODOs 548, 693)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<HTMLElement & { populate(d: unknown): Promise<void> }>('sherpa-barchart', undefined, { style: 'inline-size: 400px; block-size: 240px' });
    await el.populate([
      { label: 'active', value: 3, colorIndex: 1, parts: [{ label: 'Free', value: 1, colorIndex: 1 }, { label: 'Pro', value: 2, colorIndex: 2 }] },
      { label: 'trial', value: 1, colorIndex: 2 },
    ]);
    await window.__settled();
    const cols = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.bar-col')];
    const parts = [...cols[0]!.querySelectorAll<HTMLElement>('.bar-part')];
    const bar = cols[0]!.querySelector('.bar')!.getBoundingClientRect();
    const widths = parts.map((p) => Math.round(p.getBoundingClientRect().width));
    return {
      parts: parts.length, none: cols[1]!.querySelectorAll('.bar-part').length,
      // From the base along: Free (1 of 3), then Pro (2 of 3).
      share: widths.map((w) => Math.round((w / bar.width) * 3)),
      baseFirst: parts[0]!.getBoundingClientRect().left <= parts[1]!.getBoundingClientRect().left,
      // A tone by its weight, the larger darker, and a 1px gap between. TODOs 564, 635, 686
      tones: parts.map((p) => p.style.getPropertyValue('--_shade')),
      gap: getComputedStyle(parts[0]!.parentElement!).columnGap,
      // Inside the bar's 1px outline, 1px of padding on every side. TODO 693
      padded: (() => {
        const box = parts[0]!.parentElement!.getBoundingClientRect();
        return [box.top - bar.top, bar.right - box.right, bar.bottom - box.bottom, box.left - bar.left].map((n) => Math.round(n * 10) / 10);
      })(),
      tip: cols[0]!.querySelector('.chart-tip-parts')!.textContent,
      name: cols[0]!.getAttribute('aria-label'),
      plain: cols[1]!.getAttribute('aria-label'),
      // Open, its parts sit UNDER its name and total, a line each. Will, TODO 548
      under: await (async () => {
        const tip = cols[0]!.querySelector<HTMLElement>('.sherpa-tip')!;
        tip.showPopover();
        await window.__settled();
        const box = (s: string) => tip.querySelector(s)!.getBoundingClientRect();
        const out = { below: box('.chart-tip-parts').top >= box('.chart-tip-label').bottom - 1, lines: Math.round(box('.chart-tip-parts').height / 16) };
        tip.hidePopover();
        return out;
      })(),
    };
  });
  expect(r.parts).toBe(2);
  expect(r.none).toBe(0);
  expect(r.share).toEqual([1, 2]);
  expect(r.baseFirst).toBe(true);
  expect(r.tones).toEqual(['0%', '30%']);
  expect(r.gap).toBe('1px');
  expect(r.padded).toEqual([2, 2, 2, 2]);
  expect(r.tip).toBe('Free 1\nPro 2');
  expect(r.under).toEqual({ below: true, lines: 2 });
  expect(r.name).toBe('active: 3 (Free 1 · Pro 2)');
  expect(r.plain).toBe('trial: 1');
});

test('a stacked bar draws its Secondary pieces, each its share in ITS colour, and each piece\'s parts in it (Will, TODO 548)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<HTMLElement & { populate(d: unknown): Promise<void> }>('sherpa-barchart', undefined, { style: 'inline-size: 400px; block-size: 240px' });
    await el.populate([
      { label: 'Pro', value: 3, colorIndex: 1, stack: [
        { label: 'active', value: 2, colorIndex: 1, parts: [{ label: '10', value: 1 }, { label: '5', value: 1 }] },
        { label: 'churned', value: 1, colorIndex: 3 },
      ] },
    ]);
    await window.__settled();
    const col = el.shadowRoot!.querySelector<HTMLElement>('.bar-col')!;
    const bar = col.querySelector<HTMLElement>('.bar')!;
    const pieces = [...col.querySelectorAll<HTMLElement>('.bar-piece')];
    return {
      share: pieces.map((p) => Math.round((p.getBoundingClientRect().width / bar.getBoundingClientRect().width) * 3)),
      // Each piece its own series colour: the bar paints nothing of its own.
      colours: pieces.map((p) => getComputedStyle(p).backgroundColor),
      bar: getComputedStyle(bar).backgroundColor,
      parts: pieces.map((p) => p.querySelectorAll('.bar-part').length),
      name: col.getAttribute('aria-label'),
    };
  });
  expect(r.share).toEqual([2, 1]);
  expect(r.colours[0]).not.toBe(r.colours[1]);
  expect(r.bar).toBe('rgba(0, 0, 0, 0)');
  expect(r.parts).toEqual([2, 0]);
  expect(r.name).toBe('Pro: 3 (active 2 · churned 1)');
});
