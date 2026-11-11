import { test, expect, type Page } from './harness';

/**
 * The Node Editor's picklists and gestures — Will, plan 713 M6, TODOs 557–559.
 * A picklist row edits through the draft's one door; a Value node connected to it
 * OVERRIDES it (read only, marked Custom), and cutting the connection gives the row's own
 * pick back. A connection's input end dragged to another input RECONNECTS it (557); let go
 * on the bare canvas, or picked by a click and Delete, it BREAKS (558); a click on the
 * blank canvas deselects every node and shuts the panel (559). Each by real pointer
 */
type Canvas = HTMLElement & { rendered: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 900px; block-size: 600px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
  });
});

/** A workflow bound on the harness canvas: Source › Field (Status) › Condition, a Value into its Value B; a Sort waits. */
const BIND = `async (connections) => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  const flow = { v: 3, id: 'g', nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'status', kind: 'value', x: 0, y: 260, values: { value: 'active' } },
    { id: 'filter', kind: 'condition', x: 360, y: 0, values: { type: 'eq', b: 'trial' } },
    { id: 'sort', kind: 'sort', x: 720, y: 0, values: { direction: 'asc' } },
    { id: 'pick', kind: 'field', x: 0, y: 460, values: { field: 'status' } },
  ], connections: connections ?? [{ from: 'start/rows', to: 'pick' }, { from: 'pick/field', to: 'filter' }, { from: 'status/value', to: 'filter/b' }] };
  window.editor = bindWorkflow(canvas, flow, {
    session: new SessionStore(), inspector: document.getElementById('inspector'),
    fieldsOf: { customers: { status: { label: 'Status', values: ['active', 'trial', 'churned'] }, plan: { label: 'Plan' } } }, stores: ['customers'],
  });
  window.saved = [];
  document.addEventListener('definition-save', (e) => window.saved.push(e.detail.definition));
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}`;
const bind = (page: Page, connections?: { from: string; to: string }[]) => page.evaluate(`(${BIND})(${JSON.stringify(connections ?? null)})`);

/** The saved workflow's connections, and each node's values: what the draft holds now. */
const DRAFT = `(() => { window.editor.save(); const d = window.saved.at(-1); return { connections: d.connections.map((r) => r.from + ' → ' + r.to), nodes: Object.fromEntries(d.nodes.map((n) => [n.id, n.values ?? null])) }; })()`;
const draft = (page: Page) => page.evaluate(DRAFT) as Promise<{ connections: string[]; nodes: Record<string, Record<string, unknown> | null> }>;
/** A connection's drawn lines, by what they join. */
const LINES = `[...document.querySelectorAll('#root svg.graph-connectors path[data-from]')].map((p) => p.dataset.from + ' → ' + p.dataset.to)`;
/** A socket's middle on the screen: a node's or a row's, by its selector. */
const SOCKET = `(el, side) => { const r = el.socketRect(side); return [r.left + r.width / 2, r.top + r.height / 2]; }`;
const at = (page: Page, selector: string, side: string) =>
  page.evaluate(([sel, s, socket]) => eval(socket!)(document.querySelector(sel!), s), [selector, side, SOCKET]) as Promise<[number, number]>;
const row = (node: string, name: string) => `#root sherpa-node[data-heading="${node}"] sherpa-node-row:has([name="${name}"])`;
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));

/** A spot of the blank canvas: no node, and none of the canvas's own controls, under it. */
async function blank(page: Page): Promise<[number, number]> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#root sherpa-layout-canvas')!;
    const box = canvas.getBoundingClientRect();
    for (let y = box.bottom - 200; y > box.top + 20; y -= 20) {
      for (let x = box.left + 20; x < box.right - 20; x += 20) {
        const free = document.elementsFromPoint(x, y).every((e) => e.localName !== 'sherpa-node')
          && canvas.shadowRoot!.elementsFromPoint(x, y).every((e) => !e.closest('.minimap, .controls'));
        if (free) return [x, y] as [number, number];
      }
    }
    throw new Error('no blank spot');
  });
}

/** Press on a point, move to another, let go: a drag, in steps. */
async function drag(page: Page, [x1, y1]: [number, number], [x2, y2]: [number, number]): Promise<void> {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await page.mouse.up();
  await settle(page);
}

