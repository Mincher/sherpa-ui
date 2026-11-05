import { test, expect, type Page } from './harness';

/**
 * BEND POINTS and the zip tie, Will TODO 744. Hover a connector and a handle shows at its middle; drag it and
 * the connector bends through the point, each half with its own handle. Click a handle to pick it (active
 * styling, read as PIXELS); Delete removes it; the last one clears the bend and the connector is the default
 * again; Undo restores. A picked tie has the active fill and a drop shadow. A connector LINE dragged onto a tie
 * joins it; let go elsewhere nothing moves; a click still picks. Real pointer and keys.
 */
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
    ], routes: [1, 2].map((n) => ({ from: `s${n}/rows`, to: `e${n}` })) };
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

type Ed = { workflow(): { routes: { from: string; to: string; via?: { x: number; y: number }[] }[]; ties?: { id: string; routes: unknown[] }[] }; undo(): boolean };
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const routes = (page: Page) => page.evaluate(() => (window as never as { ed: Ed }).ed.workflow().routes);
const ties = (page: Page) => page.evaluate(() => (window as never as { ed: Ed }).ed.workflow().ties ?? []);
const R1 = '#cv > svg.graph-routes path[data-from="s1/rows"]';
const centre = (page: Page, selector: string) => page.evaluate((sel) => { const b = document.querySelector(sel)!.getBoundingClientRect(); return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }; }, selector);
const handles = (page: Page, from = 's1/rows') => page.evaluate((f) => [...document.querySelectorAll(`#cv > svg.graph-routes g.graph-route[data-from="${f}"] .graph-handle`)].map((h) => {
  const b = h.querySelector('.graph-handle-dot')!.getBoundingClientRect();
  return { mid: (h as SVGElement).dataset['mid'], bend: (h as SVGElement).dataset['bend'], shown: getComputedStyle(h).visibility, selected: h.hasAttribute('data-selected'), x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
}), from);
/** The path's sampled points on the screen. */
const sampled = (page: Page, from = 's1/rows') => page.evaluate((f) => {
  const p = document.querySelector<SVGPathElement>(`#cv > svg.graph-routes path[data-from="${f}"]`)!;
  const m = p.getScreenCTM()!;
  const len = p.getTotalLength();
  return Array.from({ length: 121 }, (_, i) => { const q = p.getPointAtLength((len * i) / 120); return { x: m.a * q.x + m.e, y: m.d * q.y + m.f }; });
}, from);
/** The path's `d`, to the pixel: the sockets settle to a fraction of one. */
const dOf = (page: Page, from = 's1/rows') => page.locator(`#cv > svg.graph-routes path[data-from="${from}"]`).getAttribute('d').then((d) => (d ?? '').replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n)))));
async function drag(page: Page, [x1, y1]: [number, number], [x2, y2]: [number, number]): Promise<void> {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await page.mouse.up();
  await settle(page);
}
/** One pixel of the page, as [r, g, b]. */
const pixel = (page: Page, x: number, y: number) => page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } })
  .then((png) => page.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(1, 1).getContext('2d')!;
    c.drawImage(bitmap, 0, 0);
    return [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }, png.toString('base64')));
/** Bend the first connector by dragging its middle handle to a point. */
async function bendTo(page: Page, dx: number, dy: number): Promise<{ x: number; y: number }> {
  const mid = await centre(page, R1);
  await page.mouse.move(mid.x, mid.y);
  const to = { x: mid.x + dx, y: mid.y + dy };
  await drag(page, [mid.x, mid.y], [to.x, to.y]);
  return to;
}

