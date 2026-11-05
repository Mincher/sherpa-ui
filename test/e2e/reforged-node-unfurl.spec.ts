import { test, expect, type Page } from './harness';

/**
 * UNFURL GRAPH lays the whole graph out round its most connected node — Will, TODO 569. A real press on the
 * toolbar's button: every node moves, none overlaps, every line runs left to right, the drawn lines cross less,
 * the view fits them, and ONE Undo puts every place back. Off read only, and with one node. The Query editor's
 * Unfurl keeps its places for the tab. Places are read from the nodes, lines from the drawn paths.
 * TRAP T-unfurl-keeps-the-flow
 */
type Flow = { nodes: { id: string; x: number; y: number }[]; routes: { from: string; to: string; via?: unknown[] }[]; ties?: unknown[] };
type Ed = { workflow(): Flow; undo(): boolean };

async function start(page: Page, nodes: [string, string, number, number, Record<string, unknown>?][], routes: Flow['routes'], readOnly = false): Promise<void> {
  await page.evaluate(async ([ns, rs, ro]) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 2 as const, id: 'u', nodes: ns.map(([id, kind, x, y, values]) => ({ id, kind, x, y, heading: id, ...(values ? { values } : {}) })), routes: rs };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'], readOnly: ro,
    });
    await window.__settled();
    canvas.zoomTo(0.4);
    canvas.panTo(20, 20);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, [nodes, routes, readOnly] as const);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const flow = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as never as { ed: Ed }).ed.workflow())) as Flow);
const rects = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#cv > sherpa-node')].map((n) => [n.getAttribute('data-heading')!,
  { x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')), w: (n as HTMLElement).offsetWidth, h: (n as HTMLElement).offsetHeight }])));
/** Each drawn route's end points, on the plane; how many pairs cross; and how many run right to left. */
const lines = (page: Page) => page.evaluate(() => {
  const segs = [...document.querySelectorAll('#cv > svg.graph-routes path[data-from]')].map((p) => {
    const n = (p.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
    return { from: p.getAttribute('data-from')!.split('/')[0]!, to: p.getAttribute('data-to')!.split('/')[0]!, a: [n[0]!, n[1]!], b: [n.at(-2)!, n.at(-1)!] };
  });
  const side = (p: number[], q: number[], r: number[]) => Math.sign((q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!));
  let crossed = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [p, q] = [segs[i]!, segs[j]!];
    if (p.from === q.from || p.to === q.to || p.from === q.to || p.to === q.from) continue;
    if (side(p.a, p.b, q.a) * side(p.a, p.b, q.b) < 0 && side(q.a, q.b, p.a) * side(q.a, q.b, p.b) < 0) crossed++;
  }
  return { count: segs.length, crossed, backwards: segs.filter((s) => s.b[0]! <= s.a[0]!).length };
});
const overlaps = (r: Record<string, { x: number; y: number; w: number; h: number }>) => {
  const list = Object.entries(r);
  const hit: string[] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const [[a, p], [b, q]] = [list[i]!, list[j]!];
    if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) hit.push(`${a}~${b}`);
  }
  return hit;
};
const button = (page: Page) => page.locator('sherpa-node-toolbar sherpa-button.unfurl');

// A store feeding four conditions, each with a value, two outputs: placed crossed on purpose, outputs on the left.
const TANGLE: [string, string, number, number, Record<string, unknown>?][] = [
  ['store', 'store', 1400, 500], ['e1', 'output', 0, 600], ['e2', 'output', 100, 0],
  ['c1', 'condition', 700, 900, { type: 'eq' }], ['c2', 'condition', 300, 300, { type: 'eq' }], ['c3', 'condition', 1000, 0, { type: 'eq' }], ['c4', 'condition', 500, 1200, { type: 'eq' }],
  ['v1', 'value', 1500, 1300, { type: 'text', value: 'a' }], ['v2', 'value', 0, 1300, { type: 'text', value: 'b' }], ['v3', 'value', 1300, 0, { type: 'text', value: 'c' }],
];
const KNOTS = [
  { from: 'store/rows', to: 'c1' }, { from: 'store/rows', to: 'c2' }, { from: 'store/rows', to: 'c3' }, { from: 'store/rows', to: 'c4' },
  { from: 'v1/value', to: 'c2/b' }, { from: 'v2/value', to: 'c3/b' }, { from: 'v3/value', to: 'c1/b' },
  { from: 'c1/rows', to: 'e2' }, { from: 'c3/rows', to: 'e1' }, { from: 'c2/rows', to: 'c4' }, { from: 'c4/rows', to: 'e1' },
];

