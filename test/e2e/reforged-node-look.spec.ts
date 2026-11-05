import { test, expect, type Page } from './harness';

/**
 * The node look, its sockets and its resize handle — Will, TODO 740, from his Figma. A node's kind's
 * category (`data-category`) gives its radius and fill; an input is a D, a many input double height;
 * True is a triangle and False a rounded square. On hover or focus a handle shows at the bottom right:
 * a drag grows the node to at most double each way, non-uniformly, and the primary key (Cmd on a Mac,
 * Ctrl elsewhere) keeps its aspect. Real pointer events; pixels, never computed style alone.
 */
type Canvas = HTMLElement & { rendered: Promise<void>; zoomTo(z: number): void; panTo(x: number, y: number): void };
type Node = HTMLElement & { rendered: Promise<void>; socketRect(side: string): DOMRect | null };
type Rgb = [number, number, number];
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 900px; block-size: 520px';
    const cats = ['sources', 'custom-nodes', 'logic', 'output', 'ai'];
    el.innerHTML = cats.map((c, i) => `<sherpa-node id="${c}" data-resizable data-heading="${c}" data-category="${c}" data-x="${20 + i * 170}" data-y="40" style="inline-size: 10rem"></sherpa-node>`).join('')
      + '<sherpa-node id="big" data-resizable data-heading="Resize" data-x="40" data-y="200" data-input-socket="value" data-input-many data-input-routed></sherpa-node>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await Promise.all([...el.querySelectorAll<Node>('sherpa-node')].map((n) => n.rendered));
    el.scrollIntoView({ block: 'start' });
    await window.__settled();
  });
});

async function paint(page: Page, rect: { x: number; y: number; w: number; h: number }, at: [number, number][]): Promise<Rgb[]> {
  const shot = await page.screenshot({ clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });
  return page.evaluate(async ([b64, pts]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return (pts as [number, number][]).map(([fx, fy]) => [...c.getImageData(Math.min(img.width - 1, Math.floor(fx * img.width)), Math.min(img.height - 1, Math.floor(fy * img.height)), 1, 1).data].slice(0, 3) as Rgb);
  }, [shot.toString('base64'), at] as const);
}
const inkOf = (page: Page, token: string): Promise<Rgb> => page.evaluate((t) => {
  const el = Object.assign(document.createElement('div'), { style: `background: var(${t}); inline-size: 1px; block-size: 1px` });
  document.body.append(el);
  const [r, g, b] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);
  el.remove();
  return [r, g, b] as Rgb;
}, token);
const near = (a: Rgb, b: Rgb, within = 6): boolean => Math.max(...a.map((v, i) => Math.abs(v - b[i]!))) <= within;
const box = (page: Page, id: string) => page.evaluate((i) => { const r = document.getElementById(i)!.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, id);
const handle = (page: Page, id: string) => page.evaluate((i) => {
  const h = document.getElementById(i)!.shadowRoot!.querySelector('.resize')!;
  const r = h.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, visible: getComputedStyle(h).visibility === 'visible' };
}, id);

