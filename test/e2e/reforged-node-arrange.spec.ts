import { test, expect, type Page } from './harness';

/**
 * Picked nodes move TOGETHER and ARRANGE on a grid — Will, TODO 752. Dragging one of several picked
 * nodes moves them all by the same delta (a tie whose connections all join them goes too, and the bends of
 * a connection with both ends among them); an unpicked node picks only itself. Ctrl or Cmd and an arrow moves
 * the picked nodes. Arrange puts them in columns along the connections, three spacing tokens apart (756), on the 4px grid.
 * Real pointer and keys; places are read from the nodes, lines from the drawn paths.
 */
type Flow = { nodes: { id: string; x: number; y: number }[]; ties?: { id: string; x: number; y: number }[]; connections: { from: string; to: string; via?: { x: number; y: number }[] }[] };
type Ed = { workflow(): Flow; undo(): boolean };

async function start(page: Page, nodes: [string, string, number, number][], connections: { from: string; to: string; via?: { x: number; y: number }[] }[], ties: unknown[] = []): Promise<void> {
  await page.evaluate(async ([ns, rs, ts]) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 3 as const, id: 'z', nodes: ns.map(([id, kind, x, y]) => ({ id, kind, x, y, heading: id })), connections: rs, ...(ts.length ? { ties: ts } : {}) };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'],
    });
    await window.__settled();
    canvas.zoomTo(0.5);
    canvas.panTo(40, 40);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, [nodes, connections, ties] as const);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const flow = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as never as { ed: Ed }).ed.workflow())) as Flow);
const spot = (f: Flow, id: string) => f.nodes.find((n) => n.id === id)!;
const picked = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#cv > sherpa-node[data-current]')].map((n) => n.getAttribute('data-heading')).sort());
const header = async (page: Page, id: string) => {
  const b = (await page.locator(`#cv > sherpa-node[data-heading="${id}"]`).boundingBox())!;
  return [b.x + b.width * 0.5, b.y + 8] as [number, number];
};
async function pick(page: Page, ids: string[]): Promise<void> {
  await page.keyboard.down('Shift');
  for (const id of ids) { const [x, y] = await header(page, id); await page.mouse.click(x, y); }
  await page.keyboard.up('Shift');
  await settle(page);
}
async function dragNode(page: Page, id: string, by: [number, number]): Promise<void> {
  const [x, y] = await header(page, id);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + by[0] / 2, y + by[1] / 2, { steps: 4 });
  await page.mouse.move(x + by[0], y + by[1], { steps: 4 });
  await page.mouse.up();
  await settle(page);
}
const press = async (page: Page, name: string) => {
  await page.locator(`sherpa-node-toolbar sherpa-button.${name}`).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
};

const R = (n: number) => ({ from: `s${n}/rows`, to: `e${n}` });

test('dragging one of several picked nodes moves them all, relative places kept; an unpicked one stays', async ({ page }) => {
  await start(page, [['s1', 'source', 0, 0], ['e1', 'result', 600, 0], ['s2', 'source', 0, 240], ['e2', 'result', 600, 240], ['s3', 'source', 0, 480]], [R(1), R(2)]);
  const before = await flow(page);
  await pick(page, ['s1', 'e1', 's2']);
  expect(await picked(page)).toEqual(['e1', 's1', 's2']);
  // Across, clear of e2: a move onto an unpicked node pushes it away (plan 918), and that is not this test.
  await dragNode(page, 's1', [100, 0]);
  const after = await flow(page);
  const d = { x: spot(after, 's1').x - spot(before, 's1').x, y: spot(after, 's1').y - spot(before, 's1').y };
  expect(d.x).toBeGreaterThan(150);
  for (const id of ['e1', 's2']) expect([spot(after, id).x - spot(before, id).x, spot(after, id).y - spot(before, id).y]).toEqual([d.x, d.y]);
  for (const id of ['e2', 's3']) expect(spot(after, id)).toEqual(spot(before, id));
  expect(await picked(page)).toEqual(['e1', 's1', 's2']);
  // One Undo puts them all back.
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect(await flow(page)).toEqual(before);
});