test('a press on Unfurl graph: every node moves, none overlaps, every line runs left to right and fewer cross; the view fits; one Undo', async ({ page }) => {
  await start(page, TANGLE, KNOTS);
  await expect(button(page)).not.toHaveAttribute('disabled', '');
  const before = await flow(page);
  const was = await lines(page);
  expect(was.count).toBe(KNOTS.length);
  expect(was.crossed).toBeGreaterThan(3);
  await button(page).click();
  await settle(page);
  const after = await flow(page);
  const now = await rects(page);
  // Every node moves but the anchor, the store, the most connected: it keeps its place.
  for (const n of before.nodes) if (n.id !== 'store') expect(after.nodes.find((m) => m.id === n.id), n.id).not.toEqual(n);
  expect(overlaps(now)).toEqual([]);
  for (const r of Object.values(now)) expect([Math.abs(r.x % 4), Math.abs(r.y % 4)]).toEqual([0, 0]);
  const drawn = await lines(page);
  expect(drawn.count).toBe(KNOTS.length);
  expect(drawn.backwards).toBe(0);
  expect(drawn.crossed).toBeLessThan(was.crossed);
  expect(now['store']).toMatchObject({ x: 1400, y: 500 });
  // Fit: every node inside the canvas.
  await expect.poll(() => page.evaluate(() => {
    const cv = document.getElementById('cv')!.getBoundingClientRect();
    return [...document.querySelectorAll('#cv > sherpa-node')].every((n) => {
      const b = n.getBoundingClientRect();
      return b.left >= cv.left - 1 && b.right <= cv.right + 1 && b.top >= cv.top - 1 && b.bottom <= cv.bottom + 1;
    });
  })).toBe(true);
  // ONE Undo puts every place back.
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect(await flow(page)).toEqual(before);
  expect((await lines(page)).crossed).toBe(was.crossed);
});

test('the keys reach it: Enter on the focused Unfurl graph unfurls, as a press does', async ({ page }) => {
  await start(page, TANGLE, KNOTS);
  const before = await flow(page);
  await button(page).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).focus());
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await flow(page)).not.toEqual(before);
  expect(overlaps(await rects(page))).toEqual([]);
});

test('off read only, and with one node: a press does nothing', async ({ page }) => {
  await start(page, TANGLE, KNOTS, true);
  await expect(button(page)).toHaveAttribute('disabled', '');
  const before = await flow(page);
  await button(page).click({ force: true });
  await settle(page);
  expect(await flow(page)).toEqual(before);
  await page.evaluate(() => document.getElementById('root')!.replaceChildren());
  await start(page, [['alone', 'store', 40, 40]], []);
  await expect(button(page)).toHaveAttribute('disabled', '');
});

test('the Query editor unfurls too: every node moves, none overlaps, the places kept for the tab', async ({ page }) => {
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
    query.ask({ scope: VIEW, hold: ['region', 'status'] });
    query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EMEA'] } });
    query.ask({ scope: VIEW, field: 'status', reading: { picked: ['active'] } });
    const canvas = document.getElementById('cv') as HTMLElement & { fit(): void };
    (window as never as { session: unknown }).session = new SessionStore();
    bindQueryEditor(canvas as never, { query } as never, { definition: { v: 1, id: 'records', source: { store: 'customers' } }, toolbar: canvas.querySelector('sherpa-node-toolbar')!, session: (window as never as { session: never }).session });
    await window.__settled();
    canvas.fit();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  await expect(button(page)).not.toHaveAttribute('disabled', '');
  const was = await rects(page);
  await button(page).click();
  await settle(page);
  const now = await rects(page);
  expect(Object.keys(now).length).toBeGreaterThan(2);
  expect(overlaps(now)).toEqual([]);
  expect(Object.keys(now).filter((id) => now[id]!.x !== was[id]!.x || now[id]!.y !== was[id]!.y).length).toBeGreaterThan(1);
  expect((await lines(page)).backwards).toBe(0);
  const kept = await page.evaluate(() => (window as never as { session: { get(k: string): Record<string, { x: number; y: number }> } }).session.get('/nodes/records'));
  for (const [id, r] of Object.entries(now)) if (kept[id]) expect([kept[id]!.x, kept[id]!.y]).toEqual([r.x, r.y]);
  expect(Object.keys(kept).length).toBeGreaterThan(1);
});