test('a handle shows at the middle of a connector on hover, and not without it', async ({ page }) => {
  const mid = await centre(page, R1);
  await page.mouse.move(5, 5);
  const before = await handles(page);
  expect(before).toHaveLength(1);
  expect(before[0]!.shown).toBe('hidden');
  await page.mouse.move(mid.x - 60, mid.y - 1);
  await page.mouse.move(mid.x, mid.y);
  const on = await handles(page);
  expect(on[0]!.shown).toBe('visible');
  expect(Math.hypot(on[0]!.x - mid.x, on[0]!.y - mid.y)).toBeLessThan(2);
  // Hovering saved nothing.
  expect((await routes(page))[0]!.via).toBeUndefined();
  await page.mouse.move(5, 5);
  expect((await handles(page))[0]!.shown).toBe('hidden');
});

test('dragging the handle bends the connector through the point, and each half gets its own handle; Undo restores', async ({ page }) => {
  const d0 = await dOf(page);
  const to = await bendTo(page, 20, 90);
  const dots = await sampled(page);
  expect(Math.min(...dots.map((p) => Math.hypot(p.x - to.x, p.y - to.y)))).toBeLessThan(2);
  expect((await routes(page))[0]!.via).toHaveLength(1);
  // The saved point is in plane px; the next mid handles sit at the halves' middles.
  await page.mouse.move(to.x, to.y);
  const hs = await handles(page);
  expect(hs.filter((h) => h.mid !== undefined)).toHaveLength(2);
  expect(hs.filter((h) => h.bend !== undefined)).toHaveLength(1);
  // The second bend, on the first half's handle: now two points.
  const first = hs.find((h) => h.mid === '0')!;
  await drag(page, [first.x, first.y], [first.x - 10, first.y + 60]);
  expect((await routes(page))[0]!.via).toHaveLength(2);
  expect((await routes(page))[0]!.via![0]!.x).toBeLessThanOrEqual((await routes(page))[0]!.via![1]!.x);
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect((await routes(page))[0]!.via).toHaveLength(1);
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect((await routes(page))[0]!.via).toBeUndefined();
  expect(await dOf(page)).toBe(d0);
});

test('a click picks a handle (active styling, read as pixels); Delete removes it and the last one resets the connector', async ({ page }) => {
  const d0 = await dOf(page);
  const to = await bendTo(page, 0, 100);
  await page.mouse.move(to.x, to.y);
  const pick = (await handles(page)).find((h) => h.bend !== undefined)!;
  await page.mouse.move(pick.x, pick.y);
  // The drag picked it; Escape lets go, and a hovered, unpicked dot is the resting one.
  await page.keyboard.press('Escape');
  await settle(page);
  expect((await handles(page)).find((h) => h.bend !== undefined)!.selected).toBe(false);
  const rest = await pixel(page, pick.x, pick.y);
  await page.mouse.down();
  await page.mouse.up();
  await settle(page);
  expect((await handles(page)).find((h) => h.bend !== undefined)!.selected).toBe(true);
  await page.mouse.move(5, 5);
  const picked = await pixel(page, pick.x, pick.y);
  // The picked dot is the active accent: not the white a resting one is.
  expect(picked).not.toEqual(rest);
  expect(picked[2]! - picked[0]!).toBeGreaterThan(40);
  await page.keyboard.press('Delete');
  await settle(page);
  expect((await routes(page))[0]!.via).toBeUndefined();
  expect(await dOf(page)).toBe(d0);
  expect(await handles(page)).toHaveLength(1);
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect((await routes(page))[0]!.via).toHaveLength(1);
});