test('each category has its own radius and its own painted fill; one with no category keeps the card', async ({ page }) => {
  const radii = await page.evaluate(() => Object.fromEntries(['sources', 'custom-nodes', 'logic', 'output', 'ai', 'big'].map((id) => {
    const s = getComputedStyle(document.getElementById(id)!.shadowRoot!.querySelector('.root')!);
    return [id, [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map(parseFloat)];
  })));
  expect(radii).toEqual({ sources: [16, 4, 4, 16], 'custom-nodes': [4, 4, 4, 4], logic: [4, 4, 4, 4], output: [4, 16, 16, 4], ai: [16, 16, 16, 4], big: [4, 4, 4, 4] });
  const fills: Record<string, string> = { sources: '--sherpa-theme-surface-info-base', 'custom-nodes': '--sherpa-theme-surface-info-base', output: '--sherpa-theme-surface-success-base', ai: '--sherpa-theme-surface-active-base' };
  for (const [id, token] of Object.entries(fills)) {
    const b = await box(page, id);
    const [pixel] = await paint(page, b, [[.5, .96]]);
    expect(near(pixel!, await inkOf(page, token)), `${id} paints ${token}`).toBe(true);
  }
  const [logic] = await paint(page, await box(page, 'logic'), [[.5, .96]]);
  const [info] = await paint(page, await box(page, 'sources'), [[.5, .96]]);
  expect(near(logic!, info!, 2), 'a Logic node is not the info tint').toBe(false);
});

test('a many input is twice the height of a single, a D: round outside, flat on the node side', async ({ page }) => {
  const sizes = await page.evaluate(async () => {
    const el = document.querySelector('#root sherpa-layout-canvas')!;
    el.insertAdjacentHTML('beforeend', '<sherpa-node id="one" data-heading="One" data-x="400" data-y="200" data-input-socket="value" data-input-routed></sherpa-node>');
    const one = document.getElementById('one') as Node;
    await one.rendered;
    await window.__settled();
    return { one: one.socketRect('input')!.height, many: (document.getElementById('big') as Node).socketRect('input')!.height };
  });
  expect(sizes.many).toBeCloseTo(sizes.one * 2, 0);
  // The Figma's socket: 16px, and 32 for a many input. Will, TODO 747
  expect(sizes.one).toBe(16);
  expect(sizes.many).toBe(32);
});

test('the handle shows on hover at the bottom right, hides without it, and shows on focus', async ({ page }) => {
  await page.mouse.move(2, 2);
  expect((await handle(page, 'big')).visible).toBe(false);
  const b = await box(page, 'big');
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  const h = await handle(page, 'big');
  expect(h.visible).toBe(true);
  expect(Math.abs(h.x - (b.x + b.w))).toBeLessThanOrEqual(16);
  expect(Math.abs(h.y - (b.y + b.h))).toBeLessThanOrEqual(16);
  await page.mouse.move(2, 2);
  expect((await handle(page, 'big')).visible).toBe(false);
  await page.evaluate(() => (document.getElementById('big')!.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  expect((await handle(page, 'big')).visible).toBe(true);
});

async function dragHandle(page: Page, dx: number, dy: number, key?: string): Promise<void> {
  const b = await box(page, 'big');
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  const h = await handle(page, 'big');
  if (key) await page.keyboard.down(key);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + dx / 2, h.y + dy / 2, { steps: 3 });
  await page.mouse.move(h.x + dx, h.y + dy, { steps: 3 });
  await page.mouse.up();
  if (key) await page.keyboard.up(key);
  await page.evaluate(() => window.__settled());
}

test('a drag resizes non-uniformly, the primary key keeps the aspect, and each way stops at 100% and 200%', async ({ page }) => {
  const nat = await box(page, 'big');
  const heard = await page.evaluate(() => { const h: unknown[] = []; document.getElementById('big')!.addEventListener('node-resize', (e) => h.push((e as CustomEvent).detail)); (window as never as { heard: unknown[] }).heard = h; return h.length; });
  expect(heard).toBe(0);
  await dragHandle(page, 60, 20);
  const a = await box(page, 'big');
  expect(a.w).toBeCloseTo(nat.w + 60, 0);
  expect(a.h).toBeCloseTo(nat.h + 20, 0);
  expect(await page.evaluate(() => (window as never as { heard: unknown[] }).heard.length)).toBeGreaterThan(0);
  // The aspect kept: the shape (w / h) stays what it was after the first drag.
  await dragHandle(page, 40, 5, mod);
  const c = await box(page, 'big');
  expect(c.w / c.h).toBeCloseTo(a.w / a.h, 1);
  expect(c.w).toBeGreaterThan(a.w);
  // Stops at double, each way.
  await dragHandle(page, 400, 100);
  const max = await box(page, 'big');
  expect(max.w).toBeCloseTo(nat.w * 2, 0);
  expect(max.h).toBeCloseTo(nat.h * 2, 0);
  // And at its natural size.
  await dragHandle(page, -600, -90);
  const min = await box(page, 'big');
  expect(min.w).toBeCloseTo(nat.w, 0);
  expect(min.h).toBeCloseTo(nat.h, 0);
});

test('Alt and an arrow on the header grows it a tenth, held to the limits', async ({ page }) => {
  const nat = await box(page, 'big');
  await page.evaluate(() => (document.getElementById('big')!.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  await page.keyboard.press('Alt+ArrowRight');
  expect((await box(page, 'big')).w).toBeCloseTo(nat.w * 1.1, 0);
  await page.keyboard.press('Alt+ArrowLeft');
  await page.keyboard.press('Alt+ArrowLeft');
  expect((await box(page, 'big')).w).toBeCloseTo(nat.w, 0);
});

/* ── In the editor: routes follow, the size is saved, Undo gives it back ── */
const BIND = `async () => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const flow = { v: 2, id: 'g', nodes: [
    { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'users' } },
    { id: 'sort', kind: 'collection', x: 360, y: 0, values: { type: 'sort', field: 'status', direction: 'asc' } },
    { id: 'end', kind: 'output', x: 700, y: 0 },
  ], routes: [{ from: 'start/rows', to: 'sort' }] };
  const canvas = document.getElementById('cv');
  window.ed = bindWorkflow(canvas, flow, { session: new SessionStore(), toolbar: canvas.querySelector('sherpa-node-toolbar'),
    fields: { status: { label: 'Status' } }, stores: ['users'], values: { status: ['active'] } });
  await window.__settled();
  canvas.zoomTo(0.8);
  canvas.panTo(40, 60);
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}`;

test('in the editor a resize is one step, saved as size beside x and y, with the routes still on their sockets; Undo gives it back', async ({ page }) => {
  await page.evaluate(() => { document.querySelector('#root sherpa-layout-canvas')!.remove(); });
  await page.evaluate(() => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 520px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>');
    return customElements.whenDefined('sherpa-node-toolbar');
  });
  await page.evaluate(`(${BIND})()`);
  // The setting "Allow resizing nodes", as the provider hands it on.
  await page.evaluate(() => document.querySelectorAll('#cv > sherpa-node').forEach((n) => n.setAttribute('data-resizable', '')));
  await page.evaluate(() => document.getElementById('cv')!.scrollIntoView({ block: 'start' }));
  const wf = () => page.evaluate(() => JSON.stringify((window as never as { ed: { workflow(): { nodes: unknown[] } } }).ed.workflow().nodes));
  const was = await wf();
  const node = '#cv > sherpa-node[data-heading="Store"]';
  const b = await page.locator(node).boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
  const h = await page.locator(node).evaluate((el) => { const r = el.shadowRoot!.querySelector('.resize')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + 30, h.y + 20, { steps: 4 });
  await page.mouse.move(h.x + 60, h.y + 40, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => window.__settled().then(() => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)))));
  const now = JSON.parse(await wf());
  expect(now[0].size.w).toBeGreaterThan(1);
  expect(now[0].size.h).toBeGreaterThan(1);
  expect(now[0].x).toBe(0);
  // The route leaves from the socket: its start is on the socket's box, within 2px.
  const gap = await page.evaluate(() => {
    const path = document.querySelector<SVGPathElement>('#cv svg.graph-routes path[data-from]')!;
    const p = path.getPointAtLength(0).matrixTransform(path.getScreenCTM()!);
    const row = document.querySelector('#cv > sherpa-node[data-heading="Store"] sherpa-node-row') as Node;
    const s = row.socketRect('output')!;
    return Math.hypot(p.x - (s.left + s.width / 2), p.y - (s.top + s.height / 2));
  });
  expect(gap).toBeLessThanOrEqual(2);
  // Undo: ONE step puts the size back.
  await page.keyboard.press(`${mod}+z`);
  await page.evaluate(() => window.__settled());
  expect(await wf()).toBe(was);
  expect(await page.locator(node).evaluate((el) => el.hasAttribute('data-scale-w'))).toBe(false);
});

test('in forced colours the handle keeps its shape and the shapes stay', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  const b = await box(page, 'big');
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  const r = await page.evaluate(() => getComputedStyle(document.getElementById('big')!.shadowRoot!.querySelector('.resize')!).visibility);
  expect(r).toBe('visible');
});

