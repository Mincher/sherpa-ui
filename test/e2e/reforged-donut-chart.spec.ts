import { test, expect } from './harness';

/** sherpa-donut-chart — one closed SVG ring-segment path per slice; centre label; pie variant. */

/**
 * The SHARE of the circle a slice's path sweeps, as a rounded percentage.
 *
 * Read from the path's own `d` — its FIRST and LAST point are both on the
 * slice's leading edge (the outline closes back where it started), so the angle
 * from the centre to the first point and to the outer arc's end bracket the
 * sweep. Deliberately not a check on the numbers the TS put in: a stroked circle
 * could be asserted through `stroke-dasharray`, but a path has no such handle,
 * and reading the drawn geometry back is the stronger test either way.
 */
const SHARE_FN = `(el) => {
  // Every command's ENDPOINT is its last two numbers. A naive "two numbers in a
  // row" scan is wrong: an arc command reads \\u0060A rx ry rot large sweep x y\\u0060, so
  // its radii would be picked up as a point.
  const ends = el.getAttribute('d').trim().split(/(?=[A-Za-z])/).map((cmd) => {
    const n = cmd.match(/-?[\\d.]+/g);
    return n && n.length >= 2 ? [Number(n[n.length - 2]), Number(n[n.length - 1])] : null;
  }).filter(Boolean);
  const angle = ([x, y]) => ((Math.atan2(x - 50, 50 - y) * 180) / Math.PI + 360) % 360;
  // Measured across the two RADIAL EDGES, which lie exactly on the slice's start
  // and end angle. NOT across the outer arc: the rounded corners inset that arc
  // at each end, so it reads short. The path opens on the leading edge (command
  // 0) and returns to the trailing edge five commands later (move, line, corner,
  // arc, corner, line).
  let sweep = angle(ends[5]) - angle(ends[0]);
  if (sweep <= 0) sweep += 360;
  return Math.round((sweep / 360) * 100);
}`;


