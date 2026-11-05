import { test, expect } from './harness';
import type { Page } from '@playwright/test';
import { createRequire } from 'node:module';

/**
 * A floating panel is a STATE of an overlay or a fixed panel (Will, TODO 769): Float lifts
 * it off the right edge or the shell's end area; its header bar moves it, its corner resizes
 * it, both inside the window; Dock puts it back where it came from. Real pointer and keys;
 * the place read back by boxes and by pixels. TRAP T-a-floating-panel-is-a-state
 */

type PanelEl = HTMLElement & { rendered?: Promise<void>; open: boolean; show(): void; hide(): void };
type Box = { x: number; y: number; w: number; h: number };
type Rgb = [number, number, number];

const W = 1600;
const H = 900;
/** The page behind, a colour no panel draws: a pixel says whose it is. */
const PAGE: Rgb = [255, 0, 255];

/** A floatable panel, open on the right edge; with `shell`, poppable beside an app shell. */
async function stage(page: Page, opts: { shell?: boolean; expandable?: boolean } = {}): Promise<void> {
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(async ({ shell, expandable }) => {
    document.body.style.background = 'rgb(255, 0, 255)';
    const root = document.getElementById('root')!;
    const panel = document.createElement('sherpa-overlay-panel') as PanelEl;
    panel.id = 'float';
    panel.setAttribute('data-heading', 'Float me');
    panel.setAttribute('data-floatable', '');
    panel.setAttribute('data-dismissible', '');
    if (expandable) panel.setAttribute('data-expandable', '');
    panel.innerHTML = '<p>body</p>';
    const after = Object.assign(document.createElement('span'), { id: 'after' });
    if (shell) {
      panel.setAttribute('data-poppable', '');
      const frame = document.createElement('sherpa-app-shell');
      // Its own surface is the page's colour here, so a pixel still says whose it is.
      frame.style.background = 'rgb(255, 0, 255)';
      root.replaceChildren(frame, panel, after);
    } else {
      root.replaceChildren(panel, after);
    }
    await panel.rendered;
    await window.__settled();
    panel.show();
    await window.__settled();
    const heard: unknown[] = [];
    (window as unknown as { __heard: unknown[] }).__heard = heard;
    for (const type of ['panel-float', 'panel-move', 'panel-resize']) {
      panel.addEventListener(type, (e) => heard.push({ [type]: (e as CustomEvent).detail }));
    }
  }, opts);
}

/** A part's box: the panel's own (`.root`), or one inside it, or its header's button. */
const rect = (page: Page, sel: string): Promise<Box> => page.evaluate((s) => {
  const sr = document.getElementById('float')!.shadowRoot!;
  const el = s.startsWith('header ')
    ? sr.querySelector(`.${s.slice(7)}`)!
    : sr.querySelector(s)!;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}, sel);
const box = (page: Page): Promise<Box> => rect(page, '.root');
const centre = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];

/** A real click on one of its header's buttons. */
async function press(page: Page, cls: string): Promise<void> {
  const [x, y] = centre(await rect(page, `.${cls}`));
  await page.mouse.click(x, y);
  await page.evaluate(() => window.__settled());
}

/** What a real pointer drags, from a point by a distance, in steps. It is let go inside the
 *  window: Firefox drops a release outside it. */
