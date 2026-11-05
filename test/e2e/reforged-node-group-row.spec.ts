import { test, expect, type Page } from './harness';

/**
 * A Condition's GROUP row takes any boolean (Will, TODO 780: "0/1 or True or False is data"): a Value's 1 is a
 * constant part, said on the row and in the Outgoing JSON's tree, no warning; the Store's True joins by a drag,
 * no refusal; the Store's rows joins too, reads null and warns. Real pointer. TRAP T-a-condition-is-a-tree-of-nodes
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1100px; block-size: 640px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 2, id: 'group',
      nodes: [
        { id: 'one', kind: 'value', x: 20, y: 20, heading: 'One', values: { type: 'integer', value: '1' } },
        { id: 's', kind: 'store', x: 20, y: 320, values: { store: 'users' } },
        { id: 'c', kind: 'condition', x: 420, y: 20, values: { join: 'or', field: 'status', op: 'eq', value: 'active' } },
      ],
      routes: [{ from: 'one/value', to: 'c/group-2' }],
    };
    const w = window as unknown as Record<string, unknown>;
    w['heard'] = [];
    w['ed'] = bindWorkflow(el as never, flow as never, { session: new SessionStore(), inspector: panel as never, stores: ['users'], fields: { status: { label: 'Status' } } });
    (el as unknown as { zoomTo(z: number): void; panTo(x: number, y: number): void }).zoomTo(1);
    (el as unknown as { panTo(x: number, y: number): void }).panTo(0, 0);
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const COND = '#cv > sherpa-node[data-heading="Condition"]';
const groupRow = (page: Page) => page.locator(`${COND} sherpa-node-row`).evaluateAll((rows) => rows.map((r) => r.getAttribute('data-label')).filter((l) => l?.startsWith('Group')));
const socketAt = (page: Page, sel: string, side: string) => page.evaluate(([s, d]) => {
  const r = (document.querySelector(s!) as HTMLElement & { socketRect(side: string): DOMRect }).socketRect(d!);
  return [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
}, [sel, side]);
const groupSocket = (page: Page) => page.evaluate((c) => {
  const row = [...document.querySelectorAll(`${c} sherpa-node-row`)].find((r) => r.getAttribute('data-label')?.startsWith('Group')) as HTMLElement & { socketRect(side: string): DOMRect };
  const r = row.socketRect('input');
  return [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
}, COND);
const drag = async (page: Page, from: [number, number], to: [number, number]) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
  await settle(page);
};

test('a Value\'s 1 in the Group row is a constant part: the row says it, no warning, and Status or 1 always holds', async ({ page }) => {
  expect(await groupRow(page)).toEqual(['Group: 1']);
  expect(await page.locator(COND).getAttribute('data-warning')).toBeNull();
  const where = await page.evaluate(async () => {
    const { nodeFlow, workflowGraph } = await import('/dist/data.js');
    const ed = (window as unknown as { ed: { workflow(): unknown } }).ed;
    return (nodeFlow(workflowGraph(ed.workflow() as never), 'c') as { definition?: { where?: unknown } }).definition?.where;
  });
  expect(where).toBe(true);
});

test('the Store\'s True dropped on the Group row joins, no refusal; its rows join too, read null, and the Condition warns', async ({ page }) => {
  const heard: string[] = [];
  page.on('console', (m) => { if (/bindWorkflow/.test(m.text())) heard.push(m.text()); });
  await drag(page, await socketAt(page, '#cv > sherpa-node[data-heading="Store"]', 'output'), await groupSocket(page));
  expect(await page.evaluate(() => [...document.querySelectorAll('#cv svg.graph-routes path[data-to]')].map((p) => `${(p as SVGElement).dataset['from']}>${(p as SVGElement).dataset['to']}`))).toEqual(['s>c/group-2']);
  expect(await page.locator(COND).getAttribute('data-warning')).toBeNull();
  expect(await groupRow(page)).toEqual(['Group']);
  const rows = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#cv > sherpa-node[data-heading="Store"] sherpa-node-row')].find((r) => r.getAttribute('data-label') === 'Rows') as HTMLElement & { socketRect(side: string): DOMRect };
    const r = row.socketRect('output');
    return [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
  });
  await drag(page, rows, await groupSocket(page));
  expect(await page.locator(COND).getAttribute('data-warning')).toBe('Group takes a boolean; it was given rows');
  expect(heard, 'no refusal').toEqual([]);
});