test('draws one real SVG path per slice, spanning its share', async ({ page }) => {
  const r = await page.evaluate(async (shareSrc) => {
    const share = eval(shareSrc) as (el: SVGPathElement) => number;
    const el = document.createElement('sherpa-donut-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    el.setAttribute('data-label', '120');
    el.setAttribute('data-sublabel', 'total');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { label: 'A', value: 60 }, // 50%
      { label: 'B', value: 30 }, // 25%
      { label: 'C', value: 30 }, // 25%
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const arcs = Array.from(sr.querySelectorAll<SVGPathElement>('.slice'));
    const box = arcs[0]!.getBBox();
    return {
      count: arcs.length,
      // A <path> cloned from an HTML <template> without an <svg> wrapper is an
      // HTMLUnknownElement in the XHTML namespace: it clones, appends and reports
      // attributes without error, and paints NOTHING. Assert the namespace.
      namespace: arcs[0]?.namespaceURI,
      painted: arcs.every((a) => a.getBoundingClientRect().width > 0),
      // A CLOSED path, so it carries both paints Figma gives a slice — which is
      // the whole reason it is no longer a stroked circle.
      fill: getComputedStyle(arcs[0]!).fill,
      fillOpacity: getComputedStyle(arcs[0]!).fillOpacity,
      stroke: getComputedStyle(arcs[0]!).stroke,
      strokeWidth: Number(arcs[0]?.getAttribute('stroke-width')),
      // The first slice runs from 12 o'clock clockwise, so its box reaches the
      // ring's outer edge at the top and its centre — the band's inner radius.
      outer: Math.round(50 - box.y),
      shares: arcs.map(share),
      // The first slice STARTS at 12 o'clock — Figma's startingAngle -1.5708 rad.
      // No transform any more: a rotation would skew the rounded corners.
      transform: arcs[0]?.getAttribute('transform'),
      startsAtTop: Math.round(Number(/M ([-\d.]+) /.exec(arcs[0]!.getAttribute('d')!)![1])),
      value: sr.querySelector('.value')!.textContent,
      sub: sr.querySelector('.sub')!.textContent,
    };
  }, SHARE_FN);

  expect(r.count).toBe(3);
  // The namespace IS the test — see the comment above.
  expect(r.namespace).toBe('http://www.w3.org/2000/svg');
  expect(r.painted).toBe(true);

  // Figma paints a slice as a 60% fill with a solid 1px stroke on every edge. A
  // stroked circle could carry only ONE of those; a closed path carries both.
  // fill-opacity is 1: the 50% lives in the series TOKEN, and a fill-opacity
  // here would multiply it down.
  expect(r.fillOpacity).toBe('1');
  // The stroke is the series' BORDER token, NOT the fill — a slice's fill moves
  // along its ramp while its outline stays put, which is what keeps a translucent
  // mark legible on any surface. They used to be the same value.
  expect(r.fill).not.toBe(r.stroke);
  // Both must RESOLVE: an undefined custom property paints nothing, with no error.
  expect(r.fill).not.toBe('rgb(0, 0, 0)');
  expect(r.stroke).not.toBe('rgb(0, 0, 0)');
  // The fill carries the 60% tint; the border is SOLID.
  expect(r.stroke).not.toMatch(/\/ 0\./);
  expect(r.strokeWidth).toBe(0.5);

  // Figma: arcData.innerRadius 0.7, so the band is the outer 30% of the radius.
  // The path is inset half a stroke so the stroke lands INSIDE: 50 - 0.25.
  expect(r.outer).toBe(50);

  // 50 / 25 / 25, read back off the drawn paths.
  expect(r.shares).toEqual([50, 25, 25]);
  // No rotation: the path is drawn where it belongs, starting at 12 o'clock
  // (x = the centre, 50).
  expect(r.transform).toBe(null);
  expect(r.startsAtTop).toBe(50);

  expect(r.value).toBe('120');
  expect(r.sub).toBe('total');
});

test('pie variant fills to the centre (no hole)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const build = async (variant?: string): Promise<Record<string, number>> => {
      const el = document.createElement('sherpa-donut-chart') as HTMLElement & {
        rendered?: Promise<void>;
        populate?: (d: unknown) => void;
      };
      if (variant) el.setAttribute('data-type', variant);
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      // Four slices, so the wedge measured below is a clean quarter. A single
      // slice would sweep the whole circle, whose path is the special-cased pair
      // of rings and carries no radial edges at all.
      el.populate!([
        { label: 'A', value: 1 },
        { label: 'B', value: 1 },
        { label: 'C', value: 1 },
        { label: 'D', value: 1 },
      ]);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const d = el.shadowRoot!.querySelector<SVGPathElement>('.slice')!.getAttribute('d')!;
      // The RADII of every arc command in the path — \u0060A rx ry rot large sweep x y\u0060.
      // A donut segment traces an inner arc as well as an outer one and so has a
      // second large radius; a pie wedge runs to a point and has only the outer.
      // The corner arcs are the small ones, so they filter out by size.
      const radii = [...d.matchAll(/A ([\d.]+) /g)]
        .map((m) => Math.round(Number(m[1])))
        .filter((n) => n > 2);
      return {
        outer: Math.max(...radii),
        // 0 when there is no inner arc at all — the pie.
        inner: radii.length > 1 ? Math.min(...radii) : 0,
      };
    };
    return { donut: await build(), pie: await build('pie') };
  });

  // Donut: the band is the outer 30% of the radius (Figma innerRadius 0.7), so
  // the segment traces an inner arc at 35 as well as the rim at 50.
  expect(r.donut['outer']).toBe(50);
  expect(r.donut['inner']).toBe(35);

  // Pie: the wedge runs to a POINT at the centre, so there is no inner arc to
  // trace at all. No hole — and no mask, there is no mask any more.
  expect(r.pie['outer']).toBe(50);
  expect(r.pie['inner']).toBe(0);
});

test('the ring scales uniformly to whichever axis runs out first', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const make = async (w: string, h?: string): Promise<Record<string, number | boolean>> => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const box = document.createElement('div');
      box.style.inlineSize = w;
      if (h) box.style.blockSize = h;
      const el = document.createElement('sherpa-donut-chart') as HTMLElement & {
        rendered?: Promise<void>;
        populate(d: unknown): void;
      };
      box.appendChild(el);
      root.appendChild(box);
      await el.rendered;
      el.populate([{ label: 'A', value: 3 }, { label: 'B', value: 1 }]);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const ring = el.shadowRoot!.querySelector('.ring-wrap')!.getBoundingClientRect();
      return {
        w: Math.round(ring.width),
        h: Math.round(ring.height),
        square: Math.abs(ring.width - ring.height) < 1,
      };
    };
    return {
      wide: await make('600px'),
      narrow: await make('120px'),
      short: await make('600px', '140px'),
    };
  });

  // A CIRCLE, never an ellipse. One declaration plus aspect-ratio sizes both axes,
  // so they cannot disagree however the container is shaped.
  expect(r.wide['square']).toBe(true);
  expect(r.narrow['square']).toBe(true);
  expect(r.short['square']).toBe(true);

  // GROWS past the Figma 200 in a roomy container. That 200 is the MINIMUM drawn
  // size now, not a ceiling: capping there left a 200px ring adrift in a wide
  // card, which read as a half-empty panel rather than a deliberate one.
  expect(r.wide['w']).toBeGreaterThan(200);

  // …and shrinks below it when the container is genuinely narrower.
  expect(r.narrow['w']).toBe(120);
  expect(r.narrow['h']).toBe(120);

  // The SMALLER axis binds. Given 600 wide but only 140 tall, the ring takes the
  // height — a donut that filled the width there would be a 600px circle
  // overflowing its box.
  expect(r.short['w']).toBeLessThanOrEqual(140);
});