async function drag(page: Page, from: [number, number], by: [number, number]): Promise<void> {
  const to = [Math.min(W - 2, Math.max(2, from[0] + by[0])), Math.min(H - 2, Math.max(2, from[1] + by[1]))] as const;
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(to[0], to[1], { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => window.__settled());
}

/** A point on the header bar that is no button: just after its title. */
async function bar(page: Page): Promise<[number, number]> {
  const header = await rect(page, '.header');
  return [header.x + 140, header.y + header.h / 2];
}

const attrs = (page: Page): Promise<Record<string, string | null>> => page.evaluate(() => {
  const p = document.getElementById('float')!;
  return Object.fromEntries(['data-floating', 'data-x', 'data-y', 'data-width', 'data-height'].map((a) => [a, p.getAttribute(a)]));
});
const heard = (page: Page): Promise<unknown[]> => page.evaluate(() => (window as unknown as { __heard: unknown[] }).__heard);
const style = (page: Page, sel: string, prop: string): Promise<string> => page.evaluate(([s, p]) =>
  getComputedStyle(document.getElementById('float')!.shadowRoot!.querySelector(s!)!).getPropertyValue(p!), [sel, prop]);

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
const near = (a: Rgb, b: Rgb, within = 16): boolean => Math.max(...a.map((v, i) => Math.abs(v - b[i]!))) <= within;

/** The panel is drawn in this box: its surface just inside each side, the page just outside. */
async function drawnAt(page: Page, b: Box): Promise<void> {
  const mid = Math.round(b.y + b.h / 2);
  const [inside] = await pixels(page, b.x + 8, mid);
  expect(near(inside!, PAGE), `the panel's surface at x ${b.x + 8}: ${JSON.stringify(inside)}`).toBe(false);
  if (b.x >= 8) {
    // Past its shadow, which reaches a few px out.
    const [outside] = await pixels(page, b.x - 24, mid);
    expect(near(outside!, PAGE), `the page at x ${b.x - 24}: ${JSON.stringify(outside)}`).toBe(true);
  }
  if (b.x + b.w + 24 < W) {
    const [right] = await pixels(page, b.x + b.w + 24, mid);
    expect(near(right!, PAGE), `the page past its right side: ${JSON.stringify(right)}`).toBe(true);
  }
}

test('Float lifts it in place, 16px in; Dock puts it back on the edge at its width; Float again finds its place', async ({ page }) => {
  await stage(page);
  const docked = await box(page);
  expect(docked).toEqual({ x: W - 640, y: 0, w: 640, h: H });
  expect(await page.evaluate(() => document.getElementById('float')!.shadowRoot!.querySelector('.float')!.getAttribute('aria-label'))).toBe('Float');

  await press(page, 'float');
  const lifted = await box(page);
  expect(lifted).toEqual({ x: W - 640 + 16, y: 16, w: 640 - 32, h: H - 32 });
  expect(await attrs(page)).toEqual({ 'data-floating': '', 'data-x': String(lifted.x), 'data-y': '16', 'data-width': String(lifted.w), 'data-height': String(lifted.h) });
  const button = await page.evaluate(() => {
    const b = document.getElementById('float')!.shadowRoot!.querySelector('.float')!;
    return [b.getAttribute('aria-label'), b.getAttribute('data-icon-start')];
  });
  expect(button).toEqual(['Dock', 'sidebar-flip']);
  // Every corner round, the left edge gone: the corner resizes it now.
  expect(await style(page, '.root', 'border-top-right-radius')).not.toBe('0px');
  expect(await style(page, '.resize', 'display')).toBe('none');
  await drawnAt(page, lifted);

  await press(page, 'float');
  expect(await box(page)).toEqual(docked);
  // The box is kept, so it floats there again.
  expect((await attrs(page))['data-x']).toBe(String(lifted.x));
  await press(page, 'float');
  expect(await box(page)).toEqual(lifted);
  expect(await heard(page)).toEqual([{ 'panel-float': { floating: true } }, { 'panel-float': { floating: false } }, { 'panel-float': { floating: true } }]);
});

/** Float it, at a size with room to move about. */
async function floatSmall(page: Page): Promise<Box> {
  await press(page, 'float');
  await page.evaluate(() => {
    const p = document.getElementById('float')!;
    p.setAttribute('data-width', '500');
    p.setAttribute('data-height', '400');
  });
  return box(page);
}

test('its header bar drags it anywhere in the window, never past it; a press on a button moves nothing', async ({ page }) => {
  await stage(page);
  const from = await floatSmall(page);

  // The grip shows while the bar is pointed at, and only then.
  await page.mouse.move(8, H - 8);
  await expect.poll(() => style(page, '.grip', 'opacity')).toBe('0');
  await page.mouse.move(...(await bar(page)));
  await expect.poll(() => style(page, '.grip', 'opacity')).toBe('1');
  expect(await style(page, '.header', 'cursor')).toBe('grab');

  await drag(page, await bar(page), [-500, 120]);
  const moved = await box(page);
  expect(moved).toEqual({ ...from, x: from.x - 500, y: from.y + 120 });
  await drawnAt(page, moved);
  expect(await attrs(page)).toMatchObject({ 'data-x': String(moved.x), 'data-y': String(moved.y) });
  expect(await heard(page)).toEqual([{ 'panel-float': { floating: true } }, { 'panel-move': { x: moved.x, y: moved.y } }]);
  expect(moved.h).toBe(400);

  // Held on a button and dragged off it: no move, and no press.
  const [bx, by] = centre(await rect(page, '.float'));
  await drag(page, [bx, by], [-300, 200]);
  expect(await box(page)).toEqual(moved);
  expect((await attrs(page))['data-floating']).toBe('');

  // Past the top left, it stops at the window's edge; past the bottom right, at that one.
  await drag(page, await bar(page), [-3000, -3000]);
  expect(await box(page)).toMatchObject({ x: 0, y: 0, w: from.w, h: from.h });
  expect(await attrs(page)).toMatchObject({ 'data-x': '0', 'data-y': '0' });
  await drag(page, await bar(page), [3000, 3000]);
  const far = await box(page);
  expect(far).toEqual({ x: W - from.w, y: H - from.h, w: from.w, h: from.h });
  await drawnAt(page, far);
});

test('its corner resizes it, to its min and no smaller, and to the window edge and no further', async ({ page }) => {
  await stage(page);
  await floatSmall(page);
  await drag(page, await bar(page), [-600, 100]);
  const from = await box(page);

  // The corner shows on hover: its two lines are ink, not the surface.
  await page.mouse.move(W - 8, 8);
  await expect.poll(() => style(page, '.corner', 'opacity')).toBe('0');
  await page.mouse.move(from.x + from.w / 2, from.y + from.h / 2);
  await expect.poll(() => style(page, '.corner', 'opacity')).toBe('1');
  const c = await rect(page, '.corner');
  // In its bottom-right corner, inside the border.
  expect(Math.abs(c.x + c.w - (from.x + from.w))).toBeLessThanOrEqual(1);
  expect(Math.abs(c.y + c.h - (from.y + from.h))).toBeLessThanOrEqual(1);
  const line = await pixels(page, c.x, c.y + 12, c.w);
  const surface = line[0]!;
  expect(line.some((p) => !near(p, surface, 40)), `the corner draws lines: ${JSON.stringify(line)}`).toBe(true);

  await drag(page, [c.x + c.w / 2, c.y + c.h / 2], [-2000, -2000]);
  const small = await box(page);
  expect(small).toEqual({ x: from.x, y: from.y, w: 320, h: 192 });
  await drawnAt(page, small);
  expect(await attrs(page)).toMatchObject({ 'data-width': '320', 'data-height': '192' });

  const c2 = await rect(page, '.corner');
  await drag(page, [c2.x + c2.w / 2, c2.y + c2.h / 2], [3000, 3000]);
  const big = await box(page);
  expect(big).toEqual({ x: from.x, y: from.y, w: W - from.x, h: H - from.y });
  expect((await heard(page)).slice(-2)).toEqual([
    { 'panel-resize': { width: 320, height: 192 } },
    { 'panel-resize': { width: big.w, height: big.h } },
  ]);
});

test('a host hands the box back by its attributes; the keys move it from the grip and resize it from the corner, by 16px, Shift by 64', async ({ page }) => {
  await stage(page);
  await press(page, 'float');
  // A caller with no pointer: the box, by its attributes.
  await page.evaluate(() => {
    const p = document.getElementById('float')!;
    for (const [a, v] of [['data-x', '400'], ['data-y', '100'], ['data-width', '500'], ['data-height', '400']]) p.setAttribute(a!, v!);
  });
  const from = await box(page);
  expect(from).toEqual({ x: 400, y: 100, w: 500, h: 400 });
  // Back from the Float button to the grip, by the keys.
  await page.evaluate(() => document.getElementById('float')!.shadowRoot!.querySelector('.float')!.shadowRoot!.querySelector('button')!.focus());
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.getElementById('float')!.shadowRoot!.activeElement?.className)).toContain('grip');
  expect(await style(page, '.grip', 'opacity')).toBe('1');
  expect(await style(page, '.grip', 'outline-style')).not.toBe('none');

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+ArrowDown');
  expect(await box(page)).toEqual({ ...from, x: from.x - 16, y: from.y + 64 });
  // The bar's own keys do nothing to the place: only the grip moves it.
  await page.evaluate(() => document.getElementById('float')!.shadowRoot!.querySelector('.float')!.shadowRoot!.querySelector('button')!.focus());
  await page.keyboard.press('ArrowLeft');
  expect(await box(page)).toEqual({ ...from, x: from.x - 16, y: from.y + 64 });

  await page.evaluate(() => (document.getElementById('float')!.shadowRoot!.querySelector('.corner') as HTMLElement).focus());
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowUp');
  expect(await box(page)).toEqual({ x: from.x - 16, y: from.y + 64, w: from.w + 16, h: from.h - 64 });
  expect(await style(page, '.corner', 'opacity')).toBe('1');
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowLeft');
  expect((await box(page)).w).toBe(320);
  expect((await heard(page)).slice(-1)).toEqual([{ 'panel-resize': { width: 320, height: from.h - 64 } }]);
  expect((await heard(page)).filter((e) => 'panel-move' in (e as object))).toEqual([
    { 'panel-move': { x: from.x - 16, y: from.y } },
    { 'panel-move': { x: from.x - 16, y: from.y + 64 } },
  ]);
});

