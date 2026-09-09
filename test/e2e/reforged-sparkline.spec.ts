import { test, expect } from '@playwright/test';

/**
 * sherpa-sparkline on the reforged base — a compact CSS-only trend chart. Proves
 * the values → geometry bridge (raw numbers written to --_v0..--_v7 + --_min /
 * --_range custom properties, NOT JS styling), the CSS-owned (data-len) collapse
 * of unused segments/points, the CSV/JSON data-values parse, and populate([...]).
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

test('populate() sets the --_v / --_min / --_range custom properties', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.populate!([10, 25, 15, 30]);
    await new Promise((res) => setTimeout(res, 10));

    return {
      v0: el.style.getPropertyValue('--_v0').trim(),
      v1: el.style.getPropertyValue('--_v1').trim(),
      v2: el.style.getPropertyValue('--_v2').trim(),
      v3: el.style.getPropertyValue('--_v3').trim(),
      min: el.style.getPropertyValue('--_min').trim(),
      range: el.style.getPropertyValue('--_range').trim(),
      // Slots beyond the data length are cleared.
      v4: el.style.getPropertyValue('--_v4').trim(),
      valuesAttr: el.getAttribute('data-values'),
    };
  });
  // The JS→CSS-var geometry bridge.
  expect(r.v0).toBe('10');
  expect(r.v1).toBe('25');
  expect(r.v2).toBe('15');
  expect(r.v3).toBe('30');
  expect(r.min).toBe('10'); // min of the series
  expect(r.range).toBe('20'); // 30 - 10
  expect(r.v4).toBe(''); // unused slot cleared
  expect(r.valuesAttr).toBe('[10,25,15,30]'); // serialised to the source of truth
});

test('unused segments and points collapse via CSS (data-len)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    el.setAttribute('data-values', '5,9,7'); // 3 points → 2 live segments
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const shapes = Array.from(el.shadowRoot!.querySelectorAll('.shape')) as HTMLElement[];
    const points = Array.from(el.shadowRoot!.querySelectorAll('.point')) as HTMLElement[];
    // Visibility is CSS-owned via :host([data-len="N"]); a point inside a
    // collapsed shape is not visible either, so checkVisibility() is the truth.
    return {
      dataLen: el.getAttribute('data-len'),
      liveShapes: shapes.filter((s) => s.checkVisibility()).length,
      hiddenShapes: shapes.filter((s) => !s.checkVisibility()).length,
      // Vertex points that actually render (within a live shape).
      livePointIndexes: points
        .filter((p) => p.checkVisibility())
        .map((p) => Number(p.dataset['index']))
        .sort((a, b) => a - b),
    };
  });
  expect(r.dataLen).toBe('3'); // host reflects the value count
  expect(r.liveShapes).toBe(2); // 3 points → 2 segments (index < len-1)
  expect(r.hiddenShapes).toBe(5); // 7 shapes total − 2 live
  // Points inside the 2 live shapes: shape0 → idx 0,1; shape1 → idx 1,2.
  expect(r.livePointIndexes).toEqual([0, 1, 1, 2]);
});

test('data-variant="bar" renders and normalises the same value bridge', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    el.setAttribute('data-variant', 'bar');
    el.setAttribute('data-values', '1,4,2');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return {
      variant: el.getAttribute('data-variant'),
      v0: el.style.getPropertyValue('--_v0').trim(),
      min: el.style.getPropertyValue('--_min').trim(),
      range: el.style.getPropertyValue('--_range').trim(),
    };
  });
  expect(r.variant).toBe('bar');
  expect(r.v0).toBe('1');
  expect(r.min).toBe('1');
  expect(r.range).toBe('3'); // 4 - 1
});

test('empty values leave every shape/point hidden', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as SparkEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([]); // empty
    await new Promise((res) => setTimeout(res, 10));

    // data-len="0" → CSS collapses every shape and point.
    const shapes = Array.from(el.shadowRoot!.querySelectorAll('.shape')) as HTMLElement[];
    const points = Array.from(el.shadowRoot!.querySelectorAll('.point')) as HTMLElement[];
    return {
      dataLen: el.getAttribute('data-len'),
      anyVisible: shapes.some((s) => s.checkVisibility()) || points.some((p) => p.checkVisibility()),
    };
  });
  expect(r.dataLen).toBe('0');
  expect(r.anyVisible).toBe(false);
});
