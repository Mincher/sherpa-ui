import { test, expect, type Page } from './harness';

/**
 * PORTALS — Will, TODO 779. An In and an Out joined by a name, with no line between them: what reaches an In
 * comes out of every Out of its name. A portal is placed from the panel, named from the graph's names or New
 * name…, and routed like any node; picking one lights every portal of its name, In and Out alike, in the picked
 * look; its Name row says how many match. Rename renames the name on every portal; a name that makes a loop is
 * refused, as a route is. Real pointer and keys; the platform's own select. TRAP T-a-portal-hop-is-resolved-once
 */
type Flow = { nodes: { id: string; kind: string; heading?: string; values?: Record<string, unknown> }[]; routes: { from: string; to: string }[] };
type Ed = { workflow(): Flow; undo(): boolean; save(): boolean };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.style.cssText = 'inline-size: 1100px; block-size: 640px';
    const panel = document.createElement('sherpa-node-panel');
    panel.slot = 'panel';
    el.appendChild(panel);
    document.getElementById('root')!.appendChild(el);
    const inspector = document.createElement('sherpa-overlay-panel');
    inspector.id = 'inspector';
    document.getElementById('root')!.appendChild(inspector);
    await el.rendered;
  });
});

const node = (id: string, kind: string, x: number, y: number, values?: object, heading?: string) => ({ id, kind, x, y, ...(values ? { values } : {}), ...(heading ? { heading } : {}) });
/** A Source, a Field and a Count, far apart: the portals go between. */
const BARE = { v: 2, id: 'g', nodes: [node('start', 'source', 360, 0, { store: 'customers' }), node('pick', 'field', 1160, 0, { field: 'status' }), node('count', 'collection', 1160, 340, { type: 'count' })], routes: [] };
/** Source → In "rows"; two Outs "rows" into the Field and the Count; an In "other" alone. */
const LINKED = {
  v: 2, id: 'g',
  nodes: [
    node('start', 'source', 0, 0, { store: 'customers' }), node('in', 'portal', 360, 0, { type: 'in', name: 'rows' }, 'In rows'),
    node('o1', 'portal', 720, 0, { type: 'out', name: 'rows' }, 'Out one'), node('o2', 'portal', 720, 300, { type: 'out', name: 'rows' }, 'Out two'),
    node('lone', 'portal', 360, 300, { type: 'in', name: 'other' }, 'In other'),
    node('pick', 'field', 1080, 0, { field: 'status' }), node('count', 'collection', 1080, 300, { type: 'count' }),
  ],
  routes: [{ from: 'start/rows', to: 'in' }, { from: 'o1', to: 'pick' }, { from: 'o2', to: 'count' }],
};

async function bind(page: Page, flow: object): Promise<void> {
  await page.evaluate(async (given) => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const canvas = document.querySelector('#root sherpa-layout-canvas') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, given as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-panel') as never,
      fieldsOf: { customers: { status: { label: 'Status' } } }, stores: ['customers'],
    });
    (window as never as { saved: unknown[] }).saved = [];
    document.addEventListener('definition-save', (e) => (window as never as { saved: unknown[] }).saved.push((e as CustomEvent<{ definition: unknown }>).detail.definition));
    await customElements.whenDefined('sherpa-node-panel');
    await window.__settled();
    // Clear of the node panel, which floats on the left.
    canvas.zoomTo(0.5);
    canvas.panTo(360, 60);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, flow);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const flow = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as never as { ed: Ed }).ed.workflow())) as Flow);
