import { test, expect, type Page } from './harness';

/**
 * AN ON CHIP FILLS THE HALF THAT TOGGLES — Will, TODOs 667, 669, 697. A chip that
 * cannot be toggled (the View chip, a chart's Primary) never fills its field
 * label, but wears the on border on both halves. And the page may ask that an on chip's
 * value half wear the on BORDER only (`html[data-filter-value-border]`), so the
 * filled half is the one a press turns off. Read in PIXELS, never computed style.
 */

/** The colour a READER sees at one point of the page. */
async function pixelAt(page: Page, x: number, y: number): Promise<number[]> {
  const shot = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 2, height: 2 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, shot.toString('base64'));
}

/** The fill of each half, and each half's bottom border. */
async function halves(page: Page, id: string): Promise<{ body: number[]; caret: number[]; edge: number[]; bodyEdge: number[] }> {
  const boxes = await page.evaluate((chipId) => {
    const root = document.getElementById(chipId)!.shadowRoot!;
    const box = (sel: string) => {
      const r = root.querySelector(sel)!.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    return { body: box('.body'), caret: box('.caret') };
  }, id);
  // Clear of the text and the glyph: the body's top padding, the caret's start padding.
  return {
    body: await pixelAt(page, boxes.body.x + boxes.body.w / 2, boxes.body.y + 3),
    caret: await pixelAt(page, boxes.caret.x + 3, boxes.caret.y + boxes.caret.h / 2),
    // Its bottom border, a pixel in from its corner.
    edge: await pixelAt(page, boxes.caret.x + boxes.caret.w / 2, boxes.caret.y + boxes.caret.h - 1),
    bodyEdge: await pixelAt(page, boxes.body.x + boxes.body.w / 2, boxes.body.y + boxes.body.h - 1),
  };
}

const WHITE = [255, 255, 255];
const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) <= 6);

test('an on chip fills both halves; with the page\'s value border on, its value half keeps the plain fill and the on border', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.replaceChildren();
    await window.__mount('sherpa-quick-filter', undefined, { id: 'on', keep: true, 'data-label': 'Plan', 'data-menu': true, 'data-current': true });
    await window.__mount('sherpa-quick-filter', undefined, { id: 'off', keep: true, 'data-label': 'Plan', 'data-menu': true });
    await window.__settled();
  });
  const off = await halves(page, 'off');
  const on = await halves(page, 'on');
  // Off: the default white. On: both halves filled, the same fill.
  expect(near(off.body, WHITE) && near(off.caret, WHITE)).toBe(true);
  expect(near(on.body, WHITE)).toBe(false);
  expect(near(on.caret, on.body)).toBe(true);

  await page.evaluate(() => document.documentElement.setAttribute('data-filter-value-border', ''));
  await page.evaluate(() => window.__settled());
  const bordered = await halves(page, 'on');
  // The label half keeps its fill; the value half is white again, its border still the on one.
  expect(near(bordered.body, on.body)).toBe(true);
  expect(near(bordered.caret, WHITE)).toBe(true);
  expect(near(bordered.edge, off.edge)).toBe(false);
  await page.evaluate(() => document.documentElement.removeAttribute('data-filter-value-border'));
});

test('a chip that cannot be toggled never fills its field label, and both halves wear the on border (Will, TODO 697)', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.replaceChildren();
    await window.__mount('sherpa-quick-filter', undefined, { id: 'on', keep: true, 'data-label': 'Plan', 'data-menu': true, 'data-current': true });
    await window.__mount('sherpa-quick-filter', undefined, { id: 'fixed', keep: true, 'data-label': 'Plan', 'data-menu': true, 'data-current': true, 'data-persistent': true });
    await window.__settled();
  });
  const on = await halves(page, 'on');
  const fixed = await halves(page, 'fixed');
  expect(near(fixed.body, WHITE)).toBe(true);
  expect(near(fixed.caret, on.caret)).toBe(true);
  expect(near(fixed.bodyEdge, on.bodyEdge)).toBe(true);
  expect(near(fixed.bodyEdge, fixed.edge)).toBe(true);
});