const filterValue = `${row('Condition', 'b')} sherpa-input-text`;
/** The Field into the Condition, with no Value into its Value B. */
const FED = [{ from: 'start/rows', to: 'pick' }, { from: 'pick/field', to: 'filter' }];

test('a picklist row edits through the draft\'s one door: the Condition\'s Value B is its Field\'s values, the Value node\'s Type is a list', async ({ page }) => {
  await bind(page, FED);
  const options = await page.locator(`${filterValue} option`).allTextContents();
  await page.locator(`${filterValue} select`).selectOption('churned');
  await page.locator(`${row('Value', 'type')} select`).selectOption('text');
  const types = await page.locator(`${row('Value', 'type')} option`).allTextContents();
  await page.locator(`${row('Sort', 'direction')} select`).selectOption('desc');
  const r = await draft(page);
  expect(options).toEqual(['active', 'trial', 'churned']);
  expect(types).toEqual(['Text', 'Integer', 'Decimal', 'Date', 'True/false', 'List']);
  expect(r.nodes).toMatchObject({ filter: { type: 'eq', b: 'churned' }, status: { value: 'active', type: 'text' }, sort: { direction: 'desc' } });
});

test('a Value node connected to a picklist OVERRIDES it: "active Custom", read only; cut the connection and its own pick is back', async ({ page }) => {
  await bind(page);
  const shown = () => page.evaluate((sel) => {
    const f = document.querySelector<HTMLElement & { value: string }>(sel)!;
    const select = f.shadowRoot!.querySelector('select')!;
    return { value: f.value, text: select.selectedOptions[0]?.textContent, readOnly: f.hasAttribute('readonly') && !f.hasAttribute('disabled') && !select.disabled, description: f.getAttribute('data-description') };
  }, filterValue);
  const over = await shown();
  expect(over).toEqual({ value: 'active', text: 'active Custom', readOnly: true, description: 'Custom value, from Value › Value' });
  // Pick the connector, then Delete: the connection is cut.
  const [mx, my] = await page.evaluate(() => {
    const hit = document.querySelector<SVGPolylineElement>('#root svg.graph-connectors polyline[data-to="filter/b"]')!;
    const p = hit.points.getItem(8);
    const m = hit.getScreenCTM()!;
    return [m.a * p.x + m.e, m.d * p.y + m.f];
  });
  await page.mouse.click(mx, my);
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await page.evaluate(LINES)).toEqual(['start/rows → pick', 'pick/field → filter']);
  expect(await shown()).toEqual({ value: 'trial', text: 'trial', readOnly: false, description: null });
});

test('557 a connection\'s input end dragged to another input RECONNECTS it: the first row has its own pick back', async ({ page }) => {
  await bind(page);
  // A Sort has no Field row now (plan 783 D5): the other picklist is the Field node's own.
  const from = await at(page, row('Condition', 'b'), 'input');
  const to = await at(page, row('Field', 'field'), 'input');
  await drag(page, from, to);
  expect(await page.evaluate(LINES)).toEqual(['start/rows → pick', 'pick/field → filter', 'status/value → pick/field']);
  const r = await page.evaluate(() => ({
    filter: document.querySelector<HTMLElement & { value: string }>('#root sherpa-node[data-heading="Condition"] sherpa-input-text[name="b"]')!.value,
    field: document.querySelector<HTMLElement & { value: string }>('#root sherpa-node[data-heading="Field"] sherpa-input-text[name="field"]')!.value,
    fieldLocked: document.querySelector('#root sherpa-node[data-heading="Field"] sherpa-input-text[name="field"]')!.hasAttribute('readonly'),
  }));
  // The Field now mirrors "active"; the Condition's Value B is its own again.
  expect(r).toEqual({ filter: 'trial', field: 'active', fieldLocked: true });
  // Dropped where it began: nothing changes.
  const home = await at(page, row('Field', 'field'), 'input');
  await drag(page, home, home);
  expect(await page.evaluate(LINES)).toEqual(['start/rows → pick', 'pick/field → filter', 'status/value → pick/field']);
});

