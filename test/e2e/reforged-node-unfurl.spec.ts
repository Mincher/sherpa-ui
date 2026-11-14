import { test, expect, type Page } from './harness';

/**
 * UNFURL GRAPH lays the whole graph out round its most connected node — Will, TODO 569. A real press on the
 * toolbar's button: every node moves, none overlaps, every line runs left to right, the drawn lines cross less,
 * the view fits them, and ONE Undo puts every place back. Off read only, and with one node. The Query editor's
 * Unfurl keeps its places for the tab. A node's neighbours stand in the order of the sockets they join (Will,
 * TODO 827). In stages, each node stays in its own (TODO 950). Places are read from the nodes, lines from the drawn paths.
 * TRAP T-unfurl-keeps-the-flow
 */
type Flow = { nodes: { id: string; x: number; y: number; stage?: string }[]; connections: { from: string; to: string; via?: unknown[] }[]; ties?: unknown[] };
type Staged = { stages: { id: string; label: string; x: number }[]; of: Record<string, string> };
type Ed = { workflow(): Flow; undo(): boolean };

async function start(page: Page, nodes: [string, string, number, number, Record<string, unknown>?][], connections: Flow['connections'], readOnly = false, staged?: Staged): Promise<void> {
  await page.evaluate(async ([ns, rs, ro, st]) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 3 as const, id: 'u', nodes: ns.map(([id, kind, x, y, values]) => ({ id, kind, x, y, heading: id, ...(values ? { values } : {}), ...(st?.of[id] ? { stage: st.of[id] } : {}) })),
      connections: rs, ...(st ? { stages: st.stages } : {}) };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'], readOnly: ro,
    });
    await window.__settled();
    canvas.zoomTo(0.4);
    canvas.panTo(20, 20);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, [nodes, connections, readOnly, staged] as const);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const flow = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as never as { ed: Ed }).ed.workflow())) as Flow);
