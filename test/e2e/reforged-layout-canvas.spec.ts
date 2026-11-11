import { test, expect } from './harness';

/**
 * sherpa-layout-canvas — Will, TODO 25: an infinite canvas content area that
 * pans and zooms with no edge, on a crosshair grid, with Pan, Zoom in, Zoom out
 * and Options floating at the bottom right, and a minimap of the whole canvas
 * that moves the view. The canvas OWNS its view and REPORTS each move.
 * TRAP T-a-canvas-owns-its-view
 */
type Canvas = HTMLElement & {
  rendered: Promise<void>;
  view: { x: number; y: number; zoom: number };
  panTo(x: number, y: number): void;
  zoomTo(zoom: number, cx?: number, cy?: number): void;
  fit(): void;
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 800px; block-size: 500px';
    el.innerHTML = '<div id="a" style="--x: 100px; --y: 80px; inline-size: 200px; block-size: 100px">A</div>'
      + '<div id="b" style="--x: 1400px; --y: 900px; inline-size: 200px; block-size: 100px">B</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await window.__settled();
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
      grid: getComputedStyle(sr.querySelector('.viewport > .grid')!).maskImage.includes('svg'),
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
    const on = { panning: el.matches(':state(panning)'), pressed: sr.querySelector('.pan')!.getAttribute('aria-pressed') };
    const viewport = sr.querySelector<HTMLElement>('.viewport')!;
    const at = (type: string, x: number, y: number) => viewport.dispatchEvent(
      new PointerEvent(type, { pointerId: 7, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true }));
    // On the CONTENT, it still pans: the tool is on.
    el.querySelector('#a')!.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, button: 0, buttons: 1, clientX: 300, clientY: 300, bubbles: true, composed: true }));
    at('pointermove', 340, 270);
    const dragging = el.matches(':state(dragging)');
    at('pointerup', 340, 270);
    return { on, dragging, view: el.view, done: el.matches(':state(dragging)') };
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

test('a drag on the minimap\'s frame keeps its hold, stops at the minimap\'s edge, and the map holds still', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const el = eval(sel) as Canvas;
    const sr = el.shadowRoot!;
    el.fit();
    const map = sr.querySelector<HTMLElement>('.minimap')!;
    const frame = () => sr.querySelector('.minimap-view')!.getBoundingClientRect();
    const items = () => [...sr.querySelectorAll('.minimap-item')].map((i) => i.getBoundingClientRect().left);
    const at = (type: string, x: number, y: number) => map.dispatchEvent(
      new PointerEvent(type, { pointerId: 5, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true }));
    const f = frame();
    const before = items();
    // Take hold off the frame's middle: it must not jump to centre on the pointer.
    at('pointerdown', f.left + 2, f.top + 2);
    const held = Math.round(frame().left - f.left);
    at('pointermove', f.left + 2000, f.top + 2000);
    const m = map.getBoundingClientRect();
    const g = frame();
    const still = items().every((x, i) => Math.abs(x - before[i]!) < 0.5);
    at('pointerup', f.left + 2000, f.top + 2000);
    return { held, inside: g.right <= m.right + 0.5 && g.bottom <= m.bottom + 0.5, still };
  }, canvas);
  expect(r).toEqual({ held: 0, inside: true, still: true });
});

test('a key in the content is the content\'s: the canvas neither pans nor zooms', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const el = eval(sel) as Canvas;
    const before = { ...el.view };
    for (const key of ['ArrowLeft', '-', '0']) {
      el.querySelector('#a')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    }
    return { same: JSON.stringify(el.view) === JSON.stringify(before) };
  }, canvas);
  expect(r.same).toBe(true);
});

test('a piece that moves moves its minimap item', async ({ page }) => {
  const r = await page.evaluate(async (sel) => {
    const el = eval(sel) as Canvas;
    const item = () => el.shadowRoot!.querySelector('.minimap-item')!.getBoundingClientRect().left;
    const before = item();
    el.querySelector<HTMLElement>('#a')!.style.setProperty('--x', '700px');
    // The minimap follows by the next frame: once a frame, however many pieces moved.
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return { moved: item() !== before };
  }, canvas);
  expect(r.moved).toBe(true);
});

test('a zoom resizes the minimap\'s frame; the content on the minimap holds its size and place (Will, TODO 549)', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const el = eval(sel) as Canvas;
    const sr = el.shadowRoot!;
    const frame = () => Math.round(sr.querySelector('.minimap-view')!.getBoundingClientRect().width);
    const items = () => [...sr.querySelectorAll('.minimap-item')].map((i) => { const b = i.getBoundingClientRect(); return [b.left, b.top, b.width].map(Math.round).join(); });
    el.fit();
    const fitted = { frame: frame(), items: items() };
    el.zoomTo(el.view.zoom * 2);
    const nearer = { frame: frame(), items: items() };
    el.panTo(el.view.x - 300, el.view.y - 200);
    return { halved: Math.abs(nearer.frame - fitted.frame / 2) <= 1, held: nearer.items.join() === fitted.items.join() && items().join() === fitted.items.join() };
  }, canvas);
  expect(r).toEqual({ halved: true, held: true });
});

