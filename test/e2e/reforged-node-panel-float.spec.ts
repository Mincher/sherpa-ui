import { test, expect, type Page } from './harness';

/**
 * The Nodes card floats as an overlay panel does (Will, TODO 769c), by the same code: Float lifts it
 * in place, 16px in; its header moves it and its corner resizes it, inside its CANVAS, never past it;
 * Dock puts it back, flush in its panel area (TODO 796). While it floats the canvas's banners take the
 * full top, and its minimap the bottom left; docked, they sit beside it. The same attributes, events,
 * words and icons as the overlay panel's. Real pointer and keys; read back by boxes and by pixels.
 * TRAP T-a-floating-panel-is-a-state
 */

type Box = { x: number; y: number; w: number; h: number };
type Rgb = [number, number, number];
const W = 1400;
const H = 900;
/** The canvas sits in from the window's corner, so its bounds are not the window's. */
const AT = { x: 160, y: 120 };
const CANVAS = { w: 900, h: 600 };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(async ({ at, size }) => {
    const root = document.getElementById('root')!;
    root.style.cssText = `position: absolute; left: ${at.x}px; top: ${at.y}px`;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: ${size.w}px; block-size: ${size.h}px">
        <sherpa-callout slot="banner" data-type="banner" data-status="info">A new version is ready.</sherpa-callout>
        <sherpa-node-panel id="nodes" slot="panel" data-floatable></sherpa-node-panel>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-panel');
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void> };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 2, id: 'g', nodes: [{ id: 'start', kind: 'source', x: 420, y: 40, values: { store: 'customers' } }], routes: [] };
    (window as unknown as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: document.getElementById('nodes') as never,
      fieldsOf: { customers: { status: { label: 'Status' } } }, stores: ['customers'],
    });
    const heard: unknown[] = [];
    (window as unknown as { __heard: unknown[] }).__heard = heard;
    for (const type of ['panel-float', 'panel-move', 'panel-resize']) {
      document.getElementById('nodes')!.addEventListener(type, (e) => heard.push({ [type]: (e as CustomEvent).detail }));
    }
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, { at: AT, size: CANVAS });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
/** A part's box: in the card's shadow root, or the canvas's. */
const rect = (page: Page, sel: string, host = 'nodes'): Promise<Box> => page.evaluate(([s, h]) => {
  const r = (h === 'cv' ? document.getElementById('cv')! : document.getElementById('nodes')!).shadowRoot!.querySelector(s!)!.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}, [sel, host]);
