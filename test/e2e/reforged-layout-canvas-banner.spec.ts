import { test, expect } from './harness';

/**
 * sherpa-layout-canvas's `banner` slot — Will, TODO 766: "The canvas for the node editor should
 * support a floating banner for available reloads like we have in the layout grid." A banner
 * floats across the top, 32px in, over the plane: it never pans or zooms, a hidden one takes no
 * room, two shown stack, and it keeps clear of a panel card and of the controls and minimap.
 * TRAP T-a-canvas-owns-its-view
 */
type Canvas = HTMLElement & {
  rendered: Promise<void>;
  view: { x: number; y: number; zoom: number };
  panTo(x: number, y: number): void;
  zoomTo(zoom: number): void;
};
type Box = { left: number; top: number; right: number; bottom: number };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1500px; block-size: 600px">
        <sherpa-callout id="app" slot="banner" data-type="banner" data-status="info" data-dismissible hidden>
          A new version is ready. <sherpa-button data-size="sm" data-look="transparent" data-label="Reload"></sherpa-button>
        </sherpa-callout>
        <sherpa-callout id="data" slot="banner" data-type="banner" data-status="info" data-dismissible hidden>
          Newer data is waiting.
        </sherpa-callout>
        <div id="a" style="--x: 0px; --y: 0px; inline-size: 1500px; block-size: 200px">A</div>
        <div id="b" style="--x: 600px; --y: 400px; inline-size: 100px; block-size: 50px">B</div>
        <div id="c" style="--x: 900px; --y: 400px; inline-size: 100px; block-size: 50px">C</div>
      </sherpa-layout-canvas>`);
    const cv = document.getElementById('cv') as Canvas;
    await cv.rendered;
    await window.__settled();
  });
});

/** The boxes that matter, read back from the page. */
const read = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const cv = document.getElementById('cv')!;
  const box = (e: Element | null): Box | null => {
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  };
  const sr = cv.shadowRoot!;
  return {
    canvas: box(cv)!, app: box(cv.querySelector('#app')), data: box(cv.querySelector('#data')),
    strip: box(sr.querySelector('.banner')), panel: box(cv.querySelector('[slot="panel"]')),
    controls: box(sr.querySelector('.controls'))!, minimap: box(sr.querySelector('.minimap'))!,
    items: sr.querySelectorAll('.minimap-item').length,
  };
});
const show = (page: import('@playwright/test').Page, ids: string[]) => page.evaluate(async (shown) => {
  for (const el of document.querySelectorAll<HTMLElement>('#cv > sherpa-callout')) el.hidden = !shown.includes(el.id);
  await window.__settled();
}, ids);
const hit = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test('hidden, a banner takes no room; shown, it floats across the top, 32px in; two stack, 8px apart', async ({ page }) => {
  let r = await read(page);
  expect([r.strip!.bottom - r.strip!.top, r.app!.bottom - r.app!.top, r.data!.bottom - r.data!.top], 'nothing shown').toEqual([0, 0, 0]);
  // The banners are no content: the minimap draws the three pieces alone.
  expect(r.items).toBe(3);
  await show(page, ['data']);
  r = await read(page);
  const data = r.data!;
  expect([data.top - r.canvas.top, data.left - r.canvas.left, r.canvas.right - data.right].map(Math.round), 'across: 32px down, 64px in from each side, clear of the panel tabs').toEqual([32, 64, 64]);
  await show(page, ['app', 'data']);
  r = await read(page);
  expect(Math.round(r.app!.top - r.canvas.top), 'the first leads').toBe(32);
  expect(Math.round(r.data!.top - r.app!.bottom), 'the second under it').toBe(8);
  expect([r.data!.left, r.data!.right]).toEqual([r.app!.left, r.app!.right]);
});

test('over the plane: it paints over the content under it, and holds still as the view pans and zooms', async ({ page }) => {
  await show(page, ['app']);
  const r = await page.evaluate(() => {
    const cv = document.getElementById('cv') as Canvas;
    const app = cv.querySelector('#app')!;
    const at = () => { const b = app.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round).join(); };
    const b = app.getBoundingClientRect();
    // Content #a lies under the banner's whole row.
    const top = document.elementFromPoint(b.left + 8, b.top + b.height / 2)?.closest('sherpa-callout, #a')?.id;
    const before = at();
    cv.panTo(cv.view.x + 300, cv.view.y + 200);
    const panned = at();
    cv.zoomTo(3);
    return { top, held: panned === before && at() === before, zoomed: cv.view.zoom };
  });
  expect(r).toEqual({ top: 'app', held: true, zoomed: 3 });
});

test('beside a panel card: the banners keep clear of it, and of the controls and minimap, at 1500px and 600px', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('cv')!.insertAdjacentHTML('beforeend', '<div slot="panel" style="background: #eee">Nodes</div>');
    await window.__settled();
  });
  await show(page, ['app', 'data']);
  for (const width of [1500, 600]) {
    await page.evaluate(async (w) => {
      document.getElementById('cv')!.style.inlineSize = `${w}px`;
      await window.__settled();
    }, width);
    const r = await read(page);
    const panel = r.panel!;
    for (const banner of [r.app!, r.data!]) {
      // The card is inset 16px in its area, and the banners stand 64px in from the area's edge, clear of the tabs. TODO 871
      expect(Math.round(banner.left - panel.right), `${width}: past the card`).toBe(80);
      expect(Math.round(r.canvas.right - banner.right), `${width}: 64px in from the right`).toBe(64);
      expect(hit(banner, panel), `${width}: banner x panel`).toBe(false);
      expect(hit(banner, r.controls), `${width}: banner x controls`).toBe(false);
      expect(hit(banner, r.minimap), `${width}: banner x minimap`).toBe(false);
    }
  }
});
