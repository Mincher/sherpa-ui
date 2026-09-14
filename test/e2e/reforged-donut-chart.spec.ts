import { test, expect } from '@playwright/test';

/** sherpa-donut-chart — composes a conic-gradient ring from slice shares; centre label; pie variant. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('draws one real SVG arc per slice, spanning its share', async ({ page }) => {
  const r = await page.evaluate(async () => {
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
    const arcs = Array.from(sr.querySelectorAll<SVGCircleElement>('.slice'));
    const radius = Number(arcs[0]?.getAttribute('r'));
    const circumference = 2 * Math.PI * radius;
    return {
      count: arcs.length,
      // A <circle> cloned from an HTML <template> without an <svg> wrapper is an
      // HTMLUnknownElement in the XHTML namespace: it clones, appends and reports
      // attributes without error, and paints NOTHING. Assert the namespace.
      namespace: arcs[0]?.namespaceURI,
      painted: arcs.every((a) => a.getBoundingClientRect().width > 0),
      radius,
      strokeWidth: Number(arcs[0]?.getAttribute('stroke-width')),
      // Each dash length is its share of the circumference, less the 1-unit gap.
      shares: arcs.map((a) =>
        Math.round((Number(a.getAttribute('stroke-dasharray')?.split(' ')[0]) + 1) / circumference * 100),
      ),
      // Rotations: 0% → -90deg (12 o'clock), then 50% and 75% round.
      rotations: arcs.map((a) => a.getAttribute('transform')),
      value: sr.querySelector('.value')!.textContent,
      sub: sr.querySelector('.sub')!.textContent,
    };
  });

  expect(r.count).toBe(3);
  // The namespace IS the test — see the comment above.
  expect(r.namespace).toBe('http://www.w3.org/2000/svg');
  expect(r.painted).toBe(true);

  // Figma: arcData.innerRadius 0.7, so the band is the outer 30% of the radius.
  // The stroke sits on the band's mid-line: inner 35 + width 15 / 2 = 42.5.
  expect(r.radius).toBe(42.5);
  expect(r.strokeWidth).toBe(15);

  // 50 / 25 / 25, and each arc starts where the last ended.
  expect(r.shares).toEqual([50, 25, 25]);
  expect(r.rotations[0]).toContain('rotate(-90');
  expect(r.rotations[1]).toContain('rotate(90');
  expect(r.rotations[2]).toContain('rotate(180');

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
      if (variant) el.setAttribute('data-variant', variant);
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      el.populate!([{ label: 'X', value: 1 }]);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const arc = el.shadowRoot!.querySelector('.slice')!;
      return { r: Number(arc.getAttribute('r')), w: Number(arc.getAttribute('stroke-width')) };
    };
    return { donut: await build(), pie: await build('pie') };
  });

  // Donut: a 15-wide band on the outer 30% of the radius (Figma innerRadius 0.7).
  expect(r.donut['r']).toBe(42.5);
  expect(r.donut['w']).toBe(15);

  // Pie: the band runs all the way in, so it is the full radius wide and its
  // mid-line sits at half the radius. No hole to mask — there is no mask any more.
  expect(r.pie['w']).toBe(50);
  expect(r.pie['r']).toBe(25);
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
  const r = await page.evaluate(async () => {
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
    const arcs = (): SVGCircleElement[] =>
      Array.from(sr.querySelectorAll<SVGCircleElement>('.slice'));
    /** Each arc's share of the circle, as a rounded percentage. */
    const shares = (): number[] => {
      const list = arcs();
      const circumference = 2 * Math.PI * Number(list[0]?.getAttribute('r') ?? 1);
      return list.map((a) =>
        Math.round((Number(a.getAttribute('stroke-dasharray')?.split(' ')[0]) + 1) / circumference * 100),
      );
    };
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
  });

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
