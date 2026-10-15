import { test, expect } from './fixture';

/**
 * sherpa-sparkline on the reforged base — a compact trend chart drawn in CSS.
 * Proves the values → geometry bridge (each stamped shape carries its pair as
 * --_from / --_to, each dot its --_v; the host --_min / --_range — NOT JS
 * styling), that only what the data needs is stamped, the CSV/JSON data-values
 * parse, and populate([...]). TODO 283: no fixed slots in the CSS or HTML.
 */

const HARNESS = '/test/reforged/harness.html';

type SparkEl = HTMLElement & {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-sparkline'));
});


test('populate() stamps a shape per pair and sets --_min / --_range', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.populate!([10, 25, 15, 30]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    return {
      pairs: [...sr.querySelectorAll<HTMLElement>('.shape')].map((sh) =>
        [sh.style.getPropertyValue('--_from'), sh.style.getPropertyValue('--_to')]),
      dots: [...sr.querySelectorAll<HTMLElement>('.hotspot')].map((d) => d.style.getPropertyValue('--_v')),
      tips: [...sr.querySelectorAll('.chart-tip-value')].map((t) => t.textContent),
      min: el.style.getPropertyValue('--_min').trim(),
      range: el.style.getPropertyValue('--_range').trim(),
      valuesAttr: el.getAttribute('data-values'),
    };
  });
  // The JS→CSS-var geometry bridge: each shape holds ITS pair.
  expect(r.pairs).toEqual([['10', '25'], ['25', '15'], ['15', '30']]);
  expect(r.dots).toEqual(['10', '25', '15', '30']);
  expect(r.tips).toEqual(['10', '25', '15', '30']);
  // --_min / --_range are the PADDED normalisation window, not the raw extent.
  // Normalising to exactly min..max pinned the lowest point at 0% — flat on the
  // bottom edge — so the area fill had nothing to fill beneath it.
  //
  // The window is sized so the DATA occupies LINE_SHARE (0.62) of the box, with
  // 80% of the extra range going below the minimum (that is the fill) and the rest
  // above the peak. Spread 20 → extra 12.26 → min 10 − 9.806, range 32.26.
  expect(Number(r.min)).toBeCloseTo(0.1935, 2);
  expect(Number(r.range)).toBeCloseTo(32.26, 2);
  // …which leaves roughly a third of the box as fill beneath the lowest point.
  expect(((10 - Number(r.min)) / Number(r.range)) * 100).toBeCloseTo(30.4, 1);
  expect(r.valuesAttr).toBe('[10,25,15,30]'); // serialised to the source of truth
});

test('only what the data needs is stamped: 3 values, 2 shapes, 3 dots', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    el.setAttribute('data-values', '5,9,7');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const sr = el.shadowRoot!;
    return {
      shapes: [...sr.querySelectorAll<HTMLElement>('.shape')].filter((sh) => sh.checkVisibility()).length,
      points: sr.querySelectorAll('.shape .point').length,
      dots: sr.querySelectorAll('.hotspot').length,
      dataLen: el.hasAttribute('data-len'),
    };
  });
  expect(r.shapes).toBe(2);
  expect(r.points).toBe(4); // each shape draws its two ends
  expect(r.dots).toBe(3);
  expect(r.dataLen).toBe(false); // gone: nothing selects on a count now
});

test('data-type="bar" renders and normalises the same value bridge', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    el.setAttribute('data-type', 'bar');
    el.setAttribute('data-values', '1,4,2');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const first = el.shadowRoot!.querySelector<HTMLElement>('.shape');
    return {
      variant: el.getAttribute('data-type'),
      from: first?.style.getPropertyValue('--_from') ?? '',
      min: el.style.getPropertyValue('--_min').trim(),
      range: el.style.getPropertyValue('--_range').trim(),
    };
  });
  expect(r.variant).toBe('bar');
  expect(r.from).toBe('1');
  // The same padded window as the line variant (spread 3). Bars share the value
  // bridge; only the shape differs.
  expect(Number(r.min)).toBeCloseTo(-0.471, 2);
  expect(Number(r.range)).toBeCloseTo(4.839, 2);
});

test('empty values, or one, stamp nothing', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const count = async (values: number[]): Promise<number> => {
      const el = document.createElement('sherpa-sparkline') as SparkEl;
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      el.populate!(values);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return el.shadowRoot!.querySelectorAll('.shape, .hotspot').length;
    };
    return { empty: await count([]), one: await count([5]) };
  });
  // One value is no trend.
  expect(r).toEqual({ empty: 0, one: 0 });
});
