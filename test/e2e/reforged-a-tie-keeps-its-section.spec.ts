import { test, expect, type Page } from './harness';

/**
 * A ZIP TIE KEEPS ITS SECTION — Will, TODO 973: "if we restrict zip ties to only be positionable between 20% and 80% of
 * the way along its connector set section then we also prevent node stacking issues". A connector set is the ties that
 * share a connection; it spans from its from-nodes' rightmost edge to its to-nodes' leftmost, cut into one section per
 * tie. Each tie stands in 20% to 80% of its own: as loaded, after Unfurl (with the bug of the same day: a tie stood on the
 * wrong side of its nodes), and dragged. Read from the drawn bars and the drawn nodes' boxes.
 */
type Tie = { id: string; x: number; y: number; connections: { from: string; to: string }[] };
type Ed = { workflow(): { ties?: Tie[] } };

const N = (id: string, kind: string, x: number, y: number, more: Record<string, unknown> = {}) => ({ id, kind, x, y, heading: id, ...more });
const R = (from: string, to: string) => ({ from, to });
// Two ties on one pair of lines, stacked at one x; a grown node with a tie; a tie on two lines whose nodes do not line up;
// each tie's x where the reader left it, some behind a node.
const FLOW = {
  v: 3, byHand: true as const, id: 'sections',
  nodes: [N('s', 'source', 0, 0, { values: { store: 'users' } }), N('f', 'field', 400, 0), N('c', 'condition', 800, 0, { values: { type: 'eq' } }), N('o', 'result', 1200, 0),
    N('c2', 'condition', 400, 400, { values: { type: 'eq' } }), N('o2', 'result', 800, 400), N('v', 'value', 0, 600, { values: { type: 'text', value: 'a' }, size: { w: 1.6, h: 1 } }),
    N('v2', 'value', 0, 900, { values: { type: 'text', value: 'b' } })],
  connections: [R('s/rows', 'f'), R('f/field', 'c'), R('c/pass', 'o'), R('s/rows', 'c2'), R('c2/pass', 'o2'), R('v/value', 'c/b'), R('v2/value', 'c2/b')],
  ties: [
    { id: 'one', x: 600, y: 700, connections: [R('v/value', 'c/b'), R('v2/value', 'c2/b')] },
    { id: 'two', x: 600, y: 700, connections: [R('v/value', 'c/b'), R('v2/value', 'c2/b')] },
    { id: 'diag', x: 300, y: 200, connections: [R('f/field', 'c'), R('s/rows', 'c2')] },
    { id: 'wide', x: 250, y: 600, connections: [R('v/value', 'c/b')] },
  ],
};

async function open(page: Page, flow: object): Promise<void> {
  await page.evaluate(async (flow) => {
    document.getElementById('root')!.innerHTML = `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>
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
    canvas.panTo(40, 40);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, flow);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => setTimeout(done, 500))));

/** Each tie as drawn, against its connector set as drawn: the section it should stand in, and where it is drawn and kept. */
const sections = (page: Page) => page.evaluate(() => {
  const ties = (window as never as { ed: Ed }).ed.workflow().ties ?? [];
  const node = (id: string) => {
    const el = document.querySelector<HTMLElement>(`#cv > sherpa-node[data-heading="${id}"]`)!;
    return { left: Number(el.getAttribute('data-x')), right: Number(el.getAttribute('data-x')) + el.offsetWidth };
  };
  const drawn = (id: string) => Number(document.querySelector(`#cv rect.graph-tie[data-tie="${id}"]`)!.getAttribute('x')) + 2;
  const key = (r: { from: string; to: string }) => `${r.from}>${r.to}`;
  return ties.map((tie) => {
    // Its connector set: every tie sharing a connection with it, or with one that does.
    const set = [tie];
    for (let grew = true; grew;) {
      grew = false;
      for (const t of ties) if (!set.includes(t) && t.connections.some((r) => set.some((s) => s.connections.some((q) => key(q) === key(r))))) { set.push(t); grew = true; }
    }
    const lines = set.flatMap((t) => t.connections);
    const left = Math.max(...lines.map((r) => node(r.from.split('/')[0]!).right));
    const right = Math.min(...lines.map((r) => node(r.to.split('/')[0]!).left));
    const order = [...set].sort((p, q) => drawn(p.id) - drawn(q.id));
    const step = (right - left) / set.length;
    const i = order.indexOf(tie);
    return { id: tie.id, drawn: drawn(tie.id), kept: tie.x, min: left + step * (i + 0.2), max: left + step * (i + 0.8), room: right > left };
  });
});
/** The ties out of their sections, or kept apart from where they are drawn: none, when all is well. */
const astray = async (page: Page) => (await sections(page)).filter((t) => t.room && (t.drawn < t.min - 1 || t.drawn > t.max + 1 || Math.abs(t.drawn - t.kept) > 1)).map((t) => JSON.stringify(t));

