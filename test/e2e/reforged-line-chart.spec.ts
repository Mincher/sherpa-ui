import { test, expect } from './harness';

/** sherpa-line-chart — SVG polylines from populate({labels,series}); area variant; multi-series. */


test('maps a series to an SVG polyline (y inverted, x across the width)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ labels: ['a', 'b', 'c'], series: [[0, 50, 100]] }); // min 0, max 100
    await window.__settled();
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
    await window.__settled();
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
      await window.__settled();
      return getComputedStyle(el.shadowRoot!.querySelector('.area')!).display;
    };
    return { line: await mk(), area: await mk('area') };
  });
  expect(r.line).toBe('none'); // line variant: no area fill
  expect(r.area).not.toBe('none');
});

/* A series LEFT OUT — a legend's pick, answered by the provider — re-scales the
   axis to the series drawn, and keeps its colour by its colorIndex.
   TRAP T-hiding-a-series-rescales-the-axis */
test('a series left out re-scales the axis, and the rest keep their colour', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    const settle = () => window.__settled();
    const big = { name: 'big', values: [900, 1000, 950], colorIndex: 1 };
    const small = { name: 'small', values: [2, 8, 5], colorIndex: 2 };
    const sr = el.shadowRoot!;
    const count = (): number => sr.querySelectorAll('g.series').length;
    /** The last series' y range — a squashed line has almost no spread. */
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
    // One series peaks at 1000, the other stays under 10.
    el.populate({ labels: ['a', 'b', 'c'], series: [big, small] });
    await settle();
    const both = { count: count(), spread: spread(), hues: hues() };
    el.populate({ labels: ['a', 'b', 'c'], series: [small] });
    await settle();
    return { both, alone: { count: count(), spread: spread(), hues: hues() } };
  });

  expect(r.both.count).toBe(2);
  expect(r.alone.count).toBe(1);
  // The y-scale comes from the series DRAWN, so the small one stops being a
  // flat line at the bottom once the 1000-peak series is out.
  expect(r.both.spread).toBeLessThan(3);
  expect(r.alone.spread).toBeGreaterThan(50);
  // Its colour is its colorIndex, never its position.
  expect(r.alone.hues).toEqual([r.both.hues[1]]);
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
    await window.__settled();

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

/** What the highlight's driver matches: the line goes pale, and its matched
 *  values are a line of their own on the same scale. Will, TODO 441 */
test('a series\' matched values draw a second line, and none without them', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const read = () => {
      const match = el.shadowRoot!.querySelector<SVGPolylineElement>('.line-match')!;
      return { on: el.matches(':state(highlighting)'), shown: getComputedStyle(match).display, points: match.getAttribute('points')?.split(' ').length ?? 0 };
    };
    el.populate!({ labels: ['a', 'b', 'c'], series: [{ name: 's', values: [10, 20, 30], matched: [5, 10, 15] }] });
    await window.__settled();
    const marked = read();
    el.populate!({ labels: ['a', 'b', 'c'], series: [{ name: 's', values: [10, 20, 30] }] });
    await window.__settled();
    return { marked, plain: read() };
  });
  expect(r.marked).toEqual({ on: true, shown: 'inline', points: 3 });
  expect(r.plain.on).toBe(false);
  expect(r.plain.shown).toBe('none');
});

/** Each x label under its own point, read in PIXELS: the drawn vertex against
 *  the label's text. The ends sit flush with the plot, inside it; a lone point's
 *  label centres. TODO 717. TRAP T-a-line-label-sits-under-its-point */
test('each x label sits under its own point; the ends are flush with the plot', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const out: Record<number, { centres: number[]; first: number; last: number; inside: boolean; apart: boolean }> = {};
    for (const n of [1, 2, 5, 12]) {
      const el = document.createElement('sherpa-line-chart') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void };
      el.style.inlineSize = '600px';
      el.style.blockSize = '240px';
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      el.populate({ labels: Array.from({ length: n }, (_, i) => `P${i + 1}`), series: [Array.from({ length: n }, (_, i) => (i * 7) % 10)] });
      await window.__settled();
      const sr = el.shadowRoot!;
      const svg = sr.querySelector<SVGSVGElement>('.svg')!;
      const line = sr.querySelector<SVGPolylineElement>('polyline.line')!;
      const ctm = svg.getScreenCTM()!;
      // Where each vertex is DRAWN, on screen.
      const xs = [...line.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(ctm).x);
      const labels = [...sr.querySelectorAll<HTMLElement>('.x-label')];
      const ink = labels.map((l) => { const g = document.createRange(); g.selectNodeContents(l); return g.getBoundingClientRect(); });
      const boxes = labels.map((l) => l.getBoundingClientRect());
      const plot = sr.querySelector('.plot')!.getBoundingClientRect();
      out[n] = {
        centres: ink.map((t, i) => Math.abs((t.left + t.right) / 2 - xs[i]!)),
        first: Math.abs(ink[0]!.left - xs[0]!),
        last: Math.abs(ink.at(-1)!.right - xs.at(-1)!),
        inside: ink.every((t) => t.left >= plot.left - 0.5 && t.right <= plot.right + 0.5),
        apart: boxes.every((b, i) => i === 0 || boxes[i - 1]!.right <= b.left + 0.5),
      };
    }
    return out;
  });
  expect(r[1]!.centres[0]).toBeLessThan(1);
  for (const n of [2, 5, 12]) {
    const m = r[n]!;
    expect(m.first, `${n} points: the first label starts at its point`).toBeLessThan(1);
    expect(m.last, `${n} points: the last label ends at its point`).toBeLessThan(1);
    for (const c of m.centres.slice(1, -1)) expect(c, `${n} points: a label centres on its point`).toBeLessThan(1);
    expect(m.inside).toBe(true);
    expect(m.apart).toBe(true);
  }
});

/** A label too long for its room truncates there, the room still centred on
 *  its point, and never runs into the next. Will, 716: the tip says it whole. */
test('a long x label truncates in its own room, under its point', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-line-chart') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void };
    el.style.inlineSize = '600px';
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    const labels = Array.from({ length: 12 }, (_, i) => `May ${i + 1} – Jun ${i + 4}`);
    el.populate({ labels, series: [labels.map((_, i) => i)] });
    await window.__settled();
    const sr = el.shadowRoot!;
    const ctm = sr.querySelector<SVGSVGElement>('.svg')!.getScreenCTM()!;
    const xs = [...sr.querySelector<SVGPolylineElement>('polyline.line')!.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(ctm).x);
    const els = [...sr.querySelectorAll<HTMLElement>('.x-label')];
    const boxes = els.map((l) => l.getBoundingClientRect());
    return {
      truncated: els.every((l) => l.scrollWidth > l.clientWidth && getComputedStyle(l).textOverflow === 'ellipsis'),
      centres: boxes.slice(1, -1).map((b, i) => Math.abs((b.left + b.right) / 2 - xs[i + 1]!)),
      apart: boxes.every((b, i) => i === 0 || boxes[i - 1]!.right <= b.left + 0.5),
    };
  });
  expect(r.truncated).toBe(true);
  for (const c of r.centres) expect(c).toBeLessThan(1);
  expect(r.apart).toBe(true);
});