test('a tie whose connections all join picked nodes goes along, bends of a connection between picked ends too; others stay', async ({ page }) => {
  await start(page, [['s1', 'source', 0, 0], ['e1', 'result', 700, 0], ['s2', 'source', 0, 240], ['e2', 'result', 700, 240], ['s3', 'source', 0, 480], ['e3', 'result', 700, 480]],
    [{ ...R(1), via: [{ x: 400, y: 40 }] }, R(2), { ...R(3), via: [{ x: 400, y: 520 }] }],
    // u on its own line: a tie sharing one with t would be of t's connector set, held in a section of it (TODO 973).
    [{ id: 't', x: 480, y: 130, connections: [R(1), R(2)] }, { id: 'u', x: 480, y: 330, connections: [R(3)] }]);
  const before = await flow(page);
  await pick(page, ['s1', 'e1', 's2', 'e2']);
  // Across, clear of e3: a move onto it would push it (plan 918).
  await dragNode(page, 'e2', [80, 0]);
  const after = await flow(page);
  const dx = spot(after, 'e2').x - spot(before, 'e2').x;
  const dy = spot(after, 'e2').y - spot(before, 'e2').y;
  expect(dx).toBeGreaterThan(100);
  const t = (f: Flow, id: string) => f.ties!.find((x) => x.id === id)!;
  expect([t(after, 't').x - t(before, 't').x, t(after, 't').y - t(before, 't').y]).toEqual([dx, dy]);
  expect(t(after, 'u')).toEqual(t(before, 'u'));
  expect(after.connections[0]!.via).toEqual([{ x: 400 + dx, y: 40 + dy }]);
  expect(after.connections[2]!.via).toEqual(before.connections[2]!.via);
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect(await flow(page)).toEqual(before);
});

test('a drag on an unpicked node picks only it and moves only it', async ({ page }) => {
  await start(page, [['s1', 'source', 0, 0], ['e1', 'result', 600, 0], ['s3', 'source', 0, 480]], [R(1)]);
  const before = await flow(page);
  await pick(page, ['s1', 'e1']);
  await dragNode(page, 's3', [60, 40]);
  const after = await flow(page);
  expect(await picked(page)).toEqual(['s3']);
  expect(spot(after, 's3').x).toBeGreaterThan(spot(before, 's3').x + 60);
  expect(spot(after, 's1')).toEqual(spot(before, 's1'));
  expect(spot(after, 'e1')).toEqual(spot(before, 'e1'));
});

test('Ctrl and an arrow, on the canvas, moves the picked nodes 8px, 32 with Shift; one step', async ({ page }) => {
  await start(page, [['s1', 'source', 0, 0], ['e1', 'result', 600, 0], ['s3', 'source', 0, 480]], [R(1)]);
  const before = await flow(page);
  await pick(page, ['s1', 'e1']);
  await page.locator('#cv').evaluate((cv) => (cv.shadowRoot!.querySelector('.viewport') as HTMLElement).focus());
  await page.keyboard.press('ControlOrMeta+ArrowRight');
  await page.keyboard.press('ControlOrMeta+Shift+ArrowDown');
  await settle(page);
  const after = await flow(page);
  expect([spot(after, 's1').x - spot(before, 's1').x, spot(after, 's1').y - spot(before, 's1').y]).toEqual([8, 32]);
  expect([spot(after, 'e1').x - spot(before, 'e1').x, spot(after, 'e1').y - spot(before, 'e1').y]).toEqual([8, 32]);
  expect(spot(after, 's3')).toEqual(spot(before, 's3'));
});