test('each tie stands in 20% to 80% of its own section, as loaded and after Unfurl: two on one set never stack, none behind a grown node (TODO 973)', async ({ page }) => {
  await open(page, FLOW);
  // As loaded: drawn in its section, wherever it was kept.
  const loaded = await sections(page);
  expect(loaded.filter((t) => t.room && (t.drawn < t.min - 1 || t.drawn > t.max + 1))).toEqual([]);
  expect(new Set(loaded.filter((t) => t.id === 'one' || t.id === 'two').map((t) => t.drawn)).size, 'one and two stand apart').toBe(2);
  await page.locator('sherpa-node-toolbar sherpa-button.unfurl').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  // Unfurled: each in its section, drawn where it is kept.
  expect(await astray(page)).toEqual([]);
  expect((await sections(page)).every((t) => t.room), 'Unfurl leaves every set room').toBe(true);
});

test('in stages, after Unfurl and the stages\' fit, each tie stands in its section (TODO 973)', async ({ page }) => {
  await open(page, {
    v: 3, byHand: true as const, id: 'staged',
    stages: [{ id: 'plan', label: 'Plan', x: -40 }, { id: 'run', label: 'Run', x: 1100 }, { id: 'report', label: 'Report', x: 1700 }],
    nodes: [N('src', 'source', 0, 0, { values: { store: 'users' }, stage: 'plan' }), N('pick', 'field', 360, 0, { stage: 'plan' }), N('keep', 'condition', 720, 0, { values: { type: 'eq', b: 'x' }, stage: 'plan' }),
      N('sort1', 'organise', 1140, 0, { stage: 'run' }), N('sort2', 'organise', 1140, 300, { stage: 'run' }), N('end1', 'result', 1740, 0, { stage: 'report' }), N('end2', 'result', 1740, 300, { stage: 'report' })],
    connections: [R('src/rows', 'pick'), R('pick/field', 'keep'), R('keep/pass', 'sort1'), R('keep/pass', 'sort2'), R('sort1/rows', 'end1'), R('sort2/rows', 'end2')],
    ties: [{ id: 'a', x: 1000, y: 100, connections: [R('keep/pass', 'sort1'), R('keep/pass', 'sort2')] }, { id: 'b', x: 1600, y: 150, connections: [R('sort1/rows', 'end1'), R('sort2/rows', 'end2')] },
      { id: 'b2', x: 1610, y: 150, connections: [R('sort2/rows', 'end2')] }, { id: 'c', x: 300, y: 0, connections: [R('src/rows', 'pick')] }],
  });
  await page.locator('sherpa-node-toolbar sherpa-button.unfurl').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect(await astray(page)).toEqual([]);
});

test('a dragged tie stays in its own section: it never passes the next tie on its set (TODO 973)', async ({ page }) => {
  // One long line, 240 to 1200, two ties on it: sections 336–624 and 816–1104.
  await open(page, { v: 3, byHand: true as const, id: 'long', nodes: [N('s', 'source', 0, 0, { values: { store: 'users' } }), N('o', 'result', 1200, 0)], connections: [R('s/rows', 'o')],
    ties: [{ id: 'near', x: 500, y: 60, connections: [R('s/rows', 'o')] }, { id: 'far', x: 900, y: 60, connections: [R('s/rows', 'o')] }] });
  const before = await sections(page);
  const [first, second] = [...before].sort((p, q) => p.drawn - q.drawn);
  const bar = await page.locator(`#cv rect.graph-tie[data-tie="${first!.id}"]`).boundingBox();
  const [x, y] = [bar!.x + bar!.width / 2, bar!.y + bar!.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 200, y, { steps: 4 });
  await page.mouse.move(x + 600, y, { steps: 4 });
  await page.mouse.up();
  await settle(page);
  const after = await sections(page);
  const moved = after.find((t) => t.id === first!.id)!;
  expect([first!.id, moved.kept]).toEqual(['near', 624]);
  expect(moved.drawn).toBeLessThan(after.find((t) => t.id === second!.id)!.drawn);
  expect(await astray(page)).toEqual([]);
});