test('the smallest zoom gives way to the content: content wider than 25% shows is all in view at Fit, and Zoom out reaches it (Will, 2026-11-10)', async ({ page }) => {
  const r = await page.evaluate(async (sel) => {
    const el = eval(sel) as Canvas;
    // Far apart: at 25% the 800px canvas shows 3200px of plane, and this content is 8000px across.
    el.querySelector<HTMLElement>('#b')!.style.setProperty('--x', '8000px');
    await new Promise((done) => requestAnimationFrame(done));
    el.fit();
    const host = el.getBoundingClientRect();
    const inView = ['#a', '#b'].every((id) => {
      const b = el.querySelector(id)!.getBoundingClientRect();
      return b.left >= host.left && b.right <= host.right;
    });
    const fitted = el.view.zoom;
    el.zoomTo(0.01);
    return { fitted, inView, floor: el.view.zoom, out: el.shadowRoot!.querySelector('.zoom-out')!.hasAttribute('disabled') };
  }, canvas);
  expect(r.inView).toBe(true);
  expect(r.fitted).toBeLessThan(0.25);
  // Zoom out stops where all the content is in view, no further.
  expect(Math.abs(r.floor - r.fitted)).toBeLessThan(0.005);
  expect(r.out).toBe(true);
});

test('its plane is drawn only when a page asks: data-drawn reaches the plane, and Google Chrome draws it (plan 852, A)', async ({ page }, info) => {
  const drawn = () => page.evaluate((sel) => {
    const plane = (eval(sel) as Canvas).shadowRoot!.querySelector('.plane')!;
    return { asked: plane.hasAttribute('data-drawn'), canvas: !!plane.shadowRoot!.querySelector('canvas[content="drawable"]') };
  }, canvas);
  // The chrome project's fixture asks for every layout canvas; the other projects do not.
  const asked = info.project.name === 'chrome';
  expect(await drawn()).toEqual({ asked, canvas: asked });
  await page.evaluate((sel) => (eval(sel) as Canvas).toggleAttribute('data-drawn'), canvas);
  expect(await drawn()).toEqual({ asked: !asked, canvas: false });
});

test('a Ctrl+wheel notch zooms 10%, a pinch follows the fingers; a step zoom eases, a pan does not; Reduce motion makes it instant (TODO 896)', async ({ page }) => {
  const r = await page.evaluate(async (sel) => {
    const el = eval(sel) as Canvas;
    const sr = el.shadowRoot!;
    const viewport = sr.querySelector<HTMLElement>('.viewport')!;
    const wheel = (deltaY: number, ctrlKey = true) => viewport.dispatchEvent(new WheelEvent('wheel', { deltaY, ctrlKey, bubbles: true, cancelable: true }));
    const eased = () => ({
      state: el.matches(':state(easing)'), plane: sr.querySelector('.plane')!.hasAttribute('data-ease'),
      grid: getComputedStyle(sr.querySelector('.grid')!).transitionDuration,
      surface: getComputedStyle(sr.querySelector('.plane')!.shadowRoot!.querySelector('.surface')!).transitionDuration,
    });
    const drawn = !!sr.querySelector('.plane')!.shadowRoot!.querySelector('canvas');
    el.zoomTo(1);
    wheel(-100);
    const notch = el.view.zoom;
    const easing = eased();
    wheel(-4);
    const pinch = el.view.zoom;
    const pinched = eased();
    el.zoomTo(1);
    wheel(100);
    const down = el.view.zoom;
    wheel(30, false);
    const panned = eased();
    // Reduce motion: the page's motion scale is 0, and every motion token with it.
    document.documentElement.style.setProperty('--sherpa-motion-scale', '0');
    sr.querySelector('.zoom-in')!.shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
    const reduced = eased();
    document.documentElement.style.removeProperty('--sherpa-motion-scale');
    return { drawn, notch, easing, pinch: Math.round(pinch * 1000) / 1000, pinched, down: Math.round(down * 1000) / 1000, panned, reduced };
  }, canvas);
  expect(r.notch).toBeCloseTo(1.1, 5);
  // A plane drawn into a real canvas (Google Chrome, asked) paints each view at once, so nothing eases there.
  expect(r.easing).toEqual(r.drawn ? { state: false, plane: false, grid: '0s', surface: '0s' } : { state: true, plane: true, grid: '0.3s', surface: '0.3s' });
  expect(r.pinch).toBeCloseTo(1.1 * Math.exp(0.04), 3);
  expect(r.pinched.state).toBe(false);
  expect(r.down).toBeCloseTo(1 / 1.1, 3);
  expect(r.panned).toEqual({ state: false, plane: false, grid: '0s', surface: '0s' });
  expect(r.reduced).toMatchObject({ state: !r.drawn, grid: '0s', surface: '0s' });
});