/** Each drawn connection's end points on the plane, and how many pairs of them cross. */
const crossings = (page: Page) => page.evaluate(() => {
  const segs = [...document.querySelectorAll('#cv > svg.graph-connectors path[data-from]')].map((p) => {
    const n = (p.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
    return { from: p.getAttribute('data-from')!.split('/')[0]!, to: p.getAttribute('data-to')!, a: [n[0]!, n[1]!], b: [n.at(-2)!, n.at(-1)!] };
  });
  const side = (p: number[], q: number[], r: number[]) => Math.sign((q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!));
  let count = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [p, q] = [segs[i]!, segs[j]!];
    if (p.from === q.from || p.to === q.to) continue;
    if (side(p.a, p.b, q.a) * side(p.a, p.b, q.b) < 0 && side(q.a, q.b, p.a) * side(q.a, q.b, p.b) < 0) count++;
  }
  return count;
});
const rects = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#cv > sherpa-node')].map((n) => [n.getAttribute('data-heading')!, { x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')), w: (n as HTMLElement).offsetWidth, h: (n as HTMLElement).offsetHeight }])));

test('Arrange: columns by flow, three tokens apart, on the grid, anchor kept, fewer crossings, ties centred, bends cleared, one Undo', async ({ page }) => {
  await start(page, [['s1', 'source', 500, 400], ['s2', 'source', 40, 20], ['e1', 'result', 100, 300], ['e2', 'result', 800, 60], ['s3', 'source', 300, 600]],
    [{ ...R(1), via: [{ x: 300, y: 300 }] }, R(2), { from: 's3/rows', to: 'e1' }],
    [{ id: 't', x: 360, y: 200, connections: [R(1), R(2)] }]);
  const button = page.locator('sherpa-node-toolbar sherpa-button.arrange');
  await expect(button).toHaveAttribute('disabled', '');
  await pick(page, ['s1']);
  await expect(button).toHaveAttribute('disabled', '');
  await pick(page, ['s2', 'e1', 'e2']);
  await expect(button).not.toHaveAttribute('disabled', '');
  const before = await flow(page);
  const was = await rects(page);
  const crossBefore = await crossings(page);
  // Three of the spacing token (756): 3 × 56px.
  const gap = 3 * await page.locator('#cv').evaluate((cv) => parseFloat(getComputedStyle(cv).getPropertyValue('--sherpa-display-mode-space-5xl')) || 56);
  expect(gap).toBe(168);
  await press(page, 'arrange');
  const after = await flow(page);
  const now = await rects(page);
  const four = ['s1', 's2', 'e1', 'e2'];
  for (const id of four) { expect(spot(after, id).x % 4).toBe(0); expect(spot(after, id).y % 4).toBe(0); }
  // sources left, outputs a column to the right, 168px apart
  expect(spot(after, 's1').x).toBe(spot(after, 's2').x);
  expect(spot(after, 'e1').x).toBe(spot(after, 'e2').x);
  expect(Math.abs(spot(after, 'e1').x - (spot(after, 's1').x + now['s1']!.w) - gap)).toBeLessThanOrEqual(1);
  // rows in a column
  const [top, low] = [spot(after, 's1'), spot(after, 's2')].sort((a, b) => a.y - b.y);
  // A grid row is as tall as its tallest node: here an Output, with its Type, Status and Summary (plan 891).
  const tallest = Math.max(...four.filter((id) => spot(after, id).y === top!.y).map((id) => now[id]!.h));
  expect(Math.abs(low!.y - (top!.y + tallest) - gap)).toBeLessThanOrEqual(4);
  // 756: a grid, so the top edges of a row are one y in every column
  const tops = (ids: string[]) => ids.map((id) => spot(after, id).y).sort((a, b) => a - b);
  expect(tops(['s1', 's2'])).toEqual(tops(['e1', 'e2']));
  // the top-left of the picked nodes stays
  expect(Math.abs(Math.min(...four.map((id) => spot(after, id).x)) - Math.min(...four.map((id) => was[id]!.x)))).toBeLessThanOrEqual(2);
  expect(Math.abs(Math.min(...four.map((id) => spot(after, id).y)) - Math.min(...four.map((id) => was[id]!.y)))).toBeLessThanOrEqual(2);
  // the unpicked node and the unpicked-end connection stay
  expect(spot(after, 's3')).toEqual(spot(before, 's3'));
  expect(await crossings(page)).toBeLessThanOrEqual(crossBefore);
  // bends cleared; the tie sits in the gap between the columns, at its centre
  expect(after.connections.every((r) => !r.via)).toBe(true);
  const tie = after.ties![0]!;
  const left = spot(after, 's1').x + now['s1']!.w;
  expect(Math.abs(tie.x - (left + gap / 2))).toBeLessThanOrEqual(2);
  // ONE Undo restores places, ties and bends
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect(await flow(page)).toEqual(before);
});

