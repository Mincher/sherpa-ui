import { test, expect, type Page } from './harness';

/**
 * An overlay panel SLOTTED into a canvas's `panel` slot is docked there by its markup (Will, TODO 846): flush
 * in the canvas's start area with no shadow; Float lifts it 16px in and it floats INSIDE the canvas, never past
 * it, the area giving its width back; Dock puts it back; Minimise makes a tab on the canvas's left edge, inside
 * it; a badge slot sits beside the title; and `panel-close` says why it shut. Real pointer; boxes and pixels.
 * TRAP T-a-panel-slotted-in-a-layout-is-docked-there
 */

type Box = { x: number; y: number; w: number; h: number };
const W = 1400;
const H = 900;
const AT = { x: 160, y: 120 };
const CANVAS = { w: 900, h: 600 };

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(async ({ at, size }) => {
    const root = document.getElementById('root')!;
    root.style.cssText = `position: absolute; left: ${at.x}px; top: ${at.y}px`;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: ${size.w}px; block-size: ${size.h}px">
        <sherpa-overlay-panel id="nodes" slot="panel" open data-heading="Nodes" data-icon="circle-nodes" data-floatable data-minimisable>
          <sherpa-badge slot="badge" id="count" aria-label="3 filters">3</sherpa-badge>
          <p>The list</p>
        </sherpa-overlay-panel>
      </sherpa-layout-canvas>`);
    await customElements.whenDefined('sherpa-overlay-panel');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const heard: unknown[] = [];
    (window as unknown as { __heard: unknown[] }).__heard = heard;
    for (const type of ['panel-float', 'panel-minimise', 'panel-close']) {
      document.getElementById('nodes')!.addEventListener(type, (e) => heard.push({ [type]: (e as CustomEvent).detail }));
    }
    await window.__settled();
  }, { at: AT, size: CANVAS });
  await settle(page);
});

const rect = (page: Page, sel: string, host = 'nodes'): Promise<Box> => page.evaluate(([s, h]) => {
  const el = h === 'cv' ? document.getElementById('cv')! : document.getElementById(h!)!;
  const r = (s ? el.shadowRoot!.querySelector(s)! : el).getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}, [sel, host]);
const style = (page: Page, sel: string, prop: string) => page.evaluate(([s, p]) =>
  getComputedStyle(document.getElementById('nodes')!.shadowRoot!.querySelector(s!)!).getPropertyValue(p!), [sel, prop]);
const centre = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
async function press(page: Page, sel: string): Promise<void> {
  const [x, y] = centre(await rect(page, sel));
  await page.mouse.click(x, y);
  await settle(page);
}
async function drag(page: Page, from: [number, number], by: [number, number]): Promise<void> {
  const to = [Math.min(W - 2, Math.max(2, from[0] + by[0])), Math.min(H - 2, Math.max(2, from[1] + by[1]))] as const;
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(to[0], to[1], { steps: 4 });
  await page.mouse.up();
  await settle(page);
}

test('slotted in a canvas it is docked as a card 16px in, with no shadow, its width the canvas\'s area; a badge sits beside its title', async ({ page }) => {
  const cv = await rect(page, '', 'cv');
  const root = await rect(page, '.root');
  expect(root).toEqual({ x: cv.x + 16, y: cv.y + 16, w: root.w, h: cv.h - 32 });
  expect(root.w).toBeGreaterThanOrEqual(256);
  expect(await style(page, '.root', 'box-shadow')).toBe('none');
  expect(await style(page, '.root', 'position')).toBe('static');
  // The canvas's content takes what is left of it.
  expect((await rect(page, '.stage', 'cv')).x).toBe(cv.x + root.w + 32);
  // The badge is in the header's title row, past the title.
  const [title, badge] = await page.evaluate(() => {
    const header = document.getElementById('nodes')!.shadowRoot!.querySelector('.header')!;
    const t = header.shadowRoot!.querySelector('.title')!.getBoundingClientRect();
    const b = document.getElementById('count')!.getBoundingClientRect();
    return [t, b].map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }));
  });
  expect(badge!.w).toBeGreaterThan(0);
  expect(badge!.x).toBeGreaterThanOrEqual(title!.x + title!.w - 1);
  expect(Math.abs((badge!.y + badge!.h / 2) - (title!.y + title!.h / 2))).toBeLessThanOrEqual(4);
});

test('Float lifts it 16px in and it floats INSIDE the canvas, never past it; the area gives its width back; Dock puts it back', async ({ page }) => {
  const cv = await rect(page, '', 'cv');
  const docked = await rect(page, '.root');
  await press(page, '.float');
  const lifted = await rect(page, '.root');
  // Never under the panel floor, 20rem: a card of 18rem lifts to it.
  expect(lifted).toEqual({ x: docked.x + 16, y: docked.y + 16, w: Math.max(320, docked.w - 32), h: docked.h - 32 });
  expect(await style(page, '.root', 'position')).toBe('absolute');
  expect((await rect(page, '.stage', 'cv')).x).toBe(cv.x);
  // Dragged far past the canvas's corner: it stops at the canvas's edge, not the window's.
  const head = await rect(page, '.header');
  await page.evaluate(() => document.getElementById('nodes')!.setAttribute('data-height', '300'));
  await settle(page);
  await drag(page, [head.x + 110, head.y + head.h / 2], [3000, 3000]);
  const far = await rect(page, '.root');
  expect([far.x + far.w, far.y + far.h]).toEqual([cv.x + cv.w, cv.y + cv.h]);
  // The canvas beside it is the canvas's: a point past the box is the canvas.
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.id, [cv.x + 40, cv.y + 40])).toBe('cv');
  await press(page, '.float');
  expect(await rect(page, '.root')).toEqual(docked);
  expect((await page.evaluate(() => (window as unknown as { __heard: unknown[] }).__heard))).toEqual([
    { 'panel-float': { floating: true } }, { 'panel-float': { floating: false } },
  ]);
});

test('Minimise makes a tab on the canvas\'s LEFT edge, inside it; the area gives its width back; the tab opens it as it was', async ({ page }) => {
  const cv = await rect(page, '', 'cv');
  await press(page, '.minimise');
  const tab = await rect(page, '.tab');
  expect(tab.x).toBe(cv.x + 16);
  expect(tab.y).toBeGreaterThanOrEqual(cv.y);
  expect(tab.y + tab.h).toBeLessThanOrEqual(cv.y + cv.h);
  expect(await style(page, '.root', 'display')).toBe('none');
  expect((await rect(page, '.stage', 'cv')).x).toBe(cv.x);
  await page.mouse.click(...centre(tab));
  await settle(page);
  // A press on the tab shows the panel as an OVERLAY (a third of the canvas at most); Dock as fixed puts it back in its area.
  expect((await rect(page, '.root')).h).toBe(cv.h);
  await press(page, '.dock-fixed');
  expect(await style(page, '.root', 'display')).not.toBe('none');
  expect(await page.evaluate(() => document.getElementById('nodes')!.hasAttribute('data-minimised'))).toBe(false);
});

test('panel-close says why it shut: the reader by default, the width or the page when it is told', async ({ page }) => {
  const act = (what: string) => page.evaluate(async (w) => {
    const p = document.getElementById('nodes') as HTMLElement & { hide(r?: string): void; show(): void };
    if (w === 'show') p.show(); else p.hide(w === 'width' ? 'width' : undefined);
    await new Promise((done) => setTimeout(done, 80));
  }, what);
  await act('hide');
  await act('show');
  await act('width');
  expect((await page.evaluate(() => (window as unknown as { __heard: unknown[] }).__heard))).toEqual([
    { 'panel-close': { reason: 'reader' } }, { 'panel-close': { reason: 'width' } },
  ]);
});