const card = (page: Page): Promise<Box> => rect(page, '.box');
const canvasBox = (page: Page): Promise<Box> => page.evaluate(() => {
  const r = document.getElementById('cv')!.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
const banner = (page: Page): Promise<Box> => page.evaluate(() => {
  const r = document.querySelector('#cv > sherpa-callout')!.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
const centre = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
const attrs = (page: Page) => page.evaluate(() => {
  const p = document.getElementById('nodes')!;
  return Object.fromEntries(['data-floating', 'data-x', 'data-y', 'data-width', 'data-height'].map((a) => [a, p.getAttribute(a)]));
});
const heard = (page: Page): Promise<unknown[]> => page.evaluate(() => (window as unknown as { __heard: unknown[] }).__heard);
const style = (page: Page, sel: string, prop: string): Promise<string> => page.evaluate(([s, p]) =>
  getComputedStyle(document.getElementById('nodes')!.shadowRoot!.querySelector(s!)!).getPropertyValue(p!), [sel, prop]);
const float = (page: Page) => page.evaluate(() => {
  const b = document.getElementById('nodes')!.shadowRoot!.querySelector('.float')!;
  return [b.getAttribute('aria-label'), b.getAttribute('data-icon-start')];
});

/** A real click on the card's Float or Dock. */
async function press(page: Page): Promise<void> {
  const [x, y] = centre(await rect(page, '.float'));
  await page.mouse.click(x, y);
  await settle(page);
}

/** A real drag, let go inside the window: Firefox drops a release outside it. */
async function drag(page: Page, from: [number, number], by: [number, number]): Promise<void> {
  const to = [Math.min(W - 2, Math.max(2, from[0] + by[0])), Math.min(H - 2, Math.max(2, from[1] + by[1]))] as const;
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(to[0], to[1], { steps: 4 });
  await page.mouse.up();
  await settle(page);
}

/** A point on the header bar that is no button: past its title. */
async function bar(page: Page): Promise<[number, number]> {
  const header = await rect(page, '.heading');
  return [header.x + 110, header.y + header.h / 2];
}

/** The pixels in a row, from a point: what the screen draws there. */
async function pixels(page: Page, x: number, y: number, width = 1): Promise<Rgb[]> {
  const shot = await page.screenshot({ clip: { x, y, width, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return Array.from({ length: img.width }, (_, i) => [...c.getImageData(i, 0, 1, 1).data].slice(0, 3) as Rgb);
  }, shot.toString('base64'));
}
const near = (a: Rgb, b: Rgb, within = 12): boolean => Math.max(...a.map((v, i) => Math.abs(v - b[i]!))) <= within;
/** The banner's own surface, read where nothing covers it. */
async function bannerInk(page: Page): Promise<Rgb> {
  const b = await banner(page);
  return (await pixels(page, b.x + b.w - 24, Math.round(b.y + b.h / 2)))[0]!;
}

test('Float lifts it in place, its words and icon the overlay panel\'s; the banners take the full top; Dock puts both back', async ({ page }) => {
  const cv = await canvasBox(page);
  const docked = await card(page);
  // Docked, FLUSH: top, left and bottom. TODO 796
  expect(docked).toEqual({ x: cv.x, y: cv.y, w: 288, h: cv.h });
  expect(await float(page)).toEqual(['Float', 'browser']);
  const beside = await banner(page);
  expect(beside.x).toBe(cv.x + 288 + 32);

  // Lifted in place, 16px in on each side, so it visibly lifts.
  await press(page);
  const lifted = { x: cv.x + 16, y: cv.y + 16, w: 256, h: cv.h - 32 };
  expect(await card(page)).toEqual(lifted);
  expect(await attrs(page)).toEqual({ 'data-floating': '', 'data-x': '16', 'data-y': '16', 'data-width': '256', 'data-height': String(cv.h - 32) });
  expect(await float(page)).toEqual(['Dock', 'sidebar-flip']);
  // Its shadow steps up: it is lifted.
  expect(await page.evaluate(() => document.getElementById('nodes')!.shadowRoot!.querySelector('.card')!.getAttribute('data-elevation'))).toBe('lg');
  // The banner takes the full top, under the card, which is drawn over it.
  const full = await banner(page);
  expect(full).toMatchObject({ x: cv.x + 32, w: cv.w - 64 });
  const covered = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.id, [docked.x + 40, full.y + full.h / 2]);
  expect(covered).toBe('nodes');

  // Shorter, and moved down, the banner shows where the card was, past its words: by its own ink.
  await page.evaluate(() => document.getElementById('nodes')!.setAttribute('data-height', '300'));
  await drag(page, await bar(page), [0, 200]);
  expect(await card(page)).toEqual({ ...lifted, y: lifted.y + 200, h: 300 });
  const ink = await bannerInk(page);
  const [where] = await pixels(page, docked.x + docked.w - 24, Math.round(full.y + full.h / 2));
  expect(near(where!, ink), `the banner, where the card was: ${JSON.stringify(where)} vs ${JSON.stringify(ink)}`).toBe(true);
  // The minimap takes the bottom left back.
  const map = await rect(page, '.minimap', 'cv');
  expect(map.x).toBeLessThan(cv.x + 40);

  // Dock: in its place again, the banners beside it, and the gap between them is the canvas, not the banner.
  await press(page);
  expect(await card(page)).toEqual(docked);
  expect(await banner(page)).toEqual(beside);
  const [gap] = await pixels(page, docked.x + docked.w + 16, Math.round(beside.y + beside.h / 2));
  expect(near(gap!, ink), `the canvas between the card and the banner: ${JSON.stringify(gap)}`).toBe(false);
  // …and the minimap beside it: what the view shows is under 44rem, so it stacks at the end.
  const docked2 = await rect(page, '.minimap', 'cv');
  expect(docked2.x + docked2.w).toBe(cv.x + cv.w - 16);
  // Its box is kept, so it floats where it was moved to.
  await press(page);
  expect((await card(page)).y).toBe(lifted.y + 200);
  expect(await heard(page)).toEqual([
    { 'panel-float': { floating: true } }, { 'panel-move': { x: 16, y: 216 } }, { 'panel-float': { floating: false } }, { 'panel-float': { floating: true } },
  ]);
});

test('its header drags it anywhere in its CANVAS, never past it, while clicks beside it reach the canvas; a press on Dock moves nothing', async ({ page }) => {
  const cv = await canvasBox(page);
  await press(page);
  await page.evaluate(() => document.getElementById('nodes')!.setAttribute('data-height', '400'));
  const from = await card(page);
  expect(from.h).toBe(400);

  // The grip shows while the bar is pointed at, and only then.
  await page.mouse.move(W - 8, H - 8);
  await expect.poll(() => style(page, '.grip', 'opacity')).toBe('0');
  await page.mouse.move(...(await bar(page)));
  await expect.poll(() => style(page, '.grip', 'opacity')).toBe('1');
  expect(await style(page, '.heading', 'cursor')).toBe('grab');

  await drag(page, await bar(page), [300, 60]);
  const moved = await card(page);
  expect(moved).toEqual({ ...from, x: from.x + 300, y: from.y + 60 });
  expect(await attrs(page)).toMatchObject({ 'data-x': String(moved.x - cv.x), 'data-y': String(moved.y - cv.y) });

  // Held on Dock and dragged off it: no move, and no press.
  const [bx, by] = centre(await rect(page, '.float'));
  await drag(page, [bx, by], [-200, 100]);
  expect(await card(page)).toEqual(moved);
  expect((await attrs(page))['data-floating']).toBe('');

  // Past the top left it stops at the canvas's edge, not the window's; past the bottom right, at that one.
  await drag(page, await bar(page), [-3000, -3000]);
  expect(await card(page)).toMatchObject({ x: cv.x, y: cv.y });
  expect(await attrs(page)).toMatchObject({ 'data-x': '0', 'data-y': '0' });
  await drag(page, await bar(page), [3000, 3000]);
  const far = await card(page);
  expect(far).toEqual({ x: cv.x + cv.w - from.w, y: cv.y + cv.h - from.h, w: from.w, h: from.h });

  // The canvas beside the card is the canvas's: a middle-button drag on it pans the view.
  const view = () => page.evaluate(() => (document.getElementById('cv') as HTMLElement & { view: { x: number; y: number } }).view);
  const was = await view();
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.id, [cv.x + 120, cv.y + 300])).toBe('cv');
  await page.mouse.move(cv.x + 120, cv.y + 300);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(cv.x + 160, cv.y + 320, { steps: 3 });
  await page.mouse.move(cv.x + 200, cv.y + 340, { steps: 3 });
  await page.mouse.up({ button: 'middle' });
  await settle(page);
  expect(await view()).toMatchObject({ x: was.x + 80, y: was.y + 40 });
  // …and the card's own items still place.
  await page.locator('#nodes sherpa-list-item[data-kind="value"]').click();
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-heading="Value"]').count()).toBe(1);
});

test('its corner resizes it, to 16rem by 12rem and no smaller, and to the canvas\'s edge and no further', async ({ page }) => {
  const cv = await canvasBox(page);
  await press(page);
  await page.evaluate(() => {
    const p = document.getElementById('nodes')!;
    for (const [a, v] of [['data-x', '200'], ['data-y', '100'], ['data-width', '300'], ['data-height', '300']]) p.setAttribute(a!, v!);
  });
  const from = await card(page);
  expect(from).toEqual({ x: cv.x + 200, y: cv.y + 100, w: 300, h: 300 });

  // The corner shows on hover: its two lines are ink, not the surface.
  await page.mouse.move(W - 8, 8);
  await expect.poll(() => style(page, '.corner', 'opacity')).toBe('0');
  await page.mouse.move(from.x + from.w / 2, from.y + from.h / 2);
  await expect.poll(() => style(page, '.corner', 'opacity')).toBe('1');
  const c = await rect(page, '.corner');
  expect(Math.abs(c.x + c.w - (from.x + from.w))).toBeLessThanOrEqual(1);
  expect(Math.abs(c.y + c.h - (from.y + from.h))).toBeLessThanOrEqual(1);
  const line = await pixels(page, c.x, c.y + 12, c.w);
  expect(line.some((p) => !near(p, line[0]!, 40)), `the corner draws lines: ${JSON.stringify(line)}`).toBe(true);

  await drag(page, centre(c), [-2000, -2000]);
  expect(await card(page)).toEqual({ x: from.x, y: from.y, w: 256, h: 192 });
  expect(await attrs(page)).toMatchObject({ 'data-width': '256', 'data-height': '192' });
  await drag(page, centre(await rect(page, '.corner')), [3000, 3000]);
  const big = await card(page);
  expect(big).toEqual({ x: from.x, y: from.y, w: cv.w - 200, h: cv.h - 100 });
  expect((await heard(page)).slice(-2)).toEqual([
    { 'panel-resize': { width: 256, height: 192 } },
    { 'panel-resize': { width: cv.w - 200, height: cv.h - 100 } },
  ]);
});

test('the keys move it from the grip and resize it from the corner, by 16px, Shift by 64; a host hands its box back', async ({ page }) => {
  const cv = await canvasBox(page);
  // A caller with no pointer: the box by its attributes, then Float by the key on the button.
  await page.evaluate(() => {
    const p = document.getElementById('nodes')!;
    for (const [a, v] of [['data-x', '300'], ['data-y', '100'], ['data-width', '320'], ['data-height', '360']]) p.setAttribute(a!, v!);
  });
  await page.evaluate(() => document.getElementById('nodes')!.shadowRoot!.querySelector('.float')!.shadowRoot!.querySelector('button')!.focus());
  await page.keyboard.press('Enter');
  await settle(page);
  const from = await card(page);
  expect(from).toEqual({ x: cv.x + 300, y: cv.y + 100, w: 320, h: 360 });
  // Back from the button to the grip.
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.getElementById('nodes')!.shadowRoot!.activeElement?.className)).toContain('grip');
  expect(await style(page, '.grip', 'opacity')).toBe('1');
  expect(await style(page, '.grip', 'outline-style')).not.toBe('none');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+ArrowDown');
  expect(await card(page)).toEqual({ ...from, x: from.x - 16, y: from.y + 64 });

  await page.evaluate(() => (document.getElementById('nodes')!.shadowRoot!.querySelector('.corner') as HTMLElement).focus());
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowUp');
  expect(await card(page)).toEqual({ x: from.x - 16, y: from.y + 64, w: from.w + 16, h: from.h - 64 });
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowLeft');
  expect((await card(page)).w).toBe(256);
  expect((await heard(page)).filter((e) => 'panel-move' in (e as object))).toEqual([
    { 'panel-move': { x: 284, y: 100 } },
    { 'panel-move': { x: 284, y: 164 } },
  ]);
  expect((await heard(page)).slice(-1)).toEqual([{ 'panel-resize': { width: 256, height: 296 } }]);
  // Docked by the key: the grip and the corner go, and it is in its place.
  await page.evaluate(() => document.getElementById('nodes')!.shadowRoot!.querySelector('.float')!.shadowRoot!.querySelector('button')!.focus());
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await card(page)).toEqual({ x: cv.x, y: cv.y, w: 288, h: cv.h });
  expect(await style(page, '.grip', 'display')).toBe('none');
  expect(await style(page, '.corner', 'display')).toBe('none');
});