test('the Query editor arranges too: picked nodes in columns, their places kept for the tab', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindQueryEditor, SessionStore } = await import('/dist/app.js');
    const { QueryContext, VIEW } = await import('/dist/data.js');
    const query = new QueryContext();
    query.ask({ scope: VIEW, hold: ['region'] });
    query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EMEA'] } });
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; fit(): void };
    (window as never as { session: unknown }).session = new SessionStore();
    bindQueryEditor(canvas as never, { query } as never, { definition: { v: 1, id: 'records', source: { store: 'customers' } }, toolbar: canvas.querySelector('sherpa-node-toolbar')!, session: (window as never as { session: never }).session });
    await window.__settled();
    canvas.fit();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  const names = await page.evaluate(() => [...document.querySelectorAll('#cv > sherpa-node')].map((n) => n.getAttribute('data-heading')!));
  expect(names.length).toBeGreaterThan(2);
  const button = page.locator('sherpa-node-toolbar sherpa-button.arrange');
  await expect(button).toHaveAttribute('disabled', '');
  // A box over the whole canvas picks every node (the Query editor has no Shift-click).
  const cv = (await page.locator('#cv').boundingBox())!;
  await page.mouse.move(cv.x + 3, cv.y + 3);
  await page.mouse.down();
  await page.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 2, { steps: 5 });
  await page.mouse.move(cv.x + cv.width - 3, cv.y + cv.height - 3, { steps: 5 });
  await page.mouse.up();
  await settle(page);
  await expect(button).not.toHaveAttribute('disabled', '');
  await press(page, 'arrange');
  const now = await rects(page);
  for (const r of Object.values(now)) { expect(r.x % 4).toBe(0); expect(r.y % 4).toBe(0); }
  expect(new Set(Object.values(now).map((r) => r.x)).size).toBeGreaterThan(1);
  const kept = await page.evaluate(() => JSON.stringify(Object.values((window as never as { session: { get(k: string): { places?: object } | undefined } }).session.get('/node-layout/records')?.places ?? {})).length);
  expect(kept).toBeGreaterThan(10);
});

test('902: Arrange moves each node from where it stood, by a transition; the lines fade out on the way and back after', async ({ page }) => {
  await start(page, [['s1', 'source', 500, 400], ['s2', 'source', 40, 20], ['e1', 'result', 100, 300], ['e2', 'result', 800, 60]],
    [R(1), R(2)], []);
  await pick(page, ['s1', 's2', 'e1', 'e2']);
  await page.locator('sherpa-node-toolbar sherpa-button.arrange').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  const during = await page.evaluate(() => {
    const cv = document.getElementById('cv')!;
    const n = cv.querySelector<HTMLElement>('sherpa-node[data-heading="s1"]')!;
    return { settling: cv.shadowRoot!.querySelector('.viewport')!.hasAttribute('data-settling'), move: getComputedStyle(n).transitionDuration, lines: getComputedStyle(cv.querySelector('svg.graph-connectors')!).opacity };
  });
  expect(during).toEqual({ settling: true, move: '0.3s', lines: '0' });
  await page.evaluate(() => window.__settled());
  await page.waitForTimeout(450);
  const after = await page.evaluate(() => {
    const cv = document.getElementById('cv')!;
    return { settling: cv.shadowRoot!.querySelector('.viewport')!.hasAttribute('data-settling'), lines: getComputedStyle(cv.querySelector('svg.graph-connectors')!).opacity };
  });
  expect(after).toEqual({ settling: false, lines: '1' });
});
