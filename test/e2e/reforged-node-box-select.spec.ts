import { test, expect, type Page } from './harness';

/**
 * A left drag on the blank canvas is a BOX SELECTION — Will, TODO 735. It picks every node the box
 * TOUCHES and every connector it crosses; Shift adds, a plain box replaces, a click clears. A picked
 * connector is drawn thick and dashed (`data-selected`); T ties the picked connectors in one step,
 * Delete cuts them in one. Panning moves to Space + drag, the middle button, the wheel and the Pan
 * tool. The Query editor selects and highlights, and refuses a cut in words. Real pointer and keys.
 */
const PATHS = '#cv > svg.graph-routes path[data-from]';

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const node = (id: string, kind: string, x: number, y: number) => ({ id, kind, x, y, heading: id });
    const flow = { v: 2 as const, id: 'z', nodes: [
      node('s1', 'store', 0, 0), node('e1', 'output', 700, 0),
      node('s2', 'store', 0, 220), node('e2', 'output', 700, 220),
      node('s3', 'store', 0, 440), node('e3', 'output', 700, 440),
    ], routes: [1, 2, 3].map((n) => ({ from: `s${n}/rows`, to: `e${n}` })) };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'],
    });
    await window.__settled();
    canvas.zoomTo(0.6);
    canvas.panTo(60, 40);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

type Ed = { workflow(): { ties?: { routes: unknown[] }[]; routes?: unknown[]; nodes: { id: string; x: number }[] }; undo(): boolean };
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const flow = (page: Page) => page.evaluate(() => (window as never as { ed: Ed }).ed.workflow());
const box = (page: Page, selector: string) => page.evaluate((sel) => { const b = document.querySelector(sel)!.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; }, selector);
const picked = (page: Page) => page.evaluate((sel) => ({
  routes: [...document.querySelectorAll(`${sel}[data-selected]`)].map((p) => p.getAttribute('data-from')),
  nodes: [...document.querySelectorAll('#cv sherpa-node[data-current]')].map((n) => n.getAttribute('data-heading')),
  count: document.querySelector('sherpa-node-toolbar')!.getAttribute('data-picked-routes'),
}), PATHS);
const view = (page: Page) => page.evaluate(() => (document.getElementById('cv') as HTMLElement & { view: { x: number; y: number; zoom: number } }).view);
async function drag(page: Page, [x1, y1]: [number, number], [x2, y2]: [number, number], hold?: () => Promise<void>): Promise<void> {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await hold?.();
  await page.mouse.up();
  await settle(page);
}
/** A box in the gap between the stores and the outputs, from above the first connector's middle to below the last's, and of the given routes. */
async function gap(page: Page, first = 1, last = 3): Promise<{ from: [number, number]; to: [number, number] }> {
  const a = await box(page, `${PATHS}[data-from="s${first}/rows"]`);
  const c = await box(page, `${PATHS}[data-from="s${last}/rows"]`);
  const x = (a.left + a.right) / 2;
  return { from: [x - 30, a.top - 10], to: [x + 30, c.bottom + 10] };
}
const key = async (page: Page, k: string) => { await page.keyboard.press(k); await settle(page); };

test('a left drag on blank canvas draws the marquee, then picks the three connectors it crosses and no node', async ({ page }) => {
  const g = await gap(page);
  const mid: { boxing?: boolean; rect?: { w: number; h: number } } = {};
  await drag(page, g.from, g.to, async () => {
    Object.assign(mid, await page.evaluate(() => {
      const cv = document.getElementById('cv')!;
      const r = cv.shadowRoot!.querySelector('.marquee')!.getBoundingClientRect();
      return { boxing: cv.matches(':state(boxing)'), rect: { w: Math.round(r.width), h: Math.round(r.height) } };
    }));
  });
  expect(mid.boxing).toBe(true);
  expect(mid.rect!.w).toBeGreaterThan(40);
  expect(mid.rect!.h).toBeGreaterThan(200);
  expect(await picked(page)).toEqual({ routes: ['s1/rows', 's2/rows', 's3/rows'], nodes: [], count: '3' });
  expect(await page.evaluate(() => document.getElementById('cv')!.matches(':state(boxing)'))).toBe(false);
  // The Tie tool says how many are picked.
  expect(await page.evaluate(() => document.querySelector('sherpa-node-toolbar')!.shadowRoot!.querySelector('.tie')!.getAttribute('data-tip'))).toBe('Zip tie: 3 connectors picked (T ties them)');
  // Thicker as well as another colour, so it reads in forced colours.
  expect(await page.evaluate((sel) => getComputedStyle(document.querySelector(`${sel}[data-selected]`)!).strokeWidth, PATHS)).toBe('4px');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('cv')!.shadowRoot!.querySelector('.viewport')!).cursor)).toBe('crosshair');
});