test('a fixed panel floats out of the end area, which gives its room back; Dock puts it back in the area', async ({ page }) => {
  await stage(page, { shell: true });
  await press(page, 'pop');
  const area = () => page.evaluate(() => {
    const r = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('.panel-end')!.getBoundingClientRect();
    return Math.round(r.width);
  });
  const where = () => page.evaluate(() => {
    const p = document.getElementById('float')!;
    return { parent: p.parentElement!.localName, slot: p.slot, next: p.nextElementSibling?.id ?? null };
  });
  const fixed = await box(page);
  expect(await where()).toEqual({ parent: 'sherpa-app-shell', slot: 'panel-end', next: null });
  expect(await area()).toBeGreaterThan(400);

  await press(page, 'float');
  expect(await where()).toEqual({ parent: 'div', slot: '', next: 'after' });
  expect(await area()).toBe(0);
  const lifted = await box(page);
  // Never under its min height: a short card lifts taller.
  expect(lifted).toEqual({ x: fixed.x + 16, y: fixed.y + 16, w: fixed.w - 32, h: Math.max(192, fixed.h - 32) });
  // Floating, it says nothing of where it docks: Pop goes until it is docked.
  expect(await style(page, '.pop', 'display')).toBe('none');
  await drag(page, await bar(page), [-700, 50]);
  await drawnAt(page, await box(page));

  await press(page, 'float');
  expect(await where()).toEqual({ parent: 'sherpa-app-shell', slot: 'panel-end', next: null });
  expect(await area()).toBeGreaterThan(400);
  expect(await box(page)).toEqual(fixed);
  expect(await page.evaluate(() => document.getElementById('float')!.hasAttribute('data-fixed'))).toBe(true);
});

