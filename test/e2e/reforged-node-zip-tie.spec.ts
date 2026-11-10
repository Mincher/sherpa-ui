import { test, expect, type Page } from './harness';

/**
 * The ZIP TIE tool — Will, TODO 562. With the tool on, a line dragged across connectors ties them
 * at right angles: each passes through the tie in order, a gap between each. A dragged tie moves
 * and its connectors follow; it stops at the nodes its SHORTEST tied route joins. Undo takes it
 * away. With no pointer: T on picked nodes ties (and unties) their routes; Delete on a picked
 * tie removes it. Real pointer and keys; the drawn path's points are read, not its style.
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
      node('s1', 'source', 0, 0), node('e1', 'output', 700, 0),
      node('s2', 'source', 0, 480), node('e2', 'output', 700, 480),
      node('s3', 'source', 0, 960), node('e3', 'output', 700, 960),
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

type Ed = { workflow(): { ties?: { id: string; x: number; y: number; routes: unknown[] }[]; nodes: { id: string; x: number }[] }; undo(): boolean };
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const ties = (page: Page) => page.evaluate(() => (window as never as { ed: Ed }).ed.workflow().ties ?? []);
const press = async (page: Page, name: string) => {
  await page.locator(`sherpa-node-toolbar sherpa-button.${name}`).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
};
/** Each drawn route's points as the plane holds them: where it starts, each piece's end. */
const lines = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#cv > svg.graph-routes path[data-from]')].map((p) => {
  const n = (p.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
  const pts: number[][] = [[n[0]!, n[1]!]];
  for (let i = 2; i + 5 < n.length + 1; i += 6) pts.push([n[i + 4]!, n[i + 5]!]);
  return { from: p.getAttribute('data-from'), pts };
}));
const box = (page: Page, selector: string) => page.evaluate((sel) => { const b = document.querySelector(sel)!.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; }, selector);
async function drag(page: Page, [x1, y1]: [number, number], [x2, y2]: [number, number]): Promise<void> {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await page.mouse.up();
  await settle(page);
}
/** A line across the middle of all three connectors. */
async function across(page: Page): Promise<void> {
  const a = await box(page, '#cv > svg.graph-routes path[data-from="s1/rows"]');
  const c = await box(page, '#cv > svg.graph-routes path[data-from="s3/rows"]');
  const x = (a.left + a.right) / 2;
  await drag(page, [x, a.top - 6], [x, c.bottom + 6]);
}

test('the tool toggles; a line across three connectors ties them, each through its own slot with a gap', async ({ page }) => {
  const tool = page.locator('sherpa-node-toolbar sherpa-button.tie');
  await expect(tool).toHaveAttribute('aria-pressed', 'false');
  await press(page, 'tie');
  await expect(tool).toHaveAttribute('aria-pressed', 'true');
  await across(page);
  const [tie] = await ties(page);
  expect(tie!.routes).toHaveLength(3);
  expect(tie!.routes.map((r) => (r as { from: string }).from)).toEqual(['s1/rows', 's2/rows', 's3/rows']);
  const drawn = await lines(page);
  const mids = drawn.map((l) => l.pts[1]!);
  // They meet the tie's x, in order, a gap of 12 between each, centred on the tie.
  for (const [i, m] of mids.entries()) {
    expect(m[0]).toBeCloseTo(tie!.x, 0);
    expect(m[1]).toBeCloseTo(tie!.y + (i - 1) * 12, 0);
  }
  expect(drawn.every((l) => l.pts.length === 3)).toBe(true);
  expect(await page.locator('#cv > svg.graph-routes rect.graph-tie').count()).toBe(1);
});

