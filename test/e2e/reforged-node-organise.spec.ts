import { test, expect, type Page } from './harness';

/**
 * ORGANISE AND PROPERTY ROWS — Will, TODO 835. Sort and Group are two kinds in an Organise category; Collection and its Count
 * type are gone. A property row is output only: a Source, a Field and a Group each draw a Count row with an output socket and
 * none in, and its connection is any output's. Real pointer and keys; the platform's own select. Plan 835
 */
type Flow = { nodes: { id: string; kind: string; heading?: string; values?: Record<string, unknown> }[]; connections: { from: string; to: string }[] };
type Ed = { workflow(): Flow; undo(): boolean; save(): boolean };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.style.cssText = 'inline-size: 1100px; block-size: 640px';
    const panel = document.createElement('sherpa-node-list');
    const box = document.createElement('sherpa-overlay-panel');
    box.slot = 'panel';
    for (const [a, v] of [['open', ''], ['data-heading', 'Nodes'], ['data-searchable', ''], ['data-padding', 'none']] as const) box.setAttribute(a, v);
    box.appendChild(panel);
    el.appendChild(box);
    document.getElementById('root')!.appendChild(el);
    const inspector = document.createElement('sherpa-overlay-panel');
    inspector.id = 'inspector';
    document.getElementById('root')!.appendChild(inspector);
    await el.rendered;
  });
});

async function bind(page: Page, flow: object): Promise<void> {
  await page.evaluate(async (given) => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const canvas = document.querySelector('#root sherpa-layout-canvas') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, given as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
      fieldsOf: { customers: { status: { label: 'Status' } } }, stores: ['customers'],
    });
    (window as never as { saved: unknown[] }).saved = [];
    document.addEventListener('definition-save', (e) => (window as never as { saved: unknown[] }).saved.push((e as CustomEvent<{ definition: unknown }>).detail.definition));
    await customElements.whenDefined('sherpa-node-list');
    await window.__settled();
    // Clear of the node panel, which sits at the canvas's right.
    canvas.zoomTo(0.5);
    canvas.panTo(60, 60);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, flow);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const flow = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as never as { ed: Ed }).ed.workflow())) as Flow);
const cards = '#root sherpa-layout-canvas > sherpa-node';
const card = (page: Page, heading: string, n = 0) => page.locator(`${cards}[data-heading="${heading}"]`).nth(n);
/** The drawn lines, by what they join. */
const lines = (page: Page) => page.evaluate(() => [...document.querySelectorAll<SVGPathElement>('#root svg.graph-connectors path[data-from]')].map((p) => `${p.dataset['from']} → ${p.dataset['to']}`));
/** A socket's middle on the screen: a card's header's, or one of its rows', by its words or, `[name]`, its field's name. */
async function socket(page: Page, heading: string, side: 'input' | 'output', row?: string, n = 0): Promise<[number, number]> {
  return card(page, heading, n).evaluate((el, [s, r]) => {
    const host = (r ? el.querySelector(r.startsWith('[') ? `sherpa-node-row:has(${r})` : `sherpa-node-row[data-label="${r}"]`) : el) as HTMLElement & { socketRect(side: string): DOMRect };
    const b = host.socketRect(s!);
    return [b.left + b.width / 2, b.top + b.height / 2] as [number, number];
  }, [side, row] as const);
}
async function drag(page: Page, [x1, y1]: [number, number], [x2, y2]: [number, number]): Promise<void> {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await page.mouse.up();
  await settle(page);
}
/** Place a node from the panel by a real drag, let go at a point of the canvas: found by its name first, so it is in view. */
async function place(page: Page, kind: string, [x, y]: [number, number]): Promise<void> {
  await page.locator('sherpa-overlay-panel .header > .search input:not([aria-label*="menu"])').fill(kind);
  await settle(page);
  const from = (await page.locator(`sherpa-node-list sherpa-list-item[data-kind="${kind}"]`).boundingBox())!;
  await drag(page, [from.x + from.width / 2, from.y + from.height / 2], [x, y]);
}

const node = (id: string, kind: string, x: number, y: number, values?: object) => ({ id, kind, x, y, ...(values ? { values } : {}) });
const BARE = { v: 3, id: 'g', nodes: [node('start', 'source', 360, 0, { store: 'customers' }), node('add', 'math', 1160, 0, { type: 'add' }), node('pick', 'field', 760, 340, { field: 'status' })], connections: [] };
/** A card's row by the words it says, its sockets as drawn. */
const rowOf = (page: Page, heading: string, label: string) => card(page, heading).locator(`sherpa-node-row[data-label="${label}"]`);
const connections = async (page: Page) => (await flow(page)).connections.map((r) => `${r.from} → ${r.to}`);

