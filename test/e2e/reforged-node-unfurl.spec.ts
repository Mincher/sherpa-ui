import { test, expect, type Page } from './harness';

/**
 * UNFURL GRAPH lays the whole graph out round its most connected node — Will, TODO 569. A real press on the
 * toolbar's button: every node moves, none overlaps, every line runs left to right, the drawn lines cross less,
 * the view fits them, and ONE Undo puts every place back. Off read only, and with one node. The Query editor's
 * Unfurl keeps its places for the tab. A node's neighbours stand in the order of the sockets they join (Will,
 * TODO 827). Places are read from the nodes, lines from the drawn paths. TRAP T-unfurl-keeps-the-flow
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
/** The drawn lines socket to socket: pairs that cross, two of one node's counted too; and pairs of one node's lines,
 *  on one side, whose far ends stand out of the order of their sockets there. */
const atSockets = (page: Page) => page.evaluate(() => {
  const segs = [...document.querySelectorAll('#cv > svg.graph-routes path[data-from]')].map((p) => {
    const n = (p.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
    return { from: p.getAttribute('data-from')!.split('/')[0]!, to: p.getAttribute('data-to')!.split('/')[0]!, a: [n[0]!, n[1]!], b: [n.at(-2)!, n.at(-1)!] };
  });
  const side = (p: number[], q: number[], r: number[]) => Math.sign((q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!));
  let crossed = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [p, q] = [segs[i]!, segs[j]!];
    if (side(p.a, p.b, q.a) * side(p.a, p.b, q.b) < 0 && side(q.a, q.b, p.a) * side(q.a, q.b, p.b) < 0) crossed++;
  }
  const ends = segs.flatMap((s) => [{ at: `${s.from}>`, here: s.a[1]!, there: s.b[1]! }, { at: `>${s.to}`, here: s.b[1]!, there: s.a[1]! }]);
  let swapped = 0;
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    const [p, q] = [ends[i]!, ends[j]!];
    if (p.at === q.at && (p.here - q.here) * (p.there - q.there) < 0) swapped++;
  }
  return { crossed, swapped };
});

// A store feeding four conditions, each with a value, two outputs: placed crossed on purpose, outputs on the left.
const TANGLE: [string, string, number, number, Record<string, unknown>?][] = [
  ['store', 'source', 1400, 500], ['e1', 'output', 0, 600], ['e2', 'output', 100, 0],
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
  await start(page, [['alone', 'source', 40, 40]], []);
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
  const kept = await page.evaluate(() => (window as never as { session: { get(k: string): { places: Record<string, { x: number; y: number }> } } }).session.get('/node-layout/records').places);
  for (const [id, r] of Object.entries(now)) if (kept[id]) expect([kept[id]!.x, kept[id]!.y]).toEqual([r.x, r.y]);
  expect(Object.keys(kept).length).toBeGreaterThan(1);
});

// Two Values into a Math node's rows a and b, and a Condition's rows and False out to two Outputs: each pair stood upside down.
const ROWS: [string, string, number, number, Record<string, unknown>?][] = [
  ['two', 'value', 0, 0, { type: 'integer', value: '2' }], ['one', 'value', 0, 700, { type: 'integer', value: '1' }],
  ['sum', 'math', 500, 300, { type: 'add' }], ['test', 'condition', 1000, 300, { type: 'gt', b: 3 }],
  ['no', 'output', 1500, 0], ['yes', 'output', 1500, 600],
];
const FED = [{ from: 'one/value', to: 'sum/a' }, { from: 'two/value', to: 'sum/b' }, { from: 'sum/result', to: 'test' }, { from: 'test/rows', to: 'yes' }, { from: 'test/#false', to: 'no' }];

