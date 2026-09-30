import { test, expect } from '@playwright/test';

/**
 * sherpa-layout-canvas — Will, TODO 25: an infinite canvas content area that
 * pans and zooms with no edge, on a crosshair grid, with Pan, Zoom in, Zoom out
 * and Options floating at the bottom right, and a minimap of the whole canvas
 * that moves the view. The canvas OWNS its view and REPORTS each move.
 * TRAP T-a-canvas-owns-its-view
 */
const HARNESS = '/test/reforged/harness.html';

type Canvas = HTMLElement & {
  rendered: Promise<void>;
  view: { x: number; y: number; zoom: number };
  panTo(x: number, y: number): void;
  zoomTo(zoom: number, cx?: number, cy?: number): void;
  fit(): void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 800px; block-size: 500px';
    el.innerHTML = '<div id="a" style="--x: 100px; --y: 80px; inline-size: 200px; block-size: 100px">A</div>'
      + '<div id="b" style="--x: 1400px; --y: 900px; inline-size: 200px; block-size: 100px">B</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
  });
});

const canvas = 'document.querySelector("#root sherpa-layout-canvas")';

test('four controls at the bottom right, a minimap, and a crosshair grid', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const el = eval(sel) as Canvas;
    const sr = el.shadowRoot!;
    const box = (s: string) => sr.querySelector(s)!.getBoundingClientRect();
    const host = el.getBoundingClientRect();
    const controls = box('.controls');
    const minimap = box('.minimap');
    return {
      labels: [...sr.querySelectorAll('.controls > sherpa-button')].map((b) => b.getAttribute('aria-label')),
      bottomRight: Math.round(host.right - controls.right) === 16 && Math.round(host.bottom - controls.bottom) === 16,
      bottomLeft: Math.round(minimap.left - host.left) === 16,
      items: sr.querySelectorAll('.minimap-item').length,
      grid: getComputedStyle(sr.querySelector('.viewport')!, '::before').maskImage.includes('svg'),
    };
  }, canvas);
  expect(r).toEqual({
    labels: ['Pan', 'Zoom in', 'Zoom out', 'Canvas options'],
    bottomRight: true, bottomLeft: true, items: 2, grid: true,
  });
});

test('Zoom in and out step, stop at their bounds, and report each move', async ({ page }) => {
  const r = await page.evaluate(async (sel) => {
    const el = eval(sel) as Canvas;
    const sr = el.shadowRoot!;
    const heard: number[] = [];
    el.addEventListener('canvas-change', (e) => heard.push((e as CustomEvent).detail.zoom));
    const press = (s: string) => sr.querySelector(s)!.shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
    press('.zoom-in');
    const once = el.dataset['zoom'];
    for (let i = 0; i < 12; i++) press('.zoom-in');
    const top = { zoom: el.view.zoom, off: sr.querySelector('.zoom-in')!.hasAttribute('disabled') };
    // A HOST may set it too.
    el.dataset['zoom'] = '0.5';
    await Promise.resolve();
    return { once, top, host: el.view.zoom, heard: heard.slice(0, 2) };
  }, canvas);
  expect(r.once).toBe('1.25');
  expect(r.top).toEqual({ zoom: 4, off: true });
  expect(r.host).toBe(0.5);
  expect(r.heard).toEqual([1.25, 1.5625]);
});

test('the keys pan and zoom; a Ctrl+wheel zooms about the pointer', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const el = eval(sel) as Canvas;
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('.viewport')!;
    const key = (k: string, shiftKey = false) => viewport.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true }));
    key('ArrowLeft');
    key('ArrowUp', true);
    const panned = { ...el.view };
    key('+');
    key('0');
    const reset = el.view.zoom;
    // The PLANE point under the pointer stays under it.
    el.panTo(0, 0);
    const rect = viewport.getBoundingClientRect();
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: rect.left + 200, clientY: rect.top + 100, bubbles: true, cancelable: true }));
    const { x, y, zoom } = el.view;
    return { panned, reset, zoomed: zoom > 1, kept: [Math.round((200 - x) / zoom), Math.round((100 - y) / zoom)] };
  }, canvas);
  expect(r.panned).toEqual({ x: 32, y: 128, zoom: 1 });
  expect(r.reset).toBe(1);
  expect(r.zoomed).toBe(true);
  expect(r.kept).toEqual([200, 100]);
});

test('the Pan tool: a drag anywhere moves the view', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const el = eval(sel) as Canvas;
    const sr = el.shadowRoot!;
    sr.querySelector('.pan')!.shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
    const on = { panning: el.hasAttribute('data-panning'), pressed: sr.querySelector('.pan')!.getAttribute('aria-pressed') };
    const viewport = sr.querySelector<HTMLElement>('.viewport')!;
    const at = (type: string, x: number, y: number) => viewport.dispatchEvent(
      new PointerEvent(type, { pointerId: 7, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true }));
    // On the CONTENT, it still pans: the tool is on.
    el.querySelector('#a')!.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, button: 0, buttons: 1, clientX: 300, clientY: 300, bubbles: true, composed: true }));
    at('pointermove', 340, 270);
    const dragging = el.hasAttribute('data-dragging');
    at('pointerup', 340, 270);
    return { on, dragging, view: el.view, done: el.hasAttribute('data-dragging') };
  }, canvas);
  expect(r.on).toEqual({ panning: true, pressed: 'true' });
  expect(r.dragging).toBe(true);
  expect(r.view).toEqual({ x: 40, y: -30, zoom: 1 });
  expect(r.done).toBe(false);
});

test('Fit puts every piece of content in view; the minimap moves the view and hides', async ({ page }) => {
  const r = await page.evaluate(async (sel) => {
    const el = eval(sel) as Canvas;
    const sr = el.shadowRoot!;
    el.fit();
    const host = el.getBoundingClientRect();
    const inView = ['#a', '#b'].every((id) => {
      const b = el.querySelector(id)!.getBoundingClientRect();
      return b.left >= host.left && b.right <= host.right && b.top >= host.top && b.bottom <= host.bottom;
    });
    // A press on the minimap's middle puts the view's middle there.
    const map = sr.querySelector<HTMLElement>('.minimap')!;
    const m = map.getBoundingClientRect();
    const before = { ...el.view };
    map.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, clientX: m.left + 4, clientY: m.top + 4, bubbles: true }));
    const moved = el.view.x !== before.x || el.view.y !== before.y;
    // Options › Hide minimap.
    const hide = sr.querySelector('.options sherpa-menu')!.querySelector<HTMLButtonElement>('button[value="minimap"]')!;
    hide.click();
    await Promise.resolve();
    return {
      zoom: el.view.zoom < 1, inView, moved,
      hidden: getComputedStyle(map).display, label: hide.textContent,
    };
  }, canvas);
  expect(r).toEqual({ zoom: true, inView: true, moved: true, hidden: 'none', label: 'Show minimap' });
});
