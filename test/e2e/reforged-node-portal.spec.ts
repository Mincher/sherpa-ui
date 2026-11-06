import { test, expect, type Page } from './harness';

/**
 * PORTALS — Will, TODOs 779 and 826. An In and an Out joined by a name, with no line between them. An In takes many
 * routes; every Out of its name draws a ROW per route into an In of the name, labelled from its source, and each row is
 * routed on alone. A portal is placed from the panel, named from the graph's names or New name…, and routed like any
 * node; a route in cut takes its row away, and Undo brings it and its route out back. Picking a portal lights every
 * portal of its name, In and Out alike, in the picked look; its Name row says how many match. Rename renames the name
 * on every portal; a name or a route that makes a loop is refused. Real pointer and keys; the platform's own select.
 * TRAP T-a-portal-hop-is-resolved-once
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
/** A Source and a Value, a Field and a Condition, far apart: the portals go between. */
const BARE = {
  v: 2, id: 'g',
  nodes: [
    node('start', 'source', 360, 0, { store: 'customers' }), node('v', 'value', 360, 300, { type: 'text', value: 'active' }),
    node('pick', 'field', 1160, 0, { field: 'status' }), node('eq', 'condition', 1160, 300, { type: 'eq' }),
  ],
  routes: [],
};
/** Source → In "rows"; two Outs "rows", their row into the Field and the Count; an In "other" alone. */
const LINKED = {
  v: 2, id: 'g',
  nodes: [
    node('start', 'source', 0, 0, { store: 'customers' }), node('in', 'portal', 360, 0, { type: 'in', name: 'rows' }, 'In rows'),
    node('o1', 'portal', 720, 0, { type: 'out', name: 'rows' }, 'Out one'), node('o2', 'portal', 720, 300, { type: 'out', name: 'rows' }, 'Out two'),
    node('lone', 'portal', 360, 300, { type: 'in', name: 'other' }, 'In other'),
    node('pick', 'field', 1080, 0, { field: 'status' }), node('count', 'group', 1080, 300),
  ],
  routes: [{ from: 'start/rows', to: 'in' }, { from: 'o1/@start/rows', to: 'pick' }, { from: 'o2/@start/rows', to: 'count' }],
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

/** An Out's rows as drawn: each row's label, by the rows with an output and no field. */
const rows = (page: Page, heading: string, n = 0) => card(page, heading, n).locator('sherpa-node-row').evaluateAll((els) =>
  els.filter((e) => e.hasAttribute('data-output-socket') && !e.querySelector('[name]')).map((e) => e.getAttribute('data-label')));
const routes = async (page: Page) => (await flow(page)).routes.map((r) => `${r.from} → ${r.to}`);

test('two routes into one In make two rows on its Out, each routed on alone by the real pointer; no line joins the portals', async ({ page }) => {
  await bind(page, BARE);
  const box = (await page.locator('#root sherpa-layout-canvas').boundingBox())!;
  await place(page, 'portal', [box.x + 560, box.y + 160]);
  await place(page, 'portal', [box.x + 560, box.y + 420]);
  // The first: an In, named by New name…; the second: an Out, picking that name.
  expect(await name(page, 'Portal').locator('option').allTextContents()).toEqual(['Pick a name', 'New name…']);
  await name(page, 'Portal').locator('select').selectOption({ label: 'New name…' });
  await settle(page);
  await card(page, 'Portal', 1).locator('sherpa-input-text[name="type"] select').selectOption('out');
  await settle(page);
  await name(page, 'Portal', 1).locator('select').selectOption('Portal 1');
  await settle(page);
  // Before anything comes in, the Out has no row and no header socket.
  expect(await rows(page, 'Portal', 1)).toEqual([]);
  await expect(card(page, 'Portal', 1)).not.toHaveAttribute('data-output-socket');
  // The Source's Rows and the Value into the In, which takes many: a row each on the Out, labelled from its source.
  await drag(page, await socket(page, 'Source', 'output', '[name="store"]'), await socket(page, 'Portal', 'input'));
  await drag(page, await socket(page, 'Value', 'output', '[name="value"]'), await socket(page, 'Portal', 'input'));
  await expect(card(page, 'Portal')).toHaveAttribute('data-input-many', '');
  expect(await rows(page, 'Portal', 1)).toEqual(['Source › Rows', 'Value › Value']);
  await expect(name(page, 'Portal', 1)).toHaveAttribute('data-description', '2 rows, from 1 In portal');
  // Each row routed on alone: the rows into the Field, the Value into the Condition's Value B.
  await drag(page, await socket(page, 'Portal', 'output', 'Source › Rows', 1), await socket(page, 'Field', 'input'));
  await drag(page, await socket(page, 'Portal', 'output', 'Value › Value', 1), await socket(page, 'Condition', 'input', '[name="b"]'));
  const made = ['start/rows → portal-1', 'v/value → portal-1', 'portal-2/@start/rows → pick', 'portal-2/@v/value → eq/b'];
  expect(await routes(page)).toEqual(made);
  expect(await lines(page)).toEqual(made);
  await expect(card(page, 'Field')).not.toHaveAttribute('data-warning');
  await expect(card(page, 'Condition').locator('sherpa-input-text[name="b"]')).toHaveJSProperty('value', 'active');
  // Save hands them over.
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.save())).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify((window as never as { saved: Flow[] }).saved.at(-1))) as Flow);
  expect(saved.routes.map((r) => `${r.from} → ${r.to}`)).toEqual(made);
});