test('a click on a line still picks the route; with a route picked B picks the proposed middle dot, and the first arrow moves it in', async ({ page }) => {
  const d0 = await dOf(page);
  await page.evaluate(() => (document.getElementById('cv') as HTMLElement).focus());
  await page.locator('#cv > svg.graph-routes polyline.graph-hit[data-from="s1/rows"]').first().dispatchEvent('click');
  await expect(page.locator(R1)).toHaveAttribute('data-selected', '');
  await page.keyboard.press('b');
  await settle(page);
  // 754: a dot nobody moved is only proposed: picked, it is saved nowhere and the curve is the default.
  expect((await routes(page))[0]!.via).toBeUndefined();
  expect(await dOf(page)).toBe(d0);
  expect((await handles(page)).find((h) => h.mid === '0')!.selected).toBe(true);
  // The first arrow moves it in, from the middle of the plane's ends.
  const ends = ((await page.locator(R1).getAttribute('d'))!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const middle = { x: (ends[0]! + ends.at(-2)!) / 2, y: (ends[1]! + ends.at(-1)!) / 2 };
  await page.keyboard.press('ArrowDown');
  await settle(page);
  const via = (await routes(page))[0]!.via!;
  expect(via).toHaveLength(1);
  expect(Math.abs(via[0]!.x - middle.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(via[0]!.y - (middle.y + 8))).toBeLessThanOrEqual(1);
  expect((await handles(page)).find((h) => h.bend === '0')!.selected).toBe(true);
  await page.keyboard.press('Shift+ArrowRight');
  await settle(page);
  const moved = (await routes(page))[0]!.via![0]!;
  expect(moved.y - via[0]!.y).toBe(0);
  expect(moved.x - via[0]!.x).toBe(32);
  await page.keyboard.press('Delete');
  await settle(page);
  expect((await routes(page))[0]!.via).toBeUndefined();
});

test('754: drag one dot and only that point is saved; drag another and the first stays, and the halves\' dots are not saved', async ({ page }) => {
  const plane = (x: number, y: number) => page.evaluate(([x, y]) => {
    const cv = document.getElementById('cv') as HTMLElement & { view: { x: number; y: number; zoom: number } };
    const b = cv.getBoundingClientRect();
    return { x: (x - b.left - cv.view.x) / cv.view.zoom, y: (y - b.top - cv.view.y) / cv.view.zoom };
  }, [x, y] as const);
  const to = await bendTo(page, 20, 90);
  const first = (await routes(page))[0]!.via!;
  expect(first).toHaveLength(1);
  const at = await plane(to.x, to.y);
  expect(Math.hypot(first[0]!.x - at.x, first[0]!.y - at.y)).toBeLessThan(3);
  // Hovered, each half shows its proposed dot; neither is saved.
  await page.mouse.move(to.x, to.y);
  const hs = await handles(page);
  expect(hs.filter((h) => h.mid !== undefined).map((h) => h.shown)).toEqual(['visible', 'visible']);
  expect((await routes(page))[0]!.via).toEqual(first);
  // The right half's dot: one more point, and the first is as the reader left it.
  const right = hs.find((h) => h.mid === '1')!;
  const to2 = { x: right.x + 10, y: right.y - 60 };
  await drag(page, [right.x, right.y], [to2.x, to2.y]);
  const after = (await routes(page))[0]!.via!;
  expect(after).toHaveLength(2);
  expect(after[0]).toEqual(first[0]);
  const at2 = await plane(to2.x, to2.y);
  expect(Math.hypot(after[1]!.x - at2.x, after[1]!.y - at2.y)).toBeLessThan(3);
  // Three proposed dots now, at the three pieces' middles; still only the two points saved.
  await page.mouse.move(to2.x, to2.y);
  expect((await handles(page)).filter((h) => h.mid !== undefined)).toHaveLength(3);
  expect((await routes(page))[0]!.via).toEqual(after);
  // The first point dragged: its neighbour does not move.
  const one = (await handles(page)).find((h) => h.bend === '0')!;
  await drag(page, [one.x, one.y], [one.x + 6, one.y - 40]);
  const last = (await routes(page))[0]!.via!;
  expect(last).toHaveLength(2);
  expect(last[1]).toEqual(after[1]);
  expect(last[0]).not.toEqual(after[0]);
});

async function tie(page: Page): Promise<void> {
  await page.locator('sherpa-node-toolbar sherpa-button.tie').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  const a = await centre(page, R1);
  const b = await page.evaluate(() => { const r = document.querySelector('#cv > svg.graph-routes path[data-from="s2/rows"]')!.getBoundingClientRect(); return { y: r.bottom + 6 }; });
  // A tie across the FIRST connector alone.
  await drag(page, [a.x, a.y - 40], [a.x, a.y + 40]);
  await page.locator('sherpa-node-toolbar sherpa-button.tie').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  void b;
  await settle(page);
}

test('a picked tie has the active fill and a drop shadow', async ({ page }) => {
  await tie(page);
  expect(await ties(page)).toHaveLength(1);
  const bar = page.locator('#cv > svg.graph-routes rect.graph-tie');
  const box = await bar.boundingBox();
  const [cx, cy] = [box!.x + box!.width / 2, box!.y + box!.height / 2];
  const rest = await pixel(page, cx, cy);
  await page.mouse.click(cx, cy);
  await settle(page);
  await expect(bar).toHaveAttribute('data-selected', '');
  await page.mouse.move(5, 5);
  const fill = await pixel(page, cx, cy);
  expect(fill).not.toEqual(rest);
  expect(fill[2]! - fill[0]!).toBeGreaterThan(40);
  // Zoomed in, the shadow is wide enough to read: it falls right of the bar and below it, so the pixel there is darker than the page.
  const at = (await ties(page))[0] as unknown as { x: number; y: number };
  await page.evaluate((t) => {
    const cv = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    cv.zoomTo(3);
    cv.panTo(500 - t.x * 3, 300 - t.y * 3);
  }, at);
  await settle(page);
  const big = (await bar.boundingBox())!;
  const around = await pixel(page, big.x + big.width + 4, big.y + big.height + 2);
  const far = await pixel(page, big.x + big.width + 60, big.y + big.height + 60);
  expect(around[0]! + around[1]! + around[2]!).toBeLessThan(far[0]! + far[1]! + far[2]! - 15);
});

test('a connector line dragged onto a tie joins it; let go elsewhere, nothing moves', async ({ page }) => {
  await tie(page);
  const bar = (await page.locator('#cv > svg.graph-routes rect.graph-tie').boundingBox())!;
  const [bx, by] = [bar.x + bar.width / 2, bar.y + bar.height / 2];
  // A quarter of the way along connector 2: off its middle handle.
  const two = (await sampled(page, 's2/rows'))[30]!;
  const d2 = await dOf(page, 's2/rows');
  // Onto blank canvas: nothing.
  await drag(page, [two.x, two.y], [two.x + 30, two.y + 120]);
  expect((await ties(page))[0]!.routes).toHaveLength(1);
  expect(await dOf(page, 's2/rows')).toBe(d2);
  expect((await routes(page)).every((r) => r.via === undefined)).toBe(true);
  // Onto the tie: joined, and its path is two pieces.
  await page.mouse.move(two.x, two.y);
  await page.mouse.down();
  await page.mouse.move(two.x + 5, two.y - 20, { steps: 3 });
  await page.mouse.move(bx, by, { steps: 6 });
  await expect(page.locator('#cv > svg.graph-routes rect.graph-tie')).toHaveAttribute('data-target', '');
  await page.mouse.up();
  await settle(page);
  expect((await ties(page))[0]!.routes).toHaveLength(2);
  expect((((await dOf(page, 's2/rows')) ?? '').match(/C/g) ?? []).length).toBe(2);
  // Once more: it is in already, so it is refused and the tie stays two.
  const again = (await sampled(page, 's2/rows'))[10]!;
  await drag(page, [again.x, again.y], [bx, by]);
  expect((await ties(page))[0]!.routes).toHaveLength(2);
});

test('754: a tied connector shows no mid-point dot, an untied one does; a tie takes a connector\'s bends away, and B picks its tie', async ({ page }) => {
  const tool = () => page.locator('sherpa-node-toolbar sherpa-button.tie').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  const shown = async (from: string, at: { x: number; y: number }) => {
    await page.mouse.move(at.x - 30, at.y - 30);
    await page.mouse.move(at.x, at.y);
    return (await handles(page, from)).filter((h) => h.shown === 'visible').length;
  };
  // Both bent, by the reader.
  await bendTo(page, 0, 40);
  const two = await centre(page, '#cv > svg.graph-routes path[data-from="s2/rows"]');
  await page.mouse.move(two.x, two.y);
  await drag(page, [two.x, two.y], [two.x + 10, two.y + 60]);
  expect((await routes(page)).map((r) => r.via?.length)).toEqual([1, 1]);
  // A tie across the first, a quarter of the way along it: its bend goes, in the one step.
  const q = (await sampled(page))[30]!;
  await tool();
  await drag(page, [q.x, q.y - 40], [q.x, q.y + 40]);
  await tool();
  await settle(page);
  expect(await ties(page)).toHaveLength(1);
  expect((await routes(page)).map((r) => r.via?.length)).toEqual([undefined, 1]);
  // Hovered, the tied connector has no dot at all; the untied one shows its own.
  expect(await handles(page)).toHaveLength(0);
  expect(await shown('s1/rows', (await sampled(page))[20]!)).toBe(0);
  expect(await shown('s2/rows', (await sampled(page, 's2/rows'))[20]!)).toBeGreaterThan(0);
  // The second dropped on the tie: its bend goes too, and it has no dot.
  const bar = (await page.locator('#cv > svg.graph-routes rect.graph-tie').boundingBox())!;
  const on = (await sampled(page, 's2/rows'))[10]!;
  await drag(page, [on.x, on.y], [bar.x + bar.width / 2, bar.y + bar.height / 2]);
  expect((await ties(page))[0]!.routes).toHaveLength(2);
  expect((await routes(page)).every((r) => r.via === undefined)).toBe(true);
  expect(await handles(page, 's2/rows')).toHaveLength(0);
  // No pointer: with a tied connector picked, B picks its tie, and the arrows move it.
  await page.evaluate(() => (document.getElementById('cv') as HTMLElement).focus());
  await page.locator('#cv > svg.graph-routes polyline.graph-hit[data-from="s1/rows"]').first().dispatchEvent('click');
  await page.keyboard.press('b');
  await settle(page);
  await expect(page.locator('#cv > svg.graph-routes rect.graph-tie')).toHaveAttribute('data-selected', '');
  const y0 = ((await ties(page))[0] as unknown as { y: number }).y;
  await page.keyboard.press('ArrowDown');
  await settle(page);
  expect(((await ties(page))[0] as unknown as { y: number }).y).toBe(y0 + 8);
  // Undo gives the first its bend back with the tie gone: three steps (tie, drop, move).
  for (let i = 0; i < 3; i++) await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect(await ties(page)).toHaveLength(0);
  expect((await routes(page)).map((r) => r.via?.length)).toEqual([1, 1]);
});

test('a drag on blank canvas still boxes, and the Tie tool still ties', async ({ page }) => {
  const a = await centre(page, R1);
  await drag(page, [a.x - 20, a.y - 25], [a.x + 20, a.y + 25]);
  await expect(page.locator(R1)).toHaveAttribute('data-selected', '');
  await tie(page);
  expect(await ties(page)).toHaveLength(1);
});

test('TODO 750: a handle dragged past the target socket stops a way short of it, and the last piece is not vertical', async ({ page }) => {
  const mid = await centre(page, R1);
  await page.mouse.move(mid.x, mid.y);
  await drag(page, [mid.x, mid.y], [1080, mid.y + 80]);
  const via = (await routes(page))[0]!.via!;
  // The target node starts at x 700 on the plane: the point stays 16px inside it.
  expect(via[0]!.x).toBe(684);
  const dots = await sampled(page);
  const end = dots.at(-1)!;
  const dot = (await handles(page)).find((h) => h.bend !== undefined)!;
  // The dot sits on the path, left of the end socket by the inset (16 * 0.6 zoom).
  expect(Math.abs(end.x - dot.x - 16 * 0.6)).toBeLessThan(3);
  // The last piece runs sideways: its start is well left of its end.
  expect(end.x - dot.x).toBeGreaterThan(6);
});