test('resizing is a setting: off, a node has no handle and Alt+Arrow does nothing, yet a saved size still draws; on, the handle works', async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.querySelector('#root sherpa-layout-canvas')!;
    el.insertAdjacentHTML('beforeend', '<sherpa-node id="plain" data-heading="Plain" data-x="400" data-y="300"></sherpa-node><sherpa-node id="kept" data-heading="Kept" data-scale-w="1.5" data-x="650" data-y="300"></sherpa-node>');
    await (document.getElementById('plain') as Node).rendered;
    await (document.getElementById('kept') as Node).rendered;
    await window.__settled();
  });
  const b = await box(page, 'plain');
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  const off = await page.evaluate(() => {
    const h = document.getElementById('plain')!.shadowRoot!.querySelector('.resize') as HTMLElement;
    return { shown: h.checkVisibility({ checkVisibilityCSS: true }), w: document.getElementById('plain')!.offsetWidth };
  });
  expect(off.shown).toBe(false);
  await page.locator('#plain').evaluate((n) => (n.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  await page.keyboard.press('Alt+ArrowRight');
  await page.evaluate(() => window.__settled());
  expect(await page.evaluate(() => document.getElementById('plain')!.offsetWidth)).toBe(off.w);
  expect(await page.evaluate(() => document.getElementById('plain')!.hasAttribute('data-scale-w'))).toBe(false);
  // A saved size is data: it draws.
  const kept = await page.evaluate(() => [document.getElementById('kept')!.offsetWidth, document.getElementById('plain')!.offsetWidth]);
  expect(kept[0]).toBeGreaterThan(kept[1]! * 1.4);
  // On: Alt+Arrow grows it.
  await page.evaluate(() => document.getElementById('plain')!.setAttribute('data-resizable', ''));
  await page.locator('#plain').evaluate((n) => (n.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  await page.keyboard.press('Alt+ArrowRight');
  await page.evaluate(() => window.__settled());
  expect(await page.evaluate(() => document.getElementById('plain')!.offsetWidth)).toBeGreaterThan(off.w);
});