test('the panel lists Organise: Sort and Group; a Group dragged from it is placed, and no Collection is offered', async ({ page }) => {
  await bind(page, BARE);
  const heads = await page.locator('sherpa-node-list .category-heading').evaluateAll((els) => els.map((e) => e.getAttribute('data-heading')));
  expect(heads).toContain('Organise');
  expect(heads).not.toContain('Collections');
  const names = await page.locator('sherpa-node-list sherpa-list-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')));
  expect(names).toEqual(expect.arrayContaining(['Sort', 'Group']));
  expect(names).not.toContain('Collection');
  const box = (await page.locator('#root sherpa-layout-canvas').boundingBox())!;
  await place(page, 'group', [box.x + 560, box.y + 420]);
  expect((await flow(page)).nodes.map((n) => n.kind)).toEqual(['source', 'math', 'field', 'group']);
  // Its rows: Rows, then its Count property, which sends and takes nothing.
  await expect(card(page, 'Group')).toHaveAttribute('data-category', 'organise');
  await expect(rowOf(page, 'Group', 'Count')).toHaveAttribute('data-output-socket', 'value');
  await expect(rowOf(page, 'Group', 'Count')).not.toHaveAttribute('data-input-socket');
});

test('a property row connects like any output: the Source\'s Count into a Math\'s Value A by the real pointer, and a Field\'s into Value B', async ({ page }) => {
  await bind(page, BARE);
  for (const heading of ['Source', 'Field']) {
    await expect(rowOf(page, heading, 'Count')).toHaveAttribute('data-output-socket', 'value');
    await expect(rowOf(page, heading, 'Count')).not.toHaveAttribute('data-input-socket');
  }
  await drag(page, await socket(page, 'Source', 'output', 'Count'), await socket(page, 'Math', 'input', '[name="a"]'));
  await drag(page, await socket(page, 'Field', 'output', 'Count'), await socket(page, 'Math', 'input', '[name="b"]'));
  expect(await connections(page)).toEqual(['start/count → add/a', 'pick/count → add/b']);
  expect(await lines(page)).toEqual(['start/count → add/a', 'pick/count → add/b']);
  // A number into a number: no warning; the rows say where their values come from.
  await expect(card(page, 'Math')).not.toHaveAttribute('data-warning');
  await expect(card(page, 'Math').locator('sherpa-input-text[name="a"]')).toHaveAttribute('data-description', /Source › Count/);
  await expect(card(page, 'Math').locator('sherpa-input-text[name="b"]')).toHaveAttribute('data-description', /Field › Count/);
  // A count into a Sort's header, which takes a field, warns as any number does: the graph stays open.
  const box = (await page.locator('#root sherpa-layout-canvas').boundingBox())!;
  await place(page, 'sort', [box.x + 560, box.y + 460]);
  await drag(page, await socket(page, 'Source', 'output', 'Count'), await socket(page, 'Sort', 'input'));
  await expect(card(page, 'Sort')).toHaveAttribute('data-warning', 'Sort takes a field; it was given a number');
  // Save hands the graph over, the Count connections among its rows.
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.save())).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify((window as never as { saved: Flow[] }).saved.at(-1))) as Flow);
  expect(saved.connections.map((r) => `${r.from} → ${r.to}`)).toEqual(['start/count → add/a', 'pick/count → add/b', 'start/count → sort-1']);
});

test('a saved Collection draws nothing and says why: nothing converts it', async ({ page }) => {
  await bind(page, { ...BARE, nodes: [...BARE.nodes, node('old', 'collection', 0, 400, { type: 'count' })] });
  expect(await page.locator(cards).count()).toBe(3);
  expect(await page.evaluate(async () => {
    const { workflowFaults } = await import('/dist/data.js');
    return workflowFaults((window as never as { ed: { workflow(): never } }).ed.workflow());
  })).toEqual(['the node "old" is of the kind "collection", which is not one']);
});

test('a graph with a fault does not save: Save is refused, nothing is handed over, and the faults are said in words', async ({ page }) => {
  await bind(page, { ...BARE, nodes: [...BARE.nodes, node('old', 'collection', 0, 400, { type: 'count' })] });
  await page.evaluate(() => { (window as never as { refused: unknown[] }).refused = []; document.addEventListener('definition-refused', (e) => (window as never as { refused: unknown[] }).refused.push((e as CustomEvent<{ faults: string[] }>).detail.faults)); });
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.save())).toBe(false);
  expect(await page.evaluate(() => (window as never as { saved: unknown[] }).saved.length)).toBe(0);
  expect(await page.evaluate(() => (window as never as { refused: string[][] }).refused)).toEqual([['the node "old" is of the kind "collection", which is not one']]);
});

test('a node\'s details have its Name and Description and no X or Y: its place is a drag\'s, debug only (TODO 838)', async ({ page }) => {
  await bind(page, BARE);
  const b = (await card(page, 'Math').locator('sherpa-container-header').boundingBox())!;
  await page.mouse.click(b.x + b.width * 0.4, b.y + b.height / 2);
  await settle(page);
  const names = await page.locator('#inspector sherpa-input-text').evaluateAll((els) => els.map((e) => e.getAttribute('name')));
  expect(names).toEqual(expect.arrayContaining(['#heading', '#description']));
  expect(names).not.toContain('#x');
  expect(names).not.toContain('#y');
  // Its place is still the draft's: a read of the workflow gives it.
  expect(await page.evaluate(() => ((window as never as { ed: { workflow(): { nodes: { id: string; x: number }[] } } }).ed.workflow().nodes.find((n) => n.id === 'add')!.x))).toBe(1160);
});
