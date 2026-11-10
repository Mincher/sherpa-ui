import { test, expect } from './harness';

/**
 * sherpa-canvas: each element it holds stands at its --x and --y, through the view its attributes set; a press on its
 * blank goes on to what is under it. Asked (`data-drawn`), it draws into a real canvas where the engine can (Chrome 157
 * on), and lays out a plain layer where it cannot: the places are the same either way. Plan 852. TRAP T-a-canvas-draws-live-html
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-canvas id="c" data-drawn data-x="20" data-y="20" style="position: absolute; left: 0; top: 0; inline-size: 760px; block-size: 400px">'
      + '<sherpa-node id="a" data-heading="Source" data-icon="storage" data-output-socket="object" data-x="0" data-y="0"></sherpa-node>'
      + '<sherpa-node id="b" data-heading="Output" data-icon="flag" data-input-socket="object" data-x="320" data-y="80"></sherpa-node></sherpa-canvas>');
    const c = document.getElementById('c') as HTMLElement & { rendered: Promise<void> };
    await c.rendered;
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const box = (page: import('@playwright/test').Page, id: string) => page.evaluate((i) => {
  const r = document.getElementById(i)!.getBoundingClientRect();
  const c = document.getElementById('c')!.getBoundingClientRect();
  return [Math.round(r.x - c.x), Math.round(r.y - c.y)];
}, id);

test('each element stands at its place through the view; the view moves and scales it', async ({ page }) => {
  expect(await box(page, 'a')).toEqual([20, 20]);
  expect(await box(page, 'b')).toEqual([340, 100]);
  await page.evaluate(() => { const c = document.getElementById('c')!; c.setAttribute('data-x', '-100'); c.setAttribute('data-zoom', '0.5'); });
  await expect.poll(() => box(page, 'b')).toEqual([60, 60]);
});

test('a press where an element is reaches it; one on the blank goes on to what is under it', async ({ page }) => {
  const c = (await page.locator('#c').boundingBox())!;
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.id, [c.x + 340 + 60, c.y + 100 + 20])).toBe('b');
  // The blank: neither the canvas nor what it holds takes it.
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.localName, [c.x + 700, c.y + 380])).not.toMatch(/^sherpa-(canvas|node)$/);
});

test('asked, in Google Chrome it draws into a real canvas; the bundled engines lay out a plain layer', async ({ page }, info) => {
  const drawn = await page.evaluate(() => !!document.getElementById('c')!.shadowRoot!.querySelector('canvas[content="drawable"]'));
  expect(drawn).toBe(info.project.name === 'chrome');
});

test('not asked, it is a plain layer everywhere: the ask taken away re-stamps it, and nothing stays drawable', async ({ page }) => {
  const state = () => page.evaluate(() => {
    const c = document.getElementById('c')!;
    return { canvas: !!c.shadowRoot!.querySelector('canvas'), drawable: c.querySelectorAll('[drawable]').length };
  });
  await page.evaluate(() => document.getElementById('c')!.removeAttribute('data-drawn'));
  expect(await state()).toEqual({ canvas: false, drawable: 0 });
  await expect.poll(() => box(page, 'b')).toEqual([340, 100]);
});