test('a dragged tie moves and its connectors follow; it stops at the nodes of its shortest connector', async ({ page }) => {
  await press(page, 'tie');
  await across(page);
  const before = (await ties(page))[0]!;
  const bar = await box(page, '#cv > svg.graph-routes rect.graph-tie');
  const [bx, by] = [(bar.left + bar.right) / 2, (bar.top + bar.bottom) / 2];
  await drag(page, [bx, by], [bx - 40, by + 20]);
  const moved = (await ties(page))[0]!;
  expect(moved.x).toBeLessThan(before.x);
  expect(moved.y).toBeGreaterThan(before.y);
  expect((await lines(page)).every((l) => Math.abs(l.pts[1]![0]! - moved.x) < 1)).toBe(true);
  // Far right: stopped at the left edge of the output nodes (x 700); far left: at the stores' right edge (0 + 240).
  const bar2 = await box(page, '#cv > svg.graph-routes rect.graph-tie');
  await drag(page, [(bar2.left + bar2.right) / 2, (bar2.top + bar2.bottom) / 2], [1090, 300]);
  expect((await ties(page))[0]!.x).toBe(700);
  const bar3 = await box(page, '#cv > svg.graph-routes rect.graph-tie');
  await drag(page, [(bar3.left + bar3.right) / 2, (bar3.top + bar3.bottom) / 2], [10, 300]);
  expect((await ties(page))[0]!.x).toBe(240);
});

test('Undo takes a tie away and Redo puts it back; a cut route leaves the tie', async ({ page }) => {
  await press(page, 'tie');
  await across(page);
  expect(await ties(page)).toHaveLength(1);
  await press(page, 'undo');
  expect(await ties(page)).toHaveLength(0);
  expect((await lines(page)).every((l) => l.pts.length === 2)).toBe(true);
  await press(page, 'redo');
  expect(await ties(page)).toHaveLength(1);
  await page.evaluate(() => (document.getElementById('cv') as HTMLElement).focus());
  await page.locator('#cv > svg.graph-routes polyline.graph-hit[data-from="s2/rows"]').first().dispatchEvent('click');
  await page.keyboard.press('Delete');
  await settle(page);
  expect((await ties(page))[0]!.routes).toHaveLength(2);
});

test('with no pointer: T on picked nodes ties their routes and unties them; Delete on a picked tie removes it', async ({ page }) => {
  const pick = async (id: string) => {
    await page.locator(`#cv > sherpa-node[data-heading="${id}"] >> .header[role="button"]`).focus();
    await page.keyboard.press('Space');
  };
  for (const id of ['s1', 'e1', 's2', 'e2']) await pick(id);
  await page.keyboard.press('t');
  await settle(page);
  expect((await ties(page))[0]!.routes).toHaveLength(2);
  await page.keyboard.press('t');
  await settle(page);
  expect(await ties(page)).toHaveLength(0);
  await page.keyboard.press('t');
  await settle(page);
  expect(await ties(page)).toHaveLength(1);
  // Pick the tie by a press on it, then Delete.
  const bar = await box(page, '#cv > svg.graph-routes rect.graph-tie');
  await page.mouse.click((bar.left + bar.right) / 2, (bar.top + bar.bottom) / 2);
  await page.keyboard.press('ArrowRight');
  await settle(page);
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await ties(page)).toHaveLength(0);
});

test('with two connectors picked, the Zip tie button ties them at once, and the tool stays off', async ({ page }) => {
  // A click on each line's middle: the first picks it, Shift adds the second.
  const mid = (n: number) => page.evaluate((i) => {
    const hit = document.querySelector<SVGGeometryElement>(`#cv > svg.graph-routes .graph-hit[data-from="s${i}/rows"]`)!;
    const p = hit.getPointAtLength(hit.getTotalLength() / 2);
    const m = hit.getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  }, n);
  const a = await mid(1);
  await page.mouse.click(a.x, a.y);
  const b = await mid(2);
  await page.keyboard.down('Shift');
  await page.mouse.click(b.x, b.y);
  await page.keyboard.up('Shift');
  await settle(page);
  await press(page, 'tie');
  expect((await ties(page))[0]!.routes).toHaveLength(2);
  await expect(page.locator('sherpa-node-toolbar')).not.toHaveAttribute('data-tie');
});