const rects = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#cv > sherpa-node')].map((n) => [n.getAttribute('data-heading')!,
  { x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')), w: (n as HTMLElement).offsetWidth, h: (n as HTMLElement).offsetHeight }])));
/** Each drawn connection's end points, on the plane; how many pairs cross; and how many run right to left. */
const lines = (page: Page) => page.evaluate(() => {
  const segs = [...document.querySelectorAll('#cv > svg.graph-connectors path[data-from]')].map((p) => {
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
  const segs = [...document.querySelectorAll('#cv > svg.graph-connectors path[data-from]')].map((p) => {
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
  ['store', 'source', 1400, 500], ['e1', 'result', 0, 600], ['e2', 'result', 100, 0],
  ['c1', 'condition', 700, 900, { type: 'eq' }], ['c2', 'condition', 300, 300, { type: 'eq' }], ['c3', 'condition', 1000, 0, { type: 'eq' }], ['c4', 'condition', 500, 1200, { type: 'eq' }],
  ['v1', 'value', 1500, 1300, { type: 'text', value: 'a' }], ['v2', 'value', 0, 1300, { type: 'text', value: 'b' }], ['v3', 'value', 1300, 0, { type: 'text', value: 'c' }],
];
const KNOTS = [
  { from: 'store/rows', to: 'c1' }, { from: 'store/rows', to: 'c2' }, { from: 'store/rows', to: 'c3' }, { from: 'store/rows', to: 'c4' },
  { from: 'v1/value', to: 'c2/b' }, { from: 'v2/value', to: 'c3/b' }, { from: 'v3/value', to: 'c1/b' },
  { from: 'c1/pass', to: 'e2' }, { from: 'c3/pass', to: 'e1' }, { from: 'c2/pass', to: 'c4' }, { from: 'c4/pass', to: 'e1' },
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

// Two Values into a Math node's rows a and b, and a Branch's Yes and No out to two Outputs: each pair stood upside down. The
// Condition's True is the Branch's test: no node has a True or a False socket (plan 944).
const ROWS: [string, string, number, number, Record<string, unknown>?][] = [
  ['two', 'value', 0, 0, { type: 'integer', value: '2' }], ['one', 'value', 0, 700, { type: 'integer', value: '1' }],
  ['sum', 'math', 500, 300, { type: 'add' }], ['test', 'condition', 1000, 300, { type: 'gt', b: 3 }], ['branch', 'branch', 1500, 300],
  ['no', 'result', 2000, 0], ['yes', 'result', 2000, 600],
];
const FED = [
  { from: 'one/value', to: 'sum/a' }, { from: 'two/value', to: 'sum/b' }, { from: 'sum/result', to: 'test' }, { from: 'test/true', to: 'branch' },
  { from: 'branch/yes', to: 'yes' }, { from: 'branch/no', to: 'no' },
];

test('the sockets\' order: what feeds rows a and b stands in that order, and what a Branch\'s Yes and No send, in theirs (Will, TODO 827; plan 944)', async ({ page }) => {
  await start(page, ROWS, FED);
  // Measured (plan 944): each upside-down pair crosses once, rows a and b and Yes and No, so two crossings and two swaps.
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
  ['end', 'result', 0, 0], ['out', 'portal', 400, 0, { type: 'out', name: 'Hand on' }], ['rows', 'condition', 800, 0, { type: 'eq', b: 'x' }],
  ['in', 'portal', 1200, 0, { type: 'in', name: 'Hand on' }], ['pick', 'field', 1600, 0], ['src', 'source', 2000, 0, { store: 'users' }],
];
const PORTAL_CONNECTIONS = [{ from: 'src/rows', to: 'pick' }, { from: 'pick/field', to: 'in' }, { from: 'out', to: 'rows' }, { from: 'rows/pass', to: 'end' }];

test('a graph reads left to right: Sources and a Portal In left, a Portal Out and Outputs right; a portal pair never flips it (Will, TODO 839)', async ({ page }) => {
  await start(page, PORTAL_PAIR, PORTAL_CONNECTIONS);
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

test('no Source is lone: the Start joins each, so each stands right of it; a lone Output stands in the stack, left of the graph (Will, TODO 955)', async ({ page }) => {
  await start(page, [['a', 'source', 400, 0, { store: 'users' }], ['f', 'field', 800, 0], ['c', 'condition', 1200, 0, { type: 'eq', b: 'x' }], ['lone-out', 'result', 0, 0], ['lone-src', 'source', 1600, 300, { store: 'users' }]],
    [{ from: 'a/rows', to: 'f' }, { from: 'f/field', to: 'c' }]);
  await button(page).click();
  await settle(page);
  const now = await rects(page);
  // The Start's drawn line to each Source holds the flow (a hop): Start › Source, as Trigger › Start.
  for (const src of ['a', 'lone-src']) expect(now['Start']!.x + now['Start']!.w, src).toBeLessThanOrEqual(now[src]!.x);
  const graphLeft = Math.min(now['Start']!.x, now['a']!.x, now['f']!.x, now['c']!.x, now['lone-src']!.x);
  expect(now['lone-out']!.x + now['lone-out']!.w).toBeLessThanOrEqual(graphLeft);
});

// A made graph in three stages, each node naming its own; a lone node in the last (TODO 950). Unfurled by the flow alone,
// the stages pushed the Report nodes onto each other.
const STAGED: [string, string, number, number, Record<string, unknown>?][] = [
  ['src', 'source', 0, 0, { store: 'users' }], ['pick', 'field', 360, 0], ['keep', 'condition', 720, 0, { type: 'eq', b: 'x' }],
  ['sort1', 'organise', 1140, 0], ['sort2', 'organise', 1140, 300],
  ['end1', 'result', 1740, 0], ['end2', 'result', 1740, 300], ['note', 'value', 1740, 600, { type: 'text', value: 'n' }],
];
const STAGED_CONNECTIONS = [
  { from: 'src/rows', to: 'pick' }, { from: 'pick/field', to: 'keep' }, { from: 'keep/pass', to: 'sort1' }, { from: 'keep/pass', to: 'sort2' },
  { from: 'sort1/rows', to: 'end1' }, { from: 'sort2/rows', to: 'end2' },
];
const STAGES: Staged = {
  stages: [{ id: 'plan', label: 'Plan', x: -40 }, { id: 'run', label: 'Run', x: 1100 }, { id: 'report', label: 'Report', x: 1700 }],
  of: { src: 'plan', pick: 'plan', keep: 'plan', sort1: 'run', sort2: 'run', end1: 'report', end2: 'report', note: 'report' },
};

test('a graph in stages: each node stays in its own stage, inside its band, none overlapping; the stages left to right; one Undo (TODO 950)', async ({ page }) => {
  await start(page, STAGED, STAGED_CONNECTIONS, false, STAGES);
  const before = await flow(page);
  await button(page).click();
  await settle(page);
  const after = await flow(page);
  const now = await rects(page);
  for (const n of before.nodes) expect(after.nodes.find((m) => m.id === n.id)!.stage, n.id).toBe(n.stage);
  expect(overlaps(now)).toEqual([]);
  expect((await lines(page)).backwards).toBe(0);
  // Each drawn node inside its drawn stage, a pad from each edge; the stages a gap apart, the first where it stood.
  const bands = await page.evaluate(() => [...document.querySelectorAll('#cv > sherpa-node-stage')].map((el) => ({
    id: el.getAttribute('data-stage')!, left: Number(el.getAttribute('data-x')), right: Number(el.getAttribute('data-x')) + Number(el.getAttribute('data-w')) })));
  expect(bands.map((b) => b.id)).toEqual(['plan', 'run', 'report']);
  // The first where it stood as opened: round its first node, at 0, by the pad (TODO 976).
  expect(bands[0]!.left).toBe(-48);
  for (let i = 1; i < bands.length; i++) expect(bands[i]!.left - bands[i - 1]!.right).toBe(16);
  // The Start is drawn as "Start": it is in the first stage, as each node is in its own (TODO 955).
  const box = (id: string) => now[id === '#start' ? 'Start' : id]!;
  for (const n of after.nodes) {
    const band = bands.find((b) => b.id === n.stage)!;
    expect(box(n.id).x, n.id).toBeGreaterThanOrEqual(band.left + 48);
    expect(box(n.id).x + box(n.id).w, n.id).toBeLessThanOrEqual(band.right - 48);
  }
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  expect(await flow(page)).toEqual(before);
});

test('a graph not laid out yet is unfurled and saved the first time it shows, and the flag goes; read only, it is left (TODO 958)', async ({ page }) => {
  const open = (readOnly: boolean) => page.evaluate(async (ro) => {
    document.getElementById('root')!.innerHTML = `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`;
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const w = window as never as { saved: unknown[]; ed: unknown };
    w.saved = [];
    const canvas = document.getElementById('cv')!;
    canvas.addEventListener('definition-save', (e) => w.saved.push((e as CustomEvent).detail.definition));
    // As an agent makes it: every node at one place, and the flag.
    const at = (id: string, kind: string, values?: Record<string, unknown>) => ({ id, kind, x: 0, y: 0, heading: id, ...(values ? { values } : {}) });
    w.ed = bindWorkflow(canvas as never, {
      v: 3, id: 'made', unfurl: true,
      nodes: [at('s', 'source', { store: 'users' }), at('f', 'field', { field: 'status' }), at('c', 'condition', { type: 'eq' }), at('o', 'result')],
      connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'c/pass', to: 'o' }],
    } as never, { session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'], readOnly: ro });
    await window.__settled();
  }, readOnly);
  const saved = () => page.evaluate(() => (window as never as { saved: Record<string, unknown>[] }).saved);
  await open(false);
  await expect.poll(async () => (await saved()).length).toBe(1);
  await settle(page);
  expect(overlaps(await rects(page))).toEqual([]);
  expect((await saved())[0]!['unfurl']).toBeUndefined();
  expect((await flow(page) as Flow & { unfurl?: true }).unfurl).toBeUndefined();
  // Read only: it is not moved, and nothing is saved.
  await open(true);
  await settle(page);
  await settle(page);
  expect(await saved()).toEqual([]);
  expect(overlaps(await rects(page)).length).toBeGreaterThan(0);
});
