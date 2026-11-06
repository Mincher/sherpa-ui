import { test, expect, type Page } from './harness';

/**
 * A panel area's EDGE LINE, read as pixels (Will, TODO 851). A tabbed area draws it on its inner edge;
 * an area whose panels are ALL minimised, its tab standing on the layout's edge, draws it down that edge,
 * where the nav (a start area) or the window (an end area) meets it. Measured in the shell's areas and in a
 * canvas, on the start side and the end side. TRAP T-an-area-with-two-panels-is-tabbed
 */

type Rgb = [number, number, number];
const BORDER: Rgb = [179, 179, 195];
const W = 1500;
const H = 800;

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
async function pixel(page: Page, x: number, y: number): Promise<Rgb> {
  const shot = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3) as Rgb;
  }, shot.toString('base64'));
}
const near = (a: Rgb, b: Rgb): boolean => Math.max(...a.map((v, i) => Math.abs(v - b[i]!))) <= 12;

type Where = 'shell-end' | 'shell-start' | 'canvas';
/** Two overlay panels in one area, or one: in the shell's start or end area, or a canvas's start area. */
async function stage(page: Page, where: Where, panels: 1 | 2): Promise<void> {
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(async ([w, n]) => {
    const root = document.getElementById('root')!;
    const one = (id: string, extra: string) => `<sherpa-overlay-panel id="${id}" data-heading="${id}" open data-minimisable ${extra}><p>${id}</p></sherpa-overlay-panel>`;
    if (w === 'canvas') {
      root.style.cssText = 'position: absolute; left: 40px; top: 40px';
      root.innerHTML = `<sherpa-layout-canvas id="host" style="inline-size: 1000px; block-size: 600px">${one('a', 'slot="panel"')}${n === 2 ? one('b', 'slot="panel"') : ''}</sherpa-layout-canvas>`;
    } else {
      const side = w === 'shell-start' ? 'start' : 'end';
      root.innerHTML = `<sherpa-app-shell id="host" data-no-nav style="block-size: ${innerHeight}px"><div slot="header" style="block-size: 40px">H</div><div>C</div></sherpa-app-shell>${one('a', `data-fixed="${side}"`)}${n === 2 ? one('b', `data-fixed="${side}"`) : ''}`;
    }
    await window.__settled();
    if (w !== 'canvas') for (const id of n === 2 ? ['a', 'b'] : ['a']) (document.getElementById(id) as HTMLElement & { show(): void }).show();
  }, [where, panels] as const);
  await settle(page);
}
/** The layout's box and its area's, in the page. */
const boxes = (page: Page) => page.evaluate(() => {
  const host = document.getElementById('host')!;
  const lp = (host.localName === 'sherpa-layout-canvas' ? host.shadowRoot!.querySelector('sherpa-layout-panels') : host.shadowRoot!.querySelector('sherpa-layout-panels'))!;
  const area = lp.shadowRoot!.querySelector(host.localName === 'sherpa-layout-canvas' || document.getElementById('a')!.getAttribute('data-fixed') === 'start' ? '.area-start' : '.area-end')!;
  const l = lp.getBoundingClientRect();
  const a = area.getBoundingClientRect();
  return { layout: { left: l.left, right: l.right, top: l.top }, area: { left: a.left, right: a.right, top: a.top } };
});

for (const where of ['shell-end', 'shell-start', 'canvas'] as const) {
  const start = where !== 'shell-end';
  test(`${where}: two panels, a tab each: the area's inner edge is a line`, async ({ page }) => {
    await stage(page, where, 2);
    const { area } = await boxes(page);
    const x = Math.round(start ? area.right - 1 : area.left);
    expect(near(await pixel(page, x, Math.round(area.top) + 300), BORDER), 'the line on the inner edge').toBe(true);
    expect(near(await pixel(page, x + (start ? 3 : -3), Math.round(area.top) + 300), BORDER), 'and not beside it').toBe(false);
  });

  test(`${where}: every panel minimised, its tab on the edge: a line runs down that edge, and goes when one opens`, async ({ page }) => {
    await stage(page, where, 1);
    await page.evaluate(() => document.getElementById('a')!.setAttribute('data-minimised', ''));
    await settle(page);
    const { layout, area } = await boxes(page);
    const y = Math.round(area.top) + 400;
    const x = Math.round(start ? layout.left : layout.right - 1);
    expect(near(await pixel(page, x, y), BORDER), 'the line down the edge the tab stands on').toBe(true);
    expect(near(await pixel(page, x + (start ? 6 : -6), y), BORDER), 'and the page beside it is bare').toBe(false);
    await page.evaluate(() => document.getElementById('a')!.removeAttribute('data-minimised'));
    await settle(page);
    const open = await boxes(page);
    // Open, the divider is the panel's own edge, on its inner side; the outer edge has none.
    expect(near(await pixel(page, Math.round(start ? open.layout.left : open.layout.right - 1), y), BORDER), 'no line on the outer edge while open').toBe(false);
  });
}

test('ANY panel in tab mode draws the line, even a single one: one tab beside a floating panel, in a canvas', async ({ page }) => {
  await stage(page, 'canvas', 2);
  await page.evaluate(() => {
    document.getElementById('a')!.setAttribute('data-floating', '');
    document.getElementById('b')!.setAttribute('data-minimised', '');
  });
  await settle(page);
  const { layout, area } = await boxes(page);
  expect(near(await pixel(page, Math.round(layout.left), Math.round(area.top) + 400), BORDER), 'the line, with a tab and a floating panel').toBe(true);
  // The tab goes with its panel: only a floating one is left, the area is its room, and there is no tab, so no line.
  await page.evaluate(() => document.getElementById('b')!.remove());
  await settle(page);
  expect(near(await pixel(page, Math.round(layout.left), Math.round(area.top) + 400), BORDER), 'no tab, no line').toBe(false);
});
