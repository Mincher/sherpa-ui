import { test, expect, type Page } from './harness';

/**
 * A STAGE MOVES ON — Will, TODO 985: "Holding Cmd/Ctrl while dragging the left edge of a Stage should move both edges and
 * maintain the Stage width. All Stages to the right of the affected Stage should also move and maintain width." The edge
 * between two stages is the left edge of the one after: held with Cmd/Ctrl, it moves that stage and every stage after it,
 * each width kept, their nodes and their ties with them, the one before it as much wider; one Undo. The first stage has a
 * start edge of its own: plain, its right edge stays; with Cmd/Ctrl, every stage moves. Real pointer and keys.
 */
const N = (id: string, kind: string, x: number, stage: string, values?: Record<string, unknown>) => ({ id, kind, x, y: 0, heading: id, stage, ...(values ? { values } : {}) });
const FLOW = {
  v: 3, id: 'on',
  stages: [{ id: 'a', label: 'Read', x: -40 }, { id: 'b', label: 'Test', x: 700 }, { id: 'c', label: 'Send', x: 1400 }],
  nodes: [N('s', 'source', 0, 'a', { store: 'users' }), N('k', 'condition', 860, 'b', { type: 'empty' }), N('o', 'result', 1460, 'c')],
  connections: [{ from: 's/rows', to: 'k' }, { from: 'k/pass', to: 'o' }],
  ties: [{ id: 't', x: 1260, y: 80, connections: [{ from: 'k/pass', to: 'o' }] }],
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (flow) => {
    document.getElementById('root')!.innerHTML = `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 560px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`;
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'],
    });
    await window.__settled();
    canvas.zoomTo(0.5);
    canvas.panTo(120, 60);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, FLOW);
});

type Kept = { nodes: { id: string; x: number }[]; ties?: { id: string; x: number }[] };
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const stage = (page: Page, n: number) => page.locator('#cv > sherpa-node-stage').nth(n);
/** Each stage as drawn, [left, width]; each node and tie as kept. */
const state = (page: Page) => page.evaluate(() => {
  const kept = (window as never as { ed: { workflow(): Kept } }).ed.workflow();
  return {
    bands: [...document.querySelectorAll('#cv > sherpa-node-stage')].map((el) => [Number(el.getAttribute('data-x')), Number(el.getAttribute('data-w'))]),
    nodes: Object.fromEntries(kept.nodes.filter((n) => !n.id.startsWith('#')).map((n) => [n.id, n.x])),
    tie: kept.ties?.find((t) => t.id === 't')?.x,
  };
});
const undo = (page: Page) => page.locator('sherpa-node-toolbar sherpa-button.undo').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
/** Drag an edge `by` screen px along, with Cmd/Ctrl held where `moves`. At a zoom of 0.5, 50 screen px are 100 plane px. */
async function drag(page: Page, edge: ReturnType<Page['locator']>, by: number, moves: boolean): Promise<void> {
  const box = (await edge.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  if (moves) await page.keyboard.down('ControlOrMeta');
  await page.mouse.down();
  await page.mouse.move(x + by / 2, y, { steps: 4 });
  await page.mouse.move(x + by, y, { steps: 4 });
  await page.mouse.up();
  if (moves) await page.keyboard.up('ControlOrMeta');
  await settle(page);
}

test('Cmd/Ctrl on the edge between two stages moves the one after and every one after it, each width kept, their nodes and ties with them; one Undo', async ({ page }) => {
  const was = await state(page);
  const [[a, aw], [b, bw], [c, cw]] = was.bands as [[number, number], [number, number], [number, number]];
  await drag(page, stage(page, 0).locator('.edge'), 50, true);
  const now = await state(page);
  expect(now.bands).toEqual([[a, aw + 100], [b + 100, bw], [c + 100, cw]]);
  expect(now.nodes).toEqual({ s: was.nodes['s'], k: was.nodes['k']! + 100, o: was.nodes['o']! + 100 });
  expect(now.tie).toBe(was.tie! + 100);
  // Back: the stages after it come back with it, and no further than its own node lets it.
  await drag(page, stage(page, 0).locator('.edge'), -50, true);
  expect(await state(page)).toEqual(was);
  await drag(page, stage(page, 0).locator('.edge'), -50, true);
  expect(await state(page)).toEqual(was);
  // One step each: Undo the back, then the on, and it stands as it was.
  await undo(page);
  await settle(page);
  expect((await state(page)).bands).toEqual(now.bands);
  await undo(page);
  await settle(page);
  expect(await state(page)).toEqual(was);
  // Without Cmd/Ctrl the edge is the old one: the next stage narrows, no node moves (TODO 900).
  await drag(page, stage(page, 0).locator('.edge'), 50, false);
  const plain = await state(page);
  expect(plain.bands).toEqual([[a, aw + 100], [b + 100, bw - 100], [c, cw]]);
  expect(plain.nodes).toEqual(was.nodes);
});

test('the first stage has a start edge: plain, its right edge stays; with Cmd/Ctrl, every stage moves, each width kept; no other stage has one', async ({ page }) => {
  const was = await state(page);
  const [[a, aw], [b, bw], [c, cw]] = was.bands as [[number, number], [number, number], [number, number]];
  await expect(stage(page, 1).locator('.edge-start')).toBeHidden();
  await expect(stage(page, 2).locator('.edge-start')).toBeHidden();
  const start = stage(page, 0).locator('.edge-start');
  await drag(page, start, -50, false);
  expect((await state(page)).bands).toEqual([[a - 100, aw + 100], [b, bw], [c, cw]]);
  expect((await state(page)).nodes).toEqual(was.nodes);
  await undo(page);
  await settle(page);
  await drag(page, start, 50, true);
  const now = await state(page);
  expect(now.bands).toEqual([[a + 100, aw], [b + 100, bw], [c + 100, cw]]);
  expect(now.nodes).toEqual({ s: was.nodes['s']! + 100, k: was.nodes['k']! + 100, o: was.nodes['o']! + 100 });
  await undo(page);
  await settle(page);
  expect(await state(page)).toEqual(was);
  // The keys: Cmd/Ctrl and an arrow move them all by a step.
  await start.focus();
  await page.keyboard.press('ControlOrMeta+ArrowRight');
  await settle(page);
  const keyed = (await state(page)).bands as [number, number][];
  expect(keyed.map(([, w]) => w)).toEqual([aw, bw, cw]);
  expect(keyed[0]![0]).toBeGreaterThan(a);
});
