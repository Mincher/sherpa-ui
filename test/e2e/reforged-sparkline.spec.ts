import { test, expect } from './harness';

/**
 * sherpa-sparkline on the reforged base — a compact trend chart drawn in CSS.
 * Proves the values → geometry bridge (each stamped shape carries its pair as
 * --_from / --_to, each dot its --_v; the host --_min / --_range — NOT JS
 * styling), that only what the data needs is stamped, the CSV/JSON data-values
 * parse, and populate([...]). TODO 283: no fixed slots in the CSS or HTML.
 */

type SparkEl = HTMLElement & {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => customElements.whenDefined('sherpa-sparkline'));
});


test('populate() stamps a shape per pair and sets --_min / --_range', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.populate!([10, 25, 15, 30]);
    await window.__settled();

    const sr = el.shadowRoot!;
    return {
      pairs: [...sr.querySelectorAll<HTMLElement>('.shape')].map((sh) =>
        [sh.style.getPropertyValue('--_from'), sh.style.getPropertyValue('--_to')]),
      dots: [...sr.querySelectorAll<HTMLElement>('.hotspot')].map((d) => d.style.getPropertyValue('--_v')),
      tips: [...sr.querySelectorAll('.sherpa-tip-value')].map((t) => t.textContent),
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
    await window.__settled();
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

test('a point\'s tooltip says its time span (TODO 540)', async ({ page }) => {
  const tips = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    el.setAttribute('data-values', '5,9,7');
    el.setAttribute('data-labels', JSON.stringify(['Mon 2 Mar', 'Tue 3 Mar', 'Wed 4 Mar']));
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await window.__settled();
    return [...el.shadowRoot!.querySelectorAll('.sherpa-tip-value')].map((t) => t.textContent);
  });
  expect(tips).toEqual(['Mon 2 Mar: 5', 'Tue 3 Mar: 9', 'Wed 4 Mar: 7']);
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
      await window.__settled();
      return el.shadowRoot!.querySelectorAll('.shape, .hotspot').length;
    };
    return { empty: await count([]), one: await count([5]) };
  });
  // One value is no trend.
  expect(r).toEqual({ empty: 0, one: 0 });
});

test('the fill shows no seam where the chart starts on a part pixel', async ({ page }) => {
  // TODO 323: pieces per pair left a pale column at each point. TRAP T-a-trend-line-is-one-shape
  const box = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.style.cssText = 'padding: 8px 0 0 8.5px; background: #fff';
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    el.style.cssText = 'display: block; inline-size: 113px; block-size: 40px';
    el.setAttribute('data-values', '3,9,4,12,7,15,10,14');
    root.appendChild(el);
    await el.rendered;
    await window.__settled();
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const png = await page.screenshot({ clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) } });
  const weakest = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    // Ink per column over the bottom fifth, where the fill covers every column.
    const ink: number[] = [];
    for (let x = 3; x < c.width - 4; x++) {
      let sum = 0;
      for (let y = Math.floor(c.height * 0.8); y < c.height - 1; y++) {
        const i = (y * c.width + x) * 4;
        sum += 765 - (d[i]! + d[i + 1]! + d[i + 2]!);
      }
      ink.push(sum);
    }
    const median = [...ink].sort((a, b) => a - b)[Math.floor(ink.length / 2)]!;
    return Math.min(...ink) / median;
  }, png.toString('base64'));
  expect(weakest).toBeGreaterThan(0.85);
});
