import { test, expect, type Page } from './harness';

/**
 * A left drag on the blank canvas is a BOX SELECTION — Will, TODO 735. It picks every node it
 * ENCLOSES whole, or, with none, every connector it crosses (any part of one counts); a plain box replaces, Shift adds nodes AND connectors, Ctrl (Cmd on a Mac) removes both, a click clears (739). A picked
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
      node('s1', 'source', 0, 0), node('e1', 'output', 700, 0),
      node('s2', 'source', 0, 220), node('e2', 'output', 700, 220),
      node('s3', 'source', 0, 440), node('e3', 'output', 700, 440),
    ], routes: [1, 2, 3].map((n) => ({ from: `s${n}/rows`, to: `e${n}` })) };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'],
    });
    await window.__settled();
    canvas.zoomTo(0.6);
    canvas.panTo(60, 88); // below the stage strip
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
  expect(await page.evaluate(() => document.querySelector('sherpa-node-toolbar')!.shadowRoot!.querySelector('.tie')!.getAttribute('data-tip'))).toBe('Tie 3 connectors (T)');
  // Thicker as well as another colour, so it reads in forced colours.
  expect(await page.evaluate((sel) => getComputedStyle(document.querySelector(`${sel}[data-selected]`)!).strokeWidth, PATHS)).toBe('4px');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('cv')!.shadowRoot!.querySelector('.viewport')!).cursor)).toBe('crosshair');
});

test('a box picks a node only when the WHOLE node is inside it; a box that only touches a corner picks no node', async ({ page }) => {
  const n = await box(page, '#cv sherpa-node[data-heading="s1"]');
  // From blank canvas into the node's lower right corner: it touches s1 and encloses none of it.
  await drag(page, [n.right + 30, n.bottom + 8], [n.right - 20, n.bottom - 10]);
  expect((await picked(page)).nodes).toEqual([]);
  // Around the whole node, from blank canvas to blank canvas: it is picked, and no connector with it.
  await drag(page, [n.left - 14, n.top - 14], [n.right + 14, n.bottom + 14]);
  const whole = await picked(page);
  expect(whole.nodes).toEqual(['s1']);
  expect(whole.routes).toEqual([]);
});

test('a box that encloses a node picks only nodes; one that encloses none picks only the connectors it crosses, any part of them', async ({ page }) => {
  const n = await box(page, '#cv sherpa-node[data-heading="s1"]');
  // Over s1 whole and across the connector that leaves it: the node only.
  const three = await gap(page, 1, 3);
  await drag(page, [n.left - 14, n.top - 14], [Math.max(three.to[0], n.right + 14), n.bottom + 14]);
  const mixed = await picked(page);
  expect(mixed.nodes).toEqual(['s1']);
  expect(mixed.routes).toEqual([]);
  // A thin box over the middle of one connector, enclosing no node: that connector, and no node.
  const one = await gap(page, 2, 2);
  await drag(page, one.from, one.to);
  expect(await picked(page)).toMatchObject({ routes: ['s2/rows'], nodes: [], count: '1' });
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

const primary = (page: Page) => page.evaluate(() => /mac|iphone|ipad/i.test(navigator.platform) ? 'Meta' : 'Control');
const mode = (page: Page) => page.evaluate(() => document.getElementById('cv')!.shadowRoot!.querySelector('.viewport')!.getAttribute('data-mode'));
async function around(page: Page, id: string): Promise<{ from: [number, number]; to: [number, number] }> {
  const n = await box(page, `#cv sherpa-node[data-heading="${id}"]`);
  return { from: [n.left - 14, n.top - 14], to: [n.right + 40, n.bottom + 14] };
}

test('Shift: a box that encloses a node and crosses connectors picks BOTH, added to the pick', async ({ page }) => {
  const two = await gap(page, 2, 2);
  await drag(page, two.from, two.to);
  expect((await picked(page)).routes).toEqual(['s2/rows']);
  const s1 = await around(page, 's1');
  await page.keyboard.down('Shift');
  await drag(page, s1.from, s1.to);
  await page.keyboard.up('Shift');
  const now = await picked(page);
  expect(now.nodes).toEqual(['s1']);
  expect([...now.routes].sort()).toEqual(['s1/rows', 's2/rows']);
  expect(now.count).toBe('2');
  // A plain box over the same place: the node only, and the pick is replaced.
  await drag(page, s1.from, s1.to);
  expect(await picked(page)).toMatchObject({ nodes: ['s1'], routes: [] });
});

test('Ctrl (Cmd on a Mac): a box removes the picked connectors and nodes it covers, and leaves the rest', async ({ page }) => {
  const key = await primary(page);
  await drag(page, ...Object.values(await gap(page, 1, 3)) as [[number, number], [number, number]]);
  const s1 = await around(page, 's1');
  await page.keyboard.down('Shift');
  await drag(page, s1.from, s1.to);
  await page.keyboard.up('Shift');
  expect(await picked(page)).toMatchObject({ nodes: ['s1'], count: '3' });
  // Over s2's connector alone: just that one goes.
  const two = await gap(page, 2, 2);
  await page.keyboard.down(key);
  await drag(page, two.from, two.to);
  await page.keyboard.up(key);
  const after = await picked(page);
  expect(after.nodes).toEqual(['s1']);
  expect([...after.routes].sort()).toEqual(['s1/rows', 's3/rows']);
  // Over s1 and its connector: both go; s3's stays.
  await page.keyboard.down(key);
  await drag(page, s1.from, s1.to);
  await page.keyboard.up(key);
  expect(await picked(page)).toMatchObject({ nodes: [], routes: ['s3/rows'], count: '1' });
  // Over things that are not picked: nothing changes.
  await page.keyboard.down(key);
  await drag(page, two.from, two.to);
  await page.keyboard.up(key);
  expect(await picked(page)).toMatchObject({ nodes: [], routes: ['s3/rows'], count: '1' });
  // Shift and Ctrl together remove too.
  const three = await gap(page, 3, 3);
  await page.keyboard.down('Shift');
  await page.keyboard.down(key);
  await drag(page, three.from, three.to);
  await page.keyboard.up(key);
  await page.keyboard.up('Shift');
  expect((await picked(page)).routes).toEqual([]);
});

test('the marquee shows its mode while dragging, and a key pressed mid-drag changes it', async ({ page }) => {
  const key = await primary(page);
  const g = await gap(page, 1, 1);
  const seen: Record<string, unknown> = {};
  await drag(page, g.from, g.to, async () => { seen.plain = await mode(page); });
  expect(seen.plain).toBe('replace');
  await page.keyboard.down('Shift');
  await drag(page, g.from, g.to, async () => {
    seen.add = await mode(page);
    seen.addCursor = await page.evaluate(() => getComputedStyle(document.getElementById('cv')!.shadowRoot!.querySelector('.viewport')!).cursor);
    seen.addStyle = await page.evaluate(() => getComputedStyle(document.getElementById('cv')!.shadowRoot!.querySelector('.marquee')!).borderTopStyle);
  });
  await page.keyboard.up('Shift');
  expect(seen.add).toBe('add');
  expect(seen.addCursor).toBe('copy');
  expect(seen.addStyle).toBe('solid');
  await drag(page, g.from, g.to, async () => {
    await page.keyboard.down(key);
    seen.live = await mode(page);
    seen.liveCursor = await page.evaluate(() => getComputedStyle(document.getElementById('cv')!.shadowRoot!.querySelector('.viewport')!).cursor);
    await page.keyboard.up(key);
    seen.back = await mode(page);
  });
  expect(seen.live).toBe('remove');
  expect(seen.liveCursor).toBe('not-allowed');
  expect(seen.back).toBe('replace');
});

test('Shift+C adds the connectors of the picked nodes to the pick; Alt+C takes them off', async ({ page }) => {
  const three = await gap(page, 3, 3);
  await drag(page, three.from, three.to);
  await page.locator('#cv > sherpa-node[data-heading="s2"] >> .header[role="button"]').focus();
  await key(page, 'Shift+C');
  expect((await picked(page)).routes.sort()).toEqual(['s2/rows', 's3/rows']);
  await key(page, 'Alt+c');
  expect((await picked(page)).routes).toEqual(['s3/rows']);
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
  await page.keyboard.press(`${await primary(page)}+z`);
  await settle(page);
  expect((await flow(page)).ties ?? []).toHaveLength(0);
});

test('a box over three connectors, then Delete: all three are cut as ONE step, and Undo gives them back', async ({ page }) => {
  const g = await gap(page);
  await drag(page, g.from, g.to);
  await key(page, 'Delete');
  expect((await flow(page)).routes ?? []).toHaveLength(0);
  expect((await picked(page)).count).toBe('0');
  await page.keyboard.press(`${await primary(page)}+z`);
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

test('the Query editor selects and highlights what the box encloses or crosses; a cut is refused in words, once', async ({ page }) => {
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

// — 756: a box picks, and opens no panel; a click on one node still opens it.
const panel = (page: Page) => page.evaluate(() => {
  const p = document.getElementById('inspector') as HTMLElement & { open: boolean };
  return { open: p.open, tab: p.getAttribute('data-mode') === 'tab', heading: p.getAttribute('data-heading') };
});
const header = async (page: Page, id: string): Promise<[number, number]> => {
  const n = await box(page, `#cv sherpa-node[data-heading="${id}"]`);
  return [(n.left + n.right) / 2, n.top + 8];
};

test('756: a box picks one node or several with the panel a tab, and the toolbar acts on them; a click fills it; open, a box shows what it picked', async ({ page }) => {
  const [a, b] = [await box(page, '#cv sherpa-node[data-heading="s1"]'), await box(page, '#cv sherpa-node[data-heading="s2"]')];
  await drag(page, [a.left - 14, a.top - 14], [a.right + 14, a.bottom + 14]);
  expect((await picked(page)).nodes).toEqual(['s1']);
  expect((await panel(page)).tab).toBe(true);
  // Two: picked, no panel, and Arrange may be pressed.
  await drag(page, [a.left - 14, a.top - 14], [b.right + 14, b.bottom + 14]);
  expect((await picked(page)).nodes).toEqual(['s1', 's2']);
  expect((await panel(page)).tab).toBe(true);
  await expect(page.locator('sherpa-node-toolbar')).toHaveAttribute('data-can-arrange', '');
  // A redraw (the two moved by the keys) still opens nothing.
  await key(page, 'ControlOrMeta+ArrowRight');
  expect((await flow(page)).nodes.find((n) => n.id === 's1')!.x).toBe(8);
  expect((await panel(page)).tab).toBe(true);
  // Shift and a click adds a third to the box's two: a click, so the panel fills with a tab each.
  const [sx, sy] = await header(page, 's3');
  await page.keyboard.down('Shift');
  await page.mouse.click(sx, sy);
  await page.keyboard.up('Shift');
  await settle(page);
  expect((await picked(page)).nodes).toEqual(['s1', 's2', 's3']);
  expect(await panel(page)).toEqual({ open: true, tab: true, heading: '3 nodes picked' });
  // A click on blank puts the empty state back; a click on one node fills it with that node.
  await page.mouse.click(a.right + 60, a.top - 20);
  await settle(page);
  expect(await panel(page)).toEqual({ open: true, tab: true, heading: 'Details' });
  await expect(page.locator('#inspector sherpa-empty-state')).toHaveCount(1);
  const [hx, hy] = await header(page, 'e1');
  await page.mouse.click(hx, hy);
  await settle(page);
  expect(await panel(page)).toEqual({ open: true, tab: true, heading: 'e1' });
  // Open, a box over one node shows that node; over two, a tab each.
  await drag(page, [b.left - 14, b.top - 14], [b.right + 14, b.bottom + 14]);
  expect(await panel(page)).toEqual({ open: true, tab: true, heading: 's2' });
  await drag(page, [a.left - 14, a.top - 14], [b.right + 14, b.bottom + 14]);
  expect(await panel(page)).toEqual({ open: true, tab: true, heading: '2 nodes picked' });
  expect((await picked(page)).nodes).toEqual(['s1', 's2']);
});

test('756: in the Query editor a box picks with the panel a tab; a click on a node fills it', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('cv')!.remove();
    document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>');
    const q = document.getElementById('cv') as HTMLElement & { rendered: Promise<void>; zoomTo(z: number): void; panTo(x: number, y: number): void };
    await q.rendered;
    const { bindQueryEditor } = await import('/dist/app.js');
    const { QueryContext, VIEW } = await import('/dist/data.js');
    const query = new QueryContext();
    query.ask({ scope: VIEW, hold: ['region'] });
    query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EMEA'] } });
    bindQueryEditor(q as never, { query } as never, { definition: { v: 1 as const, id: 'records', source: { store: 'customers' } }, inspector: document.getElementById('inspector') as never, toolbar: q.querySelector('sherpa-node-toolbar') as never });
    await window.__settled();
    q.zoomTo(0.6);
    q.panTo(40, 88); // below the stage strip
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  const first = await page.evaluate(() => document.querySelector('#cv > sherpa-node')!.getAttribute('data-heading')!);
  const n = await box(page, `#cv sherpa-node[data-heading="${first}"]`);
  await drag(page, [n.left - 14, n.top - 14], [n.right + 14, n.bottom + 14]);
  expect((await picked(page)).nodes).toEqual([first]);
  expect((await panel(page)).tab).toBe(true);
  await page.mouse.click((n.left + n.right) / 2, n.top + 8);
  await settle(page);
  expect(await panel(page)).toEqual({ open: true, tab: true, heading: first });
});