test('a route in cut takes its row away, and its route out is kept unseen; Undo brings both back', async ({ page }) => {
  await bind(page, { ...LINKED, routes: [...LINKED.routes, { from: 'pick/field', to: 'lone' }] });
  await card(page, 'In other').evaluate((el) => (el.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  // Picked by its connector, then Delete: the route from the Source into the In is cut.
  const [mx, my] = await page.evaluate(() => {
    const hit = document.querySelector<SVGPolylineElement>('#root svg.graph-routes polyline[data-from="start/rows"][data-to="in"]')!;
    const p = hit.points.getItem(Math.floor(hit.points.numberOfItems / 2));
    const m = hit.getScreenCTM()!;
    return [m.a * p.x + m.e, m.d * p.y + m.f];
  });
  await page.mouse.click(mx, my);
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await rows(page, 'Out one')).toEqual([]);
  expect(await lines(page)).toEqual(['pick/field → lone']);
  // The draft keeps the routes out of the gone rows; Save leaves them out.
  expect(await routes(page)).toEqual(['o1/@start/rows → pick', 'o2/@start/rows → count', 'pick/field → lone']);
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.undo())).toBe(true);
  await settle(page);
  expect(await rows(page, 'Out one')).toEqual(['Source › Rows']);
  expect(await lines(page)).toEqual(['start/rows → in', 'o1/@start/rows → pick', 'o2/@start/rows → count', 'pick/field → lone']);
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
  // A portal of no other: none lights. Another node: none.
  await press(page, 'In other');
  expect(await linked(page)).toEqual([]);
  await press(page, 'Field');
  expect(await linked(page)).toEqual([]);
  // Its Name row says how many match, an Out its rows.
  await expect(name(page, 'In rows')).toHaveAttribute('data-description', 'Sends to 2 Out portals');
  await expect(name(page, 'Out one')).toHaveAttribute('data-description', '1 row, from 1 In portal, with 1 other Out portal');
  await expect(name(page, 'In other')).toHaveAttribute('data-description', 'No Out portal has this name');
});

test('Rename, typed in the inspector, renames every portal of the name, one step: the rows and their routes stay', async ({ page }) => {
  await bind(page, LINKED);
  await press(page, 'Out one');
  const rename = page.locator('#inspector sherpa-input-text[name="#rename"]');
  await expect(rename).toHaveAttribute('data-description', 'Every portal named "rows" takes the new name');
  await rename.locator('input').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('customers');
  await page.keyboard.press('Tab');
  await settle(page);
  const names = async () => (await flow(page)).nodes.filter((n) => n.kind === 'portal').map((n) => [n.id, n.values?.['name']]);
  expect(await names()).toEqual([['in', 'customers'], ['o1', 'customers'], ['o2', 'customers'], ['lone', 'other']]);
  expect(await rows(page, 'Out one')).toEqual(['Source › Rows']);
  expect(await lines(page)).toEqual(['start/rows → in', 'o1/@start/rows → pick', 'o2/@start/rows → count']);
  await expect(card(page, 'Field')).not.toHaveAttribute('data-warning');
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.undo())).toBe(true);
  await settle(page);
  expect(await names()).toEqual([['in', 'rows'], ['o1', 'rows'], ['o2', 'rows'], ['lone', 'other']]);
});

test('a name or a route that would make a loop through a row is refused: the draft keeps what it had, and the select draws it back', async ({ page }) => {
  // The Condition's rows into the In "back". The Out named "other" holds a route kept from a row it had, into the Count,
  // whose count is the Condition's Value B: named "back" again, that row would close a loop.
  const LOOP = {
    v: 2, id: 'g',
    nodes: [
      node('start', 'source', 0, 0, { store: 'customers' }), node('pick', 'field', 360, 0, { field: 'status' }), node('test', 'condition', 720, 0, { type: 'eq' }),
      node('in', 'portal', 1080, 0, { type: 'in', name: 'back' }, 'In back'), node('out', 'portal', 0, 360, { type: 'out', name: 'other' }, 'Out'),
      node('out2', 'portal', 0, 620, { type: 'out', name: 'back' }, 'Out back'), node('count', 'group', 360, 360),
    ],
    routes: [{ from: 'start/rows', to: 'pick' }, { from: 'pick/field', to: 'test' }, { from: 'test/rows', to: 'in' }, { from: 'out/@test/rows', to: 'count' }, { from: 'count/count', to: 'test/b' }],
  };
  await bind(page, LOOP);
  await name(page, 'Out').locator('select').selectOption('back');
  await settle(page);
  expect((await flow(page)).nodes.find((n) => n.id === 'out')!.values).toEqual({ type: 'out', name: 'other' });
  await expect(name(page, 'Out')).toHaveJSProperty('value', 'other');
  // The other Out's row into the Count: the same loop, refused.
  const before = await routes(page);
  expect(await rows(page, 'Out back')).toEqual(['Condition › Rows']);
  await drag(page, await socket(page, 'Out back', 'output', 'Condition › Rows'), await socket(page, 'Group', 'input'));
  expect(await routes(page)).toEqual(before);
  expect(await lines(page)).toEqual(['start/rows → pick', 'pick/field → test', 'test/rows → in', 'count/count → test/b']);
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.save())).toBe(true);
});