const cards = '#root sherpa-layout-canvas > sherpa-node';
const card = (page: Page, heading: string, n = 0) => page.locator(`${cards}[data-heading="${heading}"]`).nth(n);
/** The drawn lines, by what they join. */
const lines = (page: Page) => page.evaluate(() => [...document.querySelectorAll<SVGPathElement>('#root svg.graph-routes path[data-from]')].map((p) => `${p.dataset['from']} → ${p.dataset['to']}`));
/** A socket's middle on the screen: a card's header's, or one of its rows'. */
async function socket(page: Page, heading: string, side: 'input' | 'output', row?: string, n = 0): Promise<[number, number]> {
  return card(page, heading, n).evaluate((el, [s, r]) => {
    const host = (r ? el.querySelector(`sherpa-node-row[data-label="${r}"]`) : el) as HTMLElement & { socketRect(side: string): DOMRect };
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
  await page.locator('sherpa-node-panel sherpa-input-text.find input').fill(kind);
  await settle(page);
  const from = (await page.locator(`sherpa-node-panel sherpa-list-item[data-kind="${kind}"]`).boundingBox())!;
  await drag(page, [from.x + from.width / 2, from.y + from.height / 2], [x, y]);
}
/** Press a card's header with the real pointer, clear of its sockets and grip. */
async function press(page: Page, heading: string, n = 0): Promise<void> {
  const b = (await card(page, heading, n).locator('sherpa-container-header').boundingBox())!;
  await page.mouse.click(b.x + b.width * 0.4, b.y + b.height / 2);
  await settle(page);
}
const linked = (page: Page) => page.locator(`${cards}[data-linked]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-heading')));
const name = (page: Page, heading: string, n = 0) => card(page, heading, n).locator('sherpa-input-text[name="name"]');

test('a portal is placed from the panel, named, and routed: the Source\'s rows reach the Field through it, and no line joins the two', async ({ page }) => {
  await bind(page, BARE);
  const box = (await page.locator('#root sherpa-layout-canvas').boundingBox())!;
  await place(page, 'portal', [box.x + 560, box.y + 160]);
  await place(page, 'portal', [box.x + 560, box.y + 420]);
  expect((await flow(page)).nodes.filter((n) => n.kind === 'portal').map((n) => [n.id, n.values])).toEqual([['portal-1', undefined], ['portal-2', undefined]]);
  // The first: an In, named by New name…, the next free name. The second: an Out, picking that name.
  const choices = await name(page, 'Portal').locator('option').allTextContents();
  expect(choices).toEqual(['Pick a name', 'New name…']);
  await name(page, 'Portal').locator('select').selectOption({ label: 'New name…' });
  await settle(page);
  await card(page, 'Portal', 1).locator('sherpa-input-text[name="type"] select').selectOption('out');
  await settle(page);
  expect(await name(page, 'Portal', 1).locator('option').allTextContents()).toEqual(['Pick a name', 'Portal 1', 'New name…']);
  await name(page, 'Portal', 1).locator('select').selectOption('Portal 1');
  await settle(page);
  // Routed by the real pointer: the Source's Rows into the In, the Out into the Field.
  await drag(page, await socket(page, 'Source', 'output', 'Rows'), await socket(page, 'Portal', 'input'));
  await drag(page, await socket(page, 'Portal', 'output', undefined, 1), await socket(page, 'Field', 'input'));
  const now = await flow(page);
  expect(now.nodes.filter((n) => n.kind === 'portal').map((n) => [n.id, n.values])).toEqual([['portal-1', { name: 'Portal 1' }], ['portal-2', { type: 'out', name: 'Portal 1' }]]);
  expect(now.routes.map((r) => `${r.from} → ${r.to}`)).toEqual(['start/rows → portal-1', 'portal-2 → pick']);
  // Drawn: those two lines, none between the portals. The Out's socket is the rows' type; the Field warns of nothing.
  expect(await lines(page)).toEqual(['start/rows → portal-1', 'portal-2 → pick']);
  await expect(card(page, 'Portal', 1)).toHaveAttribute('data-output-socket', 'object');
  await expect(card(page, 'Field')).not.toHaveAttribute('data-warning');
  await expect(name(page, 'Portal')).toHaveAttribute('data-description', 'Sends to 1 Out portal');
  await expect(name(page, 'Portal', 1)).toHaveAttribute('data-description', 'Sends what reaches 1 In portal');
  // Save hands both over, and they read back the same.
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.save())).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify((window as never as { saved: Flow[] }).saved.at(-1))) as Flow);
  expect(saved.nodes.filter((n) => n.kind === 'portal').map((n) => n.values)).toEqual([{ name: 'Portal 1' }, { type: 'out', name: 'Portal 1' }]);
  expect(saved.routes.map((r) => `${r.from} → ${r.to}`)).toEqual(['start/rows → portal-1', 'portal-2 → pick']);
});

test('picking a portal lights every portal of its name, In and Out alike, in the picked look; a key does the same', async ({ page }) => {
  await bind(page, LINKED);
  expect(await linked(page)).toEqual([]);
  await press(page, 'In rows');
  expect(await linked(page)).toEqual(['Out one', 'Out two']);
  // The picked look: a linked Out's card is drawn as the picked In's, and not as a portal of another name.
  const look = (heading: string) => card(page, heading).evaluate((el) => {
    const s = getComputedStyle(el.shadowRoot!.querySelector('.root')!);
    return [s.backgroundColor, s.borderTopColor];
  });
  expect(await look('Out one')).toEqual(await look('In rows'));
  expect(await look('Out one')).not.toEqual(await look('In other'));
  // An Out, by its header and Enter: the In and the other Out light.
  await card(page, 'Out two').evaluate((el) => (el.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  await page.keyboard.press('Enter');
  await settle(page);
  await expect(card(page, 'Out two')).toHaveAttribute('data-current', '');
  expect(await linked(page)).toEqual(['In rows', 'Out one']);
  expect(await look('In rows')).toEqual(await look('Out two'));
  // A portal of no other: none lights. A click on another node: none.
  await press(page, 'In other');
  expect(await linked(page)).toEqual([]);
  await press(page, 'Field');
  expect(await linked(page)).toEqual([]);
  // Its Name row says how many match.
  await expect(name(page, 'In rows')).toHaveAttribute('data-description', 'Sends to 2 Out portals');
  await expect(name(page, 'Out one')).toHaveAttribute('data-description', 'Sends what reaches 1 In portal, with 1 other Out portal');
  await expect(name(page, 'In other')).toHaveAttribute('data-description', 'No Out portal has this name');
});

test('Rename, typed in the inspector, renames every portal of the name, one step; a name that makes a loop is refused', async ({ page }) => {
  await bind(page, LINKED);
  await press(page, 'Out one');
  const rename = page.locator('#inspector sherpa-input-text[name="#rename"]');
  await expect(rename).toHaveAttribute('data-description', 'Every portal named "rows" takes the new name');
  const input = rename.locator('input');
  await input.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('customers');
  await page.keyboard.press('Tab');
  await settle(page);
  const names = async () => (await flow(page)).nodes.filter((n) => n.kind === 'portal').map((n) => [n.id, n.values?.['name']]);
  expect(await names()).toEqual([['in', 'customers'], ['o1', 'customers'], ['o2', 'customers'], ['lone', 'other']]);
  // The links stay: the Field still reads the Source's rows.
  await expect(card(page, 'Field')).not.toHaveAttribute('data-warning');
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.undo())).toBe(true);
  await settle(page);
  expect(await names()).toEqual([['in', 'rows'], ['o1', 'rows'], ['o2', 'rows'], ['lone', 'other']]);
});

test('a name or a route that would make a loop through a portal is refused: the draft keeps what it had, and the select draws it back', async ({ page }) => {
  const LOOP = {
    v: 2, id: 'g',
    nodes: [
      node('start', 'source', 0, 0, { store: 'customers' }), node('pick', 'field', 360, 0, { field: 'status' }), node('test', 'condition', 720, 0, { type: 'eq' }),
      node('in', 'portal', 1080, 0, { type: 'in', name: 'back' }, 'In back'), node('out', 'portal', 0, 360, { type: 'out', name: 'other' }, 'Out'),
      node('lone', 'portal', 1080, 300, { type: 'in', name: 'other' }, 'In other'), node('count', 'collection', 360, 360, { type: 'count' }),
    ],
    routes: [{ from: 'start/rows', to: 'pick' }, { from: 'pick/field', to: 'test' }, { from: 'test/rows', to: 'in' }, { from: 'out', to: 'count' }, { from: 'count/count', to: 'test/b' }],
  };
  await bind(page, LOOP);
  await name(page, 'Out').locator('select').selectOption('back');
  await settle(page);
  expect((await flow(page)).nodes.find((n) => n.id === 'out')!.values).toEqual({ type: 'out', name: 'other' });
  await expect(name(page, 'Out')).toHaveJSProperty('value', 'other');
  // The Condition's True into the In "other", whose Out feeds the Count, whose count is the Condition's Value B: refused.
  const before = (await flow(page)).routes.map((r) => `${r.from} → ${r.to}`);
  await drag(page, await socket(page, 'Condition', 'output'), await socket(page, 'In other', 'input'));
  expect((await flow(page)).routes.map((r) => `${r.from} → ${r.to}`)).toEqual(before);
  expect(await lines(page)).toEqual(before);
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.save())).toBe(true);
});