test('558 a connection\'s end let go over the bare canvas BREAKS it; a click on a connector, then Backspace, does too', async ({ page }) => {
  await bind(page);
  await drag(page, await at(page, row('Condition', 'b'), 'input'), await blank(page));
  const first = await page.evaluate(LINES);
  const kept = await draft(page);
  expect(first).toEqual(['start/rows → pick', 'pick/field → filter']);
  expect(kept.nodes['filter']).toEqual({ type: 'eq', b: 'trial' });
  // The connection into the header, by a click and Backspace.
  const [mx, my] = await page.evaluate(() => {
    const hit = document.querySelector<SVGPolylineElement>('#root svg.graph-connectors polyline[data-to="filter"]')!;
    const p = hit.points.getItem(8);
    const m = hit.getScreenCTM()!;
    return [m.a * p.x + m.e, m.d * p.y + m.f];
  });
  await page.mouse.click(mx, my);
  expect(await page.evaluate(() => document.querySelectorAll('#root svg.graph-connectors path[data-selected]').length)).toBe(1);
  await page.keyboard.press('Backspace');
  await settle(page);
  expect(await page.evaluate(LINES)).toEqual(['start/rows → pick']);
});

test('a line dragged out of an unconnected picklist\'s input onto the bare canvas makes a Value node there, holding the row\'s pick, connected in', async ({ page }) => {
  await bind(page, FED);
  const spot = await blank(page);
  await drag(page, await at(page, row('Sort', 'direction'), 'input'), spot);
  const r = await draft(page);
  expect(r.connections).toEqual(['start/rows → pick', 'pick/field → filter', 'value-1/value → sort/direction']);
  expect(r.nodes['value-1']).toEqual({ value: 'asc' });
  // The row mirrors it, and marks it Custom; its own pick is kept.
  const text = await page.evaluate(() => document.querySelector('#root sherpa-node[data-heading="Sort"] sherpa-input-text[name="direction"]')!.shadowRoot!.querySelector('select')!.selectedOptions[0]!.textContent);
  expect(text).toBe('asc Custom');
  expect(r.nodes['sort']).toEqual({ direction: 'asc' });
});

test('with no pointer: the inspector\'s "Custom value" makes the Value node; its "Cut connection" cuts it; "Remove node" removes the node and its connections', async ({ page }) => {
  await bind(page, FED);
  await page.locator('#root sherpa-node[data-heading="Condition"]').click({ position: { x: 40, y: 12 } });
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  const panel = page.locator('#inspector');
  await panel.getByRole('button', { name: 'Custom value' }).first().click();
  await settle(page);
  expect((await draft(page)).connections.length).toBe(3);
  // The node is still the one picked: its row says where the custom value comes from.
  await panel.getByRole('button', { name: /Cut connection from Value/ }).click();
  await settle(page);
  expect((await draft(page)).connections).toEqual(['start/rows → pick', 'pick/field → filter']);
  await panel.getByRole('button', { name: 'Remove node' }).click();
  await settle(page);
  const r = await draft(page);
  expect(Object.keys(r.nodes)).toEqual(['start', 'status', 'sort', 'pick', 'value-1']);
  expect(r.connections).toEqual(['start/rows → pick']);
  expect(await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { open: boolean }).open)).toBe(true);
  await expect(page.locator('#inspector sherpa-empty-state')).toHaveCount(1);
});

test('559 a click on the blank canvas deselects every node and puts the empty state back; a drag across it does not', async ({ page }) => {
  await bind(page);
  await page.locator('#root sherpa-node[data-heading="Sort"]').click({ position: { x: 40, y: 12 } });
  const state = () => page.evaluate(() => ({
    current: [...document.querySelectorAll('#root sherpa-node[data-current]')].map((n) => (n as HTMLElement).dataset['heading']),
    open: (document.getElementById('inspector') as HTMLElement & { open: boolean }).open,
  }));
  expect(await state()).toEqual({ current: ['Sort'], open: true });
  const [x, y] = await blank(page);
  // A pan (Space + drag; a plain drag is a box now): the pointer moves, so it is no click.
  await page.evaluate(() => (document.querySelector('#root sherpa-layout-canvas')!.shadowRoot!.querySelector('.viewport') as HTMLElement).focus());
  await page.keyboard.down('Space');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y + 10, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  expect(await state()).toEqual({ current: ['Sort'], open: true });
  const [bx, by] = await blank(page);
  await page.mouse.click(bx, by);
  await settle(page);
  expect(await state()).toEqual({ current: [], open: true });
  await expect(page.locator('#inspector sherpa-empty-state')).toHaveCount(1);
});