test('setSliceHidden drops a slice and re-shares the whole circle', async ({ page }) => {
  const r = await page.evaluate(async (shareSrc) => {
    const share = eval(shareSrc) as (el: SVGPathElement) => number;
    const el = document.createElement('sherpa-donut-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      setSliceHidden(i: number, hidden?: boolean): void;
      hiddenSlices: number[];
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { label: 'A', value: 50 },
      { label: 'B', value: 30 },
      { label: 'C', value: 20 },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const arcs = (): SVGPathElement[] =>
      Array.from(sr.querySelectorAll<SVGPathElement>('.slice'));
    /** Each slice's share of the circle, read back off its drawn path. */
    const shares = (): number[] => arcs().map(share);
    const hues = (): string[] =>
      arcs().map((a) => (a as unknown as HTMLElement).style.getPropertyValue('--_hue'));
    const indices = (): (string | undefined)[] => arcs().map((a) => a.dataset['index']);

    const before = { shares: shares(), hues: hues(), indices: indices() };
    el.setSliceHidden(0);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const hidden = { shares: shares(), hues: hues(), indices: indices(), list: el.hiddenSlices };
    el.setSliceHidden(0, false);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const restored = { shares: shares(), hues: hues(), list: el.hiddenSlices };
    return { before, hidden, restored };
  }, SHARE_FN);

  expect(r.before.shares).toEqual([50, 30, 20]);

  // One fewer arc, and the shares RE-SPREAD to fill the whole circle: a donut
  // shows parts of a whole, so hiding a slice must not leave a gap where it was.
  // 30 and 20 of the remaining 50 become 60 and 40.
  expect(r.hidden.shares).toEqual([60, 40]);
  expect(r.hidden.shares.reduce((a, b) => a + b, 0)).toBe(100);
  expect(r.hidden.list).toEqual([0]);
  // The surviving arcs keep their ORIGINAL data indices, so a click still reports
  // the right record and the hue does not shift along the ramp.
  expect(r.hidden.indices).toEqual(['1', '2']);
  expect(r.hidden.hues).toEqual([r.before.hues[1], r.before.hues[2]]);

  // Unhiding restores the original geometry and colour order exactly.
  expect(r.restored.shares).toEqual([50, 30, 20]);
  expect(r.restored.hues).toEqual(r.before.hues);
  expect(r.restored.list).toEqual([]);
});

/**
 * THE CENTRE TOTALS WHAT THE RING DRAWS.
 *
 * A hardcoded centre goes stale the moment a filter moves: the dashboard's
 * read "1,284" while the ring beneath it drew 881. Deriving it means the
 * number and the ring can never disagree.
 *
 * TRAP T-the-centre-totals-what-the-ring-draws
 */
test('the centre derives the total, follows a hidden slice, and yields to data-label', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (label?: string) => {
      const el = document.createElement('sherpa-donut-chart') as HTMLElement & {
        rendered?: Promise<void>;
        populate?: (d: unknown) => void;
        setSliceHidden?: (i: number, h?: boolean) => void;
      };
      if (label != null) el.setAttribute('data-label', label);
      document.getElementById('root')!.appendChild(el);
      await customElements.whenDefined('sherpa-donut-chart');
      await el.rendered;
      return el;
    };
    const centre = (el: HTMLElement) =>
      (el.shadowRoot!.querySelector('.value')?.textContent ?? '').trim();

    const data = [
      { label: 'A', value: 40, colorIndex: 1 },
      { label: 'B', value: 35, colorIndex: 2 },
      { label: 'C', value: 25, colorIndex: 3 },
    ];

    const derived = await mk();
    derived.populate!(data);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const total = centre(derived);

    // A hidden slice leaves the total, because the RING no longer counts it.
    derived.setSliceHidden!(0, true);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const afterHide = centre(derived);

    // A host that named its own centre keeps it.
    const named = await mk('Fleet');
    named.populate!(data);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    // Nothing drawn, nothing claimed.
    const empty = await mk();
    empty.populate!([]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { total, afterHide, named: centre(named), empty: centre(empty) };
  });

  expect(r.total).toBe('100');
  expect(r.afterHide).toBe('60');
  expect(r.named).toBe('Fleet');
  expect(r.empty).toBe('');
});