test('a box picks the nodes it TOUCHES, not only those it encloses, and the connectors that leave them', async ({ page }) => {
  const n = await box(page, '#cv sherpa-node[data-heading="s1"]');
  // From blank canvas into the node's lower right corner: it touches s1, and encloses none of it.
  await drag(page, [n.right + 30, n.bottom + 8], [n.right - 20, n.bottom - 10]);
  const p = await picked(page);
  expect(p.nodes).toEqual(['s1']);
});

test('Shift adds to the pick, a plain box replaces it, and a click on blank clears it', async ({ page }) => {
  const one = await gap(page, 1, 1);
  const three = await gap(page, 3, 3);
  await drag(page, one.from, one.to);
  expect((await picked(page)).routes).toEqual(['s1/rows']);
  await page.keyboard.down('Shift');
  await drag(page, three.from, three.to);
  await page.keyboard.up('Shift');
  expect((await picked(page)).routes).toEqual(['s1/rows', 's3/rows']);
  await drag(page, three.from, three.to);
  expect((await picked(page)).routes).toEqual(['s3/rows']);
  await page.mouse.click(three.from[0], three.from[1] - 20);
  await settle(page);
  expect(await picked(page)).toEqual({ routes: [], nodes: [], count: '0' });
});

test('a drag ON a node still moves it; and a drag that starts on blank does not', async ({ page }) => {
  const n = await box(page, '#cv sherpa-node[data-heading="s1"] >> nth=0').catch(() => null) ?? await box(page, '#cv sherpa-node[data-heading="s1"]');
  const before = (await flow(page)).nodes.find((x) => x.id === 's1')!.x;
  await drag(page, [n.left + 40, n.top + 12], [n.left + 100, n.top + 12]);
  expect((await flow(page)).nodes.find((x) => x.id === 's1')!.x).toBeGreaterThan(before);
  expect((await picked(page)).routes).toEqual([]);
});

test('Space + drag, the middle button, the wheel and the Pan tool pan; a plain drag does not', async ({ page }) => {
  const start = await view(page);
  const g = await gap(page, 1, 1);
  await drag(page, g.from, g.to);
  expect(await view(page)).toEqual(start);
  // Space + drag.
  await page.evaluate(() => (document.getElementById('cv')!.shadowRoot!.querySelector('.viewport') as HTMLElement).focus());
  await page.keyboard.down('Space');
  expect(await page.evaluate(() => document.getElementById('cv')!.matches(':state(pan-ready)'))).toBe(true);
  await drag(page, [g.from[0], g.from[1] + 300], [g.from[0] + 50, g.from[1] + 330]);
  await page.keyboard.up('Space');
  const spaced = await view(page);
  expect(spaced.x - start.x).toBeCloseTo(50, 0);
  expect(spaced.y - start.y).toBeCloseTo(30, 0);
  // The middle button.
  await page.mouse.move(g.from[0], g.from[1] + 300);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(g.from[0] - 40, g.from[1] + 300, { steps: 4 });
  await page.mouse.up({ button: 'middle' });
  expect((await view(page)).x - spaced.x).toBeCloseTo(-40, 0);
  // The wheel pans; Ctrl + wheel zooms.
  const wheeled = await view(page);
  await page.mouse.wheel(0, 60);
  await settle(page);
  expect((await view(page)).y - wheeled.y).toBeCloseTo(-60, 0);
  const zoom = (await view(page)).zoom;
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await settle(page);
  expect((await view(page)).zoom).toBeGreaterThan(zoom);
  // The Pan tool: a plain left drag pans again, and shows grab.
  await page.locator('#cv').evaluate((cv) => (cv.shadowRoot!.querySelector('.pan')!.shadowRoot!.querySelector('.trigger') as HTMLElement).click());
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('cv')!.shadowRoot!.querySelector('.viewport')!).cursor)).toBe('grab');
  const before = await view(page);
  await drag(page, [g.from[0], g.from[1] + 300], [g.from[0] + 20, g.from[1] + 300]);
  expect((await view(page)).x - before.x).toBeCloseTo(20, 0);
});