test('the sockets\' order: what feeds rows a and b stands in that order, and what the rows and False send, in theirs (Will, TODO 827)', async ({ page }) => {
  await start(page, ROWS, FED);
  expect(await atSockets(page)).toEqual({ crossed: 2, swapped: 2 });
  await button(page).click();
  await settle(page);
  const now = await rects(page);
  const mid = (id: string) => now[id]!.y + now[id]!.h / 2;
  expect(mid('one')).toBeLessThan(mid('two'));
  expect(mid('yes')).toBeLessThan(mid('no'));
  expect(await atSockets(page)).toEqual({ crossed: 0, swapped: 0 });
  expect(overlaps(now)).toEqual([]);
  expect((await lines(page)).backwards).toBe(0);
  // The tangled graph keeps its sockets' order too.
  await page.evaluate(() => document.getElementById('root')!.replaceChildren());
  await start(page, TANGLE, KNOTS);
  await button(page).click();
  await settle(page);
  expect((await atSockets(page)).swapped).toBe(0);
});


// A portal pair, stood flipped: the Output and the Portal Out on the left, the Source and the Portal In on the right (TODO 839).
const PORTAL_PAIR: [string, string, number, number, Record<string, unknown>?][] = [
  ['end', 'output', 0, 0], ['out', 'portal', 400, 0, { type: 'out', name: 'Hand on' }], ['rows', 'condition', 800, 0, { type: 'eq', b: 'x' }],
  ['in', 'portal', 1200, 0, { type: 'in', name: 'Hand on' }], ['pick', 'field', 1600, 0], ['src', 'source', 2000, 0, { store: 'users' }],
];
const PORTAL_ROUTES = [{ from: 'src/rows', to: 'pick' }, { from: 'pick/field', to: 'in' }, { from: 'out', to: 'rows' }, { from: 'rows/rows', to: 'end' }];

test('a graph reads left to right: Sources and a Portal In left, a Portal Out and Outputs right; a portal pair never flips it (Will, TODO 839)', async ({ page }) => {
  await start(page, PORTAL_PAIR, PORTAL_ROUTES);
  await button(page).click();
  await settle(page);
  const now = await rects(page);
  const left = (id: string) => now[id]!.x;
  // Source, then its Field, the In; the Out, then its Condition, the Output: each to the right of the one before.
  expect(['src', 'pick', 'in', 'out', 'rows', 'end'].map(left)).toEqual([...['src', 'pick', 'in', 'out', 'rows', 'end'].map(left)].sort((a, b) => a - b));
  expect(left('in') + now['in']!.w).toBeLessThanOrEqual(left('out'));
  expect(overlaps(now)).toEqual([]);
  expect((await lines(page)).backwards).toBe(0);
  // And once more: it holds, and one Undo puts the flipped places back.
  await button(page).click();
  await settle(page);
  expect(['src', 'in', 'out', 'end'].map(left)).toEqual([...['src', 'in', 'out', 'end'].map(left)].sort((a, b) => a - b));
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect((await flow(page)).nodes.find((n) => n.id === 'src')!.x).toBe(2000);
});

test('a lone Source stands leftmost; a lone Output, isolated, stands in the stack after it, left of the graph (Will, 2026-11-10)', async ({ page }) => {
  await start(page, [['a', 'source', 400, 0, { store: 'users' }], ['f', 'field', 800, 0], ['c', 'condition', 1200, 0, { type: 'eq', b: 'x' }], ['lone-out', 'output', 0, 0], ['lone-src', 'source', 1600, 300, { store: 'users' }]],
    [{ from: 'a/rows', to: 'f' }, { from: 'f/field', to: 'c' }]);
  await button(page).click();
  await settle(page);
  const now = await rects(page);
  const graphLeft = Math.min(now['a']!.x, now['f']!.x, now['c']!.x);
  expect(now['lone-src']!.x + now['lone-src']!.w).toBeLessThanOrEqual(now['lone-out']!.x);
  expect(now['lone-out']!.x + now['lone-out']!.w).toBeLessThanOrEqual(graphLeft);
});