test('floating, it leaves the right edge: one opened there leaves it open; docked, it takes the edge again', async ({ page }) => {
  await stage(page);
  await press(page, 'float');
  const r = await page.evaluate(async () => {
    const other = document.createElement('sherpa-overlay-panel') as PanelEl;
    document.getElementById('root')!.append(other);
    await other.rendered;
    other.show();
    await window.__settled();
    const panel = document.getElementById('float') as PanelEl;
    const both = [panel.open, other.open];
    // Drawn over the one on the edge.
    const z = [getComputedStyle(panel.shadowRoot!.querySelector('.root')!).zIndex, getComputedStyle(other.shadowRoot!.querySelector('.root')!).zIndex];
    panel.toggleAttribute('data-floating', false);
    await window.__settled();
    return { both, z, after: [panel.open, other.open] };
  });
  expect(r).toEqual({ both: [true, true], z: ['102', '101'], after: [true, false] });
});

test('maximised while floating, it fills the window and Float goes; Minimise puts it back where it floated', async ({ page }) => {
  await stage(page, { expandable: true });
  await press(page, 'float');
  await drag(page, await bar(page), [-400, 60]);
  const floated = await box(page);
  await press(page, 'expand');
  expect(await box(page)).toEqual({ x: 0, y: 0, w: W, h: H });
  expect(await style(page, '.float', 'display')).toBe('none');
  expect(await style(page, '.grip', 'display')).toBe('none');
  expect(await style(page, '.corner', 'display')).toBe('none');
  await press(page, 'expand');
  expect(await box(page)).toEqual(floated);
});

test('a smaller window holds it inside; a bigger one gives it its place back', async ({ page }) => {
  await stage(page);
  await press(page, 'float');
  await drag(page, await bar(page), [-200, 0]);
  const at = await box(page);
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect.poll(async () => (await box(page)).x).toBe(1000 - at.w);
  expect((await box(page)).y + (await box(page)).h).toBeLessThanOrEqual(700);
  await page.setViewportSize({ width: W, height: H });
  await expect.poll(() => box(page)).toEqual(at);
});

test('floating, it meets WCAG 2.1 AA: its grip and its corner are named, and the bar\'s buttons too', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the a11y gate is one engine');
  await stage(page, { expandable: true });
  await press(page, 'float');
  await page.addScriptTag({ path: createRequire(import.meta.url).resolve('axe-core/axe.min.js') });
  const r = await page.evaluate(async () => {
    type Axe = { run: (at: Element, o: unknown) => Promise<{ violations: { id: string; nodes: { target: unknown[] }[] }[] }> };
    const { violations } = await (window as unknown as { axe: Axe }).axe.run(document.getElementById('root')!, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'],
    });
    const sr = document.getElementById('float')!.shadowRoot!;
    const named = (s: string) => { const el = sr.querySelector(s)!; return [el.getAttribute('role'), el.getAttribute('aria-label'), (el as HTMLElement).tabIndex]; };
    return { violations: violations.map((v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`), grip: named('.grip'), corner: named('.corner') };
  });
  expect(r.violations).toEqual([]);
  expect(r.grip).toEqual(['button', 'Move panel', 0]);
  expect(r.corner).toEqual(['button', 'Resize panel', 0]);
});