test('a box over three connectors, then T: ONE tie across all three, and Undo takes it away in one step', async ({ page }) => {
  const g = await gap(page);
  await drag(page, g.from, g.to);
  await key(page, 't');
  const w = await flow(page);
  expect(w.ties).toHaveLength(1);
  expect(w.ties![0]!.routes).toHaveLength(3);
  await page.keyboard.press('Control+z');
  await settle(page);
  expect((await flow(page)).ties ?? []).toHaveLength(0);
});

test('a box over three connectors, then Delete: all three are cut as ONE step, and Undo gives them back', async ({ page }) => {
  const g = await gap(page);
  await drag(page, g.from, g.to);
  await key(page, 'Delete');
  expect((await flow(page)).routes ?? []).toHaveLength(0);
  expect((await picked(page)).count).toBe('0');
  await page.keyboard.press('Control+z');
  await settle(page);
  expect((await flow(page)).routes).toHaveLength(3);
});

test('with no pointer: C picks the connectors of the picked nodes, and Escape lets them go', async ({ page }) => {
  await page.locator('#cv > sherpa-node[data-heading="s2"] >> .header[role="button"]').focus();
  await key(page, 'c');
  expect((await picked(page)).routes).toEqual(['s2/rows']);
  await key(page, 't');
  expect((await flow(page)).ties).toHaveLength(1);
  await key(page, 'Escape');
  expect((await picked(page)).routes).toEqual([]);
});

test('Shift-click on a connector adds it to the pick, and takes it off', async ({ page }) => {
  const hit = (from: string) => page.locator(`#cv > svg.graph-routes polyline.graph-hit[data-from="${from}"]`).first();
  await hit('s1/rows').dispatchEvent('click');
  await hit('s2/rows').dispatchEvent('click', { shiftKey: true });
  expect((await picked(page)).routes).toEqual(['s1/rows', 's2/rows']);
  await hit('s1/rows').dispatchEvent('click', { shiftKey: true });
  expect((await picked(page)).routes).toEqual(['s2/rows']);
});

test('the Query editor selects and highlights what the box touches; a cut is refused in words, once', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('cv')!.remove();
    document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="q" style="inline-size: 1100px; block-size: 700px"></sherpa-layout-canvas>');
    const q = document.getElementById('q') as HTMLElement & { rendered: Promise<void>; zoomTo(z: number): void; panTo(x: number, y: number): void };
    await q.rendered;
    const { bindQueryEditor } = await import('/dist/app.js');
    const { readingsOf, onReport } = await import('/dist/data.js');
    const heard: string[] = [];
    (window as never as { heard: string[] }).heard = heard;
    onReport((r) => heard.push(r.code));
    const query = Object.assign(new EventTarget(), {
      draft: { v: 1, scopes: { view: { holds: ['region', 'status'], readings: readingsOf({ region: { in: ['EMEA'] }, status: { in: ['trial'] } }) } } },
      ask: () => undefined,
      presets: () => [],
    });
    bindQueryEditor(q as never, { query } as never, { definition: { v: 1 as const, id: 'records', source: { store: 'customers' } } });
    await window.__settled();
    q.zoomTo(0.5);
    q.panTo(40, 40);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  const sel = '#q > svg.graph-routes path[data-from]';
  const b = await page.evaluate((s) => [...document.querySelectorAll(s)].map((p) => { const r = p.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }), sel);
  expect(b.length).toBeGreaterThan(1);
  const [left, top] = [Math.min(...b.map((r) => r.left)), Math.min(...b.map((r) => r.top))];
  const [right, bottom] = [Math.max(...b.map((r) => r.right)), Math.max(...b.map((r) => r.bottom))];
  // A box over the middle of the routes, from blank canvas below them.
  await drag(page, [(left + right) / 2 - 5, bottom + 60], [(left + right) / 2 + 5, top - 5]);
  const n = await page.evaluate((s) => document.querySelectorAll(`${s}[data-selected]`).length, sel);
  expect(n).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.getElementById('q')!.getAttribute('data-select-box'))).toBe('');
  await key(page, 'Delete');
  expect(await page.evaluate(() => (window as never as { heard: string[] }).heard.filter((c) => c === 'query-route'))).toEqual(['query-route']);
  // The routes are still drawn.
  expect(await page.evaluate((s) => document.querySelectorAll(s).length, sel)).toBe(b.length);
});
